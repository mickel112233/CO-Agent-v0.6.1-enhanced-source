# CO-Agent remaining-feature completion gates

This checklist is separate from the restoration status: an item is not complete until its acceptance checks pass on a real Windows build.

## 1. Desktop pet and overlay
- [ ] Inventory the actual supplied pet assets and record provenance/licensing; do not substitute emoji or generated placeholders for the real assets.
- [ ] Add a transparent, frameless, always-on-top overlay window with a context-isolated preload and strict IPC sender validation.
- [ ] Support show/hide, drag positioning, persisted position, explicit click-through toggle, and reliable close/disable control.
- [ ] Connect overlay chat to the existing CO-Agent runtime and reuse the main app's approval path. The overlay must not bypass computer-use approvals.
- [ ] Test IPC sender rejection, window lifecycle, persisted coordinates, and overlay-to-chat messages.
- [ ] Manually verify on Windows at common DPI scales and with multiple displays.

## 2. Chat-driven Video Studio
- [ ] Convert natural-language requests into a typed edit plan (trim, split, move, remove, caption/title, track assignment, audio placement); reject unknown operations.
- [ ] Preview every proposed operation and require approval before mutating the project.
- [ ] Apply approved operations through the same timeline/project model used by the UI.
- [ ] Validate source paths, clip bounds, duration, track types, and project invariants after each operation.
- [ ] Test each operation, invalid requests, recovery behavior, and save/reload round trips.
- [ ] End-to-end edit a fixture project and verify the FFmpeg export exists and is probeable.

## 3. Ollama, model, and LuxTTS setup
- [ ] Detect Ollama on first run; explain missing prerequisites and offer explicit user-confirmed install/open actions.
- [ ] Show pull progress, cancellation, failure reason, retry, and model readiness. Do not report ready until the model is listed and the endpoint responds.
- [ ] Keep model choice configurable and explain disk/RAM requirements before download.
- [ ] Integrate LuxTTS only from a verified source/archive and document runtime requirements, license, and model storage. Never silently execute an unverified archive.
- [ ] Provide voice/model selection, test synthesis, playback, and actionable missing-runtime/model errors.
- [ ] Test missing runtime, download failure, cancellation, successful readiness, and successful speech output.

## 4. Safe repository imports and integrations
- [ ] Restrict imports to public HTTPS GitHub URLs and validated refs; reject credentials, untrusted redirects, traversal, symlinks, and oversized content.
- [ ] Treat imported manifests and skills as untrusted data; never execute imported code during import or chat.
- [ ] Make optional integrations independently detectable, user-confirmed to install, and removable without damaging core app.
- [ ] Test malicious URLs/refs, malformed manifests, symlink entries, oversized files, and safe uninstall.
- [ ] Document optional integrations, external prerequisites, and verification steps.

## 5. Release and verification gate
A release must not be called complete until real results are attached to the commit or pull request.
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] Review dependency audit findings; fix or document each exception.
- [ ] Build both Windows NSIS installer and standalone ZIP.
- [ ] Verify package contents include required runtime files/assets and exclude secrets, caches, and development-only files.
- [ ] Smoke-test install, launch, upgrade/repair, uninstall, and relaunch on Windows.
- [ ] Manually verify overlay, Ollama setup, LuxTTS synthesis, timeline edits, and MP4 export on Windows.
- [ ] Attach test logs and artifact links. A workflow file existing is not proof that the latest build passed.

## Current status
The existing README and restoration roadmap describe a timeline MVP, Ollama model management, repository skill imports, and Windows packaging workflows. They do not establish that the pet overlay or LuxTTS setup is complete, or that the current Windows package has passed. Keep these gaps visible until evidence is attached.