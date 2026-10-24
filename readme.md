# Web Emulator

Responsive layout testing inside VS Code. Preview an HTML file or a running dev server at phone, tablet, laptop and desktop sizes, resize freely, compare viewports side by side, and get a diagnostics panel that points at elements causing horizontal overflow.

> The emulator renders your website in a browser frame styled like an Android phone. It is **not** the Android Emulator, does not run Android, and does not reproduce real hardware. See [Limitations](#limitations).

## Features

- **Android Studio-style device**: dark graphite frame, punch-hole camera, hardware buttons, a status bar (time, Wi-Fi, signal, battery) and gesture or 3-button navigation. The website renders in the screen between the bars. No app bar or bottom menu is added to the screen.
- **Android home screen** when nothing is loaded (wallpaper, date, app icons, search, dock). **Home** (side rail, toolbar, gesture pill or nav button, or *Reset to Android Home Screen*) returns to it; the globe icon in the dock reopens the website.
- **Device presets**: Pixel 9, 8, 7 and 6 (with physical resolution, 420 dpi profile and pixel ratio), Pixel 4 and Redmi sizes from the original prototype, generic Mobile 375×812 and 390×844, Tablet 768×1024, Laptop 1366×768, Desktop 1920×1080, **Custom device**, plus your own via `webEmulator.customPresets`.
- **Device vs viewport**: for Android phones the width and height fields are the *screen* in CSS pixels. The website's CSS viewport is the screen minus the status bar (24 px) and navigation (16 px gesture area, or 48 px for 3-button navigation, on the right edge in landscape). Both are shown above the device, and the footer shows the physical resolution and pixel ratio.
- **Custom sizes**: type a width and height, or drag the edges/corner (keyboard: focus a handle and use the arrow keys, Shift for bigger steps).
- **Rotate** (camera moves to the left edge, 3-button navigation moves to the right), **zoom** (25–200 %), **fit to window**, gesture/3-button toggle, device frame on/off, copy dimensions. A side rail next to the device offers rotate, zoom, back, home and reload.
- **Compare mode**: show several viewports side by side (`webEmulator.comparePresets`).
- **Local files**: pick any `.html` file; CSS, JS (including ES modules), images, fonts and relative paths work because the page is served over HTTP, not `file://`. Client-side routes fall back to the entry file.
- **Dev servers**: preview `http://localhost:3000`, `:5173`, `:8000`, or any port. Hot-reload WebSockets keep working.
- **Diagnostics** (bug icon): horizontal overflow, elements extending past the viewport, which `@media` width/height rules match at this size, uncaught JS errors, `console.error`/`warn`, failed images/scripts/stylesheets, missing `<meta name="viewport">`. Click an element in the list to highlight it in the preview.
- **Auto-reload** when you save a file in the project (`webEmulator.autoReload`).
- **Python**: start a Flask or Django server (after you confirm the exact command) and preview it.
- **Clear states**: empty, loading, and error screens with next-step buttons (server not running, file missing, invalid URL…).

## Installation

From the Marketplace: open the Extensions view, search for **Web Emulator**, click Install.

From a `.vsix`: `code --install-extension web-emulator-0.1.0.vsix` (or Extensions view → `…` → *Install from VSIX…*).

Requires VS Code 1.90 or newer.

## Quick start

1. Open an HTML file and press `Ctrl+Alt+Shift+E` (`Cmd+Alt+Shift+E` on macOS), or right-click → **Open Current HTML File in Emulator**.
2. Or run **Web Emulator: Select Preview URL…** and enter `5173`, `localhost:3000`, etc.
3. Change the preset in the toolbar, drag the edges, press the bug icon for diagnostics.

The activity-bar icon opens a launcher with the same actions and a list of presets.

## Commands

| Command | What it does |
|---|---|
| Web Emulator: Open Emulator | Opens the panel (restores the last target) |
| Web Emulator: Open Current HTML File in Emulator | Also in the editor title, editor/explorer context menus |
| Web Emulator: Select HTML Entry File… | Pick a workspace HTML file or browse |
| Web Emulator: Select Preview URL… | Type or pick a URL / port |
| Web Emulator: Reload Emulator | Reloads, keeping the current route |
| Web Emulator: Select Viewport Preset… | Preset list or `WxH` |
| Web Emulator: Rotate Viewport | Swap width and height |
| Web Emulator: Reset to Android Home Screen | Show the home screen (the site stays loaded) |
| Web Emulator: Toggle Diagnostics Panel | |
| Web Emulator: Copy Viewport Dimensions | |
| Web Emulator: Open Preview in External Browser | |
| Web Emulator: Select Python Interpreter… | |
| Web Emulator: Start Flask Server… / Start Django Server… / Stop Python Server | |

The shortcut `Ctrl+Alt+Shift+E` was chosen to avoid VS Code defaults; check **Keyboard Shortcuts** if you have custom bindings.

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `webEmulator.defaultPreset` | `pixel-9` | First device |
| `webEmulator.autoReload` | `true` | Reload on save |
| `webEmulator.autoReloadDelay` | `250` | ms between save and reload |
| `webEmulator.autoReloadUrlTargets` | `false` | Also reload on save for URL previews |
| `webEmulator.defaultUrls` | common dev ports | Suggestions for *Select Preview URL* |
| `webEmulator.allowRemoteUrls` | `false` | Allow non-local `http(s)` URLs |
| `webEmulator.serveRoot` | `workspaceFolder` | Folder exposed when previewing a file (`fileFolder` = only its folder) |
| `webEmulator.spaFallback` | `true` | Serve the entry file for unknown extension-less routes |
| `webEmulator.injectDiagnostics` | `true` | Inject the diagnostics script into pages |
| `webEmulator.openBeside` | `true` | Open in a column beside the editor |
| `webEmulator.customPresets` | `[]` | `[{ "name": "My phone", "width": 412, "height": 915 }]` |
| `webEmulator.comparePresets` | `pixel-9`, tablet, laptop | Up to 4 preset ids for compare mode |
| `webEmulator.python.interpreterPath` | `""` | Auto-detects `.venv`, `venv`, `env`, then `python3`/`python` |
| `webEmulator.python.flask.app` / `.port` / `.debug` | `""` / `5000` / `false` | `flask --app …` value, port, `--debug` |
| `webEmulator.python.django.manage` / `.port` | `manage.py` / `8000` | |

## Python (Flask and Django)

Python source is never rendered directly. The framework runs, and the emulator previews the HTTP server it exposes.

1. Select the interpreter whose environment has your framework: **Web Emulator: Select Python Interpreter…** (or set `webEmulator.python.interpreterPath`). A `.venv`/`venv`/`env` folder in the workspace is picked up automatically.
2. Run **Start Flask Server…** or **Start Django Server…**. The extension checks that the framework is importable, shows the **exact command** and asks for confirmation, starts it as a VS Code task (visible in the terminal panel), waits for the port, then opens the preview.
3. **Stop Python Server** ends it.

Nothing is installed for you. If Flask or Django is missing you get the command to run yourself, for example `python -m pip install flask`.

Flask is launched as `python -m flask --app <app> run --host 127.0.0.1 --port 5000`, Django as `python manage.py runserver 127.0.0.1:8000`. Servers started elsewhere (your own terminal, Docker, `flask run` with other options) work too: just enter the URL.

Starting servers is disabled in untrusted workspaces because it executes project code.

## How it works

```
VS Code extension host (TypeScript)        Webview (sandboxed, nonce CSP)
 ├─ commands, tree view, settings           ├─ toolbar, device frames, zoom, resize
 ├─ EmulatorPanel  ── messages ───────────▶ ├─ <iframe sandbox> ──▶ http://127.0.0.1:PORT
 ├─ PreviewSession                          └─ diagnostics panel ◀── postMessage ── probe.js
 │   ├─ StaticServer (HTML files)
 │   └─ ProxyServer  (dev servers) ───────────────▶ your server (localhost:3000 …)
 └─ PythonServers (tasks)
```

Raw `file://` pages cannot load ES modules, `fetch()` local data, or use client-side routing, and webviews cannot embed arbitrary servers that send `X-Frame-Options`. So the extension runs a loopback-only HTTP server for files and a loopback reverse proxy for dev servers. The proxy strips only `X-Frame-Options` and the CSP `frame-ancestors` directive, rewrites `Host`/`Origin`/redirects, forwards WebSocket upgrades, and injects a small diagnostics script into HTML responses.

## Security

- Webview CSP: `default-src 'none'`, nonce-only scripts, no `unsafe-inline`/`unsafe-eval`, frames only from `127.0.0.1`/`localhost`.
- Previewed pages run in a sandboxed `<iframe>` on a different origin from the webview.
- Servers bind to `127.0.0.1` on a random port, accept only matching `Host` headers (DNS-rebinding protection), send no CORS headers, reject `..`, encoded traversal, dotfiles (`.env`, `.git`…), and symlinks leaving the served folder.
- URLs must be `http`/`https`, without credentials, and local unless `allowRemoteUrls` is on.
- Links to other sites open in your browser only after you confirm.
- Servers, watchers and tasks are disposed with the panel/extension. No telemetry, no network calls of its own.
- Previewed pages **do execute their own JavaScript** (that is the point). Use workspace trust for projects you do not trust.

## Limitations

- **Not the Android Emulator and not Android.** Only websites run, in VS Code's Chromium. The home screen, app icons, search box and recents button are decorative. Only the globe icon, Home, Back (needs the diagnostics script) and the gesture pill do anything.
- **Not device emulation.** Touch events, `devicePixelRatio`, user agent, mobile browser chrome (address bar), display cutout safe areas and the 980px legacy layout viewport are not emulated. The frame lays out at exactly the website viewport width, as if `width=device-width` were set; diagnostics warn when the meta tag is missing. Physical resolution is shown for reference only.
- Status bar and navigation sizes (24, 16 and 48 px), bezels and corner radii are visual approximations. CSS sizes for Pixel presets are the commonly reported Chrome values.
- On phone frames scrollbars are hidden (like Android's overlay scrollbars) when the diagnostics script is active.
- Rendering uses VS Code's Chromium. It does not show how Safari or Firefox render the page.
- Diagnostics are not DevTools. They need an injectable HTML page; pages with a strict nonce-based CSP, non-HTML responses, or `injectDiagnostics: false` show no diagnostics. Cross-origin stylesheets cannot be inspected for media queries.
- Dev servers that bind only to a non-loopback address or require HTTPS client certificates are not supported. Self-signed HTTPS is accepted for loopback targets only.
- HTTP range requests (video seeking) are not implemented by the static server.
- In remote/Codespaces browser windows the preview needs a port forwarded as `localhost`.
- The five legacy device sizes come from the original prototype and are not exact hardware values.

## Development

```bash
npm install
npm run compile        # copies codicons, builds extension + webview
npm run lint
npm run test:unit      # mocha, no VS Code needed
WEB_EMULATOR_TEST_PYTHON=/path/to/python npm run test:unit   # also runs real Flask/Django tests
npm run test:integration   # downloads VS Code, runs tests in an Extension Development Host
npm run test:visual        # optional: real-browser checks of the device UI (needs Firefox, geckodriver and selenium)
npm run package        # produces web-emulator-<version>.vsix
```

Press `F5` in VS Code to launch an Extension Development Host. Set `publisher` in `package.json` to your Marketplace publisher id before `vsce publish`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| “Nothing is listening on localhost:PORT” | Start the dev server; check the port; for Flask/Django use the Start commands |
| “Module flask is not installed” | Install it in the selected environment; pick the right interpreter |
| Blank page for a file | Open diagnostics: look for failed resources; root-relative paths need `serveRoot: workspaceFolder` |
| No diagnostics | Page blocks injected scripts, or `injectDiagnostics` is off |
| Page reloads twice on save | Leave `autoReloadUrlTargets` off for HMR dev servers |

## License

MIT. Icons are from [`@vscode/codicons`](https://github.com/microsoft/vscode-codicons) (MIT / CC-BY-4.0).
