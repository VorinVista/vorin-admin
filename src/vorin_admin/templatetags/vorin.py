from django import template
from django.template import Context
from django.urls import reverse
from django.utils.html import format_html

from vorin_admin.config import versioned_static as build_versioned_static

register = template.Library()


@register.simple_tag
def element_classes(_element_name: str) -> str:
    return ""


@register.simple_tag
def tab_list(*_args, **_kwargs) -> str:
    return ""


@register.simple_tag
def versioned_static(path: str) -> str:
    return build_versioned_static(path)


@register.simple_tag(takes_context=True)
def action_list(context: Context) -> str:
    request = context.get("request")

    if request is None or not getattr(request.user, "is_staff", False):
        return ""

    return format_html(
        '<div class="vorin-admin-action-row">'
        '<a class="vorin-admin-action vorin-admin-action--ghost" href="{}">Admin settings</a>'
        '<a class="vorin-admin-action vorin-admin-action--accent" href="{}">Profile</a>'
        "</div>",
        reverse("vorin_admin:settings_hub"),
        reverse("vorin_admin:account_settings"),
    )

__all__ = ["register"]
