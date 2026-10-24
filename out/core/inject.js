"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROBE_PATH = void 0;
exports.injectProbe = injectProbe;
exports.escapeHtml = escapeHtml;
exports.PROBE_PATH = '/__webemulator/probe.js';
const TAG = `<script src="${exports.PROBE_PATH}" data-web-emulator></script>`;
/**
 * Inserts the diagnostics script as early as possible without disturbing
 * quirks/standards mode (never before the doctype).
 */
function injectProbe(html) {
    const afterHead = /<head(?=[\s>])[^>]*>/i.exec(html);
    if (afterHead) {
        const i = afterHead.index + afterHead[0].length;
        return html.slice(0, i) + TAG + html.slice(i);
    }
    const afterHtml = /<html(?=[\s>])[^>]*>/i.exec(html);
    if (afterHtml) {
        const i = afterHtml.index + afterHtml[0].length;
        return html.slice(0, i) + TAG + html.slice(i);
    }
    const doctype = /<!doctype[^>]*>/i.exec(html);
    if (doctype) {
        const i = doctype.index + doctype[0].length;
        return html.slice(0, i) + TAG + html.slice(i);
    }
    return TAG + html;
}
function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
//# sourceMappingURL=inject.js.map