from __future__ import annotations

from pathlib import Path
from copy import deepcopy
from typing import Any

from django.conf import settings
from django.templatetags.static import static
from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _

DEFAULT_MODULES = {
    "content": True,
    "blog": True,
    "seo": True,
    "analytics": True,
    "enquiries": True,
    "media": True,
    "clients": False,
}

DEFAULT_PANEL_SETTINGS: dict[str, Any] = {
    "site_title": "VorinPanel",
    "site_header": "VorinPanel",
    "site_subheader": "VorinVista Control System",
    "site_version": "v0.1.0",
    "site_url": "/",
    "site_symbol": "space_dashboard",
    "account_settings_path": "/admin/account/settings/",
    "support_url": "mailto:support@vorinvista.com",
    "support_email": "support@vorinvista.com",
    "footer_text": "Powered and supported by VorinVista",
    "footer_note": "A reusable VorinVista back-office layer for every Django build.",
    "dashboard_title": "VorinPanel Dashboard",
    "login_message": "Branded for VorinVista workflows, clients, and internal operations.",
    "welcome_title": "VorinPanel by VorinVista",
    "welcome_message": "A reusable admin surface aligned to the real VorinVista brand system.",
    "show_search": True,
    "show_history": True,
    "show_view_on_site": True,
    "show_all_applications": True,
    "show_theme_switch": True,
    "show_language_switch": False,
    "show_notifications": False,
    "command_search_models": True,
    "environment": {
        "label": "VorinVista",
        "color": "info",
    },
    "modules": DEFAULT_MODULES,
    "dropdown_links": [],
    "account_links": [],
    "sidebar_links": [],
}

DEFAULT_COLORS = {
    "base": {
        "50": "#f6f8fc",
        "100": "#eef3fb",
        "200": "#d9e2ec",
        "300": "#bac7d6",
        "400": "#8da0b5",
        "500": "#66788f",
        "600": "#4a5a71",
        "700": "#344257",
        "800": "#223046",
        "900": "#142033",
        "950": "#011538",
    },
    "primary": {
        "50": "#fff2ea",
        "100": "#ffe2d0",
        "200": "#ffc19b",
        "300": "#ff9a62",
        "400": "#f17020",
        "500": "#db5f16",
        "600": "#b65010",
        "700": "#8f400f",
        "800": "#733615",
        "900": "#5d2d14",
        "950": "#321408",
    },
    "font": {
        "subtle-light": "var(--color-base-500)",
        "subtle-dark": "var(--color-base-400)",
        "default-light": "var(--color-base-700)",
        "default-dark": "var(--color-base-300)",
        "important-light": "var(--color-base-950)",
        "important-dark": "var(--color-base-100)",
    },
}

MODULE_META = {
    "content": {"label": _("Content"), "icon": "article"},
    "blog": {"label": _("Blog"), "icon": "edit_square"},
    "seo": {"label": _("SEO"), "icon": "query_stats"},
    "analytics": {"label": _("Analytics"), "icon": "monitoring"},
    "enquiries": {"label": _("Enquiries"), "icon": "mail"},
    "media": {"label": _("Media"), "icon": "perm_media"},
    "clients": {"label": _("Clients"), "icon": "groups"},
}

ASSET_VERSION = str(int(Path(__file__).resolve().stat().st_mtime))


def get_asset_version(path: str) -> str:
    relative_path = Path(path)

    if relative_path.parts and relative_path.parts[0] == "vorin_admin":
        asset_path = Path(__file__).resolve().parent / "static" / relative_path

        if asset_path.exists():
            return str(int(asset_path.stat().st_mtime))

    return ASSET_VERSION


def versioned_static(path: str) -> str:
    return f"{static(path)}?v={get_asset_version(path)}"


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(base)

    for key, value in override.items():
        if isinstance(result.get(key), dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value

    return result


def get_panel_settings(panel_settings: dict[str, Any] | None = None) -> dict[str, Any]:
    if panel_settings is None:
        panel_settings = getattr(settings, "VORIN_PANEL", {})

    merged = _deep_merge(DEFAULT_PANEL_SETTINGS, panel_settings)
    merged["enabled_modules"] = get_enabled_modules(merged)
    return merged


def get_enabled_modules(
    panel_settings: dict[str, Any] | None = None,
) -> list[dict[str, str]]:
    panel = panel_settings if panel_settings is not None else get_panel_settings()
    modules = panel.get("modules", {})
    enabled: list[dict[str, str]] = []

    for slug, is_enabled in modules.items():
        if not is_enabled:
            continue

        meta = MODULE_META.get(
            slug,
            {
                "label": slug.replace("_", " ").title(),
                "icon": "widgets",
            },
        )
        enabled.append({"slug": slug, **meta})

    return enabled


def environment_badge(_request) -> list[str] | None:
    panel = get_panel_settings()
    environment = panel.get("environment") or {}

    if not environment.get("label"):
        return None

    return [environment["label"], environment.get("color", "info")]


def build_site_dropdown(panel_settings: dict[str, Any]) -> list[dict[str, Any]]:
    items = [
        {
            "icon": "space_dashboard",
            "title": _("Open dashboard"),
            "link": reverse_lazy("admin:index"),
        }
    ]

    if panel_settings.get("site_url"):
        items.append(
            {
                "icon": "open_in_new",
                "title": _("View website"),
                "link": panel_settings["site_url"],
                "attrs": {"target": "_blank", "rel": "noreferrer"},
            }
        )

    if panel_settings.get("support_url"):
        items.append(
            {
                "icon": "support_agent",
                "title": _("Contact support"),
                "link": panel_settings["support_url"],
            }
        )

    items.extend(panel_settings.get("dropdown_links", []))
    return items


def build_account_links(panel_settings: dict[str, Any]) -> list[dict[str, Any]]:
    links: list[dict[str, Any]] = []

    if panel_settings.get("support_url"):
        links.append(
            {
                "title": _("VorinVista support"),
                "link": panel_settings["support_url"],
            }
        )

    links.extend(panel_settings.get("account_links", []))
    return links


def build_vorin_settings(
    panel_settings: dict[str, Any] | None = None,
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    panel = get_panel_settings(panel_settings)

    config: dict[str, Any] = {
        "SITE_TITLE": panel["site_title"],
        "SITE_HEADER": panel["site_header"],
        "SITE_SUBHEADER": panel["site_subheader"],
        "SITE_VERSION": panel["site_version"],
        "SITE_URL": panel["site_url"],
        "SITE_SYMBOL": panel["site_symbol"],
        "SITE_DROPDOWN": build_site_dropdown(panel),
        "SITE_LOGO": {
            "light": lambda request: static("vorin_admin/branding/logo-light.png"),
            "dark": lambda request: static("vorin_admin/branding/logo-dark.png"),
        },
        "SITE_ICON": {
            "light": lambda request: static("vorin_admin/branding/vv-logo.png"),
            "dark": lambda request: static("vorin_admin/branding/vv-logo.png"),
        },
        "SITE_FAVICONS": [
            {
                "rel": "icon",
                "type": "image/png",
                "href": lambda request: static("vorin_admin/branding/vv-logo.png"),
            }
        ],
        "SHOW_HISTORY": panel["show_history"],
        "SHOW_VIEW_ON_SITE": panel["show_view_on_site"],
        "COLORS": DEFAULT_COLORS,
        "GLOBAL_CALLBACK": "vorin_admin.dashboard.global_context",
        "DASHBOARD_CALLBACK": "vorin_admin.dashboard.dashboard_callback",
        "ENVIRONMENT": environment_badge,
        "STYLES": [
            lambda request: static("admin/css/vendor/select2/select2.min.css"),
            lambda request: versioned_static("vorin_admin/css/vorin_panel.css"),
        ],
        "SCRIPTS": [
            lambda request: versioned_static("vorin_admin/js/vorin_panel.js"),
        ],
        "LOGIN": {
            "image": lambda request: static("vorin_admin/branding/login-visual.svg"),
        },
        "ACCOUNT": {
            "navigation": build_account_links(panel),
        },
        "COMMAND": {
            "search_models": panel["command_search_models"],
            "show_history": True,
        },
        "SIDEBAR": {
            "show_search": panel["show_search"],
            "show_all_applications": panel["show_all_applications"],
            "navigation": "vorin_admin.navigation.build_sidebar_navigation",
        },
    }

    if overrides:
        return _deep_merge(config, overrides)

    return config
