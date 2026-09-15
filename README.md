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

### Inline action buttons

Use `.vorin-admin-action` for inline admin actions. Legacy modifiers such as
`--primary`, `--success`, `--info` and `--accent` follow the active button theme;
they do not introduce separate gradients. `--ghost` remains an outline action.
Filled action links preserve their text colour and remove link underlines in
normal, visited, hover and focus states. Keyboard focus has a visible outline.
Use `--ghost` for secondary inline actions so one row has a clear primary action.

Projects can supply `--vorin-action-bg`, `--vorin-action-hover-bg`,
`--vorin-action-fg` and `--vorin-action-radius`. Otherwise the package uses
Django's `--button-bg`, `--button-hover-bg` and `--button-fg`. Keep project brand
values in the consuming project's stylesheet, and maintain the behavior here.

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
pip install dist/vorin_admin-0.2.0-py3-none-any.whl
```

Or install directly from a Git repository:

```bash
pip install "vorin-admin @ git+ssh://git@github.com/your-org/vorin-admin.git@v0.2.0"
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
            "app_label": "your_app",
            "include_models": ["Project", "Task"],
        },
        {
            "slug": "content",
            "label": "Content",
            "icon": "menu_book",
            "description": "Editorial tools outside Django admin.",
            "children": [
                {"title": "Studio", "link": "/studio/"},
                {"title": "Images", "link": "/studio/images/"},
            ],
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

Modules with an `app_label` automatically become expandable sidebar categories using the models the current user can access. Use `include_models` to choose and order their children, or `exclude_models` to hide internal audit models. Use `children` for grouped links to external workspaces. The most specific matching child is marked active, including links that share a path but use different query parameters.

Project-specific dashboards should live in the consuming project, not in this package:

```python
VORIN = build_vorin_settings(
    VORIN_PANEL,
    overrides={
        "DASHBOARD_CALLBACK": "your_project.admin_dashboard.dashboard_callback",
    },
)
install_vorin_config(globals(), VORIN)
```

### Upstream improvement workflow

Treat a fix as package-level when it applies to ordinary Django admin controls or layout. Add it here with a regression test, then update each consuming project to the tested commit SHA. Keep client branding, business models and dashboard metrics in the consuming project.

The included `notify-boring.yml` workflow sends the published commit SHA to Boring. Boring validates that SHA, updates its pinned requirement, runs its full backend suite and opens an update pull request. This keeps production reproducible and prevents an untested package push from deploying automatically.

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
