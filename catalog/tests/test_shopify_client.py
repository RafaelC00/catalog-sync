"""
Covers the metaobject/metafield additions to ShopifyGraphQLClient: that
a mutation's `userErrors` is raised as ShopifyUserErrorsError rather
than silently returned as if the write had succeeded, and that the
list-reference metafield helper encodes its value the way Shopify
expects (a compact JSON array of GIDs).

No network: `requests.Session` is replaced with a fake that returns
canned responses and records what was sent, so these exercise the real
`execute()` retry/parsing path against realistic Admin API payloads
without touching a real store.
"""

import json

import pytest

from catalog.shopify_client import (
    ShopifyCredentials,
    ShopifyGraphQLClient,
    ShopifyUserErrorsError,
)


class FakeResponse:
    def __init__(self, payload: dict, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code
        self.headers = {}

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


class FakeSession:
    """Returns one canned response per call, in order. Records every call."""

    def __init__(self, responses: list[dict]):
        self._responses = list(responses)
        self.calls = []

    def post(self, url, json=None, headers=None, timeout=None):
        self.calls.append({"url": url, "json": json, "headers": headers})
        payload = self._responses.pop(0)
        return FakeResponse(payload)


def make_client(responses: list[dict]) -> tuple[ShopifyGraphQLClient, FakeSession]:
    session = FakeSession(responses)
    credentials = ShopifyCredentials(domain="acme.myshopify.com", admin_token="shpat_fake")
    client = ShopifyGraphQLClient(credentials=credentials, session=session)
    return client, session


def _cost_extensions():
    return {"cost": {"actualQueryCost": 5, "throttleStatus": {"maximumAvailable": 1000, "currentlyAvailable": 995, "restoreRate": 50}}}


def test_create_metaobject_definition_returns_node_when_no_user_errors():
    node = {"id": "gid://shopify/MetaobjectDefinition/1", "type": "demo_pdp_module", "name": "Demo PDP Module"}
    client, session = make_client(
        [{"data": {"metaobjectDefinitionCreate": {"metaobjectDefinition": node, "userErrors": []}}, "extensions": _cost_extensions()}]
    )

    result = client.create_metaobject_definition("demo_pdp_module", "Demo PDP Module", [])

    assert result == node
    assert len(session.calls) == 1


def test_create_metaobject_definition_raises_on_user_errors_instead_of_returning():
    client, session = make_client(
        [
            {
                "data": {
                    "metaobjectDefinitionCreate": {
                        "metaobjectDefinition": None,
                        "userErrors": [{"field": ["type"], "message": "Type has already been taken", "code": "TAKEN"}],
                    }
                },
                "extensions": _cost_extensions(),
            }
        ]
    )

    with pytest.raises(ShopifyUserErrorsError) as exc_info:
        client.create_metaobject_definition("demo_pdp_module", "Demo PDP Module", [])

    assert "already been taken" in str(exc_info.value)
    assert exc_info.value.mutation_field == "metaobjectDefinitionCreate"
    assert len(session.calls) == 1


def test_create_metaobject_raises_on_user_errors():
    client, session = make_client(
        [
            {
                "data": {
                    "metaobjectCreate": {
                        "metaobject": None,
                        "userErrors": [{"field": ["handle"], "message": "Handle already exists", "code": "TAKEN"}],
                    }
                },
                "extensions": _cost_extensions(),
            }
        ]
    )

    with pytest.raises(ShopifyUserErrorsError):
        client.create_metaobject("demo_pdp_module", "demo-pdp-module-care", {"heading": "Care"})


def test_create_metafield_definition_raises_on_user_errors():
    client, session = make_client(
        [
            {
                "data": {
                    "metafieldDefinitionCreate": {
                        "createdDefinition": None,
                        "userErrors": [{"field": ["namespace"], "message": "Namespace is invalid", "code": "INVALID"}],
                    }
                },
                "extensions": _cost_extensions(),
            }
        ]
    )

    with pytest.raises(ShopifyUserErrorsError):
        client.create_metafield_definition("custom", "pdp_modules", "PDP Modules", "PRODUCT", "list.metaobject_reference")


def test_set_metafields_raises_on_user_errors_and_does_not_return_partial_data():
    client, session = make_client(
        [
            {
                "data": {
                    "metafieldsSet": {
                        "metafields": [],
                        "userErrors": [{"field": ["metafields", "0", "value"], "message": "Value is invalid", "code": "INVALID"}],
                    }
                },
                "extensions": _cost_extensions(),
            }
        ]
    )

    with pytest.raises(ShopifyUserErrorsError):
        client.set_metafields(
            [{"ownerId": "gid://shopify/Product/1", "namespace": "custom", "key": "pdp_modules", "type": "list.metaobject_reference", "value": "[]"}]
        )


def test_set_product_metafield_list_reference_encodes_compact_json_value():
    metafield_node = {"id": "gid://shopify/Metafield/1", "key": "pdp_modules", "namespace": "custom", "value": "x"}
    client, session = make_client(
        [{"data": {"metafieldsSet": {"metafields": [metafield_node], "userErrors": []}}, "extensions": _cost_extensions()}]
    )

    result = client.set_product_metafield_list_reference(
        "gid://shopify/Product/1", "custom", "pdp_modules", ["gid://shopify/Metaobject/1", "gid://shopify/Metaobject/2"]
    )

    assert result == metafield_node
    sent_variables = session.calls[0]["json"]["variables"]
    sent_value = sent_variables["metafields"][0]["value"]
    # Compact separators: no space after the comma, matching what
    # Shopify itself stores and echoes back on read.
    assert sent_value == '["gid://shopify/Metaobject/1","gid://shopify/Metaobject/2"]'
    assert json.loads(sent_value) == ["gid://shopify/Metaobject/1", "gid://shopify/Metaobject/2"]


def test_fetch_metaobject_definition_by_type_returns_none_when_absent():
    client, session = make_client(
        [{"data": {"metaobjectDefinitionByType": None}, "extensions": _cost_extensions()}]
    )

    assert client.fetch_metaobject_definition_by_type("demo_pdp_module") is None


def test_fetch_metafield_definition_returns_none_when_no_edges():
    client, session = make_client(
        [{"data": {"metafieldDefinitions": {"edges": []}}, "extensions": _cost_extensions()}]
    )

    assert client.fetch_metafield_definition("custom", "pdp_modules", "PRODUCT") is None
