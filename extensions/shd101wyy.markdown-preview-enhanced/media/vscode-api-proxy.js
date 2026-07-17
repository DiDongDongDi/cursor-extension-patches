// 代理 acquireVsCodeApi，供预览增强脚本复用（VS Code webview 仅允许调用一次）
(function () {
    "use strict";
    var api = null;
    var orig = window.acquireVsCodeApi;
    if (typeof orig !== "function") {
        return;
    }
    window.acquireVsCodeApi = function () {
        if (!api) {
            api = orig();
            window.__mpeVsCodeApi = api;
        }
        return api;
    };
})();
