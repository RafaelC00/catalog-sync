"""
Covers DemoContentProvisioner's idempotency: running `provision()`
twice against the same (faked) Shopify state must create nothing new
the second time, must not duplicate local DB rows, and --dry-run must
not write anywhere, not even the local DB mirror. Also covers that a
mutation's userErrors propagates out of provision() instead of being
swallowed as if the step had succeeded.

FakeShopifyClient is an in-memory model of just enough of Shopify's
metaobject/metafield behaviour (definitions keyed by type, entries
keyed by (type, handle), one product metafield value per product) to
exercise DemoContentProvisioner's own logic in isolation from the real
HTTP client, which is covered separately in test_shopify_client.py. No
network in either file.
"""

import pytest

from catalog.demo_content import (
    BRAND_THEME_TYPE,
    PDP_MODULE_TYPE,
    PRODUCT_METAFIELD_KEY,
    PRODUCT_METAFIELD_NAMESPACE,
    SEED_PDP_MODULES,
    DemoContentProvisioner,
)
from catalog.models import MetaobjectDefinition, MetaobjectEntry, ProductMetafieldDefinition, Store
from catalog.shopify_client import ShopifyUserErrorsError

pytestmark = pytest.mark.django_db


class FakeShopifyClient:
    """
    In-memory stand-in for ShopifyGraphQLClient covering exactly the
    methods DemoContentProvisioner calls. `raise_user_errors_on` names
    a method that should raise ShopifyUserErrorsError the next time
    it's called with a create, to test that the provisioner doesn't
    swallow it.
    """

    def __init__(self, products=None, raise_user_errors_on: str | None = None):
        self.definitions: dict[str, dict] = {}
        self.entries: dict[tuple[str, str], dict] = {}
        self.metafield_definitions: dict[tuple[str, str, str], dict] = {}
        self.product_metafields: dict[str, str] = {}
        self.products = products or [
            {"id": "gid://shopify/Product/1", "title": "Product One", "handle": "product-one"},
            {"id": "gid://shopify/Product/2", "title": "Product Two", "handle": "product-two"},
            {"id": "gid://shopify/Product/3", "title": "Product Three", "handle": "product-three"},
        ]
        self.raise_user_errors_on = raise_user_errors_on
        self.create_calls = {
            "metaobject_definition": 0,
            "metaobject": 0,
            "metafield_definition": 0,
            "set_metafields": 0,
        }
        self._next_id = 1

    def _gid(self, kind: str) -> str:
        gid = f"gid://shopify/{kind}/{self._next_id}"
        self._next_id += 1
        return gid

    def _maybe_raise(self, name: str):
        if self.raise_user_errors_on == name:
            raise ShopifyUserErrorsError(name, [{"field": ["type"], "message": "boom", "code": "TAKEN"}])

    # --- Metaobject definitions ------------------------------------------

    def fetch_metaobject_definition_by_type(self, type_):
        return self.definitions.get(type_)

    def create_metaobject_definition(self, type_, name, field_definitions, storefront_access="PUBLIC_READ"):
        self._maybe_raise("metaobject_definition")
        self.create_calls["metaobject_definition"] += 1
        node = {
            "id": self._gid("MetaobjectDefinition"),
            "type": type_,
            "name": name,
            "access": {"storefront": storefront_access},
            "fieldDefinitions": field_definitions,
        }
        self.definitions[type_] = node
        return node

    # --- Metaobject entries ------------------------------------------------

    def fetch_metaobject_by_handle(self, type_, handle):
        return self.entries.get((type_, handle))

    def create_metaobject(self, type_, handle, fields):
        self._maybe_raise("metaobject")
        self.create_calls["metaobject"] += 1
        node = {
            "id": self._gid("Metaobject"),
            "handle": handle,
            "type": type_,
            "fields": [{"key": k, "value": v} for k, v in fields.items()],
        }
        self.entries[(type_, handle)] = node
        return node

    # --- Metafield definitions --------------------------------------------

    def fetch_metafield_definition(self, namespace, key, owner_type):
        return self.metafield_definitions.get((namespace, key, owner_type))

    def create_metafield_definition(
        self, namespace, key, name, owner_type, type_, validations=None, storefront_access="PUBLIC_READ"
    ):
        self._maybe_raise("metafield_definition")
        self.create_calls["metafield_definition"] += 1
        node = {
            "id": self._gid("MetafieldDefinition"),
            "name": name,
            "namespace": namespace,
            "key": key,
            "ownerType": owner_type,
            "type": {"name": type_},
            "access": {"storefront": storefront_access},
            "validations": validations or [],
        }
        self.metafield_definitions[(namespace, key, owner_type)] = node
        return node

    # --- Products / metafield values ---------------------------------------

    def fetch_product_sample(self, first=10):
        return self.products[:first]

    def fetch_product_metafield(self, product_gid, namespace, key):
        value = self.product_metafields.get(product_gid)
        if value is None:
            return None
        return {"id": f"gid://shopify/Metafield/{product_gid.rsplit('/', 1)[-1]}", "value": value}

    def set_product_metafield_list_reference(self, product_gid, namespace, key, referenced_gids):
        self._maybe_raise("set_metafields")
        self.create_calls["set_metafields"] += 1
        import json as _json

        value = _json.dumps(referenced_gids, separators=(",", ":"))
        self.product_metafields[product_gid] = value
        return {"id": f"gid://shopify/Metafield/{product_gid.rsplit('/', 1)[-1]}", "value": value}


@pytest.fixture
def store(db):
    return Store.objects.create(slug="nomada", name="Nomada", domain="nomada-supply-co.myshopify.com")


def test_first_run_creates_everything(store):
    client = FakeShopifyClient()
    provisioner = DemoContentProvisioner(store=store, client=client)

    report = provisioner.provision()

    assert all(step.action == "created" for step in report.steps)
    assert client.create_calls == {
        "metaobject_definition": 2,
        "metaobject": 4,  # 3 pdp modules + 1 brand theme
        "metafield_definition": 1,
        "set_metafields": 3,
    }
    assert MetaobjectDefinition.objects.filter(store=store, type=PDP_MODULE_TYPE).exists()
    assert MetaobjectDefinition.objects.filter(store=store, type=BRAND_THEME_TYPE).exists()
    assert MetaobjectEntry.objects.count() == 4
    assert ProductMetafieldDefinition.objects.filter(
        store=store, namespace=PRODUCT_METAFIELD_NAMESPACE, key=PRODUCT_METAFIELD_KEY
    ).exists()
    assert len(client.product_metafields) == 3


def test_second_run_reuses_everything_and_writes_nothing_new(store):
    client = FakeShopifyClient()
    DemoContentProvisioner(store=store, client=client).provision()

    report2 = DemoContentProvisioner(store=store, client=client).provision()

    assert all(step.action == "reused" for step in report2.steps)
    assert client.create_calls == {
        "metaobject_definition": 2,
        "metaobject": 4,
        "metafield_definition": 1,
        "set_metafields": 3,
    }
    assert MetaobjectDefinition.objects.count() == 2
    assert MetaobjectEntry.objects.count() == 4
    assert ProductMetafieldDefinition.objects.count() == 1


def test_dry_run_creates_nothing_on_shopify_or_in_the_local_db(store):
    client = FakeShopifyClient()
    provisioner = DemoContentProvisioner(store=store, client=client, dry_run=True)

    report = provisioner.provision()

    assert all(step.action == "would create" for step in report.steps)
    assert client.create_calls == {
        "metaobject_definition": 0,
        "metaobject": 0,
        "metafield_definition": 0,
        "set_metafields": 0,
    }
    assert MetaobjectDefinition.objects.count() == 0
    assert MetaobjectEntry.objects.count() == 0
    assert ProductMetafieldDefinition.objects.count() == 0


def test_dry_run_after_real_run_reports_reused_state_without_writing_again(store):
    client = FakeShopifyClient()
    DemoContentProvisioner(store=store, client=client).provision()

    dry_report = DemoContentProvisioner(store=store, client=client, dry_run=True).provision()

    # Definitions/entries already exist, so a dry run still reports
    # them as "reused" (it read that from Shopify); only the product
    # attachment step, which dry-run never checks per-product, stays
    # "would create". Either way nothing new gets written.
    actions = {step.action for step in dry_report.steps}
    assert actions <= {"reused", "would create"}
    assert client.create_calls == {
        "metaobject_definition": 2,
        "metaobject": 4,
        "metafield_definition": 1,
        "set_metafields": 3,
    }


def test_user_errors_on_metaobject_definition_create_propagates_and_stops_the_run(store):
    client = FakeShopifyClient(raise_user_errors_on="metaobject_definition")
    provisioner = DemoContentProvisioner(store=store, client=client)

    with pytest.raises(ShopifyUserErrorsError):
        provisioner.provision()

    # Nothing should have been half-committed to the local DB for the
    # step that failed.
    assert MetaobjectDefinition.objects.count() == 0


def test_user_errors_on_setting_product_metafields_propagates(store):
    client = FakeShopifyClient(raise_user_errors_on="set_metafields")
    provisioner = DemoContentProvisioner(store=store, client=client)

    with pytest.raises(ShopifyUserErrorsError):
        provisioner.provision()

    # Definitions and entries (steps before the failing one) did commit.
    assert MetaobjectDefinition.objects.count() == 2
    assert MetaobjectEntry.objects.count() == 4


def test_seed_entries_attach_all_three_modules_to_each_product(store):
    client = FakeShopifyClient()
    DemoContentProvisioner(store=store, client=client).provision()

    module_gids = {client.entries[(PDP_MODULE_TYPE, seed["handle"])]["id"] for seed in SEED_PDP_MODULES}
    for product in client.products:
        import json as _json

        value = client.product_metafields[product["id"]]
        assert set(_json.loads(value)) == module_gids
