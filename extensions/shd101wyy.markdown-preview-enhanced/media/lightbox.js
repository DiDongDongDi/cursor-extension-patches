// Lightbox: click-to-enlarge + wheel zoom + drag pan for Markdown Preview Enhanced
(function () {
    "use strict";

    var overlay;
    var lightboxImg;
    var scale = 1;
    var minScale = 0.1;
    var MAX = 4;
    var offsetX = 0;
    var offsetY = 0;
    var dragging = false;
    var dragMoved = false;
    var startX = 0;
    var startY = 0;
    var originX = 0;
    var originY = 0;
    var imageClickTimer = null;

    function getVsCodeApi() {
        return window.__mpeVsCodeApi || null;
    }

    function getSourceUri() {
        var el = document.getElementById("crossnote-data");
        if (!el) return null;
        try {
            var cfg = JSON.parse(el.getAttribute("data-config") || "{}");
            return cfg.sourceUri || null;
        } catch (err) {
            return null;
        }
    }

    function findSourceLine(target) {
        var node = target;
        while (node && node !== document.body) {
            if (node.getAttribute) {
                var raw = node.getAttribute("data-source-line");
                if (raw) {
                    var line = parseInt(raw, 10);
                    if (!isNaN(line)) {
                        return line - 1;
                    }
                }
            }
            node = node.parentElement;
        }
        return null;
    }

    function revealSourceAt(target) {
        var uri = getSourceUri();
        var line = findSourceLine(target);
        var api = getVsCodeApi();
        if (!uri || line == null || !api) {
            return false;
        }
        api.postMessage({ command: "revealLine", args: [uri, line] });
        return true;
    }

    function createOverlay() {
        overlay = document.createElement("div");
        overlay.className = "mpe-lightbox-overlay";
        lightboxImg = document.createElement("img");
        lightboxImg.draggable = false;
        overlay.appendChild(lightboxImg);
        document.body.appendChild(overlay);

        overlay.addEventListener("click", function (e) {
            // 拖拽松手时不关闭；点图片本身不关闭；点背景关闭
            if (dragMoved || e.target === lightboxImg) {
                dragMoved = false;
                return;
            }
            close();
        });

        lightboxImg.addEventListener("mousedown", function (e) {
            if (!overlay.classList.contains("mpe-lightbox-visible")) {
                return;
            }
            e.preventDefault();
            dragging = true;
            dragMoved = false;
            startX = e.clientX;
            startY = e.clientY;
            originX = offsetX;
            originY = offsetY;
            lightboxImg.style.cursor = "grabbing";
        });
    }

    function applyTransform() {
        if (!lightboxImg) {
            return;
        }
        var naturalWidth = lightboxImg.naturalWidth || 1;
        var naturalHeight = lightboxImg.naturalHeight || 1;
        lightboxImg.style.width = naturalWidth * scale + "px";
        lightboxImg.style.height = naturalHeight * scale + "px";
        lightboxImg.style.transform =
            "translate(" + offsetX + "px, " + offsetY + "px)";
        lightboxImg.style.cursor = dragging
            ? "grabbing"
            : scale > minScale
              ? "grab"
              : "default";
    }

    function fitToViewport() {
        if (
            !lightboxImg ||
            !lightboxImg.naturalWidth ||
            !lightboxImg.naturalHeight
        ) {
            return;
        }
        var fitWidth = (window.innerWidth * 0.95) / lightboxImg.naturalWidth;
        var fitHeight = (window.innerHeight * 0.95) / lightboxImg.naturalHeight;
        scale = Math.min(fitWidth, fitHeight, 1);
        minScale = Math.min(scale, 0.1);
        offsetX = 0;
        offsetY = 0;
        applyTransform();
    }

    function resetView() {
        scale = 1;
        minScale = 0.1;
        offsetX = 0;
        offsetY = 0;
        dragging = false;
        dragMoved = false;
        if (lightboxImg) {
            lightboxImg.style.width = "";
            lightboxImg.style.height = "";
            lightboxImg.style.transform = "";
            lightboxImg.style.cursor = "";
        }
    }

    function open(src) {
        if (!overlay) {
            createOverlay();
        }
        resetView();
        lightboxImg.onload = fitToViewport;
        lightboxImg.src = src;
        if (lightboxImg.complete) {
            fitToViewport();
        }
        overlay.style.display = "flex";
        void overlay.offsetHeight;
        overlay.classList.add("mpe-lightbox-visible");
        document.body.style.overflow = "hidden";
    }

    function close() {
        if (!overlay) {
            return;
        }
        overlay.classList.remove("mpe-lightbox-visible");
        document.body.style.overflow = "";
        resetView();
        setTimeout(function () {
            if (!overlay.classList.contains("mpe-lightbox-visible")) {
                overlay.style.display = "none";
                lightboxImg.src = "";
            }
        }, 200);
    }

    document.addEventListener(
        "click",
        function (e) {
            var img = e.target;
            if (
                img &&
                img.tagName === "IMG" &&
                !img.closest(".mpe-lightbox-overlay")
            ) {
                var src = img.getAttribute("src");
                if (src) {
                    e.preventDefault();
                    e.stopPropagation();
                    clearTimeout(imageClickTimer);
                    imageClickTimer = setTimeout(function () {
                        imageClickTimer = null;
                        open(src);
                    }, 220);
                }
            }
        },
        true,
    );

    // 双击交给 preview.js 跳原文；这里只取消单击开灯箱，避免抢事件
    document.addEventListener(
        "dblclick",
        function (e) {
            clearTimeout(imageClickTimer);
            imageClickTimer = null;
            if (overlay && overlay.classList.contains("mpe-lightbox-visible")) {
                return;
            }
        },
        true,
    );

    document.addEventListener(
        "keydown",
        function (e) {
            if (e.key !== "Escape" && e.which !== 27) {
                return;
            }

            // 灯箱打开时：只关灯箱，不触发 MPE 的 Esc 切目录
            if (overlay && overlay.classList.contains("mpe-lightbox-visible")) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                close();
                return;
            }

            // 预览页内禁用 Esc 切换目录（MPE 默认行为）
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        },
        true,
    );

    document.addEventListener("mousemove", function (e) {
        if (!dragging || !lightboxImg) {
            return;
        }
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            dragMoved = true;
        }
        offsetX = originX + dx;
        offsetY = originY + dy;
        applyTransform();
    });

    document.addEventListener("mouseup", function () {
        if (!dragging) {
            return;
        }
        dragging = false;
        if (lightboxImg) {
            lightboxImg.style.cursor = "grab";
        }
    });

    document.addEventListener(
        "wheel",
        function (e) {
            if (
                !overlay ||
                !overlay.classList.contains("mpe-lightbox-visible")
            ) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            var next = scale * Math.exp(-e.deltaY * 0.0025);
            scale = Math.min(MAX, Math.max(minScale, next));
            applyTransform();
        },
        { passive: false, capture: true },
    );
})();
