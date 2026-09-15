from __future__ import annotations

from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.exceptions import ObjectDoesNotExist


def get_user_settings(user):
    if not getattr(user, "is_authenticated", False):
        return None

    try:
        return user.vorin_admin_settings
    except ObjectDoesNotExist:
        return None


def get_or_create_user_settings(user):
    from vorin_admin.models import VorinUserSettings

    settings, _ = VorinUserSettings.objects.get_or_create(user=user)
    return settings


def _field_name(field_file) -> str:
    return getattr(field_file, "name", "") or ""


def _copy_field_file(source, target) -> bool:
    source_name = _field_name(source)
    if not source_name:
        return False

    filename = Path(source_name).name
    source.open("rb")
    try:
        target.save(filename, ContentFile(source.read()), save=False)
    finally:
        source.close()
    return True


def _save_fields(instance, fields: list[str]) -> None:
    try:
        instance.save(update_fields=fields)
    except ValueError:
        instance.save()


def sync_vorin_settings_to_wagtail_profile(user_settings, *, clear: bool = False):
    try:
        from wagtail.users.models import UserProfile
    except ImportError:
        return None

    profile = UserProfile.get_for_user(user_settings.user)

    if clear or not _field_name(user_settings.avatar):
        if _field_name(profile.avatar):
            profile.avatar = ""
            _save_fields(profile, ["avatar"])
        return profile

    if _copy_field_file(user_settings.avatar, profile.avatar):
        _save_fields(profile, ["avatar"])

    return profile


def sync_wagtail_profile_to_vorin_settings(profile, *, clear: bool = False):
    user_settings = get_or_create_user_settings(profile.user)

    if clear or not _field_name(profile.avatar):
        if _field_name(user_settings.avatar):
            user_settings.avatar = None
            _save_fields(user_settings, ["avatar", "updated_at"])
        return user_settings

    if _copy_field_file(profile.avatar, user_settings.avatar):
        _save_fields(user_settings, ["avatar", "updated_at"])

    return user_settings


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
