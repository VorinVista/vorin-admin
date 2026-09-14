from __future__ import annotations

from typing import Any
from urllib.parse import parse_qsl, urlsplit

from django.contrib import admin
from django.http import HttpRequest
from django.urls import reverse, reverse_lazy
from django.utils.translation import gettext_lazy as _

from vorin_admin.config import get_panel_settings, resolve_permission_hook

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


def _item_is_allowed(item: dict[str, Any], request: HttpRequest, panel: dict[str, Any]) -> bool:
    permission = item.get("permission")

    if permission is None:
        return True

    if isinstance(permission, bool):
        return permission

    if isinstance(permission, str):
        return resolve_permission_hook(request, permission, panel_settings=panel, default=True)

    if callable(permission):
        return bool(permission(request))

    return True


def _model_identifier(model: dict[str, Any]) -> str:
    return str(model.get("object_name") or model.get("name") or "").lower()


def _build_model_children(
    request: HttpRequest,
    app: dict[str, Any],
    *,
    include_models: list[str] | None = None,
    exclude_models: list[str] | None = None,
) -> list[dict[str, Any]]:
    children: list[dict[str, Any]] = []
    models = list(app.get("models", []))
    excluded = {str(model).lower() for model in (exclude_models or [])}

    if include_models:
        models_by_identifier = {_model_identifier(model): model for model in models}
        models = [
            models_by_identifier[identifier]
            for identifier in (str(model).lower() for model in include_models)
            if identifier in models_by_identifier
        ]

    for model in models:
        if _model_identifier(model) in excluded:
            continue
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


def _build_registered_app_items(
    request: HttpRequest,
    panel: dict[str, Any],
    *,
    excluded_labels: set[str] | None = None,
) -> list[dict[str, Any]]:
    app_list = admin.site.get_app_list(request)
    apps_by_label = {app["app_label"]: app for app in app_list}
    excluded_labels = excluded_labels or set()

    app_meta = {**DEFAULT_APP_META, **panel.get("app_meta", {})}
    app_order = list(panel.get("app_order", []))

    ordered_labels = [label for label in app_order if label in apps_by_label]
    ordered_labels.extend(app["app_label"] for app in app_list if app["app_label"] not in ordered_labels)

    items: list[dict[str, Any]] = []

    for app_label in ordered_labels:
        if app_label in excluded_labels:
            continue
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


def _is_active_link(request: HttpRequest, link: str | None) -> bool:
    if not link:
        return False

    if link.startswith("http://") or link.startswith("https://"):
        return False

    parsed_link = urlsplit(link)
    normalized_request_path = request.path.rstrip("/") or "/"
    normalized_link_path = parsed_link.path.rstrip("/") or "/"
    path_matches = (
        normalized_request_path == normalized_link_path
        or normalized_request_path.startswith(f"{normalized_link_path}/")
    )
    if not path_matches:
        return False

    expected_query = parse_qsl(parsed_link.query, keep_blank_values=True)
    return all(request.GET.get(key) == value for key, value in expected_query)


def _build_explicit_children(
    request: HttpRequest,
    module: dict[str, Any],
    panel: dict[str, Any],
) -> list[dict[str, Any]]:
    children = []

    for child in module.get("children", []):
        if not _item_is_allowed(child, request, panel):
            continue
        link = child.get("link")
        children.append(
            {
                "title": child.get("title") or child.get("label") or _("Link"),
                "link": link or "#",
                "active": _is_active_link(request, link),
                "has_permission": True,
                "disabled": not bool(link),
            }
        )

    active_children = [child for child in children if child["active"]]
    if len(active_children) > 1:
        most_specific = max(
            active_children,
            key=lambda child: len(str(child.get("link") or "").rstrip("/")),
        )
        for child in active_children:
            child["active"] = child is most_specific

    return children


def _build_module_items(request: HttpRequest, panel: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    apps_by_label = {
        app["app_label"]: app for app in admin.site.get_app_list(request)
    }

    for module in panel.get("enabled_modules", []):
        if not _item_is_allowed(module, request, panel):
            continue

        app_label = module.get("app_label")
        app = apps_by_label.get(app_label) if app_label else None
        if app_label and app is None:
            continue

        children = _build_explicit_children(request, module, panel)
        if app is not None:
            children = _build_model_children(
                request,
                app,
                include_models=module.get("include_models"),
                exclude_models=module.get("exclude_models"),
            )

        link = module.get("link") or (app.get("app_url") if app else None)
        active = _is_active_link(request, link) or any(child["active"] for child in children)
        items.append(
            {
                "title": module.get("label", "Module"),
                "icon": module.get("icon", "widgets"),
                "link": link or "#",
                "active": active,
                "has_permission": True,
                "disabled": not bool(link) and not children,
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
    ]

    module_items = _build_module_items(request, panel)
    if module_items:
        groups.append(
            {
                "title": panel.get("module_group_title") or _("Modules"),
                "items": module_items,
            }
        )

    if panel.get("show_all_applications", True):
        module_app_labels = {
            module["app_label"]
            for module in panel.get("enabled_modules", [])
            if module.get("app_label")
        }
        application_items = _build_registered_app_items(
            request,
            panel,
            excluded_labels=module_app_labels,
        )
        if application_items:
            groups.append(
                {
                    "title": _("Applications"),
                    "items": application_items,
                }
            )

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

    quick_links.extend(
        item for item in panel.get("sidebar_links", []) if _item_is_allowed(item, request, panel)
    )

    if quick_links:
        groups.append(
            {
                "title": _("Quick links"),
                "separator": True,
                "items": quick_links,
            }
        )

    return groups
