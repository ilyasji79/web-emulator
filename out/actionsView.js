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
exports.ActionsView = void 0;
const vscode = __importStar(require("vscode"));
const devices_1 = require("./core/devices");
const config_1 = require("./config");
/** Activity-bar view: quick launcher for the emulator, viewport presets and Python servers. */
class ActionsView {
    python;
    emitter = new vscode.EventEmitter();
    onDidChangeTreeData = this.emitter.event;
    sub = [];
    constructor(python) {
        this.python = python;
        this.sub.push(this.emitter, python.onDidChange(() => this.emitter.fire()), vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('webEmulator') && this.emitter.fire()));
    }
    refresh() {
        this.emitter.fire();
    }
    getTreeItem(n) {
        const item = new vscode.TreeItem(n.label, n.children ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        if (n.icon) {
            item.iconPath = new vscode.ThemeIcon(n.icon);
        }
        item.description = n.description;
        item.tooltip = n.tooltip;
        if (n.command) {
            item.command = { title: n.label, command: n.command.command, arguments: n.command.args };
        }
        return item;
    }
    getChildren(n) {
        if (n) {
            return n.children ?? [];
        }
        const running = this.python.runningKinds;
        const presets = (0, devices_1.resolvePresets)((0, config_1.readSettings)().customPresets);
        return [
            {
                label: 'Preview', icon: 'device-mobile', children: [
                    { label: 'Open Emulator', icon: 'play', command: { command: 'webEmulator.open' } },
                    { label: 'Open Current HTML File', icon: 'file-code', command: { command: 'webEmulator.openCurrentFile' } },
                    { label: 'Choose HTML File…', icon: 'folder-opened', command: { command: 'webEmulator.selectEntryFile' } },
                    { label: 'Enter Preview URL…', icon: 'globe', command: { command: 'webEmulator.selectUrl' } },
                    { label: 'Reload', icon: 'refresh', command: { command: 'webEmulator.reload' } }
                ]
            },
            {
                label: 'Viewport presets', icon: 'screen-normal', children: presets.map((p) => ({
                    label: p.name, description: `${p.width} × ${p.height}`, icon: 'device-mobile', command: { command: 'webEmulator._setPreset', args: [p.id] }
                }))
            },
            {
                label: 'Python servers', icon: 'server-process', description: running.length ? `running: ${running.join(', ')}` : undefined, children: [
                    { label: 'Start Flask Server…', icon: 'play', command: { command: 'webEmulator.startFlask' } },
                    { label: 'Start Django Server…', icon: 'play', command: { command: 'webEmulator.startDjango' } },
                    { label: 'Stop Python Server', icon: 'debug-stop', command: { command: 'webEmulator.stopServer' } },
                    { label: 'Select Python Interpreter…', icon: 'symbol-method', command: { command: 'webEmulator.selectPythonInterpreter' } }
                ]
            },
            { label: 'Settings', icon: 'settings-gear', command: { command: 'webEmulator.openSettings' } }
        ];
    }
    dispose() {
        this.sub.forEach((d) => d.dispose());
    }
}
exports.ActionsView = ActionsView;
//# sourceMappingURL=actionsView.js.map