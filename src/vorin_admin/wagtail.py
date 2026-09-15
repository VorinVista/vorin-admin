from __future__ import annotations

from django import forms
from django.apps import apps

from vorin_admin.profiles import sync_wagtail_profile_to_vorin_settings


def install_wagtail_account_integration() -> bool:
    if not apps.is_installed("wagtail.admin") or not apps.is_installed("wagtail.users"):
        return False

    try:
        from wagtail.admin.forms.account import (
            AvatarPreferencesForm,
            LocalePreferencesForm,
        )
        from wagtail.admin.views import account as account_views
    except ImportError:
        return False

    if getattr(account_views.AvatarSettingsPanel, "_vorin_admin_patched", False):
        return True

    class VorinWagtailAvatarPreferencesForm(AvatarPreferencesForm):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._vorin_original_avatar_name = getattr(self.instance.avatar, "name", "") or ""
            self.fields["avatar"].widget.attrs.update(
                {
                    "data-vorin-file-enhanced": "1",
                    "data-venuex-file-upload": "true",
                }
            )

        def _clear_requested(self) -> bool:
            return bool(
                self.is_bound
                and self.prefix
                and self.data.get(f"{self.prefix}-avatar-clear")
            )

        def save(self, commit=True):
            profile = super().save(commit=commit)

            if commit:
                avatar_name = getattr(profile.avatar, "name", "") or ""
                should_sync = self._clear_requested() or avatar_name != self._vorin_original_avatar_name
                if should_sync:
                    sync_wagtail_profile_to_vorin_settings(
                        profile,
                        clear=self._clear_requested() or not avatar_name,
                    )

            return profile

    class VorinBrowserTimeZoneLocalePreferencesForm(LocalePreferencesForm):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)

            field = self.fields.get("current_time_zone")
            if field:
                field.label = ""
                field.help_text = ""
                field.widget = forms.HiddenInput(
                    attrs={
                        "data-vorin-browser-time-zone": "true",
                    }
                )

        def clean_current_time_zone(self):
            value = self.cleaned_data.get("current_time_zone") or ""
            field = self.fields.get("current_time_zone")
            allowed_values = {choice[0] for choice in field.choices} if field else set()

            if value in allowed_values:
                return value

            return getattr(self.instance, "current_time_zone", "") or ""

    account_views.AvatarSettingsPanel.form_class = VorinWagtailAvatarPreferencesForm
    account_views.LocaleSettingsPanel.form_class = VorinBrowserTimeZoneLocalePreferencesForm
    account_views.AvatarSettingsPanel._vorin_admin_patched = True
    account_views.LocaleSettingsPanel._vorin_admin_patched = True
    return True
