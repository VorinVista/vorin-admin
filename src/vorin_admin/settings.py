from collections.abc import Iterable

from django_vorin.settings import CORE_APPS


def build_vorin_apps(
    project_apps: Iterable[str] | None = None,
    extra_vorin_apps: Iterable[str] | None = None,
) -> list[str]:
    apps = [
        "vorin_admin",
        *CORE_APPS,
    ]

    if extra_vorin_apps:
        apps.extend(extra_vorin_apps)

    apps.extend(
        [
            "django.contrib.admin",
            "django.contrib.auth",
            "django.contrib.contenttypes",
            "django.contrib.sessions",
            "django.contrib.messages",
            "django.contrib.staticfiles",
        ]
    )

    if project_apps:
        apps.extend(project_apps)

    unique_apps: list[str] = []

    for app in apps:
        if app not in unique_apps:
            unique_apps.append(app)

    return unique_apps
