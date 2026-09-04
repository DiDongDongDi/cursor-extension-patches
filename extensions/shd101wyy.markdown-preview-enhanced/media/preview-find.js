// MPE 预览内建查找：Cursor 的 webview 原生 Find（enableFindWidget）会出框但搜不到。
// 拦截 Cmd/Ctrl+F，用 DOM 高亮 + 跳转替代。
(function () {
    "use strict";

    if (window.__mpePreviewFindInstalled) return;
    window.__mpePreviewFindInstalled = true;

    var SKIP_TAGS = {
        SCRIPT: 1,
        STYLE: 1,
        NOSCRIPT: 1,
        TEXTAREA: 1,
        INPUT: 1,
        SELECT: 1,
        BUTTON: 1,
        SVG: 1,
    };

    var bar = null;
    var input = null;
    var countEl = null;
    var caseBtn = null;
    var prevBtn = null;
    var nextBtn = null;
    var closeBtn = null;

    var matches = [];
    var current = -1;
    var caseSensitive = false;
    var lastQuery = "";
    var applying = false;
    var reapplyTimer = null;

    function isMac() {
        return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || "");
    }

    function ensureBar() {
        if (bar) return;
        bar = document.createElement("div");
        bar.className = "mpe-find-bar";
        bar.setAttribute("role", "search");
        bar.hidden = true;
        bar.innerHTML =
            '<input type="search" placeholder="查找…" autocomplete="off" spellcheck="false" aria-label="查找">' +
            '<span class="mpe-find-count" aria-live="polite">0/0</span>' +
            '<button type="button" class="mpe-find-case" title="区分大小写" aria-pressed="false">Aa</button>' +
            '<button type="button" class="mpe-find-prev" title="上一个">↑</button>' +
            '<button type="button" class="mpe-find-next" title="下一个">↓</button>' +
            '<button type="button" class="mpe-find-close" title="关闭">✕</button>';
        document.body.appendChild(bar);

        input = bar.querySelector('input[type="search"]');
        countEl = bar.querySelector(".mpe-find-count");
        caseBtn = bar.querySelector(".mpe-find-case");
        prevBtn = bar.querySelector(".mpe-find-prev");
        nextBtn = bar.querySelector(".mpe-find-next");
        closeBtn = bar.querySelector(".mpe-find-close");

        input.addEventListener("input", function () {
            runSearch(input.value, true);
        });
        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                if (e.shiftKey) gotoPrev();
                else gotoNext();
            } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                hide();
            }
        });
        caseBtn.addEventListener("click", function () {
            caseSensitive = !caseSensitive;
            caseBtn.setAttribute("aria-pressed", caseSensitive ? "true" : "false");
            runSearch(input.value, true);
            input.focus();
        });
        prevBtn.addEventListener("click", function () {
            gotoPrev();
            input.focus();
        });
        nextBtn.addEventListener("click", function () {
            gotoNext();
            input.focus();
        });
        closeBtn.addEventListener("click", hide);

        // 避免点击查找条时触发预览其它手势
        bar.addEventListener("mousedown", function (e) {
            e.stopPropagation();
        });
        bar.addEventListener("dblclick", function (e) {
            e.stopPropagation();
        });
    }

    function clearHighlights() {
        var marks = document.querySelectorAll("mark.mpe-find-hit");
        for (var i = 0; i < marks.length; i++) {
            var mark = marks[i];
            var parent = mark.parentNode;
            if (!parent) continue;
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
            parent.removeChild(mark);
            parent.normalize();
        }
        matches = [];
        current = -1;
    }

    function collectTextNodes(root) {
        var out = [];
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (!node.nodeValue || !node.nodeValue.trim()) {
                    return NodeFilter.FILTER_REJECT;
                }
                var p = node.parentElement;
                if (!p) return NodeFilter.FILTER_REJECT;
                if (SKIP_TAGS[p.tagName]) return NodeFilter.FILTER_REJECT;
                if (p.closest && p.closest(".mpe-find-bar, .mpe-lightbox-overlay")) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (p.closest && p.closest("mark.mpe-find-hit")) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            },
        });
        var n;
        while ((n = walker.nextNode())) out.push(n);
        return out;
    }

    function escapeRegExp(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function runSearch(query, keepPosition) {
        ensureBar();
        applying = true;
        try {
            clearHighlights();
            lastQuery = query || "";
            var q = (query || "").trim();
            if (!q) {
                updateCount();
                return;
            }

            var root = document.getElementById("preview-panel") || document.body;
            var nodes = collectTextNodes(root);
            var flags = caseSensitive ? "g" : "gi";
            var re;
            try {
                re = new RegExp(escapeRegExp(q), flags);
            } catch (err) {
                updateCount();
                return;
            }

            for (var i = 0; i < nodes.length; i++) {
                wrapMatchesInTextNode(nodes[i], re);
            }

            matches = Array.prototype.slice.call(
                document.querySelectorAll("mark.mpe-find-hit")
            );
            if (matches.length === 0) {
                current = -1;
                updateCount();
                return;
            }

            if (keepPosition && current >= 0 && current < matches.length) {
                setCurrent(current);
            } else {
                setCurrent(0);
            }
        } finally {
            applying = false;
        }
    }

    function wrapMatchesInTextNode(textNode, re) {
        var text = textNode.nodeValue;
        re.lastIndex = 0;
        var match;
        var lastIndex = 0;
        var frag = document.createDocumentFragment();
        var found = false;

        while ((match = re.exec(text)) !== null) {
            found = true;
            if (match.index > lastIndex) {
                frag.appendChild(
                    document.createTextNode(text.slice(lastIndex, match.index))
                );
            }
            var mark = document.createElement("mark");
            mark.className = "mpe-find-hit";
            mark.textContent = match[0];
            frag.appendChild(mark);
            lastIndex = match.index + match[0].length;
            if (match[0].length === 0) {
                re.lastIndex++;
            }
        }
        if (!found) return;
        if (lastIndex < text.length) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        textNode.parentNode.replaceChild(frag, textNode);
    }

    function setCurrent(index) {
        if (!matches.length) {
            current = -1;
            updateCount();
            return;
        }
        if (current >= 0 && current < matches.length) {
            matches[current].classList.remove("mpe-find-current");
        }
        current = ((index % matches.length) + matches.length) % matches.length;
        var el = matches[current];
        el.classList.add("mpe-find-current");
        try {
            el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        } catch (err) {
            el.scrollIntoView(true);
        }
        updateCount();
    }

    function updateCount() {
        if (!countEl) return;
        if (!lastQuery.trim()) {
            countEl.textContent = "0/0";
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return;
        }
        if (!matches.length) {
            countEl.textContent = "0/0";
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return;
        }
        countEl.textContent = current + 1 + "/" + matches.length;
        prevBtn.disabled = false;
        nextBtn.disabled = false;
    }

    function gotoNext() {
        if (!matches.length) return;
        setCurrent(current + 1);
    }

    function gotoPrev() {
        if (!matches.length) return;
        setCurrent(current - 1);
    }

    function show(initial) {
        ensureBar();
        bar.hidden = false;
        if (typeof initial === "string") {
            input.value = initial;
        }
        input.focus();
        input.select();
        runSearch(input.value, false);
    }

    function hide() {
        if (!bar) return;
        applying = true;
        try {
            clearHighlights();
            lastQuery = "";
            updateCount();
            bar.hidden = true;
            if (input) input.blur();
        } finally {
            applying = false;
        }
    }

    function isFindShortcut(e) {
        var mod = isMac() ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
        return mod && !e.altKey && !e.shiftKey && (e.key === "f" || e.key === "F");
    }

    function isFindNextShortcut(e) {
        // Cmd+G / Ctrl+G / F3
        if (e.key === "F3") return !e.altKey && !e.metaKey && !e.ctrlKey;
        var mod = isMac() ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
        return mod && !e.altKey && (e.key === "g" || e.key === "G");
    }

    document.addEventListener(
        "keydown",
        function (e) {
            if (e.defaultPrevented) return;

            // 灯箱打开时不抢快捷键
            if (
                document.querySelector(
                    ".mpe-lightbox-overlay.mpe-lightbox-visible"
                )
            ) {
                return;
            }

            if (isFindShortcut(e)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                show();
                return;
            }

            if (bar && !bar.hidden && isFindNextShortcut(e)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (e.shiftKey) gotoPrev();
                else gotoNext();
                return;
            }

            if (bar && !bar.hidden && e.key === "Escape") {
                // 输入框自己处理；点在预览正文时 Esc 也关查找条
                if (document.activeElement !== input) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    hide();
                }
            }
        },
        true
    );

    function scheduleReapply() {
        if (applying || !bar || bar.hidden || !lastQuery.trim()) return;
        if (reapplyTimer) clearTimeout(reapplyTimer);
        reapplyTimer = setTimeout(function () {
            reapplyTimer = null;
            if (applying || !bar || bar.hidden || !lastQuery.trim()) return;
            var still =
                matches.length > 0 &&
                matches.every(function (m) {
                    return document.body.contains(m);
                });
            if (!still) runSearch(lastQuery, true);
        }, 80);
    }

    // 预览 live update 会整段替换 DOM；防抖重建高亮
    var mo = new MutationObserver(function () {
        if (applying) return;
        if (!bar || bar.hidden) return;
        if (!document.body.contains(bar)) {
            bar = null;
            ensureBar();
            bar.hidden = false;
            if (input) input.value = lastQuery;
        }
        scheduleReapply();
    });

    function observe() {
        if (!document.body) return;
        mo.observe(document.body, { childList: true, subtree: true });
    }
    if (document.body) observe();
    else document.addEventListener("DOMContentLoaded", observe);
})();
