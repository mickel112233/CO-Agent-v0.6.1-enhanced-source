# CO-Agent completion inventory

**Updated:** 13 October 2026  
**Latest implementation head:** see the latest `main` commit and linked CI runs; completion claims below distinguish source tests, packaged smoke tests, and manual acceptance.
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
- [x] Model pulls are request-scoped and abort the fetch plus stream reader; renderer `finally` clears busy/request state and cancellation is surfaced distinctly. A fresh Ollama inventory check is required before a pull is reported ready.
- [x] Ensure model readiness is based on a fresh Ollama status/model inventory check after download, not merely a successful pull response. **Implemented; latest CI is pending.**
- [x] First-run setup reports Ollama reachability/runtime errors, offers re-check and the official installer, disables model downloads until Ollama responds, surfaces download errors, supports cancellation/retry, verifies model inventory, and always allows safe skip. Interactive first-run acceptance still requires a Windows desktop session.
- [x] LuxTTS setup has a cancellable request ID, progress UI, Python version preflight (3.10/3.11 only), and post-install import/version verification. Real voice-cloning synthesis still requires a reference-audio fixture and model download before marking synthesis end-to-end verified.
- [x] API keys remain in renderer memory only, are passed only to the selected provider call, and chat-history validation persists role/content only. Request IDs isolate streamed chunks and AbortController cancellation is wired to the active model request; orchestration-wide recovery still needs acceptance testing.
- [x] Chat history writes are serialized and atomic in the main process; history is bounded/validated, loaded on startup, and save errors surface in the UI. New conversations receive unique timestamp IDs. Multi-window crash/restart and interactive switching still need desktop acceptance.
- [ ] Run `npm test`, `npm run build`, `npm run verify:release`, and `git diff --check` on the final head. GitHub Actions currently runs the test suite, renderer build, package verifier, and Windows ZIP/NSIS startup smoke checks; final head results are pending.

## P1 — desktop pets

- [x] Upstream pet license/attribution and referenced asset filenames are documented; license and notice resources are included in package configuration. The Windows package workflow checks the executable, sprite, and license paths. Full interactive asset rendering remains a manual acceptance item.
- [ ] Exercise overlay launch, hide/show, close, tray menu, dragging, resize, saved coordinates, restart restoration, display add/remove, DPI scaling, and off-screen recovery in a Windows desktop session.
- [ ] Verify pet requests are delivered once across renderer startup and route through the same provider/runtime, cancellation and approval UI as normal chat.
- [ ] Verify pet executable discovery, duplicate launch handling, missing binary, crash/restart, clean install, upgrade, and uninstall.
- [x] Added a behavioral pet-overlay test with injected fake Electron windows/screens and a temporary preferences file; it checks restore, sandbox settings, display clamping, visibility persistence, show/hide, and teardown. Actual desktop-session acceptance remains.
- [x] Windows CI builds the pet executable and packages it into NSIS and ZIP; the ZIP smoke test checks executable and sprite/license resources, and the installed-app smoke test checks startup. Latest CI result is the gate.

## P1 — Video Studio end-to-end

- [x] Video Studio receives the selected provider/model/API endpoint and in-memory key from chat settings; missing API keys are rejected before planning, and edit plans are checked against the pre-request timeline revision. Source regression tests cover provider wiring and stale-plan protection; runtime acceptance remains.
- [ ] Test all typed edit actions (rename, caption/title, move, duration, source trim, remove, split) including invalid IDs, wrong tracks, boundary conditions, stale plans, undo/redo, and save/reload.
- [ ] Generate LuxTTS voiceover using a real reference audio fixture and verify the WAV with FFprobe before adding it to the timeline.
- [x] Added FFmpeg/FFprobe integration coverage for every SFX preset (impact, sweep, ambient, beep), checking PCM WAV codec, 48 kHz, stereo channels, file readability, and requested duration. CI must pass this fixture test.
- [x] Added a deterministic integration test that generates a video fixture and SFX, exports an MP4, checks video/audio streams and duration, and decodes the export. A real Windows run is still required for final acceptance.
- [x] Timeline export supports request-scoped cancellation, renders to a unique temporary file, verifies before publishing, cleans partial output, and refuses to overwrite an existing export. CI tests the cancellation endpoint; packaged media acceptance remains.
- [x] Added a real FFmpeg video fixture plus generated SFX, MP4 export, FFprobe stream/duration checks, and FFmpeg decode-to-null. The CI run for the current head is the acceptance gate.

## P1 — secure imports and integrations

- [x] GitHub import rejects non-GitHub/credential-bearing URLs and unsafe refs, and now refuses symlinks, non-regular entries, more than 10,000 files, files above 25 MB, or repositories above 250 MB before treating the import as reviewable. Git transport remains bounded by a five-minute timeout and 4 MB captured output; external-host redirect behavior is still not proven by the fixture suite.
- [x] Cross-platform ZIP validators reject traversal, symlinks, alternate data streams, Windows reserved names, trailing dots/spaces, duplicates, oversized entries, and excessive expanded size; real archive tests cover representative malicious/valid cases. Platform CI must pass for both implementations.
- [x] Repository and ZIP imports are review-only; lifecycle scripts are reported, not executed. Node dependency installation is a separate explicit approval and uses `--ignore-scripts` with the official npm registry.
- [x] Optional-tool detection and fixed allow-listed installers are implemented with bounded timeouts and clear unsupported-platform errors; regression tests cover the catalog and repository boundaries. Interactive install/remove acceptance remains.
- [x] Added a local HTTP MCP server interoperability test that exercises initialize, initialized notification, tools/list, and tools/call end-to-end. ACP already runs a real local child-process fixture including streamed messages and permission outcomes; external third-party MCP/ACP servers and platform-specific permission dialogs still require manual acceptance.

## P1 — agent and computer-use reliability

- [x] Orchestrator accepts a request AbortSignal and passes it into the local model call with a timeout; unit tests cover cancellation/recovery. Multi-step Windows UI acceptance remains.
- [ ] Verify pause/resume/cancel and interrupted-run recovery with persisted state after restart. Core cancellation/persistence primitives exist, but a restart-driven desktop acceptance test has not yet been run.
- [x] Agent workflow exposes fixed verification commands and the desktop verifier distinguishes verified/not_verified/uncertain with an evidence disclaimer. End-to-end acceptance must still inspect actual command output.
- [ ] Exercise per-action desktop approval, denial, stale screenshots, multi-monitor selection, accessibility/OCR failure, and recovery after a failed input action.
- [x] Audit log has secret-redaction and bounded persistence coverage in the existing regression suite; latest CI must confirm it passes.

## P2 — UX and release completeness

- [x] Setup presents three optional Ollama model choices and describes model download as multi-GB; choices are optional, and cloud API providers remain available. Hardware requirements vary by quantization/context, so the app avoids claiming a guaranteed RAM floor.
- [x] Provider adapters validate protocol/configuration and surface connection errors; stream parser tests and Video Studio provider tests cover wiring. A live credential-backed smoke test is intentionally not claimed.
- [ ] Verify keyboard navigation, focus management, accessible status/progress, responsive layout, and no blank/white screen in packaged builds.
- [ ] Run a clean Windows install → launch → setup → chat → pet → media export → upgrade/repair → uninstall smoke test. CI now performs packaged ZIP startup and NSIS install/start/uninstall smoke checks; interactive setup/chat/pet/media acceptance remains.
- [ ] Attach passing CI logs and artifact links to a versioned GitHub Release; run dependency audit and document each accepted finding. Workflow artifacts are not a published signed release.
- [x] README streaming and Computer Use limitation claims reconciled with the current implementation; CI still needs to pass on the updated head.

## External verification limits

GitHub Actions can validate source tests, renderer compilation, native pet compilation, packaging, and artifact contents. It cannot prove behavior on the user's own displays, local Ollama installation/model, local Python/GPU/CPU combination, personal reference audio, or arbitrary media files. Those require explicit Windows/manual or fixture-based acceptance evidence and must remain labeled as such until performed.
