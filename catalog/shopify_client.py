"""
A small, deliberate Shopify Admin GraphQL client.

Two things earn their place here instead of being hidden inside the
sync service:

1. Cursor pagination. Shopify's Admin API does not support offset
   pagination on collections like `products` at all: the only way to
   walk the full set is `after: <endCursor>` from the previous page's
   `pageInfo`. There is no shortcut to page N without having fetched
   page N-1.

2. Cost-aware throttling. Every Admin GraphQL response carries
   `extensions.cost.throttleStatus`, which reports Shopify's leaky
   bucket state directly: how many points are available right now, and
   how fast the bucket refills. Sleeping a fixed amount between
   requests either wastes time (bucket recovers faster than that) or
   still gets throttled (bucket is smaller than assumed on a given
   plan/store). Reading the actual state and computing the wait from
   it is the only approach that is correct on both a nearly-empty
   store and a 400k-SKU one.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Callable

import requests

logger = logging.getLogger("catalog.shopify_client")

PRODUCTS_QUERY = """
query CatalogSyncProducts($cursor: String) {
  products(first: 50, after: $cursor) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        title
        handle
        vendor
        productType
        status
        tags
        updatedAt
        variants(first: 100) {
          edges {
            node {
              id
              title
              sku
              price
              inventoryQuantity
              updatedAt
            }
          }
        }
      }
    }
  }
}
"""


PRODUCTS_SAMPLE_QUERY = """
query CatalogSyncProductSample($first: Int!) {
  products(first: $first) {
    edges {
      node {
        id
        title
        handle
      }
    }
  }
}
"""

# --- Metaobject / metafield definitions ----------------------------------
# These four mutations and their read-back queries follow the same shape
# as everything above: `execute()` still owns retries/backoff/cost
# tracking, these just add the query strings and unwrap the
# metaobject/metafield-specific response shape (including userErrors,
# see `_raise_for_user_errors`).

METAOBJECT_DEFINITION_BY_TYPE_QUERY = """
query CatalogSyncMetaobjectDefinitionByType($type: String!) {
  metaobjectDefinitionByType(type: $type) {
    id
    type
    name
    access { storefront admin }
    fieldDefinitions {
      key
      name
      required
      type { name }
      validations { name value }
    }
  }
}
"""

METAOBJECT_DEFINITION_CREATE_MUTATION = """
mutation CatalogSyncCreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
  metaobjectDefinitionCreate(definition: $definition) {
    metaobjectDefinition {
      id
      type
      name
      access { storefront admin }
      fieldDefinitions {
        key
        name
        required
        type { name }
        validations { name value }
      }
    }
    userErrors { field message code }
  }
}
"""

METAOBJECT_BY_HANDLE_QUERY = """
query CatalogSyncMetaobjectByHandle($handle: MetaobjectHandleInput!) {
  metaobjectByHandle(handle: $handle) {
    id
    handle
    type
    fields { key value }
  }
}
"""

METAOBJECT_CREATE_MUTATION = """
mutation CatalogSyncCreateMetaobject($metaobject: MetaobjectCreateInput!) {
  metaobjectCreate(metaobject: $metaobject) {
    metaobject {
      id
      handle
      type
      fields { key value }
    }
    userErrors { field message code }
  }
}
"""

METAFIELD_DEFINITIONS_QUERY = """
query CatalogSyncMetafieldDefinitions($namespace: String!, $key: String!, $ownerType: MetafieldOwnerType!) {
  metafieldDefinitions(namespace: $namespace, key: $key, ownerType: $ownerType, first: 1) {
    edges {
      node {
        id
        name
        namespace
        key
        ownerType
        type { name }
        access { storefront admin }
        validations { name value }
      }
    }
  }
}
"""

METAFIELD_DEFINITION_CREATE_MUTATION = """
mutation CatalogSyncCreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition {
      id
      name
      namespace
      key
      ownerType
      type { name }
      access { storefront admin }
      validations { name value }
    }
    userErrors { field message code }
  }
}
"""

PRODUCT_METAFIELD_VALUE_QUERY = """
query CatalogSyncProductMetafieldValue($id: ID!, $namespace: String!, $key: String!) {
  product(id: $id) {
    metafield(namespace: $namespace, key: $key) {
      id
      value
    }
  }
}
"""

METAFIELDS_SET_MUTATION = """
mutation CatalogSyncSetMetafields($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields {
      id
      key
      namespace
      value
      owner { ... on Product { id } }
    }
    userErrors { field message code elementIndex }
  }
}
"""


class ShopifyAPIError(RuntimeError):
    """Raised for non-throttle GraphQL errors, or exhausted retries."""


class MissingCredentialsError(RuntimeError):
    """Raised when a store's env vars for domain/token aren't set."""


class ShopifyUserErrorsError(ShopifyAPIError):
    """
    Raised whenever a mutation's response carries `userErrors`.

    A mutation that returns HTTP 200 with a non-empty `userErrors` list
    is Shopify's normal way of reporting a validation failure (a
    duplicate type, a bad field type, an unresolvable metaobject
    reference). Nothing about that response looks like a transport
    error, so if this client only checked `payload["errors"]` (raised
    in `execute()` for outright GraphQL errors), a rejected mutation
    would silently look like success: the caller would read `data`,
    find the expected key present but null, and move on. Every mutation
    helper below checks its own `userErrors` explicitly and raises this
    instead.
    """

    def __init__(self, mutation_field: str, user_errors: list[dict]):
        self.mutation_field = mutation_field
        self.user_errors = user_errors
        messages = "; ".join(f"{e.get('field')}: {e.get('message')}" for e in user_errors)
        super().__init__(f"{mutation_field} returned userErrors: {messages}")


def _raise_for_user_errors(mutation_field: str, data: dict) -> dict:
    """
    Every metaobject/metafield mutation below follows the same
    `{ <payload>: { <result key>: {...}, userErrors: [...] } }` shape.
    Centralizing the check means a caller can never forget it and
    silently swallow a rejected write.
    """
    payload = data.get(mutation_field) or {}
    user_errors = payload.get("userErrors") or []
    if user_errors:
        raise ShopifyUserErrorsError(mutation_field, user_errors)
    return payload


@dataclass
class ThrottleStatus:
    maximum_available: float
    currently_available: float
    restore_rate: float

    @classmethod
    def from_extensions(cls, extensions: dict) -> "ThrottleStatus | None":
        cost = extensions.get("cost") if extensions else None
        if not cost:
            return None
        throttle = cost.get("throttleStatus") or {}
        if not throttle:
            return None
        return cls(
            maximum_available=throttle.get("maximumAvailable", 1000.0),
            currently_available=throttle.get("currentlyAvailable", 1000.0),
            restore_rate=throttle.get("restoreRate", 50.0),
        )


@dataclass
class GraphQLResult:
    data: dict
    throttle_status: ThrottleStatus | None
    actual_query_cost: float | None


@dataclass
class ShopifyCredentials:
    domain: str
    admin_token: str


def credentials_for_store(slug: str) -> ShopifyCredentials:
    """
    Resolve a store's Shopify credentials from environment variables.

    Deliberately store-specific env var names rather than a DB column:
    a database dump, admin screenshot, or API response can never leak
    a token, because the token never enters the database at all.
    """
    prefix = slug.upper().replace("-", "_")
    domain = os.environ.get(f"SHOPIFY_DOMAIN_{prefix}")
    token = os.environ.get(f"SHOPIFY_TOKEN_{prefix}")
    if not domain or not token:
        raise MissingCredentialsError(
            f"Missing SHOPIFY_DOMAIN_{prefix} / SHOPIFY_TOKEN_{prefix} environment variables "
            f"for store '{slug}'."
        )
    return ShopifyCredentials(domain=domain, admin_token=token)


class ShopifyGraphQLClient:
    """
    Thin GraphQL wrapper with adaptive throttle-aware backoff.

    `on_backoff` is an optional callback(seconds_waited, throttle_status)
    invoked whenever the client sleeps for rate-limit reasons, so the
    caller (the sync service) can log a SyncEvent for it. That is how
    the frontend's run-detail timeline shows real throttling behaviour
    instead of a black box.
    """

    def __init__(
        self,
        credentials: ShopifyCredentials,
        api_version: str = "2025-01",
        on_backoff: Callable[[float, ThrottleStatus | None], None] | None = None,
        min_available_buffer: float = 100.0,
        session: requests.Session | None = None,
    ):
        self.credentials = credentials
        self.api_version = api_version
        self.on_backoff = on_backoff
        self.min_available_buffer = min_available_buffer
        self.session = session or requests.Session()
        self.request_count = 0
        self.backoff_count = 0
        self._last_throttle: ThrottleStatus | None = None

    @property
    def endpoint(self) -> str:
        return f"https://{self.credentials.domain}/admin/api/{self.api_version}/graphql.json"

    def _headers(self) -> dict:
        return {
            "X-Shopify-Access-Token": self.credentials.admin_token,
            "Content-Type": "application/json",
        }

    def _wait_for_bucket(self, estimated_cost: float = 60.0) -> None:
        """
        Proactively wait if the bucket is too low for the next request,
        based on the last known throttle status, rather than waiting
        for a THROTTLED error and retrying reactively.
        """
        throttle = self._last_throttle
        if throttle is None:
            return
        needed = estimated_cost + self.min_available_buffer
        if throttle.currently_available >= needed:
            return
        deficit = needed - throttle.currently_available
        wait_seconds = max(deficit / throttle.restore_rate, 0.5)
        self.backoff_count += 1
        logger.info(
            "shopify rate limit backoff",
            extra={
                "extra_fields": {
                    "wait_seconds": round(wait_seconds, 2),
                    "currently_available": throttle.currently_available,
                    "restore_rate": throttle.restore_rate,
                }
            },
        )
        if self.on_backoff:
            self.on_backoff(wait_seconds, throttle)
        time.sleep(wait_seconds)

    def execute(self, query: str, variables: dict | None = None, max_retries: int = 5) -> GraphQLResult:
        self._wait_for_bucket()

        attempt = 0
        while True:
            attempt += 1
            self.request_count += 1
            response = self.session.post(
                self.endpoint,
                json={"query": query, "variables": variables or {}},
                headers=self._headers(),
                timeout=30,
            )

            if response.status_code == 429:
                if attempt > max_retries:
                    raise ShopifyAPIError("Exceeded max retries after repeated HTTP 429 responses.")
                retry_after = float(response.headers.get("Retry-After", "2"))
                self.backoff_count += 1
                if self.on_backoff:
                    self.on_backoff(retry_after, self._last_throttle)
                time.sleep(retry_after)
                continue

            response.raise_for_status()
            payload = response.json()

            extensions = payload.get("extensions", {})
            throttle_status = ThrottleStatus.from_extensions(extensions)
            if throttle_status:
                self._last_throttle = throttle_status

            errors = payload.get("errors")
            if errors:
                throttled = any(
                    (err.get("extensions", {}) or {}).get("code") == "THROTTLED" for err in errors
                )
                if throttled and attempt <= max_retries:
                    self.backoff_count += 1
                    wait_seconds = 2.0 * attempt
                    if self.on_backoff:
                        self.on_backoff(wait_seconds, throttle_status)
                    time.sleep(wait_seconds)
                    continue
                raise ShopifyAPIError(f"Shopify GraphQL errors: {errors}")

            return GraphQLResult(
                data=payload.get("data", {}),
                throttle_status=throttle_status,
                actual_query_cost=(extensions.get("cost") or {}).get("actualQueryCost"),
            )

    def iter_products(self):
        """
        Yield raw product nodes one page at a time via cursor pagination.
        Yields (page_products, page_number) tuples so the caller can log
        per-page progress events.
        """
        cursor = None
        page_number = 0
        while True:
            page_number += 1
            result = self.execute(PRODUCTS_QUERY, {"cursor": cursor})
            products_conn = result.data.get("products", {})
            edges = products_conn.get("edges", [])
            nodes = [edge["node"] for edge in edges]
            yield nodes, page_number, result

            page_info = products_conn.get("pageInfo", {})
            if not page_info.get("hasNextPage"):
                return
            cursor = page_info.get("endCursor")

    def fetch_product_sample(self, first: int = 10) -> list[dict]:
        """
        A handful of real products (id/title/handle only, no variants),
        for provisioning flows that need to attach something to actual
        products without paying the cost of the full `iter_products()`
        shape.
        """
        result = self.execute(PRODUCTS_SAMPLE_QUERY, {"first": first})
        edges = result.data.get("products", {}).get("edges", [])
        return [edge["node"] for edge in edges]

    # --- Metaobject definitions ------------------------------------------

    def fetch_metaobject_definition_by_type(self, type_: str) -> dict | None:
        """Read-back for idempotency: None if nothing with this `type` exists yet."""
        result = self.execute(METAOBJECT_DEFINITION_BY_TYPE_QUERY, {"type": type_})
        return result.data.get("metaobjectDefinitionByType")

    def create_metaobject_definition(
        self,
        type_: str,
        name: str,
        field_definitions: list[dict],
        storefront_access: str = "PUBLIC_READ",
        description: str | None = None,
    ) -> dict:
        """
        Create a metaobject definition (the schema for a metaobject
        type, e.g. `demo_pdp_module`).

        `storefront_access` defaults to PUBLIC_READ deliberately: a
        metaobject definition created without `access.storefront` set
        is admin-only. Its entries would exist and look correct in the
        Admin API and in this app's own DB mirror, but the Storefront
        API (what an actual storefront/theme queries) would 404 on
        every reference to them, so the whole point of a "PDP module"
        or "brand theme" demo (rendering it on a real storefront) would
        silently fail with no error anywhere in this pipeline. Passing
        `access` explicitly on every call, rather than relying on
        Shopify's default, is what makes that failure mode impossible
        rather than merely unlikely.
        """
        definition_input = {
            "type": type_,
            "name": name,
            "fieldDefinitions": field_definitions,
            "access": {"storefront": storefront_access},
        }
        if description:
            definition_input["description"] = description
        result = self.execute(METAOBJECT_DEFINITION_CREATE_MUTATION, {"definition": definition_input})
        payload = _raise_for_user_errors("metaobjectDefinitionCreate", result.data)
        return payload["metaobjectDefinition"]

    def ensure_metaobject_definition(
        self,
        type_: str,
        name: str,
        field_definitions: list[dict],
        storefront_access: str = "PUBLIC_READ",
    ) -> tuple[dict, bool]:
        """
        Idempotent create: reuse an existing definition for `type_` if
        one is already there, otherwise create it. Returns
        (definition, created).
        """
        existing = self.fetch_metaobject_definition_by_type(type_)
        if existing:
            return existing, False
        created = self.create_metaobject_definition(
            type_, name, field_definitions, storefront_access=storefront_access
        )
        return created, True

    # --- Metaobject entries ----------------------------------------------

    def fetch_metaobject_by_handle(self, type_: str, handle: str) -> dict | None:
        result = self.execute(METAOBJECT_BY_HANDLE_QUERY, {"handle": {"type": type_, "handle": handle}})
        return result.data.get("metaobjectByHandle")

    def create_metaobject(self, type_: str, handle: str, fields: dict[str, str]) -> dict:
        """`fields` is a plain {key: value} mapping; Shopify wants a list of {key, value}."""
        metaobject_input = {
            "type": type_,
            "handle": handle,
            "fields": [{"key": k, "value": v} for k, v in fields.items()],
        }
        result = self.execute(METAOBJECT_CREATE_MUTATION, {"metaobject": metaobject_input})
        payload = _raise_for_user_errors("metaobjectCreate", result.data)
        return payload["metaobject"]

    def ensure_metaobject(self, type_: str, handle: str, fields: dict[str, str]) -> tuple[dict, bool]:
        """Idempotent create: reuse the existing entry at (type_, handle) if present."""
        existing = self.fetch_metaobject_by_handle(type_, handle)
        if existing:
            return existing, False
        created = self.create_metaobject(type_, handle, fields)
        return created, True

    # --- Metafield definitions --------------------------------------------

    def fetch_metafield_definition(self, namespace: str, key: str, owner_type: str) -> dict | None:
        result = self.execute(
            METAFIELD_DEFINITIONS_QUERY, {"namespace": namespace, "key": key, "ownerType": owner_type}
        )
        edges = result.data.get("metafieldDefinitions", {}).get("edges", [])
        return edges[0]["node"] if edges else None

    def create_metafield_definition(
        self,
        namespace: str,
        key: str,
        name: str,
        owner_type: str,
        type_: str,
        validations: list[dict] | None = None,
        storefront_access: str = "PUBLIC_READ",
        description: str | None = None,
    ) -> dict:
        """
        Same PUBLIC_READ reasoning as `create_metaobject_definition`:
        without `access.storefront`, `custom.pdp_modules` would be
        admin-only and invisible to the Storefront API, even though the
        metaobjects it points at are themselves public.
        """
        definition_input = {
            "namespace": namespace,
            "key": key,
            "name": name,
            "ownerType": owner_type,
            "type": type_,
            "access": {"storefront": storefront_access},
        }
        if validations:
            definition_input["validations"] = validations
        if description:
            definition_input["description"] = description
        result = self.execute(METAFIELD_DEFINITION_CREATE_MUTATION, {"definition": definition_input})
        payload = _raise_for_user_errors("metafieldDefinitionCreate", result.data)
        return payload["createdDefinition"]

    def ensure_metafield_definition(
        self,
        namespace: str,
        key: str,
        name: str,
        owner_type: str,
        type_: str,
        validations: list[dict] | None = None,
        storefront_access: str = "PUBLIC_READ",
    ) -> tuple[dict, bool]:
        existing = self.fetch_metafield_definition(namespace, key, owner_type)
        if existing:
            return existing, False
        created = self.create_metafield_definition(
            namespace, key, name, owner_type, type_, validations=validations, storefront_access=storefront_access
        )
        return created, True

    # --- Setting metafield values on real resources -----------------------

    def set_metafields(self, entries: list[dict]) -> list[dict]:
        """
        `entries` is a list of {ownerId, namespace, key, type, value}
        dicts, one per `metafieldsSet` write (it accepts a batch in one
        call, which is also cheaper on query cost than one mutation per
        product). `metafieldsSet` is a plain set, not upsert-if-different:
        writing the same value twice is a harmless no-op on Shopify's
        side, which is what makes calling this from an idempotent
        provisioning command safe to run repeatedly.
        """
        result = self.execute(METAFIELDS_SET_MUTATION, {"metafields": entries})
        payload = _raise_for_user_errors("metafieldsSet", result.data)
        return payload.get("metafields") or []

    def fetch_product_metafield(self, product_gid: str, namespace: str, key: str) -> dict | None:
        """
        Read-back used to make attaching modules to products idempotent
        the same way as everything else here: check what's already
        there before writing, so a second run of the provisioning
        command can report "reused" instead of re-sending an identical
        `metafieldsSet` (harmless, but noisy and not a true "nothing to
        do" signal in the run's report).
        """
        result = self.execute(PRODUCT_METAFIELD_VALUE_QUERY, {"id": product_gid, "namespace": namespace, "key": key})
        return (result.data.get("product") or {}).get("metafield")

    def set_product_metafield_list_reference(
        self, product_gid: str, namespace: str, key: str, referenced_gids: list[str]
    ) -> dict:
        """
        Convenience wrapper for the one case this demo needs: setting a
        `list.metaobject_reference` field on a single product. Shopify
        represents a list metafield's value as a JSON-encoded array of
        the referenced GIDs, not a GraphQL list argument. Compact
        separators (no space after the comma) match the canonical form
        Shopify stores and echoes back, which is what makes a later
        read-back comparison a reliable idempotency check instead of a
        false mismatch over whitespace.
        """
        value = json.dumps(referenced_gids, separators=(",", ":"))
        metafields = self.set_metafields(
            [
                {
                    "ownerId": product_gid,
                    "namespace": namespace,
                    "key": key,
                    "type": "list.metaobject_reference",
                    "value": value,
                }
            ]
        )
        return metafields[0] if metafields else {}
