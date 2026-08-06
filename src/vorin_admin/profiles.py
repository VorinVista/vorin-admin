from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist


def get_user_settings(user):
    if not getattr(user, "is_authenticated", False):
        return None

    try:
        return user.vorin_panel_settings
    except ObjectDoesNotExist:
        return None


def get_or_create_user_settings(user):
    from vorin_admin.models import VorinUserSettings

    settings, _ = VorinUserSettings.objects.get_or_create(user=user)
    return settings


def _avatar_url(user) -> str | None:
    settings = get_user_settings(user)

    if settings and settings.avatar:
        return settings.avatar.url

    return None


def _role_label(user) -> str:
    settings = get_user_settings(user)

    if settings and settings.job_title:
        return settings.job_title

    if getattr(user, "is_superuser", False):
        return "Administrator"

    if getattr(user, "is_staff", False):
        return "Staff user"

    return "User"


def patch_user_model() -> None:
    user_model = get_user_model()

    if not hasattr(user_model, "avatar_url"):
        user_model.avatar_url = property(_avatar_url)

    if not hasattr(user_model, "vorin_role_label"):
        user_model.vorin_role_label = property(_role_label)
