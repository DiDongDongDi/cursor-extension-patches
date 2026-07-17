#!/usr/bin/env bash
# Apply all extension patches into ~/.cursor/extensions
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT_HOME="${CURSOR_EXTENSIONS_HOME:-$HOME/.cursor/extensions}"

echo "==> apply all patches"
echo "    repo: $ROOT"
echo "    extensions: $EXT_HOME"

"$ROOT/scripts/apply-one.sh" shd101wyy.markdown-preview-enhanced
"$ROOT/scripts/apply-one.sh" gwanjun.vscode-markdown-preview-advance
"$ROOT/scripts/apply-one.sh" barnim.markdown-code-copy-button
"$ROOT/scripts/apply-one.sh" kody-local.markdown-preview-checkbox-sync

echo
echo "Done. Run in Cursor: Developer: Reload Window"
