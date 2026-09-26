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
