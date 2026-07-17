(function () {
    const SELECTOR = "pre.mermaid";
    const MAX_RETRIES = 40;
    let initialized = false;
    let retries = 0;
    let scheduled = false;
    let observer;

    const theme = () => {
        if (document.body.classList.contains("vscode-dark")) {
            return "dark";
        }

        return "default";
    };

    const getBlocks = () =>
        Array.from(document.querySelectorAll(SELECTOR)).filter((block) => {
            if (block.dataset.processed || block.dataset.mdpaMermaidError) {
                return false;
            }

            if (
                block.querySelector("svg") ||
                block.querySelector('[id^="dmermaid-"]')
            ) {
                block.dataset.processed = "true";
                return false;
            }

            return true;
        });

    const showError = (block, error) => {
        block.dataset.mdpaMermaidError = "true";
        block.classList.add("mdpa-mermaid-error");
        block.textContent =
            error && error.message ? error.message : String(error);
    };

    const render = async () => {
        const mermaid = window.mermaid;
        if (!mermaid) {
            if (retries < MAX_RETRIES) {
                retries += 1;
                window.setTimeout(render, 100);
            }
            return;
        }

        if (!initialized) {
            mermaid.initialize({
                startOnLoad: false,
                securityLevel: "strict",
                theme: theme(),
            });
            initialized = true;
        }

        const blocks = getBlocks();
        for (const block of blocks) {
            try {
                await mermaid.run({ nodes: [block] });
            } catch (error) {
                showError(block, error);
            }
        }
    };

    const scheduleRender = () => {
        if (scheduled) {
            return;
        }

        scheduled = true;
        window.requestAnimationFrame(() => {
            scheduled = false;
            render();
        });
    };

    const init = () => {
        observer = new MutationObserver(scheduleRender);
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener("load", scheduleRender);
        scheduleRender();
    };

    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
