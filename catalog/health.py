"""
The real /healthz check.

Rafael has written publicly about a health check that returned 200
while the service underneath it was down, so this one actually
exercises its dependencies instead of returning a hardcoded response:

- Database: runs a real query (not just "is the connection object
  truthy"), because a connection can exist while the query engine is
  wedged.
- Sync freshness: reports how long ago the last successful sync
  finished, per store. A catalog sync service whose syncs have quietly
  stopped succeeding is down in the way that matters, even if the web
  process answers requests fine.

Overall status is "ok" only if every dependency is ok. Otherwise it is
"degraded" (DB is up, but sync data is missing or stale) or "down" (DB
itself is unreachable).
"""

from __future__ import annotations

from datetime import timedelta

from django.db import connection
from django.utils import timezone

from catalog.models import Store, SyncRun

STALE_SYNC_THRESHOLD = timedelta(hours=24)


def check_database() -> tuple[bool, str]:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return True, "reachable"
    except Exception as exc:  # noqa: BLE001 - a health check must not raise
        return False, f"unreachable: {type(exc).__name__}: {exc}"


def check_sync_freshness() -> tuple[bool, str]:
    active_stores = list(Store.objects.filter(is_active=True))
    if not active_stores:
        return True, "no active stores configured"

    stale = []
    fresh = []
    never_synced = []
    now = timezone.now()

    for store in active_stores:
        last_success = (
            SyncRun.objects.filter(store=store, status=SyncRun.Status.SUCCESS)
            .order_by("-finished_at")
            .first()
        )
        if not last_success or not last_success.finished_at:
            never_synced.append(store.slug)
            continue
        age = now - last_success.finished_at
        if age > STALE_SYNC_THRESHOLD:
            stale.append(f"{store.slug} ({age})")
        else:
            fresh.append(f"{store.slug} ({age})")

    if never_synced and not fresh:
        return True, f"no successful sync yet for: {', '.join(never_synced)}"
    if stale:
        return False, f"stale sync data for: {', '.join(stale)}"
    return True, f"fresh: {', '.join(fresh)}" if fresh else "ok"


def run_health_checks() -> dict:
    db_ok, db_detail = check_database()
    dependencies = [{"name": "database", "ok": db_ok, "detail": db_detail}]

    if db_ok:
        sync_ok, sync_detail = check_sync_freshness()
        dependencies.append({"name": "sync_freshness", "ok": sync_ok, "detail": sync_detail})
    else:
        sync_ok = False
        dependencies.append({"name": "sync_freshness", "ok": False, "detail": "skipped: database unreachable"})

    if not db_ok:
        status = "down"
    elif not sync_ok:
        status = "degraded"
    else:
        status = "ok"

    return {
        "status": status,
        "checked_at": timezone.now(),
        "dependencies": dependencies,
    }


def health_status_code(result: dict) -> int:
    """
    200 only when every dependency is ok, 503 otherwise.

    Lives here rather than in the view so the /api/healthz endpoint and the
    bare /healthz alias can never drift apart on what counts as healthy.
    """
    return 200 if result["status"] == "ok" else 503
