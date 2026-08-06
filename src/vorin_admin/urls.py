from django.urls import path

from vorin_admin.views import account_settings_view, settings_hub_view

app_name = "vorin_admin"

urlpatterns = [
    path("control/", settings_hub_view, name="settings_hub"),
    path("settings/", account_settings_view, name="account_settings"),
]
