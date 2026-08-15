from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.shortcuts import redirect
from django.urls import include, path


def home_redirect(_request):
    return redirect("admin:index")

urlpatterns = [
    path("", home_redirect),
    path("admin/vorin/account/", lambda request: redirect("vorin_admin:account_settings")),
    path(
        "admin/account/",
        include(("vorin_admin.urls", "vorin_admin"), namespace="vorin_admin"),
    ),
    path("admin/", admin.site.urls),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
