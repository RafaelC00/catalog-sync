from django.contrib import admin
from django.urls import path

from catalog.api import api
from catalog.views import healthz

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
    # Conventional aliases; see catalog/views.healthz for why.
    path("healthz", healthz),
    path("health", healthz),
]
