# v0.6.1 archive restoration status

This repository was initially empty. The current commit establishes the application shell from the recovered CO-Agent v0.6.1 project layout.

## Added

- React/Vite entry point and renderer error boundary
- Responsive workspace shell and chat UI
- Electron main-process window bootstrap with context isolation
- Minimal preload bridge with no privileged methods
- Package manifest, ignore rules, and build instructions

## Not yet restored from the archive

- Full `src/App.jsx` and its related panels/modals
- `src/VideoEditor.jsx` and full media workflow
- Original `src/styles.css`
- Electron agent runtime, Ollama, Piper, studio and computer-control modules
- Original automated tests and research/capability documents
- Archive lockfile

Do not treat the current repository as a complete or verified replacement for the archive until these files have been restored and tests/builds pass.
