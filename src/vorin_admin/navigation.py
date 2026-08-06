from __future__ import annotations

from typing import Any

from django.contrib import admin
from django.http import HttpRequest
from django.urls import reverse, reverse_lazy
from django.utils.translation import gettext_lazy as _

from vorin_admin.config import get_panel_settings

DEFAULT_APP_META: dict[str, dict[str, str]] = {
    "auth": {"title": _("Django"), "icon": "admin_panel_settings"},
}


def _external_item(*, title: str, icon: str, link: str) -> dict[str, Any]:
    return {
        "title": title,
        "icon": icon,
        "link": link,
        "active": False,
        "has_permission": True,
    }


def _build_model_children(request: HttpRequest, app: dict[str, Any]) -> list[dict[str, Any]]:
    children: list[dict[str, Any]] = []

    for model in app.get("models", []):
        admin_url = model.get("admin_url")
        if not admin_url:
            continue

        children.append(
            {
                "title": model["name"],
                "link": admin_url,
                "active": request.path.startswith(admin_url),
                "has_permission": True,
            }
        )

    return children


def _build_registered_app_items(request: HttpRequest, panel: dict[str, Any]) -> list[dict[str, Any]]:
    app_list = admin.site.get_app_list(request)
    apps_by_label = {app["app_label"]: app for app in app_list}

    app_meta = {**DEFAULT_APP_META, **panel.get("app_meta", {})}
    app_order = list(panel.get("app_order", []))

    ordered_labels = [label for label in app_order if label in apps_by_label]
    ordered_labels.extend(app["app_label"] for app in app_list if app["app_label"] not in ordered_labels)

    items: list[dict[str, Any]] = []

    for app_label in ordered_labels:
        app = apps_by_label[app_label]
        meta = app_meta.get(app_label, {})
        children = _build_model_children(request, app)
        app_url = app.get("app_url") or reverse("admin:index")

        items.append(
            {
                "title": meta.get("title", app["name"]),
                "icon": meta.get("icon", "folder"),
                "link": app_url,
                "active": request.path.startswith(app_url) or any(child["active"] for child in children),
                "has_permission": True,
                "badge": len(children) or None,
                "children": children,
            }
        )

    return items


def build_sidebar_navigation(request: HttpRequest) -> list[dict]:
    panel = get_panel_settings()

    groups: list[dict] = [
        {
            "title": _("Control room"),
            "items": [
                {
                    "title": _("Dashboard"),
                    "icon": "space_dashboard",
                    "link": reverse_lazy("admin:index"),
                    "active": request.path.rstrip("/") == "/admin",
                    "has_permission": True,
                }
            ],
        },
        {
            "title": _("Applications"),
            "items": _build_registered_app_items(request, panel),
        },
    ]

    quick_links = []

    if panel.get("site_url"):
        quick_links.append(
            _external_item(
                title=_("View website"),
                icon="open_in_new",
                link=panel["site_url"],
            )
        )

    if panel.get("support_url"):
        quick_links.append(
            _external_item(
                title=_("Support"),
                icon="support_agent",
                link=panel["support_url"],
            )
        )

    quick_links.extend(panel.get("sidebar_links", []))

    if quick_links:
        groups.append(
            {
                "title": _("Quick links"),
                "separator": True,
                "items": quick_links,
            }
        )

    return groups
