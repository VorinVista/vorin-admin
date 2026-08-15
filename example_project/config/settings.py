from pathlib import Path

from vorin_admin.config import build_vorin_settings
from vorin_admin.settings import build_vorin_apps, install_vorin_config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = "vorin-panel-demo-secret-key"
DEBUG = True
ALLOWED_HOSTS = ["127.0.0.1", "localhost", "testserver"]

VORIN_PANEL = {
    "site_title": "Vorin Admin",
    "site_header": "Vorin Admin",
    "site_subheader": "Reusable admin workspace",
    "site_version": "",
    "dashboard_title": "Vorin Admin Dashboard",
    "site_url": None,
    "support_url": None,
    "support_email": "",
    "welcome_title": "Reusable admin foundation",
    "welcome_message": (
        "This demo shows the package running as a generic Django admin engine "
        "with configurable modules, navigation, and workspace defaults."
    ),
    "module_registry": [
        {
            "slug": "catalog",
            "label": "Catalog",
            "icon": "inventory_2",
            "description": "Structured content and inventory workflows.",
        },
        {
            "slug": "support",
            "label": "Support",
            "icon": "support_agent",
            "description": "Customer or internal support operations.",
        },
        {
            "slug": "reporting",
            "label": "Reporting",
            "icon": "monitoring",
            "description": "Reporting and admin visibility.",
        },
    ],
    "sidebar_links": [],
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
