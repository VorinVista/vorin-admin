from __future__ import annotations

from django import forms
from django.apps import apps
from django.contrib.auth import get_user_model

from vorin_admin.models import VorinUserSettings

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
    avatar_library_image = forms.ModelChoiceField(
        queryset=User.objects.none(),
        required=False,
        label="Media library",
        help_text="Use an existing image from the Wagtail media library without uploading a duplicate file.",
    )

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
        self._avatar_upload_field_name = self.add_prefix("avatar")

        for name, field in self.fields.items():
            if name == "bio":
                continue

            field.widget.attrs.setdefault("placeholder", field.label)
            _merge_classes(field.widget, "vorin-input")

        self.fields["avatar"].widget.attrs["data-vorin-file-enhanced"] = "1"
        self.fields["avatar"].widget.attrs["data-venuex-enhanced"] = "true"

        image_model = self._wagtail_image_model()
        if image_model:
            self.fields["avatar_library_image"].queryset = image_model.objects.order_by("-created_at")
            self.fields["avatar_library_image"].widget.attrs["class"] = "vorin-input"
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

    def save(self, commit=True):
        user_settings = super().save(commit=commit)
        library_image = self.cleaned_data.get("avatar_library_image")
        uploaded_avatar = bool(self.files.get(self._avatar_upload_field_name))

        if commit and library_image and not uploaded_avatar:
            user_settings.avatar.name = library_image.file.name
            user_settings.save(update_fields=["avatar", "updated_at"])

        return user_settings
