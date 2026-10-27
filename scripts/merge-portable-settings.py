#!/usr/bin/env python3
"""Merge workspace-config/user-settings.portable.json into Cursor User settings.

Preserves comments, tokens, and workbench.colorTheme. Only keys present in the
portable file are written.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

DENY_SUBSTR = ("token", "password", "secret", "cookie", "authorization")
NEVER_KEYS = {"workbench.colorTheme"}


def skip_ws_comments(text: str, i: int) -> int:
    n = len(text)
    while i < n:
        if text[i] in " \t\r\n":
            i += 1
            continue
        if text.startswith("//", i):
            nl = text.find("\n", i)
            i = n if nl < 0 else nl + 1
            continue
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            i = n if end < 0 else end + 2
            continue
        break
    return i


def parse_string(text: str, i: int) -> tuple[str, int]:
    if text[i] != '"':
        raise SystemExit(f"expected string at {i}")
    i += 1
    out = []
    while i < len(text):
        c = text[i]
        if c == "\\":
            out.append(text[i : i + 2])
            i += 2
            continue
        if c == '"':
            return "".join(out), i + 1
        out.append(c)
        i += 1
    raise SystemExit("unterminated string")


def skip_value(text: str, i: int) -> int:
    i = skip_ws_comments(text, i)
    if i >= len(text):
        raise SystemExit("unexpected end")
    c = text[i]
    if c == '"':
        _, i = parse_string(text, i)
        return i
    if c in "{[":
        open_c, close_c = c, "}" if c == "{" else "]"
        depth = 0
        while i < len(text):
            i = skip_ws_comments(text, i)
            if i >= len(text):
                break
            if text[i] == '"':
                _, i = parse_string(text, i)
                continue
            if text[i] == open_c:
                depth += 1
                i += 1
                continue
            if text[i] == close_c:
                depth -= 1
                i += 1
                if depth == 0:
                    return i
                continue
            i += 1
        raise SystemExit("unterminated value")
    while i < len(text) and text[i] not in ",}] \t\r\n/":
        i += 1
    return i


def top_level_keys(text: str) -> tuple[dict[str, tuple[int, int]], int]:
    i = skip_ws_comments(text, 0)
    if i >= len(text) or text[i] != "{":
        raise SystemExit("settings.json root is not an object")
    i += 1
    keys: dict[str, tuple[int, int]] = {}
    while True:
        i = skip_ws_comments(text, i)
        if i >= len(text):
            raise SystemExit("unterminated settings.json")
        if text[i] == "}":
            return keys, i
        if text[i] != '"':
            raise SystemExit(f"expected key at {i}: {text[i:i+30]!r}")
        raw_key, i = parse_string(text, i)
        key = json.loads(f'"{raw_key}"')
        i = skip_ws_comments(text, i)
        if i >= len(text) or text[i] != ":":
            raise SystemExit(f"expected colon after {key}")
        i = skip_ws_comments(text, i + 1)
        start = i
        i = skip_value(text, i)
        keys[key] = (start, i)
        i = skip_ws_comments(text, i)
        if i < len(text) and text[i] == ",":
            i += 1


def strip_jsonc(value: str) -> str:
    out = []
    i = 0
    while i < len(value):
        if value[i] == '"':
            start = i
            _, i = parse_string(value, i)
            out.append(value[start:i])
            continue
        if value.startswith("//", i):
            nl = value.find("\n", i)
            i = len(value) if nl < 0 else nl + 1
            continue
        if value.startswith("/*", i):
            end = value.find("*/", i + 2)
            i = len(value) if end < 0 else end + 2
            continue
        out.append(value[i])
        i += 1
    text = "".join(out)
    # trailing commas
    cleaned = []
    i = 0
    while i < len(text):
        if text[i] == '"':
            start = i
            _, i = parse_string(text, i)
            cleaned.append(text[start:i])
            continue
        if text[i] == ",":
            j = skip_ws_comments(text, i + 1)
            if j < len(text) and text[j] in "}]":
                i += 1
                continue
        cleaned.append(text[i])
        i += 1
    return "".join(cleaned)


def parse_jsonc_value(raw: str):
    return json.loads(strip_jsonc(raw))


def dump_value(value, indent: str) -> str:
    return json.dumps(value, ensure_ascii=False, indent=4).replace("\n", "\n" + indent)


def settings_path() -> Path:
    override = os.environ.get("CURSOR_SETTINGS_PATH")
    if override:
        path = Path(override)
        if not path.is_file():
            raise SystemExit(f"找不到 {path}")
        return path
    home = Path.home()
    mac = home / "Library/Application Support/Cursor/User/settings.json"
    linux = home / ".config/Cursor/User/settings.json"
    if mac.is_file():
        return mac
    if linux.is_file():
        return linux
    raise SystemExit(f"找不到 User settings.json（试过 {mac} 和 {linux}）")


def main() -> int:
    dry = "--dry-run" in sys.argv
    root = Path(__file__).resolve().parents[1]
    portable_path = root / "workspace-config/user-settings.portable.json"
    portable = json.loads(portable_path.read_text())
    if not isinstance(portable, dict):
        raise SystemExit("portable settings 不是对象")

    path = settings_path()
    text = path.read_text()
    keys, close_at = top_level_keys(text)
    base_indent = "    "

    changed = []
    replacements: list[tuple[int, int, str]] = []
    missing: list[tuple[str, object]] = []

    for key, value in portable.items():
        low = key.lower()
        if key in NEVER_KEYS or any(s in low for s in DENY_SUBSTR):
            print(f"skip denied key: {key}")
            continue
        if key in keys:
            start, end = keys[key]
            current = parse_jsonc_value(text[start:end])
            if current == value:
                continue
            rendered = dump_value(value, "")
            # reindent nested lines with 4 spaces already from json.dumps;
            # key line in file is indented 4, value object continues at col 0 of dumps
            # We replace only the value, so first line of dumps stays, subsequent
            # lines need the file's key indent (4 spaces).
            lines = rendered.split("\n")
            if len(lines) > 1:
                rendered = lines[0] + "\n" + "\n".join(base_indent + ln for ln in lines[1:])
            replacements.append((start, end, rendered))
            changed.append(key)
        else:
            missing.append((key, value))
            changed.append(key)

    if not changed:
        print(f"settings: 无差异 ({path})")
        return 0

    print("settings 将更新:")
    for key in changed:
        print(f"  - {key}")
    if dry:
        print("dry-run，未写文件")
        return 0

    for start, end, rendered in sorted(replacements, key=lambda x: x[0], reverse=True):
        text = text[:start] + rendered + text[end:]

    if missing:
        # recompute close brace after replacements shifted the tail; missing
        # keys are appended by rewriting from the original close only if no
        # replacements happened above the close. Re-scan.
        keys2, close_at = top_level_keys(text)
        insert_at = close_at
        # ensure previous token has a comma
        j = close_at - 1
        while j >= 0 and text[j] in " \t\r\n":
            j -= 1
        prefix = ""
        if j >= 0 and text[j] not in "{,":
            prefix = ","
        chunks = []
        for key, value in missing:
            rendered = dump_value(value, "")
            lines = rendered.split("\n")
            if len(lines) > 1:
                rendered = lines[0] + "\n" + "\n".join(base_indent + ln for ln in lines[1:])
            chunks.append(f'\n{base_indent}"{key}": {rendered}')
        blob = prefix + ",".join(chunks) + "\n"
        text = text[:insert_at] + blob + text[insert_at:]

    path.write_text(text)
    # verify it still parses
    top_level_keys(text)
    print(f"settings: 已写入 {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
