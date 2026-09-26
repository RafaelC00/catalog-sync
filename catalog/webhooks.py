"""
Shopify webhook signature verification.

Shopify signs every webhook body with HMAC-SHA256 using the app's
webhook secret, base64-encoded into the X-Shopify-Hmac-Sha256 header.
Verifying it is the only thing standing between this endpoint and
anyone on the internet POSTing fabricated "a product changed" events
at it, so an unsigned or mis-signed request is rejected before it
touches anything else, using a constant-time comparison to avoid
leaking the secret through response-time side channels.
"""

from __future__ import annotations

import base64
import hashlib
import hmac


def verify_shopify_hmac(raw_body: bytes, signature_header: str | None, secret: str) -> bool:
    if not signature_header or not secret:
        return False
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
    computed = base64.b64encode(digest).decode("utf-8")
    return hmac.compare_digest(computed, signature_header)
