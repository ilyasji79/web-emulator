const api = acquireVsCodeApi();
const send = (m) => api.postMessage(m);
const MIN = 100;
const MAX = 10000;
const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const STAGE_PAD = 24;
const GAP = 24;
const MAX_LOG = 100;
// Android system insets in CSS px. Keep in sync with src/core/devices.ts.
const TOP = 24;
const GESTURE = 16;
const BUTTONS = 48;
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) {
        e.className = cls;
    }
    if (text !== undefined) {
        e.textContent = text;
    }
    return e;
};
let presets = [];
let compareIds = [];
let injectDiagnostics = true;
let vp = { presetId: 'mobile-390x844', width: 390, height: 844, rotated: false, zoom: 'fit', compare: false, showFrame: true, showDiagnostics: false, navMode: 'gesture' };
let screenMode = 'home';
let notice = { message: '', title: '', actions: [] };
let target;
let pageState = 'empty';
let frames = [];
let framesKey = '';
let loadedCount = 0;
let lastExternalOpen = 0;
const clamp = (n) => Math.min(MAX, Math.max(MIN, Math.round(n)));
const presetById = (id) => presets.find((p) => p.id === id);
function kindForSize(w, h) {
    const max = Math.max(w, h);
    return Math.min(w, h) <= 480 ? 'android' : max <= 1100 ? 'tablet' : max <= 1600 ? 'laptop' : 'desktop';
}
function emit() { send({ type: 'viewport', viewport: { ...vp } }); }
// ---------------------------------------------------------------- frames
function viewportSize(f) {
    if (f.kind !== 'android') {
        return { w: f.width, h: f.height };
    }
    const landscape = f.width > f.height;
    const right = vp.navMode === 'buttons' && landscape ? BUTTONS : 0;
    const bottom = vp.navMode === 'gesture' ? GESTURE : landscape ? 0 : BUTTONS;
    return { w: f.width - right, h: f.height - TOP - bottom };
}
function svgIcon(markup, cls) {
    const s = el('span', cls);
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = markup;
    return s;
}
const ICON_WIFI = '<svg viewBox="0 0 16 12" width="14" height="11"><path fill="currentColor" d="M8 11.6.5 3.7a10.6 10.6 0 0 1 15 0z"/></svg>';
const ICON_SIGNAL = '<svg viewBox="0 0 14 12" width="12" height="11"><path fill="currentColor" d="M13 1v10H1z"/></svg>';
const ICON_BATTERY = '<svg viewBox="0 0 10 16" width="8" height="12"><rect x="3.4" y=".5" width="3.2" height="1.8" rx=".6" fill="currentColor"/><rect x="1.2" y="2" width="7.6" height="13" rx="1.4" fill="currentColor"/></svg>';
const ICON_BACK = '<svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M11 2.5 4 8l7 5.5z"/></svg>';
const ICON_HOME = '<svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const ICON_RECENTS = '<svg viewBox="0 0 16 16" width="16" height="16"><rect x="3" y="3" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const WALLPAPER = '<svg class="wall" viewBox="0 0 100 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>' +
    '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e5718f"/><stop offset=".38" stop-color="#f29a87"/><stop offset=".6" stop-color="#d9807f"/></linearGradient>' +
    '<linearGradient id="base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#53347f"/><stop offset="1" stop-color="#14142f"/></linearGradient></defs>' +
    '<rect width="100" height="220" fill="url(#sky)"/>' +
    '<polygon points="0,128 16,112 28,121 52,94 70,110 86,100 100,114 100,220 0,220" fill="#8a5aa0"/>' +
    '<polygon points="0,152 24,130 42,144 66,119 100,148 100,220 0,220" fill="#53347f"/>' +
    '<rect y="168" width="100" height="52" fill="url(#base)"/></svg>';
function clockText() {
    const d = new Date();
    return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
}
setInterval(() => document.querySelectorAll('.clock').forEach((c) => { c.textContent = clockText(); }), 15000);
function appIcon(glyph, label, color, round) {
    const app = el('div', 'app');
    const icon = el('span', `icon ${color}${round ? ' round' : ''}`);
    icon.append(el('span', `codicon codicon-${glyph}`));
    app.append(icon);
    if (label) {
        app.append(el('span', 'label', label));
    }
    return app;
}
function buildHome() {
    const home = el('div', 'home');
    home.setAttribute('aria-label', 'Android home screen (simulated)');
    home.append(svgIcon(WALLPAPER, 'wallpaper'));
    const content = el('div', 'home-content');
    const top = el('div', 'home-top');
    top.append(el('div', 'home-date', new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })));
    const bottom = el('div', 'home-bottom');
    const row = el('div', 'app-row');
    row.append(appIcon('library', 'Store', 'blue', false), appIcon('mail', 'Mail', 'red', false), appIcon('file-media', 'Gallery', 'amber', false), appIcon('play-circle', 'Videos', 'rose', false));
    const search = el('div', 'search');
    search.append(el('span', 'codicon codicon-search'), el('span', undefined, 'Search'));
    const dock = el('div', 'dock');
    const browser = el('button', 'app app-button');
    browser.type = 'button';
    browser.title = target ? 'Open the website again' : 'Choose a URL to preview';
    browser.setAttribute('aria-label', browser.title);
    const bi = el('span', 'icon sky round');
    bi.append(el('span', 'codicon codicon-globe'));
    browser.append(bi);
    browser.addEventListener('click', () => {
        if (target && pageState !== 'error') {
            enterSite();
        }
        else {
            send({ type: 'action', id: 'selectUrl' });
        }
    });
    dock.append(appIcon('call-outgoing', '', 'green', true), appIcon('comment', '', 'blue', true), browser, appIcon('device-camera', '', 'slate', true));
    bottom.append(row, search, dock);
    content.append(top, bottom);
    home.append(content);
    return home;
}
function buildTopBar() {
    const bar = el('div', 'sys-top');
    bar.setAttribute('aria-hidden', 'true');
    const right = el('div', 'status-icons');
    right.append(svgIcon(ICON_WIFI, 'si'), svgIcon(ICON_SIGNAL, 'si'), svgIcon(ICON_BATTERY, 'si'));
    bar.append(el('span', 'clock', clockText()), right);
    return bar;
}
function buildBottomBar() {
    const bar = el('div', 'sys-bottom');
    if (vp.navMode === 'gesture') {
        const pill = el('button', 'gesture');
        pill.type = 'button';
        pill.title = 'Go to the home screen';
        pill.setAttribute('aria-label', 'Go to the home screen');
        pill.append(el('span'));
        pill.addEventListener('click', goHome);
        bar.append(pill);
        return bar;
    }
    const back = el('button', 'nav-btn');
    back.type = 'button';
    back.title = 'Back';
    back.setAttribute('aria-label', 'Back');
    back.append(svgIcon(ICON_BACK, 'ni'));
    back.addEventListener('click', goBack);
    const home = el('button', 'nav-btn');
    home.type = 'button';
    home.title = 'Home';
    home.setAttribute('aria-label', 'Home');
    home.append(svgIcon(ICON_HOME, 'ni'));
    home.addEventListener('click', goHome);
    const recents = el('span', 'nav-btn inert');
    recents.setAttribute('aria-hidden', 'true');
    recents.append(svgIcon(ICON_RECENTS, 'ni'));
    bar.append(back, home, recents);
    return bar;
}
function goHome() { screenMode = 'home'; applyScreenMode(); }
function enterSite() { screenMode = 'site'; applyScreenMode(); }
function goBack() {
    if (screenMode === 'home') {
        return;
    }
    frames.forEach((f) => f.iframe.contentWindow?.postMessage({ source: 'web-emulator', type: 'back' }, '*'));
}
function applyScreenMode() {
    for (const f of frames) {
        f.screen?.classList.toggle('mode-home', screenMode === 'home');
        f.screen?.classList.toggle('mode-site', screenMode === 'site');
    }
}
function makeFrame(label, w, h, kind, spec) {
    const slot = el('div', 'slot');
    const device = el('div', 'device');
    const viewport = el('div', 'viewport');
    const iframe = el('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-modals allow-downloads');
    iframe.title = `Preview ${label}`;
    viewport.append(iframe);
    const dims = el('div', 'dims');
    const frame = { label, width: w, height: h, kind, spec, slot, device, viewport, iframe, dims, diag: { probe: false, errors: [], consoles: [], resources: [] } };
    iframe.addEventListener('load', () => onFrameLoad(frame));
    buildDevice(frame);
    slot.append(dims, device);
    return frame;
}
function buildDevice(f) {
    f.device.replaceChildren();
    const landscape = f.width > f.height;
    f.screen = undefined;
    if (f.kind === 'android') {
        f.device.className = `device android${vp.showFrame ? '' : ' bare'}${landscape ? ' landscape' : ''}`;
        f.device.style.setProperty('--r', `${f.spec?.radius ?? 32}px`);
        const screen = el('div', `screen mode-${screenMode}${landscape ? ' landscape' : ''} nav-${vp.navMode}`);
        f.screen = screen;
        screen.append(buildHome(), f.viewport, buildTopBar(), el('span', 'cutout'), buildBottomBar());
        if (vp.showFrame) {
            const power = el('span', 'hw power');
            power.setAttribute('aria-hidden', 'true');
            const volume = el('span', 'hw volume');
            volume.setAttribute('aria-hidden', 'true');
            f.device.append(power, volume);
        }
        f.device.append(screen);
        return;
    }
    f.device.className = `device ${vp.showFrame ? f.kind : 'none'}`;
    if (vp.showFrame && (f.kind === 'laptop' || f.kind === 'desktop')) {
        const bar = el('div', 'win-bar');
        bar.append(el('span', 'dot red'), el('span', 'dot yellow'), el('span', 'dot green'));
        f.device.append(bar);
    }
    f.device.append(f.viewport);
}
function desiredFrames() {
    if (vp.compare) {
        return compareIds.map((id) => presetById(id)).filter((p) => !!p).map((p) => ({
            label: p.name, w: vp.rotated ? p.height : p.width, h: vp.rotated ? p.width : p.height,
            kind: p.frame === 'none' ? kindForSize(p.width, p.height) : p.frame, spec: p.android
        }));
    }
    const p = presetById(vp.presetId);
    const sameAsPreset = !!p && ((p.width === vp.width && p.height === vp.height) || (p.width === vp.height && p.height === vp.width));
    const kind = p && p.frame !== 'none' && sameAsPreset ? p.frame : kindForSize(vp.width, vp.height);
    return [{ label: p ? p.name : 'Custom device', w: vp.width, h: vp.height, kind, spec: sameAsPreset ? p?.android : undefined }];
}
/** Recreates iframes only when the set of frames changes; otherwise just resizes. */
function syncFrames() {
    const want = desiredFrames();
    const key = `${vp.compare}|${want.length}|${vp.compare ? want.map((w) => w.label).join(',') : ''}`;
    if (key !== framesKey) {
        framesKey = key;
        for (const f of frames) {
            window.clearTimeout(f.diag.probeTimer);
        }
        frames = want.map((w) => makeFrame(w.label, w.w, w.h, w.kind, w.spec));
        const devices = $('devices');
        devices.replaceChildren(...frames.map((f) => f.slot));
        if (target) {
            loadAll();
        }
        fillDiagFrameSelect();
    }
    want.forEach((w, i) => {
        const f = frames[i];
        const kindChanged = f.kind !== w.kind || f.width > f.height !== w.w > w.h || f.spec !== w.spec;
        f.label = w.label;
        f.width = w.w;
        f.height = w.h;
        f.kind = w.kind;
        f.spec = w.spec;
        if (kindChanged) {
            buildDevice(f);
        }
    });
    renderState();
    $('devices').classList.toggle('multi', frames.length > 1);
    layout();
    renderDiagnostics();
}
function layout() {
    const stage = $('stage');
    const showHandles = !vp.compare && frames.length === 1;
    for (const f of frames) {
        const vs = viewportSize(f);
        f.viewport.style.width = `${vs.w}px`;
        f.viewport.style.height = `${vs.h}px`;
        if (f.screen) {
            f.screen.style.width = `${f.width}px`;
            f.screen.style.height = `${f.height}px`;
            f.screen.style.setProperty('--top', `${TOP}px`);
            f.screen.style.setProperty('--bottom', `${f.width - vs.w > 0 ? 0 : f.height - TOP - vs.h}px`);
            f.screen.style.setProperty('--right', `${f.width - vs.w}px`);
            f.screen.classList.toggle('landscape', f.width > f.height);
        }
        f.dims.textContent = f.kind === 'android' && !vp.compare
            ? `${f.label} · screen ${f.width} × ${f.height} · viewport ${vs.w} × ${vs.h}`
            : vp.compare ? `${f.label} · ${f.width} × ${f.height}` : `${f.width} × ${f.height}`;
    }
    const natural = frames.map((f) => ({ w: f.device.offsetWidth, h: f.device.offsetHeight }));
    let scale;
    if (vp.zoom === 'fit') {
        const availW = Math.max(50, stage.clientWidth - STAGE_PAD * 2 - GAP * Math.max(0, frames.length - 1));
        const availH = Math.max(50, stage.clientHeight - STAGE_PAD * 2 - 24);
        const totalW = natural.reduce((s, n) => s + n.w, 0) || 1;
        const maxH = Math.max(1, ...natural.map((n) => n.h));
        scale = Math.min(1, availW / totalW, availH / maxH);
    }
    else {
        scale = vp.zoom;
    }
    frames.forEach((f, i) => {
        f.slot.style.width = `${Math.ceil(natural[i].w * scale)}px`;
        f.slot.style.height = `${Math.ceil(natural[i].h * scale) + 24}px`;
        f.device.style.transform = `scale(${scale})`;
        f.slot.dataset.scale = String(scale);
        ensureHandles(f, showHandles);
    });
    updateToolbar(scale);
}
function ensureHandles(f, show) {
    f.slot.querySelectorAll('.handle').forEach((h) => h.remove());
    if (!show) {
        return;
    }
    const scale = Number(f.slot.dataset.scale) || 1;
    const make = (cls, label, axis) => {
        const h = el('div', `handle ${cls}`);
        h.tabIndex = 0;
        h.setAttribute('role', 'separator');
        h.setAttribute('aria-label', `${label} Drag, or use the arrow keys.`);
        h.title = 'Drag to resize the viewport';
        h.addEventListener('pointerdown', (ev) => {
            ev.preventDefault();
            h.setPointerCapture(ev.pointerId);
            const sx = ev.clientX, sy = ev.clientY, sw = vp.width, sh = vp.height;
            const move = (e) => {
                const s = Number(f.slot.dataset.scale) || scale;
                setCustomSize(axis !== 'y' ? sw + (e.clientX - sx) / s : sw, axis !== 'x' ? sh + (e.clientY - sy) / s : sh);
            };
            const up = (e) => {
                h.releasePointerCapture(e.pointerId);
                h.removeEventListener('pointermove', move);
                h.removeEventListener('pointerup', up);
                h.removeEventListener('pointercancel', up);
            };
            h.addEventListener('pointermove', move);
            h.addEventListener('pointerup', up);
            h.addEventListener('pointercancel', up);
        });
        h.addEventListener('keydown', (ev) => {
            const step = ev.shiftKey ? 50 : 10;
            const d = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? step : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -step : 0;
            if (!d) {
                return;
            }
            ev.preventDefault();
            setCustomSize(axis !== 'y' ? vp.width + d : vp.width, axis !== 'x' ? vp.height + d : vp.height);
        });
        f.slot.append(h);
    };
    make('h-right', 'Resize viewport width.', 'x');
    make('h-bottom', 'Resize viewport height.', 'y');
    make('h-corner', 'Resize viewport width and height.', 'xy');
}
function setCustomSize(w, h) {
    const nw = clamp(w), nh = clamp(h);
    if (nw === vp.width && nh === vp.height) {
        return;
    }
    vp.width = nw;
    vp.height = nh;
    vp.presetId = 'custom';
    vp.rotated = false;
    syncFrames();
    emit();
}
// --------------------------------------------------------------- loading
function srcFor() { return target ? target.src : ''; }
function loadAll() {
    if (!target) {
        return;
    }
    loadedCount = 0;
    for (const f of frames) {
        f.diag = { probe: false, errors: [], consoles: [], resources: [] };
        f.iframe.src = srcFor();
        if (injectDiagnostics) {
            f.diag.probeTimer = window.setTimeout(() => { renderDiagnostics(); }, 3000);
        }
    }
    setPageState('loading', 'Loading preview…');
    renderDiagnostics();
}
function onFrameLoad(f) {
    try {
        if (f.iframe.contentWindow && f.iframe.contentWindow.location.href === 'about:blank') {
            return;
        }
    }
    catch { /* cross-origin: a real page loaded */ }
    if (!f.iframe.getAttribute('src')) {
        return;
    }
    loadedCount++;
    if (loadedCount >= frames.length && pageState === 'loading') {
        setPageState('ready');
    }
}
function reloadFrames() {
    if (pageState === 'empty' || pageState === 'error' || !target) {
        send({ type: 'action', id: 'retry' });
        return;
    }
    for (const f of frames) {
        const win = f.iframe.contentWindow;
        if (f.diag.probe && win) {
            f.diag.errors = [];
            f.diag.consoles = [];
            f.diag.resources = [];
            win.postMessage({ source: 'web-emulator', type: 'reload' }, '*');
        }
        else {
            f.iframe.src = srcFor();
        }
    }
    renderDiagnostics();
}
function setPageState(state, message, title, actions = []) {
    pageState = state;
    notice = { message: message ?? '', title: title ?? '', actions };
    renderState();
}
function renderState() {
    const o = $('overlay');
    const n = $('notice');
    o.replaceChildren();
    n.replaceChildren();
    const onDevice = frames.length > 0 && frames.every((f) => f.kind === 'android');
    const problem = pageState === 'empty' || pageState === 'error';
    const fullCard = problem && !onDevice;
    o.classList.toggle('visible', pageState === 'loading' || fullCard);
    o.dataset.state = fullCard ? pageState : pageState === 'loading' ? 'loading' : 'ready';
    $('stage').classList.toggle('hidden', fullCard);
    n.hidden = !(problem && onDevice);
    if (pageState === 'loading') {
        const card = el('div', 'card');
        card.append(el('div', 'spinner'), el('div', 'card-text', notice.message || 'Loading…'));
        o.append(card);
        return;
    }
    if (!problem) {
        return;
    }
    const empty = pageState === 'empty';
    const title = empty ? 'Nothing to preview yet' : notice.title || 'Cannot load preview';
    const message = empty ? 'The device is showing its home screen. Open an HTML file or enter the URL of a running dev server.' : notice.message;
    const actions = empty ? ['openCurrentFile', 'selectEntryFile', 'selectUrl'] : notice.actions;
    if (onDevice) {
        const row = el('div', 'notice-row');
        const text = el('div', 'text');
        text.append(el('strong', undefined, title), el('span', undefined, message));
        const buttons = el('div', 'actions');
        actions.forEach((a, i) => buttons.append(actionButton(ACTION_LABELS[a], a, i === 0)));
        row.append(el('span', `codicon codicon-${empty ? 'info' : 'error'} ${empty ? '' : 'err'}`), text, buttons);
        n.append(row);
        return;
    }
    const card = el('div', 'card');
    if (empty) {
        card.append(el('span', 'codicon codicon-device-mobile hero'), el('h2', undefined, 'Web Emulator'), el('p', undefined, 'Preview an HTML file or a running dev server at different viewport sizes, and find layout problems.'));
        const row = el('div', 'actions');
        row.append(actionButton('Open current HTML file', 'openCurrentFile', true), actionButton('Choose HTML file…', 'selectEntryFile'), actionButton('Enter URL…', 'selectUrl'));
        card.append(row, el('p', 'hint', 'Flask or Django project? Use “Web Emulator: Start Flask Server” or “Start Django Server” from the Command Palette.'));
    }
    else {
        card.append(el('span', 'codicon codicon-error hero err'), el('h2', undefined, title), el('p', 'err-msg', message));
        const row = el('div', 'actions');
        actions.forEach((a, i) => row.append(actionButton(ACTION_LABELS[a], a, i === 0)));
        card.append(row);
    }
    o.append(card);
}
const ACTION_LABELS = {
    openCurrentFile: 'Open current HTML file', selectEntryFile: 'Choose HTML file…', selectUrl: 'Enter URL…', openInBrowser: 'Open in browser',
    startFlask: 'Start Flask server…', startDjango: 'Start Django server…', selectPythonInterpreter: 'Select Python interpreter…', retry: 'Try again', openSettings: 'Open settings'
};
function actionButton(label, id, primary = false) {
    const b = el('button', primary ? 'primary' : 'secondary', label);
    b.type = 'button';
    b.addEventListener('click', () => send({ type: 'action', id }));
    return b;
}
// --------------------------------------------------------------- toolbar
function populatePresets() {
    const sel = $('preset');
    sel.replaceChildren();
    const groups = new Map();
    for (const p of presets) {
        let g = groups.get(p.group);
        if (!g) {
            g = document.createElement('optgroup');
            g.label = p.group;
            groups.set(p.group, g);
            sel.append(g);
        }
        const o = el('option', undefined, `${p.name}${/\d+ × \d+/.test(p.name) ? '' : ` (${p.width} × ${p.height})`}`);
        o.value = p.id;
        g.append(o);
    }
    const custom = el('option', undefined, 'Custom');
    custom.value = 'custom';
    sel.append(custom);
    const zoom = $('zoom');
    zoom.replaceChildren();
    const fit = el('option', undefined, 'Fit');
    fit.value = 'fit';
    zoom.append(fit);
    for (const z of ZOOMS) {
        const o = el('option', undefined, `${Math.round(z * 100)}%`);
        o.value = String(z);
        zoom.append(o);
    }
}
function updateToolbar(scale) {
    const sel = $('preset');
    sel.value = vp.compare ? sel.value : vp.presetId;
    sel.disabled = vp.compare;
    const w = $('width'), h = $('height');
    if (document.activeElement !== w) {
        w.value = String(vp.width);
    }
    if (document.activeElement !== h) {
        h.value = String(vp.height);
    }
    w.disabled = h.disabled = vp.compare;
    const zoom = $('zoom');
    if (vp.zoom === 'fit') {
        zoom.value = 'fit';
        zoom.options[0].textContent = `Fit (${Math.round(scale * 100)}%)`;
    }
    else {
        zoom.options[0].textContent = 'Fit';
        const match = ZOOMS.find((z) => Math.abs(z - vp.zoom) < 0.001);
        zoom.value = match !== undefined ? String(match) : 'fit';
    }
    toggle('fit', vp.zoom === 'fit');
    toggle('compare', vp.compare);
    toggle('frameToggle', vp.showFrame);
    toggle('diagToggle', vp.showDiagnostics);
    $('rotate').classList.toggle('turned', vp.rotated);
    $('railRotate').classList.toggle('turned', vp.rotated);
    toggle('navMode', vp.navMode === 'buttons');
    const railOn = !vp.compare && frames[0]?.kind === 'android';
    $('rail').hidden = !railOn;
    $('stage').classList.toggle('has-rail', railOn);
    $('navMode').disabled = !frames.some((f) => f.kind === 'android');
    $('home').disabled = !frames.some((f) => f.kind === 'android');
    const names = vp.compare ? `Comparing ${frames.length} viewports` : frames[0]?.label ?? '';
    const spec = !vp.compare ? frames[0]?.spec : undefined;
    const phys = spec ? ` · ${spec.physicalWidth} × ${spec.physicalHeight} px at ${spec.dpi} dpi (${(spec.dpi / 160).toFixed(3).replace(/0+$/, '')}x)` : '';
    $('status').textContent = `${vp.compare ? names : `${vp.width} × ${vp.height}`} · ${Math.round(scale * 100)}%${vp.compare ? '' : ` · ${names}`}${phys}`;
    $('diagnostics').hidden = !vp.showDiagnostics;
    renderBadge();
}
function toggle(id, on) {
    const b = $(id);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
}
function stepZoom(dir) {
    const cur = vp.zoom === 'fit' ? Number(frames[0]?.slot.dataset.scale) || 1 : vp.zoom;
    const idx = ZOOMS.findIndex((z) => z >= cur - 0.001);
    let next;
    if (dir > 0) {
        next = ZOOMS.find((z) => z > cur + 0.001) ?? ZOOMS[ZOOMS.length - 1];
    }
    else {
        const lower = ZOOMS.filter((z) => z < cur - 0.001);
        next = lower.length ? lower[lower.length - 1] : ZOOMS[Math.max(0, idx)];
    }
    vp.zoom = next;
    layout();
    emit();
}
function rotate() {
    vp.rotated = !vp.rotated;
    [vp.width, vp.height] = [vp.height, vp.width];
    syncFrames();
    emit();
}
function applyPreset(id) {
    const custom = /^custom:(\d{3,5})x(\d{3,5})$/.exec(id);
    if (custom) {
        setCustomSize(Number(custom[1]), Number(custom[2]));
        return;
    }
    const p = presetById(id);
    if (!p) {
        return;
    }
    vp.presetId = p.id;
    vp.width = p.width;
    vp.height = p.height;
    vp.rotated = false;
    syncFrames();
    emit();
}
function wireToolbar() {
    $('preset').addEventListener('change', (e) => { const v = e.target.value; if (v !== 'custom') {
        applyPreset(v);
    } });
    for (const id of ['width', 'height']) {
        const input = $(id);
        const commit = () => {
            const n = Number(input.value);
            if (!Number.isFinite(n) || input.value === '') {
                input.value = String(id === 'width' ? vp.width : vp.height);
                return;
            }
            setCustomSize(id === 'width' ? n : vp.width, id === 'height' ? n : vp.height);
            input.value = String(id === 'width' ? vp.width : vp.height);
        };
        input.addEventListener('change', commit);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') {
            commit();
        } });
    }
    $('rotate').addEventListener('click', rotate);
    $('railRotate').addEventListener('click', rotate);
    $('zoomIn').addEventListener('click', () => stepZoom(1));
    $('zoomOut').addEventListener('click', () => stepZoom(-1));
    $('railZoomIn').addEventListener('click', () => stepZoom(1));
    $('railZoomOut').addEventListener('click', () => stepZoom(-1));
    $('railReload').addEventListener('click', reloadFrames);
    $('railBack').addEventListener('click', goBack);
    $('railHome').addEventListener('click', goHome);
    $('home').addEventListener('click', goHome);
    $('navMode').addEventListener('click', () => { vp.navMode = vp.navMode === 'gesture' ? 'buttons' : 'gesture'; frames.forEach(buildDevice); layout(); emit(); });
    $('zoom').addEventListener('change', (e) => { const v = e.target.value; vp.zoom = v === 'fit' ? 'fit' : Number(v); layout(); emit(); });
    $('fit').addEventListener('click', () => { vp.zoom = vp.zoom === 'fit' ? 1 : 'fit'; layout(); emit(); });
    $('reload').addEventListener('click', reloadFrames);
    $('external').addEventListener('click', () => send({ type: 'action', id: 'openInBrowser' }));
    $('compare').addEventListener('click', toggleCompare);
    $('frameToggle').addEventListener('click', () => { vp.showFrame = !vp.showFrame; frames.forEach(buildDevice); layout(); emit(); });
    $('copyDims').addEventListener('click', copyDims);
    $('diagToggle').addEventListener('click', toggleDiagnostics);
    $('diagClose').addEventListener('click', toggleDiagnostics);
    $('diagRefresh').addEventListener('click', () => { frames.forEach((f) => f.iframe.contentWindow?.postMessage({ source: 'web-emulator', type: 'request-report' }, '*')); });
    $('diagClear').addEventListener('click', () => { const f = activeFrame(); if (f) {
        f.diag.errors = [];
        f.diag.consoles = [];
        f.diag.resources = [];
        renderDiagnostics();
    } });
    $('diagFrame').addEventListener('change', () => renderDiagnostics());
    const addr = $('address');
    addr.addEventListener('keydown', (e) => { if (e.key === 'Enter') {
        send({ type: 'submitUrl', value: addr.value });
    } });
    addr.addEventListener('focus', () => addr.select());
    new ResizeObserver(() => { if (vp.zoom === 'fit') {
        layout();
    } }).observe($('stage'));
}
function toggleCompare() {
    if (!vp.compare && compareIds.length < 2) {
        return;
    }
    vp.compare = !vp.compare;
    syncFrames();
    emit();
}
function toggleDiagnostics() { vp.showDiagnostics = !vp.showDiagnostics; layout(); renderDiagnostics(); emit(); }
function copyDims() {
    const f = frames[0];
    if (!f) {
        return;
    }
    send({ type: 'copy', text: vp.compare ? frames.map((x) => `${x.label}: ${x.width} × ${x.height}`).join('\n') : `${vp.width} × ${vp.height}` });
}
// ----------------------------------------------------------- diagnostics
const activeFrame = () => frames[Number($('diagFrame').value) || 0] ?? frames[0];
function fillDiagFrameSelect() {
    const sel = $('diagFrame');
    sel.replaceChildren(...frames.map((f, i) => { const o = el('option', undefined, f.label); o.value = String(i); return o; }));
    sel.hidden = frames.length < 2;
}
function counts(f) {
    const r = f.diag.report;
    return { problems: (r && r.hOverflow ? 1 : 0) + f.diag.errors.length + f.diag.resources.length };
}
let lastDiagJson = '';
function publishDiagnostics() {
    const frames_ = frames.map((f) => ({
        label: f.label, width: f.width, height: f.height, viewportWidth: viewportSize(f).w, viewportHeight: viewportSize(f).h, probe: f.diag.probe, reportedWidth: f.diag.report?.vw,
        overflow: f.diag.report?.hOverflow === true, offenders: f.diag.report?.offenders.length ?? 0, errors: f.diag.errors.length, resources: f.diag.resources.length
    }));
    const json = JSON.stringify(frames_);
    if (json !== lastDiagJson) {
        lastDiagJson = json;
        send({ type: 'diagnostics', frames: frames_ });
    }
}
function renderBadge() {
    publishDiagnostics();
    const total = frames.reduce((s, f) => s + counts(f).problems, 0);
    const badge = $('diagBadge');
    badge.hidden = total === 0;
    badge.textContent = total > 99 ? '99+' : String(total);
}
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const text = (v, n = 300) => String(v ?? '').slice(0, n);
function section(title, count) {
    const wrap = el('div', 'diag-section');
    const head = el('h3', undefined, title);
    if (count !== undefined) {
        head.append(el('span', 'count', String(count)));
    }
    const list = el('ul');
    wrap.append(head, list);
    return { wrap, list };
}
function li(list, cls, msg, onClick, detail) {
    const item = el('li', cls);
    item.append(el('span', 'msg', msg));
    if (detail) {
        item.append(el('span', 'detail', detail));
    }
    if (onClick) {
        item.classList.add('clickable');
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.title = 'Highlight this element in the preview';
        item.addEventListener('click', onClick);
        item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        } });
    }
    list.append(item);
}
function renderDiagnostics() {
    renderBadge();
    if (!vp.showDiagnostics) {
        return;
    }
    const body = $('diagBody');
    body.replaceChildren();
    const f = activeFrame();
    if (!f) {
        body.append(el('p', 'muted', 'Nothing is loaded yet.'));
        return;
    }
    const r = f.diag.report;
    const sv = section('Viewport');
    const vs = viewportSize(f);
    li(sv.list, 'info', f.kind === 'android' ? `Device: ${f.label} — screen ${f.width} × ${f.height} CSS px; website viewport ${vs.w} × ${vs.h} (screen minus status bar and navigation)` : `Selected: ${f.label} — ${f.width} × ${f.height}`);
    if (f.kind === 'android' && f.spec) {
        const dpr = (f.spec.dpi / 160).toFixed(3).replace(/0+$/, '');
        li(sv.list, 'muted', `Physical screen ${f.spec.physicalWidth} × ${f.spec.physicalHeight} px at ${f.spec.dpi} dpi, so 1 CSS px = ${dpr} physical px.`);
    }
    if (r) {
        li(sv.list, r.vw === vs.w ? 'ok' : 'warn', `Page reports: ${r.vw} × ${r.vh} (document ${r.clientW}px wide, content ${r.scrollW}px)`);
    }
    else if (!f.diag.probe && injectDiagnostics && pageState === 'ready') {
        li(sv.list, 'warn', 'Diagnostics script not detected. The page may block injected scripts (strict CSP) or is not HTML.');
    }
    else if (!injectDiagnostics) {
        li(sv.list, 'muted', 'Diagnostics injection is disabled (setting webEmulator.injectDiagnostics).');
    }
    else {
        li(sv.list, 'muted', 'Waiting for the page…');
    }
    body.append(sv.wrap);
    if (!r) {
        appendLogs(body, f);
        return;
    }
    const issues = [];
    if (r.hOverflow) {
        issues.push({ cls: 'err', msg: `Horizontal overflow: content is ${r.scrollW - r.clientW}px wider than the viewport${r.clipped ? ' (hidden by overflow-x: hidden, so users cannot scroll to it)' : ''}.` });
    }
    for (const o of r.offenders) {
        issues.push({ cls: 'warn', msg: `<${o.tag}> extends ${o.over}px past the ${o.side} edge`, sel: o.selector });
    }
    if (!r.hasViewportMeta) {
        issues.push({ cls: 'warn', msg: 'No <meta name="viewport"> found. Real mobile browsers would lay this page out at about 980px wide; the emulator always uses the device width.' });
    }
    const sl = section('Layout', issues.filter((i) => i.cls === 'err' || i.sel).length);
    if (!issues.length) {
        li(sl.list, 'ok', 'No horizontal overflow or off-screen elements detected at this size.');
    }
    for (const i of issues) {
        const sel = i.sel;
        li(sl.list, i.cls, i.msg, sel ? () => f.iframe.contentWindow?.postMessage({ source: 'web-emulator', type: 'highlight', selector: sel }, '*') : undefined, sel);
    }
    body.append(sl.wrap);
    const sm = section('Media queries (same-origin stylesheets)', r.media.length);
    if (!r.media.length) {
        li(sm.list, 'muted', 'No width/height/orientation media queries found.');
    }
    for (const m of r.media) {
        li(sm.list, m.matches ? 'ok' : 'muted', `${m.matches ? 'matches' : 'inactive'}  ${m.cond}`);
    }
    if (r.blockedSheets) {
        li(sm.list, 'muted', `${r.blockedSheets} cross-origin stylesheet(s) could not be inspected.`);
    }
    body.append(sm.wrap);
    appendLogs(body, f);
}
function appendLogs(body, f) {
    const se = section('Errors', f.diag.errors.length);
    if (!f.diag.errors.length) {
        li(se.list, 'ok', 'No JavaScript errors reported.');
    }
    for (const e of f.diag.errors) {
        li(se.list, 'err', e.text, undefined, e.detail);
    }
    body.append(se.wrap);
    const sr = section('Failed resources', f.diag.resources.length);
    if (!f.diag.resources.length) {
        li(sr.list, 'ok', 'No failed images, scripts or stylesheets reported.');
    }
    for (const e of f.diag.resources) {
        li(sr.list, 'err', e.text, undefined, e.detail);
    }
    body.append(sr.wrap);
    const sc = section('Console (errors and warnings)', f.diag.consoles.length);
    if (!f.diag.consoles.length) {
        li(sc.list, 'muted', 'Nothing logged.');
    }
    for (const e of f.diag.consoles) {
        li(sc.list, e.detail === 'warn' ? 'warn' : 'err', e.text);
    }
    body.append(sc.wrap);
}
function push(list, e) { list.push(e); if (list.length > MAX_LOG) {
    list.shift();
} }
function displayFor(href) {
    if (!target) {
        return href;
    }
    try {
        const u = new URL(href);
        if (u.protocol === 'about:' || u.protocol === 'blob:') {
            return target.display;
        }
        if (target.kind === 'url' && target.targetOrigin) {
            return `${target.targetOrigin}${u.pathname}${u.search}${u.hash}`;
        }
        return decodeURI(`${u.pathname}${u.search}${u.hash}`).replace(/^\//, '');
    }
    catch {
        return href;
    }
}
function onProbeMessage(ev) {
    const d = ev.data;
    if (!d || d.source !== 'web-emulator-probe') {
        return;
    }
    const f = frames.find((x) => x.iframe.contentWindow === ev.source);
    if (!f) {
        return;
    }
    switch (d.type) {
        case 'hello':
            f.diag.probe = true;
            window.clearTimeout(f.diag.probeTimer);
            f.iframe.contentWindow?.postMessage({ source: 'web-emulator', type: 'scrollbars', hidden: f.kind === 'android' }, '*');
            break;
        case 'report': {
            const raw = d.report;
            if (!raw) {
                return;
            }
            f.diag.probe = true;
            f.diag.report = {
                vw: num(raw.vw), vh: num(raw.vh), scrollW: num(raw.scrollW), clientW: num(raw.clientW), hOverflow: raw.hOverflow === true, clipped: raw.clipped === true,
                hasViewportMeta: raw.hasViewportMeta === true, viewportMeta: text(raw.viewportMeta, 200), blockedSheets: num(raw.blockedSheets), title: text(raw.title, 200),
                offenders: (Array.isArray(raw.offenders) ? raw.offenders : []).slice(0, 20).map((o) => ({
                    selector: text(o.selector, 400), tag: text(o.tag, 30), left: num(o.left), right: num(o.right), width: num(o.width), over: num(o.over), side: o.side === 'left' ? 'left' : 'right'
                })),
                media: (Array.isArray(raw.media) ? raw.media : []).slice(0, 40).map((m) => ({ cond: text(m.cond, 160), matches: m.matches === true }))
            };
            break;
        }
        case 'console':
            push(f.diag.consoles, { text: text(d.message, 500), detail: d.level === 'warn' ? 'warn' : 'error' });
            break;
        case 'error':
            push(f.diag.errors, { text: text(d.message, 500), detail: d.file ? `${text(d.file, 200)}:${num(d.line)}:${num(d.col)}` : undefined });
            break;
        case 'resource-error':
            push(f.diag.resources, { text: `Failed to load <${text(d.tag, 20)}>`, detail: text(d.url, 300) });
            break;
        case 'navigated':
            if (f === frames[0]) {
                $('address').value = displayFor(text(d.href, 2048));
            }
            break;
        case 'open-external': {
            const now = Date.now();
            if (now - lastExternalOpen < 1000) {
                return;
            }
            lastExternalOpen = now;
            routeExternal(text(d.url, 2048));
            return;
        }
        default: return;
    }
    renderDiagnostics();
}
function routeExternal(url) {
    try {
        const u = new URL(url);
        if (target?.targetOrigin && u.origin === target.targetOrigin) {
            const mapped = `${target.serverOrigin}${u.pathname}${u.search}${u.hash}`;
            frames.forEach((f) => { f.iframe.src = mapped; });
            return;
        }
    }
    catch {
        return;
    }
    send({ type: 'openExternal', url });
}
// --------------------------------------------------------------- inbound
function onHostMessage(m) {
    switch (m.type) {
        case 'init':
            presets = m.presets;
            compareIds = m.compareIds;
            vp = { ...m.viewport, navMode: m.viewport.navMode === 'buttons' ? 'buttons' : 'gesture' };
            injectDiagnostics = m.injectDiagnostics;
            populatePresets();
            setPageState('empty');
            syncFrames();
            break;
        case 'presets':
            presets = m.presets;
            compareIds = m.compareIds;
            injectDiagnostics = m.injectDiagnostics;
            populatePresets();
            syncFrames();
            break;
        case 'load':
            target = m.target;
            $('addressKind').textContent = m.target.kind === 'file' ? 'FILE' : 'URL';
            $('address').value = m.target.display;
            screenMode = 'site';
            applyScreenMode();
            loadAll();
            break;
        case 'empty':
            target = undefined;
            screenMode = 'home';
            applyScreenMode();
            $('addressKind').textContent = '—';
            $('address').value = '';
            frames.forEach((f) => f.iframe.removeAttribute('src'));
            setPageState('empty');
            break;
        case 'loading':
            setPageState('loading', m.message);
            break;
        case 'error':
            screenMode = 'home';
            applyScreenMode();
            frames.forEach((f) => f.iframe.removeAttribute('src'));
            setPageState('error', m.message, m.title, m.actions);
            break;
        case 'setPreset':
            applyPreset(m.id);
            break;
        case 'command':
            if (m.name === 'reload') {
                reloadFrames();
            }
            else if (m.name === 'rotate') {
                rotate();
            }
            else if (m.name === 'toggleDiagnostics') {
                toggleDiagnostics();
            }
            else if (m.name === 'toggleCompare') {
                toggleCompare();
            }
            else if (m.name === 'copyViewport') {
                copyDims();
            }
            else if (m.name === 'goHome') {
                goHome();
            }
            break;
    }
}
window.addEventListener('message', (ev) => {
    if (frames.some((f) => f.iframe.contentWindow === ev.source)) {
        onProbeMessage(ev);
        return;
    }
    if (ev.data && typeof ev.data === 'object' && typeof ev.data.type === 'string') {
        onHostMessage(ev.data);
    }
});
wireToolbar();
send({ type: 'ready' });
export {};
