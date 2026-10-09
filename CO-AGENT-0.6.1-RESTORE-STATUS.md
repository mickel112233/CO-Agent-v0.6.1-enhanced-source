# CO-Agent v0.6.1 — restoration status

This repository is being reconstructed from the recovered `CO-Agent-v0.6.1-enhanced-source` archive. The original archive contains the Electron/React desktop application; it is not a browser-only chatbot.

## Files restored from the archive

- `electron/agent-runtime.cjs` — read-only subagent calls for OpenAI-compatible, Anthropic, and Gemini providers, with a bounded delegation budget
- `electron/launch-local.cjs` — local Electron launcher
- `electron/ollama.cjs` — Ollama status, model validation, streamed model pulls, and model deletion
- `test/agent-runtime.test.cjs` — child-agent provider tests
- `test/ollama.test.cjs` — Ollama validation, status, and pull-stream tests
- `package.json` — archive-aligned launch/build scripts and FFmpeg dependencies

## Remaining archive files to restore

The current GitHub repository is **not yet a complete copy of the ZIP**. In particular, restore these original files before treating it as a faithful replacement:

- `src/App.jsx`, `src/VideoEditor.jsx`, `src/OllamaModal.jsx`, `src/LocalProfile.jsx`, `src/VoiceoverModal.jsx`, `src/ComputerSkills.jsx`, `src/ComputerPanel.jsx`, `src/WorkspaceModal.jsx`, and the original `src/styles.css`
- `electron/main.cjs`, `electron/preload.cjs`, `electron/computer.cjs`, `electron/piper.cjs`, and `electron/studio.cjs`
- the original package lockfile, remaining tests, research notes, and capability comparison

## Run and verify

Use Node.js 20 or newer. After all archive files have been restored:

```powershell
npm install
npm test
npm run build
npm run dev
```

The app must not be described as fully restored or tested until the original modules are present and these checks pass.
