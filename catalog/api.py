"""
Django Ninja API.

Why Ninja over DRF: this is a small, mostly-typed API sitting in front
of a React frontend. Ninja gives Pydantic request/response models, free
validation, and auto-generated OpenAPI (/api/docs) with far less
boilerplate than DRF's serializer/viewset/router stack, at the cost of
a smaller ecosystem, which is a fine trade for a service this size.
Django itself is still doing the heavy lifting: ORM, migrations, admin,
management commands.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404
from ninja import NinjaAPI
from ninja.errors import HttpError

from catalog.health import health_status_code, run_health_checks
from catalog.merchant_api import router as merchant_router
from catalog.models import Product, Store, SyncRun
from catalog.schemas import (
    HealthOut,
    ProductDetailOut,
    ProductOut,
    StoreOut,
    SyncRunDetailOut,
    SyncRunOut,
    TriggerSyncIn,
    VariantOut,
)
from catalog.sync import SyncService
from catalog.webhooks import verify_shopify_hmac

logger = logging.getLogger("catalog.api")

api = NinjaAPI(title="Catalog Sync API", version="1.0.0", urls_namespace="catalog_api")

# The merchant/marketing-manager endpoints live in their own router
# (catalog/merchant_api.py) because they carry their own auth
# (X-Merchant-Token, see MerchantTokenAuth) instead of being open like
# everything else under /api/. Mounting it here keeps one NinjaAPI
# instance and one OpenAPI schema at /api/docs for the whole service.
api.add_router("/merchant", merchant_router)


@api.get("/healthz", response=HealthOut, tags=["ops"])
def healthz(request: HttpRequest):
    """
    Actual dependency health, not a hardcoded 200. See catalog/health.py.
    HTTP status reflects the result: 200 for ok, 503 for degraded/down,
    because a health check a load balancer trusts has to say so on the
    status line, not just in the body.
    """
    result = run_health_checks()
    status_code = health_status_code(result)
    return api.create_response(request, result, status=status_code)


@api.get("/stores", response=list[StoreOut], tags=["catalog"])
def list_stores(request: HttpRequest):
    stores = Store.objects.all()
    return [
        StoreOut(
            id=s.id,
            slug=s.slug,
            name=s.name,
            domain=s.domain,
            is_active=s.is_active,
            product_count=s.products.count(),
        )
        for s in stores
    ]


def _product_out(p: Product) -> ProductOut:
    return ProductOut(
        id=p.id,
        store_slug=p.store.slug,
        title=p.title,
        handle=p.handle,
        vendor=p.vendor,
        product_type=p.product_type,
        status=p.status,
        tags=p.tags or [],
        variant_count=p.variants.count(),
        last_synced_at=p.last_synced_at,
    )


@api.get("/products", response=list[ProductOut], tags=["catalog"])
def list_products(request: HttpRequest, store: str | None = None, search: str | None = None):
    qs = Product.objects.select_related("store").all()
    if store:
        qs = qs.filter(store__slug=store)
    if search:
        qs = qs.filter(title__icontains=search)
    return [_product_out(p) for p in qs[:500]]


@api.get("/products/{product_id}", response=ProductDetailOut, tags=["catalog"])
def get_product(request: HttpRequest, product_id: int):
    p = get_object_or_404(Product.objects.select_related("store"), pk=product_id)
    base = _product_out(p)
    variants = [
        VariantOut(
            id=v.id,
            title=v.title,
            sku=v.sku,
            price=v.price,
            inventory_quantity=v.inventory_quantity,
            last_synced_at=v.last_synced_at,
        )
        for v in p.variants.all()
    ]
    return ProductDetailOut(**base.dict(), variants=variants)


def _run_out(run: SyncRun) -> SyncRunOut:
    return SyncRunOut(
        id=run.id,
        store_slug=run.store.slug,
        trigger=run.trigger,
        status=run.status,
        started_at=run.started_at,
        finished_at=run.finished_at,
        duration_seconds=run.duration_seconds,
        products_created=run.products_created,
        products_updated=run.products_updated,
        products_unchanged=run.products_unchanged,
        variants_created=run.variants_created,
        variants_updated=run.variants_updated,
        variants_unchanged=run.variants_unchanged,
        rate_limit_backoffs=run.rate_limit_backoffs,
        api_requests=run.api_requests,
        error_message=run.error_message,
    )


@api.get("/sync-runs", response=list[SyncRunOut], tags=["sync"])
def list_sync_runs(request: HttpRequest, store: str | None = None):
    qs = SyncRun.objects.select_related("store").all()
    if store:
        qs = qs.filter(store__slug=store)
    return [_run_out(r) for r in qs[:100]]


@api.get("/sync-runs/{run_id}", response=SyncRunDetailOut, tags=["sync"])
def get_sync_run(request: HttpRequest, run_id: int):
    run = get_object_or_404(SyncRun.objects.select_related("store"), pk=run_id)
    base = _run_out(run)
    events = [
        {
            "id": e.id,
            "timestamp": e.timestamp,
            "level": e.level,
            "event_type": e.event_type,
            "message": e.message,
            "data": e.data,
        }
        for e in run.events.all()
    ]
    return SyncRunDetailOut(**base.dict(), events=events)


@api.post("/sync-runs", response=SyncRunOut, tags=["sync"])
def trigger_sync(request: HttpRequest, payload: TriggerSyncIn):
    """
    Runs synchronously and returns the completed run. For catalogs this
    size (tens of products) that is a sub-few-second request. A queued
    background worker (Celery/RQ) is the right call at real scale, and
    is a one-line swap here since SyncService.run_sync() has no
    request-lifecycle dependency, but it is not worth the extra moving
    part for a demo this size, especially on a serverless deploy target.
    """
    store = get_object_or_404(Store, slug=payload.store_slug)
    if not store.is_active:
        raise HttpError(400, f"Store '{store.slug}' is not active")
    service = SyncService(store=store, trigger=SyncRun.Trigger.API)
    run = service.run_sync()
    return _run_out(run)


@api.post("/webhooks/products-update", tags=["webhooks"])
def products_update_webhook(request: HttpRequest):
    """
    Shopify's products/update webhook. Rejects anything not signed with
    the shared secret before touching the payload at all.
    """
    signature = request.headers.get("X-Shopify-Hmac-Sha256")
    secret = settings.SHOPIFY_WEBHOOK_SECRET
    if not verify_shopify_hmac(request.body, signature, secret):
        logger.warning("rejected webhook: invalid or missing HMAC signature")
        raise HttpError(401, "Invalid webhook signature")

    shop_domain = request.headers.get("X-Shopify-Shop-Domain", "")
    store = Store.objects.filter(domain=shop_domain).first()
    if not store:
        logger.warning("webhook for unknown store domain", extra={"extra_fields": {"domain": shop_domain}})
        raise HttpError(404, "Unknown store")

    logger.info(
        "accepted products/update webhook, queuing sync",
        extra={"extra_fields": {"store": store.slug}},
    )
    service = SyncService(store=store, trigger=SyncRun.Trigger.WEBHOOK)
    run = service.run_sync()
    return {"ok": True, "sync_run_id": run.id, "status": run.status}
