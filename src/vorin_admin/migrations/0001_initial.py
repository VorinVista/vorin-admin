from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="VorinUserSettings",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "avatar",
                    models.ImageField(
                        blank=True,
                        null=True,
                        upload_to="vorin_admin/avatars/",
                    ),
                ),
                ("job_title", models.CharField(blank=True, max_length=120)),
                ("phone", models.CharField(blank=True, max_length=40)),
                ("bio", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="vorin_admin_settings",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Admin user settings",
                "verbose_name_plural": "Admin user settings",
            },
        ),
    ]
