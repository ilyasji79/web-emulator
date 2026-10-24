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
exports.PythonServers = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const python_1 = require("./core/python");
const serverCheck_1 = require("./core/serverCheck");
/** Starts, tracks and stops Flask/Django dev servers. Everything here is user-initiated and confirmed. */
class PythonServers {
    log;
    openPreview;
    running = new Map();
    disposables = [];
    changed = new vscode.EventEmitter();
    onDidChange = this.changed.event;
    constructor(log, openPreview) {
        this.log = log;
        this.openPreview = openPreview;
        this.disposables.push(vscode.tasks.onDidEndTask((e) => {
            for (const [k, ex] of this.running) {
                if (ex === e.execution) {
                    this.running.delete(k);
                    this.changed.fire();
                }
            }
        }), this.changed);
    }
    get runningKinds() {
        return [...this.running.keys()];
    }
    cfg() {
        return vscode.workspace.getConfiguration('webEmulator.python');
    }
    async pickFolder() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            void vscode.window.showErrorMessage('Open a folder that contains your Python web project first.');
            return undefined;
        }
        return folders.length === 1 ? folders[0] : vscode.window.showWorkspaceFolderPick({ placeHolder: 'Select the project folder' });
    }
    async detect(folder) {
        const dir = folder.uri.fsPath;
        const [flask, django] = await Promise.all([
            (0, python_1.detectFlask)(dir, this.cfg().get('flask.app', '')),
            (0, python_1.detectDjango)(dir, this.cfg().get('django.manage', 'manage.py'))
        ]);
        return { flask: !!flask, django: !!django };
    }
    async selectInterpreter() {
        const folder = await this.pickFolder();
        if (!folder) {
            return;
        }
        const items = (0, python_1.listInterpreterCandidates)(folder.uri.fsPath).map((c) => ({
            label: path.isAbsolute(c) ? path.relative(folder.uri.fsPath, c) : c,
            description: path.isAbsolute(c) ? 'virtual environment in this folder' : 'from PATH',
            value: c
        }));
        items.push({ label: '$(folder-opened) Browse for a Python executable…', browse: true });
        const picked = await vscode.window.showQuickPick(items, {
            title: 'Select the Python interpreter used to start Flask/Django',
            placeHolder: 'Choose the interpreter whose environment has your web framework installed'
        });
        if (!picked) {
            return;
        }
        let value = picked.value;
        if (picked.browse) {
            const uri = await vscode.window.showOpenDialog({ canSelectMany: false, title: 'Select Python executable', openLabel: 'Use this interpreter' });
            value = uri?.[0]?.fsPath;
        }
        if (!value) {
            return;
        }
        const version = await (0, python_1.pythonVersion)(value);
        if (!version) {
            void vscode.window.showErrorMessage(`“${value}” could not be run. Choose a working Python executable.`);
            return;
        }
        await this.cfg().update('interpreterPath', value, vscode.ConfigurationTarget.Workspace);
        void vscode.window.showInformationMessage(`Web Emulator will use ${version} (${value}).`);
    }
    async start(kind) {
        if (!vscode.workspace.isTrusted) {
            const pick = await vscode.window.showErrorMessage('Starting Python servers is disabled in an untrusted workspace because it runs project code.', 'Manage Workspace Trust');
            if (pick) {
                await vscode.commands.executeCommand('workbench.trust.manage');
            }
            return;
        }
        const folder = await this.pickFolder();
        if (!folder) {
            return;
        }
        const dir = folder.uri.fsPath;
        const cfg = this.cfg();
        let command;
        let port;
        const python = (0, python_1.resolveInterpreter)(dir, cfg.get('interpreterPath', ''));
        try {
            if (kind === 'flask') {
                const det = await (0, python_1.detectFlask)(dir, cfg.get('flask.app', ''));
                if (!det) {
                    void vscode.window.showErrorMessage('No Flask app found. Expected app.py, wsgi.py, application.py, main.py or run.py containing “Flask(” in the workspace root. Set “webEmulator.python.flask.app” if your app lives elsewhere.');
                    return;
                }
                port = cfg.get('flask.port', 5000);
                command = (0, python_1.buildFlaskCommand)(python.path, det.appSpec, port, cfg.get('flask.debug', false));
            }
            else {
                const det = await (0, python_1.detectDjango)(dir, cfg.get('django.manage', 'manage.py'));
                if (!det) {
                    void vscode.window.showErrorMessage('No Django project found. Expected a manage.py that references Django (see “webEmulator.python.django.manage”).');
                    return;
                }
                port = cfg.get('django.port', 8000);
                command = (0, python_1.buildDjangoCommand)(python.path, det.managePath, port);
            }
        }
        catch (err) {
            void vscode.window.showErrorMessage(`Invalid Web Emulator Python setting: ${err.message}`);
            return;
        }
        if (!(0, python_1.isValidPort)(port)) {
            void vscode.window.showErrorMessage('Invalid port setting.');
            return;
        }
        const moduleName = kind === 'flask' ? 'flask' : 'django';
        const check = await (0, python_1.checkPythonModule)(python.path, moduleName);
        if (!check.ok) {
            const install = `${python.path} -m pip install ${moduleName}`;
            const pick = await vscode.window.showErrorMessage(check.reason === 'no-python'
                ? `${check.detail} Select a Python interpreter that is installed on this machine.`
                : `${check.detail} Web Emulator never installs packages for you. Install it yourself in that environment, for example: ${install}`, 'Select Interpreter…', ...(check.reason === 'missing-module' ? ['Copy install command'] : []));
            if (pick === 'Select Interpreter…') {
                await this.selectInterpreter();
            }
            else if (pick === 'Copy install command') {
                await vscode.env.clipboard.writeText(install);
            }
            return;
        }
        const url = `http://127.0.0.1:${port}/`;
        const existing = await (0, serverCheck_1.checkUrl)(new URL(url), 1000);
        if (existing.ok) {
            const pick = await vscode.window.showWarningMessage(`Something is already responding on port ${port}, so a new server was not started. Preview it, or change the port setting.`, 'Preview it');
            if (pick) {
                await this.openPreview(url);
            }
            return;
        }
        const confirm = await vscode.window.showWarningMessage(`Start the ${kind === 'flask' ? 'Flask' : 'Django'} server?`, { modal: true, detail: `Command:\n${(0, python_1.formatCommandLine)(command)}\n\nWorking folder: ${folder.name}\n\nThis runs your project's code on your machine.` }, 'Start Server');
        if (confirm !== 'Start Server') {
            return;
        }
        await this.stopKind(kind);
        const task = new vscode.Task({ type: 'webEmulator', server: kind }, folder, `${kind === 'flask' ? 'Flask' : 'Django'} server`, 'Web Emulator', new vscode.ProcessExecution(command.command, command.args, { cwd: dir, env: { PYTHONUNBUFFERED: '1' } }));
        task.isBackground = true;
        task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, focus: false, panel: vscode.TaskPanelKind.Dedicated, clear: true };
        this.log.appendLine(`[python] starting: ${(0, python_1.formatCommandLine)(command)} (cwd=${folder.name})`);
        try {
            this.running.set(kind, await vscode.tasks.executeTask(task));
            this.changed.fire();
        }
        catch (err) {
            void vscode.window.showErrorMessage(`Could not start the server: ${err.message}`);
            return;
        }
        const res = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Waiting for the server on port ${port}…`, cancellable: true }, (_p, token) => (0, serverCheck_1.waitForUrl)(new URL(url), { timeoutMs: 30_000, isCancelled: () => token.isCancellationRequested }));
        if (res.ok) {
            await this.openPreview(url);
        }
        else if (res.code !== 'CANCELLED') {
            void vscode.window.showErrorMessage(`The server did not respond on port ${port} within 30 seconds. Check the “${kind}” terminal for errors (a missing dependency or a crash on startup is the usual cause).`);
        }
    }
    async stopKind(kind) {
        const ex = this.running.get(kind);
        if (ex) {
            this.running.delete(kind);
            ex.terminate();
            this.changed.fire();
        }
    }
    async stop() {
        const kinds = this.runningKinds;
        if (kinds.length === 0) {
            void vscode.window.showInformationMessage('No Web Emulator Python server is running.');
            return;
        }
        for (const k of kinds) {
            await this.stopKind(k);
        }
        void vscode.window.showInformationMessage('Stopped the Python server.');
    }
    dispose() {
        for (const ex of this.running.values()) {
            ex.terminate();
        }
        this.running.clear();
        this.disposables.forEach((d) => d.dispose());
    }
}
exports.PythonServers = PythonServers;
//# sourceMappingURL=pythonServers.js.map