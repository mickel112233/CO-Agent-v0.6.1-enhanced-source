# CO-Agent v0.6.1

CO-Agent is a local-first desktop AI workspace concept for chat, creation workflows, and future computer-use and media tools. This repository is being reconstructed from the v0.6.1 source archive.

## Requirements

- Node.js 20 or newer
- npm
- Windows, macOS, or Linux for development; Windows packaging uses NSIS

## Run locally

```bash
npm install
npm run dev
```

Build the renderer:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Build a Windows installer:

```bash
npm run dist:win
```

## Current repository state

The repository has a starter Electron/Vite/React workspace, a visible renderer error boundary, and a secure minimal preload bridge. This is **not yet the complete archive contents**: advanced agent runtime, Ollama/model management, computer automation, voice, video editing, and their tests still need to be restored from the supplied v0.6.1 archive. The chat UI explicitly reports when a model provider is not connected rather than pretending a request was executed.

## Security

Electron uses context isolation and disables renderer Node.js integration. Do not expose arbitrary shell execution or unrestricted filesystem access through the preload bridge. Add privileged operations only through narrowly scoped IPC handlers with validation and explicit user approval.
