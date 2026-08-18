const TASK_ITEM = /^(\s*(?:>+\s*)*)([-*+]|\d+[.)])\s+\[[ xX]\](?:\s|$)/;
const LIST_ITEM = /^(\s*(?:>+\s*)*)([-*+]|\d+[.)])\s+(.*)$/;
const LINE_PREFIX = /^(\s*(?:>+\s*)*)(.*)$/;

/**
 * @param {string} text
 * @returns {string}
 */
function toCheckboxLine(text) {
    if (!text.trim()) {
        return text;
    }
    if (TASK_ITEM.test(text)) {
        return text;
    }
    const list = LIST_ITEM.exec(text);
    if (list) {
        return `${list[1]}${list[2]} [ ] ${list[3]}`;
    }
    const plain = LINE_PREFIX.exec(text);
    return `${plain[1]}- [ ] ${plain[2]}`;
}

/**
 * @param {string} text
 * @returns {string}
 */
function stripCheckboxLine(text) {
    return text.replace(
        /^(\s*(?:>+\s*)*(?:[-*+]|\d+[.)])\s+)\[(?: |x|X)\](?:[ \t]+|(?=$))/i,
        "$1",
    );
}

module.exports = { toCheckboxLine, stripCheckboxLine };
