const vscode = require("vscode");

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
    );
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
