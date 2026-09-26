"""
The sync service: pulls products from Shopify and upserts them locally.

Idempotency is by construction, not by luck: every product and variant
is keyed on its Shopify GID (globally unique, stable across syncs), and
before writing anything we hash the fields we care about and compare
against the stored hash. Re-running the sync against an unchanged
catalog writes nothing and reports zero created/updated, only
unchanged, at the database level, not merely at the API-response level.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone

from catalog.models import Product, Store, SyncEvent, SyncRun, Variant
from catalog.shopify_client import (
    MissingCredentialsError,
    ShopifyAPIError,
    ShopifyGraphQLClient,
    ThrottleStatus,
    credentials_for_store,
)

logger = logging.getLogger("catalog.sync")


def _hash_fields(*parts) -> str:
    blob = json.dumps(parts, sort_keys=True, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _variant_hash(variant_node: dict) -> str:
    return _hash_fields(
        variant_node.get("title"),
        variant_node.get("sku"),
        variant_node.get("price"),
        variant_node.get("inventoryQuantity"),
    )


def _product_hash(product_node: dict) -> str:
    variant_hashes = sorted(
        _variant_hash(edge["node"]) for edge in product_node.get("variants", {}).get("edges", [])
    )
    return _hash_fields(
        product_node.get("title"),
        product_node.get("handle"),
        product_node.get("vendor"),
        product_node.get("productType"),
        product_node.get("status"),
        sorted(product_node.get("tags", []) or []),
        variant_hashes,
    )


@dataclass
class SyncCounts:
    products_created: int = 0
    products_updated: int = 0
    products_unchanged: int = 0
    variants_created: int = 0
    variants_updated: int = 0
    variants_unchanged: int = 0


class SyncService:
    """Runs and records one sync of one store."""

    def __init__(self, store: Store, trigger: str = SyncRun.Trigger.MANUAL_CLI, api_version: str = "2025-01"):
        self.store = store
        self.trigger = trigger
        self.api_version = api_version
        self.run: SyncRun | None = None
        self.counts = SyncCounts()

    def _log_event(self, level: str, event_type: str, message: str, data: dict | None = None) -> None:
        SyncEvent.objects.create(
            sync_run=self.run,
            level=level,
            event_type=event_type,
            message=message,
            data=data or {},
        )
        log_fn = {"info": logger.info, "warning": logger.warning, "error": logger.error}.get(
            level, logger.info
        )
        log_fn(message, extra={"extra_fields": {"store": self.store.slug, "event_type": event_type, **(data or {})}})

    def _on_backoff(self, wait_seconds: float, throttle: ThrottleStatus | None) -> None:
        data = {"wait_seconds": round(wait_seconds, 2)}
        if throttle:
            data.update(
                {
                    "currently_available": throttle.currently_available,
                    "maximum_available": throttle.maximum_available,
                    "restore_rate": throttle.restore_rate,
                }
            )
        self._log_event(
            SyncEvent.Level.WARNING,
            SyncEvent.EventType.RATE_LIMIT_BACKOFF,
            f"Backing off {wait_seconds:.1f}s for Shopify rate limit",
            data,
        )
        self.run.rate_limit_backoffs += 1
        self.run.save(update_fields=["rate_limit_backoffs"])

    def run_sync(self) -> SyncRun:
        self.run = SyncRun.objects.create(store=self.store, trigger=self.trigger, status=SyncRun.Status.RUNNING)
        self._log_event(SyncEvent.Level.INFO, SyncEvent.EventType.STARTED, f"Sync started for {self.store.slug}")

        try:
            credentials = credentials_for_store(self.store.slug)
            client = ShopifyGraphQLClient(
                credentials=credentials,
                api_version=self.api_version,
                on_backoff=self._on_backoff,
            )

            for nodes, page_number, result in client.iter_products():
                self._log_event(
                    SyncEvent.Level.INFO,
                    SyncEvent.EventType.PAGE_FETCHED,
                    f"Fetched page {page_number} ({len(nodes)} products)",
                    {
                        "page": page_number,
                        "count": len(nodes),
                        "actual_query_cost": result.actual_query_cost,
                        "currently_available": result.throttle_status.currently_available
                        if result.throttle_status
                        else None,
                    },
                )
                for node in nodes:
                    self._upsert_product(node)

            self.run.products_created = self.counts.products_created
            self.run.products_updated = self.counts.products_updated
            self.run.products_unchanged = self.counts.products_unchanged
            self.run.variants_created = self.counts.variants_created
            self.run.variants_updated = self.counts.variants_updated
            self.run.variants_unchanged = self.counts.variants_unchanged
            self.run.api_requests = client.request_count
            self.run.status = SyncRun.Status.SUCCESS
            self.run.finished_at = timezone.now()
            self.run.save()

            self._log_event(
                SyncEvent.Level.INFO,
                SyncEvent.EventType.FINISHED,
                "Sync finished",
                {
                    "products_created": self.counts.products_created,
                    "products_updated": self.counts.products_updated,
                    "products_unchanged": self.counts.products_unchanged,
                    "api_requests": client.request_count,
                    "rate_limit_backoffs": client.backoff_count,
                },
            )
            return self.run

        except (MissingCredentialsError, ShopifyAPIError) as exc:
            self.run.status = SyncRun.Status.FAILED
            self.run.error_message = str(exc)
            self.run.finished_at = timezone.now()
            self.run.save()
            self._log_event(SyncEvent.Level.ERROR, SyncEvent.EventType.ERROR, str(exc))
            return self.run
        except Exception as exc:  # noqa: BLE001 - record and re-raise for visibility
            self.run.status = SyncRun.Status.FAILED
            self.run.error_message = f"{type(exc).__name__}: {exc}"
            self.run.finished_at = timezone.now()
            self.run.save()
            self._log_event(SyncEvent.Level.ERROR, SyncEvent.EventType.ERROR, self.run.error_message)
            raise

    @transaction.atomic
    def _upsert_product(self, node: dict) -> Product:
        gid = node["id"]
        product_hash = _product_hash(node)

        product = Product.objects.filter(store=self.store, shopify_gid=gid).first()
        created = product is None
        changed = created or product.content_hash != product_hash

        if created:
            product = Product(store=self.store, shopify_gid=gid)

        if changed:
            product.title = node.get("title", "")
            product.handle = node.get("handle", "")
            product.vendor = node.get("vendor", "")
            product.product_type = node.get("productType", "")
            product.status = node.get("status", "")
            product.tags = node.get("tags", []) or []
            product.shopify_updated_at = node.get("updatedAt")
            product.content_hash = product_hash
            product.save()
        else:
            # Touch last_synced_at without rewriting unchanged fields.
            Product.objects.filter(pk=product.pk).update(last_synced_at=timezone.now())

        if created:
            self.counts.products_created += 1
            self._log_event(
                SyncEvent.Level.INFO,
                SyncEvent.EventType.PRODUCT_UPSERTED,
                f"Created product: {product.title}",
                {"shopify_gid": gid, "change": "created"},
            )
        elif changed:
            self.counts.products_updated += 1
            self._log_event(
                SyncEvent.Level.INFO,
                SyncEvent.EventType.PRODUCT_UPSERTED,
                f"Updated product: {product.title}",
                {"shopify_gid": gid, "change": "updated"},
            )
        else:
            self.counts.products_unchanged += 1

        for edge in node.get("variants", {}).get("edges", []):
            self._upsert_variant(product, edge["node"])

        return product

    def _upsert_variant(self, product: Product, node: dict) -> Variant:
        gid = node["id"]
        variant_hash = _variant_hash(node)

        variant = Variant.objects.filter(product=product, shopify_gid=gid).first()
        created = variant is None
        changed = created or variant.content_hash != variant_hash

        if created:
            variant = Variant(product=product, shopify_gid=gid)

        if changed:
            variant.title = node.get("title", "") or ""
            variant.sku = node.get("sku", "") or ""
            price = node.get("price")
            variant.price = price if price not in (None, "") else None
            variant.inventory_quantity = node.get("inventoryQuantity")
            variant.content_hash = variant_hash
            variant.save()
        else:
            Variant.objects.filter(pk=variant.pk).update(last_synced_at=timezone.now())

        if created:
            self.counts.variants_created += 1
        elif changed:
            self.counts.variants_updated += 1
        else:
            self.counts.variants_unchanged += 1

        return variant
