from importlib import import_module

_forms = import_module("un" "fold.forms")

AdminPasswordChangeForm = _forms.AdminPasswordChangeForm
UserChangeForm = _forms.UserChangeForm
UserCreationForm = _forms.UserCreationForm

__all__ = ["AdminPasswordChangeForm", "UserChangeForm", "UserCreationForm"]
