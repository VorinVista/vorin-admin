(function () {
    "use strict";

    let generatedPasswordId = 0;

    const eyeIcon = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M2.2 12s3.6-6 9.8-6 9.8 6 9.8 6-3.6 6-9.8 6-9.8-6-9.8-6Z"></path>
            <circle cx="12" cy="12" r="2.7"></circle>
        </svg>`;
    const eyeOffIcon = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m3 3 18 18"></path>
            <path d="M10.6 6.1A10.7 10.7 0 0 1 12 6c6.2 0 9.8 6 9.8 6a16.4 16.4 0 0 1-2.3 3"></path>
            <path d="M6.2 6.2C3.7 8 2.2 12 2.2 12s3.6 6 9.8 6a10 10 0 0 0 3-.4"></path>
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>
        </svg>`;

    function syncPasswordToggle(button, input, isVisible) {
        const label = isVisible ? "Hide password" : "Show password";
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-pressed", isVisible ? "true" : "false");
        button.setAttribute("title", label);
        button.innerHTML = isVisible ? eyeOffIcon : eyeIcon;
        input.dataset.passwordVisible = isVisible ? "true" : "false";
    }

    function enhancePasswordInput(input) {
        if (input.dataset.passwordToggleEnhanced === "true") {
            return;
        }

        input.dataset.passwordToggleEnhanced = "true";
        input.id = input.id || `vorin-password-${++generatedPasswordId}`;

        const wrapper = document.createElement("div");
        const button = document.createElement("button");
        wrapper.className = "vorin-password-control";
        button.className = "vorin-password-toggle";
        button.type = "button";
        button.setAttribute("aria-controls", input.id);

        input.parentNode.insertBefore(wrapper, input);
        wrapper.append(input, button);
        syncPasswordToggle(button, input, false);

        button.addEventListener("click", () => {
            const selectionStart = input.selectionStart;
            const selectionEnd = input.selectionEnd;
            const isVisible = input.type === "password";

            input.type = isVisible ? "text" : "password";
            syncPasswordToggle(button, input, isVisible);
            input.focus({ preventScroll: true });

            if (selectionStart !== null && selectionEnd !== null) {
                input.setSelectionRange(selectionStart, selectionEnd);
            }
        });
    }

    function setupPasswordVisibility(root) {
        root.querySelectorAll('input[type="password"]').forEach(enhancePasswordInput);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => setupPasswordVisibility(document));
    } else {
        setupPasswordVisibility(document);
    }
})();
