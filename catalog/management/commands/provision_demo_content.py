"""
Thin CLI wrapper around DemoContentProvisioner, following the same
split as `sync_store.py`/`SyncService`: the command handles argument
parsing and stdout formatting, the module under `catalog/` owns the
actual logic so it stays testable without invoking a management
command from a test.
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from catalog.demo_content import DemoContentProvisioner
from catalog.models import Store
from catalog.shopify_client import (
    MissingCredentialsError,
    ShopifyAPIError,
    ShopifyGraphQLClient,
    ShopifyUserErrorsError,
    credentials_for_store,
)


class Command(BaseCommand):
    help = (
        "Provision the demo PDP content model (demo_pdp_module + demo_brand_theme "
        "metaobject definitions, the custom.pdp_modules product metafield definition, "
        "seed entries, and attaching modules to real products) on a store. "
        "Idempotent: safe to run more than once."
    )

    def add_arguments(self, parser):
        parser.add_argument("--store", required=True, help="Store slug, e.g. nomada or loomwerk")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be created/reused without writing anything to Shopify or the local DB.",
        )

    def handle(self, *args, **options):
        slug = options["store"]
        dry_run = options["dry_run"]

        try:
            store = Store.objects.get(slug=slug)
        except Store.DoesNotExist as exc:
            raise CommandError(
                f"No store with slug '{slug}'. Registered stores: "
                f"{', '.join(Store.objects.values_list('slug', flat=True)) or '(none)'}"
            ) from exc

        try:
            credentials = credentials_for_store(store.slug)
        except MissingCredentialsError as exc:
            raise CommandError(str(exc)) from exc

        client = ShopifyGraphQLClient(credentials=credentials, api_version=settings.SHOPIFY_API_VERSION)

        self.stdout.write(
            f"Provisioning demo content on {store.name} ({store.slug}){' [dry run]' if dry_run else ''}..."
        )

        provisioner = DemoContentProvisioner(store=store, client=client, dry_run=dry_run)
        try:
            report = provisioner.provision()
        except ShopifyUserErrorsError as exc:
            raise CommandError(f"Shopify rejected a mutation: {exc}") from exc
        except ShopifyAPIError as exc:
            raise CommandError(f"Shopify API error: {exc}") from exc

        created = sum(1 for s in report.steps if s.action == "created")
        reused = sum(1 for s in report.steps if s.action == "reused")
        would_create = sum(1 for s in report.steps if s.action == "would create")

        for step in report.steps:
            style = {
                "created": self.style.SUCCESS,
                "reused": self.style.WARNING,
                "would create": self.style.NOTICE,
            }.get(step.action, self.style.NOTICE)
            gid_suffix = f" ({step.shopify_gid})" if step.shopify_gid else ""
            detail_suffix = f" - {step.detail}" if step.detail else ""
            self.stdout.write(style(f"  [{step.action}] {step.label}{gid_suffix}{detail_suffix}"))

        self.stdout.write(
            f"Done. {created} created, {reused} reused"
            + (f", {would_create} would be created" if dry_run else "")
            + f" (of {len(report.steps)} steps)."
        )
