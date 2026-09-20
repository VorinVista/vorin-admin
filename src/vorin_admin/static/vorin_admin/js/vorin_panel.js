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

function closeVorinMenus(exceptMenu = null) {
    document.querySelectorAll("[data-vorin-menu][open]").forEach((menu) => {
        if (menu !== exceptMenu) {
            menu.removeAttribute("open");
        }
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
        syncVorinFooterHeight();
    });
}

function setupVorinMenus() {
    document.querySelectorAll("[data-vorin-menu] > summary").forEach((summary) => {
        if (summary.dataset.vorinMenuToggleBound === "1") {
            return;
        }

        summary.dataset.vorinMenuToggleBound = "1";

        const toggleMenu = (event) => {
            const menu = summary.closest("[data-vorin-menu]");

            if (!menu) {
                return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();

            const shouldOpen = !menu.open;
            closeVorinMenus(shouldOpen ? menu : null);
            menu.open = shouldOpen;
        };

        summary.addEventListener("click", toggleMenu, true);
        summary.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") {
                return;
            }

            toggleMenu(event);
        });
    });

    document.addEventListener("pointerdown", (event) => {
        const path = typeof event.composedPath === "function" ? event.composedPath() : [];
        const activeMenu = Array.from(document.querySelectorAll("[data-vorin-menu][open]")).find((menu) =>
            path.includes(menu) || menu.contains(event.target)
        );

        closeVorinMenus(activeMenu || null);
    }, true);

    document.addEventListener("click", (event) => {
        const clickedMenu = event.target.closest?.("[data-vorin-menu]");
        if (!clickedMenu) {
            closeVorinMenus();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeVorinMenus();
        }
    });
}

function vorinFileInputLabel(input) {
    if (!input.files || input.files.length === 0) {
        return "";
    }

    return input.files.length === 1 ? input.files[0].name : `${input.files.length} files selected`;
}

function syncVorinFileInput(input, wrapper, label) {
    const fileLabel = vorinFileInputLabel(input);

    label.textContent = fileLabel;
    wrapper.classList.toggle("is-empty", !fileLabel);
}

function enhanceVorinFileInput(input) {
    if (!input || input.dataset.vorinFileEnhanced === "1" || input.closest(".vorin-file-control")) {
        return;
    }

    input.dataset.vorinFileEnhanced = "1";
    input.classList.add("vorin-file-control__native");

    const wrapper = document.createElement("label");
    wrapper.className = "vorin-file-control";

    const button = document.createElement("span");
    button.className = "vorin-file-control__button";
    button.textContent = input.dataset.buttonLabel || "Select file";

    const label = document.createElement("span");
    label.className = "vorin-file-control__name";

    input.parentNode.insertBefore(wrapper, input);
    wrapper.append(input, button, label);
    syncVorinFileInput(input, wrapper, label);

    input.addEventListener("change", () => {
        syncVorinFileInput(input, wrapper, label);
    });
}

function setupVorinFileInputs(root = document) {
    root.querySelectorAll?.('.change-form #content-main .form-row input[type="file"]').forEach(enhanceVorinFileInput);
}

function parseVorinNumberValue(input) {
    const value = Number(input.value);
    return Number.isFinite(value) ? value : 0;
}

function getVorinDecimalPlaces(value) {
    const match = String(value || "").match(/\.(\d+)/);
    return match ? match[1].length : 0;
}

function clampVorinNumber(input, value) {
    let nextValue = value;
    const min = Number(input.getAttribute("min"));
    const max = Number(input.getAttribute("max"));

    if (Number.isFinite(min)) {
        nextValue = Math.max(nextValue, min);
    }

    if (Number.isFinite(max)) {
        nextValue = Math.min(nextValue, max);
    }

    return nextValue;
}

function stepVorinNumberInput(input, direction) {
    const step = Number(input.getAttribute("step") || "1");
    const normalizedStep = Number.isFinite(step) && step > 0 ? step : 1;
    const decimalPlaces = getVorinDecimalPlaces(normalizedStep);
    const nextValue = clampVorinNumber(input, parseVorinNumberValue(input) + normalizedStep * direction);

    input.value = decimalPlaces > 0 ? nextValue.toFixed(decimalPlaces) : String(Math.round(nextValue));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
}

function enhanceVorinNumberInput(input) {
    if (!input || input.dataset.vorinNumberEnhanced === "1" || input.closest(".vorin-number-control")) {
        return;
    }

    input.dataset.vorinNumberEnhanced = "1";
    input.classList.add("vorin-number-control__input");

    const wrapper = document.createElement("div");
    wrapper.className = "vorin-number-control";

    const decrement = document.createElement("button");
    decrement.type = "button";
    decrement.className = "vorin-number-control__button";
    decrement.setAttribute("aria-label", "Decrease value");
    decrement.textContent = "−";

    const increment = document.createElement("button");
    increment.type = "button";
    increment.className = "vorin-number-control__button";
    increment.setAttribute("aria-label", "Increase value");
    increment.textContent = "+";

    input.parentNode.insertBefore(wrapper, input);
    wrapper.append(decrement, input, increment);

    decrement.addEventListener("click", () => stepVorinNumberInput(input, -1));
    increment.addEventListener("click", () => stepVorinNumberInput(input, 1));
}

function setupVorinNumberInputs(root = document) {
    root.querySelectorAll?.('.change-form #content-main .form-row input[type="number"]:not([data-no-vorin-number="1"])').forEach(enhanceVorinNumberInput);
}

function setupVorinHistoryButtons() {
    document.querySelectorAll("[data-history-back]").forEach((button) => {
        button.addEventListener("click", () => {
            window.history.back();
        });
    });
}

function syncVorinFooterHeight() {
    const footer = document.querySelector(".vorin-footer-bar");
    document.documentElement.style.setProperty(
        "--vorin-footer-height",
        footer ? `${footer.getBoundingClientRect().height}px` : "0px"
    );
}

function setupVorinStickyActionBar() {
    // The page footer is its own position:sticky element pinned to the
    // viewport bottom -- unrelated to the action bar's own fixed
    // positioning below, so without accounting for the footer's height the
    // two occupy the same bottom strip and the footer's opaque background
    // can cover the action bar's buttons. Measured (not hardcoded) because
    // the footer's own height varies: it wraps to multiple lines on narrow
    // viewports, and its content (copyright text, nav links) differs per
    // project.
    syncVorinFooterHeight();

    if (!document.body?.classList.contains("change-form")) {
        return;
    }

    const rows = Array.from(
        document.querySelectorAll("#content-main form .submit-row")
    ).filter((row) => !row.parentElement?.closest(".submit-row"));

    if (!rows.length) {
        return;
    }

    const actionBar = rows[0];

    rows.forEach((row, index) => {
        row.classList.toggle("vorin-sticky-actionbar", index === 0);
        row.classList.toggle("vorin-sticky-actionbar--duplicate", index > 0);
        row.setAttribute("aria-hidden", index > 0 ? "true" : "false");
    });

    document.body.classList.add("vorin-has-sticky-actionbar");
    actionBar.removeAttribute("aria-hidden");
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

    // Django's changelist actions already have their own form lifecycle.
    // Wrapping this select in Select2 creates a second visual "Choose action"
    // control and can leave the real field unchanged when Apply is pressed.
    if (select.name === "action" && select.closest(".vorin-bulk-actions")) {
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

function vorinSelectHasOption(select, value) {
    return Array.from(select.options).some((option) => option.value === value);
}

function appendVorinTimeOption(select, value, label, beforeNode = null) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.insertBefore(option, beforeNode);
}

function buildVorinTimeSelectOptions(select) {
    if (select.dataset.vorinTimeOptionsBuilt === "1") {
        return;
    }

    appendVorinTimeOption(select, "", "Select time");

    for (let hour = 0; hour < 24; hour += 1) {
        for (let minute = 0; minute < 60; minute += 15) {
            const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
            appendVorinTimeOption(select, value, value);
        }
    }

    select.dataset.vorinTimeOptionsBuilt = "1";
}

function ensureVorinTimeSelect(input) {
    const selectId = input.id ? `${input.id}_vorin_time_select` : "";
    let select = selectId ? document.getElementById(selectId) : null;

    if (!select) {
        select = document.createElement("select");
        select.className = "vorin-time-select";
        select.dataset.noVorinSelect = "1";
        select.dataset.vorinTimeSelect = "1";
        select.setAttribute("aria-label", "Select time");

        if (selectId) {
            select.id = selectId;
        }

        input.insertAdjacentElement("afterend", select);
    }

    buildVorinTimeSelectOptions(select);
    return select;
}

function enhanceVorinTimeInput(input) {
    if (!input) {
        return;
    }

    input.dataset.vorinEnhancedTime = "1";
    input.dataset.vorinNativePicker = "1";
    input.classList.add("vorin-time-source-input");
    input.setAttribute("type", "text");
    input.setAttribute("aria-hidden", "true");
    input.tabIndex = -1;

    const normalizedValue = normalizeVorinTimeValue(input.value);

    if (normalizedValue) {
        input.value = normalizedValue;
    }

    const select = ensureVorinTimeSelect(input);

    if (normalizedValue && !vorinSelectHasOption(select, normalizedValue)) {
        appendVorinTimeOption(select, normalizedValue, normalizedValue, select.options[1] || null);
    }

    select.value = normalizedValue;

    const label = input.closest(".vorin-datetime-row")?.querySelector(".vorin-datetime-row__label");
    if (label) {
        select.setAttribute("aria-label", label.textContent.trim() || "Select time");
    }

    const shortcuts = input.parentElement?.querySelector(".datetimeshortcuts");
    if (shortcuts) {
        shortcuts.dataset.vorinNativePicker = "1";
        shortcuts.classList.add("vorin-time-shortcuts");
    }

    if (select.dataset.vorinTimeBound !== "1") {
        select.dataset.vorinTimeBound = "1";
        select.addEventListener("change", () => {
            input.value = select.value;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
        });
    }

    if (input.dataset.vorinTimeBound !== "1") {
        input.dataset.vorinTimeBound = "1";
        input.addEventListener("change", () => {
            const value = normalizeVorinTimeValue(input.value);

            if (value && !vorinSelectHasOption(select, value)) {
                appendVorinTimeOption(select, value, value, select.options[1] || null);
            }

            select.value = value;
        });
    }
}

function setupVorinTimeSelects(root = document) {
    root.querySelectorAll?.('.change-form #content-main input.vTimeField:not([data-no-vorin-time-select="1"])').forEach(enhanceVorinTimeInput);
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

function relocateVorinDatetimeNotes(control, row) {
    if (!control || !row) {
        return;
    }

    // Django's DateTimeShortcuts.js appends its timezone-mismatch warning as
    // the last child of the input's *current* parent, whatever that is at
    // the time it runs. Once vorin_panel.js has moved the input into
    // .vorin-datetime-row__control, that's where the warning lands too --
    // inflating the height of the absolutely-positioned control and pushing
    // the picker icon down to overlap the note. Pull it out to sit below
    // the control instead.
    control.querySelectorAll(":scope > .timezonewarning").forEach((note) => {
        note.classList.add("vorin-datetime-row__note");
        row.appendChild(note);
    });
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
            const rows = block.querySelectorAll(".vorin-datetime-row");
            const controls = block.querySelectorAll(".vorin-datetime-row__control");
            if (controls[0] && dateShortcuts && !controls[0].contains(dateShortcuts)) {
                controls[0].appendChild(dateShortcuts);
            }
            if (controls[1] && timeShortcuts && !controls[1].contains(timeShortcuts)) {
                controls[1].appendChild(timeShortcuts);
            }
            relocateVorinDatetimeNotes(controls[0], rows[0]);
            relocateVorinDatetimeNotes(controls[1], rows[1]);
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

        const dateRow = makeRow("Date", dateInput, dateShortcuts);
        const timeRow = makeRow("Time", timeInput, timeShortcuts);

        const stack = document.createElement("div");
        stack.className = "vorin-datetime-stack";
        stack.appendChild(dateRow);
        stack.appendChild(timeRow);

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
                    if (input.dataset.vorinEnhancedTime === "1") {
                        return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    window.setTimeout(() => {
                        input.focus();
                        openVorinPicker(input);
                    }, 0);
                });

                input.addEventListener("keydown", (event) => {
                    if (input.dataset.vorinEnhancedTime === "1") {
                        return;
                    }

                    if (event.key === "ArrowDown" || event.key === "Enter") {
                        event.preventDefault();
                        openVorinPicker(input);
                    }
                });
            }
        });
}

let vorinEnhancementObserverStarted = false;

function getVorinFileInputLabel(input) {
    if (input.files?.length === 1) return input.files[0].name;
    if (input.files?.length > 1) return `${input.files.length} files selected`;
    return "No file selected";
}

function enhanceVorinFileInputs(root = document) {
    root.querySelectorAll('input[type="file"]').forEach((input) => {
        if (
            input.dataset.vorinFileEnhanced === "1" ||
            input.dataset.venuexEnhanced === "true" ||
            input.closest(".vorin-file-input, .venuex-admin-file-input")
        ) return;

        input.dataset.vorinFileEnhanced = "1";
        const wrapper = document.createElement("label");
        const button = document.createElement("span");
        const filename = document.createElement("span");
        wrapper.className = "vorin-file-input";
        button.className = "vorin-file-input__button";
        button.textContent = input.dataset.buttonLabel || "Select file";
        filename.className = "vorin-file-input__name";
        filename.textContent = getVorinFileInputLabel(input);
        input.classList.add("vorin-file-input__native");

        input.parentNode.insertBefore(wrapper, input);
        wrapper.append(input, button, filename);
        input.addEventListener("change", () => {
            filename.textContent = getVorinFileInputLabel(input);
            wrapper.classList.toggle("has-file", Boolean(input.files?.length));
        });
    });
}

function enhanceVorinNumberInputs(root = document) {
    root.querySelectorAll('input[type="number"]').forEach((input) => {
        if (input.dataset.vorinNumberEnhanced === "1" || input.closest(".vorin-number-input")) return;

        input.dataset.vorinNumberEnhanced = "1";
        const wrapper = document.createElement("div");
        const decrement = document.createElement("button");
        const increment = document.createElement("button");
        wrapper.className = "vorin-number-input";
        decrement.type = "button";
        increment.type = "button";
        decrement.className = "vorin-number-input__button";
        increment.className = "vorin-number-input__button";
        decrement.textContent = "−";
        increment.textContent = "+";
        decrement.setAttribute("aria-label", "Decrease value");
        increment.setAttribute("aria-label", "Increase value");

        input.parentNode.insertBefore(wrapper, input);
        wrapper.append(decrement, input, increment);
        const step = (direction) => {
            direction < 0 ? input.stepDown() : input.stepUp();
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
        };
        decrement.addEventListener("click", () => step(-1));
        increment.addEventListener("click", () => step(1));
    });
}

function parseVorinMetadataValue(value) {
    const trimmed = value.trim();
    if (!trimmed) return "";

    if (
        trimmed === "true" ||
        trimmed === "false" ||
        trimmed === "null" ||
        /^-?\d+(\.\d+)?$/.test(trimmed) ||
        trimmed.startsWith("{") ||
        trimmed.startsWith("[")
    ) {
        try {
            return JSON.parse(trimmed);
        } catch (_error) {
            return value;
        }
    }
    return value;
}

function formatVorinMetadataValue(value) {
    if (value !== null && typeof value === "object") {
        return JSON.stringify(value);
    }
    return value === null ? "null" : String(value);
}

function enhanceVorinKeyValueEditors(root = document) {
    root.querySelectorAll('textarea[data-vorin-key-value-editor="true"]').forEach((source) => {
        if (source.dataset.vorinKeyValueEnhanced === "1") return;

        let values;
        try {
            values = JSON.parse(source.value || "{}");
        } catch (_error) {
            return;
        }
        if (!values || Array.isArray(values) || typeof values !== "object") return;

        source.dataset.vorinKeyValueEnhanced = "1";
        source.classList.add("vorin-key-value-editor__source");

        const editor = document.createElement("div");
        const list = document.createElement("div");
        const add = document.createElement("button");
        editor.className = "vorin-key-value-editor";
        list.className = "vorin-key-value-editor__list";
        add.type = "button";
        add.className = "vorin-key-value-editor__add";
        add.textContent = "Add information";
        source.insertAdjacentElement("afterend", editor);
        editor.append(list, add);

        const sync = () => {
            const nextValue = {};
            list.querySelectorAll(".vorin-key-value-editor__row").forEach((row) => {
                const key = row.querySelector('[data-vorin-metadata-part="key"]').value.trim();
                const value = row.querySelector('[data-vorin-metadata-part="value"]').value;
                if (key) nextValue[key] = parseVorinMetadataValue(value);
            });
            source.value = JSON.stringify(nextValue, null, 2);
        };

        const addRow = (key = "", value = "") => {
            const row = document.createElement("div");
            const keyInput = document.createElement("input");
            const valueInput = document.createElement("input");
            const remove = document.createElement("button");
            row.className = "vorin-key-value-editor__row";
            keyInput.type = "text";
            keyInput.placeholder = "Label";
            keyInput.value = key;
            keyInput.dataset.vorinMetadataPart = "key";
            keyInput.setAttribute("aria-label", "Information label");
            valueInput.type = "text";
            valueInput.placeholder = "Value";
            valueInput.value = formatVorinMetadataValue(value);
            valueInput.dataset.vorinMetadataPart = "value";
            valueInput.setAttribute("aria-label", "Information value");
            remove.type = "button";
            remove.className = "vorin-key-value-editor__remove";
            remove.textContent = "×";
            remove.setAttribute("aria-label", "Remove information");
            row.append(keyInput, valueInput, remove);
            list.append(row);
            keyInput.addEventListener("input", sync);
            valueInput.addEventListener("input", sync);
            remove.addEventListener("click", () => {
                row.remove();
                sync();
            });
            return row;
        };

        Object.entries(values).forEach(([key, value]) => addRow(key, value));
        add.addEventListener("click", () => {
            const row = addRow();
            row.querySelector("input").focus();
        });
        source.form?.addEventListener("submit", sync);
        sync();
    });
}

const VORIN_RICH_EDITOR_SCROLLBAR_STYLE_ID = "vorin-rich-editor-scrollbars";

function getVorinRichEditorScrollbarCss() {
    const dark = document.documentElement.classList.contains("dark");
    const track = dark ? "#0b1426" : "#edf1f5";
    const thumb = dark ? "#d8c29a" : "#52637d";
    const hover = dark ? "#f1e0bf" : "#30425f";

    return `
        :root, body {
            scrollbar-color: ${thumb} ${track};
            scrollbar-width: thin;
        }
        :root::-webkit-scrollbar, body::-webkit-scrollbar {
            height: 11px;
            width: 11px;
        }
        :root::-webkit-scrollbar-track, body::-webkit-scrollbar-track {
            background: ${track};
        }
        :root::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb {
            background: ${thumb};
            border: 3px solid ${track};
            border-radius: 999px;
            min-height: 42px;
        }
        :root::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover {
            background: ${hover};
        }
        :root::-webkit-scrollbar-corner, body::-webkit-scrollbar-corner {
            background: ${track};
        }
    `;
}

function skinVorinRichEditorIframe(iframe) {
    try {
        const iframeDocument = iframe.contentDocument;

        if (!iframeDocument?.head) {
            return;
        }

        let style = iframeDocument.getElementById(VORIN_RICH_EDITOR_SCROLLBAR_STYLE_ID);

        if (!style) {
            style = iframeDocument.createElement("style");
            style.id = VORIN_RICH_EDITOR_SCROLLBAR_STYLE_ID;
            iframeDocument.head.appendChild(style);
        }

        style.textContent = getVorinRichEditorScrollbarCss();
    } catch {}
}

function setupVorinRichEditorScrollbars() {
    document.querySelectorAll("iframe.tox-edit-area__iframe").forEach((iframe) => {
        if (iframe.dataset.vorinScrollbarBound !== "true") {
            iframe.dataset.vorinScrollbarBound = "true";
            iframe.addEventListener("load", () => skinVorinRichEditorIframe(iframe));
        }

        skinVorinRichEditorIframe(iframe);
    });
}

window.addEventListener("vorin:themechange", setupVorinRichEditorScrollbars);

function scheduleVorinEnhancements() {
    window.clearTimeout(window.__vorinEnhanceTimer);
    window.__vorinEnhanceTimer = window.setTimeout(() => {
        setupVorinAutocompleteFields();
        setupVorinPlainSelects();
        enhanceVorinSplitDateTimeFields();
        setupVorinDateTimeInputs();
        setupVorinTimeSelects();
        setupVorinFileInputs();
        setupVorinNumberInputs();
        setupVorinMediaCards();
        enhanceVorinFileInputs();
        enhanceVorinNumberInputs();
        enhanceVorinKeyValueEditors();
        setupVorinRichEditorScrollbars();
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
                        node.matches?.('select, input, textarea[data-vorin-key-value-editor="true"], p.datetime, .related-widget-wrapper, .vorin-admin-media-card__frame img, iframe.tox-edit-area__iframe') ||
                        node.querySelector?.('select, input, textarea[data-vorin-key-value-editor="true"], p.datetime, .related-widget-wrapper, .vorin-admin-media-card__frame img, iframe.tox-edit-area__iframe')
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

        if (select.dataset.vorinBulkActionBound !== "1") {
            select.addEventListener("change", syncState);
            select.dataset.vorinBulkActionBound = "1";
        }

        syncState();
    });
}

function setupVorinAvatarEditors(root = document) {
    root.querySelectorAll?.("[data-vorin-avatar-editor]").forEach((editor) => {
        if (editor.dataset.vorinAvatarEditorBound === "1") {
            return;
        }

        const input = editor.querySelector('input[type="file"]');
        const preview = editor.querySelector("[data-vorin-avatar-preview] .vorin-avatar");
        const trigger = editor.querySelector("[data-vorin-avatar-trigger]");
        const modal = editor.querySelector("[data-vorin-avatar-modal]");
        const modalPanel = editor.querySelector("[data-vorin-avatar-modal-panel]");
        const uploadButton = editor.querySelector("[data-vorin-avatar-upload]");
        const librarySelect = editor.querySelector("[data-vorin-avatar-library] select");
        const filename = editor.querySelector("[data-vorin-avatar-filename]");
        const clear = editor.querySelector("[data-vorin-avatar-clear]");

        if (!input || !preview) {
            return;
        }

        editor.dataset.vorinAvatarEditorBound = "1";

        const setModalOpen = (open) => {
            if (!modal || !trigger) return;
            const wasOpen = !modal.hidden;
            if (!open && !wasOpen) return;

            modal.hidden = !open;
            editor.classList.toggle("is-choosing-avatar", open);
            trigger.setAttribute("aria-expanded", open ? "true" : "false");
            if (open) {
                window.requestAnimationFrame(() => {
                    const focusTarget = uploadButton || librarySelect || modalPanel;
                    focusTarget?.focus?.({ preventScroll: true });
                });
            } else {
                trigger.focus({ preventScroll: true });
            }
        };

        trigger?.addEventListener("click", (event) => {
            event.preventDefault();
            setModalOpen(Boolean(modal?.hidden));
        });

        modal?.addEventListener("click", (event) => {
            if (event.target === modal) {
                setModalOpen(false);
            }
        });

        modal?.querySelectorAll("[data-vorin-avatar-close]").forEach((button) => {
            button.addEventListener("click", () => setModalOpen(false));
        });

        uploadButton?.addEventListener("click", () => {
            input.click();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                setModalOpen(false);
            }
        });

        librarySelect?.addEventListener("change", () => {
            if (librarySelect.value) {
                input.value = "";
                setModalOpen(false);
            }
        });

        input.addEventListener("change", () => {
            const file = input.files?.[0];
            if (!file) {
                if (filename) filename.textContent = "No image selected";
                return;
            }

            if (librarySelect) librarySelect.value = "";
            if (filename) filename.textContent = file.name;
            if (clear) {
                clear.checked = false;
                editor.classList.remove("is-clearing");
            }

            const image = document.createElement("img");
            image.className = "vorin-avatar__image";
            image.alt = "Selected profile image preview";
            image.src = URL.createObjectURL(file);
            image.onload = () => URL.revokeObjectURL(image.src);

            preview.replaceChildren(image);
            setModalOpen(false);
        });

        clear?.addEventListener("change", () => {
            editor.classList.toggle("is-clearing", clear.checked);
            if (clear.checked) {
                input.value = "";
                if (filename) filename.textContent = "Image will be removed";
            }
        });
    });
}

function vorinPanelInitOnContentLoaded() {
    cleanupVorinBrowserState();
    setupVorinThemeSwitch();
    setupVorinCommandLauncher();
    setupVorinSidebarToggle();
    setupVorinMenus();
    setupVorinHistoryButtons();
    setupVorinStickyActionBar();
    setupVorinQuestionnaireBuilder();
    setupVorinAutoSlug();
    setupVorinMediaCards();
    enhanceVorinFileInputs();
    enhanceVorinNumberInputs();
    enhanceVorinKeyValueEditors();
    setupVorinRichEditorScrollbars();
    setupVorinAutocompleteFields();
    setupVorinPlainSelects();
    setupVorinBulkActions();
    setupVorinFileInputs();
    setupVorinNumberInputs();
    enhanceVorinSplitDateTimeFields();
    setupVorinDateTimeInputs();
    setupVorinTimeSelects();
    setupVorinAvatarEditors();
    setupVorinThemeMediaWatcher();
    setupVorinEnhancementObserver();
    window.setTimeout(setupVorinAutocompleteFields, 120);
    window.setTimeout(setupVorinPlainSelects, 120);
    window.setTimeout(setupVorinBulkActions, 120);
    window.setTimeout(setupVorinFileInputs, 120);
    window.setTimeout(setupVorinNumberInputs, 120);
    window.setTimeout(setupVorinRichEditorScrollbars, 120);
    window.setTimeout(setupVorinAutocompleteFields, 500);
    window.setTimeout(setupVorinPlainSelects, 500);
    window.setTimeout(setupVorinBulkActions, 500);
    window.setTimeout(setupVorinFileInputs, 500);
    window.setTimeout(setupVorinNumberInputs, 500);
    window.setTimeout(setupVorinRichEditorScrollbars, 500);
    window.setTimeout(enhanceVorinSplitDateTimeFields, 120);
    window.setTimeout(setupVorinDateTimeInputs, 120);
    window.setTimeout(setupVorinTimeSelects, 180);
    window.setTimeout(setupVorinAutocompleteFields, 1000);
    window.setTimeout(setupVorinPlainSelects, 1000);
    window.setTimeout(setupVorinBulkActions, 1000);
    window.setTimeout(enhanceVorinSplitDateTimeFields, 500);
    window.setTimeout(setupVorinDateTimeInputs, 500);
    window.setTimeout(setupVorinTimeSelects, 700);
    window.setTimeout(setupVorinAvatarEditors, 120);
}

function vorinPanelInitOnLoad() {
    setupVorinStickyActionBar();
    setupVorinAutocompleteFields();
    setupVorinPlainSelects();
    setupVorinBulkActions();
    setupVorinFileInputs();
    setupVorinNumberInputs();
    enhanceVorinSplitDateTimeFields();
    setupVorinDateTimeInputs();
    setupVorinTimeSelects();
    setupVorinAvatarEditors();
    enhanceVorinKeyValueEditors();
    setupVorinRichEditorScrollbars();
    setupVorinEnhancementObserver();
}

// A plain `window.addEventListener("DOMContentLoaded", ...)` is only safe
// when this script itself is guaranteed to run before that event fires.
// It normally is (this is a deferred script), but on at least one real
// deployment the event fired without ever invoking a listener that had
// already been registered against it -- confirmed via Chrome DevTools
// Protocol (DOMDebugger.getEventListeners came back empty on the affected
// page, byte-identical script, working fine on another project's
// deployment of the same file), and confirmed the registered callback
// itself is not at fault: manually replaying the exact captured callback
// reference worked perfectly. Whatever the precise browser/edge-network
// cause, checking readyState and running immediately when the document is
// already past "loading" is the standard defensive fix for exactly this
// class of problem, and costs nothing on the normal path.
if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", vorinPanelInitOnContentLoaded);
} else {
    vorinPanelInitOnContentLoaded();
}

if (document.readyState === "complete") {
    vorinPanelInitOnLoad();
} else {
    window.addEventListener("load", vorinPanelInitOnLoad);
}
