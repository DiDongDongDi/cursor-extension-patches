# Cursor Markdown 预览 checkbox 左侧裁切修复

> 记录时间：2026-07-01  
> 场景：MyNotes 仓库，Cursor 中 Markdown 预览（内置 + 交互式）左侧内容/checkbox 被截断

## 现象

- 打开 Markdown 预览后，**左侧部分内容看不到**（checkbox、列表缩进贴边或被裁切）。
- 同时存在 **checkbox 无法点击** 的问题（与 MAIO 扩展有关，见下文关联项）。

## 根因（两处预览，原因不同）

### 1. 内置预览（Cmd+Shift+V）

扩展 **Markdown All in One**（`yzhang.markdown-all-in-one`）的预览样式 `media/checkbox.css`：

```css
.task-list-item-checkbox {
    margin-left: -20px;
    pointer-events: none;
}
```

- `margin-left: -20px` 把 checkbox 往左拉出可视区域，父容器若有 `overflow: hidden` 就会**左侧被裁切**。
- `pointer-events: none` 导致 checkbox **无法点击**（需另用 CSS 覆盖）。

扩展 **Markdown Checkboxes**（`bierner.markdown-checkbox`）的 `checkboxes.css` 里还有：

```css
.contains-task-list {
    padding-left: 0;
}
```

进一步压缩 task list 左侧空间。

### 2. 交互式预览（GSejas `markdown-checkbox-preview`）

Cursor 扩展市场搜不到该扩展，需从 VS Code Marketplace 下载 VSIX 安装。其 webview 内嵌样式问题：

| 选择器               | 原值                     | 问题                         |
| -------------------- | ------------------------ | ---------------------------- |
| `ul, ol`             | `padding-left: 0`        | 列表贴左边，嵌套内容易被裁切 |
| `.main-container`    | `padding: 32px 24px`     | 左内边距偏小                 |
| `.content-container` | `padding: 24px`          | 同上                         |
| `body`               | 无 `overflow-x: visible` | 窄面板时横向溢出被裁         |

## 修复方案

### A. 内置预览：工作区 CSS 覆盖

**文件**：`.vscode/markdown-preview-checkbox-fix.css`

**在** `.vscode/settings.json` **中引用**：

```json
"markdown.styles": [
    ".vscode/markdown-preview-checkbox-fix.css"
],
"markdown-checkboxes.enable": true
```

**关键覆盖点**：

- `.task-list-item-checkbox { margin-left: 0 !important; }` — 取消 MAIO 负 margin
- `.contains-task-list { padding-left: 1.25em !important; }` — 恢复 task list 左缩进
- `overflow: visible` — 防止 preview section 裁切
- `pointer-events: auto !important` — 恢复 checkbox 可点击（内置预览点击不一定写回源文件）

### B. 交互式预览：改扩展内嵌样式

**文件**（本机路径，扩展升级后可能被覆盖）：

```
~/.cursor/extensions/gsejas.markdown-checkbox-preview-1.0.9/dist/extension.js
```

**改动摘要**（在 HTML 模板 `<style>` 块内）：

| 位置                                        | 改前                 | 改后                                                   |
| ------------------------------------------- | -------------------- | ------------------------------------------------------ |
| `body`                                      | —                    | 加 `overflow-x: visible`                               |
| `.main-container`                           | `padding: 32px 24px` | `padding: 32px 28px 32px 36px` + `overflow-x: visible` |
| `.content-container`                        | `padding: 24px`      | `padding: 24px 24px 24px 28px` + `overflow: visible`   |
| `ul, ol`                                    | `padding-left: 0`    | `padding-left: 1.25em`                                 |
| `@media (max-width: 600px) .main-container` | `padding: 20px 16px` | `padding: 20px 16px 20px 24px`                         |

**关联设置**（**勿开启**自动打开交互预览，见下文「滚动同步」）：

```json
"markdown-checkbox-preview.autoPreview": false
```

## 滚动同步：勿开启交互式 checkbox 自动预览

> 补充记录：2026-07-01

### 现象

- 开启 GSejas `markdown-checkbox-preview.autoPreview` 后，Markdown **预览与原文编辑区无法保持双向同步滚动**（或滚动明显错位、不同步）。

### 根因

- GSejas **交互式预览**是独立 webview，不走 VS Code/Cursor 内置的 `markdown.preview.scrollPreviewWithEditor` / `scrollEditorWithPreview` 机制。
- 扩展仅实现**编辑区 → 预览**单向跟随（`onDidChangeTextEditorVisibleRanges`），**预览滚动不会带动编辑器**，与侧边内置预览（`Cmd+K V`）体验不一致。
- `autoPreview: true` 会在打开 `.md` 时自动弹出该面板，容易误以为是内置预览坏了。

### 结论与推荐配置

- **MyNotes 工作区保持 `markdown-checkbox-preview.autoPreview: false`**，不要开启交互式 checkbox 自动预览。
- 日常用 **`Cmd+K V` 侧边内置预览** + `.vscode/markdown-preview-checkbox-fix.css` 即可（checkbox 可点，滚动双向同步）。
- 若必须在预览里勾选并**写回源文件**：临时手动执行 **Open Interactive Checkbox Preview**，用完关掉，不要常开 autoPreview。
- 源码内切换 checkbox：Markdown All in One **Alt+C**，不依赖交互预览。

## 所需扩展（Cursor 市场无，VSIX 安装）

```bash
# bierner.markdown-checkbox — 内置预览渲染 checkbox
curl -L "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/bierner/vsextensions/markdown-checkbox/latest/vspackage" \
  -o /tmp/markdown-checkbox.vsix.gz
gunzip -c /tmp/markdown-checkbox.vsix.gz > /tmp/markdown-checkbox.vsix
cursor --install-extension /tmp/markdown-checkbox.vsix

# GSejas.markdown-checkbox-preview — 可点击且回写源文件
curl -L "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/GSejas/vsextensions/markdown-checkbox-preview/latest/vspackage" \
  -o /tmp/markdown-checkbox-preview.vsix.gz
gunzip -c /tmp/markdown-checkbox-preview.vsix.gz > /tmp/markdown-checkbox-preview.vsix
cursor --install-extension /tmp/markdown-checkbox-preview.vsix
```

安装或改配置后执行 **Developer: Reload Window**。

## 验证

- [ ] 内置预览（`Cmd+K V`）：预览与编辑区**双向滚动同步**正常
- [ ] 内置预览：checkbox 可点（视觉切换）
- [ ] **未开启** `markdown-checkbox-preview.autoPreview`（交互预览不自动弹出）
- [ ] 嵌套列表、普通 `ul/ol` 左侧不被贴边裁切

## 注意事项

1. **MAIO 与 bierner.markdown-checkbox 可能冲突**：MAIO 的 preview CSS 优先级高，必须用工作区 `markdown.styles` 覆盖，不能只装扩展不覆盖 CSS。
2. **GSejas 补丁不持久**：扩展更新会覆盖 `dist/extension.js`，裁切复现时需按上表重新改，或等上游修复。
3. **勿开启交互式 checkbox 自动预览**：`markdown-checkbox-preview.autoPreview` 必须为 `false`，否则会破坏预览与原文的同步滚动；写回源文件仅临时手动开交互预览。
4. **内置预览 vs 交互预览**：内置预览（`Cmd+K V`）适合日常阅读与双向滚动；交互预览仅适合偶尔需要预览内勾选写回时手动打开。
5. **编辑器内快捷切换**：Markdown All in One 的 **Alt+C** 可在源码行切换 checkbox，不依赖预览。

## 本仓库已落地文件

| 文件                                        | 作用                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `.vscode/markdown-preview-checkbox-fix.css` | 内置预览裁切 + 可点击                                                                               |
| `.vscode/settings.json`                     | `markdown.styles`、`markdown-checkboxes.enable`；**`markdown-checkbox-preview.autoPreview: false`** |
| `.vscode/markdown-preview-checkbox-sync/`   | **内置预览 checkbox 点击写回源文件**（本地扩展，见下节）                                            |

## 内置预览 checkbox 写回源文件（2026-07-01 补充）

### 现象

- 在 **Cmd+K V 内置预览**里点击 checkbox，预览里状态会变，但 **`.md` 原文不变**（重开预览后恢复）。

### 根因

- `bierner.markdown-checkbox` 只负责**渲染** checkbox，不含写回逻辑。
- 工作区 CSS 虽恢复了 `pointer-events: auto`，仍无脚本把点击同步到编辑器。

### 修复

已添加本地扩展 **Markdown Preview Checkbox Sync (MyNotes)**：

- 路径：`.vscode/markdown-preview-checkbox-sync/`
- 机制：`markdown.previewScripts` 监听 checkbox `change` → **`cursor://` URI handler** 写回对应行（Cursor 必须用 `cursor://`，`vscode://` 会被预览当成打开文件而报错；`command:` 在预览里不会执行）。
- 安装：扩展已复制到 `~/.cursor/extensions/kody-local.markdown-preview-checkbox-sync-0.1.2/`；改源码后需重新复制并 **Developer: Reload Window**。

```bash
cp -R ~/MyNotes/.vscode/markdown-preview-checkbox-sync \
  ~/.cursor/extensions/kody-local.markdown-preview-checkbox-sync-0.1.2
```

- 调试：输出面板选择 **Markdown Preview Checkbox Sync**，勾选后应看到 `URI: cursor://...` 与 `Toggled line ...` 日志。

### 验证

- [ ] Reload Window 后，打开 `.md` → **Cmd+K V** 内置预览
- [ ] 点击 checkbox → 原文对应行 `- [ ]` / `- [x]` 同步变化
- [ ] 预览与编辑区仍保持**双向滚动同步**（无需开启 GSejas autoPreview）

### 注意

- 仍用 **内置预览**（`Cmd+K V`），不是 GSejas 交互预览。
- GSejas **Open Interactive Checkbox Preview** 仍可用于侧栏树、CodeLens 等；日常勾选写回靠本扩展即可。
