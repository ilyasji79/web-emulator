"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeNetworkError = describeNetworkError;
exports.checkUrl = checkUrl;
exports.waitForUrl = waitForUrl;
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const url_1 = require("./url");
function describeNetworkError(code, url) {
    const where = url.host;
    switch (code) {
        case 'ECONNREFUSED':
            return `Nothing is listening on ${where}. Start your development server and try again.`;
        case 'ENOTFOUND':
        case 'EAI_AGAIN':
            return `The host name "${url.hostname}" could not be resolved.`;
        case 'ETIMEDOUT':
        case 'ESOCKETTIMEDOUT':
            return `Timed out while connecting to ${where}.`;
        case 'ECONNRESET':
            return `The connection to ${where} was reset by the server.`;
        case 'DEPTH_ZERO_SELF_SIGNED_CERT':
        case 'SELF_SIGNED_CERT_IN_CHAIN':
        case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
        case 'CERT_HAS_EXPIRED':
            return `The TLS certificate of ${where} is not trusted.`;
        default:
            return `Could not connect to ${where}${code ? ` (${code})` : ''}.`;
    }
}
/** Resolves ok for ANY HTTP response (the server is reachable even if the page 404s). */
function checkUrl(url, timeoutMs = 3000) {
    return new Promise((resolve) => {
        const lib = url.protocol === 'https:' ? https : http;
        const req = lib.request({
            protocol: url.protocol,
            hostname: (0, url_1.bareHostname)(url),
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            method: 'GET',
            path: `${url.pathname}${url.search}`,
            headers: { Accept: 'text/html,*/*', 'Accept-Encoding': 'identity' },
            rejectUnauthorized: !(0, url_1.isLoopbackHost)(url.hostname),
            timeout: timeoutMs
        }, (res) => {
            res.destroy();
            resolve({ ok: true, status: res.statusCode ?? 0 });
        });
        req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
        req.on('error', (err) => {
            resolve({ ok: false, code: err.code ?? 'UNKNOWN', message: describeNetworkError(err.code, url) });
        });
        req.end();
    });
}
async function waitForUrl(url, opts) {
    const end = Date.now() + opts.timeoutMs;
    let last = { ok: false, code: 'ETIMEDOUT', message: describeNetworkError('ETIMEDOUT', url) };
    while (Date.now() < end) {
        if (opts.isCancelled?.()) {
            return { ok: false, code: 'CANCELLED', message: 'Cancelled.' };
        }
        last = await checkUrl(url, 1500);
        if (last.ok) {
            return last;
        }
        await new Promise((r) => setTimeout(r, opts.intervalMs ?? 500));
    }
    return last;
}
//# sourceMappingURL=serverCheck.js.map