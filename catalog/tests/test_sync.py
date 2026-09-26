"""
Covers the two things a reviewer will check first: that re-running a
sync against an unchanged catalog is a true no-op at the database
level, and that a real field change is correctly counted as an update
(not miscounted as a create, and not silently dropped as unchanged).

The Shopify client is faked out entirely (no network, no real store)
so these tests are fast and deterministic. The real client is
exercised separately, against the actual stores, via
`manage.py sync_store`.
"""

from unittest.mock import MagicMock

import pytest

from catalog.models import Product, Store, Variant
from catalog.shopify_client import GraphQLResult
from catalog.sync import SyncService

pytestmark = pytest.mark.django_db


def make_product_node(gid="gid://shopify/Product/1", title="Test Product", price="10.00"):
    return {
        "id": gid,
        "title": title,
        "handle": "test-product",
        "vendor": "Acme",
        "productType": "Widget",
        "status": "ACTIVE",
        "tags": ["a", "b"],
        "updatedAt": "2026-01-01T00:00:00Z",
        "variants": {
            "edges": [
                {
                    "node": {
                        "id": gid + "-v1",
                        "title": "Default",
                        "sku": "SKU1",
                        "price": price,
                        "inventoryQuantity": 5,
                        "updatedAt": "2026-01-01T00:00:00Z",
                    }
                }
            ]
        },
    }


class FakeShopifyClient:
    """Stands in for ShopifyGraphQLClient: no network, canned pages."""

    request_count = 1
    backoff_count = 0

    def __init__(self, credentials=None, api_version=None, on_backoff=None, **kwargs):
        self.on_backoff = on_backoff

    def iter_products(self):
        for nodes in self.pages:
            yield nodes, 1, GraphQLResult(data={}, throttle_status=None, actual_query_cost=10)


def fake_client_with_pages(*pages):
    cls = type("FakeShopifyClientWithPages", (FakeShopifyClient,), {"pages": pages})
    return cls


@pytest.fixture
def store(db):
    return Store.objects.create(slug="acme", name="Acme", domain="acme.myshopify.com")


def _patch_credentials(monkeypatch):
    monkeypatch.setattr("catalog.sync.credentials_for_store", lambda slug: MagicMock())


def test_idempotent_upsert_second_run_is_noop(store, monkeypatch):
    _patch_credentials(monkeypatch)
    node = make_product_node()

    monkeypatch.setattr("catalog.sync.ShopifyGraphQLClient", fake_client_with_pages([node]))
    run1 = SyncService(store=store).run_sync()

    assert run1.status == "success"
    assert run1.products_created == 1
    assert run1.variants_created == 1
    assert Product.objects.count() == 1
    assert Variant.objects.count() == 1
    product_id_after_run1 = Product.objects.get().id

    # Same data, second run: nothing should be created or updated.
    monkeypatch.setattr("catalog.sync.ShopifyGraphQLClient", fake_client_with_pages([node]))
    run2 = SyncService(store=store).run_sync()

    assert run2.status == "success"
    assert run2.products_created == 0
    assert run2.products_updated == 0
    assert run2.products_unchanged == 1
    assert run2.variants_created == 0
    assert run2.variants_updated == 0
    assert run2.variants_unchanged == 1
    assert Product.objects.count() == 1
    assert Product.objects.get().id == product_id_after_run1


def test_change_detection_counts_reflect_a_real_update(store, monkeypatch):
    _patch_credentials(monkeypatch)

    original = make_product_node(title="Original Title", price="10.00")
    monkeypatch.setattr("catalog.sync.ShopifyGraphQLClient", fake_client_with_pages([original]))
    run1 = SyncService(store=store).run_sync()
    assert run1.products_created == 1
    assert run1.products_updated == 0

    changed = make_product_node(title="Changed Title", price="12.50")
    monkeypatch.setattr("catalog.sync.ShopifyGraphQLClient", fake_client_with_pages([changed]))
    run2 = SyncService(store=store).run_sync()

    assert run2.products_created == 0
    assert run2.products_updated == 1
    assert run2.products_unchanged == 0
    assert run2.variants_updated == 1

    product = Product.objects.get()
    assert product.title == "Changed Title"
    assert Variant.objects.get().price == pytest.approx(12.50)


def test_new_product_added_between_runs_is_counted_as_created_not_update(store, monkeypatch):
    _patch_credentials(monkeypatch)

    first = make_product_node(gid="gid://shopify/Product/1", title="First")
    monkeypatch.setattr("catalog.sync.ShopifyGraphQLClient", fake_client_with_pages([first]))
    SyncService(store=store).run_sync()

    second = make_product_node(gid="gid://shopify/Product/2", title="Second")
    monkeypatch.setattr(
        "catalog.sync.ShopifyGraphQLClient", fake_client_with_pages([first, second])
    )
    run2 = SyncService(store=store).run_sync()

    assert run2.products_created == 1
    assert run2.products_unchanged == 1
    assert Product.objects.count() == 2


def test_failed_sync_records_error_and_does_not_write_partial_success_status(store, monkeypatch):
    def raise_missing_credentials(slug):
        from catalog.shopify_client import MissingCredentialsError

        raise MissingCredentialsError(f"no credentials for {slug}")

    monkeypatch.setattr("catalog.sync.credentials_for_store", raise_missing_credentials)

    run = SyncService(store=store).run_sync()

    assert run.status == "failed"
    assert "credentials" in run.error_message.lower()
    assert run.finished_at is not None
