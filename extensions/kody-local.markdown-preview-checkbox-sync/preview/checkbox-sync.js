(function () {
    const LINK_ID = "kody-markdown-preview-checkbox-sync-link";
    // Cursor 用 cursor://；VS Code 用 vscode://
    const URI_SCHEME = "cursor";
    const EXTENSION_URI = `${URI_SCHEME}://kody-local.markdown-preview-checkbox-sync/toggle`;

    function ensureHiddenLink() {
        let link = document.getElementById(LINK_ID);
        if (link) {
            return link;
        }

        link = document.createElement("a");
        link.id = LINK_ID;
        link.hidden = true;
        link.href = EXTENSION_URI;
        document.body.appendChild(link);
        return link;
    }

    function enablePreviewCheckboxes() {
        document
            .querySelectorAll(".task-list-item-checkbox")
            .forEach((checkbox) => {
                checkbox.removeAttribute("disabled");
            });
    }

    function getDocumentResource() {
        const dataElement = document.getElementById(
            "vscode-markdown-preview-data",
        );
        const settingsRaw = dataElement?.getAttribute("data-settings");
        if (!settingsRaw) {
            return "";
        }

        try {
            return JSON.parse(settingsRaw).source ?? "";
        } catch {
            return "";
        }
    }

    function findSourceLine(checkbox) {
        const listItem = checkbox.closest("li");
        if (listItem) {
            const lineElement =
                listItem.classList.contains("code-line") &&
                listItem.hasAttribute("data-line")
                    ? listItem
                    : listItem.querySelector("[data-line]");
            if (lineElement) {
                const line = Number.parseInt(
                    lineElement.getAttribute("data-line") ?? "",
                    10,
                );
                if (!Number.isNaN(line)) {
                    return line;
                }
            }
        }

        const fallback = checkbox.closest("[data-line]");
        if (!fallback) {
            return null;
        }

        const line = Number.parseInt(
            fallback.getAttribute("data-line") ?? "",
            10,
        );
        return Number.isNaN(line) ? null : line;
    }

    function sendToggle(line, checked) {
        const resource = getDocumentResource();
        if (!resource) {
            return;
        }

        const link = ensureHiddenLink();
        link.setAttribute(
            "href",
            `${EXTENSION_URI}?line=${line}&checked=${checked ? "true" : "false"}&resource=${encodeURIComponent(resource)}`,
        );
        link.click();
    }

    document.addEventListener(
        "change",
        (event) => {
            const checkbox = event.target;
            if (!(checkbox instanceof HTMLInputElement)) {
                return;
            }
            if (!checkbox.classList.contains("task-list-item-checkbox")) {
                return;
            }

            const line = findSourceLine(checkbox);
            if (line === null) {
                return;
            }

            sendToggle(line, checkbox.checked);
        },
        true,
    );

    window.addEventListener("vscode.markdown.updateContent", () => {
        enablePreviewCheckboxes();
        ensureHiddenLink();
    });

    enablePreviewCheckboxes();
    ensureHiddenLink();
})();
