#!/usr/bin/env bash
# Pull patches + MyNotes, re-apply extension patches, merge portable user settings.
# Operates on THIS machine only. Does not copy settings.json wholesale.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NOTES="${MYNOTES_ROOT:-$HOME/MyNotes}"
DRY=()
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY=(--dry-run)
fi

echo "==> patches: git pull"
git -C "$ROOT" pull --ff-only

echo "==> apply patches + pin"
"$ROOT/scripts/apply-all.sh"
"$ROOT/scripts/pin-patched-extensions.sh"

if [[ -d "$NOTES/.git" ]]; then
  if [[ -n "$(git -C "$NOTES" status --porcelain)" ]]; then
    echo "==> MyNotes 有未提交改动，跳过 git pull（$NOTES）"
  else
    echo "==> MyNotes: git pull"
    git -C "$NOTES" pull --ff-only
  fi
else
  echo "==> 未找到 $NOTES，跳过笔记仓"
fi

echo "==> merge portable settings"
python3 "$ROOT/scripts/merge-portable-settings.py" "${DRY[@]}"

echo
echo "Done. Cursor: Developer: Reload Window"
