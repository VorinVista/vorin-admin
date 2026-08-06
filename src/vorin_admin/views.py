from __future__ import annotations

from django.contrib import admin, messages
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.urls import NoReverseMatch, reverse
from django.utils import timezone

from vorin_admin.config import get_panel_settings
from vorin_admin.forms import VorinAccountUserForm, VorinUserSettingsForm
from vorin_admin.profiles import get_or_create_user_settings


SERVICE_WORKER_CLEANUP_SCRIPT = """
self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
        await self.registration.unregister();

        const clients = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
        });

        clients.forEach((client) => client.navigate(client.url));
    })());
});
""".strip()


def service_worker_cleanup_view(_request):
    response = HttpResponse(
        SERVICE_WORKER_CLEANUP_SCRIPT,
        content_type="application/javascript",
    )
    response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response["Pragma"] = "no-cache"
    response["Service-Worker-Allowed"] = "/"
    return response


def _safe_reverse(name: str) -> str | None:
    try:
        return reverse(name)
    except NoReverseMatch:
        return None


def _build_settings_sections(request, panel: dict[str, object]) -> list[dict[str, object]]:
    app_list = admin.site.get_app_list(request)
    installed_areas = []

    for app in app_list:
        models = [model for model in app.get("models", []) if model.get("admin_url")]
        if not models:
            continue

        installed_areas.append(
            {
                "title": app.get("name", "Application"),
                "description": f"{len(models)} registered admin view(s) ready to manage.",
                "link": models[0]["admin_url"],
                "icon": "folder_managed",
            }
        )

    return [
        {
            "eyebrow": "Workspace",
            "title": "Core admin setup",
            "description": "The settings your operators usually need first when shaping a new back-office.",
            "icon": "space_dashboard",
            "items": [
                {
                    "title": "Profile and avatar",
                    "description": "Update your operator identity, avatar, and direct contact fields.",
                    "link": reverse("vorin_admin:account_settings"),
                },
                {
                    "title": "Team members",
                    "description": "Manage staff accounts that can access this control room.",
                    "link": _safe_reverse("admin:auth_user_changelist"),
                },
                {
                    "title": "Roles and permissions",
                    "description": "Review groups and permission structure for this admin workspace.",
                    "link": _safe_reverse("admin:auth_group_changelist"),
                },
            ],
        },
        {
            "eyebrow": "Experience",
            "title": "Environment and navigation",
            "description": "Shortcuts for the dashboard shell, public site, and support paths your team uses often.",
            "icon": "tune",
            "items": [
                {
                    "title": "Dashboard home",
                    "description": "Jump back to the operational overview for this Django project.",
                    "link": reverse("admin:index"),
                },
                {
                    "title": "View website",
                    "description": "Open the public-facing site in a new tab.",
                    "link": panel.get("site_url") or None,
                    "external": True,
                },
                {
                    "title": "Support channel",
                    "description": "Reach the main support contact configured for this admin.",
                    "link": panel.get("support_url") or None,
                    "external": True,
                },
            ],
        },
        {
            "eyebrow": "Installed areas",
            "title": "Project modules",
            "description": "Registered admin areas detected from the live Django registry.",
            "icon": "widgets",
            "items": installed_areas[:6],
        },
    ]


@staff_member_required
def settings_hub_view(request):
    panel = get_panel_settings()
    app_list = admin.site.get_app_list(request)
    User = get_user_model()

    context = {
        **admin.site.each_context(request),
        "panel_settings": panel,
        "current_year": timezone.now().year,
        "title": "Control settings",
        "subtitle": "Workspace, team, navigation, and reusable admin setup",
        "settings_sections": _build_settings_sections(request, panel),
        "settings_stats": [
            {
                "label": "Environment",
                "value": (panel.get("environment") or {}).get("label", panel.get("site_version", "Live")),
            },
            {
                "label": "Staff users",
                "value": User.objects.filter(is_staff=True).count(),
            },
            {
                "label": "Admin areas",
                "value": len(app_list),
            },
            {
                "label": "Registered models",
                "value": sum(len(app.get("models", [])) for app in app_list),
            },
        ],
    }
    return TemplateResponse(request, "vorin_admin/settings_hub.html", context)


@staff_member_required
def account_settings_view(request):
    panel = get_panel_settings()
    user_settings = get_or_create_user_settings(request.user)

    if request.method == "POST":
        user_form = VorinAccountUserForm(
            request.POST,
            instance=request.user,
            prefix="user",
        )
        settings_form = VorinUserSettingsForm(
            request.POST,
            request.FILES,
            instance=user_settings,
            prefix="profile",
        )

        if user_form.is_valid() and settings_form.is_valid():
            user_form.save()
            settings_form.save()
            messages.success(request, "Your VorinPanel account settings were updated.")
            return redirect("vorin_admin:account_settings")
    else:
        user_form = VorinAccountUserForm(instance=request.user, prefix="user")
        settings_form = VorinUserSettingsForm(instance=user_settings, prefix="profile")

    context = {
        **admin.site.each_context(request),
        "panel_settings": panel,
        "current_year": timezone.now().year,
        "title": "Account settings",
        "subtitle": "Profile, avatar, and contact preferences",
        "user_form": user_form,
        "settings_form": settings_form,
        "user_settings": user_settings,
    }
    return TemplateResponse(request, "vorin_admin/account_settings.html", context)
