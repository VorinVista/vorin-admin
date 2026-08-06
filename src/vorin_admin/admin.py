from __future__ import annotations

import csv
from datetime import datetime

from django.contrib import admin
from django.contrib.admin.sites import NotRegistered
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import Group, User
from django.http import HttpRequest, HttpResponse

from django_vorin.admin import ModelAdmin, StackedInline, TabularInline
from django_vorin.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm
from vorin_admin.models import VorinUserSettings


def export_selected_to_csv(modeladmin, request: HttpRequest, queryset):
    response = HttpResponse(content_type="text/csv")
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    response["Content-Disposition"] = (
        f'attachment; filename="{queryset.model._meta.model_name}-{timestamp}.csv"'
    )

    writer = csv.writer(response)
    fields = [field.name for field in queryset.model._meta.fields]

    writer.writerow(fields)

    for obj in queryset:
        writer.writerow([getattr(obj, field) for field in fields])

    return response


export_selected_to_csv.short_description = "Export selected rows to CSV"


class VorinModelAdmin(ModelAdmin):
    list_per_page = 30
    compressed_fields = True
    warn_unsaved_form = True
    show_add_link = True
    list_filter_submit = True
    actions = [export_selected_to_csv]


class VorinTabularInline(TabularInline):
    extra = 0
    tab = True


class VorinStackedInline(StackedInline):
    extra = 0
    tab = True


class VorinUserSettingsInline(VorinStackedInline):
    model = VorinUserSettings
    can_delete = False
    extra = 0
    max_num = 1
    verbose_name_plural = "Vorin panel settings"
    fields = ("avatar", "job_title", "phone", "bio")


try:
    admin.site.unregister(User)
except NotRegistered:
    pass


try:
    admin.site.unregister(Group)
except NotRegistered:
    pass


@admin.register(User)
class VorinUserAdmin(BaseUserAdmin, ModelAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm
    list_display = ("username", "email", "first_name", "last_name", "is_staff")
    search_fields = ("username", "email", "first_name", "last_name")
    compressed_fields = True
    warn_unsaved_form = True
    inlines = [VorinUserSettingsInline]


@admin.register(Group)
class VorinGroupAdmin(BaseGroupAdmin, ModelAdmin):
    search_fields = ("name",)
    compressed_fields = True
