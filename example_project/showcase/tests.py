from pathlib import Path

from django.contrib.auth import get_user_model
from django.contrib.staticfiles import finders
from django.template.loader import get_template
from django.test import RequestFactory, TestCase, override_settings

from vorin_admin.apps import _configured_callback
from vorin_admin.config import get_panel_settings
from vorin_admin.dashboard import dashboard_callback
from vorin_admin.navigation import _build_module_items, build_sidebar_navigation


def project_dashboard_callback(request, context):
    context["project_dashboard"] = True
    return context


class AdminLayoutStyleTests(TestCase):
    def test_inline_actions_use_the_active_button_theme_without_gradients(self):
        stylesheet = Path(finders.find("vorin_admin/css/vorin_panel.css")).read_text(
            encoding="utf-8"
        )

        self.assertIn("--vorin-action-bg, var(--button-bg", stylesheet)
        self.assertIn("--vorin-action-hover-bg, var(--button-hover-bg", stylesheet)
        self.assertIn(".vorin-admin-action:focus-visible", stylesheet)
        self.assertIn("min-height: 2.3rem;", stylesheet)
        self.assertIn("--vorin-action-ghost-fg", stylesheet)

    def test_questionnaire_builder_controls_have_a_responsive_grid(self):
        stylesheet = Path(finders.find("vorin_admin/css/vorin_panel.css")).read_text(
            encoding="utf-8"
        )

        self.assertIn(".qt-card-fields", stylesheet)
        self.assertIn("grid-template-columns: repeat(2, minmax(0, 1fr));", stylesheet)
        self.assertIn(".qt-control--wide", stylesheet)
        self.assertIn("max-width: none !important;", stylesheet)
        self.assertIn("min-height: 7rem;", stylesheet)
        self.assertIn("@media (max-width: 760px)", stylesheet)
        action_block = stylesheet[
            stylesheet.index(".vorin-admin-action {"):
            stylesheet.index(".vorin-admin-action--ghost {")
        ]
        self.assertNotIn("linear-gradient", action_block)

    def test_change_forms_remove_the_global_history_action(self):
        template_path = Path(
            get_template("admin/change_form_object_tools.html").origin.name
        )
        template = template_path.read_text(encoding="utf-8")

        self.assertIn('class="viewsitelink"', template)
        self.assertNotIn("admin_urlname:'history'", template)
        self.assertNotIn('class="historylink"', template)

    def test_login_password_visibility_control_is_packaged(self):
        stylesheet = Path(
            finders.find("vorin_admin/css/password_visibility.css")
        ).read_text(encoding="utf-8")
        script = Path(
            finders.find("vorin_admin/js/password_visibility.js")
        ).read_text(encoding="utf-8")

        self.assertIn(".vorin-password-toggle", stylesheet)
        self.assertIn('input[type="password"]', script)
        self.assertIn('aria-label", label', script)
        self.assertIn('input.type = isVisible ? "text" : "password"', script)

    def test_change_form_tools_and_panels_do_not_overlap(self):
        stylesheet = Path(finders.find("vorin_admin/css/vorin_panel.css")).read_text(
            encoding="utf-8"
        )

        self.assertIn("display: grid !important;", stylesheet)
        self.assertIn("gap: 1.25rem !important;", stylesheet)
        self.assertIn("position: relative !important;", stylesheet)
        self.assertIn("clear: both;", stylesheet)
        self.assertIn("box-shadow: 0 0 0 1px", stylesheet)
        self.assertIn(
            "border-radius: calc(1.15rem - 1px) calc(1.15rem - 1px) 0 0;",
            stylesheet,
        )

    def test_change_form_save_actions_are_a_reusable_bottom_bar(self):
        stylesheet = Path(finders.find("vorin_admin/css/vorin_panel.css")).read_text(
            encoding="utf-8"
        )
        script = Path(finders.find("vorin_admin/js/vorin_panel.js")).read_text(
            encoding="utf-8"
        )

        self.assertIn("setupVorinStickyActionBar", script)
        self.assertIn("#content-main form .submit-row", script)
        self.assertIn("vorin-sticky-actionbar--duplicate", script)
        self.assertIn("position: fixed;", stylesheet)
        self.assertIn("bottom: max(0.8rem, env(safe-area-inset-bottom));", stylesheet)
        self.assertIn("grid-template-columns: repeat(2, minmax(0, 1fr));", stylesheet)

    def test_rich_editor_scrollbars_are_skinned_inside_the_iframe(self):
        stylesheet = Path(finders.find("vorin_admin/css/vorin_panel.css")).read_text(
            encoding="utf-8"
        )
        script = Path(finders.find("vorin_admin/js/vorin_panel.js")).read_text(
            encoding="utf-8"
        )

        self.assertIn(".tox *::-webkit-scrollbar-thumb", stylesheet)
        self.assertIn("scrollbar-color:", stylesheet)
        self.assertIn("VORIN_RICH_EDITOR_SCROLLBAR_STYLE_ID", script)
        self.assertIn("iframe.tox-edit-area__iframe", script)
        self.assertIn(":root::-webkit-scrollbar-thumb", script)

    def test_bulk_actions_keep_one_native_select_and_bind_once(self):
        stylesheet = Path(finders.find("vorin_admin/css/vorin_panel.css")).read_text(
            encoding="utf-8"
        )
        script = Path(finders.find("vorin_admin/js/vorin_panel.js")).read_text(
            encoding="utf-8"
        )

        self.assertIn('select.name === "action"', script)
        self.assertIn('select.closest(".vorin-bulk-actions")', script)
        self.assertIn('select.dataset.vorinBulkActionBound !== "1"', script)
        self.assertIn('select.dataset.vorinBulkActionBound = "1"', script)
        self.assertIn(
            '.vorin-bulk-actions__field > .select2-container', stylesheet
        )
        self.assertIn(
            '.vorin-bulk-actions__field > select[name="action"]', stylesheet
        )
        self.assertIn('background-position: right 1rem center;', stylesheet)
        self.assertIn('input[type="checkbox"].action-select', stylesheet)
        self.assertIn('input[type="checkbox"]#action-toggle', stylesheet)
        self.assertIn('place-content: center;', stylesheet)

    def test_account_avatar_editor_replaces_raw_file_widget(self):
        template_path = Path(
            get_template("vorin_admin/account_settings.html").origin.name
        )
        template = template_path.read_text(encoding="utf-8")
        stylesheet = Path(finders.find("vorin_admin/css/vorin_panel.css")).read_text(
            encoding="utf-8"
        )
        script = Path(finders.find("vorin_admin/js/vorin_panel.js")).read_text(
            encoding="utf-8"
        )

        self.assertIn("data-vorin-avatar-editor", template)
        self.assertIn("vorin-avatar-editor__preview", template)
        self.assertIn("data-vorin-file-enhanced", template)
        self.assertNotIn("Currently:", template)
        self.assertIn(".vorin-avatar-editor", stylesheet)
        self.assertIn("setupVorinAvatarEditors", script)


class ConfiguredDashboardTests(TestCase):
    @override_settings(
        VORIN_ADMIN={
            "DASHBOARD_CALLBACK": "showcase.tests.project_dashboard_callback",
        }
    )
    def test_project_can_override_dashboard_without_changing_package_code(self):
        callback = _configured_callback("DASHBOARD_CALLBACK", dashboard_callback)

        self.assertIs(callback, project_dashboard_callback)
        self.assertTrue(callback(None, {})["project_dashboard"])

    def test_generic_dashboard_has_no_project_model_dependencies(self):
        request = RequestFactory().get("/admin/")
        request.user = get_user_model().objects.create_superuser(
            username="admin", email="admin@example.com", password="test-password"
        )

        context = dashboard_callback(request, {})

        self.assertIn("dashboard_cards", context)
        self.assertIn("registered_model_summary", context)


class NavigationTests(TestCase):
    def setUp(self):
        self.request = RequestFactory().get("/admin/contracts/contract/1/change/")
        self.request.user = get_user_model().objects.create_superuser(
            username="navigation-admin",
            email="navigation@example.com",
            password="test-password",
        )

    def test_module_active_state_matches_nested_url(self):
        items = _build_module_items(
            self.request,
            {
                "enabled_modules": [
                    {
                        "label": "Contracts",
                        "icon": "contract",
                        "link": "/admin/contracts/contract/",
                    }
                ]
            },
        )

        self.assertTrue(items[0]["active"])

    @override_settings(
        VORIN_PANEL={
            "module_registry": [
                {
                    "slug": "users",
                    "label": "Users & Access",
                    "app_label": "auth",
                    "include_models": ["User", "Group"],
                }
            ]
        }
    )
    def test_app_backed_module_exposes_ordered_model_children(self):
        request = RequestFactory().get("/admin/auth/user/1/change/")
        request.user = self.request.user

        panel = get_panel_settings()
        items = _build_module_items(request, panel)

        self.assertEqual(items[0]["title"], "Users & Access")
        self.assertEqual(
            [child["title"] for child in items[0]["children"]],
            ["Users", "Groups"],
        )
        self.assertTrue(items[0]["active"])
        self.assertTrue(items[0]["children"][0]["active"])

    @override_settings(
        VORIN_PANEL={
            "module_registry": [
                {
                    "slug": "content",
                    "label": "Content",
                    "children": [
                        {"title": "Studio", "link": "/studio/"},
                        {"title": "Images", "link": "/studio/images/"},
                    ],
                }
            ]
        }
    )
    def test_explicit_module_children_are_preserved_and_activated(self):
        request = RequestFactory().get("/studio/images/42/")
        request.user = self.request.user

        items = _build_module_items(request, get_panel_settings())

        self.assertEqual(
            [child["title"] for child in items[0]["children"]],
            ["Studio", "Images"],
        )
        self.assertTrue(items[0]["active"])
        self.assertFalse(items[0]["children"][0]["active"])
        self.assertTrue(items[0]["children"][1]["active"])

    def test_query_string_distinguishes_children_on_the_same_path(self):
        request = RequestFactory().get("/admin/chat-workspace/?target=inbox")
        request.user = self.request.user
        items = _build_module_items(
            request,
            {
                "enabled_modules": [
                    {
                        "label": "Live Chat",
                        "children": [
                            {
                                "title": "Workspace",
                                "link": "/admin/chat-workspace/?target=workspace",
                            },
                            {
                                "title": "Inbox",
                                "link": "/admin/chat-workspace/?target=inbox",
                            },
                        ],
                    }
                ]
            },
        )

        self.assertFalse(items[0]["children"][0]["active"])
        self.assertTrue(items[0]["children"][1]["active"])

    @override_settings(
        VORIN_PANEL={
            "show_all_applications": False,
            "module_registry": [
                {"slug": "contracts", "label": "Contracts", "link": "/admin/contracts/"}
            ],
        }
    )
    def test_registered_app_group_can_be_hidden(self):
        groups = build_sidebar_navigation(self.request)

        self.assertNotIn("Applications", [str(group["title"]) for group in groups])
        self.assertIn("Modules", [str(group["title"]) for group in groups])
