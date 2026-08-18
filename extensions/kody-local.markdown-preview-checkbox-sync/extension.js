const vscode = require("vscode");
const { toCheckboxLine, stripCheckboxLine } = require("./checkbox-edit");

const OUTPUT_CHANNEL = "Markdown Preview Checkbox Sync";

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    const output = vscode.window.createOutputChannel(OUTPUT_CHANNEL);

    context.subscriptions.push(
        output,
        vscode.window.registerUriHandler({
            handleUri(uri) {
                output.appendLine(`URI: ${uri.toString()}`);

                if (uri.path !== "/toggle") {
                    return;
                }

                const params = new URLSearchParams(uri.query);
                const line = Number.parseInt(params.get("line") ?? "", 10);
                const checked = params.get("checked") === "true";
                const resource = params.get("resource");

                if (Number.isNaN(line) || !resource) {
                    output.appendLine("Missing line or resource in URI");
                    return;
                }

                toggleCheckboxInDocument(
                    vscode.Uri.parse(resource),
                    line,
                    checked,
                    output,
                );
            },
        }),
        vscode.commands.registerCommand(
            "markdownPreviewCheckboxSync.toggle",
            async (args) => {
                const line = Number.parseInt(String(args?.line ?? ""), 10);
                const resource = args?.resource;
                const checked = args?.checked === true;

                if (Number.isNaN(line) || !resource) {
                    return;
                }

                await toggleCheckboxInDocument(
                    vscode.Uri.parse(resource),
                    line,
                    checked,
                    output,
                );
            },
        ),
        vscode.commands.registerCommand(
            "markdownPreviewCheckboxSync.convertToCheckbox",
            () => rewriteSelectedLines(toCheckboxLine),
        ),
        vscode.commands.registerCommand(
            "markdownPreviewCheckboxSync.removeCheckbox",
            () => rewriteSelectedLines(stripCheckboxLine),
        ),
    );
}

/**
 * @param {(text: string) => string} transform
 */
async function rewriteSelectedLines(transform) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const lineNumbers = collectTouchedLines(editor);
    await editor.edit((editBuilder) => {
        for (const lineNumber of lineNumbers) {
            const line = editor.document.lineAt(lineNumber);
            const next = transform(line.text);
            if (next !== line.text) {
                editBuilder.replace(line.range, next);
            }
        }
    });
}

/**
 * @param {vscode.TextEditor} editor
 * @returns {number[]}
 */
function collectTouchedLines(editor) {
    const lineSet = new Set();
    for (const selection of editor.selections) {
        const start = selection.start.line;
        let end = selection.end.line;
        if (
            !selection.isEmpty &&
            selection.end.character === 0 &&
            end > start
        ) {
            end -= 1;
        }
        for (let i = start; i <= end; i++) {
            lineSet.add(i);
        }
    }
    return [...lineSet].sort((a, b) => a - b);
}

/**
 * @param {vscode.Uri} uri
 * @param {number} lineNumber
 * @param {boolean} checked
 * @param {vscode.OutputChannel} output
 */
async function toggleCheckboxInDocument(uri, lineNumber, checked, output) {
    const document = await vscode.workspace.openTextDocument(uri);
    const line = document.lineAt(lineNumber);
    const lineText = line.text;

    const unchecked = /^(\s*(?:[-*+]|\d+\.)\s+)\[ \]/;
    const checkedPat = /^(\s*(?:[-*+]|\d+\.)\s+)\[[xX]\]/;

    let updatedText;
    if (checked && unchecked.test(lineText)) {
        updatedText = lineText.replace(unchecked, "$1[x]");
    } else if (!checked && checkedPat.test(lineText)) {
        updatedText = lineText.replace(checkedPat, "$1[ ]");
    } else if (/\[ \]/.test(lineText) && checked) {
        updatedText = lineText.replace(/\[ \]/, "[x]");
    } else if (/\[[xX]\]/.test(lineText) && !checked) {
        updatedText = lineText.replace(/\[[xX]\]/, "[ ]");
    } else {
        output.appendLine(`No checkbox on line ${lineNumber}: ${lineText}`);
        return;
    }

    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, line.range, updatedText);
    const applied = await vscode.workspace.applyEdit(edit);
    output.appendLine(
        applied
            ? `Toggled line ${lineNumber} -> checked=${checked}`
            : `WorkspaceEdit failed for line ${lineNumber}`,
    );
}

function deactivate() {}

module.exports = { activate, deactivate };
