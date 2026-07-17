# Markdown Code Copy Button 与 Mermaid 渲染冲突处理

**日期**：2026-07-15  
**场景**：Cursor Markdown 预览中，Mermaid 流程图无法正常渲染；需要保留代码块复制按钮功能。

## 现象

正常 Mermaid 代码块：

````markdown
```mermaid
flowchart TD
    A --> B
```
````

预览报错：

```text
Maximum text size in diagram exceeded
No diagram type detected matching given configuration for text: <svg id='dmermaid-...'>
```

关键判断：报错里 Mermaid 解析到的输入已经不是 `flowchart TD`，而是渲染后的 `<svg id='dmermaid-...'>`，说明发生了二次渲染 / 二次解析。

## 根因

这次不是 Mermaid 图本身写错，而是多个 Markdown 预览增强脚本叠加：

- `Markdown Preview Mermaid Support` 会渲染 Mermaid。
- `Markdown Preview Advance` 也会渲染 Mermaid，并且原脚本监听 `pre.mermaid, div.mermaid`。
- `Markdown Code Copy Button` 会给 `pre > code` 注入复制按钮，可能触发预览 DOM 变更与重新扫描。

实际修复点是 `Markdown Preview Advance`：它监听了 `div.mermaid`，会扫到另一个 Mermaid 插件已经生成的 SVG 容器，导致 SVG 被再次当成 Mermaid 源码解析。

## 已执行处理

### 1. 保留复制按钮，但跳过 Mermaid

修改：

```text
~/.cursor/extensions/barnim.markdown-code-copy-button-0.1.1-universal/media/main.js
```

逻辑：遇到 Mermaid 相关代码块直接返回，普通代码块继续加复制按钮。

```javascript
if (isMermaidBlock(codeBlock, pre)) {
    return;
}
```

识别范围：

- `language-mermaid` / `mermaid` class
- `flowchart` / `graph` / `sequenceDiagram` / `classDiagram` 等 Mermaid 起始语法
- 已生成的 `dmermaid` SVG

### 2. 修复 Markdown Preview Advance 二次渲染

修改：

```text
~/.cursor/extensions/gwanjun.vscode-markdown-preview-advance-0.0.2/media/mermaid.js
```

核心改动：

```javascript
const SELECTOR = "pre.mermaid";
```

原来是：

```javascript
const SELECTOR = "pre.mermaid, div.mermaid";
```

并增加保护：若容器里已经有 `svg` 或 `dmermaid`，标记已处理并跳过。

```javascript
if (block.querySelector("svg") || block.querySelector('[id^="dmermaid-"]')) {
    block.dataset.processed = "true";
    return false;
}
```

## 验证

语法检查：

```shell
node --check "$HOME/.cursor/extensions/barnim.markdown-code-copy-button-0.1.1-universal/media/main.js"
node --check "$HOME/.cursor/extensions/gwanjun.vscode-markdown-preview-advance-0.0.2/media/mermaid.js"
```

生效方式：

```text
Developer: Reload Window
```

然后关闭旧 Markdown 预览，重新打开预览。

验证结果：Mermaid 恢复正常渲染，普通代码块复制按钮保留。

## 下次复现排查顺序

1. 看报错里是否出现 `<svg id='dmermaid-...'>`；若出现，优先按二次渲染处理。
2. 检查 `Markdown Preview Advance` 的 `media/mermaid.js` 是否仍只监听 `pre.mermaid`。
3. 检查 `Markdown Code Copy Button` 的 `media/main.js` 是否仍跳过 Mermaid。
4. 如果插件升级覆盖补丁，按本笔记重新打补丁。

## 风险

- 插件升级后可能覆盖本地补丁。
- 更稳方案：后续沉淀为自动补丁脚本，或 fork 一份固定版本插件。
