from django.contrib import admin

from catalog.models import (
    MetaobjectDefinition,
    MetaobjectEntry,
    Product,
    ProductMetafieldDefinition,
    Store,
    SyncEvent,
    SyncRun,
    Variant,
)


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "domain", "is_active", "created_at")


class VariantInline(admin.TabularInline):
    model = Variant
    extra = 0
    readonly_fields = ("shopify_gid", "content_hash", "first_synced_at", "last_synced_at")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("title", "store", "vendor", "status", "last_synced_at")
    list_filter = ("store", "status")
    search_fields = ("title", "handle", "shopify_gid")
    inlines = [VariantInline]


class SyncEventInline(admin.TabularInline):
    model = SyncEvent
    extra = 0
    readonly_fields = ("timestamp", "level", "event_type", "message", "data")


@admin.register(SyncRun)
class SyncRunAdmin(admin.ModelAdmin):
    list_display = ("id", "store", "trigger", "status", "started_at", "finished_at")
    list_filter = ("store", "status", "trigger")
    inlines = [SyncEventInline]


class MetaobjectEntryInline(admin.TabularInline):
    model = MetaobjectEntry
    extra = 0
    readonly_fields = ("handle", "shopify_gid", "fields", "created_at", "updated_at")


@admin.register(MetaobjectDefinition)
class MetaobjectDefinitionAdmin(admin.ModelAdmin):
    list_display = ("type", "store", "name", "storefront_access", "shopify_gid", "updated_at")
    list_filter = ("store", "storefront_access")
    search_fields = ("type", "name", "shopify_gid")
    inlines = [MetaobjectEntryInline]


@admin.register(ProductMetafieldDefinition)
class ProductMetafieldDefinitionAdmin(admin.ModelAdmin):
    list_display = ("namespace", "key", "store", "owner_type", "metafield_type", "storefront_access", "updated_at")
    list_filter = ("store", "storefront_access", "owner_type")
    search_fields = ("namespace", "key", "shopify_gid")
