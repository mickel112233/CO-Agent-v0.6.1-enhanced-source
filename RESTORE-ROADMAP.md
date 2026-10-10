# v0.6.1 restoration and implementation status

This repository is an active reconstruction. The current source now includes practical computer-use controls and a first multi-track editor implementation, but it is not a byte-for-byte restoration and is not feature-complete.

## Implemented in this branch

- Electron main process and context-isolated preload bridge.
- Local Ollama status, model pull/delete, and non-streaming chat path.
- Optional API-provider read-only helper for OpenAI-compatible, Anthropic, and Gemini endpoints.
- Media probing, WAV extraction, compatible-clip concat, and FFmpeg capability checks.
- **Multi-track timeline MVP:** video and image clips positioned on a timeline, separate audio clips, title/caption overlays, source in-point and duration editing, move/split/remove operations, local project save/load (.coagent-project.json), preview, and FFmpeg MP4 rendering.
- **Computer-use MVP:** desktop screenshot capture, selected-display coordinate mapping, Windows top-level UI Automation window inspection, optional local Tesseract OCR of a captured screen, and explicit-approval mouse click, text input, and allow-listed keypresses.
- Optional Tesseract OCR for still images and screenshots.
- Optional Hyperframes CLI discovery, project validation, lint, preview launch and MP4 render.
- Integrations screen with optional-tool status and user-confirmed Windows Tesseract / npm Hyperframes installers.
- Public HTTPS GitHub repository import with optional ref pinning, manifest detection, managed removal, and explicit opt-in for SKILL.md content in local Ollama chat.
- Security checks for GitHub-only URLs, ref validation, safe process argument passing, imported manifest symlink rejection, and bounded skill content.
- Local model selection/management UI and runtime diagnostics.
- GitHub Actions packaging workflow that tests the app, builds a Windows NSIS installer and ZIP, verifies that both exist, and uploads them as a downloadable artifact; version tags publish release assets.

## Computer-use behavior and safety boundaries

Computer Use is a manual, safety-gated control surface, not a background takeover agent. Each mouse, text, or key action requires its own confirmation. Native input and accessibility-window inspection require Windows and an interactive desktop session. Screen OCR requires optional Tesseract and only runs after the user initiates it.

Still unfinished: model-generated action planning, multi-step autonomous loops, stop/pause orchestration, full UI Automation element trees and element-level actions, semantic target selection, automatic post-action verification, app-specific adapters, and richer permission controls. No arbitrary shell/PowerShell command execution is exposed to the renderer.

## Multi-track video editor behavior and boundaries

Video Studio opens the timeline editor by default. It supports video/image overlays at timeline positions, audio clips on a separate audio track, caption/title clips, source trim-in, duration, track reassignment, moving, splitting at the playhead, removal, project save/load, local preview, and FFmpeg MP4 rendering. Project files keep source paths; they do not bundle media.

Still unfinished: transitions, keyframes, effects, transforms, advanced audio routing, audio from video clips in the timeline mix, waveforms, snapping, drag-and-drop trim handles, undo/redo, proxy media, automatic transcription/captions/voiceover, color grading, render progress/cancel, and full original-editor parity. The current renderer should be tested against the codecs and media files a user intends to edit.

## Download and test

Open [the Windows Download workflow](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/actions/workflows/windows-download.yml), select the latest successful run, and download the CO-Agent-Windows-… artifact. Extract its ZIP to access the installer and standalone ZIP package. A run is not downloadable until the workflow finishes successfully and the artifact appears.

The source workflow runs npm test, npm run build, and npx electron-builder --win nsis zip --x64 --publish never. The packaging job is separate from cross-platform CI and must succeed before its artifact should be considered ready to test.

## Optional tool requirements

- **Tesseract:** installed separately with trained language data; set TESSERACT_PATH if it is not on PATH or in a common Windows install location.
- **Hyperframes:** external CLI, Node.js, and FFmpeg. It is not silently downloaded or bundled by CO-Agent. Video Studio's Hyperframes panel expects a project folder with index.html.
- **FFmpeg:** used for the timeline renderer and media utilities. The package declares ffmpeg-static; verify runtime availability on the target platform.
- **Ollama:** required for the current local chat path; it is not automatically installed or bundled.
- **Piper:** optional manual setup; the executable and voice models are not bundled.

## Repository integration boundaries

The repository importer is intentionally a safe first-stage workflow rather than a full generic plugin runtime. It supports public HTTPS GitHub repositories only. Imported files are stored under Electron user data in extensions/; the app does not execute imported code or automatically run package lifecycle scripts. A root SKILL.md can be explicitly enabled and included in local Ollama chat context, with bounded size/count and an untrusted-content warning. Generic OpenClaw plugins, dependency installation, private repositories, and arbitrary Git hosts are not activated/supported.

## Verification

- Cross-platform CI: [GitHub Actions](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/actions/workflows/ci.yml).
- Windows packaging and download artifact: [Windows Download workflow](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/actions/workflows/windows-download.yml).
- Versioned release assets: [GitHub Releases](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/releases).

Do not claim a package is ready unless the corresponding workflow run succeeded and the artifact exists.
