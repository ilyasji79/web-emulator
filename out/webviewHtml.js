"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCsp = buildCsp;
exports.createNonce = createNonce;
exports.buildWebviewHtml = buildWebviewHtml;
function buildCsp(cspSource, nonce) {
    return [
        `default-src 'none'`,
        `style-src ${cspSource}`,
        `font-src ${cspSource}`,
        `img-src ${cspSource} data:`,
        `script-src 'nonce-${nonce}'`,
        // Previewed pages are only ever served from loopback servers started by this extension.
        `frame-src http://127.0.0.1:* http://localhost:*`
    ].join('; ');
}
function createNonce() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = new Uint8Array(24);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
function btn(id, icon, title, extra = '') {
    return `<button id="${id}" class="btn${extra}" type="button" title="${title}" aria-label="${title}"><span class="codicon codicon-${icon}" aria-hidden="true"></span></button>`;
}
function buildWebviewHtml(i) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${buildCsp(i.cspSource, i.nonce)}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${i.codiconUri}">
<link rel="stylesheet" href="${i.styleUri}">
<title>Web Emulator</title>
</head>
<body>
<div id="app">
  <header class="toolbar" role="toolbar" aria-label="Emulator toolbar">
    <div class="group" role="group" aria-label="Viewport">
      <select id="preset" title="Viewport preset" aria-label="Viewport preset"></select>
      <input id="width" class="dim" type="number" inputmode="numeric" min="100" max="10000" title="Viewport width (px)" aria-label="Viewport width">
      <span class="times" aria-hidden="true">×</span>
      <input id="height" class="dim" type="number" inputmode="numeric" min="100" max="10000" title="Viewport height (px)" aria-label="Viewport height">
      ${btn('rotate', 'device-mobile', 'Rotate viewport (swap width and height)', ' rotate-icon')}
    </div>
    <div class="group" role="group" aria-label="Zoom">
      ${btn('zoomOut', 'zoom-out', 'Zoom out')}
      <select id="zoom" title="Zoom" aria-label="Zoom"></select>
      ${btn('zoomIn', 'zoom-in', 'Zoom in')}
      ${btn('fit', 'screen-full', 'Fit to window', ' toggle')}
    </div>
    <div class="group address-group" role="group" aria-label="Address">
      <span id="addressKind" class="kind" aria-hidden="true">—</span>
      <input id="address" type="text" spellcheck="false" autocomplete="off" placeholder="Enter a URL, e.g. localhost:3000, and press Enter" title="Preview address. Press Enter to load a URL." aria-label="Preview address">
      ${btn('reload', 'refresh', 'Reload preview')}
      ${btn('external', 'link-external', 'Open preview in external browser')}
    </div>
    <div class="group" role="group" aria-label="View">
      ${btn('home', 'home', 'Reset the device to the Android home screen')}
      ${btn('navMode', 'layout-panel', 'Switch between gesture navigation and 3-button navigation', ' toggle')}
      ${btn('compare', 'split-horizontal', 'Compare viewports side by side', ' toggle')}
      ${btn('frameToggle', 'device-mobile', 'Show or hide device frame', ' toggle')}
      ${btn('copyDims', 'copy', 'Copy viewport dimensions')}
      <button id="diagToggle" class="btn toggle" type="button" title="Show or hide diagnostics" aria-label="Show or hide diagnostics"><span class="codicon codicon-bug" aria-hidden="true"></span><span id="diagBadge" class="badge" hidden>0</span></button>
    </div>
  </header>
  <div id="notice" class="notice" role="status" aria-live="polite" hidden></div>
  <main class="body">
    <div id="stage" class="stage" tabindex="-1"><div id="devices" class="devices"></div></div>
    <div id="rail" class="rail" role="toolbar" aria-label="Device controls" aria-orientation="vertical" hidden>
      ${btn('railRotate', 'device-mobile', 'Rotate the device', ' rotate-icon')}
      ${btn('railZoomIn', 'zoom-in', 'Zoom in')}
      ${btn('railZoomOut', 'zoom-out', 'Zoom out')}
      <span class="rail-sep" aria-hidden="true"></span>
      ${btn('railBack', 'arrow-left', 'Back (history.back in the page; needs the diagnostics script)')}
      ${btn('railHome', 'home', 'Home screen')}
      ${btn('railReload', 'refresh', 'Reload the website')}
    </div>
    <div id="overlay" class="overlay" role="status" aria-live="polite"></div>
  </main>
  <section id="diagnostics" class="diagnostics" aria-label="Diagnostics" hidden>
    <div class="diag-head">
      <strong>Diagnostics</strong>
      <select id="diagFrame" title="Viewport to inspect" aria-label="Viewport to inspect"></select>
      <span class="spacer"></span>
      <button id="diagRefresh" class="btn" type="button" title="Re-run diagnostics" aria-label="Re-run diagnostics"><span class="codicon codicon-refresh" aria-hidden="true"></span></button>
      <button id="diagClear" class="btn" type="button" title="Clear logged errors" aria-label="Clear logged errors"><span class="codicon codicon-clear-all" aria-hidden="true"></span></button>
      <button id="diagClose" class="btn" type="button" title="Hide diagnostics" aria-label="Hide diagnostics"><span class="codicon codicon-close" aria-hidden="true"></span></button>
    </div>
    <div id="diagBody" class="diag-body"></div>
  </section>
  <footer id="status" class="status" aria-live="polite"></footer>
</div>
<script type="module" nonce="${i.nonce}" src="${i.scriptUri}"></script>
</body>
</html>`;
}
//# sourceMappingURL=webviewHtml.js.map