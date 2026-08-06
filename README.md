## VorinPanel

Reusable Django admin foundation for VorinVista projects.

The current theme layer is aligned to the real VorinVista parent project
branding from `Exxotelis/VorinDjango`, using its orange/navy palette and logo
direction instead of a generic dashboard skin.

### What this repo gives you

- A reusable Django app: `vorin_admin`
- Opinionated VorinPanel configuration with VorinVista branding
- Base admin classes like `VorinModelAdmin`
- A branded login screen, footer, dashboard, sidebar shortcuts, and theme assets
- An `example_project/` you can run locally and copy from for future projects

### Local setup

```bash
uv sync
uv run --project . python example_project/manage.py migrate
uv run --project . python example_project/manage.py createsuperuser
uv run --project . python example_project/manage.py runserver
```

Admin URL:

```text
http://127.0.0.1:8000/admin/
```

### Reusing in a new Django project

Install from a Git repository:

```bash
uv add "vorin-admin @ git+ssh://git@github.com/VorinVista/vorin-admin.git@v0.1.0"
```

Then in your `settings.py`:

```python
from vorin_admin.config import build_vorin_settings
from vorin_admin.settings import build_vorin_apps

VORIN_PANEL = {
    "site_title": "Client Control Room",
    "site_header": "VorinPanel",
    "site_subheader": "Powered by VorinVista",
    "site_url": "https://example.com",
    "support_url": "mailto:support@vorinvista.com",
    "support_email": "support@vorinvista.com",
    "modules": {
        "content": True,
        "blog": True,
        "seo": True,
        "analytics": True,
        "enquiries": True,
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

- This repo targets `Python 3.12` and `Django 5.2`.
- The package is meant to standardize the first 80-90% of every admin build.
