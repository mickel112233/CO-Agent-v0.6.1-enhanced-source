# v0.6.1 restoration status

The current branch contains a reconstructed integration path between the React renderer and Electron's allow-listed IPC bridge, local Ollama chat/model management, basic FFmpeg media operations, optional Piper synthesis, and a minimal test/CI baseline.

## Reconstructed in this branch

- Electron main process and context-isolated preload bridge.
- Local Ollama status, model pull/delete, and non-streaming chat path.
- Local file selection, media probing, WAV extraction, and compatible-clip concat.
- Video studio UI with media bin, preview, metadata, and export controls.
- Local model selection/management UI and runtime diagnostics.
- Read-only API subagent helper for OpenAI-compatible, Anthropic, and Gemini endpoints.
- Desktop app launch restrictions and service smoke tests.

## Still required for a true full match

The recovered archive contained larger original source files and components that are not yet restored byte-for-byte, including the original full React interface and timeline editor, complete original stylesheet, original Electron backend modules, dependency lockfile, remaining tests, and research/capability documents. Several modules now contain a fresh compatible implementation rather than the archived original.

The current implementation is not equivalent to the complete original feature set. Full native computer-use automation, screen capture/OCR, the original advanced timeline editor, captions/voiceover tooling, download progress streaming in the UI, and full API-provider settings remain unfinished.

## Verification

GitHub Actions is configured to run tests and a Vite production build on Windows and Ubuntu. Confirm a green run in the repository Actions tab before claiming verified build/test success.
