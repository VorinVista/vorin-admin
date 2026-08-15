from __future__ import annotations

from collections.abc import Callable
from copy import deepcopy
from pathlib import Path
from typing import Any

from django.conf import settings
from django.templatetags.static import static
from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _

PermissionHook = Callable[[Any], bool]

DEFAULT_PANEL_SETTINGS: dict[str, Any] = {
    "site_title": "Admin",
    "site_header": "Admin",
    "site_subheader": "Operations workspace",
    "site_version": "1.0",
    "site_url": None,
    "site_symbol": "space_dashboard",
    "account_settings_path": None,
    "support_url": None,
    "support_email": "",
    "footer_text": "made with",
    "footer_note": "",
    "footer_brand_name": "VorinVista",
    "footer_brand_url": "https://vorinvista.com/",
    "dashboard_title": "Admin dashboard",
    "login_message": "Sign in to continue to your admin workspace.",
    "welcome_title": "Reusable admin engine",
    "welcome_message": "A configurable foundation for admin layout, navigation, profile tools, and module registration across Django projects.",
    "show_search": True,
    "show_history": True,
    "show_view_on_site": True,
    "show_all_applications": True,
    "show_theme_switch": True,
    "show_language_switch": False,
    "show_notifications": False,
    "command_search_models": True,
    "environment": {
        "label": "",
        "color": "info",
    },
    "branding": {
        "logo": {
            "light": "vorin_admin/branding/logo-light.svg",
            "dark": "vorin_admin/branding/logo-dark.svg",
        },
        "icon": {
            "light": "vorin_admin/branding/icon-light.svg",
            "dark": "vorin_admin/branding/icon-dark.svg",
        },
        "favicon": "vorin_admin/branding/favicon.png",
        "login_visual": "vorin_admin/branding/login-visual.svg",
    },
    "module_registry": [],
    "dropdown_links": [],
    "account_links": [],
    "sidebar_links": [],
    "footer_links": [],
    "permission_hooks": {},
}

DEFAULT_COLORS = {
    "base": {
        "50": "#f8fafc",
        "100": "#f1f5f9",
        "200": "#e2e8f0",
        "300": "#cbd5e1",
        "400": "#94a3b8",
        "500": "#64748b",
        "600": "#475569",
        "700": "#334155",
        "800": "#1e293b",
        "900": "#0f172a",
        "950": "#020617",
    },
    "primary": {
        "50": "#f5f7ff",
        "100": "#e8ecff",
        "200": "#d3dcff",
        "300": "#b2c0ff",
        "400": "#869dff",
        "500": "#5c78f2",
        "600": "#455fd6",
        "700": "#374da9",
        "800": "#2f4286",
        "900": "#2b3a6c",
        "950": "#1a2344",
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


def _normalize_module_item(entry: dict[str, Any], *, slug: str | None = None) -> dict[str, Any]:
    raw_slug = slug or entry.get("slug") or entry.get("key") or "module"
    label = entry.get("label") or raw_slug.replace("_", " ").replace("-", " ").title()

    return {
        "slug": raw_slug,
        "label": label,
        "icon": entry.get("icon", "widgets"),
        "description": entry.get("description", ""),
        "link": entry.get("link"),
        "enabled": entry.get("enabled", True),
        "permission": entry.get("permission"),
    }


def _normalize_module_registry(modules: Any) -> list[dict[str, Any]]:
    if not modules:
        return []

    normalized: list[dict[str, Any]] = []

    if isinstance(modules, dict):
        for slug, enabled in modules.items():
            normalized.append(
                _normalize_module_item(
                    {
                        "enabled": bool(enabled),
                    },
                    slug=slug,
                )
            )
        return normalized

    if isinstance(modules, list):
        for entry in modules:
            if isinstance(entry, str):
                normalized.append(_normalize_module_item({}, slug=entry))
                continue

            if isinstance(entry, dict):
                normalized.append(_normalize_module_item(entry))

    return normalized


def get_panel_settings(panel_settings: dict[str, Any] | None = None) -> dict[str, Any]:
    if panel_settings is None:
        panel_settings = getattr(settings, "VORIN_PANEL", {})

    merged = _deep_merge(DEFAULT_PANEL_SETTINGS, panel_settings)
    module_source = merged.get("module_registry")

    if not module_source and panel_settings.get("modules"):
        module_source = panel_settings["modules"]

    merged["module_registry"] = _normalize_module_registry(module_source)
    merged["enabled_modules"] = get_enabled_modules(merged)
    return merged


def get_enabled_modules(
    panel_settings: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    panel = panel_settings if panel_settings is not None else get_panel_settings()
    enabled: list[dict[str, Any]] = []

    for module in panel.get("module_registry", []):
        if not module.get("enabled", True):
            continue
        enabled.append(module)

    return enabled


def resolve_permission_hook(
    request,
    hook_name: str,
    *,
    panel_settings: dict[str, Any] | None = None,
    default: bool = True,
) -> bool:
    panel = panel_settings if panel_settings is not None else get_panel_settings()
    hooks = panel.get("permission_hooks") or {}
    hook = hooks.get(hook_name)

    if hook is None:
        return default

    if isinstance(hook, bool):
        return hook

    if callable(hook):
        return bool(hook(request))

    return default


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
                "title": _("Support channel"),
                "link": panel_settings["support_url"],
            }
        )

    items.extend(panel_settings.get("dropdown_links", []))
    return items


def build_account_links(panel_settings: dict[str, Any]) -> list[dict[str, Any]]:
    links: list[dict[str, Any]] = []
    links.extend(panel_settings.get("account_links", []))
    return links


def build_vorin_settings(
    panel_settings: dict[str, Any] | None = None,
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    panel = get_panel_settings(panel_settings)
    branding = panel["branding"]

    config: dict[str, Any] = {
        "SITE_TITLE": panel["site_title"],
        "SITE_HEADER": panel["site_header"],
        "SITE_SUBHEADER": panel["site_subheader"],
        "SITE_VERSION": panel["site_version"],
        "SITE_URL": panel["site_url"],
        "SITE_SYMBOL": panel["site_symbol"],
        "SITE_DROPDOWN": build_site_dropdown(panel),
        "SITE_LOGO": {
            "light": lambda request: static(branding["logo"]["light"]),
            "dark": lambda request: static(branding["logo"]["dark"]),
        },
        "SITE_ICON": {
            "light": lambda request: static(branding["icon"]["light"]),
            "dark": lambda request: static(branding["icon"]["dark"]),
        },
        "SITE_FAVICONS": [
            {
                "rel": "icon",
                "type": "image/png",
                "href": lambda request: static(branding["favicon"]),
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
            "image": lambda request: static(branding["login_visual"]),
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
