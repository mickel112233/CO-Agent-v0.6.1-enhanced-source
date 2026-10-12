# Integration status — CO-Agent + AI Desktop Pet

Updated: 2026-10-12

## Current verified baseline
- Target codebase: CO-Agent desktop Electron + React/Vite.
- Development command in the project package manifest: `npm run dev`.
- Automated tests: `npm test`.
- Renderer production build: `npm run build`.
- Windows installer build: `npm run dist:win`.
- Existing project contains chat/agent runtime, integrations, computer-use services, timeline/video editor, and tests. Preserve these while extending them.

## Pet source
The user supplied `AI-Desktop-Pet-master.zip`. A local merged source archive was assembled and its files were preserved under `integrations/AI-Desktop-Pet/` in that archive. The pet project uses a Tauri/Rust architecture, so its overlay cannot be assumed to work inside Electron unchanged. Inspect its license, asset references, IPC, display geometry, and platform APIs before adapting. Do not copy its Tauri runtime into CO-Agent's runtime as a second competing app.

## Implemented in this branch (pending CI/runtime verification)
- Added a transparent, always-on-top Electron pet overlay with a narrow isolated preload, bounded text messages, navigation/window-open blocking, close/hide behavior, and a small built-in fallback companion UI.
- The overlay is launched by the main process and its text requests are routed to the existing CO-Agent chat renderer. This is a basic text bridge; voice, user-visible approval preview in the overlay, pet asset pack integration, and a true task-planning checkpoint are not yet implemented.
- Added source-level regression tests for overlay security settings and the chat bridge. These tests have been committed but have not yet been run in this environment.

## Not yet verified as integrated
These are requirements, not completed features:
- Actual Electron-native floating pet window using selected pet assets.
- Chat/voice bridge from overlay into CO-Agent's agent runtime.
- Advanced-only, chat-driven Video Studio where approved natural-language edit instructions mutate the real timeline.
- First-run setup flow that installs Ollama, required models, and LuxTTS with progress/retry/skip and re-prompts when dependencies are missing.
- Provider/API-key management for popular APIs with secret-safe storage.
- Safe repository/tool import scanner and approval-gated installer.
- Asset/sound-effect generation pipeline connected to timeline assets and verified exports.

## Security acceptance requirements
- No arbitrary shell execution from model output.
- Repository import must show origin, license, detected package managers, lifecycle scripts, permissions, network access, and files to be changed before approval.
- Dangerous operations (credential access, persistence, privilege elevation, deletion outside workspace, security setting changes) must be blocked or require a separate, explicit elevated confirmation; never bypass OS protections.
- Computer use: plan -> preview target/actions -> user approval -> execute -> verify outcome -> report.
- Pause/cancel invalidates pending model responses so late responses cannot continue execution.
- Installer should verify downloads and executable signatures/hashes where available.
- All operations need timeouts, cancellation, clear errors, and audit events with secrets redacted.

## Verification record
No runtime integration or end-to-end test is claimed by this document. The overlay code has source-level tests; confirm CI results and test on Windows before calling the overlay release-ready. Future agents must update this file with exact commands, results, and known failures after making changes.
