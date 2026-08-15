from __future__ import annotations

from collections import Counter
from typing import Any

from django.apps import apps
from django.contrib import admin
from django.contrib.admin.models import LogEntry
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import DatabaseError
from django.urls import reverse_lazy
from django.utils import timezone

from vorin_admin.config import get_panel_settings


def _safe_count(queryset) -> int | None:
    try:
        return queryset.count()
    except DatabaseError:
        return None


def _safe_recent_actions(limit: int = 8):
    try:
        return list(
            LogEntry.objects.select_related("content_type", "user")
            .order_by("-action_time")[:limit]
        )
    except DatabaseError:
        return []


def _registered_model_summary() -> list[dict[str, Any]]:
    registry = admin.site._registry
    app_counter = Counter(model._meta.app_label for model in registry)

    return [
        {
            "app_label": app_label,
            "count": count,
        }
        for app_label, count in sorted(app_counter.items())
    ]


def global_context(_request) -> dict[str, Any]:
    panel = get_panel_settings()
    return {
        "panel_settings": panel,
        "current_year": timezone.now().year,
    }


def dashboard_callback(request, context: dict[str, Any]) -> dict[str, Any]:
    panel = get_panel_settings()
    user_model = get_user_model()

    cards = [
        {
            "title": "Registered models",
            "value": len(admin.site._registry),
            "description": "Models currently available inside the admin engine.",
            "icon": "inventory_2",
        },
        {
            "title": "Installed apps",
            "value": len(apps.app_configs),
            "description": "Django applications active in this project.",
            "icon": "extension",
        },
        {
            "title": "Active modules",
            "value": len(panel["enabled_modules"]),
            "description": "Module registrations currently enabled for this build.",
            "icon": "widgets",
        },
        {
            "title": "Staff users",
            "value": _safe_count(user_model.objects.filter(is_staff=True)),
            "description": "Users with access to this admin workspace.",
            "icon": "groups",
        },
    ]

    quick_actions = [
        {
            "title": "Open all applications",
            "description": "Browse every registered admin model.",
            "icon": "apps",
            "link": reverse_lazy("admin:index"),
        }
    ]

    if panel.get("site_url"):
        quick_actions.append(
            {
                "title": "Visit website",
                "description": "Open the public-facing site in a new tab.",
                "icon": "open_in_new",
                "link": panel["site_url"],
            }
        )

    if panel.get("support_url"):
        quick_actions.append(
            {
                "title": "Support channel",
                "description": "Open the configured support path for this admin.",
                "icon": "support_agent",
                "link": panel["support_url"],
            }
        )

    context.update(
        {
            "panel_settings": panel,
            "title": panel.get("dashboard_title", "Admin dashboard"),
            "dashboard_cards": cards,
            "enabled_modules": panel["enabled_modules"],
            "recent_actions": _safe_recent_actions(),
            "registered_model_summary": _registered_model_summary(),
            "group_count": _safe_count(Group.objects.all()),
            "quick_actions": quick_actions,
            "dashboard_generated_at": timezone.localtime(),
        }
    )
    return context
