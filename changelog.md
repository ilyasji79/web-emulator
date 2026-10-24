# Changelog

## 0.2.0

- Redesigned the phone emulator after the Android Studio Android Emulator: dark graphite frame, punch-hole camera, hardware buttons, Android status bar, gesture or 3-button navigation, and a simulated home screen when nothing is loaded.
- New presets: Pixel 9, 8, 7 and 6 (physical resolution, 420 dpi, pixel ratio) and Custom device. Removed the iPhone SE and XR presets (an iOS device does not belong in an Android frame).
- The width/height fields are now the Android *screen*; the website viewport (screen minus system bars) is shown separately.
- Side rail (rotate, zoom, back, home, reload), *Reset to Android Home Screen* command, gesture/3-button toggle.
- Empty and error states keep the device visible and show a notice bar outside the screen.
- Phone frames use overlay-style (hidden) scrollbars so the page gets the full viewport width.
- Fixed: the diagnostics panel stayed empty when opened after the page had already reported.
- Fixed: WebSocket upgrades through the proxy (found by tests in 0.1.0 development, shipped fixed).

## 0.1.0

Initial release.

- Responsive preview in a VS Code webview: Mobile, Tablet, Laptop and Desktop presets, custom width/height, rotate, drag-to-resize, zoom, fit-to-window, side-by-side compare mode.
- Preview local HTML files (internal loopback static server) or running dev servers (loopback reverse proxy with HMR WebSocket support).
- Diagnostics: horizontal overflow, elements past the viewport edge, matched media queries, JavaScript errors, console errors/warnings, failed resources, missing `<meta name="viewport">`. Click an issue to highlight the element.
- Auto-reload on save (configurable).
- Flask and Django: detect projects, start with an explicit confirmation, wait for the server, preview it; interpreter selection; never installs packages.
- Activity-bar launcher, editor/explorer context menu, keyboard shortcut, Command Palette commands.
- Security: nonce-based CSP, loopback-only servers, Host-header checks, path-traversal/symlink/dotfile protection, URL validation, workspace-trust aware.
