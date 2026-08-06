from __future__ import annotations

from urllib.parse import urlparse

from django import forms
from django.contrib.admin.widgets import AdminDateWidget, AdminTimeWidget
from django.utils.html import format_html


def merge_widget_classes(widget: forms.Widget, *classes: str) -> None:
    current = widget.attrs.get("class", "")
    merged = " ".join(filter(None, [current, *classes])).strip()
    widget.attrs["class"] = merged


def configure_slug_field(
    form: type[forms.ModelForm] | forms.ModelForm,
    *,
    slug_field: str = "slug",
    source_field: str,
    label: str = "URL handle",
    help_text: str = "Auto-created from the title above. You can tweak it if needed.",
) -> None:
    fields = form.fields if hasattr(form, "fields") else form.base_fields
    slug = fields.get(slug_field)
    source = fields.get(source_field)

    if not slug:
        return

    slug.label = label
    slug.help_text = help_text
    slug.required = False
    slug.widget = forms.TextInput(attrs=getattr(slug.widget, "attrs", {}))
    merge_widget_classes(slug.widget, "vTextField", "vorin-admin-slug-input")
    slug.widget.attrs["placeholder"] = "Auto-created from the title above"
    slug.widget.attrs["data-vorin-slug-source"] = source_field

    if source:
        source.widget.attrs["data-vorin-slug-source-for"] = slug_field


def configure_boolean_field(
    form: type[forms.ModelForm] | forms.ModelForm,
    field_name: str,
    *,
    label: str,
    help_text: str = "",
) -> None:
    fields = form.fields if hasattr(form, "fields") else form.base_fields
    field = fields.get(field_name)

    if not field:
        return

    field.label = label
    field.help_text = help_text
    merge_widget_classes(field.widget, "vorin-switch-input")


def configure_plain_url_field(
    form: type[forms.ModelForm] | forms.ModelForm,
    field_name: str,
    *,
    label: str,
    help_text: str,
    placeholder: str = "https://",
) -> None:
    fields = form.fields if hasattr(form, "fields") else form.base_fields
    field = fields.get(field_name)

    if not field:
        return

    attrs = dict(getattr(field.widget, "attrs", {}))
    attrs.setdefault("placeholder", placeholder)
    field.widget = forms.URLInput(attrs=attrs)
    merge_widget_classes(field.widget, "vURLField", "vorin-admin-url-input")
    field.label = label
    field.help_text = help_text


def configure_admin_date_field(
    form: type[forms.ModelForm] | forms.ModelForm,
    field_name: str,
    *,
    label: str | None = None,
    help_text: str | None = None,
    placeholder: str = "Choose the date",
) -> None:
    fields = form.fields if hasattr(form, "fields") else form.base_fields
    field = fields.get(field_name)

    if not field:
        return

    attrs = dict(getattr(field.widget, "attrs", {}))
    attrs.setdefault("autocomplete", "off")
    attrs.setdefault("placeholder", placeholder)
    attrs.setdefault("size", "10")
    field.widget = AdminDateWidget(attrs=attrs, format="%d/%m/%Y")
    merge_widget_classes(
        field.widget,
        "vDateField",
        "vorin-admin-picker-input",
        "vorin-admin-picker-input--date",
    )

    if label:
        field.label = label

    if help_text is not None:
        field.help_text = help_text


def configure_admin_time_field(
    form: type[forms.ModelForm] | forms.ModelForm,
    field_name: str,
    *,
    label: str | None = None,
    help_text: str | None = None,
    placeholder: str = "Choose the time",
) -> None:
    fields = form.fields if hasattr(form, "fields") else form.base_fields
    field = fields.get(field_name)

    if not field:
        return

    attrs = dict(getattr(field.widget, "attrs", {}))
    attrs.setdefault("autocomplete", "off")
    attrs.setdefault("placeholder", placeholder)
    attrs.setdefault("size", "8")
    field.widget = AdminTimeWidget(attrs=attrs, format="%H:%M:%S")
    merge_widget_classes(
        field.widget,
        "vTimeField",
        "vorin-admin-picker-input",
        "vorin-admin-picker-input--time",
    )

    if label:
        field.label = label

    if help_text is not None:
        field.help_text = help_text


def render_image_preview(url: str, *, title: str, empty_text: str) -> str:
    if not url:
        return format_html(
            '<div class="vorin-admin-media-card vorin-admin-media-card--empty">'
            '<div class="vorin-admin-media-card__copy">'
            '<span class="vorin-admin-media-card__eyebrow">{}</span>'
            '<strong>No image selected yet</strong>'
            '<p>{}</p>'
            "</div>"
            "</div>",
            title,
            empty_text,
        )

    hostname = urlparse(url).netloc or "Local asset"
    return format_html(
        '<a class="vorin-admin-media-card" href="{}" target="_blank" rel="noreferrer">'
        '<div class="vorin-admin-media-card__frame">'
        '<img src="{}" alt="{} preview" loading="lazy">'
        '<div class="vorin-admin-media-card__fallback" aria-hidden="true">'
        '<span class="material-symbols-outlined">image_not_supported</span>'
        '<span>Preview unavailable</span>'
        "</div>"
        "</div>"
        '<div class="vorin-admin-media-card__copy">'
        '<span class="vorin-admin-media-card__eyebrow">{}</span>'
        '<strong>Open full image</strong>'
        '<span class="vorin-admin-media-card__meta">{}</span>'
        "</div>"
        "</a>",
        url,
        url,
        title,
        title,
        hostname,
    )
