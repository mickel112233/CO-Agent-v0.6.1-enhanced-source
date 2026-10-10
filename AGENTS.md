# AI Agent Onboarding: CO-Agent

Read this file before changing code. It is a fast orientation guide for coding agents and maintainers.

## Project identity and truth

- Product: **CO-Agent**, Windows-first Electron desktop workspace.
- Package version: `0.6.1`; package name: `co-agent-desktop`.
- Stack: Electron + React + Vite, local Ollama chat/model management, FFmpeg/FFprobe media helpers, optional Tesseract OCR, optional Hyperframes CLI.
- This branch is a **reconstruction**, not a byte-for-byte restoration of the recovered archive. Consult [RESTORE-ROADMAP.md](../RESTORE-ROADMAP.md) before describing completeness.
- Never claim a test/build passed unless you ran it or the GitHub Actions run is green.

## Repository map

| Path | Responsibility |
| --- | --- |
| `electron/main.cjs` | Electron main process, window creation, IPC handlers and app lifecycle |
| `electron/preload.cjs` | Context-isolated, allow-listed `window.coAgent` bridge |
| `electron/ollama.cjs` | Ollama availability, model list/pull/delete helpers |
| `electron/agent-runtime.cjs` | Read-only API subagent requests for supported provider protocols |
| `electron/studio.cjs` | FFmpeg/FFprobe probe, audio extraction and compatible-stream concat |
| `electron/ocr.cjs` | Optional local Tesseract CLI discovery and image OCR |
| `electron/hyperframes.cjs` | Optional Hyperframes CLI status, lint, preview and render |
| `electron/integrations.cjs` | Optional tool status/installers, safe GitHub repo import, manifest inspection, selected skill loading and managed removal |
| `electron/computer.cjs` | Small explicit allow-list of desktop app launch/open operations |
| `electron/piper.cjs` | Optional Piper text-to-speech process wrapper |
| `src/App.jsx` | Main chat, navigation, Ollama model/runtime UI |
| `src/VideoEditor.jsx` | Video Studio, basic media assembly, OCR and Hyperframes controls |
| `src/Integrations.jsx` | Optional tool manager, public GitHub repo import, manifest review and explicit skill selection |
| `src/styles.css` | Shared renderer styles |
| `test/*.test.cjs` | Node built-in test suite |
| `.github/workflows/ci.yml` | Windows and Ubuntu test/build matrix |
| `RESTORE-ROADMAP.md` | Reconstruction status and known gaps |
| `docs/VERSIONING.md` | Tags, releases, restore and rollback workflow |

## Data and execution flow

1. Renderer code calls a named method on `window.coAgent`.
2. `electron/preload.cjs` maps that method to a fixed IPC channel.
3. `electron/main.cjs` validates/dispatches the operation and returns a structured result.
4. Service modules invoke local processes with argument arrays (avoid shell string construction and never pass arbitrary user-provided commands).
5. UI reports errors rather than pretending unavailable optional tools are installed.

**Security rules:** keep `contextIsolation: true`, `nodeIntegration: false`, and the preload API allow-listed. Do not expose raw `ipcRenderer`, `require`, shell execution, arbitrary command execution, or arbitrary filesystem access to the renderer. Keep external URLs restricted. Treat file paths as user-selected input and use `execFile`/argument arrays where possible.

## Setup and verification

Requirements: Node.js 22 recommended, npm, and Git. Ollama is needed for local chat. FFmpeg is bundled through npm packages for the built-in media helpers. Tesseract and Hyperframes are optional separate installs.

```bash
npm install
npm test
npm run build
npm run dev
```

On Windows, run these commands from the repository root. `npm run dev` launches Vite and Electron; `npm run build` validates the renderer bundle but does not prove every native desktop feature works.

## Optional integrations and repository skills

- Tesseract OCR and Hyperframes are optional; the Integrations UI checks status and can invoke supported package managers after explicit user confirmation.
- GitHub imports accept public HTTPS GitHub owner/repository URLs only. Optional branch/tag refs are passed as a distinct argument to Git, never through a shell command.
- Imported repositories live in the Electron user-data `extensions/` folder. The importer detects `SKILL.md`, `package.json`, and `openclaw.plugin.json`, but does not run install scripts, install dependencies, or activate arbitrary plugin code.
- Only explicitly selected `SKILL.md` files are included in local Ollama chat context. Limit: eight skills, each capped at 30 KB, combined skill context capped at 60 KB.
- Treat imported skill instructions as untrusted. Do not add automatic execution of repository scripts without a separate review/approval design, path validation, and tests.
- Keep manifest reads inside the imported repository and reject symlinks for files that will be parsed or sent to the model.


### Tesseract OCR

Install Tesseract and its English language data. The service checks common Windows install locations plus `PATH`; set `TESSERACT_PATH` to the executable when installed elsewhere. Video Studio's Image text extraction action recognizes PNG/JPEG/TIFF/BMP/WebP locally. The OCR language defaults to `eng`; a language must also be installed in Tesseract's `tessdata`.

### Hyperframes

Install Node.js 22+ and FFmpeg, then install/use the Hyperframes CLI separately. In Video Studio choose an existing Hyperframes project folder with `index.html`, then use Lint, Preview, or Render MP4. Render output is `co-agent-render.mp4` inside that project folder. This optional CLI is not silently downloaded or bundled by CO-Agent. Check upstream docs for current installation requirements: https://hyperframes.app/docs/1-startup/2-quickstart

## Change workflow for AI agents

1. Read this file, `README.md`, `package.json`, and `RESTORE-ROADMAP.md`.
2. Inspect the exact modules and tests affected; don't assume the original archive and reconstructed branch are identical.
3. Make the smallest coherent change. Keep Electron service contracts testable outside Electron where possible.
4. Add tests for behavior, validation and error paths.
5. Run `npm test` and `npm run build` where a local runtime is available. If you cannot run them, state that explicitly.
6. Update docs whenever behavior, setup, security boundaries, or limitations change.
7. Keep commits focused and avoid committing secrets, API keys, downloaded models, generated video, `node_modules`, or user media.
8. Prefer a new branch and PR for broad architectural changes. Use version tags for stable checkpoints; see [VERSIONING.md](VERSIONING.md).

## Current important limitations

- Chat is a non-streaming Ollama request path; complete API-provider configuration is not implemented in the UI.
- Built-in sequence export is a simple FFmpeg stream-copy concat, not a nonlinear editor.
- Hyperframes is an optional external CLI; it is not vendored into this repository.
- Tesseract is an optional external executable; it is not bundled.
- General-purpose screen capture/OCR-based computer use, full native automation, advanced multi-track timeline/captions, and full restoration of the original source are not complete.
