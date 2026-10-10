<div align="center">

# CO-Agent

### Your local-first desktop AI workspace

Chat with local models. Create and inspect media. Add optional tools. Import trusted GitHub skills when you need more capability.

**Electron · React · Ollama · FFmpeg · Tesseract OCR · Hyperframes · GitHub skill imports**

[![CI](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/mickel112233/CO-Agent-v0.6.1-enhanced-source?display_name=tag)](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/releases)
[![Version](https://img.shields.io/badge/app-0.6.1-informational)](package.json)

**[Quick start](#-quick-start) · [Integrations](#-integrations--optional-tools) · [Import a GitHub repo](#-import-a-github-repository) · [Architecture](#-project-map) · [Version history](#-version-history--rollback) · [AI-agent guide](AGENTS.md)**

</div>

---

> [!IMPORTANT]
> **Status: active reconstruction.** This repository is not a byte-for-byte restoration of the recovered original archive, and not every original feature is complete. Read [RESTORE-ROADMAP.md](RESTORE-ROADMAP.md) before assuming a feature is fully implemented. Check [GitHub Actions](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/actions) for the current verification status.

## ✨ What can CO-Agent do today?

| Capability | Available now | Boundary / requirement |
|---|---|---|
| Local AI chat | Chat through Ollama and select installed models | Ollama must be installed and running; responses currently do not stream |
| Multi-agent workflows | Local-model task planner, eight specialist roles, dependency-aware pipeline, reviewer/tester steps, structured results, and ten built-in skills | Each step is started by the user; local Ollama required; agent file proposals require separate approval |
| Workspace file tools | Select a project folder, browse/read context files, preview model-proposed full-file changes, and back up existing files before applying | Only selected files are sent to the local model; path traversal, symlinks, common secret files, and protected build/dependency folders are blocked |
| In-app terminal | Run project tests, renderer build, Git status/diff check, and dependency audit with live output | Fixed command presets only; native confirmation each run; project scripts still execute with your user permissions |
| Model management | Pull, list, and remove Ollama models | Downloads can be large; pull progress is not fully surfaced |
| Video Studio | Multi-track timeline for video/image overlays, separate audio clips, captions/title cards, clip trim/split/move, project save/load, preview, and FFmpeg MP4 render | Functional editing MVP; no transitions, keyframes, waveform editing, advanced color tools, or full original timeline parity |
| Image text extraction | Local Tesseract OCR for PNG/JPEG/TIFF/BMP/WebP | Optional Tesseract installation and language data |
| HTML-to-video | Hyperframes lint, preview, and MP4 rendering | Optional external Hyperframes CLI and FFmpeg |
| Repository skills | Import public GitHub repositories and inspect manifests; explicitly enable a detected `SKILL.md` for local chat | Imported plugin code is not executed; skills are third-party instructions and must be reviewed |
| Computer Use | Desktop screenshot capture, top-level Windows UI Automation inspection, optional local screenshot OCR, approved mouse click/text/key actions | Windows-only native input; one action per confirmation; no autonomous action loop or arbitrary shell execution |
| Voice foundation | Optional Piper wrapper | Piper executable and voice models are not bundled |

## ⬇️ Download a test build (Windows)

**You do not need to install Node.js or build from source to try a packaged Windows build.**

1. Open [**CO-Agent Windows Download — latest workflow runs**](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/actions/workflows/windows-download.yml).
2. Open the newest successful **CO-Agent Windows Download** run.
3. Under **Artifacts**, download **CO-Agent-Windows-…** and extract the downloaded artifact ZIP.
4. Run the included **CO-Agent Setup 0.6.1.exe** to install, or use the standalone app ZIP if you prefer not to run the installer.
5. Launch CO-Agent. For local chat, install and start [Ollama](https://ollama.com/) and pull a model such as `gemma3:4b`.

The workflow runs the automated tests, builds the renderer, packages the Windows installer and ZIP, verifies that both packages exist, and only then uploads the artifact. Tagged `v*` builds are also published to [GitHub Releases](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/releases). Unsigned test builds may trigger a Windows SmartScreen warning; only proceed if you trust the source.

> **Important:** a downloadable app is not the same as a feature-complete restoration. See [the known gaps](#-known-gaps) and [RESTORE-ROADMAP.md](RESTORE-ROADMAP.md).

### Prerequisites

- **Node.js 22 recommended**, npm, and Git.
- **Ollama** for local AI chat: [ollama.com](https://ollama.com/).
- Optional: Tesseract OCR, Hyperframes CLI, Piper and voice models.

<details>
<summary><strong>Install and run from source</strong></summary>

```bash
git clone https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source.git
cd CO-Agent-v0.6.1-enhanced-source
npm install
npm test
npm run build
npm run dev
```

Start Ollama separately and install a model, for example:

```bash
ollama pull gemma3:4b
```

The default Ollama endpoint is `http://127.0.0.1:11434`. CO-Agent does not install Ollama automatically.

</details>

<details>
<summary><strong>Useful npm scripts</strong></summary>

| Command | Action |
|---|---|
| `npm run dev` | Start Vite and Electron for development |
| `npm test` | Run Node's built-in test suite |
| `npm run build` | Build the renderer into `dist/` |
| `npm start` | Build and launch the local desktop app |
| `npm run dist:win` | Build Windows NSIS installer |
| `npm run dist:linux` | Build Linux AppImage |
| `npm run dist:mac` | Build macOS DMG (run on a supported macOS host) |

A successful renderer build does not prove external tools, all IPC flows, or platform packaging work. Check the CI run and test the specific feature you need.

</details>

## 🧠 Agents, workflows, and terminal

Open **Agents & terminal** in the sidebar. Describe the outcome you want, choose an installed local Ollama model, and create a 3–7 step workflow. The planner assigns specialist roles, skills, dependencies, deliverables, and acceptance criteria. Run each step individually; completed outputs become context for later steps. Available roles include lead planner, research analyst, implementation engineer, independent reviewer, test engineer, security reviewer, UX specialist, and documentation specialist.

Choose a project folder to let agents inspect selected context files and propose source changes. Proposed file contents are previewed in the UI. **Review and apply files** triggers a native confirmation; existing files are backed up in `.co-agent-backups`. Agent output is untrusted, and changes are not applied automatically.

The integrated terminal offers fixed commands: `npm test`, `npm run build`, `git status --short --branch`, `git diff --check`, and `npm audit --omit=dev`. Output streams into the terminal panel with exit status and timeout reporting. Each run requires native confirmation. These commands execute the selected project's scripts with your Windows account permissions, so only open workspaces you trust. The terminal does not accept arbitrary shell text. The chosen workspace is remembered for the next launch.

Built-in skills cover planning, implementation, code review, test engineering, debugging, security, Electron IPC, frontend UX, documentation, and media pipelines. These are task-specific instructions for the model, not magical tools: a skill cannot access a file unless you select it, and cannot claim a test passed unless the terminal actually ran it.

## 🖥️ Computer Use

Open **Computer Use** from the sidebar to capture your desktop, inspect top-level window names through Windows UI Automation, optionally read visible text with locally installed Tesseract, and send an individual mouse click, text entry, or allow-listed key.

- **Every input action requires a confirmation dialog.** Review the screenshot and approve only the specific action you intend.
- Clicks are bounded to the selected display and coordinates are scaled from the captured screenshot.
- Text entry is capped at 2,000 characters. Do not type passwords, API keys, or other secrets into the action field.
- Screen OCR is optional and runs locally through Tesseract. It may extract sensitive visible content, so use it only when you intend to read that screen.
- Native mouse/keyboard input and the UI Automation window list are currently supported on Windows with an interactive desktop. The local Ollama model can suggest a short plan from your task and optional OCR text, but CO-Agent does not execute long sequences autonomously, inspect full accessibility trees, or verify arbitrary app state automatically.

## 🎬 Multi-track Video Studio

Video Studio opens the timeline editor first. Import local video, audio, and image files, add assets to video/audio tracks, add title/caption clips, adjust source in-points and durations, move clips, split at the playhead, save/load `.coagent-project.json` project files, and render an MP4 through the bundled FFmpeg runtime when available.

The current renderer composites video and image clips on the timeline and mixes audio clips on the dedicated audio track. Source media stays where it is; project files store paths rather than copying all media into a project package. Keep source files available when reopening a project. This is a practical timeline MVP, not a claim of parity with Premiere/DaVinci or the recovered original editor: transitions, keyframes, effects, automatic captions/transcription, audio waveforms, undo/redo, and advanced color grading are still not implemented.

## 🧩 Integrations & optional tools

Open **CO-Agent → Integrations** to check optional tool status, install supported tools, read setup guides, and manage imported repositories.

The app deliberately keeps these integrations **optional**, rather than making every user download OCR, voice, or video-rendering runtimes. Install only what your workflow needs.

<details>
<summary><strong>Tesseract OCR — image to text</strong></summary>

Use this for screenshots, scanned pages, and still images. Recognition runs locally.

- On Windows, the Integrations screen can offer the `winget` installer when available.
- Otherwise, follow the [official Tesseract installation guide](https://tesseract-ocr.github.io/tessdoc/Installation.html).
- Install English language data for the default `eng` OCR mode.
- If it is installed outside common locations or `PATH`, set `TESSERACT_PATH` to the executable path before starting CO-Agent.

Supported extensions: PNG, JPG/JPEG, TIFF, BMP, and WebP. OCR accuracy depends on resolution, contrast, rotation, and language data.

</details>

<details>
<summary><strong>Hyperframes — HTML/CSS/animation to MP4</strong></summary>

Hyperframes is useful for animated titles, product explainers, motion graphics, and web-based video compositions. It is separate from the basic FFmpeg sequence-join feature.

```bash
npm install -g hyperframes
hyperframes --version
ffmpeg -version
```

You can also install Hyperframes from the Integrations screen when Node.js/npm are available. In Video Studio, select a project folder containing `index.html`, then run **Lint**, **Preview**, or **Render MP4**. The current integration writes `co-agent-render.mp4` into that project folder.

See the [Hyperframes CLI documentation](https://hyperframes.app/docs/5-packages/cli) for supported commands and setup.

</details>

<details>
<summary><strong>Piper TTS — optional local speech</strong></summary>

Piper is not a required dependency. Its executable and voice assets are not bundled, so follow the [Piper project instructions](https://github.com/rhasspy/piper) and configure the runtime/voice files for your environment.

</details>

## 📦 Import a GitHub repository

CO-Agent has an **Integrations & plugins** section for importing useful community skills and repositories without immediately executing third-party code.

1. Open **Integrations → Import repository**.
2. Paste a public HTTPS GitHub URL, such as `https://github.com/owner/repo`.
3. Optionally enter a branch, tag, or ref to pin the source.
4. Review the detected `SKILL.md`, `package.json`, and/or `openclaw.plugin.json` information.
5. If a `SKILL.md` is detected, explicitly enable **Use this skill in local chat** only after reviewing its content.

<details>
<summary><strong>What the repository importer does — and does not do</strong></summary>

**It does:**

- Clone a public GitHub repository into CO-Agent's user-data `extensions/` directory.
- Record its source URL and selected ref.
- Inspect known manifests and identify a root `SKILL.md`.
- Let you opt a detected skill into local Ollama chat context, with a limit of eight selected skills.
- Let you remove imported repositories from the managed extensions folder.

**It does not:**

- Run `npm install`, lifecycle scripts, binaries, or plugin code.
- Automatically activate arbitrary OpenClaw plugins or install dependencies.
- Guarantee that a third-party skill is safe or correct.
- Currently support private repositories, other Git hosts, local folders, or plugin runtime activation.

Imported skills are untrusted instructions. Review them first, never paste secrets into them, and don't allow their content to override security boundaries. Importing a repository is not the same as enabling executable plugin code.

This is a conservative first step inspired by repository/skill workflows in tools such as OpenClaw; it is not a clone of OpenClaw's full plugin runtime. See [OpenClaw's skills guide](https://github.com/openclaw/openclaw/blob/main/docs/tools/skills.md) for its distinct skill model and trust considerations.

</details>

## 🗺️ Project map

| Path | Purpose |
|---|---|
| `electron/main.cjs` | Electron lifecycle, IPC dispatch, Ollama chat |
| `electron/preload.cjs` | Allow-listed context-isolated renderer API |
| `electron/ollama.cjs` | Local Ollama status and model management |
| `electron/agent-runtime.cjs` | Read-only API subagent request helper |
| `electron/agent-orchestrator.cjs` | Local multi-agent planner, specialist roles, built-in skills, and structured workflow steps |
| `electron/workspace.cjs` | Guarded project file context, approved file writes with backups, and allow-listed terminal commands |
| `electron/studio.cjs` | FFmpeg/FFprobe media helpers |
| `electron/timeline.cjs` | Timeline project validation, save/load, and FFmpeg rendering |
| `electron/computer-use.cjs` | Approval-gated desktop capture, Windows input, accessibility inspection, and optional screen OCR |
| `electron/ocr.cjs` | Tesseract discovery and OCR |
| `electron/hyperframes.cjs` | Hyperframes CLI integration |
| `electron/integrations.cjs` | Optional tool checks/installers, GitHub repository import and skill loading |
| `src/App.jsx` | Main chat, navigation and model settings |
| `src/Agents.jsx` | Multi-agent pipeline, context-file selection, proposal review, and live terminal UI |
| `src/VideoEditor.jsx` | Basic media utilities and Video Studio mode switch |
| `src/TimelineEditor.jsx` | Multi-track timeline, project controls, clip inspector and export UI |
| `src/ComputerUse.jsx` | Desktop screenshot, OCR, accessibility and approval-gated input UI |
| `src/Integrations.jsx` | Optional tools, GitHub repository import and skill selection UI |
| `src/styles.css` | Renderer styles |
| `test/` | Automated service and validation tests |
| `.github/workflows/ci.yml` | Windows/Ubuntu tests and renderer build |
| `.github/workflows/windows-download.yml` | Tests and packages downloadable Windows installer + ZIP on pushes and manual runs |
| `.github/workflows/release.yml` | Tagged Windows/Linux release packaging workflow |
| `AGENTS.md` | Fast onboarding guide for AI coding agents |
| `docs/VERSIONING.md` | Find older versions, create checkpoints, roll back |
| `RESTORE-ROADMAP.md` | Implementation status and known gaps |

### Handy developer commands

```bash
npm test
npm run build
```

Before opening a pull request, test the changed feature, add regression coverage, and update documentation. Read [AGENTS.md](AGENTS.md) before using an AI coding assistant to modify this repository.

## 🕰️ Version history & rollback

Every Git commit is a recoverable snapshot. Tags and releases make stable checkpoints easier to identify.

[**Browse commits**](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/commits/main/) · [**Browse tags**](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/tags) · [**Browse releases**](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/releases) · [**Open Actions**](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/actions)

<details>
<summary><strong>Check out an older version safely</strong></summary>

```bash
git fetch --all --tags
git log --oneline --decorate --graph -30
git switch --detach <commit-sha-or-tag>
```

To continue developing from an older snapshot, create a new branch:

```bash
git switch -c investigate/older-version <commit-sha-or-tag>
```

To undo a change on shared history, prefer `git revert <commit-sha>`. Avoid `git reset --hard` or force-pushing shared history unless you intentionally accept the risk.

A named checkpoint is available at [`checkpoint/v0.6.1-before-tool-integrations`](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/tree/checkpoint/v0.6.1-before-tool-integrations). Read [docs/VERSIONING.md](docs/VERSIONING.md) for checkpoint and release instructions.

</details>

## 🔐 Security and privacy

- Keep Electron context isolation enabled and Node integration disabled.
- Expose only reviewed IPC methods through the preload bridge.
- Do not pass arbitrary user-provided commands into a shell.
- Local Ollama chat and Tesseract OCR are local by default; configured API providers send prompt data to their remote service.
- Repository imports are restricted to public HTTPS GitHub URLs and are not executed automatically.
- Never commit API keys, credentials, private media, downloaded models, build outputs, or `node_modules`.

## 🧭 Known gaps

- Full original source restoration is not complete; see [RESTORE-ROADMAP.md](RESTORE-ROADMAP.md).\n- Computer Use is a Windows-only, one-action-at-a-time MVP; autonomous planning, deep accessibility trees, and automatic action verification are not yet implemented.\n- The timeline editor supports core clip arrangement and rendering, but transitions, keyframes, waveforms, undo/redo, advanced effects, and automatic transcription/captions are not yet implemented.
- Chat does not yet stream tokens; Ollama model-pull progress is not fully surfaced.
- The multi-track editor is not yet a full professional NLE; see the video-editor limitations above.
- Full API-provider configuration/credential management is incomplete.
- Imported generic plugin code is not activated. Only explicitly selected `SKILL.md` text can be loaded into local chat.
- Tesseract, Hyperframes, Piper, and Piper voice assets are optional external dependencies.

## 🤝 Contributing

1. Read [AGENTS.md](AGENTS.md) and [RESTORE-ROADMAP.md](RESTORE-ROADMAP.md).
2. Use a branch for substantial changes.
3. Add tests for service behavior, validation, and failure paths.
4. Run `npm test` and `npm run build`, and report any command that could not be run.
5. Keep commits focused and update docs when setup or behavior changes.

## License

A repository license has not been confirmed. Until a license is added, do not assume unrestricted reuse, redistribution, or relicensing is permitted.
