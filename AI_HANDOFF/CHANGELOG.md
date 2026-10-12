# Changelog

## 2026-10-12 — integration work started
- Added a persistent AI handoff folder so future coding agents can see the goal, current status, security constraints, and ordered acceptance criteria.
- Recorded the key architecture mismatch: the supplied desktop pet project uses Tauri/Rust, while CO-Agent is Electron/React; integration must adapt assets and behavior rather than run two competing shells.
- No claim is made that the pet overlay, LuxTTS installer, or chat-driven video-edit execution is complete yet.


## 2026-10-12 — first pet overlay implementation
- Added `electron/pet-overlay.cjs`, `electron/pet-preload.cjs`, and `electron/pet-overlay.html` for a secure, floating Electron companion with a small text prompt.
- Connected overlay messages to the existing CO-Agent chat through the main process and preload bridge; overlay opens by default.
- Added `test/pet-overlay.test.cjs` source-level regression checks.
- Pet project assets have not yet been merged; this iteration uses a simple fallback paw icon. Run CI and verify overlay interaction on Windows before treating this piece as complete.
