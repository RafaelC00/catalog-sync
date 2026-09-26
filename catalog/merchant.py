"""
Service layer for the merchant / marketing-manager persona.

The React Native mobile app reads this store's data as a *shopper*, straight
from the Storefront API, with no Admin credentials anywhere in the client.
This module exists because a second persona (the brand's merchandiser, who
edits PDP module copy and decides which modules appear on which product,
with no developer involved) needs Admin-level writes: `metaobjectUpdate` and
`metafieldsSet` are Admin API only, there is no Storefront API mutation for
either. Giving the mobile app an Admin token to make those writes directly
would defeat the entire point of splitting Storefront (shopper) from Admin
(merchant) access, so every merchant write goes through this backend
instead, and the app only ever calls `catalog/merchant_api.py`'s HTTP
endpoints.

Reads here always go to Shopify, not the local `Product`/`MetaobjectEntry`
mirror: those tables are populated by `SyncService`/`DemoContentProvisioner`
on their own schedules and can lag what a merchant just changed from another
client (the Shopify admin UI, this API, a second device). A merchant panel
showing stale copy right after saving a change would be worse than one that
costs an extra API round trip. Writes still update the local
`MetaobjectEntry` mirror afterward (via `sync_metaobject_entry_to_db`,
shared with `DemoContentProvisioner`) so the mirror doesn't drift further
than it already can from out-of-band changes.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

from django.conf import settings

from catalog.demo_content import (
    BRAND_THEME_TYPE,
    PDP_MODULE_TYPE,
    PRODUCT_METAFIELD_KEY,
    PRODUCT_METAFIELD_NAMESPACE,
    sync_metaobject_entry_to_db,
)
from catalog.models import Store
from catalog.shopify_client import ShopifyGraphQLClient, credentials_for_store

logger = logging.getLogger("catalog.merchant")


class MerchantNotFoundError(Exception):
    """
    Raised for an unknown module handle or product handle. The API layer
    (catalog/merchant_api.py) maps this to HTTP 404, per the endpoint
    contract: an unresolvable handle is a 404 whether it came from a URL
    path segment or from the `handles` list in a PUT body.
    """


@dataclass
class ModuleInfo:
    handle: str
    gid: str
    module_type: str
    heading: str
    body: str
    display_order: int | None
    icon: str
    used_on_product_count: int = 0


@dataclass
class ProductInfo:
    handle: str
    gid: str
    title: str
    featured_image_url: str | None
    module_handles: list[str] = field(default_factory=list)


def build_client(store: Store) -> ShopifyGraphQLClient:
    """
    One `ShopifyGraphQLClient` per request, same as every management
    command does: credentials are resolved from env vars fresh each time
    (see `credentials_for_store`), never cached on the `Store` row.
    """
    credentials = credentials_for_store(store.slug)
    return ShopifyGraphQLClient(credentials=credentials, api_version=settings.SHOPIFY_API_VERSION)


def _fields_dict(node: dict) -> dict[str, str]:
    return {f["key"]: f["value"] for f in node.get("fields", [])}


def _parse_display_order(raw: str | None) -> int | None:
    if raw in (None, ""):
        return None
    return int(raw)


def _module_info_from_node(node: dict, used_on_product_count: int = 0) -> ModuleInfo:
    fields = _fields_dict(node)
    return ModuleInfo(
        handle=node["handle"],
        gid=node["id"],
        module_type=fields.get("module_type", ""),
        heading=fields.get("heading", ""),
        body=fields.get("body", ""),
        display_order=_parse_display_order(fields.get("display_order")),
        icon=fields.get("icon", ""),
        used_on_product_count=used_on_product_count,
    )


def fetch_all_modules(client: ShopifyGraphQLClient) -> list[dict]:
    """Every `demo_pdp_module` metaobject entry, across pages, as raw nodes."""
    nodes: list[dict] = []
    for page_nodes, _page_number, _result in client.iter_metaobjects_by_type(PDP_MODULE_TYPE):
        nodes.extend(page_nodes)
    return nodes


def fetch_all_products_with_modules(client: ShopifyGraphQLClient) -> list[dict]:
    """Every product, across pages, with its `custom.pdp_modules` metafield value attached."""
    nodes: list[dict] = []
    for page_nodes, _page_number, _result in client.iter_products_with_metafield(
        PRODUCT_METAFIELD_NAMESPACE, PRODUCT_METAFIELD_KEY
    ):
        nodes.extend(page_nodes)
    return nodes


def _module_gids_for_product_node(node: dict) -> list[str]:
    """
    `custom.pdp_modules` is stored as a JSON-encoded array of metaobject
    GIDs (see `ShopifyGraphQLClient.set_product_metafield_list_reference`).
    A product with nothing attached has either no metafield at all or an
    empty array; both mean "no modules".
    """
    metafield = node.get("metafield")
    if not metafield or not metafield.get("value"):
        return []
    return json.loads(metafield["value"])


def _usage_counts(product_nodes: list[dict]) -> dict[str, int]:
    """module GID -> how many of `product_nodes` reference it."""
    usage: dict[str, int] = {}
    for node in product_nodes:
        for gid in _module_gids_for_product_node(node):
            usage[gid] = usage.get(gid, 0) + 1
    return usage


def _fetch_theme_node(client: ShopifyGraphQLClient) -> dict | None:
    """
    Each store's Admin API is already scoped to that store (a separate
    domain/token pair, see `credentials_for_store`), so its
    `demo_brand_theme` metaobjects can only ever be its own, and by
    design there is exactly one. Taking "whichever entry this store
    actually has" instead of looking one up by a specific expected
    handle (`brand_theme_for(store.slug)["handle"]`) is deliberate: it
    stays correct even if a store's theme entry was provisioned under
    a different handle than what `catalog/demo_content.py` currently
    seeds (it doesn't have to be `demo-brand-theme-<slug>` on Shopify to
    be that store's theme), whereas a handle-specific lookup would
    silently return an empty theme the moment the two drift.
    """
    for page_nodes, _page_number, _result in client.iter_metaobjects_by_type(BRAND_THEME_TYPE):
        if page_nodes:
            return page_nodes[0]
    return None


def get_overview(store: Store, client: ShopifyGraphQLClient) -> dict:
    module_nodes = fetch_all_modules(client)
    product_nodes = fetch_all_products_with_modules(client)
    products_with_modules = sum(1 for p in product_nodes if _module_gids_for_product_node(p))

    theme_node = _fetch_theme_node(client)
    theme_fields = _fields_dict(theme_node) if theme_node else {}

    return {
        "store": {"slug": store.slug, "name": store.name, "domain": store.domain},
        "theme": {
            "primary_color": theme_fields.get("primary_color", ""),
            "surface_color": theme_fields.get("surface_color", ""),
            "text_color": theme_fields.get("text_color", ""),
            "heading_font": theme_fields.get("heading_font", ""),
            "body_font": theme_fields.get("body_font", ""),
            "radius": _parse_display_order(theme_fields.get("radius")) or 0,
        },
        "product_count": len(product_nodes),
        "products_with_modules": products_with_modules,
        "module_count": len(module_nodes),
    }


def list_modules(client: ShopifyGraphQLClient) -> list[ModuleInfo]:
    module_nodes = fetch_all_modules(client)
    usage = _usage_counts(fetch_all_products_with_modules(client))
    infos = [_module_info_from_node(node, usage.get(node["id"], 0)) for node in module_nodes]
    infos.sort(key=lambda m: (m.display_order if m.display_order is not None else 0, m.handle))
    return infos


def patch_module(store: Store, client: ShopifyGraphQLClient, handle: str, updates: dict) -> ModuleInfo:
    """
    `updates` only contains keys the caller actually set (the API layer
    passes `payload.dict(exclude_unset=True)`), so a PATCH that sends just
    `{"heading": "..."}` never touches `body`/`display_order` on Shopify,
    matching `metaobjectUpdate`'s own patch semantics for `fields`.
    """
    existing = client.fetch_metaobject_by_handle(PDP_MODULE_TYPE, handle)
    if not existing:
        raise MerchantNotFoundError(f"No module with handle '{handle}'")

    new_fields: dict[str, str] = {}
    if "heading" in updates and updates["heading"] is not None:
        new_fields["heading"] = updates["heading"]
    if "body" in updates and updates["body"] is not None:
        new_fields["body"] = updates["body"]
    if "display_order" in updates and updates["display_order"] is not None:
        new_fields["display_order"] = str(updates["display_order"])

    updated_node = client.update_metaobject(existing["id"], new_fields) if new_fields else existing
    sync_metaobject_entry_to_db(store, PDP_MODULE_TYPE, updated_node)

    usage = _usage_counts(fetch_all_products_with_modules(client))
    return _module_info_from_node(updated_node, usage.get(updated_node["id"], 0))


def list_products(client: ShopifyGraphQLClient, has_modules: str = "all") -> list[ProductInfo]:
    module_nodes = fetch_all_modules(client)
    handle_by_gid = {node["id"]: node["handle"] for node in module_nodes}

    infos = []
    for node in fetch_all_products_with_modules(client):
        gids = _module_gids_for_product_node(node)
        handles = [handle_by_gid.get(gid, gid) for gid in gids]
        if has_modules == "true" and not handles:
            continue
        if has_modules == "false" and handles:
            continue
        infos.append(
            ProductInfo(
                handle=node["handle"],
                gid=node["id"],
                title=node.get("title", ""),
                featured_image_url=(node.get("featuredImage") or {}).get("url"),
                module_handles=handles,
            )
        )
    return infos


def set_product_modules(
    store: Store, client: ShopifyGraphQLClient, product_handle: str, handles: list[str]
) -> ProductInfo:
    """
    Full replacement, per the endpoint contract: `handles` entirely
    replaces whatever `custom.pdp_modules` currently holds, never merges
    with it. An empty list detaches everything, via `delete_product_metafield`
    rather than setting the value to `"[]"`: deleting is the unambiguous
    "nothing attached" state (no metafield row at all), whereas a stored
    empty array would be indistinguishable from "attached to nothing" only
    by inspecting the value, and would still show up in the Admin UI as a
    metafield with a value.
    """
    product_node = client.fetch_product_by_handle(
        product_handle, PRODUCT_METAFIELD_NAMESPACE, PRODUCT_METAFIELD_KEY
    )
    if not product_node:
        raise MerchantNotFoundError(f"No product with handle '{product_handle}'")

    module_nodes = fetch_all_modules(client)
    gid_by_handle = {node["handle"]: node["id"] for node in module_nodes}
    unknown = [h for h in handles if h not in gid_by_handle]
    if unknown:
        raise MerchantNotFoundError(f"Unknown module handle(s): {', '.join(unknown)}")

    if handles:
        resolved_gids = [gid_by_handle[h] for h in handles]
        client.set_product_metafield_list_reference(
            product_node["id"], PRODUCT_METAFIELD_NAMESPACE, PRODUCT_METAFIELD_KEY, resolved_gids
        )
    else:
        client.delete_product_metafield(product_node["id"], PRODUCT_METAFIELD_NAMESPACE, PRODUCT_METAFIELD_KEY)

    return ProductInfo(
        handle=product_node["handle"],
        gid=product_node["id"],
        title=product_node.get("title", ""),
        featured_image_url=(product_node.get("featuredImage") or {}).get("url"),
        module_handles=handles,
    )
