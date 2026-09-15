from __future__ import annotations

from django import forms
from django.apps import apps
from django.contrib.auth import get_user_model

from vorin_admin.profiles import (
    get_or_create_user_settings,
    sync_vorin_settings_to_wagtail_profile,
)


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
        avatar_library_image = forms.ModelChoiceField(
            queryset=get_user_model().objects.none(),
            required=False,
            label="Media library",
        )

        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._vorin_original_avatar_name = getattr(self.instance.avatar, "name", "") or ""
            self.fields["avatar"].widget.attrs.update(
                {
                    "data-vorin-file-enhanced": "1",
                    "data-venuex-file-upload": "true",
                    "data-venuex-enhanced": "true",
                }
            )
            image_model = self._wagtail_image_model()
            if image_model:
                self.fields["avatar_library_image"].queryset = image_model.objects.order_by("-created_at")
            else:
                self.fields.pop("avatar_library_image", None)

        @staticmethod
        def _wagtail_image_model():
            if not apps.is_installed("wagtail.images"):
                return None

            try:
                from wagtail.images import get_image_model
            except ImportError:
                return None

            return get_image_model()

        def _clear_requested(self) -> bool:
            return bool(
                self.is_bound
                and self.prefix
                and self.data.get(f"{self.prefix}-avatar-clear")
            )

        def save(self, commit=True):
            profile = self.instance

            if commit:
                user_settings = get_or_create_user_settings(profile.user)
                library_image = self.cleaned_data.get("avatar_library_image")
                uploaded_avatar = self.files.get(self.add_prefix("avatar"))

                if uploaded_avatar:
                    avatar_file = self.cleaned_data.get("avatar")
                    user_settings.avatar.save(avatar_file.name, avatar_file, save=True)
                elif library_image:
                    user_settings.avatar.name = library_image.file.name
                    user_settings.save(update_fields=["avatar", "updated_at"])

                avatar_name = getattr(user_settings.avatar, "name", "") or ""
                if uploaded_avatar or library_image:
                    sync_vorin_settings_to_wagtail_profile(user_settings, clear=not avatar_name)

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
