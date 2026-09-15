from __future__ import annotations

from django import forms
from django.contrib.auth import get_user_model

from vorin_admin.models import VorinUserSettings
from vorin_admin.profiles import sync_vorin_settings_to_wagtail_profile

User = get_user_model()


def _merge_classes(widget: forms.Widget, classes: str) -> None:
    current = widget.attrs.get("class", "")
    widget.attrs["class"] = f"{current} {classes}".strip()


class VorinAccountUserForm(forms.ModelForm):
    username = forms.CharField(disabled=True, required=False)

    class Meta:
        model = User
        fields = ("username", "first_name", "last_name", "email")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        for name, field in self.fields.items():
            field.widget.attrs.setdefault("placeholder", field.label)
            _merge_classes(field.widget, "vorin-input")

            if name == "username":
                field.initial = self.instance.get_username()


class VorinUserSettingsForm(forms.ModelForm):
    class Meta:
        model = VorinUserSettings
        fields = ("avatar", "job_title", "phone", "bio")
        widgets = {
            "avatar": forms.ClearableFileInput(
                attrs={
                    "accept": "image/*",
                    "class": "vorin-file",
                }
            ),
            "bio": forms.Textarea(
                attrs={
                    "rows": 4,
                    "class": "vorin-textarea",
                    "placeholder": "A short internal profile note for this operator.",
                }
            ),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._original_avatar_name = getattr(self.instance.avatar, "name", "") or ""

        for name, field in self.fields.items():
            if name == "bio":
                continue

            field.widget.attrs.setdefault("placeholder", field.label)
            _merge_classes(field.widget, "vorin-input")

        self.fields["avatar"].widget.attrs["data-vorin-file-enhanced"] = "1"

    def save(self, commit=True):
        user_settings = super().save(commit=commit)

        if commit:
            avatar_name = getattr(user_settings.avatar, "name", "") or ""
            if avatar_name != self._original_avatar_name:
                sync_vorin_settings_to_wagtail_profile(
                    user_settings,
                    clear=not avatar_name,
                )

        return user_settings
