#!/usr/bin/env python3
"""Surgically patch MPE bundles if markers missing (upgrade-safe-ish).

Targets MPE 0.8.32 minified names; keeps a few 0.8.30 fallbacks.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

PROXY_MARKER = "vscode-api-proxy.js"
LIGHTBOX_MARKER = 'media","lightbox.js"'
CODE_COPY_MARKER = 'media","code-copy.js"'
# 0.8.32 postMessage helper is N1; 0.8.30 used X
DBLCLICK_MARKER_NEW = 'N1("revealLine",[n.current,Ce])'
DBLCLICK_MARKER_OLD = 'X("revealLine",[n.current,Ce])'
DISABLE_WHEEL_ZOOM_MARKER = "mpe-disable-wheel-zoom"
REVEAL_OPEN = "openTextDocument(r)"
# openPreviewToTheSide: jump focus to already-open preview (Opt/Alt+Cmd+V)
FOCUS_EXISTING_MARKER = ".reveal(void 0,!1),await "
CLOSE_PREVIEW_WITH_DOC_MARKER = "[MPE] auto-close preview on editor close"

# --- 0.8.32 openPreviewToTheSide ---
OPEN_PREVIEW_SIDE_OLD_832 = (
    "async function o(je){let ht=dn.window.activeTextEditor;if(ht){je||(je=ht.document.uri);"
    "try{await(await n(je)).initPreview({sourceUri:je,document:ht.document,cursorLine:W5e(ht),"
    "viewOptions:{viewColumn:dn.ViewColumn.Beside,preserveFocus:!0}})}"
    'catch(yt){console.error("[MPE] openPreviewToTheSide failed:",yt),'
    "dn.window.showErrorMessage(`MPE Preview failed: ${yt instanceof Error?yt.message:String(yt)}`)}}}"
)
OPEN_PREVIEW_SIDE_NEW_832 = (
    "async function o(je){let ht=dn.window.activeTextEditor;if(ht){je||(je=ht.document.uri);"
    "try{let pA=await n(je),dA=pA.getPreviews(je);dA&&dA.length>0&&dA[0].reveal(void 0,!1),"
    "await pA.initPreview({sourceUri:je,document:ht.document,cursorLine:W5e(ht),"
    "viewOptions:{viewColumn:dn.ViewColumn.Beside,preserveFocus:!0}})}"
    'catch(yt){console.error("[MPE] openPreviewToTheSide failed:",yt),'
    "dn.window.showErrorMessage(`MPE Preview failed: ${yt instanceof Error?yt.message:String(yt)}`)}}}"
)

# --- 0.8.30 fallback ---
OPEN_PREVIEW_SIDE_OLD_830 = (
    "async function n(fe){let Le=xt.window.activeTextEditor;if(Le){fe||(fe=Le.document.uri);"
    "try{await(await r(fe)).initPreview({sourceUri:fe,document:Le.document,cursorLine:XQe(Le),"
    "viewOptions:{viewColumn:xt.ViewColumn.Beside,preserveFocus:!0}})}"
    'catch(Ye){console.error("[MPE] openPreviewToTheSide failed:",Ye),'
    "xt.window.showErrorMessage(`MPE Preview failed: ${Ye instanceof Error?Ye.message:String(Ye)}`)}}}"
)
OPEN_PREVIEW_SIDE_NEW_830 = (
    "async function n(fe){let Le=xt.window.activeTextEditor;if(Le){fe||(fe=Le.document.uri);"
    "try{let pA=await r(fe),dA=pA.getPreviews(fe);dA&&dA.length>0&&dA[0].reveal(void 0,!1),"
    "await pA.initPreview({sourceUri:fe,document:Le.document,cursorLine:XQe(Le),"
    "viewOptions:{viewColumn:xt.ViewColumn.Beside,preserveFocus:!0}})}"
    'catch(Ye){console.error("[MPE] openPreviewToTheSide failed:",Ye),'
    "xt.window.showErrorMessage(`MPE Preview failed: ${Ye instanceof Error?Ye.message:String(Ye)}`)}}}"
)

CLOSE_PREVIEW_ANCHOR_832 = (
    "}}})),e.subscriptions.push(dn.window.onDidChangeActiveColorTheme("
)
CLOSE_PREVIEW_INSERT_832 = (
    "}}})),e.subscriptions.push(dn.workspace.onDidCloseTextDocument(async fe=>{"
    "if(!u1(fe))return;"
    "try{let Ve=fe.uri,eA=await n(Ve);"
    "if(p_()===sx.SinglePreview){"
    "if(!eA.previewHasTheSameSingleSourceUri(Ve))return;"
    "let uA=eA.getPreviews(Ve);uA&&uA.forEach(h=>h.dispose())"
    "}else if(eA.isPreviewOn(Ve)){"
    "let uA=eA.getPreviews(Ve);uA&&uA.forEach(h=>h.dispose())"
    "}}"
    f'catch(Ye){{console.warn("{CLOSE_PREVIEW_WITH_DOC_MARKER} failed:",Ye)}}'
    "})),e.subscriptions.push(dn.window.onDidChangeActiveColorTheme("
)

CLOSE_PREVIEW_ANCHOR_830 = (
    "}}})),e.subscriptions.push(xt.window.onDidChangeActiveColorTheme("
)
CLOSE_PREVIEW_INSERT_830 = (
    "}}})),e.subscriptions.push(xt.workspace.onDidCloseTextDocument(async fe=>{"
    "if(!jh(fe))return;"
    "try{let Ve=fe.uri,eA=await r(Ve);"
    "if(m8()===Wp.SinglePreview){"
    "if(!eA.previewHasTheSameSingleSourceUri(Ve))return;"
    "let uA=eA.getPreviews(Ve);uA&&uA.forEach(h=>h.dispose())"
    "}else if(eA.isPreviewOn(Ve)){"
    "let uA=eA.getPreviews(Ve);uA&&uA.forEach(h=>h.dispose())"
    "}}"
    f'catch(Ye){{console.warn("{CLOSE_PREVIEW_WITH_DOC_MARKER} failed:",Ye)}}'
    "})),e.subscriptions.push(xt.window.onDidChangeActiveColorTheme("
)

# 0.8.32: _crossnote.revealLine -> zsu (sync, visible editors only)
ZSU_OLD = (
    "function zsu(e,t){let r=dn.Uri.parse(e);dn.window.visibleTextEditors.filter("
    "n=>u1(n.document)&&n.document.uri.fsPath===r.fsPath).forEach(n=>{"
    "let o=Math.min(Math.floor(t),n.document.lineCount-1),i=t-o,"
    "a=n.document.lineAt(o).text,s=Math.floor(i*a.length);"
    "O7r=Date.now()+500,n.revealRange(new dn.Range(o,s,o+1,0),dn.TextEditorRevealType.InCenter),"
    "O7r=Date.now()+500})}"
)
ZSU_NEW = (
    "async function zsu(e,t){let r=dn.Uri.parse(e),"
    "n=dn.window.visibleTextEditors.find(o=>u1(o.document)&&o.document.uri.fsPath===r.fsPath);"
    "if(!n){try{let o=await dn.workspace.openTextDocument(r);"
    "n=await dn.window.showTextDocument(o,{preserveFocus:!1,preview:!1})}"
    "catch(o){return console.error(o)}}if(!n)return;"
    "let o=Math.min(Math.floor(t),n.document.lineCount-1),i=t-o,"
    "a=n.document.lineAt(o).text,s=Math.floor(i*a.length);"
    "O7r=Date.now()+500,n.selection=new dn.Selection(o,s,o,s),"
    "n.revealRange(new dn.Range(o,s,o+1,0),dn.TextEditorRevealType.InCenter),"
    "O7r=Date.now()+500}"
)


def patch_extension_js(path: Path) -> None:
    text = path.read_text(errors="ignore")
    changed = False

    if FOCUS_EXISTING_MARKER not in text:
        if OPEN_PREVIEW_SIDE_OLD_832 in text:
            text = text.replace(OPEN_PREVIEW_SIDE_OLD_832, OPEN_PREVIEW_SIDE_NEW_832, 1)
            changed = True
            print("patched: openPreviewToTheSide focuses existing preview (0.8.32)")
        elif OPEN_PREVIEW_SIDE_OLD_830 in text:
            text = text.replace(OPEN_PREVIEW_SIDE_OLD_830, OPEN_PREVIEW_SIDE_NEW_830, 1)
            changed = True
            print("patched: openPreviewToTheSide focuses existing preview (0.8.30)")
        else:
            print(
                "WARN: openPreviewToTheSide pattern not found; "
                "manual focus-existing-preview patch needed"
            )
    else:
        print("ok: openPreviewToTheSide already focuses existing preview")

    if CLOSE_PREVIEW_WITH_DOC_MARKER not in text:
        if CLOSE_PREVIEW_ANCHOR_832 in text:
            text = text.replace(CLOSE_PREVIEW_ANCHOR_832, CLOSE_PREVIEW_INSERT_832, 1)
            changed = True
            print("patched: close MPE preview when source markdown document closes (0.8.32)")
        elif CLOSE_PREVIEW_ANCHOR_830 in text:
            text = text.replace(CLOSE_PREVIEW_ANCHOR_830, CLOSE_PREVIEW_INSERT_830, 1)
            changed = True
            print("patched: close MPE preview when source markdown document closes (0.8.30)")
        else:
            print(
                "WARN: close-preview-with-doc anchor not found; "
                "manual close-on-editor-close patch needed"
            )
    else:
        print("ok: close preview on source document close already present")

    if PROXY_MARKER not in text:
        # 0.8.32 upstream: let m="";if(Wi("enableImageLightbox")...
        # Inject proxy first, then force lightbox to append (m+=).
        m832 = 'let m="";if(Wi("enableImageLightbox")'
        if m832 in text:
            proxy = (
                'let m="";'
                '{let ie=A.webview.asWebviewUri(Os.Uri.joinPath(this.context.extensionUri,"media","vscode-api-proxy.js"));'
                'm=`<script src="${ie}"></script>`}'
                'if(Wi("enableImageLightbox")'
            )
            text = text.replace(m832, proxy, 1)
            # lightbox assignment must append after proxy
            old_lb = 'm=`<link rel="stylesheet" href="${E}"><script defer src="${y}"></script>`'
            new_lb = 'm+=`<link rel="stylesheet" href="${E}"><script defer src="${y}"></script>`'
            if old_lb in text:
                text = text.replace(old_lb, new_lb, 1)
            changed = True
            print("patched: webview script inject (0.8.32 proxy+lightbox append)")
        else:
            # 0.8.30-style near generateHTMLTemplateForPreview
            anchor = "generateHTMLTemplateForPreview"
            idx = text.find(anchor)
            if idx < 0:
                print("WARN: cannot find generateHTMLTemplateForPreview; skip inject")
            else:
                start = text.rfind('let E="";', 0, idx)
                if start >= 0 and idx - start < 250:
                    injected = (
                        'let E="";'
                        '{let ie=o.webview.asWebviewUri(ps.Uri.joinPath(this.context.extensionUri,"media","vscode-api-proxy.js"));'
                        'E=`<script src="${ie}"></script>`}'
                        'if(Pr("enableImageLightbox")??!0){let m=o.webview.asWebviewUri(ps.Uri.joinPath(this.context.extensionUri,"media","lightbox.css")),'
                        'Q=o.webview.asWebviewUri(ps.Uri.joinPath(this.context.extensionUri,"media","lightbox.js"));'
                        'E+=`<link rel="stylesheet" href="${m}"><script defer src="${Q}"></script>`}'
                    )
                    end = start + len('let E="";')
                    text = text[:start] + injected + text[end:]
                    changed = True
                    print("patched: webview script inject (0.8.30-style)")
                else:
                    print(
                        'WARN: let m/E="" lightbox init not found; manual inject needed'
                    )
    else:
        print("ok: proxy already injected")

    if CODE_COPY_MARKER not in text:
        injected = None
        # Prefer append after lightbox link in 0.8.32 (E/y vars) or 0.8.30 (m/Q)
        anchors = [
            (
                'm+=`<link rel="stylesheet" href="${E}"><script defer src="${y}"></script>`}',
                (
                    '{let mpeCcCss=A.webview.asWebviewUri(Os.Uri.joinPath(this.context.extensionUri,"media","code-copy.css")),'
                    'mpeCcJs=A.webview.asWebviewUri(Os.Uri.joinPath(this.context.extensionUri,"media","code-copy.js"));'
                    'm+=`<link rel="stylesheet" href="${mpeCcCss}"><script defer src="${mpeCcJs}"></script>`}'
                ),
            ),
            (
                'm=`<link rel="stylesheet" href="${E}"><script defer src="${y}"></script>`}',
                (
                    '{let mpeCcCss=A.webview.asWebviewUri(Os.Uri.joinPath(this.context.extensionUri,"media","code-copy.css")),'
                    'mpeCcJs=A.webview.asWebviewUri(Os.Uri.joinPath(this.context.extensionUri,"media","code-copy.js"));'
                    'm+=`<link rel="stylesheet" href="${mpeCcCss}"><script defer src="${mpeCcJs}"></script>`}'
                ),
            ),
            (
                'E+=`<link rel="stylesheet" href="${m}"><script defer src="${Q}"></script>`}',
                (
                    '{let mpeCcCss=o.webview.asWebviewUri(ps.Uri.joinPath(this.context.extensionUri,"media","code-copy.css")),'
                    'mpeCcJs=o.webview.asWebviewUri(ps.Uri.joinPath(this.context.extensionUri,"media","code-copy.js"));'
                    'E+=`<link rel="stylesheet" href="${mpeCcCss}"><script defer src="${mpeCcJs}"></script>`}'
                ),
            ),
            (
                'E=`<script src="${ie}"></script>`}',
                (
                    '{let mpeCcCss=o.webview.asWebviewUri(ps.Uri.joinPath(this.context.extensionUri,"media","code-copy.css")),'
                    'mpeCcJs=o.webview.asWebviewUri(ps.Uri.joinPath(this.context.extensionUri,"media","code-copy.js"));'
                    'E+=`<link rel="stylesheet" href="${mpeCcCss}"><script defer src="${mpeCcJs}"></script>`}'
                ),
            ),
            (
                'm=`<script src="${ie}"></script>`}',
                (
                    '{let mpeCcCss=A.webview.asWebviewUri(Os.Uri.joinPath(this.context.extensionUri,"media","code-copy.css")),'
                    'mpeCcJs=A.webview.asWebviewUri(Os.Uri.joinPath(this.context.extensionUri,"media","code-copy.js"));'
                    'm+=`<link rel="stylesheet" href="${mpeCcCss}"><script defer src="${mpeCcJs}"></script>`}'
                ),
            ),
        ]
        for anchor, inj in anchors:
            idx = text.find(anchor)
            if idx >= 0:
                insert_at = idx + len(anchor)
                text = text[:insert_at] + inj + text[insert_at:]
                changed = True
                print("patched: code-copy button inject")
                break
        else:
            print(
                "WARN: cannot find head-inject anchor; manual code-copy inject needed"
            )
    else:
        print("ok: code-copy button already injected")

    # revealLine: 0.8.32 zsu / 0.8.30 XBa
    if ZSU_OLD in text:
        text = text.replace(ZSU_OLD, ZSU_NEW, 1)
        changed = True
        print("patched: zsu revealLine openTextDocument (0.8.32)")
    elif "async function zsu(e,t)" in text and REVEAL_OPEN in text:
        print("ok: zsu already opens document")
    else:
        i = text.find("async function XBa")
        if i < 0:
            i = text.find("function XBa(e,A)")
        if i >= 0:
            j = text.find("async function $Ba", i)
            if j < 0:
                j = text.find("async function Wsu", i)
            chunk = text[i:j] if j > i else text[i : i + 800]
            if "openTextDocument" not in chunk:
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
                    print("patched: XBa openTextDocument (0.8.30)")
                else:
                    print("WARN: cannot bound XBa/zsu function")
            else:
                print("ok: revealLine handler already opens document")
        else:
            print("WARN: zsu/XBa revealLine handler not found")

    if changed:
        path.write_text(text)
        print(f"wrote {path}")


def patch_preview_js(path: Path) -> None:
    text = path.read_text(errors="ignore")
    changed = False

    has_dblclick = DBLCLICK_MARKER_NEW in text or DBLCLICK_MARKER_OLD in text
    if has_dblclick:
        print("ok: preview dblclick reveal already present")
    else:
        # Detect React namespace + postMessage helper from surrounding keydown effect
        ns, helper, key_var = detect_preview_symbols(text)
        # walker 变量不要用 N1：0.8.32 的 postMessage helper 就叫 N1，会影子冲突
        hook = (
            f"(0,{ns}.useEffect)(()=>{{let F1=e1=>{{if(e1.target&&e1.target.closest&&e1.target.closest(\".mpe-lightbox-overlay\"))return;"
            f'let Te=e1.target,Ce=null;for(;Te&&Te!==document.body;){{let pA=Te.getAttribute&&Te.getAttribute("data-source-line");'
            f"if(pA){{let dA=parseInt(pA,10);if(!isNaN(dA)){{Ce=dA-1;break}}}}Te=Te.parentElement}}"
            f'if(Ce==null)return;e1.preventDefault(),e1.stopPropagation(),{helper}("revealLine",[n.current,Ce])}};'
            f'return document.addEventListener("dblclick",F1,!0),()=>{{document.removeEventListener("dblclick",F1,!0)}}}},[{helper}]),'
        )
        text, inserted = insert_after_keydown_effect(text, hook, key_var)
        if inserted:
            changed = True
            print(f"patched: preview dblclick reveal (helper={helper}, ns={ns})")

    if DISABLE_WHEEL_ZOOM_MARKER in text:
        print("ok: Cmd/Ctrl+wheel zoom already disabled")
    else:
        ns, _helper, key_var = detect_preview_symbols(text)
        hook = (
            f"(0,{ns}.useEffect)(()=>{{let W1=e1=>{{if(!(e1.ctrlKey||e1.metaKey))return;"
            f"e1.preventDefault(),e1.stopImmediatePropagation()}};"
            f'return document.addEventListener("wheel",W1,{{passive:!1,capture:!0}}),'
            f'document.documentElement.dataset.mpeDisableWheelZoom="mpe-disable-wheel-zoom",'
            f"()=>{{document.removeEventListener(\"wheel\",W1,{{capture:!0}})}}}},[]),"
        )
        text, inserted = insert_after_keydown_effect(text, hook, key_var)
        if inserted:
            changed = True
            print("patched: disabled Cmd/Ctrl+wheel preview zoom")

    if changed:
        path.write_text(text)
        print(f"wrote {path}")


def detect_preview_symbols(text: str) -> tuple[str, str, str]:
    """Return (reactNs, postMessageHelper, keydownHandlerVar)."""
    # Prefer the alwaysShowBacklinks-adjacent keydown effect (preview root)
    m = re.search(
        r'alwaysShowBacklinksInPreview\}\),\(0,([A-Za-z0-9_$]+)\.useEffect\)\(\(\)=>\(document\.addEventListener\("keydown",([A-Za-z0-9_$]+)\)',
        text,
    )
    if m:
        ns, key_var = m.group(1), m.group(2)
    else:
        ns, key_var = "pe", "Kr"
        m2 = re.search(
            r'\(0,([A-Za-z0-9_$]+)\.useEffect\)\(\(\)=>\(document\.addEventListener\("keydown",([A-Za-z0-9_$]+)\)',
            text,
        )
        if m2:
            ns, key_var = m2.group(1), m2.group(2)

    # postMessage helper: N1=(0,pe.useCallback)((Q,h1=[])=>{x1?x1.postMessage...
    hm = re.search(
        r'([A-Za-z0-9_$]+)=\(0,[A-Za-z0-9_$]+\.useCallback\)\(\(Q,h1=\[\]\)=>\{[^}]*postMessage\(\{command:Q,args:h1\}\)',
        text,
    )
    helper = hm.group(1) if hm else "N1"
    return ns, helper, key_var


def insert_after_keydown_effect(
    text: str, hook: str, key_var: str | None = None
) -> tuple[str, bool]:
    candidates_vars = []
    if key_var:
        candidates_vars.append(key_var)
    candidates_vars.extend(["Kr", "Jt"])

    for kv in candidates_vars:
        anchor = f'document.addEventListener("keydown",{kv})'
        idx = text.find(anchor)
        if idx < 0:
            continue
        endings = (f"}}),[{kv}]),", f"}},[{kv}]),")
        for ending in endings:
            end = text.find(ending, idx)
            if end >= 0:
                # Avoid double-inject: if our hook already sits right after, skip
                insert_at = end + len(ending)
                if 'addEventListener("dblclick"' in text[insert_at : insert_at + 400]:
                    print("ok: dblclick hook already after keydown effect")
                    return text, False
                if (
                    DISABLE_WHEEL_ZOOM_MARKER in text[insert_at : insert_at + 400]
                    and "mpe-disable-wheel-zoom" in hook
                ):
                    print("ok: wheel-zoom hook already after keydown effect")
                    return text, False
                return text[:insert_at] + hook + text[insert_at:], True

    print(
        "WARN: cannot find keydown anchor for preview hook inject; manual patch needed"
    )
    return text, False


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: patch-mpe-bundles.py <mpe-extension-dir>")
        return 2
    root = Path(sys.argv[1])
    patch_extension_js(root / "out/native/extension.js")
    web = root / "out/web/extension.js"
    if web.exists():
        pass
    patch_preview_js(root / "crossnote/webview/preview.js")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
