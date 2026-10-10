<div align="center">

# CO-Agent

### Your local-first AI workspace for desktop

Chat with local models, manage your Ollama runtime, and bring everyday media workflows into one desktop application.

**React · Electron · Vite · Ollama · FFmpeg**

[Features](#-what-it-can-do) · [Quick start](#-quick-start) · [Development](#-development) · [Troubleshooting](#-troubleshooting) · [Roadmap](#-current-status--roadmap)

</div>

---

> **Project status:** CO-Agent 0.6.1 is an active reconstruction of the recovered source project. The core workspace and several local runtime/media paths have been reimplemented, but this repository is **not yet a byte-for-byte restoration** of the original archive. See [RESTORE-ROADMAP.md](RESTORE-ROADMAP.md) for known gaps. Do not assume a feature is complete until it has been tested on your machine.

## ✨ What it can do

### Local AI chat
- Connect to a local Ollama server at `http://127.0.0.1:11434`.
- Check runtime availability and list installed models.
- Choose a model for chat, pull additional models, and remove installed models.
- Render assistant messages with Markdown and GitHub-Flavored Markdown formatting.

### Video Studio
- Import local video and audio files.
- Preview supported video formats and inspect media metadata.
- Extract audio to WAV using the FFmpeg media tools.
- Assemble a simple sequence of compatible clips into an output file.

**Media note:** Sequence export currently uses stream copy. Input clips generally need compatible codecs and stream properties; it is not a full nonlinear editor or a frame-accurate multi-track timeline.

### Desktop and voice foundations
- Use Electron's context-isolated preload bridge to expose specific desktop operations to the renderer.
- Launch a small allow-list of applications and open user-selected paths.
- Invoke an optional Piper text-to-speech bridge when its executable and voice model are available.
- Use the runtime helper's read-only request support for OpenAI-compatible, Anthropic, and Gemini APIs. A complete provider-configuration experience is not yet implemented in the settings UI.

### Built with
| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| Interface | React |
| Development server and bundler | Vite |
| Local model runtime | Ollama |
| Media processing | FFmpeg / FFprobe |
| Tests | Node.js built-in test runner |
| Packaging | electron-builder |

## 🚀 Quick start

### Prerequisites

- **Node.js 20+** (Node.js 22 LTS is recommended).
- **npm**, included with Node.js.
- **Ollama** installed locally for local AI chat.
- At least one Ollama model downloaded.
- Windows is the primary target. Packaging scripts for Linux and macOS are also defined, but should be validated on their target operating systems.

### 1. Get the source

Clone the repository and enter the project directory:

```bash
git clone https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source.git
cd CO-Agent-v0.6.1-enhanced-source
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start Ollama and download a model

Make sure Ollama is installed and running. To download a starter model, run:

```bash
ollama pull gemma3:4b
```

Model sizes and performance vary by hardware. Check available memory and disk space before downloading large models.

### 4. Launch CO-Agent

For development, start Vite and Electron together:

```bash
npm run dev
```

To build the renderer and launch the desktop app:

```bash
npm start
```

Open **Models & settings** in the app and refresh the runtime status. Select an installed model in the chat composer before sending a message.

## 🧰 Development

| Command | Purpose |
|---|---|
| `npm install` | Install project dependencies |
| `npm run dev` | Start the Vite development server and Electron |
| `npm test` | Run Node.js tests |
| `npm run build` | Build the renderer into `dist/` |
| `npm start` | Build the renderer and launch the desktop app |
| `npm run dist:win` | Build a Windows NSIS installer |
| `npm run dist:linux` | Build a Linux AppImage |
| `npm run dist:mac` | Build a macOS DMG |

Packaged application artifacts are configured to go into `release/`.

### Build the Windows installer

On Windows, run:

```powershell
npm install
npm test
npm run build
npm run dist:win
```

If a command fails, keep the **first complete error and stack trace**—later errors may only be consequences of the first failure.

## 🔧 Troubleshooting

### CO-Agent says Ollama is disconnected
1. Open Ollama and ensure it is running.
2. Visit `http://127.0.0.1:11434/api/version` in your browser to check the local service.
3. If no model is installed, run `ollama pull gemma3:4b` in a terminal.
4. Return to **Models & settings** and refresh the status.

### No model appears in the chat selector
- Confirm that Ollama is running.
- Run `ollama list` to inspect installed models.
- Refresh the runtime status in CO-Agent.
- Select the exact model tag shown by Ollama.

### The desktop window is blank or fails to open
1. Run `npm install` again if dependencies are missing.
2. Start with `npm run dev` from the repository root.
3. Check the terminal for the first Vite, Electron, or renderer error.
4. Confirm the configured development server is available at `http://127.0.0.1:5173`.

### Video tools are unavailable
- Check the **Video Studio** capability indicators.
- Ensure the platform-specific FFmpeg and FFprobe packages installed correctly.
- Try a supported media file. Some codecs and containers may not be supported by the installed FFmpeg build.
- For sequence exports, use clips with compatible streams; stream-copy joining does not automatically normalize different media formats.

### Voice synthesis does not work
The Piper bridge is optional. Install a compatible Piper executable and voice model, then configure the paths required by the synthesis module. Voice assets are not bundled with this repository.

## 🔐 Safety and privacy notes

- Local chat is sent to the Ollama service configured on your machine.
- If you use an external API provider, prompts may leave your device and be processed by that provider; review its privacy and retention policies first.
- The renderer receives a deliberately limited Electron bridge rather than unrestricted Node.js access.
- Desktop actions are intended to be restricted to allow-listed operations. Review code and permissions before using this project with sensitive files.
- AI-generated output can be incorrect. Verify generated content and review actions before relying on them.
- Keep API keys out of source control, issue reports, screenshots, and logs.

## 🗺️ Current status & roadmap

This repository currently includes a reconstructed local chat/model-management path, a basic media workspace, an Electron IPC bridge, a Piper integration point, smoke tests, and CI configuration.

The following capabilities are **not yet complete or should not be assumed to match the recovered original**:

- Byte-for-byte restoration of every original source file and dependency lockfile.
- Full native computer use, general mouse/keyboard control, screen capture, and OCR.
- The original advanced video timeline, multi-track editing, captions, and complete voiceover workflow.
- Streaming chat and live model-download progress in the interface.
- A complete UI for configuring and switching external API providers.
- End-to-end verification of every feature across supported operating systems.

See [RESTORE-ROADMAP.md](RESTORE-ROADMAP.md) for restoration details. The GitHub Actions workflow is configured to run tests and a renderer build; check the repository's **Actions** tab for the actual status of each run.

## 🤝 Contributing

Issues and focused pull requests are welcome. Helpful contributions include:

- Reproducible bug reports with OS, Node.js version, steps, and the first relevant error.
- Regression tests for runtime, Electron IPC, media processing, and packaging.
- Small, focused fixes that preserve the context-isolated desktop boundary.
- Documentation updates that distinguish tested functionality from planned functionality.

Before opening a pull request, run:

```bash
npm test
npm run build
```

## 📄 License

No license file has been confirmed in this repository. Until a license is added, do not assume the source is available for unrestricted reuse or redistribution.

---

<div align="center">

**CO-Agent 0.6.1** · Local-first desktop AI, under reconstruction

</div>
