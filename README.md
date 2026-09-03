# Cursor 扩展补丁仓库

本仓库保存 **Cursor 里我们改过/自研** 的扩展补丁与源码，避免升级覆盖后丢失。

> GitHub：https://github.com/DiDongDongDi/cursor-extension-patches  
> 本地路径：`~/cursor-extension-patches`  
> Cursor skill：`~/MyNotes/.cursor/skills/cursor-extension-patches/SKILL.md`  
> 约定：任何改动先改本仓库，再 `./scripts/apply-all.sh` 同步到 `~/.cursor/extensions/`，然后 **立刻 commit 并 `git push origin main`（默认自动推 GitHub，不必再问）**。

## 盘点结论（2026-07-17）

| 扩展 ID                                     | 类型        | 改动摘要                                                                                                                                                                                                 |
| ------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shd101wyy.markdown-preview-enhanced`       | 上游 + 补丁 | 灯箱缩放/拖拽、API proxy、双击跳原文、`zsu`/`XBa` 打开编辑器、vue.diff 配色、已有预览再按快捷键聚焦、禁用 Cmd/Ctrl+滚轮缩放、代码块复制按钮、关闭 md 源文件时同步关闭对应预览（当前对齐上游 **0.8.32**） |
| `gwanjun.vscode-markdown-preview-advance`   | 上游 + 补丁 | `media/mermaid.js`：避免与 Mermaid 插件二次渲染                                                                                                                                                          |
| `barnim.markdown-code-copy-button`          | 上游 + 补丁 | `media/main.js`：跳过 Mermaid 代码块                                                                                                                                                                     |
| `mushan.vscode-paste-image`                 | 上游 + 补丁 | `res/mac.applescript`：优先 `pngpaste`（macOS 剪贴板截图多为 TIFF，原版只认 PNGf 会误报无图）                                                                                                              |
| `kody-local.markdown-preview-checkbox-sync` | **自研**    | 内置预览 checkbox 点击写回源文件；Markdown 编辑器右键「转为 / 取消 Checkbox」                                                                                                                            |
| `kody-local.filtered-editor-switcher`       | **自研**    | Ctrl+Tab 只切文本/笔记本编辑器，跳过 MPE Preview 与 Cursor 聊天 webview                                                                                                                                  |

其余已装扩展：**未发现本地改动**（仅 marketplace 原版）。

另：`~/MyNotes/.crossnote/` 不是插件，但是 MPE 工作区配置，已快照到 `workspace-config/MyNotes.crossnote/`。

## 目录结构

```text
extensions/
  shd101wyy.markdown-preview-enhanced/   # 补丁文件 + snippets + apply
  gwanjun.vscode-markdown-preview-advance/
  barnim.markdown-code-copy-button/
  kody-local.markdown-preview-checkbox-sync/  # 完整源码
  kody-local.filtered-editor-switcher/        # Ctrl+Tab 过滤预览/聊天
workspace-config/MyNotes.crossnote/
scripts/apply-all.sh
scripts/sync-from-cursor.sh
docs/   # 复现笔记
```

## 日常工作流

### 改补丁（权威源 = 本仓库）

1. 在本仓库改文件
2. `./scripts/apply-all.sh`
3. Cursor：`Developer: Reload Window`
4. `git add/commit` 后立刻 `git push origin main`（默认自动推 GitHub，不必再问）

### 在 Cursor 扩展目录里热改之后

1. `./scripts/sync-from-cursor.sh`（把已装目录的改动拉回本仓库）
2. 检查 diff → commit/push

## 应用补丁

```bash
cd ~/cursor-extension-patches
./scripts/apply-all.sh
```

## 注意

- **不要**把整份上游扩展（含 13MB `extension.js`）提交进仓库；只存补丁文件与可重复的 apply 脚本。
- 改完后立刻 `git push origin main`（默认自动推 GitHub，不必再问；用户说「先别推」才跳过）。
- MPE 预览的代码块复制按钮来自 `media/code-copy.{js,css}`：`barnim.markdown-code-copy-button` 走 `markdown.previewScripts`，只对 VS Code 内置预览生效；MPE 自带的只有块级 `.floating-action`（复制的是带围栏的 markdown 源码），且已被 `.crossnote` 样式隐藏。
- 升级 MPE / Advance / Code Copy 后务必重新 `apply-all`，并核对 `UPSTREAM_VERSION`。
- 远端仓库：https://github.com/DiDongDongDi/cursor-extension-patches（public）
