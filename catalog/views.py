"""
Plain-Django views that sit outside the /api/ namespace.

Only the health alias lives here. Everything else is Ninja (catalog/api.py).
"""

from django.core.serializers.json import DjangoJSONEncoder
from django.http import HttpRequest, JsonResponse

from catalog.health import health_status_code, run_health_checks


def healthz(request: HttpRequest) -> JsonResponse:
    """
    The same check as /api/healthz, served at the conventional paths.

    Without this, /health and /healthz fell through to the SPA catch-all in
    vercel.json and answered 200 with an HTML page - a probe hitting the
    obvious path got told everything was fine by a route that never ran a
    check. A health endpoint that lies on the default path is worse than one
    that is missing, so both aliases resolve here.
    """
    result = run_health_checks()
    return JsonResponse(
        result, status=health_status_code(result), encoder=DjangoJSONEncoder
    )
