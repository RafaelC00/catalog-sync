"""
/healthz has to actually mean something: these tests check that it
reports a real dependency state rather than a hardcoded 200, covering
the "never synced yet" and "stale sync" branches that a fake health
check would never distinguish.
"""

from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from catalog.models import Store, SyncRun

pytestmark = pytest.mark.django_db


def test_healthz_ok_with_no_active_stores():
    client = Client()
    response = client.get("/api/healthz")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"


def test_healthz_ok_but_notes_never_synced_store():
    Store.objects.create(slug="acme", name="Acme", domain="acme.myshopify.com")
    client = Client()
    response = client.get("/api/healthz")
    assert response.status_code == 200
    body = response.json()
    sync_dep = next(d for d in body["dependencies"] if d["name"] == "sync_freshness")
    assert "no successful sync" in sync_dep["detail"]


def test_healthz_degraded_when_last_success_is_stale():
    store = Store.objects.create(slug="acme", name="Acme", domain="acme.myshopify.com")
    run = SyncRun.objects.create(store=store, status=SyncRun.Status.SUCCESS)
    SyncRun.objects.filter(pk=run.pk).update(finished_at=timezone.now() - timedelta(hours=48))

    client = Client()
    response = client.get("/api/healthz")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "degraded"


def test_healthz_ok_when_last_success_is_recent():
    store = Store.objects.create(slug="acme", name="Acme", domain="acme.myshopify.com")
    run = SyncRun.objects.create(store=store, status=SyncRun.Status.SUCCESS)
    SyncRun.objects.filter(pk=run.pk).update(finished_at=timezone.now() - timedelta(minutes=5))

    client = Client()
    response = client.get("/api/healthz")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
