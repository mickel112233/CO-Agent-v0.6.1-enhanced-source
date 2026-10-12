# Next agent tasks

Implement in small reviewable commits, in this order.

## 1. Pet asset and license audit
- Inventory all assets and source files from the supplied pet project.
- Record license and attribution requirements.
- Identify default pet asset and confirm it can be redistributed.
- Acceptance: assets are referenced by stable paths, license notes are included, no broken asset URLs.

## 2. Electron pet overlay
- Create a dedicated transparent, frameless, always-on-top Electron BrowserWindow with safe bounds and display-change handling.
- Expose only narrow preload APIs; keep `contextIsolation: true`, `nodeIntegration: false`, and a strict navigation allowlist.
- Add show/hide, drag, click-through toggle, and a clear way to close/disable the pet.
- Acceptance: overlay opens/closes without restarting CO-Agent, stays within monitor bounds, and never gains arbitrary Node access.

## 3. Overlay chat/voice bridge
- Route user-authored text to the same agent runtime and workspace context as main chat.
- Show the planned task and approval request in the main app before computer input.
- Add speech input only after explicit opt-in and a visible listening state.
- Acceptance: overlay chat creates a normal persisted conversation/task; cancel stops execution and prevents late results.

## 4. First-run model and voice setup
- Add a persistent setup state machine: Ollama -> model downloads -> LuxTTS -> optional integrations -> ready.
- Make progress truthful, cancellable, resumable, and retryable. Skip is allowed, but missing dependencies should reopen a contextual setup prompt when needed.
- Support API-only configuration when user chooses it.
- Acceptance: fresh profile, partial install, failed download, offline mode, and skipped setup are tested.

## 5. Advanced chat-driven Video Studio
- Remove the basic/advanced mode split; make the advanced workspace the only mode.
- Keep chat, preview, media/effects browser, and editable multitrack timeline visible together.
- Parse user requests into a structured edit proposal, preview exact changes, obtain approval for destructive/export operations, apply real timeline mutations, and verify the resulting export.
- Generated images/audio/SFX must become normal timeline assets with provenance and cancellation.
- Acceptance: a test clip can be trimmed, titled, transitioned, captioned, mixed with audio, exported, and played back successfully.

## 6. Safe repository/tool import
- Drag/drop or paste repository URL/archive in chat.
- Static scan before install: package scripts, dependencies, license, binaries, network requests, permissions, suspicious patterns, and install hooks.
- Show risk report and exact planned commands. Require approval; run only allowlisted package-manager commands in a restricted workspace with timeout and resource limits.
- Acceptance: benign sample installs; suspicious lifecycle script is blocked; cancel works; logs redact secrets.

## 7. Provider and integrations catalogue
- Add common API provider configuration using validated base URLs and encrypted/OS secret storage.
- Make integrations optional, discoverable, and installable with per-capability permissions.
- Acceptance: no key appears in renderer logs or persisted plaintext settings; invalid provider config has actionable feedback.

## Required checks per change
```bat
npm test
npm run build
```
On Windows, also test native Electron features and run `npm run dist:win` before claiming installer readiness.
