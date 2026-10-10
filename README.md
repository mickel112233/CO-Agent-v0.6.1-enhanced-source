<div align="center">

# CO-Agent

### A local-first AI workspace for desktop

Bring local AI chat, media utilities, image text extraction, and agent-friendly video rendering workflows together in one desktop app.

**Electron · React · Vite · Ollama · FFmpeg · Tesseract OCR · Hyperframes**

[Quick start](#-quick-start) · [Features](#-capabilities) · [Optional tools](#-optional-tool-integrations) · [Architecture](#-repository-map) · [Versions](docs/VERSIONING.md) · [AI onboarding](AGENTS.md)

[![CI](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.6.1-informational)](package.json)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey)](package.json)

</div>

---

> [!IMPORTANT]
> **Project status: active reconstruction.** This repository restores a working integration path and adds new optional integrations, but it is **not a byte-for-byte restoration** of the recovered archive and does not yet reproduce every original feature. Read [the restoration roadmap](RESTORE-ROADMAP.md). Features listed here describe the code currently present; they are not a promise that every environment is configured.

## ✨ Capabilities

| Area | Current capability | Important boundary |
|---|---|---|
| Local AI | Chat through a local Ollama server; list, pull, and remove models | Chat is currently non-streaming |
| API runtime helper | Read-only requests for supported OpenAI-compatible, Anthropic, and Gemini protocols | Full provider setup UI and secure credential management are not finished |
| Video Studio | Import media, preview clips, inspect metadata, extract WAV audio, join compatible clips | Simple sequence assembly, not a full nonlinear editor |
| Image text extraction | Run local Tesseract OCR on PNG, JPEG, TIFF, BMP, and WebP images | Requires a separate Tesseract install and language data |
| Agent-friendly video | Lint, preview, and render existing Hyperframes HTML projects | Requires a separate Hyperframes CLI and FFmpeg |
| Desktop bridge | Context-isolated, allow-listed IPC; a small explicit application launch allow-list | Not general-purpose computer-use automation |
| Voice foundation | Optional Piper text-to-speech process wrapper | Executable and voice assets are not bundled |
| Packaging | electron-builder configuration for Windows NSIS, Linux AppImage, and macOS DMG | CI/release workflow currently packages Windows and Linux |

## 🚀 Quick start

### Requirements

- **Node.js 22 recommended** (Vite/Electron development and optional Hyperframes).
- npm and Git.
- **Ollama** for local chat: [ollama.com](https://ollama.com/).
- Optional: Tesseract OCR for image text extraction.
- Optional: Hyperframes CLI + FFmpeg for HTML-based video rendering.

### Install and run

```bash
git clone https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source.git
cd CO-Agent-v0.6.1-enhanced-source
npm install
npm test
npm run build
npm run dev
```

Start Ollama separately, then download a model, for example:

```bash
ollama pull gemma3:4b
```

CO-Agent currently expects Ollama at `http://127.0.0.1:11434` by default. The app can list installed models and request pulls/removals from Ollama; it does not automatically install Ollama itself.

### Useful scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite and launch the Electron app |
| `npm test` | Run Node's built-in test suite |
| `npm run build` | Build the renderer into `dist/` |
| `npm start` | Build and launch the packaged-style local app |
| `npm run dist:win` | Build a Windows NSIS installer |
| `npm run dist:linux` | Build a Linux AppImage |
| `npm run dist:mac` | Build a macOS DMG (run on a supported macOS host) |

A successful Vite build only verifies the renderer bundle. It does not prove that Ollama, Tesseract, Hyperframes, native packaging, or every desktop workflow works on your machine.

## 🧰 Optional tool integrations

These tools are intentionally **optional external dependencies**. CO-Agent does not silently download them or bundle their full runtimes.

### Tesseract OCR

Tesseract extracts text from image files locally on your computer. In **Video Studio → Image text extraction**, choose an image to read and copy the recognized text.

1. Install Tesseract OCR and the language data you need. On Windows, the [Tesseract installation guide](https://tesseract-ocr.github.io/tessdoc/Installation.html) links to the UB Mannheim installers.
2. Make sure the `eng` language data is installed for the default English OCR mode.
3. Restart CO-Agent. The app checks common Windows install locations and your system `PATH`.
4. If the executable is installed elsewhere, set `TESSERACT_PATH` to the full executable path before launching CO-Agent.

Supported image extensions: PNG, JPG/JPEG, TIFF, BMP, and WebP. OCR is local; recognition quality depends on image resolution, contrast, rotation, and installed language data.

### Hyperframes

[Hyperframes](https://github.com/heygen-com/hyperframes) turns HTML/CSS, media, and seekable animations into deterministic MP4 video. CO-Agent uses the external CLI to lint, preview, and render a project rather than embedding the full Hyperframes source tree.

Requirements: Node.js 22+, FFmpeg, and the Hyperframes CLI. Install it globally so the `hyperframes` command is available:

```bash
npm install -g hyperframes
hyperframes --version
ffmpeg -version
```

Then:

1. Create or open an existing project using the [Hyperframes quickstart](https://hyperframes.app/docs/1-startup/2-quickstart).
2. In CO-Agent, open **Video Studio → Hyperframes video renderer**.
3. Choose the project folder containing `index.html`.
4. Use **Lint project**, **Preview**, or **Render MP4**. The render output is written to `co-agent-render.mp4` inside the selected project folder.

The Hyperframes CLI is an external process. A preview starts separately; inspect its browser/terminal output if it fails to launch. Hyperframes rendering is separate from the built-in FFmpeg sequence-join button.

## 🧭 Repository map

| Path | What it owns |
|---|---|
| `electron/main.cjs` | Electron lifecycle, IPC handlers, app window |
| `electron/preload.cjs` | Explicit, context-isolated `window.coAgent` API |
| `electron/ollama.cjs` | Ollama status, model management, model-name validation |
| `electron/agent-runtime.cjs` | Read-only API subagent requests |
| `electron/studio.cjs` | FFmpeg/FFprobe operations |
| `electron/ocr.cjs` | Tesseract discovery and OCR |
| `electron/hyperframes.cjs` | Hyperframes CLI status, project validation, lint/preview/render |
| `electron/computer.cjs` | Small explicit app launch/open allow-list |
| `electron/piper.cjs` | Optional Piper voice synthesis wrapper |
| `src/App.jsx` | Main chat and runtime UI |
| `src/VideoEditor.jsx` | Video Studio and optional tool controls |
| `src/styles.css` | Renderer styles |
| `test/` | Automated service and validation tests |
| `.github/workflows/ci.yml` | Windows/Ubuntu test and renderer-build matrix |
| `.github/workflows/release.yml` | Build and publish release artifacts for pushed version tags |
| `AGENTS.md` | Fast onboarding guide for AI coding agents |
| `docs/VERSIONING.md` | How to find older commits, create checkpoints, and roll back |
| `RESTORE-ROADMAP.md` | Current restoration status and known gaps |

For AI assistants, start with [AGENTS.md](AGENTS.md), then read [RESTORE-ROADMAP.md](RESTORE-ROADMAP.md) and the relevant service/tests before editing.

## 🧪 Testing and CI

Run locally:

```bash
npm test
npm run build
```

GitHub Actions runs tests and the Vite production build on Windows and Ubuntu for pushes to `main` and pull requests. Confirm the latest run is green before describing a commit as verified. A green renderer build is not equivalent to testing all optional external tools.

## 🕰️ Past versions, releases, and rollback

You can inspect **any commit** in Git history. Version tags and GitHub Releases make important milestones easier to revisit.

- [Commit history](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/commits/main/)
- [Tags](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/tags)
- [Pre-integration checkpoint branch](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/tree/checkpoint/v0.6.1-before-tool-integrations)
- [Releases](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/releases)
- [Version and rollback guide](docs/VERSIONING.md)

To inspect an earlier snapshot without altering your current branch:

```bash
git fetch --all --tags
git log --oneline --decorate --graph -30
git switch --detach <commit-sha-or-tag>
```

To continue working from it, create a branch with `git switch -c investigate/older-version <commit-sha-or-tag>`. Prefer `git revert` to undo shared commits; avoid force-pushing or resetting shared history. Before risky work, commit a checkpoint and create a unique version tag. Pushing a `vX.Y.Z` tag triggers the release workflow described in [VERSIONING.md](docs/VERSIONING.md).

## 🔐 Security and privacy notes

- Keep Electron's context isolation enabled and Node integration disabled in the renderer.
- Only expose named, reviewed IPC operations through the preload bridge.
- Do not pass arbitrary command strings to shell processes. External tools should be called with fixed actions and validated inputs.
- Local OCR and Ollama requests run against local services; API provider requests, when used, send prompt data to the configured provider.
- Never commit API keys, credentials, personal media, downloaded models, build outputs, or `node_modules`.

## 🗺️ Known gaps

- This is not yet a complete restoration of the recovered original project.
- Full native computer control, general screen capture/OCR automation, and broad app automation are not implemented.
- The built-in media workflow is basic sequence assembly, not a full multi-track nonlinear editor with captions and motion graphics.
- Chat does not yet stream tokens; model-pull progress is not fully surfaced in the UI.
- Full API provider configuration/settings and robust credential storage are incomplete.
- Tesseract and Hyperframes are external optional tools, not bundled app dependencies.
- Piper executable and voice assets are not bundled.

See [RESTORE-ROADMAP.md](RESTORE-ROADMAP.md) for the current implementation boundary and future work.

## 🤝 Contributing

1. Read [AGENTS.md](AGENTS.md) and the roadmap.
2. Keep changes focused and add tests for service behavior and validation.
3. Run `npm test` and `npm run build`; report any command you could not run.
4. Update documentation when setup or capabilities change.
5. Use a branch and pull request for substantial changes.

## License

No repository license file has been confirmed yet. Until a license is added, do not assume the project is open for unrestricted reuse, redistribution, or relicensing.
