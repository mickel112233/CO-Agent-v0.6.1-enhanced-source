---
name: electron-desktop-apps
description: Build reliable Electron applications with secure IPC and reproducible packaging.
---

# Electron desktop app skill

## Security baseline
- Keep contextIsolation enabled, nodeIntegration disabled, and renderer sandboxing enabled unless a documented compatibility requirement proves otherwise.
- Expose only narrow, allow-listed preload methods; never expose raw ipcRenderer or unrestricted Node APIs.
- Validate every IPC sender and every payload in the main process. Renderer validation is only a UX aid.
- Treat web content, imported skills, model output, and files as untrusted.
- Use native dialogs for approvals involving file writes, command execution, or desktop input.

## Engineering
- Keep main-process services out of React components and isolate provider adapters.
- Handle app lifecycle, child-process exit, cancellation, timeouts, and packaged paths.
- Keep user data in the appropriate userData/workspace location and avoid destructive migrations.
- Test on Windows and a second OS when supported; validate packaged assets as well as the Vite build.
- Never report a release artifact unless the workflow uploaded it and it is downloadable.
