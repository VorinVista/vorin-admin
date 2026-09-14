from types import MethodType

from django.conf import settings
from django.apps import AppConfig
from django.utils.module_loading import import_string


def _configured_callback(name, fallback):
    callback = getattr(settings, "VORIN_ADMIN", {}).get(name, fallback)
    if isinstance(callback, str):
        return import_string(callback)
    return callback


class VorinAdminConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "vorin_admin"
    verbose_name = "Vorin Admin"

    def ready(self) -> None:
        from django.contrib import admin
        from django.utils import timezone

        from vorin_admin.config import get_panel_settings
        from vorin_admin.dashboard import dashboard_callback, global_context
        from vorin_admin.navigation import build_sidebar_navigation
        from vorin_admin.profiles import patch_user_model

        patch_user_model()

        site = admin.site

        if getattr(site, "_vorin_admin_patched", False):
            return

        panel = get_panel_settings()
        site.site_header = panel["site_header"]
        site.site_title = panel["site_title"]
        site.index_title = panel.get("dashboard_title", panel["site_header"])
        site.enable_nav_sidebar = True

        original_each_context = site.each_context
        original_index = site.index

        def each_context(self, request):
            context = original_each_context(request)
            active_panel = get_panel_settings()
            global_callback = _configured_callback("GLOBAL_CALLBACK", global_context)
            if global_callback:
                context.update(global_callback(request) or {})
            context.update(
                {
                    "panel_settings": active_panel,
                    "current_year": timezone.now().year,
                    "site_header": active_panel["site_header"],
                    "site_title": active_panel["site_title"],
                    "index_title": active_panel.get("dashboard_title", active_panel["site_header"]),
                    "site_url": active_panel.get("site_url"),
                    "sidebar_navigation": build_sidebar_navigation(request),
                }
            )
            return context

        def index(self, request, extra_context=None):
            context = dict(extra_context or {})
            active_dashboard_callback = _configured_callback(
                "DASHBOARD_CALLBACK", dashboard_callback
            )
            if active_dashboard_callback:
                context = active_dashboard_callback(request, context) or context
            return original_index(request, extra_context=context)

        site.each_context = MethodType(each_context, site)
        site.index = MethodType(index, site)
        site._vorin_admin_patched = True
