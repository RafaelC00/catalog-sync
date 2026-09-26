"""
Data model for the catalog sync service.

Store never carries a credential column. Each store's admin API token
is resolved from an environment variable at sync time (see
catalog/shopify_client.py), so a database dump or admin screenshot can
never leak a token.
"""

from django.db import models


class Store(models.Model):
    """One Shopify store this service is allowed to sync."""

    slug = models.SlugField(unique=True, help_text="Used to look up the store's token env vars.")
    name = models.CharField(max_length=200)
    domain = models.CharField(max_length=255, help_text="e.g. my-shop.myshopify.com")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    """A product as last seen from Shopify, upserted by GID."""

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="products")
    shopify_gid = models.CharField(max_length=255, help_text="e.g. gid://shopify/Product/123")
    title = models.CharField(max_length=500)
    handle = models.CharField(max_length=500, blank=True)
    vendor = models.CharField(max_length=255, blank=True)
    product_type = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=50, blank=True)
    tags = models.JSONField(default=list, blank=True)
    shopify_updated_at = models.DateTimeField(null=True, blank=True)

    # content_hash is a digest of every field above (plus variant data)
    # as pulled from Shopify. It is how re-running a sync can say "zero
    # changes" without doing a field-by-field diff on every row.
    content_hash = models.CharField(max_length=64, db_index=True)

    first_synced_at = models.DateTimeField(auto_now_add=True)
    last_synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]
        constraints = [
            models.UniqueConstraint(fields=["store", "shopify_gid"], name="unique_product_per_store"),
        ]
        indexes = [
            models.Index(fields=["store", "handle"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.store.slug})"


class Variant(models.Model):
    """A product variant, upserted by GID, scoped under its product."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    shopify_gid = models.CharField(max_length=255)
    title = models.CharField(max_length=500, blank=True)
    sku = models.CharField(max_length=255, blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    inventory_quantity = models.IntegerField(null=True, blank=True)
    content_hash = models.CharField(max_length=64, db_index=True)

    first_synced_at = models.DateTimeField(auto_now_add=True)
    last_synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]
        constraints = [
            models.UniqueConstraint(fields=["product", "shopify_gid"], name="unique_variant_per_product"),
        ]

    def __str__(self) -> str:
        return f"{self.title or self.sku} ({self.product.title})"


class SyncRun(models.Model):
    """One execution of the sync process against one store."""

    class Trigger(models.TextChoices):
        MANUAL_CLI = "cli", "Management command"
        API = "api", "API trigger"
        WEBHOOK = "webhook", "Webhook"

    class Status(models.TextChoices):
        RUNNING = "running", "Running"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="sync_runs")
    trigger = models.CharField(max_length=20, choices=Trigger.choices, default=Trigger.MANUAL_CLI)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RUNNING)

    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    products_created = models.IntegerField(default=0)
    products_updated = models.IntegerField(default=0)
    products_unchanged = models.IntegerField(default=0)
    variants_created = models.IntegerField(default=0)
    variants_updated = models.IntegerField(default=0)
    variants_unchanged = models.IntegerField(default=0)

    rate_limit_backoffs = models.IntegerField(default=0)
    api_requests = models.IntegerField(default=0)

    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self) -> str:
        return f"SyncRun({self.store.slug}, {self.status}, {self.started_at:%Y-%m-%d %H:%M})"

    @property
    def duration_seconds(self) -> float | None:
        if not self.finished_at:
            return None
        return (self.finished_at - self.started_at).total_seconds()


class SyncEvent(models.Model):
    """A single timeline entry within a sync run, for the run-detail view."""

    class Level(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Warning"
        ERROR = "error", "Error"

    class EventType(models.TextChoices):
        STARTED = "started", "Sync started"
        PAGE_FETCHED = "page_fetched", "Page fetched"
        RATE_LIMIT_BACKOFF = "rate_limit_backoff", "Rate limit backoff"
        PRODUCT_UPSERTED = "product_upserted", "Product upserted"
        FINISHED = "finished", "Sync finished"
        ERROR = "error", "Error"

    sync_run = models.ForeignKey(SyncRun, on_delete=models.CASCADE, related_name="events")
    timestamp = models.DateTimeField(auto_now_add=True)
    level = models.CharField(max_length=20, choices=Level.choices, default=Level.INFO)
    event_type = models.CharField(max_length=40, choices=EventType.choices)
    message = models.CharField(max_length=1000)
    data = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["timestamp"]

    def __str__(self) -> str:
        return f"[{self.level}] {self.event_type}: {self.message}"


class MetaobjectDefinition(models.Model):
    """
    Local mirror of a metaobject definition provisioned on a store via
    `manage.py provision_demo_content`, e.g. `demo_pdp_module`.

    This is what makes provisioning inspectable without another round
    trip to the Admin API: `python manage.py shell` or the Django admin
    can answer "what did we provision, and with what storefront
    access" straight from Postgres/SQLite. It also backs the command's
    own idempotency check for the common case (nothing changed
    locally, nothing changed on Shopify), though the command still
    re-verifies against Shopify's `metaobjectDefinitionByType` before
    creating anything, because this table can drift from Shopify (a
    definition deleted in the Admin UI, a DB restored from an older
    backup) and the API, not this table, is the source of truth for
    whether the write is actually needed.
    """

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="metaobject_definitions")
    type = models.CharField(max_length=255, help_text="Shopify metaobject 'type', e.g. demo_pdp_module")
    name = models.CharField(max_length=255)
    shopify_gid = models.CharField(max_length=255)
    storefront_access = models.CharField(
        max_length=20,
        default="PUBLIC_READ",
        help_text="Mirrors MetaobjectDefinition.access.storefront. Must be PUBLIC_READ for the "
        "Storefront API to ever see this type's entries.",
    )
    field_definitions = models.JSONField(
        default=list, blank=True, help_text="As provisioned: [{key, name, type, required, validations}, ...]"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["type"]
        constraints = [
            models.UniqueConstraint(fields=["store", "type"], name="unique_metaobject_definition_per_store"),
        ]

    def __str__(self) -> str:
        return f"{self.type} ({self.store.slug})"


class MetaobjectEntry(models.Model):
    """Local mirror of one metaobject entry (e.g. a single `demo_pdp_module` row)."""

    definition = models.ForeignKey(MetaobjectDefinition, on_delete=models.CASCADE, related_name="entries")
    handle = models.CharField(max_length=255)
    shopify_gid = models.CharField(max_length=255)
    fields = models.JSONField(default=dict, blank=True, help_text="key -> value, as set on Shopify")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["handle"]
        constraints = [
            models.UniqueConstraint(fields=["definition", "handle"], name="unique_metaobject_entry_per_definition"),
        ]

    def __str__(self) -> str:
        return f"{self.handle} ({self.definition.type})"


class ProductMetafieldDefinition(models.Model):
    """
    Local mirror of a product-scoped metafield definition provisioned
    by `provision_demo_content`, e.g. `custom.pdp_modules`. Separate
    from `MetaobjectDefinition` because a metafield definition is a
    different Shopify object (it lives on a resource like Product, not
    on its own type namespace) with its own access/validation shape.
    """

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="product_metafield_definitions")
    namespace = models.CharField(max_length=255)
    key = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    owner_type = models.CharField(max_length=50, default="PRODUCT")
    metafield_type = models.CharField(max_length=100, help_text="e.g. list.metaobject_reference")
    shopify_gid = models.CharField(max_length=255)
    storefront_access = models.CharField(max_length=20, default="PUBLIC_READ")
    validations = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["namespace", "key"]
        constraints = [
            models.UniqueConstraint(
                fields=["store", "namespace", "key", "owner_type"], name="unique_metafield_definition_per_store"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.namespace}.{self.key} ({self.store.slug})"
