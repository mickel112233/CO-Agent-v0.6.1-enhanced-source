# CO-Agent project context imported from recent ChatGPT work

**Imported:** 12 October 2026  
**Purpose:** Preserve the user's product intent, recent decisions, unfinished tasks, and historical bug reports across future work. This is planning context, not proof that a feature exists or passes tests. Keep implementation status grounded in source and CI.

## Product direction and working preferences

- Product name is CO-Agent. Do not rename it to Luma, Atelier, or another project.
- Windows-first Electron desktop AI workspace; local-first by default, with optional user-configured API providers. It must operate on the user's actual Windows desktop, not depend on a remote VM or cloud desktop.
- Work against this repository and real files/tests; push changes when permissions allow. Avoid asking the user to run manual steps if repository tools can do the work.
- Do not call a feature complete based on UI presence alone. Verify behavior, tests, packaging, restart recovery, and error states; report precisely what was and was not verified.
- UI should be polished, minimal, responsive, and English-only. Avoid fake placeholders, confusing debug-style screens, excessive navigation, and a separate Basic video-editing mode.
- Chat is the preferred interaction model. Video Studio should combine natural-language instructions with a real advanced timeline, review/apply checkpoints, and a playable export.
- Keep local model/runtime setup understandable and mostly automatic, with progress, retry, and useful recovery/help when prerequisites are missing. Never imply a model, runtime, voice engine, or native executable was installed if it was not.

## Recent product decisions and requested experience

### Main chat, runtime, and models
- Preserve persistent conversations/workspaces, history, reliable cancellation, restart recovery, honest error/retry states, and accurate task results.
- Local Ollama support is important; API providers should remain optional. Use a provider/model abstraction rather than hard-coding all agent work to one provider.
- A previously requested candidate local stack was vision gemma3:4b-q4, text phi4-mini:q4, and embeddings google/embeddinggemma-2. Treat these as candidate/default choices to evaluate, not verified compatibility or installed dependencies; inspect current model tags, RAM/VRAM needs, and actual Ollama behavior before making them mandatory.
- Earlier conversations also asked for a first-run page listing required/recommended models, especially Gemma 4 E2B 4-bit, with a clear download/progress/retry flow. Reconcile this with the newer stack instead of presenting contradictory mandatory model sets.
- First-run onboarding should detect Ollama, offer install/launch/retry guidance, install/select the intended model, and wire LuxTTS setup/runtime if enabled. Users must be able to re-enter setup when a required dependency is missing or broken.
- Historical bug reports include model downloads appearing stuck or having poor progress, Gemma downloads unexpectedly large, Ollama not installing/starting, settings not opening, blank/black/white screens, and invalid email validation. Reproduce these where relevant; do not assume they are current defects.

### Desktop pets / overlay
The user explicitly requested that pet work be made complete and verified, not merely added as an executable bridge. Track each separately:
- Build/startup and graceful shutdown on supported Windows builds.
- Dragging, saved position, visibility/show-hide, and recovery after app restart.
- Tray/menu controls and their real behavior.
- Multi-monitor positioning, display changes, scaling, and off-screen recovery.
- Chat history persistence and pet chat UI behavior.
- Packaged installer inclusion and executable discovery; verify a clean install, not just a developer machine with a manually copied binary.
- Pet requests must use the same CO-Agent runtime/provider selection, cancellation path, and approval/permission safeguards as ordinary chat.
- Test process exit, missing executable, launch failure, duplicate launch, and restart recovery.
- Existing roadmap says the pet source is pinned Tauri upstream and CI is intended to build/bundle the executable. Confirm the workflow passes and the artifact contains the expected executable before claiming packaged pet support is complete.

### Video Studio
- Advanced mode only; no Basic mode. The user wants a chat-driven editor where they can say what to change naturally and see reviewable edits applied to a genuine timeline.
- Keep visual design aligned with CO-Agent's theme. A reference image was supplied in an earlier chat; if it is not attached to the current task, do not pretend to see it. Use existing repository context or ask for it only if exact visual matching is necessary.
- Verify voiceover generation through LuxTTS using selected/reference audio, real sound-effect insertion, and that both become editable timeline audio clips.
- Verify an actual exported MP4 is playable and validated for duration, video stream, and expected audio streams, not merely that a render command returns success.
- Cover progress, cancellation, failed-render recovery, temporary/atomic output handling, and cleanup of temporary files.
- Known roadmap gaps to prioritize after end-to-end basics: transitions, keyframes, effects/transforms, audio routing and audio extracted from video, waveforms, snapping, drag trim handles, proxy media, automatic transcription/captions, color grading, and professional-editor parity. Do not build a huge feature surface before export reliability is demonstrated.

### Repository/ZIP imports and integrations
- Chat should support dropped ZIP/repository imports with safe extraction and scanning, not just direct GitHub URL import.
- ZIP extraction must defend against traversal, symlinks, archive bombs, excessive entries, and oversized files. Scan manifests, scripts, executables, and project roots before presenting a review screen.
- Imported code must not execute automatically. Dependency installation or running imported projects requires distinct explicit approval and a restrictive execution policy.
- Keep GitHub URL/ref validation and skill imports bounded; treat third-party skill instructions and project files as untrusted.
- Continue optional integrations for OCR/Tesseract, Hyperframes, Piper compatibility, LuxTTS, MCP, and ACP without claiming full compatibility until real compatibility tests pass.

### Computer use and agent execution
- Use Windows-native accessibility/UI Automation where possible, with screenshot/OCR fallback. Support multi-monitor mapping and clear previews of proposed actions.
- Keep native approval for desktop actions and file writes. Add pause/stop/cancel, action history, and post-action verification before expanding autonomy.
- Agent execution should have planning checkpoints, explicit permission boundaries, retry/recovery, acceptance criteria, and independent verification. Do not label user-started specialist steps as fully autonomous agents.
- Keep selected-workspace context, secret/path/symlink protections, backups, and file proposal review. Never expose arbitrary shell/PowerShell execution to the renderer.
- MCP/ACP and external-agent calls must share cancellation, permission prompts, output limits, and audit behavior with the normal runtime.

## Prioritized work queue

Treat these as verification-led work items. Update checkboxes only after source changes and test evidence exist.

### P0 — prove the current build works
- [ ] Read AGENTS.md, README.md, RESTORE-ROADMAP.md, and CO-AGENT-0.6.1-RESTORE-STATUS.md before implementation.
- [ ] Run and record npm test, npm run build, and relevant Git diff checks; inspect latest CI runs and Windows packaging workflow.
- [ ] Verify packaged Electron startup/renderer/preload/IPC behavior from a clean Windows artifact. Investigate renderer connection-refused or blank-screen reports if reproducible.
- [ ] Compare roadmap claims against current code and tests; correct documentation where evidence does not support a claim.

### P1 — desktop pet end-to-end completion
- [ ] Startup/shutdown, drag, persisted position, visibility, chat history, tray controls, multi-monitor/display changes, restart recovery.
- [ ] Runtime/provider integration, cancellation, and approvals shared with normal CO-Agent chat.
- [ ] Clean Windows packaging test proving the correct pet executable is included and launches without manual copying.
- [ ] Automated regression tests where practical plus a documented manual Windows test matrix for real desktop behavior.

### P1 — Video Studio real export path
- [ ] Generate real LuxTTS voiceover and insert it as an editable audio clip.
- [ ] Generate/insert sound effects as editable clips.
- [ ] Render a representative project to MP4; probe output with FFprobe and verify playback, duration, video stream, and expected audio.
- [ ] Test cancellation, errors, retry, and temporary-output cleanup; preserve review/apply for AI-proposed timeline changes.

### P1 — setup and dependency recovery
- [ ] First-run setup detects Ollama and required model(s), communicates realistic sizes/progress, and supports retry/recovery.
- [ ] Wire LuxTTS installation/runtime setup (or clearly mark unavailable) and ensure it can be reopened from settings/integrations.
- [ ] Validate setup in a clean profile where Ollama, model files, Tesseract, Hyperframes, and pet executable are initially absent.
- [ ] Choose and document one coherent default model recommendation; do not mix old Gemma 4 E2B requests and newer Gemma 3/Phi/EmbeddingGemma candidates as simultaneously mandatory without testing.

### P2 — chat import and integration hardening
- [ ] Verify ZIP drop and file-picker flows, scan results, user review, and explicit dependency-install approval.
- [ ] Test malicious archive paths, symlinks, nested/oversized archives, scripts, lockfiles, and failure cleanup.
- [ ] Test real MCP/ACP compatibility and confirm approval, cancellation, and output bounds remain effective.

### P2 — chat, persistence, and reliability
- [ ] Verify conversation history survives restart, errors are actionable, retry works, and cancellation reaches the active provider/process.
- [ ] Verify workspace selection and project data persistence; recover interrupted tasks without duplicating side effects.
- [ ] Add UI/E2E coverage for settings, onboarding, chat, pet controls, and Video Studio rather than relying only on unit tests.

### P3 — product depth after reliability
- [ ] Improve advanced Video Studio timeline features based on the roadmap and measured gaps.
- [ ] Improve computer-use semantic target selection and post-action verification while retaining approvals.
- [ ] Add model-independent agent/provider adapters and more integrations only after shared runtime/permission contracts are stable.

## Working rules for maintainers and coding agents

1. Inspect the actual branch and files before editing; do not assume context from another repository or an earlier build applies unchanged.
2. Prefer small, reviewable commits and tests. Avoid replacing existing roadmap/status docs wholesale.
3. Keep this document as imported user intent and pending work; keep RESTORE-ROADMAP.md as implementation facts and verified status.
4. For each completed item, record relevant test/CI evidence and distinguish automated tests from manual Windows verification.
5. Never mark an item complete merely because a control, menu, bridge, or stub exists.
6. If a request cannot be completed because of unavailable credentials, tools, hardware, or CI, say exactly what is blocked and leave a concrete next step.
