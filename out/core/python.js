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
exports.isValidFlaskAppSpec = isValidFlaskAppSpec;
exports.isValidPort = isValidPort;
exports.detectFlask = detectFlask;
exports.detectDjango = detectDjango;
exports.buildFlaskCommand = buildFlaskCommand;
exports.buildDjangoCommand = buildDjangoCommand;
exports.formatCommandLine = formatCommandLine;
exports.venvPythonCandidates = venvPythonCandidates;
exports.resolveInterpreter = resolveInterpreter;
exports.listInterpreterCandidates = listInterpreterCandidates;
exports.checkPythonModule = checkPythonModule;
exports.pythonVersion = pythonVersion;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const FLASK_FILES = ['app.py', 'wsgi.py', 'application.py', 'main.py', 'run.py', path.join('app', '__init__.py')];
/** `module`, `pkg.module` or `module:factory` / `module:factory(...)` (no quotes, no spaces). */
function isValidFlaskAppSpec(spec) {
    return /^[A-Za-z_][A-Za-z0-9_.]*(:[A-Za-z_][A-Za-z0-9_.]*(\([^()\s'";|&$`]*\))?)?$/.test(spec);
}
function isValidPort(port) {
    return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535;
}
async function readHead(file, bytes = 200_000) {
    try {
        const fh = await fs.promises.open(file, 'r');
        try {
            const buf = Buffer.alloc(bytes);
            const { bytesRead } = await fh.read(buf, 0, bytes, 0);
            return buf.subarray(0, bytesRead).toString('utf8');
        }
        finally {
            await fh.close();
        }
    }
    catch {
        return undefined;
    }
}
async function detectFlask(dir, configuredApp) {
    if (configuredApp && configuredApp.trim()) {
        return isValidFlaskAppSpec(configuredApp.trim()) ? { appSpec: configuredApp.trim() } : undefined;
    }
    for (const rel of FLASK_FILES) {
        const text = await readHead(path.join(dir, rel));
        if (text && /\bFlask\s*\(/.test(text)) {
            const spec = rel.endsWith('__init__.py') ? path.basename(path.dirname(rel)) : path.basename(rel, '.py');
            return { appSpec: spec, file: rel };
        }
    }
    return undefined;
}
async function detectDjango(dir, managePath = 'manage.py') {
    if (path.isAbsolute(managePath) || managePath.split(/[\\/]/).includes('..')) {
        return undefined;
    }
    const text = await readHead(path.join(dir, managePath), 20_000);
    return text && /django/i.test(text) ? { managePath } : undefined;
}
function buildFlaskCommand(python, appSpec, port, debug) {
    if (!isValidFlaskAppSpec(appSpec)) {
        throw new Error(`Invalid Flask app specifier: ${appSpec}`);
    }
    if (!isValidPort(port)) {
        throw new Error(`Invalid port: ${port}`);
    }
    const args = ['-m', 'flask', '--app', appSpec];
    if (debug) {
        args.push('--debug');
    }
    args.push('run', '--host', '127.0.0.1', '--port', String(port));
    return { command: python, args };
}
function buildDjangoCommand(python, managePath, port) {
    if (!isValidPort(port)) {
        throw new Error(`Invalid port: ${port}`);
    }
    return { command: python, args: [managePath, 'runserver', `127.0.0.1:${port}`] };
}
function formatCommandLine(cmd) {
    const q = (s) => (/[\s"']/.test(s) ? JSON.stringify(s) : s);
    return [cmd.command, ...cmd.args].map(q).join(' ');
}
const VENV_DIRS = ['.venv', 'venv', 'env'];
function venvPythonCandidates(dir) {
    const out = [];
    for (const v of VENV_DIRS) {
        out.push(path.join(dir, v, 'bin', 'python'), path.join(dir, v, 'Scripts', 'python.exe'));
    }
    return out;
}
function resolveInterpreter(dir, configured) {
    if (configured && configured.trim()) {
        return { path: configured.trim(), source: 'setting' };
    }
    for (const c of venvPythonCandidates(dir)) {
        if (fs.existsSync(c)) {
            return { path: c, source: 'venv' };
        }
    }
    return { path: process.platform === 'win32' ? 'python' : 'python3', source: 'system' };
}
function listInterpreterCandidates(dir) {
    const found = venvPythonCandidates(dir).filter((c) => fs.existsSync(c));
    const system = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
    return [...found, ...system];
}
/**
 * Checks whether `moduleName` is importable using find_spec, which does not
 * execute the module. Runs from the temp directory so project files cannot
 * shadow the module.
 */
function checkPythonModule(python, moduleName) {
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(moduleName)) {
        return Promise.resolve({ ok: false, reason: 'missing-module', detail: 'Invalid module name.' });
    }
    const code = `import importlib.util,sys;sys.exit(0 if importlib.util.find_spec(${JSON.stringify(moduleName)}) else 3)`;
    return new Promise((resolve) => {
        (0, child_process_1.execFile)(python, ['-c', code], { cwd: os.tmpdir(), timeout: 10_000, windowsHide: true }, (err) => {
            if (!err) {
                resolve({ ok: true });
                return;
            }
            const e = err;
            if (e.code === 'ENOENT' || e.code === 'EACCES') {
                resolve({ ok: false, reason: 'no-python', detail: `Could not run "${python}".` });
            }
            else if (e.code === 3) {
                resolve({ ok: false, reason: 'missing-module', detail: `Module "${moduleName}" is not installed for ${python}.` });
            }
            else {
                resolve({ ok: false, reason: 'no-python', detail: `"${python}" failed: ${e.message}` });
            }
        });
    });
}
/** Returns e.g. "Python 3.12.3", or undefined if the executable cannot be run. */
function pythonVersion(python) {
    return new Promise((resolve) => {
        (0, child_process_1.execFile)(python, ['--version'], { cwd: os.tmpdir(), timeout: 10_000, windowsHide: true }, (err, stdout, stderr) => {
            resolve(err ? undefined : (String(stdout) || String(stderr)).trim() || undefined);
        });
    });
}
//# sourceMappingURL=python.js.map