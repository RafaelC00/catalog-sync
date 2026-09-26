"""Pydantic (Ninja) schemas for the API. Kept separate from models.py
so the wire format can evolve independently of the ORM shape."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from ninja import Schema


class StoreOut(Schema):
    id: int
    slug: str
    name: str
    domain: str
    is_active: bool
    product_count: int = 0


class VariantOut(Schema):
    id: int
    title: str
    sku: str
    price: Decimal | None
    inventory_quantity: int | None
    last_synced_at: datetime


class ProductOut(Schema):
    id: int
    store_slug: str
    title: str
    handle: str
    vendor: str
    product_type: str
    status: str
    tags: list[str]
    variant_count: int
    last_synced_at: datetime


class ProductDetailOut(ProductOut):
    variants: list[VariantOut]


class SyncEventOut(Schema):
    id: int
    timestamp: datetime
    level: str
    event_type: str
    message: str
    data: dict


class SyncRunOut(Schema):
    id: int
    store_slug: str
    trigger: str
    status: str
    started_at: datetime
    finished_at: datetime | None
    duration_seconds: float | None
    products_created: int
    products_updated: int
    products_unchanged: int
    variants_created: int
    variants_updated: int
    variants_unchanged: int
    rate_limit_backoffs: int
    api_requests: int
    error_message: str


class SyncRunDetailOut(SyncRunOut):
    events: list[SyncEventOut]


class TriggerSyncIn(Schema):
    store_slug: str


class HealthDependency(Schema):
    name: str
    ok: bool
    detail: str


class HealthOut(Schema):
    status: str
    checked_at: datetime
    dependencies: list[HealthDependency]


# --- Merchant API ---------------------------------------------------------
# Schemas for the merchant/marketing-manager persona (catalog/merchant_api.py).
# These describe Shopify metaobject/product data as read live from the Admin
# API, not the local Product/MetaobjectEntry mirror, so they intentionally
# don't reuse ProductOut etc.: the shapes only coincide by accident of both
# describing "a product".


class MerchantStoreOut(Schema):
    slug: str
    name: str
    domain: str


class MerchantThemeOut(Schema):
    primary_color: str
    surface_color: str
    text_color: str
    heading_font: str
    body_font: str
    radius: int


class MerchantOverviewOut(Schema):
    store: MerchantStoreOut
    theme: MerchantThemeOut
    product_count: int
    products_with_modules: int
    module_count: int


class MerchantModuleOut(Schema):
    handle: str
    gid: str
    module_type: str
    heading: str
    body: str
    display_order: int | None
    icon: str
    used_on_product_count: int


class MerchantModulePatchIn(Schema):
    heading: str | None = None
    body: str | None = None
    display_order: int | None = None


class MerchantProductOut(Schema):
    handle: str
    gid: str
    title: str
    featured_image_url: str | None
    module_handles: list[str]


class MerchantProductModulesIn(Schema):
    handles: list[str]


class MerchantProductModulesOut(Schema):
    handle: str
    module_handles: list[str]
