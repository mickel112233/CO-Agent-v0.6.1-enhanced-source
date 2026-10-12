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
No runtime integration or end-to-end test is claimed by this document. Future agents must update this file with exact commands, results, and known failures after making changes.
