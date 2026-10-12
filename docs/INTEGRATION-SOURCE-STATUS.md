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
- Launch/close it from CO-Agent without leaving orphan processes.
- Route chat and computer actions through CO-Agent's existing IPC trust checks and explicit approval flow.
- Include required built artifacts/assets in packaging and verify clean-install behavior.
- Run overlay regression tests and a Windows packaged-app smoke test.

### LuxTTS
- Create an app-managed Python environment; never install Python dependencies globally.
- Show setup/download progress, cancellation, disk-space/error states, and CPU/GPU selection.
- Use the upstream API (`LuxTTS.encode_prompt`, `LuxTTS.generate_speech`) through a bounded worker process.
- Validate reference audio and output paths, limit text and runtime, and verify generated 48 kHz WAV output.
- Add mocked worker tests plus an opt-in real-model smoke test; test the CPU path on a clean Windows machine.

## Current status

The Node/Piper wrapper has bounded execution and output validation. LuxTTS is source-pinned only; it is not yet callable from the app. The desktop-pet source is pinned only; the Electron-to-overlay launch, approval-aware chat bridge, installer packaging, and runtime tests remain incomplete.
