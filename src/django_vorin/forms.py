from django.contrib.auth.forms import (
    AdminPasswordChangeForm,
    AdminUserCreationForm,
    UserChangeForm,
)

UserCreationForm = AdminUserCreationForm

__all__ = ["AdminPasswordChangeForm", "UserChangeForm", "UserCreationForm"]
