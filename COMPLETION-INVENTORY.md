# CO-Agent completion inventory

**Updated:** 13 October 2026  
**Latest implementation head:** `7a73fee` (verification run pending).
**Target:** `main` of this repository  
**Rule:** A component is not complete because a screen or helper exists. Automated source tests, CI, packaged-runtime checks, and hardware-dependent manual acceptance are separate gates.

## Verified at the current baseline

- [x] GitHub Actions CI passed on Windows and Ubuntu at commit `3bb6c95`: Node regression suite, Vite renderer build, Windows pet frontend/Rust executable build, NSIS + ZIP packaging, and package-content verification. This is baseline evidence only; later commits need their own green runs.
- [x] Windows Download workflow passed at commit `3bb6c95` and published a workflow artifact.
- [x] Repository contains a persistent project-context document and an initial pet/video/setup/import completion gate.
- [x] Desktop pet source, isolated preload, transparent overlay, persistence, display-bound clamping, tray controls, and runtime bridge exist in source. Existing pet tests are mostly source-contract checks, not real desktop interaction.
- [x] Video Studio contains an advanced timeline, natural-language edit-plan review/apply, LuxTTS voiceover path, FFmpeg-generated SFX, project save/load, and FFmpeg/FFprobe export validation paths. Real reference-audio synthesis and export playback still require runtime tests.
- [x] ZIP import has traversal, symlink, file-count, expanded-size, and review-only scanning protections plus regression tests. It still needs adversarial fixtures against both platform extractors and full drag/drop UI acceptance.
- [x] Ollama status/model inventory and streamed pull progress exist.
- [x] Model pull cancellation is wired end-to-end with request IDs, an abort controller, stream-reader cancellation, and a renderer Cancel button. A regression test covers abort behavior; CI for the current head is pending.
- [x] First-run model setup now checks the live Ollama model inventory after the pull and refuses to report readiness if the requested model is missing.
- [x] ZIP path validation now rejects NTFS alternate data streams, Windows reserved device names, trailing dots/spaces, symlinks, traversal, and duplicate normalized entries on both platform extractors; real ZIP extraction tests cover valid and malicious archives.
- [x] Third-party pet asset license files and the repository's third-party notice are configured as package resources.
- [x] Added a packaged smoke-test mode and CI steps for standalone ZIP and installed NSIS startup; latest CI must confirm the workflow and package contents.
- [x] Media integration test now creates a real video fixture, inserts generated audio, renders MP4, probes both streams and duration, and decodes the output to null; latest CI must confirm it passes.
- [x] Chat history persistence, agent orchestration, audit log, computer-use approval, MCP/ACP adapters, and workspace file protections exist in source.

## P0 — build/test correctness and reliable setup

- [x] Add abortable model downloads end-to-end: request IDs, AbortController in the main process, stream cancellation, renderer Cancel button, and regression test. **Implemented; latest CI is pending.**
- [ ] Confirm a cancelled pull cannot be reported as a successful installation or leave the UI stuck in busy state.
- [x] Ensure model readiness is based on a fresh Ollama status/model inventory check after download, not merely a successful pull response. **Implemented; latest CI is pending.**
- [ ] Improve first-run diagnostics for missing/offline Ollama, missing model, and failed setup; allow retry and safe skip without trapping the user.
- [x] LuxTTS setup has a cancellable request ID, progress UI, Python version preflight (3.10/3.11 only), and post-install import/version verification. Real voice-cloning synthesis still requires a reference-audio fixture and model download before marking synthesis end-to-end verified.
- [ ] Audit API/local provider state and chat cancellation. API key storage must be explicit and safe; never persist secrets to plain localStorage or chat history.
- [ ] Verify conversation switching, new-chat IDs, auto-save ordering, restart recovery, and failures during persistence.
- [ ] Run `npm test`, `npm run build`, `npm run verify:release`, and `git diff --check` on the final head.

## P1 — desktop pets

- [ ] Validate the actual included pet assets, their upstream license, attribution, and all referenced filenames; ensure packaged asset paths work from an installed build.
- [ ] Exercise overlay launch, hide/show, close, tray menu, dragging, resize, saved coordinates, restart restoration, display add/remove, DPI scaling, and off-screen recovery in a Windows desktop session.
- [ ] Verify pet requests are delivered once across renderer startup and route through the same provider/runtime, cancellation and approval UI as normal chat.
- [ ] Verify pet executable discovery, duplicate launch handling, missing binary, crash/restart, clean install, upgrade, and uninstall.
- [x] Added a behavioral pet-overlay test with injected fake Electron windows/screens and a temporary preferences file; it checks restore, sandbox settings, display clamping, visibility persistence, show/hide, and teardown. Actual desktop-session acceptance remains.
- [ ] Verify packaging includes the pet executable and sprites in both NSIS and ZIP artifacts, and that a clean machine does not depend on developer-only paths.

## P1 — Video Studio end-to-end

- [ ] Keep the selected Ollama/API provider and model configuration consistent across every chat-driven timeline action; ensure secrets are not persisted in projects or logs.
- [ ] Test all typed edit actions (rename, caption/title, move, duration, source trim, remove, split) including invalid IDs, wrong tracks, boundary conditions, stale plans, undo/redo, and save/reload.
- [ ] Generate LuxTTS voiceover using a real reference audio fixture and verify the WAV with FFprobe before adding it to the timeline.
- [x] Added FFmpeg/FFprobe integration coverage for every SFX preset (impact, sweep, ambient, beep), checking PCM WAV codec, 48 kHz, stereo channels, file readability, and requested duration. CI must pass this fixture test.
- [x] Added a deterministic integration test that generates a video fixture and SFX, exports an MP4, checks video/audio streams and duration, and decodes the export. A real Windows run is still required for final acceptance.
- [x] Timeline export supports request-scoped cancellation, renders to a unique temporary file, verifies before publishing, cleans partial output, and refuses to overwrite an existing export. CI tests the cancellation endpoint; packaged media acceptance remains.
- [ ] Add timeline media fixture regression tests; a helper/unit test or source inspection is not an end-to-end export.

## P1 — secure imports and integrations

- [x] GitHub import rejects non-GitHub/credential-bearing URLs and unsafe refs, and now refuses symlinks, non-regular entries, more than 10,000 files, files above 25 MB, or repositories above 250 MB before treating the import as reviewable. Git transport remains bounded by a five-minute timeout and 4 MB captured output; external-host redirect behavior is still not proven by the fixture suite.
- [ ] Verify ZIP extraction parity on Windows and Unix, including duplicate normalized names, symlinks/reparse points, zip bombs, and cleanup after failure.
- [ ] Ensure import is review-only by default and never executes scripts automatically; dependency installation requires a separate explicit confirmation and clear trust boundary.
- [ ] Test optional tool detection/install/removal and missing executables without corrupting core app.
- [ ] Run MCP/ACP against at least one real compatible local server/agent in addition to protocol mocks; test timeout, cancellation, invalid messages, and approval rejection.

## P1 — agent and computer-use reliability

- [ ] Verify active model-call cancellation propagates through orchestration, not just the UI.
- [ ] Verify pause/resume/cancel and interrupted-run recovery with persisted state after restart.
- [ ] Tie acceptance criteria to actual command/test results and require evidence-aware outcomes; do not treat a model's self-report as verification.
- [ ] Exercise per-action desktop approval, denial, stale screenshots, multi-monitor selection, accessibility/OCR failure, and recovery after a failed input action.
- [ ] Verify audit records redact API keys and secrets and remain bounded under repeated runs.

## P2 — UX and release completeness

- [ ] Reconcile the setup's candidate model choices and provide accurate disk/RAM requirements without presenting conflicting model sets as mandatory.
- [ ] Verify API settings validation and connection tests for OpenAI-compatible, Anthropic, and Gemini protocols.
- [ ] Verify keyboard navigation, focus management, accessible status/progress, responsive layout, and no blank/white screen in packaged builds.
- [ ] Run a clean Windows install → launch → setup → chat → pet → media export → upgrade/repair → uninstall smoke test. CI now performs packaged ZIP startup and NSIS install/start/uninstall smoke checks; interactive setup/chat/pet/media acceptance remains.
- [ ] Attach CI logs and artifact links to a release; run dependency audit and document each accepted finding.
- [ ] Update README and capability scorecard so every claim matches current behavior and known limitations.

## External verification limits

GitHub Actions can validate source tests, renderer compilation, native pet compilation, packaging, and artifact contents. It cannot prove behavior on the user's own displays, local Ollama installation/model, local Python/GPU/CPU combination, personal reference audio, or arbitrary media files. Those require explicit Windows/manual or fixture-based acceptance evidence and must remain labeled as such until performed.
