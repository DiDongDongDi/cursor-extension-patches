# Cursor Markdown Preview Enhanced（MPE）预览增强 — 配置复现

> 日期：2026-07-17  
> 扩展：`shd101wyy.markdown-preview-enhanced` **v0.8.30**  
> Vault：`~/MyNotes`  
> 目标：在 Cursor 里用 MPE 预览 Obsidian 风格笔记，体验接近/优于内置预览，且**不改 Markdown 原文**（保留 `![[...]]`）。

## 使用约定

- 预览必须用 **MPE 侧栏**：`Cmd+Option+V`（不是 Cursor 内置 Preview / 旧的 `Cmd+K V`）。
- 改 `.crossnote/*` 后：在编辑器里 **保存一次** 对应文件，或 `Developer: Reload Window`，再重开预览。
- **扩展目录补丁会在升级 MPE 后丢失**，需按下文「扩展补丁」重做。

---

## 能力清单

| 能力                                     | 实现位置                                         | 升级是否丢失             |
| ---------------------------------------- | ------------------------------------------------ | ------------------------ |
| Obsidian 裸图 `![[xxx.png\|宽]]` 能显示  | `.crossnote/parser.js` + settings                | 否                       |
| 点图灯箱 + 滚轮缩放 + 拖拽               | 扩展 `media/lightbox.*` + `extension.js` 注入    | **是**                   |
| Esc 只关灯箱、不切目录                   | `media/lightbox.js`                              | **是**                   |
| 双击预览跳原文（编辑器不可见时也能打开） | `preview.js` + `extension.js` 的 `XBa`           | **是**                   |
| 关闭双向滚动                             | settings `scrollSync: false`                     | 否                       |
| 标题蓝色加粗（无自动编号）               | `.crossnote/style.less`                          | 否                       |
| ` ```diff ` 红绿配色                     | `style.less` + `head.html`（+ 可选改 `vue.css`） | style 否；vue.css **是** |
| 快捷键 `Cmd+Option+V`                    | `keybindings.json`                               | 否                       |

---

## 1. 安装扩展

```bash
cursor --install-extension shd101wyy.markdown-preview-enhanced
```

扩展目录（当前版本）：

`~/.cursor/extensions/shd101wyy.markdown-preview-enhanced-0.8.30-universal/`

---

## 2. Cursor 用户设置

文件：`~/Library/Application Support/Cursor/User/settings.json`

```json
"markdown-preview-enhanced.wikiLinkResolution": "shortest",
"markdown-preview-enhanced.imageFolderPath": "/images",
"markdown-preview-enhanced.enableImageLightbox": true,
"markdown-preview-enhanced.scrollSync": false,
"markdown-preview-enhanced.previewTheme": "vue.css",
"markdown-preview-enhanced.codeBlockTheme": "vue.css"
```

说明：

- `imageFolderPath: /images` 与 Obsidian `attachmentFolderPath` 一致（vault 根下 `images/`）。
- `scrollSync: false`：关闭预览↔编辑器双向滚动。

---

## 3. 快捷键

文件：`~/Library/Application Support/Cursor/User/keybindings.json`

```json
{
  "key": "cmd+k v",
  "command": "-markdown-preview-enhanced.openPreviewToTheSide",
  "when": "editorLangId =~ /^(markdown|quarto|prompt|instructions|chatagent|skill)$/"
},
{
  "key": "cmd+alt+v",
  "command": "markdown-preview-enhanced.openPreviewToTheSide",
  "when": "editorLangId =~ /^(markdown|quarto|prompt|instructions|chatagent|skill)$/"
}
```

---

## 4. 工作区 `.crossnote`（持久、优先维护）

目录：`~/MyNotes/.crossnote/`

### 4.1 `parser.js` — Obsidian 图片 wiki 预解析

把裸图名映射到 vault 根绝对路径，**不改笔记正文**：

```js
({
    // Obsidian 裸附件名 `![[xxx.png|宽度]]` → vault 根绝对路径，供 MPE 预览解析。
    // 附件目录与 .obsidian/app.json 的 attachmentFolderPath 一致：images
    onWillParseMarkdown: async function (markdown) {
        const imgExt = /\.(?:apng|avif|gif|jpe?g|png|svg|bmp|webp|emf)$/i;
        const attachDir = "images";

        return markdown.replace(
            /!\[\[([^\]|#]+)(\|[^\]]*)?\]\]/g,
            (whole, target, pipe) => {
                const name = String(target || "").trim();
                if (!name || name.includes("/") || name.startsWith("/"))
                    return whole;
                if (!imgExt.test(name)) return whole;

                const abs = `/${attachDir}/${name}`;
                const widthMatch = pipe && /^\|\s*(\d+)\s*$/.exec(pipe);
                if (widthMatch) {
                    return `![[${abs}]]{width=${widthMatch[1]}}`;
                }
                return `![[${abs}]]`;
            },
        );
    },

    onDidParseMarkdown: async function (html) {
        return html;
    },
});
```

### 4.2 `style.less` — 标题样式 + diff 配色

要点：

- 选择器必须包在 `.markdown-preview.markdown-preview { ... }` 内。
- 标题：`#0969da`、加粗；**不**用 CSS counter 自动编号（已去掉 `::before` 序号）。
- diff：Prism 实际类名是 `deleted-sign` / `inserted-sign`（alias 才有 `deleted`/`inserted`）；`vue` 主题默认只有删除线/虚线下划线。

当前完整文件见：`~/MyNotes/.crossnote/style.less`。

### 4.3 `head.html` — 灯箱兜底样式 + diff 配色备份

- webview 会拦截 inline **script**，逻辑不要写在这里。
- CSS 可以写；diff 配色在此再写一份，避免 `style.less` 未重编译时失效。

当前完整文件见：`~/MyNotes/.crossnote/head.html`。

### 4.4 `config.js`

默认 KaTeX/MathJax/Mermaid 配置即可（本次无业务改动）。

---

## 5. 扩展补丁（升级会丢，需备份/重打）

扩展根：`$MPE=~/.cursor/extensions/shd101wyy.markdown-preview-enhanced-0.8.30-universal`

### 5.1 新增/替换 media 文件

| 文件                             | 作用                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `$MPE/media/vscode-api-proxy.js` | 代理 `acquireVsCodeApi`（webview 只能调一次），挂到 `window.__mpeVsCodeApi`          |
| `$MPE/media/lightbox.js`         | 点图灯箱、滚轮按原图像素缩放、拖拽、Esc 拦截、双击跳原文（postMessage `revealLine`） |
| `$MPE/media/lightbox.css`        | 灯箱全屏遮罩与图片样式                                                               |

复现时直接从当前机器拷贝这三份即可（已改好）。

### 5.2 `out/native/extension.js` 注入灯箱脚本

在预览 HTML 初始化处注入（已存在则跳过）：

1. 始终注入 `media/vscode-api-proxy.js`
2. 当 `enableImageLightbox` 为 true 时注入 `lightbox.css` + `lightbox.js`

特征字符串（便于升级后搜索）：

- `media/vscode-api-proxy.js`
- `media/lightbox.js`

### 5.3 `XBa`（`_crossnote.revealLine`）— 编辑器不可见时先打开文档

当前逻辑要点：

```js
async function XBa(e, A) {
    let t = xt.Uri.parse(e);
    let r = xt.window.visibleTextEditors.find(
        (n) => jh(n.document) && n.document.uri.fsPath === t.fsPath,
    );
    if (!r) {
        try {
            let n = await xt.workspace.openTextDocument(t);
            r = await xt.window.showTextDocument(n, {
                preserveFocus: false,
                preview: false,
            });
        } catch (n) {
            return console.error(n);
        }
    }
    // … selection + revealRange …
}
```

升级后若双击跳转失效，在新 `extension.js` 里搜 `_crossnote.revealLine` / `function XBa`，按上面补「不可见则 open + show」。

### 5.4 `crossnote/webview/preview.js` — 双击跳原文

在 capture 阶段监听 `dblclick`：沿 DOM 找 `data-source-line`，`postMessage({ command: "revealLine", args: [uri, line] })`。

特征：`document.addEventListener("dblclick"` + `"revealLine"`。

### 5.5（可选）`crossnote/styles/prism_theme/vue.css` — diff 主题补色

当前主题只有删除线时，可直接改主题文件（立竿见影，但升级必丢）：

把：

```css
.token.deleted {
    text-decoration: line-through;
}
.token.inserted {
    border-bottom: 1px dotted #202746;
    text-decoration: none;
}
```

换成（或追加）红绿底色规则；同时依赖 `.crossnote` 的 `style.less` / `head.html` 作为持久方案。

校验：`vue.css` 中应含 `#ffebe9` / `#dafbe1`。

---

## 6. 验证清单

1. 打开含 `![[Pasted image ….png|968]]` 的笔记 → `Cmd+Option+V` → 图片能显示。
2. 单击图片 → 灯箱；滚轮缩放；拖拽平移；Esc 关闭且不切左侧目录。
3. 双击预览正文 → 跳到对应 Markdown 行（侧栏无编辑器时也会打开文件）。
4. 标题为蓝色加粗，且有 `1` / `1.1` / `1.1.1` 编号。
5. ` ```diff ` 块：删除行红底、新增行绿底（参考 `ai_todos/2026-07-13-TODO288-交易老模块分批下线.md` 中 `company_bill_stat.conf` 段）。
6. 编辑器与预览互不强制跟滚。

---

## 7. 踩坑（复现必看）

1. **打开错预览**：内置 Preview 没有灯箱/自定义 CSS；必须确认是 MPE。
2. **改 `.crossnote` 无效果**：工具直接写磁盘可能不触发 MPE 的 `onDidSave`；请在 Cursor 里打开该文件再保存，或 Reload Window。
3. **`head.html` 不能放业务 script**：webview CSP/拦截会导致 inline script 无效；脚本放扩展 `media/` 并由 `extension.js` 注入。
4. **diff「没颜色」**：`vue.css` 默认只有删除线；Prism 类名是 `deleted-sign`/`inserted-sign`，选择器要覆盖它们。
5. **Obsidian 图裂**：笔记在子目录、图在根 `images/`；靠 `parser.js` 映射，不要为了预览去改正文路径。
6. **升级 MPE**：先备份 `media/lightbox.js`、`lightbox.css`、`vscode-api-proxy.js`，以及记下 `XBa` / preview `dblclick` / vue.css 补丁要点。

---

## 8. 相关路径速查

| 用途             | 路径                                                                         |
| ---------------- | ---------------------------------------------------------------------------- |
| 工作区 MPE 配置  | `~/MyNotes/.crossnote/`                                                      |
| 用户 settings    | `~/Library/Application Support/Cursor/User/settings.json`                    |
| 用户 keybindings | `~/Library/Application Support/Cursor/User/keybindings.json`                 |
| MPE 扩展         | `~/.cursor/extensions/shd101wyy.markdown-preview-enhanced-0.8.30-universal/` |
| 附件目录         | `~/MyNotes/images/`                                                          |
| 对话记录         | [Cursor MPE 预览增强](d1e39a94-988c-4632-9554-5b4ae2bd63c6)                  |
