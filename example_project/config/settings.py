from pathlib import Path

from django_vorin.settings import install_vorin_config
from vorin_admin.config import build_vorin_settings
from vorin_admin.settings import build_vorin_apps

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = "vorin-panel-demo-secret-key"
DEBUG = True
ALLOWED_HOSTS = ["127.0.0.1", "localhost", "testserver"]

VORIN_PANEL = {
    "site_title": "VorinPanel Demo",
    "site_header": "VorinPanel",
    "site_subheader": "VorinVista Control System",
    "site_version": "demo",
    "dashboard_title": "VorinPanel Dashboard",
    "site_url": "https://vorinvista.com",
    "account_settings_path": "/admin/account/settings/",
    "support_url": "mailto:support@vorinvista.com",
    "support_email": "support@vorinvista.com",
    "welcome_title": "VorinVista Admin Foundation",
    "welcome_message": (
        "This demo shows VorinPanel styled from the real VorinVista parent "
        "project, using its logo system and orange-and-navy visual language."
    ),
    "modules": {
        "content": True,
        "blog": True,
        "seo": True,
        "analytics": True,
        "enquiries": True,
        "media": True,
        "clients": True,
    },
    "sidebar_links": [
        {
            "title": "Showcase models",
            "icon": "database",
            "link": "/admin/",
        }
    ],
}

INSTALLED_APPS = build_vorin_apps(project_apps=["showcase"])
VORIN = build_vorin_settings(VORIN_PANEL)
install_vorin_config(globals(), VORIN)

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "en-gb"
TIME_ZONE = "Europe/London"

USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

LOGIN_REDIRECT_URL = "/admin/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
