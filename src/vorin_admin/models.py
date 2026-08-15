from __future__ import annotations

from django.conf import settings
from django.db import models


class VorinUserSettings(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="vorin_admin_settings",
    )
    avatar = models.ImageField(
        upload_to="vorin_admin/avatars/",
        blank=True,
        null=True,
    )
    job_title = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    bio = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Admin user settings"
        verbose_name_plural = "Admin user settings"

    def __str__(self) -> str:
        return f"{self.user} admin settings"
