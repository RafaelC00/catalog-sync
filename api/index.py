"""
Vercel Python entrypoint. Vercel's Python runtime looks for a WSGI-
callable named `app` in this file; everything else is the same Django
project that runs locally, unchanged. Kept as a two-line adapter
rather than restructuring the project around Vercel, so the same
codebase runs the same way locally, in tests, and deployed.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django.core.wsgi import get_wsgi_application  # noqa: E402

app = get_wsgi_application()
