"""
Merchant API tests: auth (missing/wrong/absent-env token), the
full-replacement semantics of PUT .../products/{handle}/modules, and the
404/422 paths the endpoint contract calls out explicitly.

FakeMerchantShopifyClient is an in-memory stand-in for
ShopifyGraphQLClient covering exactly the methods catalog/merchant.py
calls (metaobjects-by-type, products-with-metafield, single product/
metaobject lookups, the two writes). No network. `catalog.merchant_api.
build_client` is monkeypatched to hand back this fake instead of a real
client, so these tests never touch credentials_for_store either.
"""

from __future__ import annotations

import json

import pytest
from django.test import Client

from catalog.demo_content import BRAND_THEME_TYPE, PDP_MODULE_TYPE, PRODUCT_METAFIELD_KEY, PRODUCT_METAFIELD_NAMESPACE
from catalog.models import Store

pytestmark = pytest.mark.django_db


class FakeMerchantShopifyClient:
    def __init__(self, modules=None, products=None, themes=None):
        # {(type, handle): node}
        self.metaobjects: dict[tuple[str, str], dict] = dict(modules or {})
        self.themes: dict[tuple[str, str], dict] = dict(themes or {})
        # {handle: node}
        self.products: dict[str, dict] = dict(products or {})
        self._next_id = 1000

    def _gid(self, kind: str) -> str:
        gid = f"gid://shopify/{kind}/{self._next_id}"
        self._next_id += 1
        return gid

    # --- metaobjects --------------------------------------------------

    def iter_metaobjects_by_type(self, type_):
        source = self.themes if type_ == BRAND_THEME_TYPE else self.metaobjects
        nodes = [n for (t, _h), n in source.items() if t == type_]
        yield nodes, 1, None

    def fetch_metaobject_by_handle(self, type_, handle):
        if type_ == BRAND_THEME_TYPE:
            return self.themes.get((type_, handle))
        return self.metaobjects.get((type_, handle))

    def update_metaobject(self, gid, fields):
        for key, node in list(self.metaobjects.items()):
            if node["id"] == gid:
                existing_fields = {f["key"]: f["value"] for f in node["fields"]}
                existing_fields.update(fields)
                updated = {**node, "fields": [{"key": k, "value": v} for k, v in existing_fields.items()]}
                self.metaobjects[key] = updated
                return updated
        raise AssertionError(f"no metaobject with gid {gid}")

    # --- products -------------------------------------------------------

    def iter_products_with_metafield(self, namespace, key):
        yield list(self.products.values()), 1, None

    def fetch_product_by_handle(self, handle, namespace, key):
        return self.products.get(handle)

    def set_product_metafield_list_reference(self, product_gid, namespace, key, referenced_gids):
        value = json.dumps(referenced_gids, separators=(",", ":"))
        for handle, node in self.products.items():
            if node["id"] == product_gid:
                node["metafield"] = {"value": value}
                return {"id": self._gid("Metafield"), "value": value}
        raise AssertionError(f"no product with gid {product_gid}")

    def delete_product_metafield(self, product_gid, namespace, key):
        for node in self.products.values():
            if node["id"] == product_gid:
                node["metafield"] = None
                return None
        raise AssertionError(f"no product with gid {product_gid}")


def _module_node(handle, module_type, heading, body, display_order, icon, gid=None):
    return {
        "id": gid or f"gid://shopify/Metaobject/{handle}",
        "handle": handle,
        "type": PDP_MODULE_TYPE,
        "fields": [
            {"key": "module_type", "value": module_type},
            {"key": "heading", "value": heading},
            {"key": "body", "value": body},
            {"key": "display_order", "value": str(display_order)},
            {"key": "icon", "value": icon},
        ],
    }


def _theme_node(handle):
    return {
        "id": f"gid://shopify/Metaobject/{handle}",
        "handle": handle,
        "type": BRAND_THEME_TYPE,
        "fields": [
            {"key": "primary_color", "value": "#1F2A24"},
            {"key": "surface_color", "value": "#F6F3EC"},
            {"key": "text_color", "value": "#1A1A1A"},
            {"key": "heading_font", "value": "Cormorant"},
            {"key": "body_font", "value": "Montserrat"},
            {"key": "radius", "value": "8"},
        ],
    }


def _product_node(handle, title, module_gids=None):
    metafield = None
    if module_gids is not None:
        metafield = {"value": json.dumps(module_gids, separators=(",", ":"))}
    return {
        "id": f"gid://shopify/Product/{handle}",
        "handle": handle,
        "title": title,
        "featuredImage": {"url": f"https://cdn.example.com/{handle}.jpg"},
        "metafield": metafield,
    }


@pytest.fixture
def store(db):
    return Store.objects.create(slug="nomada", name="Nomada", domain="nomada-supply-co.myshopify.com")


@pytest.fixture
def care_module():
    return _module_node("demo-pdp-module-care", "care", "Care Instructions", "Wash cold.", 1, "droplet")


@pytest.fixture
def size_module():
    return _module_node("demo-pdp-module-size-guide", "size_guide", "Size Guide", "True to size.", 2, "ruler")


@pytest.fixture
def fake_client(care_module, size_module, store):
    client = FakeMerchantShopifyClient(
        modules={
            (PDP_MODULE_TYPE, care_module["handle"]): care_module,
            (PDP_MODULE_TYPE, size_module["handle"]): size_module,
        },
        products={
            "hoodie": _product_node("hoodie", "Hoodie", module_gids=[care_module["id"]]),
            "tee": _product_node("tee", "Tee", module_gids=[care_module["id"], size_module["id"]]),
            "cap": _product_node("cap", "Cap", module_gids=[]),
        },
        themes={(BRAND_THEME_TYPE, "demo-brand-theme-nomada"): _theme_node("demo-brand-theme-nomada")},
    )
    return client


@pytest.fixture(autouse=True)
def patch_client(monkeypatch, fake_client):
    monkeypatch.setattr("catalog.merchant_api.build_client", lambda store: fake_client)


# --- Auth -------------------------------------------------------------


def test_missing_env_token_rejects_every_request(settings, store):
    settings.MERCHANT_API_TOKEN = ""
    client = Client()
    response = client.get(f"/api/merchant/{store.slug}/overview", HTTP_X_MERCHANT_TOKEN="anything")
    assert response.status_code == 401


def test_wrong_token_rejects(settings, store):
    settings.MERCHANT_API_TOKEN = "configured-secret"
    client = Client()
    response = client.get(f"/api/merchant/{store.slug}/overview", HTTP_X_MERCHANT_TOKEN="wrong-secret")
    assert response.status_code == 401


def test_absent_header_rejects(settings, store):
    settings.MERCHANT_API_TOKEN = "configured-secret"
    client = Client()
    response = client.get(f"/api/merchant/{store.slug}/overview")
    assert response.status_code == 401


def test_correct_token_is_accepted(settings, store):
    settings.MERCHANT_API_TOKEN = "configured-secret"
    client = Client()
    response = client.get(f"/api/merchant/{store.slug}/overview", HTTP_X_MERCHANT_TOKEN="configured-secret")
    assert response.status_code == 200


# --- Overview -----------------------------------------------------------


def test_overview_shape_and_counts(settings, store):
    settings.MERCHANT_API_TOKEN = "secret"
    client = Client()
    response = client.get(f"/api/merchant/{store.slug}/overview", HTTP_X_MERCHANT_TOKEN="secret")
    assert response.status_code == 200
    body = response.json()
    assert body["store"] == {"slug": "nomada", "name": "Nomada", "domain": "nomada-supply-co.myshopify.com"}
    assert body["theme"]["primary_color"] == "#1F2A24"
    assert body["theme"]["radius"] == 8
    assert body["product_count"] == 3
    assert body["products_with_modules"] == 2
    assert body["module_count"] == 2


def test_overview_unknown_store_is_404(settings):
    settings.MERCHANT_API_TOKEN = "secret"
    client = Client()
    response = client.get("/api/merchant/doesnotexist/overview", HTTP_X_MERCHANT_TOKEN="secret")
    assert response.status_code == 404


# --- Modules --------------------------------------------------------------


def test_list_modules_reports_usage_counts(settings, store, care_module, size_module):
    settings.MERCHANT_API_TOKEN = "secret"
    client = Client()
    response = client.get(f"/api/merchant/{store.slug}/modules", HTTP_X_MERCHANT_TOKEN="secret")
    assert response.status_code == 200
    by_handle = {m["handle"]: m for m in response.json()}
    assert by_handle[care_module["handle"]]["used_on_product_count"] == 2
    assert by_handle[size_module["handle"]]["used_on_product_count"] == 1
    assert by_handle[care_module["handle"]]["heading"] == "Care Instructions"


def test_patch_module_updates_heading(settings, store, care_module):
    settings.MERCHANT_API_TOKEN = "secret"
    client = Client()
    response = client.patch(
        f"/api/merchant/{store.slug}/modules/{care_module['handle']}",
        data=json.dumps({"heading": "New Care Heading"}),
        content_type="application/json",
        HTTP_X_MERCHANT_TOKEN="secret",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["heading"] == "New Care Heading"
    assert body["body"] == "Wash cold."  # untouched field preserved


def test_patch_module_unknown_handle_is_404(settings, store):
    settings.MERCHANT_API_TOKEN = "secret"
    client = Client()
    response = client.patch(
        f"/api/merchant/{store.slug}/modules/does-not-exist",
        data=json.dumps({"heading": "x"}),
        content_type="application/json",
        HTTP_X_MERCHANT_TOKEN="secret",
    )
    assert response.status_code == 404


def test_patch_module_bad_display_order_type_is_422(settings, store, care_module):
    settings.MERCHANT_API_TOKEN = "secret"
    client = Client()
    response = client.patch(
        f"/api/merchant/{store.slug}/modules/{care_module['handle']}",
        data=json.dumps({"display_order": "not-a-number"}),
        content_type="application/json",
        HTTP_X_MERCHANT_TOKEN="secret",
    )
    assert response.status_code == 422


# --- Products -------------------------------------------------------------


def test_products_default_returns_all(settings, store):
    settings.MERCHANT_API_TOKEN = "secret"
    client = Client()
    response = client.get(f"/api/merchant/{store.slug}/products", HTTP_X_MERCHANT_TOKEN="secret")
    assert response.status_code == 200
    assert {p["handle"] for p in response.json()} == {"hoodie", "tee", "cap"}


def test_products_has_modules_true_filters_to_attached_only(settings, store):
    settings.MERCHANT_API_TOKEN = "secret"
    client = Client()
    response = client.get(
        f"/api/merchant/{store.slug}/products", {"has_modules": "true"}, HTTP_X_MERCHANT_TOKEN="secret"
    )
    assert {p["handle"] for p in response.json()} == {"hoodie", "tee"}


def test_products_has_modules_false_filters_to_unattached_only(settings, store):
    settings.MERCHANT_API_TOKEN = "secret"
    client = Client()
    response = client.get(
        f"/api/merchant/{store.slug}/products", {"has_modules": "false"}, HTTP_X_MERCHANT_TOKEN="secret"
    )
    assert {p["handle"] for p in response.json()} == {"cap"}


def test_products_invalid_has_modules_is_422(settings, store):
    settings.MERCHANT_API_TOKEN = "secret"
    client = Client()
    response = client.get(
        f"/api/merchant/{store.slug}/products", {"has_modules": "maybe"}, HTTP_X_MERCHANT_TOKEN="secret"
    )
    assert response.status_code == 422


# --- Attach / detach modules on a product ----------------------------------


def test_put_full_replacement_then_empty_list_detaches(settings, store, care_module, size_module, fake_client):
    settings.MERCHANT_API_TOKEN = "secret"
    client = Client()

    attach = client.put(
        f"/api/merchant/{store.slug}/products/cap/modules",
        data=json.dumps({"handles": [care_module["handle"], size_module["handle"]]}),
        content_type="application/json",
        HTTP_X_MERCHANT_TOKEN="secret",
    )
    assert attach.status_code == 200
    assert attach.json() == {"handle": "cap", "module_handles": [care_module["handle"], size_module["handle"]]}
    assert json.loads(fake_client.products["cap"]["metafield"]["value"]) == [care_module["id"], size_module["id"]]

    detach = client.put(
        f"/api/merchant/{store.slug}/products/cap/modules",
        data=json.dumps({"handles": []}),
        content_type="application/json",
        HTTP_X_MERCHANT_TOKEN="secret",
    )
    assert detach.status_code == 200
    assert detach.json() == {"handle": "cap", "module_handles": []}
    assert fake_client.products["cap"]["metafield"] is None


def test_put_unknown_module_handle_is_404(settings, store):
    settings.MERCHANT_API_TOKEN = "secret"
    client = Client()
    response = client.put(
        f"/api/merchant/{store.slug}/products/cap/modules",
        data=json.dumps({"handles": ["does-not-exist"]}),
        content_type="application/json",
        HTTP_X_MERCHANT_TOKEN="secret",
    )
    assert response.status_code == 404


def test_put_unknown_product_handle_is_404(settings, store, care_module):
    settings.MERCHANT_API_TOKEN = "secret"
    client = Client()
    response = client.put(
        f"/api/merchant/{store.slug}/products/does-not-exist/modules",
        data=json.dumps({"handles": [care_module["handle"]]}),
        content_type="application/json",
        HTTP_X_MERCHANT_TOKEN="secret",
    )
    assert response.status_code == 404
