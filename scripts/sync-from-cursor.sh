#!/usr/bin/env bash
# Pull currently-installed patched files back into this repo (after hot-edit in Cursor)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT_HOME="${CURSOR_EXTENSIONS_HOME:-$HOME/.cursor/extensions}"

pull() {
  local name="$1"
  local src_id_file="$ROOT/extensions/$name/EXTENSION_ID"
  local id ver dst
  id="$(tr -d '[:space:]' <"$src_id_file")"
  if [[ -f "$ROOT/extensions/$name/UPSTREAM_VERSION" ]]; then
    ver="$(tr -d '[:space:]' <"$ROOT/extensions/$name/UPSTREAM_VERSION")"
  elif [[ -f "$ROOT/extensions/$name/VERSION" ]]; then
    ver="$(tr -d '[:space:]' <"$ROOT/extensions/$name/VERSION")"
  else
    ver=""
  fi
  dst=""
  for cand in "$EXT_HOME/${id}-${ver}" "$EXT_HOME/${id}-${ver}-universal" "$EXT_HOME/${id}-${ver}-darwin-arm64"; do
    [[ -n "$ver" && -d "$cand" ]] && dst="$cand" && break
  done
  [[ -z "$dst" ]] && dst="$(ls -d "$EXT_HOME/${id}"-* 2>/dev/null | sort | tail -1 || true)"
  [[ -d "$dst" ]] || { echo "skip $name (not installed)"; return; }
  echo "-- sync $name from $dst"

  case "$name" in
    shd101wyy.markdown-preview-enhanced)
      cp "$dst/media/lightbox.js" "$dst/media/lightbox.css" "$dst/media/vscode-api-proxy.js" \
        "$ROOT/extensions/$name/media/"
      cp "$dst/crossnote/styles/prism_theme/vue.css" \
        "$ROOT/extensions/$name/crossnote/styles/prism_theme/"
      # refresh snippets from live bundles
      python3 - <<PY
from pathlib import Path
mpe=Path("$dst")
sn=Path("$ROOT/extensions/$name/snippets")
ext=(mpe/"out/native/extension.js").read_text(errors="ignore")
i=ext.find("async function XBa")
j=ext.find("async function \$Ba", i)
(sn/"XBa.js").write_text(ext[i:j] if i>=0 and j>i else "")
k=ext.find("vscode-api-proxy.js")
(sn/"webview-inject-context.txt").write_text(ext[k-400:k+500] if k>=0 else "")
prev=(mpe/"crossnote/webview/preview.js").read_text(errors="ignore")
marker='X("revealLine",[n.current,Ce])'
p=prev.find(marker)
(sn/"preview-dblclick-context.txt").write_text(prev[p-600:p+250] if p>=0 else "NOT FOUND")
print("snippets refreshed")
PY
      ;;
    gwanjun.vscode-markdown-preview-advance)
      cp "$dst/media/mermaid.js" "$ROOT/extensions/$name/media/"
      ;;
    barnim.markdown-code-copy-button)
      cp "$dst/media/main.js" "$ROOT/extensions/$name/media/"
      ;;
    kody-local.markdown-preview-checkbox-sync)
      rsync -a --delete \
        --exclude EXTENSION_ID --exclude VERSION --exclude UPSTREAM_VERSION \
        "$dst"/ "$ROOT/extensions/$name"/
      # restore meta files if wiped
      printf '%s\n' "$id" > "$ROOT/extensions/$name/EXTENSION_ID"
      printf '%s\n' "$ver" > "$ROOT/extensions/$name/VERSION"
      ;;
  esac
}

pull shd101wyy.markdown-preview-enhanced
pull gwanjun.vscode-markdown-preview-advance
pull barnim.markdown-code-copy-button
pull kody-local.markdown-preview-checkbox-sync

# optional: sync MyNotes .crossnote
if [[ -d "$HOME/MyNotes/.crossnote" ]]; then
  rsync -a "$HOME/MyNotes/.crossnote/" "$ROOT/workspace-config/MyNotes.crossnote/"
  echo "-- synced MyNotes/.crossnote"
fi

echo "Done. Review git diff, then commit/push."
