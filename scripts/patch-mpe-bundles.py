#!/usr/bin/env python3
"""Surgically patch MPE bundles if markers missing (upgrade-safe-ish)."""
from __future__ import annotations

import sys
from pathlib import Path

PROXY_MARKER = "vscode-api-proxy.js"
LIGHTBOX_MARKER = 'media","lightbox.js"'
DBLCLICK_MARKER = 'X("revealLine",[n.current,Ce])'
XBA_OPEN = "openTextDocument(t)"


def patch_extension_js(path: Path) -> None:
    text = path.read_text(errors="ignore")
    changed = False

    if PROXY_MARKER not in text:
        # Insert proxy+lightbox injection before generateHTMLTemplateForPreview call site.
        # Upstream typically has: let E=""; ... then generateHTMLTemplateForPreview
        needle = 'let E="";'
        # Try several minified variants
        candidates = [
            'let E="";',
            'let E="";',
            "let E='';",
        ]
        injected = (
            'let E="";'
            '{let ie=o.webview.asWebviewUri(ps.Uri.joinPath(this.context.extensionUri,"media","vscode-api-proxy.js"));'
            'E=`<script src="${ie}"></script>`}'
            'if(Pr("enableImageLightbox")??!0){let m=o.webview.asWebviewUri(ps.Uri.joinPath(this.context.extensionUri,"media","lightbox.css")),'
            'Q=o.webview.asWebviewUri(ps.Uri.joinPath(this.context.extensionUri,"media","lightbox.js"));'
            'E+=`<link rel="stylesheet" href="${m}"><script defer src="${Q}"></script>`}'
        )
        # Prefer replacing empty E init that immediately precedes generateHTMLTemplateForPreview
        anchor = "generateHTMLTemplateForPreview"
        idx = text.find(anchor)
        if idx < 0:
            print("WARN: cannot find generateHTMLTemplateForPreview; skip inject")
        else:
            window = text[max(0, idx - 200) : idx]
            if 'let E="";' in window or 'let E="";' in window:
                # replace the nearest let E="" before anchor
                start = text.rfind('let E="";', 0, idx)
                if start < 0:
                    start = text.rfind('let E="";'.replace('""', '""'), 0, idx)
                # find end of statement let E="";
                end = start + len('let E="";')
                text = text[:start] + injected + text[end:]
                changed = True
                print("patched: webview script inject")
            else:
                print(
                    'WARN: let E="" not near generateHTMLTemplateForPreview; manual inject needed'
                )
    else:
        print("ok: proxy already injected")

    # Ensure XBa opens document when editor not visible
    i = text.find("async function XBa")
    if i >= 0:
        j = text.find("async function $Ba", i)
        chunk = text[i:j] if j > i else text[i : i + 800]
        if XBA_OPEN not in chunk:
            new_xba = (
                "async function XBa(e,A){let t=xt.Uri.parse(e),"
                "r=xt.window.visibleTextEditors.find(n=>jh(n.document)&&n.document.uri.fsPath===t.fsPath);"
                "if(!r){try{let n=await xt.workspace.openTextDocument(t);"
                "r=await xt.window.showTextDocument(n,{preserveFocus:!1,preview:!1})}"
                "catch(n){return console.error(n)}}if(!r)return;"
                "let i=Math.min(Math.floor(A),r.document.lineCount-1),a=A-i,"
                "s=r.document.lineAt(i).text,o=Math.floor(a*s.length);"
                "OGA=Date.now()+500,r.selection=new xt.Selection(i,o,i,o),"
                "r.revealRange(new xt.Range(i,o,i+1,0),xt.TextEditorRevealType.InCenter),"
                "OGA=Date.now()+500}"
            )
            if j > i:
                text = text[:i] + new_xba + text[j:]
                changed = True
                print("patched: XBa openTextDocument")
            else:
                print("WARN: cannot bound XBa function")
        else:
            print("ok: XBa already opens document")
    else:
        print("WARN: XBa not found")

    if changed:
        path.write_text(text)
        print(f"wrote {path}")


def patch_preview_js(path: Path) -> None:
    text = path.read_text(errors="ignore")
    if DBLCLICK_MARKER in text:
        print("ok: preview dblclick reveal already present")
        return

    # Insert a useEffect after a known keydown effect if possible
    hook = (
        '(0,Le.useEffect)(()=>{let F1=e1=>{if(e1.target&&e1.target.closest&&e1.target.closest(".mpe-lightbox-overlay"))return;'
        'let N1=e1.target,Ce=null;for(;N1&&N1!==document.body;){let pA=N1.getAttribute&&N1.getAttribute("data-source-line");'
        "if(pA){let dA=parseInt(pA,10);if(!isNaN(dA)){Ce=dA-1;break}}N1=N1.parentElement}"
        'if(Ce==null)return;e1.preventDefault(),e1.stopPropagation(),X("revealLine",[n.current,Ce])};'
        'return document.addEventListener("dblclick",F1,!0),()=>{document.removeEventListener("dblclick",F1,!0)}},[X]),'
    )

    anchor = 'document.addEventListener("keydown",Jt)'
    idx = text.find(anchor)
    if idx < 0:
        print(
            "WARN: cannot find keydown anchor for dblclick inject; manual patch needed"
        )
        return

    # Insert after the keydown useEffect ends: look for `},[Jt]),` following anchor
    end = text.find("},[Jt]),", idx)
    if end < 0:
        print("WARN: cannot find end of keydown effect")
        return
    insert_at = end + len("},[Jt]),")
    text = text[:insert_at] + hook + text[insert_at:]
    path.write_text(text)
    print(f"patched: preview dblclick -> {path}")


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: patch-mpe-bundles.py <mpe-extension-dir>")
        return 2
    root = Path(sys.argv[1])
    patch_extension_js(root / "out/native/extension.js")
    # also try web build if present
    web = root / "out/web/extension.js"
    if web.exists():
        # only ensure media files matter for native preview; skip heavy web unless markers needed
        pass
    patch_preview_js(root / "crossnote/webview/preview.js")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
