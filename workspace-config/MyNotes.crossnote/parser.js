({
    // Obsidian 裸附件名 `![[xxx.png|宽度]]` → vault 根绝对路径，供 MPE 预览解析。
    // 附件目录与 .obsidian/app.json 的 attachmentFolderPath 一致：images
    //
    // Excalidraw：`![[Drawing….excalidraw|宽]]` → 伴生 autoexport SVG
    //（`Drawing….excalidraw.md` → `Drawing….excalidraw.svg`，与插件 getIMGFilename 一致）
    onWillParseMarkdown: async function (markdown) {
        const imgExt = /\.(?:apng|avif|gif|jpe?g|png|svg|bmp|webp|emf)$/i;
        const attachDir = "images";
        // 仅匹配嵌入目标 `.excalidraw`（不含已是 `.excalidraw.svg`）
        const excalidrawEmbed = /\.excalidraw(?:\.md)?$/i;

        return markdown.replace(
            /!\[\[([^\]|#]+)(\|[^\]]*)?\]\]/g,
            (whole, target, pipe) => {
                let name = String(target || "").trim();
                if (!name) return whole;

                const widthMatch = pipe && /^\|\s*(\d+)\s*$/.exec(pipe);
                const widthAttr = widthMatch
                    ? `{width=${widthMatch[1]}}`
                    : "";

                // Excalidraw wiki 嵌入 → 同路径伴生 SVG（不进 /images/）
                if (
                    excalidrawEmbed.test(name) &&
                    !/\.excalidraw\.svg$/i.test(name)
                ) {
                    name = name.replace(/\.md$/i, "");
                    const svgName = `${name}.svg`;
                    return `![[${svgName}]]${widthAttr}`;
                }

                // 伴生 SVG：保持相对路径，交给 MPE 按笔记目录解析
                if (/\.excalidraw\.svg$/i.test(name)) {
                    return widthAttr
                        ? `![[${name}]]${widthAttr}`
                        : whole;
                }

                if (name.includes("/") || name.startsWith("/")) return whole;
                if (!imgExt.test(name)) return whole;

                const abs = `/${attachDir}/${name}`;
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
