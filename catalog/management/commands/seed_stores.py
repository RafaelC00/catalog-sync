import os

from django.core.management.base import BaseCommand

from catalog.models import Store

# slug -> display name. Domain is read from SHOPIFY_DOMAIN_<SLUG> so the
# store roster itself contains no credentials or hardcoded domains.
KNOWN_STORES = {
    "nomada": "Nomada Supply Co",
    "loomwerk": "Loomwerk Apparel Wholesale",
}


class Command(BaseCommand):
    help = "Create/update Store rows for the demo stores, reading domains from env vars."

    def handle(self, *args, **options):
        for slug, name in KNOWN_STORES.items():
            env_key = f"SHOPIFY_DOMAIN_{slug.upper()}"
            domain = os.environ.get(env_key)
            if not domain:
                self.stdout.write(self.style.WARNING(f"Skipping {slug}: {env_key} not set"))
                continue
            store, created = Store.objects.update_or_create(
                slug=slug, defaults={"name": name, "domain": domain, "is_active": True}
            )
            verb = "Created" if created else "Updated"
            self.stdout.write(self.style.SUCCESS(f"{verb} store {store.slug} ({store.domain})"))
