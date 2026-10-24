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
exports.PreviewSession = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const staticServer_1 = require("./core/staticServer");
const proxyServer_1 = require("./core/proxyServer");
const serverCheck_1 = require("./core/serverCheck");
const url_1 = require("./core/url");
const fail = (title, message, actions, code) => ({ ok: false, title, message, actions, code });
async function externalize(src) {
    // Forwards the port in remote windows (SSH/WSL/containers); a no-op locally.
    const ext = await vscode.env.asExternalUri(vscode.Uri.parse(src));
    const text = ext.toString(true);
    return { src: text, origin: new URL(text).origin };
}
/** Owns the loopback servers backing the current preview and disposes them on change. */
class PreviewSession {
    probeSource;
    staticServer;
    staticKey = '';
    proxy;
    proxyKey = '';
    constructor(probeSource) {
        this.probeSource = probeSource;
    }
    /** The folder the static server exposes, if a file preview is active. */
    get servedRoot() {
        return this.staticServer?.root;
    }
    async openFile(fsPath, settings) {
        const name = path.basename(fsPath);
        if (!(0, url_1.isPreviewableHtmlPath)(fsPath)) {
            return fail('Unsupported file type', `“${name}” is not an HTML file. Choose an .html or .htm file, or enter the URL of a running dev server.`, ['selectEntryFile', 'selectUrl']);
        }
        let stat;
        try {
            stat = await fs.promises.stat(fsPath);
        }
        catch {
            return fail('File not found', `“${name}” does not exist (it may have been moved or deleted).`, ['selectEntryFile', 'selectUrl', 'retry']);
        }
        if (!stat.isFile()) {
            return fail('Not a file', `“${name}” is not a file.`, ['selectEntryFile']);
        }
        const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fsPath))?.uri.fsPath;
        const root = settings.serveRoot === 'workspaceFolder' && folder ? folder : path.dirname(fsPath);
        const spa = settings.spaFallback ? fsPath : undefined;
        const key = [root, spa ?? '', settings.injectDiagnostics].join('|');
        await this.disposeProxy();
        try {
            if (!this.staticServer || this.staticKey !== key) {
                await this.disposeStatic();
                const server = new staticServer_1.StaticServer({ root, probeSource: settings.injectDiagnostics ? this.probeSource : undefined, spaFallbackEntry: spa });
                await server.start();
                this.staticServer = server;
                this.staticKey = key;
            }
        }
        catch (err) {
            return fail('Could not start the preview server', `The local preview server failed to start: ${err.message}`, ['retry']);
        }
        const server = this.staticServer;
        const rel = path.relative(server.root, await fs.promises.realpath(fsPath)).split(path.sep).map(encodeURIComponent).join('/');
        const local = `${server.origin}/${rel}`;
        const ext = await externalize(local);
        return {
            ok: true,
            externalHref: local,
            dto: { kind: 'file', display: decodeURIComponent(rel), src: ext.src, serverOrigin: ext.origin }
        };
    }
    async openUrl(input, settings) {
        const v = (0, url_1.validatePreviewUrl)(input, { allowRemote: settings.allowRemoteUrls });
        if (!v.ok) {
            return fail('Invalid URL', v.reason, ['selectUrl'], 'invalid-url');
        }
        const url = v.url;
        const check = await (0, serverCheck_1.checkUrl)(url);
        if (!check.ok) {
            return fail(`Cannot reach ${url.host}`, check.message, ['retry', 'selectUrl'], check.code);
        }
        const key = `${url.origin}|${settings.injectDiagnostics}`;
        await this.disposeStatic();
        try {
            if (!this.proxy || this.proxyKey !== key) {
                await this.disposeProxy();
                const proxy = new proxyServer_1.ProxyServer({ target: new URL(url.origin), probeSource: settings.injectDiagnostics ? this.probeSource : undefined });
                await proxy.start();
                this.proxy = proxy;
                this.proxyKey = key;
            }
        }
        catch (err) {
            return fail('Could not start the preview proxy', `The local proxy failed to start: ${err.message}`, ['retry']);
        }
        const local = this.proxy.toProxyUrl(url);
        const ext = await externalize(local);
        return {
            ok: true,
            externalHref: url.href,
            dto: { kind: 'url', display: url.href, src: ext.src, targetOrigin: url.origin, serverOrigin: ext.origin }
        };
    }
    /** Cheap health check used before an in-place reload. */
    async stillReachable(kind, value) {
        if (kind === 'file') {
            try {
                await fs.promises.access(value);
                return { ok: true };
            }
            catch {
                return { ok: false, message: `“${path.basename(value)}” no longer exists.` };
            }
        }
        const r = await (0, serverCheck_1.checkUrl)(new URL(value), 2000);
        return r.ok ? { ok: true } : { ok: false, message: r.message };
    }
    async disposeStatic() {
        const s = this.staticServer;
        this.staticServer = undefined;
        this.staticKey = '';
        await s?.dispose();
    }
    async disposeProxy() {
        const p = this.proxy;
        this.proxy = undefined;
        this.proxyKey = '';
        await p?.dispose();
    }
    dispose() {
        void this.disposeStatic();
        void this.disposeProxy();
    }
}
exports.PreviewSession = PreviewSession;
//# sourceMappingURL=preview.js.map