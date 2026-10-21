# Web Emulator

A browser-based web layout emulator prototype for experimenting with HTML, CSS, and JavaScript in a device-style preview interface. The project includes a Python editor tab in the UI; Python execution depends on the runtime and setup implemented in the source and should be verified in your environment.

## Features in this source prototype

- Device-size presets and rotate control
- HTML, CSS, and JavaScript editor areas
- Preview rendered in an iframe
- Optional auto-run control
- Code snippets and dark-mode UI
- Python-related editor/runtime integration included in the source

> **Project status:** This repository contains the supplied standalone HTML/CSS/JavaScript emulator prototype. It is not yet a packaged Visual Studio Code extension. To publish it as a VS Code extension, add the VS Code Extension API entry point, `package.json` extension manifest, Webview integration, tests, and packaging configuration.

## Run locally

1. Download or clone this repository.
2. Open `index.html` in a modern browser, or serve the folder with a local static web server.
3. For a simple Python static server, open a terminal in this folder and run:

   ```powershell
   py -m http.server 8000
   ```

4. Open `http://localhost:8000` in your browser.

Some libraries are loaded from public CDNs, so an internet connection may be required. Do not use this prototype to run untrusted code.

## Project files

- `index.html` — emulator interface
- `style.css` — layout and visual styling
- `script.js` — emulator interactions and preview logic

## Contribute

Please open an issue before making large changes. Bug reports should include browser/OS details, steps to reproduce, and expected versus actual behavior.

## Version

Current source baseline: **v1.0.0** (initial GitHub source upload).

## License

No license has been selected for this project yet. Unless a license is added, normal copyright restrictions apply. Add a license file before inviting reuse or redistribution.
