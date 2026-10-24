/* Web Emulator diagnostics probe.
 * Injected into previewed HTML pages. It only reports to the parent frame
 * (the emulator webview) with postMessage and never modifies the page,
 * except for a temporary highlight overlay when the user asks for one. */
(function () {
  'use strict';
  if (window.__webEmulatorProbe || window.parent === window) {
    return;
  }
  window.__webEmulatorProbe = true;
  var parentWin = window.parent;
  var MAX_ELEMENTS = 4000;

  function post(msg) {
    msg.source = 'web-emulator-probe';
    try { parentWin.postMessage(msg, '*'); } catch (e) { /* ignore */ }
  }
  function str(v, n) { var s = String(v); return s.length > n ? s.slice(0, n) + '…' : s; }
  function esc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^\w-]/g, '\\$&'); }

  // ---- console + errors -------------------------------------------------
  ['error', 'warn'].forEach(function (level) {
    var orig = console[level];
    console[level] = function () {
      try {
        var text = Array.prototype.map.call(arguments, function (a) {
          if (a instanceof Error) { return a.stack || a.message; }
          if (typeof a === 'object') { try { return JSON.stringify(a); } catch (e) { return String(a); } }
          return String(a);
        }).join(' ');
        post({ type: 'console', level: level, message: str(text, 500) });
      } catch (e) { /* ignore */ }
      return orig.apply(console, arguments);
    };
  });
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && t.tagName) {
      post({ type: 'resource-error', tag: t.tagName.toLowerCase(), url: str(t.currentSrc || t.src || t.href || '', 300) });
    } else {
      post({ type: 'error', message: str(e.message || 'Script error', 500), file: str(e.filename || '', 300), line: e.lineno || 0, col: e.colno || 0 });
    }
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    post({ type: 'error', message: 'Unhandled promise rejection: ' + str(r && r.message ? r.message : r, 400), file: '', line: 0, col: 0 });
  });

  // ---- layout report ----------------------------------------------------
  var clipCache = new WeakMap();
  function isClipped(el) {
    var chain = [];
    var cur = el.parentElement;
    var result = false;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (clipCache.has(cur)) { result = clipCache.get(cur); break; }
      chain.push(cur);
      var ox = getComputedStyle(cur).overflowX;
      if (ox === 'hidden' || ox === 'auto' || ox === 'scroll' || ox === 'clip') { clipCache.set(cur, true); result = true; break; }
      cur = cur.parentElement;
    }
    chain.forEach(function (c) { if (!clipCache.has(c)) { clipCache.set(c, result); } });
    return result;
  }
  function selectorFor(el) {
    var parts = [];
    var cur = el;
    var depth = 0;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement && depth < 5) {
      var s = cur.tagName.toLowerCase();
      if (cur.id) { parts.unshift(s + '#' + esc(cur.id)); break; }
      var cls = (cur.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) { s += '.' + cls.map(esc).join('.'); }
      var p = cur.parentElement;
      if (p) { s += ':nth-child(' + (Array.prototype.indexOf.call(p.children, cur) + 1) + ')'; }
      parts.unshift(s);
      cur = p;
      depth++;
    }
    return parts.join(' > ');
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, NOSCRIPT: 1, TEMPLATE: 1, HEAD: 1, TITLE: 1, BR: 1 };

  function collectMedia() {
    var seen = {};
    var out = [];
    var blocked = 0;
    function walk(rules) {
      for (var i = 0; i < rules.length && out.length < 40; i++) {
        var r = rules[i];
        if (r.type === 4) {
          var cond = r.conditionText || (r.media && r.media.mediaText) || '';
          if (cond && !seen[cond] && /width|height|orientation|resolution|hover|pointer|prefers/.test(cond)) {
            seen[cond] = true;
            out.push({ cond: str(cond, 160), matches: window.matchMedia(cond).matches });
          }
        }
        if (r.cssRules) { walk(r.cssRules); }
      }
    }
    for (var i = 0; i < document.styleSheets.length; i++) {
      var rules = null;
      try { rules = document.styleSheets[i].cssRules; } catch (e) { blocked++; continue; }
      if (rules) { walk(rules); }
    }
    return { list: out, blocked: blocked };
  }

  function buildReport() {
    var de = document.documentElement;
    var body = document.body;
    var clientW = de.clientWidth;
    var scrollW = Math.max(de.scrollWidth, body ? body.scrollWidth : 0);
    var hOverflow = scrollW > clientW + 1;
    var ox = getComputedStyle(de).overflowX;
    var bx = body ? getComputedStyle(body).overflowX : 'visible';
    var clipped = hOverflow && (ox === 'hidden' || bx === 'hidden' || ox === 'clip' || bx === 'clip');
    var offenders = [];
    if (body) {
      var els = body.getElementsByTagName('*');
      var n = Math.min(els.length, MAX_ELEMENTS);
      var sx = window.pageXOffset || 0;
      for (var i = 0; i < n; i++) {
        var el = els[i];
        if (SKIP[el.tagName] || el.id === '__web-emulator-hl') { continue; }
        var r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) { continue; }
        var right = r.right + sx;
        var left = r.left + sx;
        var overRight = right - clientW;
        var overLeft = -left;
        if (overRight > 1 || overLeft > 1) {
          if (isClipped(el)) { continue; }
          offenders.push({
            selector: selectorFor(el), tag: el.tagName.toLowerCase(),
            left: Math.round(left), right: Math.round(right), width: Math.round(r.width),
            over: Math.round(Math.max(overRight, overLeft)), side: overRight >= overLeft ? 'right' : 'left'
          });
        }
      }
      offenders.sort(function (a, b) { return b.over - a.over; });
      offenders = offenders.slice(0, 20);
    }
    var meta = document.querySelector('meta[name="viewport"]');
    var media = collectMedia();
    return {
      vw: window.innerWidth, vh: window.innerHeight, scrollW: scrollW, clientW: clientW, scrollH: de.scrollHeight,
      hOverflow: hOverflow, clipped: clipped, hasViewportMeta: !!meta, viewportMeta: meta ? str(meta.getAttribute('content') || '', 200) : '',
      offenders: offenders, media: media.list, blockedSheets: media.blocked, title: str(document.title || '', 200)
    };
  }

  var timer = null;
  var last = 0;
  function schedule(delay) {
    if (timer) { clearTimeout(timer); }
    var wait = delay === 0 ? 0 : Math.max(delay === undefined ? 250 : delay, 500 - (Date.now() - last));
    timer = setTimeout(function () {
      timer = null;
      last = Date.now();
      try { post({ type: 'report', report: buildReport() }); } catch (e) { post({ type: 'error', message: 'Diagnostics failed: ' + str(e && e.message, 200), file: '', line: 0, col: 0 }); }
    }, wait);
  }

  window.addEventListener('load', function () { post({ type: 'navigated', href: location.href, title: document.title }); schedule(100); });
  window.addEventListener('resize', function () { schedule(); });
  window.addEventListener('hashchange', function () { post({ type: 'navigated', href: location.href, title: document.title }); });
  ['pushState', 'replaceState'].forEach(function (fn) {
    var orig = history[fn];
    history[fn] = function () {
      var r = orig.apply(history, arguments);
      post({ type: 'navigated', href: location.href, title: document.title });
      schedule();
      return r;
    };
  });
  window.addEventListener('popstate', function () { post({ type: 'navigated', href: location.href, title: document.title }); schedule(); });

  function startObserver() {
    try {
      new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          if (!(records[i].target && records[i].target.id === '__web-emulator-hl')) { schedule(400); return; }
        }
      }).observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    } catch (e) { /* ignore */ }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', startObserver); } else { startObserver(); }

  // ---- links ------------------------------------------------------------
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || e.defaultPrevented || e.button !== 0) { return; }
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (!/^https?:$/.test(url.protocol)) { return; }
    if (url.origin !== location.origin) {
      e.preventDefault();
      post({ type: 'open-external', url: url.href });
    } else if (a.target === '_blank') {
      e.preventDefault();
      location.href = url.href;
    }
  }, true);

  // ---- commands from the emulator --------------------------------------
  // Mobile browsers use overlay scrollbars that take no layout width. The emulator asks for this on phone frames.
  function setScrollbars(hidden) {
    var old = document.getElementById('__web-emulator-sb');
    if (old && old.parentNode) { old.parentNode.removeChild(old); }
    if (!hidden) { schedule(100); return; }
    var st = document.createElement('style');
    st.id = '__web-emulator-sb';
    st.textContent = 'html{scrollbar-width:none!important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important}';
    (document.head || document.documentElement).appendChild(st);
    schedule(100);
  }
  var hlTimer = null;
  function clearHighlight() {
    var old = document.getElementById('__web-emulator-hl');
    if (old && old.parentNode) { old.parentNode.removeChild(old); }
  }
  function highlight(selector) {
    clearHighlight();
    var el = null;
    try { el = document.querySelector(selector); } catch (e) { return; }
    if (!el) { return; }
    el.scrollIntoView({ block: 'center', inline: 'center' });
    var r = el.getBoundingClientRect();
    var box = document.createElement('div');
    box.id = '__web-emulator-hl';
    box.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #ff3366;background:rgba(255,51,102,.15);' +
      'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;';
    document.documentElement.appendChild(box);
    if (hlTimer) { clearTimeout(hlTimer); }
    hlTimer = setTimeout(clearHighlight, 4000);
  }
  window.addEventListener('message', function (e) {
    if (e.source !== parentWin || !e.data || e.data.source !== 'web-emulator') { return; }
    switch (e.data.type) {
      case 'reload': location.reload(); break;
      case 'back': history.back(); break;
      case 'scrollbars': setScrollbars(e.data.hidden === true); break;
      case 'highlight': if (typeof e.data.selector === 'string') { highlight(e.data.selector); } break;
      case 'clear-highlight': clearHighlight(); break;
      case 'request-report': schedule(0); break;
      default: break;
    }
  });

  post({ type: 'hello' });
})();
