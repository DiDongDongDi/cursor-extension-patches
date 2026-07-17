#!/usr/bin/env bash
# Apply one extension folder from this repo into ~/.cursor/extensions
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT_HOME="${CURSOR_EXTENSIONS_HOME:-$HOME/.cursor/extensions}"
NAME="${1:?usage: apply-one.sh <extension-dir-name>}"
SRC="$ROOT/extensions/$NAME"
[[ -d "$SRC" ]] || { echo "missing $SRC"; exit 1; }

ID="$(tr -d '[:space:]' <"$SRC/EXTENSION_ID")"
# Resolve installed dir: prefer exact version file if present
VER_FILE="$SRC/UPSTREAM_VERSION"
VERSION=""
[[ -f "$VER_FILE" ]] && VERSION="$(tr -d '[:space:]' <"$VER_FILE")"
[[ -f "$SRC/VERSION" ]] && VERSION="$(tr -d '[:space:]' <"$SRC/VERSION")"

DST=""
if [[ -n "$VERSION" ]]; then
  for cand in "$EXT_HOME/${ID}-${VERSION}" "$EXT_HOME/${ID}-${VERSION}-universal" "$EXT_HOME/${ID}-${VERSION}-darwin-arm64"; do
    [[ -d "$cand" ]] && DST="$cand" && break
  done
fi
if [[ -z "$DST" ]]; then
  DST="$(ls -d "$EXT_HOME/${ID}"-* 2>/dev/null | sort | tail -1 || true)"
fi
[[ -n "$DST" && -d "$DST" ]] || {
  echo "WARN: installed extension not found for $ID — skip (install upstream first)"
  exit 0
}

echo "-- $ID -> $DST"

case "$NAME" in
  shd101wyy.markdown-preview-enhanced)
    mkdir -p "$DST/media" "$DST/crossnote/styles/prism_theme"
    cp "$SRC/media/lightbox.js" "$SRC/media/lightbox.css" "$SRC/media/vscode-api-proxy.js" "$DST/media/"
    cp "$SRC/crossnote/styles/prism_theme/vue.css" "$DST/crossnote/styles/prism_theme/vue.css"
    python3 "$ROOT/scripts/patch-mpe-bundles.py" "$DST"
    ;;
  gwanjun.vscode-markdown-preview-advance)
    cp "$SRC/media/mermaid.js" "$DST/media/mermaid.js"
    ;;
  barnim.markdown-code-copy-button)
    cp "$SRC/media/main.js" "$DST/media/main.js"
    ;;
  kody-local.markdown-preview-checkbox-sync)
    # full replace of our extension
    mkdir -p "$DST"
    rsync -a --delete \
      --exclude EXTENSION_ID --exclude VERSION --exclude UPSTREAM_VERSION \
      "$SRC"/ "$DST"/
    ;;
  *)
    echo "unknown extension layout: $NAME"; exit 1
    ;;
esac

echo "   ok"
