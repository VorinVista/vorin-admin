## Vorin Admin

Reusable Django admin engine for multi-project use.

This package is designed to provide a configurable admin foundation that can be installed into different Django projects without carrying client-specific branding, URLs, menu structures, or permissions.

### What this repo gives you

- A reusable Django app: `vorin_admin`
- Admin engine defaults for layout, dashboard, login, footer, and shell structure
- Base admin classes like `VorinModelAdmin`
- Navigation system hooks for sidebar, dropdown, footer, and account links
- Module registration through a generic `module_registry`
- Permission hooks for custom visibility and access rules
- A self-contained theme layer that does not depend on `django-unfold`
- An `example_project/` you can run locally and copy from

### Local setup

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -e .
python example_project/manage.py migrate
python example_project/manage.py createsuperuser
python example_project/manage.py runserver
```

Admin URL:

```text
http://127.0.0.1:8000/admin/
```

### Reusing in a new Django project

Install from PyPI once published:

```bash
pip install vorin-admin
```

For local testing before publication, install from a wheel:

```bash
python -m pip install build
python -m build
pip install dist/vorin_admin-0.1.0-py3-none-any.whl
```

Or install directly from a Git repository:

```bash
pip install "vorin-admin @ git+ssh://git@github.com/your-org/vorin-admin.git@v0.1.0"
```

Then in your `settings.py`:

```python
from vorin_admin.config import build_vorin_settings
from vorin_admin.settings import build_vorin_apps, install_vorin_config

VORIN_PANEL = {
    "site_title": "Operations Admin",
    "site_header": "Operations Admin",
    "site_subheader": "Internal workspace",
    "site_url": "https://example.com",
    "support_url": "mailto:ops@example.com",
    "support_email": "ops@example.com",
    "module_registry": [
        {
            "slug": "operations",
            "label": "Operations",
            "icon": "settings",
            "description": "Core operational workflows.",
        },
        {
            "slug": "reporting",
            "label": "Reporting",
            "icon": "monitoring",
            "description": "Dashboards and summaries.",
        },
    ],
    "footer_links": [
        {"title": "Documentation", "link": "https://example.com/docs", "external": True},
    ],
    "permission_hooks": {
        "settings_hub": lambda request: request.user.is_superuser,
    },
}

INSTALLED_APPS = build_vorin_apps(
    project_apps=[
        "your_project.your_app",
    ],
)

VORIN = build_vorin_settings(VORIN_PANEL)
install_vorin_config(globals(), VORIN)
```

In your model admins:

```python
from django.contrib import admin

from vorin_admin.admin import VorinModelAdmin

from .models import Article


@admin.register(Article)
class ArticleAdmin(VorinModelAdmin):
    list_display = ("title", "status", "updated_at")
    search_fields = ("title",)
    list_filter = ("status",)
```

### Notes

- This repo targets `Python 3.11+` and `Django 5.2`.
- The package is intended to standardize the admin shell, not project business logic.
