from django.apps import AppConfig


class VorinAdminConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "vorin_admin"
    verbose_name = "Vorin Panel"

    def ready(self) -> None:
        from vorin_admin.profiles import patch_user_model

        patch_user_model()
