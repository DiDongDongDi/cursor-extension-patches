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
