# Optional integration source status

This branch pins upstream source trees as Git submodules. These pins preserve upstream history and license notices; they do **not** mean the integrations are complete or shipped in the Electron installer.

## Sources pinned

- **Desktop pet:** `integrations/AI-Desktop-Pet` → `AkshitIreddy/AI-Desktop-Pet`, pinned to `e54db597c94c1f19102bec2e7e2cb3490a9d5a7d`. The upstream project is a Tauri 2 application and includes mixed third-party sprite assets/licenses. Keep its license files and asset attribution intact.
- **LuxTTS:** `third_party/LuxTTS` → `ysharma3501/LuxTTS`, pinned to `28ae6a61151684fffc9d1a7aa15eafa02286fe0b`. Upstream declares Apache-2.0. Its Python dependencies include PyTorch, torchaudio, Hugging Face Hub, librosa, Vocos, and LinaCodec; the model weights are downloaded separately.

## Clone

Use:

```sh
git clone --recurse-submodules https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source.git
cd CO-Agent-v0.6.1-enhanced-source
```

For an existing checkout:

```sh
git submodule update --init --recursive
```

## Completion gates still open

### Desktop pet
- Build the Tauri overlay on supported Windows machines and test its transparent window, click-through behavior, drag/drop, DPI scaling, and multiple monitors.
- The Electron bridge now discovers, launches, tracks, and closes the upstream executable through trusted IPC; it requires an explicit native approval before launch. The executable is not built automatically, and the upstream app has not yet been adapted into a CO-Agent-controlled overlay.
- Route pet chat and computer actions through CO-Agent's existing runtime/approval flow; currently only launching the separate pet app is bridged, not the pet's chat/actions.
- Include required built artifacts/assets in packaging and verify clean-install behavior.
- Run overlay regression tests and a Windows packaged-app smoke test.

### LuxTTS
- A setup action creates an isolated Python venv in the app user-data folder; Python 3.11 and network access are prerequisites. Dependency setup can take a long time; setup cancellation and disk-space preflight are still open.
- Setup output is streamed to the Integrations screen; generation has a bounded timeout and cancellation. Dedicated disk-space/error recovery UI and CPU/GPU selection remain open.
- A JSON-only Python worker calls the upstream `LuxTTS.encode_prompt` and `LuxTTS.generate_speech` APIs; output is validated as a non-empty WAV at 48 kHz.
- Validate reference audio and output paths, limit text and runtime, and verify generated 48 kHz WAV output.
- Node tests cover argument validation, missing runtimes, and cancellation edge cases. Mocked worker tests, opt-in real-model smoke tests, and clean Windows CPU-path verification remain open.

## Current status

The Node/Piper wrapper has bounded execution and output validation. LuxTTS now has a managed-venv setup flow, bounded generation worker, renderer controls, cancellation, output checks, and basic Node tests; no end-to-end generation has been verified with downloaded model weights. The pet has a trusted launch/close bridge and basic lifecycle tests, but the upstream Tauri app is not yet built/bundled automatically and its internal chat/actions are not connected to CO-Agent.
