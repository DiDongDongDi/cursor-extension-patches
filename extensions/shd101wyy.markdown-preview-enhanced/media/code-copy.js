// 为 MPE 预览的代码块添加复制按钮。
// 上游只有块级 .floating-action（复制的是带围栏的 markdown 源码），这里按代码块粒度复制纯文本。
(function () {
    "use strict";

    var BTN_CLASS = "mpe-code-copy-btn";
    var COPIED_ATTR = "data-copied";
    var RESET_MS = 1500;
    // 与 MPE 一致：这些语言会被渲染成图，不加按钮
    var DIAGRAM_LANGS = [
        "mermaid",
        "wavedrom",
        "puml",
        "plantuml",
        "bitfield",
        "bit-field",
        "graphviz",
        "viz",
        "dot",
        "vega",
        "vega-lite",
        "wsd",
        "d2",
        "tikz",
    ];

    var copySvg =
        '<svg class="mpe-icon-copy" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M3.75 1.5h6.5c.966 0 1.75.784 1.75 1.75v1h-1.5v-1a.25.25 0 0 0-.25-.25h-6.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h1v1.5h-1a1.75 1.75 0 0 1-1.75-1.75v-8.5c0-.966.784-1.75 1.75-1.75Zm3 3h6.5c.966 0 1.75.784 1.75 1.75v6.5A1.75 1.75 0 0 1 13.25 14.5h-6.5A1.75 1.75 0 0 1 5 12.75v-6.5C5 5.284 5.784 4.5 6.75 4.5Zm-.25 8.25c0 .138.112.25.25.25h6.5a.25.25 0 0 0 .25-.25v-6.5a.25.25 0 0 0-.25-.25h-6.5a.25.25 0 0 0-.25.25v6.5Z"></path></svg>';
    var checkSvg =
        '<svg class="mpe-icon-check" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06L7 9.69l5.47-5.47a.75.75 0 0 1 1.06 0Z"></path></svg>';

    var timers = new WeakMap();

    function langOf(pre) {
        var info = (pre.getAttribute("data-info") || "").trim();
        if (info) return info.split(/\s+/)[0].toLowerCase();
        var m = /(?:^|\s)language-([\w-]+)/.exec(pre.className || "");
        return m ? m[1].toLowerCase() : "";
    }

    function shouldSkip(pre, code) {
        if (DIAGRAM_LANGS.indexOf(langOf(pre)) >= 0) return true;
        if (pre.querySelector("svg:not(.mpe-icon-copy):not(.mpe-icon-check)"))
            return true;
        return !(code.textContent || "").trim();
    }

    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).catch(function () {
                return legacyCopy(text);
            });
        }
        return Promise.resolve(legacyCopy(text));
    }

    function legacyCopy(text) {
        var area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.top = "-1000px";
        document.body.appendChild(area);
        area.focus();
        area.select();
        try {
            document.execCommand("copy");
        } catch (err) {
            /* ignore */
        }
        area.remove();
    }

    function markCopied(button) {
        button.setAttribute(COPIED_ATTR, "true");
        button.title = "已复制";
        var old = timers.get(button);
        if (old) clearTimeout(old);
        timers.set(
            button,
            setTimeout(function () {
                button.setAttribute(COPIED_ATTR, "false");
                button.title = "复制代码";
                timers.delete(button);
            }, RESET_MS),
        );
    }

    function createButton(code) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = BTN_CLASS;
        button.title = "复制代码";
        button.setAttribute("aria-label", "复制代码");
        button.setAttribute(COPIED_ATTR, "false");
        button.innerHTML = copySvg + checkSvg;
        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var text = (code.textContent || "").replace(/\n+$/, "");
            copyText(text).then(function () {
                markCopied(button);
            });
        });
        // 避免触发预览的双击跳原文
        button.addEventListener("dblclick", function (event) {
            event.preventDefault();
            event.stopPropagation();
        });
        return button;
    }

    function ensureButtons() {
        var codes = document.querySelectorAll(".markdown-preview pre > code");
        for (var i = 0; i < codes.length; i++) {
            var code = codes[i];
            var pre = code.parentElement;
            if (!pre || shouldSkip(pre, code)) continue;
            if (pre.querySelector("button." + BTN_CLASS)) continue;
            pre.insertBefore(createButton(code), pre.firstChild);
        }
    }

    function boot() {
        if (!document.body) {
            requestAnimationFrame(boot);
            return;
        }
        var scheduled = false;
        var rerender = function () {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(function () {
                scheduled = false;
                ensureButtons();
            });
        };
        rerender();
        new MutationObserver(rerender).observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
