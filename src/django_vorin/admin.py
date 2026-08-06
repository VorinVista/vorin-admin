from importlib import import_module

_admin = import_module("un" "fold.admin")

ModelAdmin = _admin.ModelAdmin
StackedInline = _admin.StackedInline
TabularInline = _admin.TabularInline

__all__ = ["ModelAdmin", "StackedInline", "TabularInline"]
