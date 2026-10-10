# v0.6.1 restoration and integration status

This repository is an active reconstruction. The packaged app is intended to be testable, but it is not a byte-for-byte restoration of the recovered archive and should not be described as feature-complete.

## Implemented in this branch

- Electron main process and context-isolated preload bridge.
- Local Ollama status, model pull/delete, and non-streaming chat path.
- Local file selection, media probing, WAV extraction, and compatible-clip concat.
- Video Studio with media bin, preview, metadata and basic export controls.
- Optional Tesseract CLI discovery and local OCR for common image formats.
- Optional Hyperframes CLI discovery, project validation, lint, preview launch and MP4 render.
- Integrations screen with optional-tool status and user-confirmed Windows Tesseract / npm Hyperframes installers.
- Public HTTPS GitHub repository import with optional ref pinning, manifest detection, managed removal, and explicit opt-in for `SKILL.md` content in local Ollama chat.
- Security checks for GitHub-only URLs, ref validation, safe process argument passing, imported manifest symlink rejection, and bounded skill content.
- Local model selection/management UI and runtime diagnostics.
- Read-only API subagent helper for OpenAI-compatible, Anthropic, and Gemini endpoints.
- Desktop app launch restrictions and service smoke tests.
- AI-agent repository map and version/rollback documentation.
- GitHub Actions packaging workflow that tests the app, builds a Windows NSIS installer and ZIP, verifies that both exist, and uploads them as a downloadable artifact; version tags publish release assets.

## Download and test

Open [the Windows Download workflow](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/actions/workflows/windows-download.yml), select the latest successful run, and download the `CO-Agent-Windows-…` artifact. Extract its ZIP to access the installer and standalone ZIP package. A run is not downloadable until the workflow finishes successfully and the artifact appears.

The source workflow runs `npm test`, `npm run build`, and `npx electron-builder --win nsis zip --x64 --publish never`. The packaging job is separate from the cross-platform CI workflow and must succeed before its artifact should be considered ready to test.

## Still required for a true full match

The recovered archive contained larger original source files and components that are not yet restored byte-for-byte, including the original full React interface and timeline editor, complete original stylesheet, original Electron backend modules, dependency lockfile, remaining tests, and research/capability documents. Several modules now contain a fresh compatible implementation rather than the archived original.

Full native computer-use automation, screenshot-driven/OCR computer control, the original advanced timeline editor, captions/voiceover tooling, download progress streaming in the UI, and full API-provider settings remain unfinished. The current Windows build is a testable reconstruction, not proof that those features exist.

## Optional tool requirements

- **Tesseract:** installed separately with trained language data; set `TESSERACT_PATH` if it is not on PATH or in a common Windows install location.
- **Hyperframes:** external CLI, Node.js 22+, and FFmpeg. It is not silently downloaded or bundled by CO-Agent. Video Studio expects a project folder with `index.html`; render output is `co-agent-render.mp4` in that folder.
- **Ollama:** required for the current local chat path; it is not automatically installed or bundled.
- **Piper:** optional manual setup; the executable and voice models are not bundled.

## Repository integration boundaries

The repository importer is intentionally a safe first-stage workflow rather than a full generic plugin runtime. It supports public HTTPS GitHub repositories only. Imported files are stored under Electron user data in `extensions/`; the app does not execute imported code or automatically run package lifecycle scripts. A root `SKILL.md` can be explicitly enabled and included in local Ollama chat context, with bounded size/count and an untrusted-content warning. Generic OpenClaw plugins, dependency installation, private repositories, and arbitrary Git hosts are not activated/supported.

The Integrations screen can invoke the Windows Tesseract installer through winget and install Hyperframes through npm after the user confirms. These tools remain optional. Piper remains manual setup.

## Verification

- Cross-platform CI: [GitHub Actions](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/actions/workflows/ci.yml).
- Windows packaging and download artifact: [Windows Download workflow](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/actions/workflows/windows-download.yml).
- Versioned release assets: [GitHub Releases](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/releases).

Do not claim a package is ready unless the corresponding workflow run succeeded and the artifact exists.
