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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const actionsView_1 = require("./actionsView");
const config_1 = require("./config");
const devices_1 = require("./core/devices");
const url_1 = require("./core/url");
const panel_1 = require("./panel");
const pythonServers_1 = require("./pythonServers");
const RECENT_KEY = 'webEmulator.recentUrls';
function activate(context) {
    const log = vscode.window.createOutputChannel('Web Emulator');
    const probeSource = fs.readFileSync(path.join(context.extensionPath, 'media', 'probe.js'), 'utf8');
    const openPreview = async (url) => {
        await panel().openUrl(url);
    };
    const python = new pythonServers_1.PythonServers(log, openPreview);
    const deps = { context, probeSource, python, log };
    const panel = () => panel_1.EmulatorPanel.show(deps);
    const ensure = () => panel_1.EmulatorPanel.current ?? panel_1.EmulatorPanel.show(deps, { restoreTarget: false });
    const view = new actionsView_1.ActionsView(python);
    context.subscriptions.push(log, python, view, vscode.window.registerTreeDataProvider('webEmulator.actions', view), vscode.window.registerWebviewPanelSerializer(panel_1.VIEW_TYPE, {
        async deserializeWebviewPanel(p) {
            panel_1.EmulatorPanel.revive(p, deps);
        }
    }), vscode.workspace.onDidSaveTextDocument((d) => panel_1.EmulatorPanel.current?.onFileSaved(d.uri)), { dispose: () => panel_1.EmulatorPanel.current?.dispose() });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- command handlers have differing typed arguments
    const reg = (id, fn) => {
        context.subscriptions.push(vscode.commands.registerCommand(id, fn));
    };
    reg('webEmulator.open', () => {
        panel();
    });
    reg('webEmulator.openCurrentFile', async (arg) => {
        const uri = arg instanceof vscode.Uri ? arg : vscode.window.activeTextEditor?.document.uri;
        if (!uri || uri.scheme !== 'file' || !(0, url_1.isPreviewableHtmlPath)(uri.fsPath)) {
            const pick = await vscode.window.showInformationMessage('Open an HTML file in the editor first, or choose what to preview.', 'Choose HTML File…', 'Enter URL…');
            if (pick === 'Choose HTML File…') {
                await vscode.commands.executeCommand('webEmulator.selectEntryFile');
            }
            else if (pick === 'Enter URL…') {
                await vscode.commands.executeCommand('webEmulator.selectUrl');
            }
            return;
        }
        await panel_1.EmulatorPanel.show(deps, { restoreTarget: false }).openFile(uri);
    });
    reg('webEmulator.selectEntryFile', async () => {
        const found = await vscode.workspace.findFiles('**/*.{html,htm}', '**/{node_modules,.git,out,dist,build,.venv,venv}/**', 200);
        const items = found
            .map((u) => ({ label: path.basename(u.fsPath), description: vscode.workspace.asRelativePath(u, true), uri: u }))
            .sort((a, b) => (a.description ?? '').localeCompare(b.description ?? ''));
        items.push({ label: '$(folder-opened) Browse…', description: 'Pick any HTML file on disk' });
        const pick = await vscode.window.showQuickPick(items, { title: 'Select the HTML entry file to preview', matchOnDescription: true });
        if (!pick) {
            return;
        }
        let uri = pick.uri;
        if (!uri) {
            uri = (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { HTML: ['html', 'htm', 'xhtml'] }, openLabel: 'Preview' }))?.[0];
        }
        if (uri) {
            await panel_1.EmulatorPanel.show(deps, { restoreTarget: false }).openFile(uri);
        }
    });
    reg('webEmulator.selectUrl', async () => {
        const settings = (0, config_1.readSettings)();
        const recent = context.workspaceState.get(RECENT_KEY, []);
        const qp = vscode.window.createQuickPick();
        qp.title = 'Select a preview URL';
        qp.placeholder = 'Type a URL or port (for example localhost:3000 or 5173) or pick one';
        const base = [...new Set([...recent, ...settings.defaultUrls])];
        const refresh = (typed) => {
            const items = [];
            if (typed.trim()) {
                items.push({ label: typed.trim(), description: 'Use this URL' });
            }
            for (const u of base) {
                if (u !== typed.trim()) {
                    items.push({ label: u, description: recent.includes(u) ? 'recent' : 'suggested' });
                }
            }
            qp.items = items;
        };
        refresh('');
        qp.onDidChangeValue(refresh);
        const chosen = await new Promise((resolve) => {
            qp.onDidAccept(() => {
                resolve(qp.selectedItems[0]?.label ?? qp.value);
                qp.hide();
            });
            qp.onDidHide(() => {
                resolve(undefined);
                qp.dispose();
            });
            qp.show();
        });
        if (!chosen) {
            return;
        }
        const v = (0, url_1.validatePreviewUrl)(chosen, { allowRemote: settings.allowRemoteUrls });
        if (!v.ok) {
            void vscode.window.showErrorMessage(v.reason);
            return;
        }
        await panel_1.EmulatorPanel.show(deps, { restoreTarget: false }).openUrl(v.url.href);
    });
    reg('webEmulator.reload', async () => {
        if (!panel_1.EmulatorPanel.current) {
            panel();
            return;
        }
        await panel_1.EmulatorPanel.current.reload();
    });
    reg('webEmulator.selectViewport', async () => {
        const p = ensure();
        const items = [];
        let group = '';
        for (const preset of p.presetList) {
            if (preset.group !== group) {
                group = preset.group;
                items.push({ label: group, kind: vscode.QuickPickItemKind.Separator });
            }
            items.push({ label: preset.name, description: `${preset.width} × ${preset.height}`, id: preset.id });
        }
        items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
        items.push({ label: '$(edit) Custom size…', custom: true });
        const pick = await vscode.window.showQuickPick(items, { title: 'Select viewport preset' });
        if (!pick) {
            return;
        }
        if (pick.id) {
            p.setPreset(pick.id);
            return;
        }
        const input = await vscode.window.showInputBox({
            title: 'Custom viewport',
            prompt: `Width × height in CSS pixels (${devices_1.MIN_DIMENSION}–${devices_1.MAX_DIMENSION}), e.g. 412x915`,
            validateInput: (t) => (parseSize(t) ? undefined : `Use the form 412x915 with values between ${devices_1.MIN_DIMENSION} and ${devices_1.MAX_DIMENSION}.`)
        });
        const size = input ? parseSize(input) : undefined;
        if (size) {
            p.setPreset(`custom:${size.width}x${size.height}`);
        }
    });
    reg('webEmulator.rotate', () => ensure().command('rotate'));
    reg('webEmulator.goHome', () => ensure().command('goHome'));
    reg('webEmulator.toggleDiagnostics', () => ensure().command('toggleDiagnostics'));
    reg('webEmulator.copyViewport', () => ensure().command('copyViewport'));
    reg('webEmulator._setPreset', (id) => ensure().setPreset(id));
    reg('webEmulator.openInBrowser', async () => {
        const href = panel_1.EmulatorPanel.current?.externalHref;
        if (!href) {
            void vscode.window.showInformationMessage('Nothing is being previewed yet. Open an HTML file or enter a URL first.');
            return;
        }
        await vscode.env.openExternal(vscode.Uri.parse(href));
    });
    reg('webEmulator.selectPythonInterpreter', () => python.selectInterpreter());
    reg('webEmulator.startFlask', () => python.start('flask'));
    reg('webEmulator.startDjango', () => python.start('django'));
    reg('webEmulator.stopServer', () => python.stop());
    reg('webEmulator.openSettings', () => vscode.commands.executeCommand('workbench.action.openSettings', 'webEmulator'));
    return {
        getState() {
            const p = panel_1.EmulatorPanel.current;
            return { open: !!p, status: p?.status ?? 'empty', target: p?.target, src: p?.loadedSrc, error: p?.lastError, viewport: p?.viewport, diagnostics: p?.diagnostics ?? [], reloadsRequested: p?.reloadsRequested ?? 0 };
        },
        openUrl: (url) => ensure().openUrl(url),
        openFile: (uri) => ensure().openFile(uri)
    };
}
function parseSize(text) {
    const m = /^\s*(\d{3,5})\s*[x×*,]\s*(\d{3,5})\s*$/i.exec(text);
    if (!m) {
        return undefined;
    }
    const width = Number(m[1]);
    const height = Number(m[2]);
    const ok = (n) => n >= devices_1.MIN_DIMENSION && n <= devices_1.MAX_DIMENSION;
    return ok(width) && ok(height) ? { width, height } : undefined;
}
function deactivate() {
    panel_1.EmulatorPanel.current?.dispose();
}
//# sourceMappingURL=extension.js.map