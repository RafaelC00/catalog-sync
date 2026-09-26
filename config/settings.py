"""
Django settings for the catalog-sync project.

Decisions worth flagging (see README for the full rationale):
- Config is entirely environment-driven so the same codebase runs
  unchanged locally, in tests, and on Vercel.
- DATABASE_URL is parsed by hand (no dj-database-url dependency) to
  keep the dependency list short; Postgres is required outside DEBUG.
- Logging is configured to emit structured JSON in production so log
  lines are machine-parseable by whatever aggregator sits in front of
  the deployment, and human-readable text locally.
"""

import json
import logging
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# .env is only ever read locally / in CI. On Vercel, real env vars are
# injected by the platform and this file will not exist.
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "insecure-dev-key-do-not-use-in-production")

DEBUG = os.environ.get("DJANGO_DEBUG", "false").lower() == "true"

ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",") if h.strip()]

CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "catalog",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# --- Database -----------------------------------------------------------
# Serverless deployments cannot use SQLite on ephemeral disk, so a
# DATABASE_URL (standard libpq URL, as Neon/Supabase hand out) is
# required whenever DEBUG is off. Locally, SQLite is fine and requires
# no setup.

DATABASE_URL = os.environ.get("DATABASE_URL", "")


def _database_from_url(url: str) -> dict:
    parsed = urlparse(url)
    options = {}
    if parsed.query and "sslmode" in parsed.query:
        options["sslmode"] = "require"
    else:
        options["sslmode"] = "require"
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": parsed.path.lstrip("/"),
        "USER": parsed.username,
        "PASSWORD": parsed.password,
        "HOST": parsed.hostname,
        "PORT": parsed.port or 5432,
        "OPTIONS": options,
        "CONN_MAX_AGE": 0,
    }


if DATABASE_URL:
    DATABASES = {"default": _database_from_url(DATABASE_URL)}
elif DEBUG or "pytest" in sys.modules or "PYTEST_CURRENT_TEST" in os.environ:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    raise RuntimeError(
        "DATABASE_URL is required when DJANGO_DEBUG is not true. "
        "Set it to a Postgres connection string (see .env.example)."
    )

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Shopify / sync configuration ---------------------------------------
# Store credentials never live in the database or in code. Each store's
# admin token is looked up from an env var named after the store slug
# at sync time (see catalog/shopify_client.py:token_for_store).

SHOPIFY_API_VERSION = os.environ.get("SHOPIFY_API_VERSION", "2025-01")
SHOPIFY_WEBHOOK_SECRET = os.environ.get("SHOPIFY_WEBHOOK_SECRET", "")

# Frontend origin allowed to call the API cross-origin (the Vite/React
# app, whether local dev or the deployed static build).
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()
]
CORS_ALLOW_ALL_ORIGINS = os.environ.get("CORS_ALLOW_ALL_ORIGINS", "false").lower() == "true"

# --- Logging --------------------------------------------------------------
# Structured JSON in anything that isn't local DEBUG so log lines are
# greppable/parseable by a real aggregator. Plain text locally so a
# human reading a terminal doesn't have to squint at JSON.


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        extra = getattr(record, "extra_fields", None)
        if extra:
            payload.update(extra)
        return json.dumps(payload)


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {"()": "config.settings.JsonLogFormatter"},
        "plain": {"format": "[{levelname}] {name}: {message}", "style": "{"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "plain" if DEBUG else "json",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "catalog": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
