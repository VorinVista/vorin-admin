document.documentElement.dataset.vorinPanel = "true";
const VORIN_SELECT2_SCRIPT_URL = "/static/admin/js/vendor/select2/select2.full.min.js";
const VORIN_THEME_MODES = new Set(["auto", "light", "dark"]);
const VORIN_BROWSER_CLEANUP_VERSION = "20260806-theme-fix-2";

function normalizeVorinThemeMode(value) {
    let current = value;

    for (let attempt = 0; attempt < 4; attempt += 1) {
        if (typeof current !== "string") {
            break;
        }

        const trimmed = current.trim();

        if (VORIN_THEME_MODES.has(trimmed)) {
            return trimmed;
        }

        try {
            const parsed = JSON.parse(trimmed);

            if (parsed === current) {
                break;
            }

            current = parsed;
            continue;
        } catch {}

        const unquoted = trimmed.replace(/^"+|"+$/g, "");

        if (VORIN_THEME_MODES.has(unquoted)) {
            return unquoted;
        }

        break;
    }

    return "auto";
}

function persistVorinThemeMode(mode) {
    const normalizedMode = normalizeVorinThemeMode(mode);
    localStorage.setItem("adminTheme", JSON.stringify(normalizedMode));
    return normalizedMode;
}

function getVorinThemeMode() {
    return normalizeVorinThemeMode(localStorage.getItem("adminTheme"));
}

function getVorinEffectiveTheme(mode) {
    if (mode === "dark") {
        return "dark";
    }

    if (mode === "light") {
        return "light";
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

function syncVorinThemeRoot(mode) {
    const root = document.documentElement;
    const effectiveTheme = getVorinEffectiveTheme(mode);

    root.classList.remove("dark", "light");
    root.classList.add(effectiveTheme);
    root.dataset.vorinTheme = effectiveTheme;

    return effectiveTheme;
}

async function cleanupVorinBrowserState() {
    const cleanupKey = "vorinBrowserCleanupVersion";

    if (localStorage.getItem(cleanupKey) === VORIN_BROWSER_CLEANUP_VERSION) {
        return;
    }

    try {
        if ("serviceWorker" in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();

            await Promise.all(
                registrations
                    .filter((registration) => registration.scope.startsWith(window.location.origin))
                    .map((registration) => registration.unregister())
            );
        }

        if ("caches" in window) {
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map((key) => caches.delete(key)));
        }

        localStorage.setItem(cleanupKey, VORIN_BROWSER_CLEANUP_VERSION);
    } catch {}
}

function getAlpineThemeState() {
    const root = document.documentElement;

    if (window.Alpine && typeof window.Alpine.$data === "function") {
        try {
            return window.Alpine.$data(root);
        } catch {}
    }

    if (Array.isArray(root._x_dataStack) && root._x_dataStack.length > 0) {
        return root._x_dataStack[0];
    }

    return null;
}

function applyVorinTheme(mode) {
    const normalizedMode = persistVorinThemeMode(mode);
    const effectiveTheme = syncVorinThemeRoot(normalizedMode);
    const alpineState = getAlpineThemeState();

    if (alpineState && "adminTheme" in alpineState) {
        alpineState.adminTheme = normalizedMode;
    }

    document.querySelectorAll("[data-vorin-theme-icon]").forEach((icon) => {
        icon.textContent =
            normalizedMode === "dark"
                ? "dark_mode"
                : normalizedMode === "light"
                  ? "light_mode"
                  : "computer";
    });

    document.querySelectorAll("[data-vorin-theme-option]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.vorinThemeOption === normalizedMode);
    });

    window.dispatchEvent(
        new CustomEvent("vorin:themechange", {
            detail: {
                mode: normalizedMode,
                effectiveTheme,
            },
        })
    );
}

(() => {
    const mode = persistVorinThemeMode(getVorinThemeMode());
    syncVorinThemeRoot(mode);
})();

function closeVorinMenus() {
    document.querySelectorAll("[data-vorin-menu][open]").forEach((menu) => {
        menu.removeAttribute("open");
    });
}

function setupVorinThemeSwitch() {
    applyVorinTheme(getVorinThemeMode());

    document.querySelectorAll("[data-vorin-theme-option]").forEach((button) => {
        button.addEventListener("click", () => {
            applyVorinTheme(button.dataset.vorinThemeOption || "auto");

            const menu = button.closest("[data-vorin-menu]");
            if (menu) {
                menu.removeAttribute("open");
            }
        });
    });
}

function setupVorinCommandLauncher() {
    const root = document.querySelector("[data-vorin-command]");
    const input = document.querySelector("[data-vorin-command-input]");
    const results = document.querySelector("[data-vorin-command-results]");
    const empty = document.querySelector("[data-vorin-command-empty]");
    const launchers = Array.from(document.querySelectorAll("[data-vorin-command-launch]"));
    const closers = Array.from(document.querySelectorAll("[data-vorin-command-close]"));

    if (!root || !input || !results) {
        return;
    }

    const items = [];

    document.querySelectorAll(".vorin-sidebar__link").forEach((link) => {
        const title = link.querySelector(".truncate")?.textContent?.trim() || link.textContent.trim();
        const href = link.getAttribute("href");

        if (!title || !href) {
            return;
        }

        items.push({
            title,
            href,
            meta: "Navigation",
            icon: link.querySelector(".material-symbols-outlined")?.textContent?.trim() || "link",
        });
    });

    document.querySelectorAll(".vorin-sidebar-children .vorin-sidebar__child-link").forEach((link) => {
        const title = link.querySelector(".truncate")?.textContent?.trim() || link.textContent.trim();
        const href = link.getAttribute("href");
        const section = link.closest(".vorin-sidebar-details")?.querySelector(".vorin-sidebar-summary .truncate")?.textContent?.trim() || "Application";

        if (!title || !href) {
            return;
        }

        items.push({
            title,
            href,
            meta: section,
            icon: "subdirectory_arrow_right",
        });
    });

    let activeIndex = -1;

    const closeCommand = () => {
        root.classList.remove("is-open");
        document.body.classList.remove("vorin-command-open");
        activeIndex = -1;
    };

    const openCommand = () => {
        root.classList.add("is-open");
        document.body.classList.add("vorin-command-open");
        renderResults(input.value);
        window.requestAnimationFrame(() => {
            input.focus();
            input.select();
        });
    };

    function renderResults(query = "") {
        const needle = query.trim().toLowerCase();
        const filtered = !needle
            ? items
            : items.filter((item) =>
                [item.title, item.meta, item.href]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(needle)
            );

        results.innerHTML = "";
        activeIndex = filtered.length ? 0 : -1;

        filtered.slice(0, 18).forEach((item, index) => {
            const link = document.createElement("a");
            link.className = `vorin-command__result${index === activeIndex ? " is-active" : ""}`;
            link.href = item.href;
            link.innerHTML = `
                <span class="vorin-command__result-icon material-symbols-outlined">${item.icon}</span>
                <span class="vorin-command__result-body">
                    <span class="vorin-command__result-title">${item.title}</span>
                    <span class="vorin-command__result-meta">${item.meta}</span>
                </span>
                <span class="vorin-command__result-arrow material-symbols-outlined">arrow_outward</span>
            `;
            results.appendChild(link);
        });

        if (empty) {
            empty.hidden = filtered.length > 0;
        }
    }

    const syncActiveResult = (nextIndex) => {
        const list = Array.from(results.querySelectorAll(".vorin-command__result"));

        if (!list.length) {
            activeIndex = -1;
            return;
        }

        activeIndex = Math.max(0, Math.min(nextIndex, list.length - 1));
        list.forEach((node, index) => {
            node.classList.toggle("is-active", index === activeIndex);
        });
        list[activeIndex].scrollIntoView({ block: "nearest" });
    };

    launchers.forEach((button) => {
        button.addEventListener("click", openCommand);
    });

    closers.forEach((button) => {
        button.addEventListener("click", closeCommand);
    });

    input.addEventListener("input", () => {
        renderResults(input.value);
    });

    input.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            syncActiveResult(activeIndex + 1);
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            syncActiveResult(activeIndex - 1);
            return;
        }

        if (event.key === "Enter") {
            const active = results.querySelector(".vorin-command__result.is-active");

            if (active) {
                active.click();
            }
        }
    });

    document.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "/") {
            event.preventDefault();
            openCommand();
            return;
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
            event.preventDefault();
            openCommand();
            return;
        }

        if (event.key === "Escape" && root.classList.contains("is-open")) {
            closeCommand();
        }
    });
}

function resolveVorinSidebarOpen() {
    const alpineState = getAlpineThemeState();

    if (alpineState && typeof alpineState.sidebarOpen === "boolean") {
        return alpineState.sidebarOpen;
    }

    if (window.innerWidth <= 1024) {
        return false;
    }

    return localStorage.getItem("sidebarOpen") !== "0";
}

function syncVorinSidebarState(isOpen = resolveVorinSidebarOpen()) {
    const open = !!isOpen;
    const sidebarWidth = Number.parseInt(localStorage.getItem("sidebarWidth") || "288", 10);

    document.documentElement.style.setProperty(
        "--vorin-sidebar-width",
        `${Number.isNaN(sidebarWidth) ? 288 : sidebarWidth}px`
    );
    document.documentElement.dataset.vorinSidebarOpen = open ? "true" : "false";
    document.body.dataset.vorinSidebarOpen = open ? "true" : "false";

    document.querySelectorAll("[data-vorin-sidebar-toggle]").forEach((button) => {
        button.setAttribute("aria-expanded", open ? "true" : "false");
    });
}

function setupVorinSidebarToggle() {
    syncVorinSidebarState();

    document.querySelectorAll("[data-vorin-sidebar-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
            const alpineState = getAlpineThemeState();

            if (alpineState && typeof alpineState.sidebarToggle === "function") {
                alpineState.sidebarToggle();
                window.requestAnimationFrame(() => {
                    syncVorinSidebarState();
                });
                return;
            }

            const nextState = !resolveVorinSidebarOpen();
            localStorage.setItem("sidebarOpen", nextState ? "1" : "0");
            syncVorinSidebarState(nextState);
        });
    });

    window.addEventListener("resize", () => {
        syncVorinSidebarState();
    });
}

function setupVorinMenus() {
    document.addEventListener("click", (event) => {
        document.querySelectorAll("[data-vorin-menu][open]").forEach((menu) => {
            if (!menu.contains(event.target)) {
                menu.removeAttribute("open");
            }
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeVorinMenus();
        }
    });
}

function setupVorinHistoryButtons() {
    document.querySelectorAll("[data-history-back]").forEach((button) => {
        button.addEventListener("click", () => {
            window.history.back();
        });
    });
}

function syncQuestionnaireCard(card) {
    if (!card) {
        return;
    }

    const checkbox = card.querySelector('.qt-card-head input[type="checkbox"]');

    if (!checkbox) {
        return;
    }

    card.classList.toggle("off", !checkbox.checked);
}

function setupVorinQuestionnaireBuilder() {
    document.querySelectorAll(".qt-card").forEach((card) => {
        syncQuestionnaireCard(card);
    });

    document.querySelectorAll(".qt-card-head").forEach((head) => {
        head.addEventListener("click", (event) => {
            if (event.target.closest('input[type="checkbox"]')) {
                return;
            }

            const card = head.closest(".qt-card");
            const checkbox = head.querySelector('input[type="checkbox"]');

            if (!card || !checkbox) {
                return;
            }

            checkbox.checked = !checkbox.checked;
            syncQuestionnaireCard(card);
        });
    });

    document
        .querySelectorAll('.qt-card-head input[type="checkbox"]')
        .forEach((checkbox) => {
            checkbox.addEventListener("change", () => {
                syncQuestionnaireCard(checkbox.closest(".qt-card"));
            });
        });

    document.querySelectorAll(".qt-sec-btn").forEach((button) => {
        button.addEventListener("click", () => {
            const section = button.closest(".qt-section");
            const shouldEnable = button.dataset.all === "1";

            if (!section) {
                return;
            }

            section
                .querySelectorAll('.qt-card-head input[type="checkbox"]')
                .forEach((checkbox) => {
                    checkbox.checked = shouldEnable;
                    syncQuestionnaireCard(checkbox.closest(".qt-card"));
                });
        });
    });
}

function slugifyVorinValue(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-");
}

function setupVorinAutoSlug() {
    document.querySelectorAll("[data-vorin-slug-source]").forEach((slugField) => {
        const sourceName = slugField.dataset.vorinSlugSource;
        const sourceField = sourceName ? document.getElementById(`id_${sourceName}`) : null;

        if (!sourceField) {
            return;
        }

        let touchedManually = Boolean(slugField.value);

        slugField.addEventListener("input", () => {
            touchedManually = slugField.value.trim().length > 0;
        });

        const syncSlug = () => {
            if (touchedManually && slugField.value.trim()) {
                return;
            }

            slugField.value = slugifyVorinValue(sourceField.value);
        };

        sourceField.addEventListener("input", syncSlug);

        if (!slugField.value.trim()) {
            syncSlug();
        }
    });
}

function setupVorinMediaCards() {
    document.querySelectorAll(".vorin-admin-media-card__frame img").forEach((image) => {
        if (image.dataset.vorinMediaBound === "1") {
            return;
        }

        image.dataset.vorinMediaBound = "1";

        const frame = image.closest(".vorin-admin-media-card__frame");
        if (!frame) {
            return;
        }

        const markBroken = () => {
            frame.classList.add("is-broken");
        };

        const markLoaded = () => {
            frame.classList.remove("is-broken");
        };

        image.addEventListener("error", markBroken);
        image.addEventListener("load", markLoaded);

        if (image.complete) {
            if (image.naturalWidth > 0) {
                markLoaded();
            } else {
                markBroken();
            }
        }
    });
}

function getVorinAutocompleteFieldKey(select) {
    const appLabel = select?.dataset?.appLabel || "";
    const modelName = select?.dataset?.modelName || "";
    const fieldName = select?.dataset?.fieldName || select?.name || "";
    return [appLabel, modelName, fieldName].filter(Boolean).join(".");
}

function getVorinAutocompletePlaceholder(select) {
    if (!select) {
        return "";
    }

    const placeholderOverrides = {
        "contracts.contract.template": "Choose a contract template...",
        "contracts.contract.questionnaire": "Choose a questionnaire...",
        "contracts.questionnaire.template": "Choose a questionnaire template...",
    };
    const explicitPlaceholder =
        select.getAttribute("data-vorin-placeholder") || select.getAttribute("data-placeholder") || "";
    const override = placeholderOverrides[getVorinAutocompleteFieldKey(select)];

    if (override) {
        return override;
    }

    if (explicitPlaceholder.trim()) {
        return explicitPlaceholder.trim();
    }

    const emptyOption = select.querySelector('option[value=""]');
    const emptyOptionText = emptyOption ? (emptyOption.textContent || "").trim() : "";
    if (emptyOptionText) {
        return emptyOptionText;
    }

    const rawLabel = getVorinFieldLabel(select)
        .replace(/\*/g, "")
        .replace(/:\s*$/, "")
        .trim()
        .toLowerCase();

    if (!rawLabel) {
        return "Choose an option...";
    }

    if (/^(the|a|an)\b/.test(rawLabel)) {
        return `Choose ${rawLabel}...`;
    }

    const article = /^[aeiou]/.test(rawLabel) ? "an" : "a";
    return `Choose ${article} ${rawLabel}...`;
}

function syncVorinAutocompleteField(select) {
    if (!select || !select.classList.contains("admin-autocomplete")) {
        return;
    }

    const wrapper = select.closest(".related-widget-wrapper");
    if (wrapper) {
        wrapper.querySelectorAll(".related-widget-wrapper-link").forEach((link) => {
            link.setAttribute("hidden", "hidden");
            link.setAttribute("aria-hidden", "true");
            link.tabIndex = -1;
        });
    }

    const placeholder = getVorinAutocompletePlaceholder(select);
    if (placeholder) {
        select.setAttribute("data-placeholder", placeholder);
        select.setAttribute("data-vorin-placeholder", placeholder);
    }

    const select2Container =
        select.nextElementSibling && select.nextElementSibling.classList.contains("select2")
            ? select.nextElementSibling
            : wrapper?.querySelector(".select2");
    const renderedValue = select2Container?.querySelector(".select2-selection__rendered");

    if (!renderedValue) {
        return;
    }

    const hasSelection = Array.isArray(select.selectedOptions)
        ? Array.from(select.selectedOptions).some((option) => option.value)
        : Boolean(select.value);

    if (!hasSelection) {
        renderedValue.textContent = placeholder;
        renderedValue.classList.add("select2-selection__placeholder");
        renderedValue.setAttribute("title", placeholder);
        return;
    }

    renderedValue.classList.remove("select2-selection__placeholder");
    const currentText = (renderedValue.textContent || "").trim();
    if (currentText) {
        renderedValue.setAttribute("title", currentText);
    }
}

function setupVorinAutocompleteFields() {
    document.querySelectorAll("select.admin-autocomplete").forEach((select) => {
        syncVorinAutocompleteField(select);

        if (select.dataset.vorinAutocompleteBound === "1") {
            return;
        }

        select.dataset.vorinAutocompleteBound = "1";

        ["change", "focus", "blur"].forEach((eventName) => {
            select.addEventListener(eventName, () => {
                window.setTimeout(() => syncVorinAutocompleteField(select), 0);
            });
        });
    });
}

function ensureVorinSelect2() {
    if (window.__vorinSelect2Promise) {
        return window.__vorinSelect2Promise;
    }

    window.__vorinSelect2Promise = new Promise((resolve) => {
        const waitForDjangoJQuery = () => {
            const jq = window.django && window.django.jQuery;
            if (!jq || !jq.fn) {
                window.setTimeout(waitForDjangoJQuery, 60);
                return;
            }

            if (typeof jq.fn.select2 === "function") {
                resolve(jq);
                return;
            }

            const oldDollar = window.$;
            const oldJQuery = window.jQuery;
            window.$ = jq;
            window.jQuery = jq;

            const script = document.createElement("script");
            script.src = VORIN_SELECT2_SCRIPT_URL;
            script.onload = () => {
                window.$ = oldDollar;
                window.jQuery = oldJQuery;
                resolve(jq);
            };
            script.onerror = () => {
                window.$ = oldDollar;
                window.jQuery = oldJQuery;
                resolve(jq);
            };
            document.head.appendChild(script);
        };

        waitForDjangoJQuery();
    });

    return window.__vorinSelect2Promise;
}

function shouldEnhanceVorinSelect(select) {
    if (!select || select.tagName !== "SELECT") {
        return false;
    }

    if (select.dataset.noVorinSelect === "1") {
        return false;
    }

    if (select.classList.contains("admin-autocomplete")) {
        return false;
    }

    if (select.multiple) {
        return false;
    }

    if (
        select.classList.contains("selectfilter") ||
        select.classList.contains("selectfilterstacked") ||
        select.closest(".empty-form")
    ) {
        return false;
    }

    return true;
}

function buildVorinSelectPlaceholder(select) {
    const emptyOption = select.querySelector('option[value=""]');
    const emptyText = emptyOption ? (emptyOption.textContent || "").trim() : "";
    if (emptyText && !/^-+$/.test(emptyText.replace(/\s+/g, ""))) {
        return emptyText;
    }

    const rawLabel = getVorinFieldLabel(select)
        .replace(/\*/g, "")
        .replace(/:\s*$/, "")
        .trim()
        .toLowerCase();

    if (!rawLabel) {
        return "Select an option...";
    }

    return `Select ${rawLabel}...`;
}

function setupVorinPlainSelects() {
    ensureVorinSelect2().then((jq) => {
        if (!jq || !jq.fn || typeof jq.fn.select2 !== "function") {
            return;
        }

        document.querySelectorAll("select").forEach((select) => {
            if (!shouldEnhanceVorinSelect(select)) {
                return;
            }

            const placeholder = buildVorinSelectPlaceholder(select);
            const hasEmptyOption = Boolean(select.querySelector('option[value=""]'));
            const shouldHideSearch = select.options.length <= 8;

            if (select.dataset.vorinSelectBound !== "1") {
                jq(select).select2({
                    width: "100%",
                    placeholder: placeholder || undefined,
                    allowClear: hasEmptyOption,
                    minimumResultsForSearch: shouldHideSearch ? Infinity : 0,
                    dropdownAutoWidth: false,
                });
                select.dataset.vorinSelectBound = "1";
            }

            const renderedValue = select.nextElementSibling?.querySelector(".select2-selection__rendered");
            if (renderedValue && !select.value && placeholder) {
                renderedValue.classList.add("select2-selection__placeholder");
                renderedValue.textContent = placeholder;
                renderedValue.setAttribute("title", placeholder);
            }
        });
    });
}

function getVorinFieldLabel(input) {
    if (!input || !input.id) {
        return "";
    }

    const directLabel = document.querySelector(`label[for="${input.id}"]`);
    if (directLabel) {
        return directLabel.textContent || "";
    }

    const fieldLine = input.closest(".field-line");
    if (!fieldLine) {
        return "";
    }

    const fallbackLabel = fieldLine.querySelector("label");
    return fallbackLabel ? fallbackLabel.textContent || "" : "";
}

function supportsVorinInputType(type) {
    const probe = document.createElement("input");
    probe.setAttribute("type", type);
    return probe.type === type;
}

function normalizeVorinDateValue(value) {
    if (!value) {
        return "";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function formatVorinDateValueForText(value) {
    if (!value) {
        return "";
    }

    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
}

function normalizeVorinTimeValue(value) {
    if (!value) {
        return "";
    }

    const match = String(value).match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    return match ? `${match[1]}:${match[2]}` : "";
}

function getVorinTodayValue() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getVorinNowTimeValue() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
}

function getVorinPickerPlaceholder(input) {
    const isTime = input.classList.contains("vTimeField") || input.type === "time";

    if (isTime) {
        return "Choose the time";
    }

    return "Choose the date";
}

function enhanceVorinSplitDateTimeFields() {
    document.querySelectorAll("p.datetime").forEach((block) => {
        const dateInput = block.querySelector("input.vDateField");
        const timeInput = block.querySelector("input.vTimeField");

        if (!dateInput || !timeInput) {
            return;
        }

        const dateShortcuts =
            dateInput.nextElementSibling && dateInput.nextElementSibling.matches(".datetimeshortcuts")
                ? dateInput.nextElementSibling
                : null;
        const timeShortcuts =
            timeInput.nextElementSibling && timeInput.nextElementSibling.matches(".datetimeshortcuts")
                ? timeInput.nextElementSibling
                : null;

        if (block.dataset.vorinDatetimeEnhanced === "1") {
            const controls = block.querySelectorAll(".vorin-datetime-row__control");
            if (controls[0] && dateShortcuts && !controls[0].contains(dateShortcuts)) {
                controls[0].appendChild(dateShortcuts);
            }
            if (controls[1] && timeShortcuts && !controls[1].contains(timeShortcuts)) {
                controls[1].appendChild(timeShortcuts);
            }
            return;
        }

        const makeRow = (labelText, input, shortcuts) => {
            const row = document.createElement("div");
            row.className = "vorin-datetime-row";

            const label = document.createElement("span");
            label.className = "vorin-datetime-row__label";
            label.textContent = labelText;

            const control = document.createElement("div");
            control.className = "vorin-datetime-row__control";
            control.appendChild(input);

            if (shortcuts) {
                control.appendChild(shortcuts);
            }

            row.appendChild(label);
            row.appendChild(control);
            return row;
        };

        const stack = document.createElement("div");
        stack.className = "vorin-datetime-stack";
        stack.appendChild(makeRow("Date", dateInput, dateShortcuts));
        stack.appendChild(makeRow("Time", timeInput, timeShortcuts));

        block.textContent = "";
        block.appendChild(stack);
        block.dataset.vorinDatetimeEnhanced = "1";
    });
}

function getVorinShortcutContainer(input) {
    const inlineShortcuts = input.nextElementSibling;
    if (inlineShortcuts && inlineShortcuts.matches(".datetimeshortcuts")) {
        return inlineShortcuts;
    }

    const scopedShortcuts = input.closest(".field-line, .form-row, .fieldBox, .datetime")?.querySelector(".datetimeshortcuts");
    if (scopedShortcuts) {
        return scopedShortcuts;
    }

    const siblingShortcuts = input.parentElement?.nextElementSibling;
    if (siblingShortcuts && siblingShortcuts.matches(".datetimeshortcuts")) {
        return siblingShortcuts;
    }

    return input.parentElement?.querySelector(".datetimeshortcuts") || null;
}

function getVorinShortcutTrigger(input) {
    const shortcuts = getVorinShortcutContainer(input);
    if (!shortcuts) {
        return null;
    }

    const selector =
        input.classList.contains("vTimeField") || input.type === "time"
            ? "a:has(.clock-icon)"
            : "a:has(.date-icon)";

    return shortcuts.querySelector(selector);
}

function openVorinPicker(input) {
    if (!input) {
        return;
    }

    if (input.dataset.vorinNativePicker === "1" && typeof input.showPicker === "function") {
        try {
            input.showPicker();
            return;
        } catch {}
    }

    const trigger = getVorinShortcutTrigger(input);
    if (trigger) {
        const popupId = trigger.id ? trigger.id.replace("link", "box") : null;
        const popup = popupId ? document.getElementById(popupId) : null;

        if (!popup || popup.style.display !== "block") {
            trigger.click();
        }
        return;
    }

    if (typeof input.showPicker === "function") {
        try {
            input.showPicker();
        } catch {}
    }
}

function bindVorinShortcutAction(link, input, isTime) {
    if (!link || link.dataset.vorinShortcutBound === "1") {
        return;
    }

    const text = (link.textContent || "").trim().toLowerCase();
    const isQuickAction = isTime ? text === "now" : text === "today";

    if (!isQuickAction) {
        return;
    }

    link.dataset.vorinShortcutBound = "1";
    link.addEventListener("click", (event) => {
        event.preventDefault();
        input.value = isTime ? getVorinNowTimeValue() : getVorinTodayValue();
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    });
}

function decorateVorinShortcutLinks(input) {
    const isTimeField = input.classList.contains("vTimeField") || input.type === "time";
    const shortcuts = getVorinShortcutContainer(input);
    if (shortcuts) {
        shortcuts.classList.add("vorin-datetimeshortcuts");

        shortcuts.querySelectorAll("a").forEach((link) => {
            link.classList.add("vorin-datetimeshortcuts__link");

            if (link.querySelector(".date-icon")) {
                link.classList.add(
                    "vorin-datetimeshortcuts__link--icon",
                    "vorin-datetimeshortcuts__link--picker",
                    "is-date"
                );
                link.setAttribute("aria-label", "Open date picker");
            }

            if (link.querySelector(".clock-icon")) {
                link.classList.add(
                    "vorin-datetimeshortcuts__link--icon",
                    "vorin-datetimeshortcuts__link--picker",
                    "is-time"
                );
                link.setAttribute("aria-label", "Open time picker");
            }

            bindVorinShortcutAction(link, input, isTimeField);
        });
    }
}

function setupVorinDateTimeInputs() {
    document
        .querySelectorAll('input.vDateField, input.vTimeField, input[type="date"], input[type="time"], input[type="datetime-local"]')
        .forEach((input) => {
            const isBound = input.dataset.vorinPickerBound === "1";
            const isDateField = input.classList.contains("vDateField");
            const isTimeField = input.classList.contains("vTimeField");

            // Keep Vorin-branded pickers as text inputs even if stale scripts or browser state
            // temporarily switch them to native date/time controls.
            if (isDateField && input.type !== "text") {
                input.value = formatVorinDateValueForText(input.value);
                input.type = "text";
            }

            if (isTimeField && input.type !== "text") {
                input.type = "text";
            }

            input.classList.add("vorin-admin-picker-input");
            input.classList.add(
                isTimeField || input.type === "time"
                    ? "vorin-admin-picker-input--time"
                    : "vorin-admin-picker-input--date"
            );

            if (!input.placeholder) {
                input.placeholder = getVorinPickerPlaceholder(input);
            }

            decorateVorinShortcutLinks(input);

            if (!isBound) {
                input.dataset.vorinPickerBound = "1";
                input.addEventListener("click", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    window.setTimeout(() => {
                        input.focus();
                        openVorinPicker(input);
                    }, 0);
                });

                input.addEventListener("keydown", (event) => {
                    if (event.key === "ArrowDown" || event.key === "Enter") {
                        event.preventDefault();
                        openVorinPicker(input);
                    }
                });
            }
        });
}

let vorinEnhancementObserverStarted = false;

function scheduleVorinEnhancements() {
    window.clearTimeout(window.__vorinEnhanceTimer);
    window.__vorinEnhanceTimer = window.setTimeout(() => {
        setupVorinAutocompleteFields();
        setupVorinPlainSelects();
        enhanceVorinSplitDateTimeFields();
        setupVorinDateTimeInputs();
        setupVorinMediaCards();
    }, 60);
}

function setupVorinEnhancementObserver() {
    if (vorinEnhancementObserverStarted || !document.body || typeof MutationObserver === "undefined") {
        return;
    }

    const observer = new MutationObserver((mutations) => {
        const shouldRefresh = mutations.some((mutation) =>
            Array.from(mutation.addedNodes).some(
                (node) =>
                    node.nodeType === 1 &&
                    (
                        node.matches?.("select, input, p.datetime, .related-widget-wrapper, .vorin-admin-media-card__frame img") ||
                        node.querySelector?.("select, input, p.datetime, .related-widget-wrapper, .vorin-admin-media-card__frame img")
                    )
            )
        );

        if (shouldRefresh) {
            scheduleVorinEnhancements();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
    vorinEnhancementObserverStarted = true;
}

function setupVorinThemeMediaWatcher() {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    media.addEventListener("change", () => {
        if (getVorinThemeMode() === "auto") {
            applyVorinTheme("auto");
        }
    });
}

function setupVorinBulkActions() {
    document.querySelectorAll(".vorin-bulk-actions").forEach((root) => {
        const select = root.querySelector('select[name="action"]');
        const submit = root.querySelector(".vorin-bulk-actions__submit");

        if (!select || !submit) {
            return;
        }

        const placeholder = select.querySelector('option[value=""]');

        if (
            placeholder &&
            (!placeholder.textContent.trim() || placeholder.textContent.trim() === "---------")
        ) {
            placeholder.textContent = "Choose action";
        }

        const syncState = () => {
            submit.disabled = !select.value;
        };

        select.addEventListener("change", syncState);
        syncState();
    });
}

window.addEventListener("DOMContentLoaded", () => {
    cleanupVorinBrowserState();
    setupVorinThemeSwitch();
    setupVorinCommandLauncher();
    setupVorinSidebarToggle();
    setupVorinMenus();
    setupVorinHistoryButtons();
    setupVorinQuestionnaireBuilder();
    setupVorinAutoSlug();
    setupVorinMediaCards();
    setupVorinAutocompleteFields();
    setupVorinPlainSelects();
    setupVorinBulkActions();
    enhanceVorinSplitDateTimeFields();
    setupVorinDateTimeInputs();
    setupVorinThemeMediaWatcher();
    setupVorinEnhancementObserver();
    window.setTimeout(setupVorinAutocompleteFields, 120);
    window.setTimeout(setupVorinPlainSelects, 120);
    window.setTimeout(setupVorinBulkActions, 120);
    window.setTimeout(setupVorinAutocompleteFields, 500);
    window.setTimeout(setupVorinPlainSelects, 500);
    window.setTimeout(setupVorinBulkActions, 500);
    window.setTimeout(enhanceVorinSplitDateTimeFields, 120);
    window.setTimeout(setupVorinDateTimeInputs, 120);
    window.setTimeout(setupVorinAutocompleteFields, 1000);
    window.setTimeout(setupVorinPlainSelects, 1000);
    window.setTimeout(setupVorinBulkActions, 1000);
    window.setTimeout(enhanceVorinSplitDateTimeFields, 500);
    window.setTimeout(setupVorinDateTimeInputs, 500);
});

window.addEventListener("load", () => {
    setupVorinAutocompleteFields();
    setupVorinPlainSelects();
    setupVorinBulkActions();
    enhanceVorinSplitDateTimeFields();
    setupVorinDateTimeInputs();
    setupVorinEnhancementObserver();
});
