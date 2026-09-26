"""
The demo product-detail-page content model this repo provisions on a
store: two metaobject definitions (`demo_pdp_module`, `demo_brand_theme`)
plus a product metafield (`custom.pdp_modules`) that references
`demo_pdp_module` entries, list-typed so one product can carry several
modules.

Every definition below is created with `access.storefront = PUBLIC_READ`
explicitly (see `catalog/shopify_client.py:create_metaobject_definition`
for why this matters, not just as a default): the point of provisioning
this content model at all is to have something a real storefront can
query. A definition left at Shopify's default access is admin-only and
would look identical to a correctly-provisioned one in the Admin UI
while being invisible to the Storefront API, so `access` is passed on
every create call here rather than relied on as a default.

`DemoContentProvisioner.provision()` is idempotent the same way
`catalog/sync.py`'s upserts are: every step asks Shopify (not just this
app's local DB mirror) whether the object it is about to create already
exists, by type/handle/namespace+key, and reuses it if so. Running
`manage.py provision_demo_content` a second time against an already
provisioned store must create nothing new and report every step as
"reused", not error on a duplicate and not silently create a second
copy. The local DB mirror (`MetaobjectDefinition`, `MetaobjectEntry`,
`ProductMetafieldDefinition`) exists so state is inspectable locally,
but it is never the source of truth for "does this already exist" -
Shopify's own read-back queries are, because the mirror can drift (a
definition deleted in the Admin UI, a DB restored from an older
backup) in ways that would make a local-only idempotency check lie.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

from catalog.models import MetaobjectDefinition, MetaobjectEntry, ProductMetafieldDefinition, Store
from catalog.shopify_client import ShopifyGraphQLClient

logger = logging.getLogger("catalog.demo_content")

PDP_MODULE_TYPE = "demo_pdp_module"
PDP_MODULE_NAME = "Demo PDP Module"

BRAND_THEME_TYPE = "demo_brand_theme"
BRAND_THEME_NAME = "Demo Brand Theme"

PRODUCT_METAFIELD_NAMESPACE = "custom"
PRODUCT_METAFIELD_KEY = "pdp_modules"
PRODUCT_METAFIELD_OWNER_TYPE = "PRODUCT"

MIN_PRODUCTS_TO_ATTACH = 3

PDP_MODULE_FIELD_DEFINITIONS = [
    {
        "key": "module_type",
        "type": "single_line_text_field",
        "name": "Module type",
        "required": True,
        "validations": [{"name": "choices", "value": json.dumps(["care", "size_guide", "bundle"])}],
    },
    {
        "key": "heading",
        "type": "single_line_text_field",
        "name": "Heading",
        "required": True,
    },
    {
        "key": "body",
        "type": "multi_line_text_field",
        "name": "Body",
    },
    {
        "key": "display_order",
        "type": "number_integer",
        "name": "Display order",
    },
    {
        "key": "icon",
        "type": "single_line_text_field",
        "name": "Icon",
    },
]

BRAND_THEME_FIELD_DEFINITIONS = [
    {"key": "primary_color", "type": "color", "name": "Primary color"},
    {"key": "surface_color", "type": "color", "name": "Surface color"},
    {"key": "text_color", "type": "color", "name": "Text color"},
    {"key": "heading_font", "type": "single_line_text_field", "name": "Heading font"},
    {"key": "body_font", "type": "single_line_text_field", "name": "Body font"},
    {"key": "radius", "type": "number_integer", "name": "Radius"},
]

# Seed entries. Handles are explicit (not auto-generated from the
# heading) so re-running the command looks up the same entry every
# time, independent of any copy edits made to `heading`/`body` later.
SEED_PDP_MODULES = [
    {
        "handle": "demo-pdp-module-care",
        "fields": {
            "module_type": "care",
            "heading": "Care Instructions",
            "body": (
                "Machine wash cold, inside out, with like colors. Tumble dry low. "
                "Do not bleach. Warm iron if needed, avoiding any printed graphic."
            ),
            "display_order": "1",
            "icon": "droplet",
        },
    },
    {
        "handle": "demo-pdp-module-size-guide",
        "fields": {
            "module_type": "size_guide",
            "heading": "Size Guide",
            "body": (
                "True to size for most fits. Between sizes? Size up for a relaxed cut, "
                "size down for fitted. Full chest/waist/hip chart in the size table below."
            ),
            "display_order": "2",
            "icon": "ruler",
        },
    },
    {
        "handle": "demo-pdp-module-bundle",
        "fields": {
            "module_type": "bundle",
            "heading": "Complete the Look",
            "body": "Pairs well with our essentials tee and everyday cap. Bundle and save 15% versus buying separately.",
            "display_order": "3",
            "icon": "shopping-bag",
        },
    },
]

SEED_BRAND_THEME = {
    "handle": "demo-brand-theme-default",
    "fields": {
        "primary_color": "#1F2A24",
        "surface_color": "#F6F3EC",
        "text_color": "#1A1A1A",
        "heading_font": "Cormorant",
        "body_font": "Montserrat",
        "radius": "8",
    },
}


@dataclass
class StepResult:
    """One provisioning step's outcome, for the command's summary output."""

    label: str
    action: str  # "created", "reused", or "would create" (dry run)
    shopify_gid: str | None = None
    detail: str = ""


@dataclass
class ProvisionReport:
    steps: list[StepResult] = field(default_factory=list)

    def add(self, label: str, action: str, shopify_gid: str | None = None, detail: str = "") -> None:
        self.steps.append(StepResult(label=label, action=action, shopify_gid=shopify_gid, detail=detail))


class DemoContentProvisioner:
    """
    Provisions the demo PDP content model on one store and mirrors the
    result into the local DB. `dry_run=True` makes every step read-only:
    it still queries Shopify to check what already exists (so the
    report is accurate), but never calls a create mutation and never
    writes to the local DB.
    """

    def __init__(self, store: Store, client: ShopifyGraphQLClient, dry_run: bool = False):
        self.store = store
        self.client = client
        self.dry_run = dry_run
        self.report = ProvisionReport()
        # type -> {"gid": ..., "entries": {handle: gid}}, filled in as
        # definitions/entries are ensured, so later steps (the product
        # metafield definition's validation, the seed entries' product
        # attachment) can reference GIDs created earlier in this run.
        self._definition_gids: dict[str, str] = {}
        self._entry_gids: dict[str, dict[str, str]] = {}

    def provision(self) -> ProvisionReport:
        self._ensure_metaobject_definition(PDP_MODULE_TYPE, PDP_MODULE_NAME, PDP_MODULE_FIELD_DEFINITIONS)
        self._ensure_metaobject_definition(BRAND_THEME_TYPE, BRAND_THEME_NAME, BRAND_THEME_FIELD_DEFINITIONS)
        self._ensure_product_metafield_definition()

        self._entry_gids[PDP_MODULE_TYPE] = {}
        for seed in SEED_PDP_MODULES:
            self._ensure_metaobject_entry(PDP_MODULE_TYPE, seed["handle"], seed["fields"])

        self._entry_gids[BRAND_THEME_TYPE] = {}
        self._ensure_metaobject_entry(BRAND_THEME_TYPE, SEED_BRAND_THEME["handle"], SEED_BRAND_THEME["fields"])

        self._attach_modules_to_products()
        return self.report

    # --- Metaobject / metafield definitions -------------------------------

    def _ensure_metaobject_definition(self, type_: str, name: str, field_definitions: list[dict]) -> None:
        existing = self.client.fetch_metaobject_definition_by_type(type_)
        if existing:
            self._definition_gids[type_] = existing["id"]
            self._sync_definition_to_db(type_, existing)
            self.report.add(
                f"metaobject definition '{type_}'",
                "reused",
                existing["id"],
                f"storefront access: {existing.get('access', {}).get('storefront')}",
            )
            return

        if self.dry_run:
            self.report.add(f"metaobject definition '{type_}'", "would create")
            return

        created = self.client.create_metaobject_definition(
            type_, name, field_definitions, storefront_access="PUBLIC_READ"
        )
        self._definition_gids[type_] = created["id"]
        self._sync_definition_to_db(type_, created)
        self.report.add(f"metaobject definition '{type_}'", "created", created["id"])

    def _sync_definition_to_db(self, type_: str, node: dict) -> None:
        MetaobjectDefinition.objects.update_or_create(
            store=self.store,
            type=type_,
            defaults={
                "name": node.get("name", ""),
                "shopify_gid": node["id"],
                "storefront_access": node.get("access", {}).get("storefront", ""),
                "field_definitions": node.get("fieldDefinitions", []),
            },
        )

    def _ensure_product_metafield_definition(self) -> None:
        existing = self.client.fetch_metafield_definition(
            PRODUCT_METAFIELD_NAMESPACE, PRODUCT_METAFIELD_KEY, PRODUCT_METAFIELD_OWNER_TYPE
        )
        if existing:
            self._sync_metafield_definition_to_db(existing)
            self.report.add(
                f"metafield definition '{PRODUCT_METAFIELD_NAMESPACE}.{PRODUCT_METAFIELD_KEY}'",
                "reused",
                existing["id"],
                f"storefront access: {existing.get('access', {}).get('storefront')}",
            )
            return

        if self.dry_run:
            self.report.add(
                f"metafield definition '{PRODUCT_METAFIELD_NAMESPACE}.{PRODUCT_METAFIELD_KEY}'", "would create"
            )
            return

        pdp_module_definition_gid = self._definition_gids.get(PDP_MODULE_TYPE)
        if not pdp_module_definition_gid:
            raise RuntimeError(
                "Cannot create the product metafield definition: the "
                f"'{PDP_MODULE_TYPE}' metaobject definition has no GID yet "
                "(it should have been created or fetched just before this step)."
            )
        created = self.client.create_metafield_definition(
            PRODUCT_METAFIELD_NAMESPACE,
            PRODUCT_METAFIELD_KEY,
            "PDP Modules",
            PRODUCT_METAFIELD_OWNER_TYPE,
            "list.metaobject_reference",
            validations=[{"name": "metaobject_definition_id", "value": pdp_module_definition_gid}],
            storefront_access="PUBLIC_READ",
        )
        self._sync_metafield_definition_to_db(created)
        self.report.add(
            f"metafield definition '{PRODUCT_METAFIELD_NAMESPACE}.{PRODUCT_METAFIELD_KEY}'", "created", created["id"]
        )

    def _sync_metafield_definition_to_db(self, node: dict) -> None:
        ProductMetafieldDefinition.objects.update_or_create(
            store=self.store,
            namespace=node.get("namespace", PRODUCT_METAFIELD_NAMESPACE),
            key=node.get("key", PRODUCT_METAFIELD_KEY),
            owner_type=node.get("ownerType", PRODUCT_METAFIELD_OWNER_TYPE),
            defaults={
                "name": node.get("name", ""),
                "metafield_type": (node.get("type") or {}).get("name", ""),
                "shopify_gid": node["id"],
                "storefront_access": node.get("access", {}).get("storefront", ""),
                "validations": node.get("validations", []),
            },
        )

    # --- Metaobject entries ------------------------------------------------

    def _ensure_metaobject_entry(self, type_: str, handle: str, fields: dict[str, str]) -> None:
        existing = self.client.fetch_metaobject_by_handle(type_, handle)
        if existing:
            self._entry_gids.setdefault(type_, {})[handle] = existing["id"]
            self._sync_entry_to_db(type_, existing)
            self.report.add(f"metaobject entry '{type_}/{handle}'", "reused", existing["id"])
            return

        if self.dry_run:
            self.report.add(f"metaobject entry '{type_}/{handle}'", "would create")
            return

        created = self.client.create_metaobject(type_, handle, fields)
        self._entry_gids.setdefault(type_, {})[handle] = created["id"]
        self._sync_entry_to_db(type_, created)
        self.report.add(f"metaobject entry '{type_}/{handle}'", "created", created["id"])

    def _sync_entry_to_db(self, type_: str, node: dict) -> None:
        definition = MetaobjectDefinition.objects.filter(store=self.store, type=type_).first()
        if not definition:
            # Dry-run-adjacent edge case: an entry already exists on Shopify
            # for a definition this run hasn't (yet) mirrored locally. Skip
            # the local write rather than crash; the definition step, once
            # it runs for real, will backfill it.
            return
        fields_map = {f["key"]: f["value"] for f in node.get("fields", [])}
        MetaobjectEntry.objects.update_or_create(
            definition=definition,
            handle=node["handle"],
            defaults={"shopify_gid": node["id"], "fields": fields_map},
        )

    # --- Attaching modules to real products --------------------------------

    def _attach_modules_to_products(self) -> None:
        products = self.client.fetch_product_sample(first=MIN_PRODUCTS_TO_ATTACH)

        if self.dry_run:
            for product in products[:MIN_PRODUCTS_TO_ATTACH]:
                self.report.add(
                    f"attach 3 pdp modules to product '{product.get('title')}'",
                    "would create",
                )
            return

        module_gids = [
            self._entry_gids.get(PDP_MODULE_TYPE, {}).get(seed["handle"]) for seed in SEED_PDP_MODULES
        ]
        if not all(module_gids):
            raise RuntimeError(
                "Cannot attach demo pdp modules to products: not every "
                f"'{PDP_MODULE_TYPE}' seed entry has a GID (they should have been "
                "created or fetched just before this step)."
            )
        # Compact separators to match the canonical form Shopify stores
        # and echoes back on read (see set_product_metafield_list_reference).
        desired_value = json.dumps(module_gids, separators=(",", ":"))

        if len(products) < MIN_PRODUCTS_TO_ATTACH:
            logger.warning(
                "fewer than %d products available to attach demo modules to",
                MIN_PRODUCTS_TO_ATTACH,
                extra={"extra_fields": {"store": self.store.slug, "product_count": len(products)}},
            )

        for product in products[:MIN_PRODUCTS_TO_ATTACH]:
            label = f"attach 3 pdp modules to product '{product.get('title')}'"
            existing = self.client.fetch_product_metafield(
                product["id"], PRODUCT_METAFIELD_NAMESPACE, PRODUCT_METAFIELD_KEY
            )
            if existing and existing.get("value") == desired_value:
                self.report.add(label, "reused", existing.get("id"))
                continue

            metafield = self.client.set_product_metafield_list_reference(
                product["id"], PRODUCT_METAFIELD_NAMESPACE, PRODUCT_METAFIELD_KEY, module_gids
            )
            self.report.add(label, "created", metafield.get("id"))
