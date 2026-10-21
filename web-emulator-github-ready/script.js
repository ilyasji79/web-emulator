let width = 360;
let height = 720;

function runCode() {
  const html = document.getElementById("html-editor").value;
  const css = document.getElementById("css-editor").value;
  const js = document.getElementById("js-editor").value;
  const iframe = document.getElementById("output");

  

  const isDark = document.body.classList.contains("dark-mode");

  const darkStyle = isDark
    ? `<style>
         body {
           background: #000;
           color: #fff;
           font-family: sans-serif;
         }
         a, h1, h2, h3, h4, h5, h6, p, span, div {
           color: #fff !important;
         }
       </style>`
    : "";

const result = `
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${darkStyle}
      <style>
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }
        ${css}
      </style>
    </head>
    <body>
      ${html}
      <script>${js}<\/script>
    </body>
  </html>
`;


  iframe.srcdoc = result;
}

function changeDeviceSize() {
  const [w, h] = document.getElementById("device-select").value.split("x").map(Number);
  width = w;
  height = h;
  applySize();
}

function rotateDevice() {
  [width, height] = [height, width];
  applySize();
}

function applySize() {
  const mobile = document.getElementById("mobile");
  mobile.style.width = width + "px";
  mobile.style.height = height + "px";
}

function updateClock() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
  document.getElementById("clock").textContent = formatted;
}

let pyodideReady = null;
async function loadPyodideEngine() {
  pyodideReady = await loadPyodide();
  console.log("✅ Pyodide ready");
}
loadPyodideEngine();

document.addEventListener('DOMContentLoaded', () => {
  // 🌙 Dark mode toggle
  document.getElementById("darkToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    runCode(); // re-run for iframe theme
  });

const autoRunBtn = document.getElementById("autoRunBtn");
let autoRunEnabled = false;

// Toggle auto-run state on button click
autoRunBtn.addEventListener("click", () => {
  autoRunEnabled = !autoRunEnabled;
  autoRunBtn.classList.toggle("active", autoRunEnabled);
  autoRunBtn.textContent = autoRunEnabled ? "Auto-run: ON" : "Auto-run: OFF";
});

// Run code automatically when typing
document.querySelectorAll('textarea[data-editor]').forEach(editor => {
  editor.addEventListener("input", () => {
    if (autoRunEnabled) {
      runCode();
    }
  });
});
const snippets = {
  "html:basic": `<!DOCTYPE html>\n<html>\n<head>\n  <title>My Page</title>\n</head>\n<body>\n</body>\n</html>`,
  "html:img": `<img src="https://via.placeholder.com/150" alt="Placeholder Image">`,
  "css:center": `.center {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}`,
  "js:alert": `alert("Hello from JS!");`,
  "python:print": `print("Hello from Python!")`
};

document.querySelectorAll('.snippet-icons i').forEach(icon => {
  icon.addEventListener('click', () => {
    const snippetKey = icon.getAttribute('data-snippet');
    const [lang] = snippetKey.split(":");
    const targetId = lang === "python" ? "py-editor" : `${lang}-editor`;
    const editor = document.getElementById(targetId);
    const snippet = snippets[snippetKey];

    if (editor && snippet) {
      const cursorPos = editor.selectionStart || 0;
      const content = editor.value;
      editor.value = content.slice(0, cursorPos) + snippet + content.slice(cursorPos);
      editor.focus();
    }
  });
});

  // ▶️ Run button listener
  document.getElementById("runBtn").addEventListener("click", runCode);

  document.getElementById("runPython").addEventListener("click", async () => {
  const pyEditor = document.getElementById("py-editor").value;
  const outputEl = document.getElementById("pythonOutput");

  if (!window.pyodide) {
    outputEl.textContent = "⏳ Loading Python engine...";
    window.pyodide = await loadPyodide();
  }

  try {
    const result = await window.pyodide.runPythonAsync(pyEditor);
    outputEl.textContent = result || "✅ Code executed with no return value.";
  } catch (err) {
    outputEl.textContent = `❌ Error:\n${err}`;
  }

  // Auto-switch to output view
  document.querySelectorAll("textarea").forEach(t => t.style.display = "none");
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  outputEl.style.display = "block";
});

document.getElementById("backToEditor").style.display = "inline-block";

document.getElementById("runPython").addEventListener("click", async () => {
  const code = document.getElementById("py-editor").value;
  const output = document.getElementById("pythonOutput");

  if (!pyodideReady) {
    output.textContent = "⏳ Python engine is not ready...";
    return;
  }

  try {
    await pyodideReady.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
    `);
    await pyodideReady.runPythonAsync(code);
    const printed = await pyodideReady.runPythonAsync("sys.stdout.getvalue()");
    output.textContent = printed || "✅ Code executed with no output.";

    // Inject into emulator iframe too
    document.getElementById("output").srcdoc = `
      <html><body style="background:#000; color:#0f0; font-family:monospace; padding:10px;">
      <h3>🐍 Python Output</h3><pre>${printed}</pre></body></html>
    `;
  } catch (err) {
    output.textContent = "❌ Python Error:\\n" + err;
  }
  document.getElementById("backToEditor").addEventListener("click", () => {
  document.getElementById("pythonOutput").style.display = "none";
  document.querySelector('[data-tab="python"]').click();
});

});


document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const selected = tab.getAttribute("data-tab");

    // Show/hide appropriate editor
    document.querySelectorAll(".editor textarea").forEach(editor => {
      editor.style.display = editor.getAttribute("data-editor") === selected ? "block" : "none";
    });

    // Show/hide Python output only when python tab is selected
    document.getElementById("pythonOutput").style.display = selected === "python" ? "block" : "none";
  });
});

// Handle closing tabs
document.querySelectorAll(".close-tab").forEach(close => {
  close.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent tab switching
    const tab = close.parentElement;
    const type = tab.getAttribute("data-tab");

    // Hide tab
    tab.style.display = "none";

    // Hide editor
    const editor = document.querySelector(`textarea[data-editor="${type}"]`);
    if (editor) editor.style.display = "none";

    // Hide Python-only extras
    if (type === "python") {
      document.getElementById("runPython").style.display = "none";
      document.getElementById("pythonOutput").style.display = "none";
    }

    // Auto-switch to HTML if active was closed
    if (tab.classList.contains("active")) {
      const fallback = document.querySelector(".tab:not([style*='display: none'])");
      if (fallback) fallback.click();
    }
  });
});
const closedTabs = new Set();

document.querySelectorAll(".close-tab").forEach(close => {
  close.addEventListener("click", (e) => {
    e.stopPropagation();
    const tab = close.parentElement;
    const type = tab.getAttribute("data-tab");

    tab.style.display = "none";
    closedTabs.add(type);

    const editor = document.querySelector(`textarea[data-editor="${type}"]`);
    if (editor) editor.style.display = "none";

    if (type === "python") {
      document.getElementById("runPython").style.display = "none";
      document.getElementById("pythonOutput").style.display = "none";
    }

    if (tab.classList.contains("active")) {
      const fallback = document.querySelector(".tab:not([style*='display: none'])");
      if (fallback) fallback.click();
    }
  });
});

document.getElementById("addTabBtn").addEventListener("click", () => {
  const popup = document.getElementById("tabPopup");
  popup.innerHTML = "";

  if (closedTabs.size === 0) {
    popup.innerHTML = "<i>No closed tabs</i>";
  } else {
    closedTabs.forEach(type => {
      const btn = document.createElement("button");
      btn.textContent = `Reopen ${type}`;
      btn.onclick = () => {
        const tab = document.querySelector(`.tab[data-tab="${type}"]`);
        const editor = document.querySelector(`textarea[data-editor="${type}"]`);

        if (tab) tab.style.display = "inline-block";
        if (editor) editor.style.display = "block";

        if (type === "python") {
          document.getElementById("runPython").style.display = "inline-block";
          document.getElementById("pythonOutput").style.display = "block";
        }

        closedTabs.delete(type);
        tab.click();
        popup.style.display = "none";
      };
      popup.appendChild(btn);
    });
  }

  popup.style.display = "flex";
});


  // ⏰ Clock
  updateClock();
  setInterval(updateClock, 1000);

  // 📱 Device size
  changeDeviceSize();

  // 🧠 Tab switching logic (HTML, CSS, JS, Python)
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const selected = tab.getAttribute("data-tab");

      // Set active tab
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      // Show only the selected editor
      document.querySelectorAll(".editor textarea").forEach(editor => {
        if (editor.getAttribute("data-editor") === selected) {
          editor.style.display = "block";
        } else {
          editor.style.display = "none";
        }

        function toggleCodePreview() {
  const preview = document.getElementById("codePreview");
  const isVisible = preview.style.display === "block";

  if (!isVisible) {
    document.getElementById("htmlCodeBlock").textContent = htmlEditor.getValue();
    document.getElementById("cssCodeBlock").textContent = cssEditor.getValue();
    document.getElementById("jsCodeBlock").textContent = jsEditor.getValue();
    document.getElementById("pyCodeBlock").textContent = pyEditor.getValue();
    Prism.highlightAll();
  }

  preview.style.display = isVisible ? "none" : "block";
}

      });
    });
  });
});



