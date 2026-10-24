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
exports.StaticServer = void 0;
exports.mimeFor = mimeFor;
exports.isAllowedHost = isAllowedHost;
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const inject_1 = require("./inject");
const MIME = {
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.xhtml': 'application/xhtml+xml; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.cjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.bmp': 'image/bmp',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.eot': 'application/vnd.ms-fontobject',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.wasm': 'application/wasm', '.pdf': 'application/pdf'
};
function mimeFor(file) {
    return MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}
function isAllowedHost(hostHeader, port) {
    if (!hostHeader) {
        return false;
    }
    const h = hostHeader.toLowerCase();
    return h === `127.0.0.1:${port}` || h === `localhost:${port}`;
}
/** Loopback-only static file server with traversal, symlink, dotfile and DNS-rebinding protection. */
class StaticServer {
    opts;
    server;
    realRoot = '';
    sockets = new Set();
    port = 0;
    constructor(opts) {
        this.opts = opts;
    }
    async start() {
        this.realRoot = await fs.promises.realpath(this.opts.root);
        this.server = http.createServer((req, res) => {
            this.handle(req, res).catch(() => this.send(res, 500, 'Internal error'));
        });
        this.server.on('connection', (s) => {
            this.sockets.add(s);
            s.on('close', () => this.sockets.delete(s));
        });
        await new Promise((resolve, reject) => {
            this.server.once('error', reject);
            this.server.listen(0, '127.0.0.1', () => resolve());
        });
        this.port = this.server.address().port;
    }
    get origin() {
        return `http://127.0.0.1:${this.port}`;
    }
    get root() {
        return this.realRoot;
    }
    dispose() {
        const server = this.server;
        this.server = undefined;
        if (!server) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            server.close(() => resolve());
            for (const s of this.sockets) {
                s.destroy();
            }
        });
    }
    send(res, status, message) {
        if (res.headersSent) {
            res.end();
            return;
        }
        const body = `<!doctype html><meta charset="utf-8"><title>${status}</title><body style="font:14px sans-serif;padding:2em"><h3>${status}</h3><p>${(0, inject_1.escapeHtml)(message)}</p>`;
        res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(body);
    }
    async handle(req, res) {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return this.send(res, 405, 'Method not allowed');
        }
        if (!isAllowedHost(req.headers.host, this.port)) {
            return this.send(res, 403, 'Forbidden host');
        }
        let pathname;
        try {
            pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
        }
        catch {
            return this.send(res, 400, 'Bad request');
        }
        if (pathname === inject_1.PROBE_PATH && this.opts.probeSource !== undefined) {
            res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
            res.end(req.method === 'HEAD' ? undefined : this.opts.probeSource);
            return;
        }
        if (pathname.includes('\0') || pathname.includes('\\')) {
            return this.send(res, 400, 'Bad request');
        }
        const segments = pathname.split('/').filter((s) => s !== '');
        for (const s of segments) {
            if (s === '.' || s === '..') {
                return this.send(res, 403, 'Forbidden');
            }
            if (s.startsWith('.') && s !== '.well-known') {
                return this.send(res, 403, 'Dotfiles are not served.');
            }
        }
        const resolved = await this.resolveFile(segments);
        if (resolved === 'forbidden') {
            return this.send(res, 403, 'Forbidden');
        }
        if (resolved) {
            return this.serveFile(req, res, resolved);
        }
        const last = segments[segments.length - 1] ?? '';
        const wantsHtml = (req.headers.accept ?? '').includes('text/html');
        if (this.opts.spaFallbackEntry && wantsHtml && !path.extname(last)) {
            const entry = await this.safeRealpath(this.opts.spaFallbackEntry);
            if (entry && this.inside(entry)) {
                return this.serveFile(req, res, entry);
            }
        }
        return this.send(res, 404, `Not found: ${pathname}`);
    }
    async safeRealpath(p) {
        try {
            return await fs.promises.realpath(p);
        }
        catch {
            return undefined;
        }
    }
    inside(real) {
        const rel = path.relative(this.realRoot, real);
        return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
    }
    async resolveFile(segments) {
        let candidate = path.join(this.realRoot, ...segments);
        let real = await this.safeRealpath(candidate);
        if (!real) {
            return undefined;
        }
        if (!this.inside(real)) {
            return 'forbidden';
        }
        let stat = await fs.promises.stat(real);
        if (stat.isDirectory()) {
            candidate = path.join(real, 'index.html');
            real = await this.safeRealpath(candidate);
            if (!real) {
                return undefined;
            }
            if (!this.inside(real)) {
                return 'forbidden';
            }
            stat = await fs.promises.stat(real);
        }
        return stat.isFile() ? real : undefined;
    }
    async serveFile(req, res, file) {
        const type = mimeFor(file);
        const baseHeaders = { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
        if (type.startsWith('text/html')) {
            let html = await fs.promises.readFile(file, 'utf8');
            if (this.opts.probeSource !== undefined) {
                html = (0, inject_1.injectProbe)(html);
            }
            const body = Buffer.from(html, 'utf8');
            res.writeHead(200, { ...baseHeaders, 'Content-Length': body.length });
            res.end(req.method === 'HEAD' ? undefined : body);
            return;
        }
        const stat = await fs.promises.stat(file);
        res.writeHead(200, { ...baseHeaders, 'Content-Length': stat.size });
        if (req.method === 'HEAD') {
            res.end();
            return;
        }
        const stream = fs.createReadStream(file);
        stream.on('error', () => res.destroy());
        stream.pipe(res);
    }
}
exports.StaticServer = StaticServer;
//# sourceMappingURL=staticServer.js.map