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
exports.EmulatorPanel = exports.VIEW_TYPE = void 0;
const vscode = __importStar(require("vscode"));
const config_1 = require("./config");
const devices_1 = require("./core/devices");
const url_1 = require("./core/url");
const preview_1 = require("./preview");
const webviewHtml_1 = require("./webviewHtml");
exports.VIEW_TYPE = 'webEmulator.preview';
const VIEWPORT_KEY = 'webEmulator.viewport';
const TARGET_KEY = 'webEmulator.lastTarget';
const RECENT_KEY = 'webEmulator.recentUrls';
const ACTION_COMMANDS = {
    openCurrentFile: 'webEmulator.openCurrentFile',
    selectEntryFile: 'webEmulator.selectEntryFile',
    selectUrl: 'webEmulator.selectUrl',
    openInBrowser: 'webEmulator.openInBrowser',
    startFlask: 'webEmulator.startFlask',
    startDjango: 'webEmulator.startDjango',
    selectPythonInterpreter: 'webEmulator.selectPythonInterpreter',
    openSettings: 'webEmulator.openSettings'
};
class EmulatorPanel {
    panel;
    deps;
    static current;
    session;
    disposables = [];
    ready = false;
    queue = [];
    reloadTimer;
    disposed = false;
    generation = 0;
    target;
    status = 'empty';
    lastError;
    externalHref;
    loadedSrc;
    viewport;
    diagnostics = [];
    reloadsRequested = 0;
    constructor(panel, deps) {
        this.panel = panel;
        this.deps = deps;
        this.session = new preview_1.PreviewSession(deps.probeSource);
        this.viewport = this.initialViewport();
        const ext = deps.context.extensionUri;
        panel.iconPath = vscode.Uri.joinPath(ext, 'media', 'icon.png');
        panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(ext, 'media'), vscode.Uri.joinPath(ext, 'out', 'webview')] };
        const nonce = (0, webviewHtml_1.createNonce)();
        panel.webview.html = (0, webviewHtml_1.buildWebviewHtml)({
            cspSource: panel.webview.cspSource,
            nonce,
            scriptUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(ext, 'out', 'webview', 'main.js')).toString(),
            styleUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(ext, 'media', 'emulator.css')).toString(),
            codiconUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(ext, 'media', 'codicons', 'codicon.css')).toString()
        });
        this.disposables.push(panel.webview.onDidReceiveMessage((m) => void this.onMessage(m)), panel.onDidDispose(() => this.dispose()), vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('webEmulator.customPresets') || e.affectsConfiguration('webEmulator.comparePresets') || e.affectsConfiguration('webEmulator.injectDiagnostics')) {
                this.post({ type: 'presets', ...this.presetPayload() });
            }
        }));
    }
    // ---------------------------------------------------------- lifecycle
    static show(deps, opts = { restoreTarget: true }) {
        if (EmulatorPanel.current) {
            EmulatorPanel.current.panel.reveal(undefined, false);
            return EmulatorPanel.current;
        }
        const column = (0, config_1.readSettings)().openBeside ? vscode.ViewColumn.Beside : vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
        const panel = vscode.window.createWebviewPanel(exports.VIEW_TYPE, 'Web Emulator', column, { enableScripts: true, retainContextWhenHidden: true });
        const inst = new EmulatorPanel(panel, deps);
        EmulatorPanel.current = inst;
        if (opts.restoreTarget) {
            void inst.restoreLastTarget();
        }
        return inst;
    }
    static revive(panel, deps) {
        EmulatorPanel.current?.dispose();
        const inst = new EmulatorPanel(panel, deps);
        EmulatorPanel.current = inst;
        void inst.restoreLastTarget();
    }
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        if (EmulatorPanel.current === this) {
            EmulatorPanel.current = undefined;
        }
        clearTimeout(this.reloadTimer);
        this.session.dispose();
        this.disposables.forEach((d) => d.dispose());
        this.panel.dispose();
    }
    // ------------------------------------------------------------ helpers
    presets() {
        return (0, devices_1.resolvePresets)((0, config_1.readSettings)().customPresets);
    }
    presetPayload() {
        const s = (0, config_1.readSettings)();
        const presets = (0, devices_1.resolvePresets)(s.customPresets);
        return { presets, compareIds: (0, devices_1.resolveCompareIds)(s.comparePresets, presets), injectDiagnostics: s.injectDiagnostics };
    }
    initialViewport() {
        const presets = this.presets();
        const saved = this.deps.context.workspaceState.get(VIEWPORT_KEY);
        const def = (0, devices_1.findPreset)(presets, (0, config_1.readSettings)().defaultPreset) ?? (0, devices_1.findPreset)(presets, devices_1.FALLBACK_PRESET_ID);
        const base = { presetId: def.id, width: def.width, height: def.height, rotated: false, zoom: 'fit', compare: false, showFrame: true, showDiagnostics: false, navMode: 'gesture' };
        if (!saved) {
            return base;
        }
        const zoom = saved.zoom === 'fit' || (typeof saved.zoom === 'number' && saved.zoom >= 0.1 && saved.zoom <= 4) ? saved.zoom : 'fit';
        const presetOk = saved.presetId === devices_1.CUSTOM_PRESET_ID || !!(0, devices_1.findPreset)(presets, saved.presetId);
        return {
            presetId: presetOk ? saved.presetId : base.presetId,
            width: (0, devices_1.clampDimension)(saved.width, base.width),
            height: (0, devices_1.clampDimension)(saved.height, base.height),
            rotated: saved.rotated === true,
            zoom,
            compare: saved.compare === true,
            showFrame: saved.showFrame !== false,
            showDiagnostics: saved.showDiagnostics === true,
            navMode: saved.navMode === 'buttons' ? 'buttons' : 'gesture'
        };
    }
    post(msg) {
        if (this.disposed) {
            return;
        }
        if (!this.ready) {
            this.queue.push(msg);
            return;
        }
        void this.panel.webview.postMessage(msg);
    }
    async onMessage(m) {
        switch (m.type) {
            case 'ready':
                this.ready = true;
                void this.panel.webview.postMessage({ type: 'init', viewport: this.viewport, ...this.presetPayload() });
                for (const q of this.queue.splice(0)) {
                    void this.panel.webview.postMessage(q);
                }
                return;
            case 'viewport':
                this.viewport = this.sanitizeViewport(m.viewport);
                void this.deps.context.workspaceState.update(VIEWPORT_KEY, this.viewport);
                return;
            case 'submitUrl':
                await this.openUrl(m.value);
                return;
            case 'action':
                if (m.id === 'retry') {
                    await this.reopen();
                }
                else if (m.id in ACTION_COMMANDS) {
                    await vscode.commands.executeCommand(ACTION_COMMANDS[m.id]);
                }
                return;
            case 'copy':
                if (typeof m.text === 'string' && m.text.length < 500) {
                    await vscode.env.clipboard.writeText(m.text);
                    vscode.window.setStatusBarMessage('Web Emulator: copied to clipboard', 2000);
                }
                return;
            case 'openExternal':
                await this.openExternalLink(m.url);
                return;
            case 'diagnostics':
                if (Array.isArray(m.frames)) {
                    this.diagnostics = m.frames.slice(0, 4);
                }
                return;
        }
    }
    sanitizeViewport(v) {
        const presets = this.presets();
        const presetOk = v.presetId === devices_1.CUSTOM_PRESET_ID || !!(0, devices_1.findPreset)(presets, v.presetId);
        return {
            presetId: presetOk ? v.presetId : devices_1.CUSTOM_PRESET_ID,
            width: (0, devices_1.clampDimension)(v.width, this.viewport.width),
            height: (0, devices_1.clampDimension)(v.height, this.viewport.height),
            rotated: v.rotated === true,
            zoom: v.zoom === 'fit' || (typeof v.zoom === 'number' && v.zoom >= 0.1 && v.zoom <= 4) ? v.zoom : 'fit',
            compare: v.compare === true,
            showFrame: v.showFrame !== false,
            showDiagnostics: v.showDiagnostics === true,
            navMode: v.navMode === 'buttons' ? 'buttons' : 'gesture'
        };
    }
    async openExternalLink(raw) {
        const v = (0, url_1.validatePreviewUrl)(String(raw), { allowRemote: true });
        if (!v.ok || !/^https?:\/\//i.test(String(raw))) {
            return;
        }
        const pick = await vscode.window.showInformationMessage(`The previewed page wants to open ${v.url.origin} in your browser.`, 'Open', 'Cancel');
        if (pick === 'Open') {
            await vscode.env.openExternal(vscode.Uri.parse(v.url.href));
        }
    }
    // ----------------------------------------------------------- targets
    async restoreLastTarget() {
        const last = this.deps.context.workspaceState.get(TARGET_KEY);
        if (!last) {
            return;
        }
        if (last.kind === 'file' && typeof last.fsPath === 'string') {
            await this.openFile(vscode.Uri.file(last.fsPath));
        }
        else if (last.kind === 'url' && typeof last.url === 'string') {
            await this.openUrl(last.url);
        }
    }
    async openFile(uri) {
        if (uri.scheme !== 'file') {
            this.showError({ ok: false, title: 'Unsupported location', message: 'Only HTML files on disk can be previewed. For remote content, enter its URL.', actions: ['selectUrl', 'selectEntryFile'] });
            return;
        }
        await this.apply({ kind: 'file', fsPath: uri.fsPath }, `Starting preview of ${uri.fsPath.split(/[\\/]/).pop()}…`);
    }
    async openUrl(input) {
        const v = (0, url_1.validatePreviewUrl)(input, { allowRemote: (0, config_1.readSettings)().allowRemoteUrls });
        if (!v.ok) {
            this.showError({ ok: false, title: 'Invalid URL', message: v.reason, actions: ['selectUrl'] });
            return;
        }
        await this.apply({ kind: 'url', url: v.url.href }, `Connecting to ${v.url.host}…`);
        if (this.status === 'loaded') {
            await this.remember(v.url.href);
        }
    }
    async remember(url) {
        const recent = this.deps.context.workspaceState.get(RECENT_KEY, []);
        await this.deps.context.workspaceState.update(RECENT_KEY, [url, ...recent.filter((u) => u !== url)].slice(0, 8));
    }
    async apply(target, loadingText) {
        const gen = ++this.generation;
        this.target = target;
        this.status = 'loading';
        this.lastError = undefined;
        this.post({ type: 'loading', message: loadingText });
        const settings = (0, config_1.readSettings)();
        const result = target.kind === 'file' ? await this.session.openFile(target.fsPath, settings) : await this.session.openUrl(target.url, settings);
        if (gen !== this.generation || this.disposed) {
            return; // superseded by a newer request
        }
        if (!result.ok) {
            this.showError(result);
            return;
        }
        this.status = 'loaded';
        this.externalHref = result.externalHref;
        this.loadedSrc = result.dto.src;
        void this.deps.context.workspaceState.update(TARGET_KEY, target);
        this.diagnostics = [];
        this.post({ type: 'load', target: result.dto });
        this.panel.title = target.kind === 'file' ? `Web Emulator: ${result.dto.display.split('/').pop()}` : `Web Emulator: ${new URL(target.url).host}`;
    }
    async pythonActions() {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            return [];
        }
        const d = await this.deps.python.detect(folder);
        const out = [];
        if (d.flask) {
            out.push('startFlask');
        }
        if (d.django) {
            out.push('startDjango');
        }
        return out;
    }
    showError(r) {
        this.status = 'error';
        this.lastError = { title: r.title, message: r.message };
        this.deps.log.appendLine(`[preview] ${r.title}: ${r.message}`);
        const isConnection = r.code === 'ECONNREFUSED' || r.code === 'ETIMEDOUT' || r.code === 'ECONNRESET';
        void (isConnection ? this.pythonActions() : Promise.resolve([])).then((extra) => {
            const actions = [...new Set([...r.actions, ...extra, ...(isConnection ? ['selectPythonInterpreter'] : [])])];
            this.post({ type: 'error', title: r.title, message: r.message, actions });
        });
    }
    async reopen() {
        if (!this.target) {
            this.post({ type: 'empty' });
            return;
        }
        await this.apply(this.target, 'Reloading…');
    }
    async reload() {
        const t = this.target;
        if (!t) {
            this.post({ type: 'empty' });
            return;
        }
        if (this.status !== 'loaded') {
            await this.reopen();
            return;
        }
        const check = await this.session.stillReachable(t.kind, t.kind === 'file' ? t.fsPath : t.url);
        if (!check.ok) {
            this.showError({ ok: false, title: t.kind === 'file' ? 'File not found' : 'Server not reachable', message: check.message, actions: ['retry', t.kind === 'file' ? 'selectEntryFile' : 'selectUrl'] });
            return;
        }
        this.reloadsRequested++;
        this.post({ type: 'command', name: 'reload' });
    }
    /** Called for every saved document; reloads when it belongs to the previewed project. */
    onFileSaved(uri) {
        const s = (0, config_1.readSettings)();
        if (!s.autoReload || !this.target || uri.scheme !== 'file') {
            return;
        }
        let relevant = false;
        if (this.target.kind === 'file') {
            const root = this.session.servedRoot;
            relevant = !!root && !/(^|[\\/])\.git([\\/]|$)/.test(uri.fsPath) && isInside(root, uri.fsPath);
        }
        else {
            relevant = s.autoReloadUrlTargets && !!vscode.workspace.getWorkspaceFolder(uri);
        }
        if (!relevant) {
            return;
        }
        clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(() => void this.reload(), s.autoReloadDelay);
    }
    // ------------------------------------------------------ commands
    command(name) {
        this.post({ type: 'command', name });
    }
    setPreset(id) {
        this.post({ type: 'setPreset', id });
    }
    get presetList() {
        return this.presets();
    }
    reveal() {
        this.panel.reveal(undefined, false);
    }
}
exports.EmulatorPanel = EmulatorPanel;
function isInside(root, file) {
    const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
    const r = norm(root).replace(/[\\/]+$/, '');
    const f = norm(file);
    return f === r || f.startsWith(r + '/') || f.startsWith(r + '\\');
}
//# sourceMappingURL=panel.js.map