from django.contrib import admin
from django.utils import timezone

from showcase.models import Article, Category, Inquiry
from vorin_admin.admin import VorinModelAdmin
from vorin_admin.decorators import action


@action(description="Mark selected inquiries as qualified", icon="verified")
def mark_as_qualified(modeladmin, request, queryset):
    queryset.update(status=Inquiry.Status.QUALIFIED)


@action(description="Publish selected articles", icon="publish")
def publish_articles(modeladmin, request, queryset):
    queryset.update(
        status=Article.Status.PUBLISHED,
        published_at=timezone.now(),
    )


@admin.register(Category)
class CategoryAdmin(VorinModelAdmin):
    list_display = ("name", "is_featured", "updated_at")
    search_fields = ("name",)
    list_filter = ("is_featured",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Article)
class ArticleAdmin(VorinModelAdmin):
    actions = [publish_articles, *VorinModelAdmin.actions]
    list_display = ("title", "status", "category", "featured", "updated_at")
    list_filter = ("status", "featured", "category")
    search_fields = ("title", "excerpt", "body")
    autocomplete_fields = ("category",)
    prepopulated_fields = {"slug": ("title",)}
    fieldsets = (
        ("Editorial", {"fields": ("title", "slug", "status", "category"), "classes": ("tab",)}),
        ("Publishing", {"fields": ("featured", "published_at"), "classes": ("tab",)}),
        ("Content", {"fields": ("excerpt", "body"), "classes": ("tab",)}),
    )


@admin.register(Inquiry)
class InquiryAdmin(VorinModelAdmin):
    actions = [mark_as_qualified, *VorinModelAdmin.actions]
    list_display = ("name", "company", "email", "status", "source", "created_at")
    list_filter = ("status", "source", "created_at")
    search_fields = ("name", "company", "email", "notes")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("Contact", {"fields": ("name", "email", "company"), "classes": ("tab",)}),
        ("Pipeline", {"fields": ("status", "source"), "classes": ("tab",)}),
        ("Notes", {"fields": ("notes", "created_at", "updated_at"), "classes": ("tab",)}),
    )
