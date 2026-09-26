from django.core.management.base import BaseCommand, CommandError

from catalog.models import Store, SyncRun
from catalog.sync import SyncService


class Command(BaseCommand):
    help = "Sync one store's catalog from Shopify. Usage: manage.py sync_store <slug>"

    def add_arguments(self, parser):
        parser.add_argument("slug", type=str, help="Store slug, e.g. nomada or loomwerk")

    def handle(self, *args, **options):
        slug = options["slug"]
        try:
            store = Store.objects.get(slug=slug)
        except Store.DoesNotExist as exc:
            raise CommandError(
                f"No store with slug '{slug}'. Registered stores: "
                f"{', '.join(Store.objects.values_list('slug', flat=True)) or '(none)'}"
            ) from exc

        self.stdout.write(f"Starting sync for {store.name} ({store.slug})...")
        service = SyncService(store=store, trigger=SyncRun.Trigger.MANUAL_CLI)
        run = service.run_sync()

        if run.status == SyncRun.Status.SUCCESS:
            self.stdout.write(self.style.SUCCESS(f"Sync #{run.id} finished in {run.duration_seconds:.1f}s"))
            self.stdout.write(
                f"  products: {run.products_created} created, "
                f"{run.products_updated} updated, {run.products_unchanged} unchanged"
            )
            self.stdout.write(
                f"  variants: {run.variants_created} created, "
                f"{run.variants_updated} updated, {run.variants_unchanged} unchanged"
            )
            self.stdout.write(f"  api requests: {run.api_requests}, rate-limit backoffs: {run.rate_limit_backoffs}")
        else:
            self.stdout.write(self.style.ERROR(f"Sync #{run.id} failed: {run.error_message}"))
            raise CommandError(run.error_message)
