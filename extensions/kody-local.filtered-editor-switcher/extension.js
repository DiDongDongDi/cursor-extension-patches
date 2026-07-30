const vscode = require("vscode");

/** @type {vscode.QuickPick | undefined} */
let activePicker;
/** @type {string[]} */
let mruKeys = [];

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (!editor) {
                return;
            }
            const tab = findTabForTextUri(editor.document.uri);
            if (tab && isAllowedTab(tab)) {
                bumpMru(tabKey(tab));
            }
        }),
        vscode.window.tabGroups.onDidChangeTabs((e) => {
            for (const tab of e.closed) {
                mruKeys = mruKeys.filter((k) => k !== tabKey(tab));
            }
        }),
        vscode.commands.registerCommand(
            "filteredEditorSwitcher.openPrevious",
            () => openPicker(1),
        ),
        vscode.commands.registerCommand("filteredEditorSwitcher.openNext", () =>
            openPicker(-1),
        ),
        vscode.commands.registerCommand(
            "filteredEditorSwitcher.navigateNext",
            () => navigatePicker(1),
        ),
        vscode.commands.registerCommand(
            "filteredEditorSwitcher.navigatePrevious",
            () => navigatePicker(-1),
        ),
    );
}

/**
 * @param {vscode.Tab} tab
 */
function tabKey(tab) {
    const input = tab.input;
    if (input instanceof vscode.TabInputText) {
        return `text:${input.uri.toString()}`;
    }
    if (input instanceof vscode.TabInputNotebook) {
        return `notebook:${input.uri.toString()}`;
    }
    if (input instanceof vscode.TabInputWebview) {
        return `webview:${input.viewType}:${tab.label}`;
    }
    if (input instanceof vscode.TabInputCustom) {
        return `custom:${input.viewType}:${input.uri.toString()}`;
    }
    return `other:${tab.label}:${String(tab.group.viewColumn)}`;
}

/**
 * @param {string} key
 */
function bumpMru(key) {
    mruKeys = [key, ...mruKeys.filter((k) => k !== key)].slice(0, 80);
}

/**
 * @param {vscode.Uri} uri
 * @returns {vscode.Tab | undefined}
 */
function findTabForTextUri(uri) {
    const target = uri.toString();
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            if (
                tab.input instanceof vscode.TabInputText &&
                tab.input.uri.toString() === target
            ) {
                return tab;
            }
        }
    }
    return undefined;
}

/**
 * @returns {{ tab: vscode.Tab, key: string }[]}
 */
function collectAllowedTabs() {
    /** @type {{ tab: vscode.Tab, key: string }[]} */
    const all = [];
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            if (!isAllowedTab(tab)) {
                continue;
            }
            all.push({ tab, key: tabKey(tab) });
        }
    }

    all.sort((a, b) => {
        const ia = mruKeys.indexOf(a.key);
        const ib = mruKeys.indexOf(b.key);
        const ra = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
        const rb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
        if (ra !== rb) {
            return ra - rb;
        }
        return a.tab.label.localeCompare(b.tab.label);
    });
    return all;
}

/**
 * @param {vscode.Tab} tab
 */
function isAllowedTab(tab) {
    const cfg = vscode.workspace.getConfiguration("filteredEditorSwitcher");
    const viewSubs = /** @type {string[]} */ (
        cfg.get("excludeViewTypeSubstrings") ?? []
    ).map((s) => s.toLowerCase());
    const schemePrefixes = /** @type {string[]} */ (
        cfg.get("excludeUriSchemePrefixes") ?? []
    ).map((s) => s.toLowerCase());
    const labelPrefixes = /** @type {string[]} */ (
        cfg.get("excludeLabelPrefixes") ?? []
    );

    if (labelPrefixes.some((p) => tab.label.startsWith(p))) {
        return false;
    }

    const input = tab.input;
    if (input instanceof vscode.TabInputText) {
        const scheme = input.uri.scheme.toLowerCase();
        if (schemePrefixes.some((p) => scheme === p || scheme.startsWith(p))) {
            return false;
        }
        return true;
    }

    if (input instanceof vscode.TabInputNotebook) {
        const scheme = input.uri.scheme.toLowerCase();
        if (schemePrefixes.some((p) => scheme === p || scheme.startsWith(p))) {
            return false;
        }
        return true;
    }

    // MPE preview / Cursor chat-as-editor are typically webview or custom.
    if (input instanceof vscode.TabInputWebview) {
        const vt = String(input.viewType || "").toLowerCase();
        if (!viewSubs.length) {
            return false;
        }
        return !viewSubs.some((s) => vt.includes(s));
    }

    if (input instanceof vscode.TabInputCustom) {
        const vt = String(input.viewType || "").toLowerCase();
        if (viewSubs.some((s) => vt.includes(s))) {
            return false;
        }
        const scheme = input.uri.scheme.toLowerCase();
        if (schemePrefixes.some((p) => scheme === p || scheme.startsWith(p))) {
            return false;
        }
        // Keep unknown custom editors (e.g. image preview) out by default —
        // user asked to switch among real source files.
        return false;
    }

    return false;
}

/**
 * @param {number} initialDelta
 */
async function openPicker(initialDelta) {
    const entries = collectAllowedTabs();
    if (entries.length === 0) {
        return;
    }

    if (entries.length === 1) {
        await focusTab(entries[0].tab);
        return;
    }

    if (activePicker) {
        navigatePicker(initialDelta);
        return;
    }

    const items = entries.map((e) => {
        const input = e.tab.input;
        /** @type {vscode.QuickPickItem & { tab: vscode.Tab }} */
        const item = {
            label: e.tab.label,
            description:
                input instanceof vscode.TabInputText ||
                input instanceof vscode.TabInputNotebook
                    ? vscode.workspace.asRelativePath(input.uri)
                    : undefined,
            tab: e.tab,
        };
        return item;
    });

    const qp = vscode.window.createQuickPick();
    activePicker = qp;
    qp.items = items;
    qp.matchOnDescription = true;
    qp.placeholder = "Switch editor (preview / chat hidden)";
    qp.ignoreFocusOut = true;

    const activeIdx = Math.max(
        0,
        entries.findIndex((e) => e.tab.isActive),
    );
    const startIdx = (activeIdx + initialDelta + items.length) % items.length;
    qp.activeItems = [items[startIdx]];

    await vscode.commands.executeCommand(
        "setContext",
        "filteredEditorSwitcherOpen",
        true,
    );

    const disposables = [
        qp.onDidAccept(async () => {
            const selected = qp.activeItems[0] || qp.selectedItems[0];
            qp.hide();
            if (selected?.tab) {
                await focusTab(selected.tab);
            }
        }),
        qp.onDidHide(() => {
            for (const d of disposables) {
                d.dispose();
            }
            activePicker = undefined;
            void vscode.commands.executeCommand(
                "setContext",
                "filteredEditorSwitcherOpen",
                false,
            );
            qp.dispose();
        }),
    ];

    qp.show();
}

/**
 * @param {number} delta
 */
function navigatePicker(delta) {
    if (!activePicker) {
        return;
    }
    const items = /** @type {readonly vscode.QuickPickItem[]} */ (
        activePicker.items
    );
    if (!items.length) {
        return;
    }
    const current = activePicker.activeItems[0];
    const idx = Math.max(
        0,
        items.findIndex((it) => it === current),
    );
    const next = (idx + delta + items.length) % items.length;
    activePicker.activeItems = [items[next]];
}

/**
 * @param {vscode.Tab} tab
 */
async function focusTab(tab) {
    const input = tab.input;
    if (
        input instanceof vscode.TabInputText ||
        input instanceof vscode.TabInputNotebook
    ) {
        bumpMru(tabKey(tab));
        await vscode.window.showTextDocument(input.uri, {
            viewColumn: tab.group.viewColumn,
            preview: false,
            preserveFocus: false,
        });
        return;
    }

    // Fallback: reveal by briefly showing any text doc then relying on tab API.
    // VS Code has no public "focus tab" for webview; we only allow text/notebook.
}

function deactivate() {
    if (activePicker) {
        activePicker.hide();
        activePicker = undefined;
    }
}

module.exports = { activate, deactivate };
