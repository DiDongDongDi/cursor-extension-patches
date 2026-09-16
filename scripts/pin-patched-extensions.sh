#!/usr/bin/env bash
# Pin patched Cursor extensions (Disable Auto Update) via extensions.json.
set -euo pipefail

EXT_JSON="${HOME}/.cursor/extensions/extensions.json"
PIN_IDS=(
  shd101wyy.markdown-preview-enhanced
  gwanjun.vscode-markdown-preview-advance
  barnim.markdown-code-copy-button
  mushan.vscode-paste-image
  kody-local.markdown-preview-checkbox-sync
  kody-local.filtered-editor-switcher
)

if [[ ! -f "$EXT_JSON" ]]; then
  echo "missing: $EXT_JSON" >&2
  exit 1
fi

python3 - "$EXT_JSON" "${PIN_IDS[@]}" <<'PY'
import json, sys
from pathlib import Path

path = Path(sys.argv[1])
pin_ids = set(sys.argv[2:])
data = json.loads(path.read_text())
bak = path.with_suffix(".json.bak-pin")
bak.write_text(path.read_text())

seen = set()
for e in data:
    eid = (e.get("identifier") or {}).get("id")
    if eid not in pin_ids:
        continue
    seen.add(eid)
    meta = e.setdefault("metadata", {})
    before = meta.get("pinned")
    meta["pinned"] = True
    print(f"{eid} v{e.get('version')}: pinned {before!r} -> True")

missing = pin_ids - seen
for eid in sorted(missing):
    print(f"WARN not installed: {eid}", file=sys.stderr)

path.write_text(json.dumps(data, indent=4, ensure_ascii=False) + "\n")
print(f"backup: {bak}")
PY
