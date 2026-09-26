"""
The webhook endpoint's entire job is to reject anything that isn't
genuinely from Shopify before it touches the database. These tests
cover the signature check in isolation and the endpoint's rejection
path, plus (with the sync itself faked out) that a validly signed
request is accepted.
"""

import base64
import hashlib
import hmac
import json

import pytest
from django.test import Client

from catalog.models import Store
from catalog.webhooks import verify_shopify_hmac


def _sign(body: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


def test_verify_shopify_hmac_accepts_correctly_signed_body():
    secret = "shhh-its-a-secret"
    body = b'{"id": 123, "title": "Widget"}'
    assert verify_shopify_hmac(body, _sign(body, secret), secret) is True


def test_verify_shopify_hmac_rejects_wrong_secret():
    body = b'{"id": 123}'
    signed_with_wrong_secret = _sign(body, "not-the-real-secret")
    assert verify_shopify_hmac(body, signed_with_wrong_secret, "shhh-its-a-secret") is False


def test_verify_shopify_hmac_rejects_tampered_body():
    secret = "shhh-its-a-secret"
    original_body = b'{"id": 123, "price": "10.00"}'
    signature = _sign(original_body, secret)
    tampered_body = b'{"id": 123, "price": "1.00"}'
    assert verify_shopify_hmac(tampered_body, signature, secret) is False


def test_verify_shopify_hmac_rejects_missing_signature():
    assert verify_shopify_hmac(b"{}", None, "shhh-its-a-secret") is False


def test_verify_shopify_hmac_rejects_missing_secret():
    body = b"{}"
    assert verify_shopify_hmac(body, _sign(body, "some-secret"), "") is False


@pytest.mark.django_db
def test_webhook_endpoint_rejects_unsigned_request(settings):
    settings.SHOPIFY_WEBHOOK_SECRET = "configured-secret"
    client = Client()

    response = client.post(
        "/api/webhooks/products-update",
        data=json.dumps({"id": 1}),
        content_type="application/json",
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_webhook_endpoint_rejects_badly_signed_request(settings):
    settings.SHOPIFY_WEBHOOK_SECRET = "configured-secret"
    client = Client()
    body = json.dumps({"id": 1}).encode()

    response = client.post(
        "/api/webhooks/products-update",
        data=body,
        content_type="application/json",
        HTTP_X_SHOPIFY_HMAC_SHA256="not-a-real-signature==",
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_webhook_endpoint_accepts_correctly_signed_request(settings, monkeypatch):
    settings.SHOPIFY_WEBHOOK_SECRET = "configured-secret"
    Store.objects.create(slug="acme", name="Acme", domain="acme.myshopify.com")

    class FakeRun:
        id = 999
        status = "success"

    monkeypatch.setattr("catalog.api.SyncService.run_sync", lambda self: FakeRun())

    client = Client()
    body = json.dumps({"id": 1}).encode()
    signature = _sign(body, "configured-secret")

    response = client.post(
        "/api/webhooks/products-update",
        data=body,
        content_type="application/json",
        HTTP_X_SHOPIFY_HMAC_SHA256=signature,
        HTTP_X_SHOPIFY_SHOP_DOMAIN="acme.myshopify.com",
    )

    assert response.status_code == 200
    assert response.json()["sync_run_id"] == 999
