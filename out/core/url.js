"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLoopbackHost = isLoopbackHost;
exports.validatePreviewUrl = validatePreviewUrl;
exports.bareHostname = bareHostname;
exports.isPreviewableHtmlPath = isPreviewableHtmlPath;
const MAX_URL_LENGTH = 2048;
function isLoopbackHost(hostname) {
    const h = hostname.toLowerCase();
    if (h === 'localhost' || h === '[::1]' || h === '::1' || h === '0.0.0.0') {
        return true;
    }
    return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}
/**
 * Validates a user-typed preview URL. Accepts shorthands such as `3000`,
 * `:3000` and `localhost:3000`. Only http/https are allowed, credentials are
 * rejected, and non-loopback hosts need `allowRemote`.
 */
function validatePreviewUrl(input, opts) {
    let text = (input ?? '').trim();
    if (!text) {
        return { ok: false, reason: 'Enter a URL, for example http://localhost:3000.' };
    }
    if (text.length > MAX_URL_LENGTH) {
        return { ok: false, reason: 'The URL is too long.' };
    }
    // eslint-disable-next-line no-control-regex -- control characters are exactly what is being rejected
    if (/[\u0000-\u001f\u007f\s]/.test(text)) {
        return { ok: false, reason: 'The URL contains spaces or control characters.' };
    }
    if (/^\d{1,5}$/.test(text)) {
        text = `http://localhost:${text}`;
    }
    else if (/^:\d{1,5}(\/.*)?$/.test(text)) {
        text = `http://localhost${text}`;
    }
    else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(text) && !/^[^/]+:\d{1,5}(\/|$)/.test(text)) {
            // e.g. javascript:, data:, file:, mailto:
            return { ok: false, reason: `Unsupported URL scheme. Only http and https URLs can be previewed.` };
        }
        text = `http://${text}`;
    }
    let url;
    try {
        url = new URL(text);
    }
    catch {
        return { ok: false, reason: 'This is not a valid URL.' };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { ok: false, reason: 'Unsupported URL scheme. Only http and https URLs can be previewed.' };
    }
    if (url.username || url.password) {
        return { ok: false, reason: 'URLs containing a username or password are not supported.' };
    }
    if (!url.hostname) {
        return { ok: false, reason: 'The URL has no host name.' };
    }
    const loopback = isLoopbackHost(url.hostname);
    if (!loopback && !opts.allowRemote) {
        return {
            ok: false,
            reason: `Only local URLs (localhost, 127.x.x.x) can be previewed. Enable "webEmulator.allowRemoteUrls" to preview "${url.hostname}".`
        };
    }
    if (url.hostname === '0.0.0.0') {
        url.hostname = '127.0.0.1';
    }
    return { ok: true, url, loopback };
}
/** Strips brackets from an IPv6 literal so it can be passed to http.request. */
function bareHostname(url) {
    return url.hostname.replace(/^\[|\]$/g, '');
}
function isPreviewableHtmlPath(fsPath) {
    return /\.(html?|xhtml)$/i.test(fsPath);
}
//# sourceMappingURL=url.js.map