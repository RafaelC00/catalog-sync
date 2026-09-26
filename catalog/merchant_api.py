"""
Merchant / marketing-manager API.

Why these writes are server-side, not in the mobile app: the mobile client
is a Storefront API consumer acting as a shopper and must never hold an
Admin API token (see catalog/merchant.py's module docstring for the full
reasoning). The merchant persona needs Admin-level writes
(`metaobjectUpdate`, `metafieldsSet`/`metafieldsDelete`), so this router is
the only place those mutations happen; the app calls these HTTP endpoints
with a shared secret instead.

`X-Merchant-Token` is a coarse shared secret, not a user-account system: one
token for "is this the merchant app", not "which merchant is this". That
matches the scope of this demo (one backend, two known stores, no
merchant-facing signup flow) without pretending to be a real multi-tenant
auth system it isn't.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError
from ninja.security import APIKeyHeader

from catalog.merchant import (
    MerchantNotFoundError,
    build_client,
    get_overview,
    list_modules,
    list_products,
    patch_module,
    set_product_modules,
)
from catalog.models import Store
from catalog.schemas import (
    MerchantModuleOut,
    MerchantModulePatchIn,
    MerchantOverviewOut,
    MerchantProductModulesIn,
    MerchantProductModulesOut,
    MerchantProductOut,
)
from catalog.shopify_client import MissingCredentialsError, ShopifyAPIError

logger = logging.getLogger("catalog.merchant_api")


class MerchantTokenAuth(APIKeyHeader):
    """
    Fails closed: if `MERCHANT_API_TOKEN` isn't set in the environment at
    all, `authenticate` returns None for every request, the same as a
    wrong token would, so every merchant endpoint rejects everything with
    401. An unset secret is a deploy mistake, never an implicit "auth
    disabled" state; there is no code path here that lets a request
    through because the setting happens to be empty.
    """

    param_name = "X-Merchant-Token"

    def authenticate(self, request, key):
        expected = settings.MERCHANT_API_TOKEN
        if not expected or key != expected:
            return None
        return True


router = Router(auth=MerchantTokenAuth(), tags=["merchant"])


def _get_store(store_slug: str) -> Store:
    return get_object_or_404(Store, slug=store_slug)


def _client_for(store: Store):
    try:
        return build_client(store)
    except MissingCredentialsError as exc:
        # Not the caller's fault: this store is registered locally but
        # this deploy has no Shopify credentials for it. A 500 (not a
        # 404/422) is the honest status for "server misconfiguration",
        # and the message never echoes back which env vars, only that
        # they're missing (see MissingCredentialsError for what it logs).
        logger.error("missing shopify credentials for store", extra={"extra_fields": {"store": store.slug}})
        raise HttpError(500, f"Store '{store.slug}' has no Shopify credentials configured on this deploy.") from exc


@router.get("/{store_slug}/overview", response=MerchantOverviewOut)
def merchant_overview(request, store_slug: str):
    store = _get_store(store_slug)
    client = _client_for(store)
    try:
        return get_overview(store, client)
    except ShopifyAPIError as exc:
        raise HttpError(502, f"Shopify error: {exc}") from exc


@router.get("/{store_slug}/modules", response=list[MerchantModuleOut])
def merchant_list_modules(request, store_slug: str):
    store = _get_store(store_slug)
    client = _client_for(store)
    try:
        return list_modules(client)
    except ShopifyAPIError as exc:
        raise HttpError(502, f"Shopify error: {exc}") from exc


@router.patch("/{store_slug}/modules/{handle}", response=MerchantModuleOut)
def merchant_patch_module(request, store_slug: str, handle: str, payload: MerchantModulePatchIn):
    store = _get_store(store_slug)
    client = _client_for(store)
    try:
        return patch_module(store, client, handle, payload.dict(exclude_unset=True))
    except MerchantNotFoundError as exc:
        raise HttpError(404, str(exc)) from exc
    except ShopifyAPIError as exc:
        raise HttpError(502, f"Shopify error: {exc}") from exc


@router.get("/{store_slug}/products", response=list[MerchantProductOut])
def merchant_list_products(request, store_slug: str, has_modules: str = "all"):
    if has_modules not in ("true", "false", "all"):
        raise HttpError(422, "has_modules must be one of: true, false, all")
    store = _get_store(store_slug)
    client = _client_for(store)
    try:
        return list_products(client, has_modules=has_modules)
    except ShopifyAPIError as exc:
        raise HttpError(502, f"Shopify error: {exc}") from exc


@router.put("/{store_slug}/products/{product_handle}/modules", response=MerchantProductModulesOut)
def merchant_set_product_modules(
    request, store_slug: str, product_handle: str, payload: MerchantProductModulesIn
):
    store = _get_store(store_slug)
    client = _client_for(store)
    try:
        return set_product_modules(store, client, product_handle, payload.handles)
    except MerchantNotFoundError as exc:
        raise HttpError(404, str(exc)) from exc
    except ShopifyAPIError as exc:
        raise HttpError(502, f"Shopify error: {exc}") from exc
