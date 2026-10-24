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
exports.ProxyServer = void 0;
exports.stripFrameAncestors = stripFrameAncestors;
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const zlib = __importStar(require("zlib"));
const util_1 = require("util");
const inject_1 = require("./inject");
const url_1 = require("./url");
const staticServer_1 = require("./staticServer");
const gunzip = (0, util_1.promisify)(zlib.gunzip);
const inflate = (0, util_1.promisify)(zlib.inflate);
const brotli = (0, util_1.promisify)(zlib.brotliDecompress);
const MAX_HTML_BYTES = 20 * 1024 * 1024;
/** Removes only the frame-ancestors directive so the page can be shown in the emulator frame. */
function stripFrameAncestors(csp) {
    return csp
        .split(';')
        .map((d) => d.trim())
        .filter((d) => d !== '' && !/^frame-ancestors(\s|$)/i.test(d))
        .join('; ');
}
/**
 * Loopback reverse proxy for one dev-server origin. It lets the emulator embed
 * pages that send X-Frame-Options / frame-ancestors, injects the diagnostics
 * script into HTML, and forwards WebSocket upgrades (HMR).
 */
class ProxyServer {
    opts;
    server;
    port = 0;
    sockets = new Set();
    constructor(opts) {
        this.opts = opts;
    }
    async start() {
        this.server = http.createServer((req, res) => this.handle(req, res));
        this.server.on('upgrade', (req, socket, head) => this.upgrade(req, socket, head));
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
    /** Maps a target-origin URL to the equivalent URL on this proxy. */
    toProxyUrl(target) {
        return `${this.origin}${target.pathname}${target.search}${target.hash}`;
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
    requestOptions(req, headers) {
        const t = this.opts.target;
        return {
            protocol: t.protocol,
            hostname: (0, url_1.bareHostname)(t),
            port: t.port || (t.protocol === 'https:' ? 443 : 80),
            method: req.method,
            path: req.url,
            headers,
            // Dev servers on loopback commonly use self-signed certificates; remote targets are verified.
            rejectUnauthorized: !(0, url_1.isLoopbackHost)(t.hostname)
        };
    }
    forwardHeaders(req) {
        const t = this.opts.target;
        const headers = { ...req.headers };
        headers.host = t.host;
        headers['accept-encoding'] = 'identity';
        delete headers['if-none-match'];
        delete headers['if-modified-since'];
        if (typeof headers.origin === 'string') {
            headers.origin = t.origin;
        }
        if (typeof headers.referer === 'string') {
            headers.referer = headers.referer.replace(this.origin, t.origin);
        }
        return headers;
    }
    handle(req, res) {
        if (!(0, staticServer_1.isAllowedHost)(req.headers.host, this.port)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden host');
            return;
        }
        const pathname = (req.url ?? '').split('?')[0];
        if (pathname === inject_1.PROBE_PATH && this.opts.probeSource !== undefined) {
            res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(this.opts.probeSource);
            return;
        }
        const lib = this.opts.target.protocol === 'https:' ? https : http;
        const preq = lib.request(this.requestOptions(req, this.forwardHeaders(req)), (pres) => {
            this.relay(req, res, pres).catch(() => res.destroy());
        });
        preq.on('error', (err) => {
            if (res.headersSent) {
                res.destroy();
                return;
            }
            const target = this.opts.target.origin;
            res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(`<!doctype html><meta charset="utf-8"><body style="font:14px sans-serif;padding:2em"><h3>Cannot reach ${(0, inject_1.escapeHtml)(target)}</h3><p>${(0, inject_1.escapeHtml)(err.code ?? err.message)}</p><p>Check that the server is running, then reload the emulator.</p>`);
        });
        req.on('aborted', () => preq.destroy());
        req.pipe(preq);
    }
    async relay(req, res, pres) {
        const t = this.opts.target;
        const status = pres.statusCode ?? 502;
        const headers = { ...pres.headers };
        delete headers['x-frame-options'];
        for (const name of ['content-security-policy', 'content-security-policy-report-only']) {
            const value = headers[name];
            if (typeof value === 'string') {
                const cleaned = stripFrameAncestors(value);
                if (cleaned) {
                    headers[name] = cleaned;
                }
                else {
                    delete headers[name];
                }
            }
        }
        if (typeof headers.location === 'string' && headers.location.startsWith(t.origin)) {
            headers.location = this.origin + headers.location.slice(t.origin.length);
        }
        const cookies = headers['set-cookie'];
        if (Array.isArray(cookies)) {
            headers['set-cookie'] = cookies.map((c) => c.replace(/;\s*Domain=[^;]*/gi, '').replace(/;\s*Secure/gi, ''));
        }
        const type = String(headers['content-type'] ?? '');
        const injectable = this.opts.probeSource !== undefined && /text\/html/i.test(type) && req.method !== 'HEAD' && status !== 204 && status !== 304;
        if (!injectable) {
            res.writeHead(status, headers);
            pres.pipe(res);
            return;
        }
        const chunks = [];
        let size = 0;
        for await (const chunk of pres) {
            size += chunk.length;
            if (size > MAX_HTML_BYTES) {
                throw new Error('HTML response too large');
            }
            chunks.push(chunk);
        }
        let body = Buffer.concat(chunks);
        const encoding = String(headers['content-encoding'] ?? '').toLowerCase();
        let canInject = true;
        if (encoding === 'gzip') {
            body = await gunzip(body);
        }
        else if (encoding === 'deflate') {
            body = await inflate(body);
        }
        else if (encoding === 'br') {
            body = await brotli(body);
        }
        else if (encoding && encoding !== 'identity') {
            canInject = false;
        }
        if (canInject) {
            body = Buffer.from((0, inject_1.injectProbe)(body.toString('utf8')), 'utf8');
            delete headers['content-encoding'];
            delete headers['transfer-encoding'];
            headers['content-length'] = body.length;
            headers['cache-control'] = 'no-store';
        }
        res.writeHead(status, headers);
        res.end(body);
    }
    upgrade(req, socket, head) {
        if (!(0, staticServer_1.isAllowedHost)(req.headers.host, this.port)) {
            socket.destroy();
            return;
        }
        const headers = this.forwardHeaders(req);
        delete headers['accept-encoding'];
        const lib = this.opts.target.protocol === 'https:' ? https : http;
        const preq = lib.request(this.requestOptions(req, headers));
        preq.on('upgrade', (pres, psocket, phead) => {
            const lines = [`HTTP/1.1 ${pres.statusCode} ${pres.statusMessage}`];
            for (let i = 0; i < pres.rawHeaders.length; i += 2) {
                lines.push(`${pres.rawHeaders[i]}: ${pres.rawHeaders[i + 1]}`);
            }
            socket.write(lines.join('\r\n') + '\r\n\r\n');
            if (phead.length) {
                socket.write(phead);
            }
            if (head.length) {
                psocket.write(head);
            }
            psocket.pipe(socket);
            socket.pipe(psocket);
            psocket.on('error', () => socket.destroy());
            socket.on('error', () => psocket.destroy());
            socket.on('close', () => psocket.destroy());
            psocket.on('close', () => socket.destroy());
        });
        preq.on('response', () => socket.destroy());
        preq.on('error', () => socket.destroy());
        preq.end();
    }
}
exports.ProxyServer = ProxyServer;
//# sourceMappingURL=proxyServer.js.map