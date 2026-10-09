# CO-Agent 0.6.1

CO-Agent is a Windows-first desktop AI workspace built with React and Electron. This repository currently contains a reconstructed local-first chat and media workflow.

## Included in this branch

- Local Ollama connection check, installed-model listing, model download/deletion, and non-streaming local chat.
- React workspace with chat, model settings, runtime diagnostics, and Video Studio.
- FFmpeg/FFprobe media probing, WAV audio extraction, and sequence joining for compatible clips.
- Optional Piper voice synthesis bridge (Piper and a voice model must be installed separately).
- A restricted desktop bridge that launches only allow-listed Windows applications or opens a selected local path.
- Read-only API request support for OpenAI-compatible, Anthropic, and Gemini endpoints in the runtime helper.
- Basic service smoke tests and a GitHub Actions workflow for Windows and Ubuntu.

## Requirements

- Node.js 20 or newer (Node 22 LTS recommended).
- Ollama installed and running for local chat.
- At least one local Ollama model. For example, run ollama pull gemma3:4b, then refresh status in CO-Agent.
- FFmpeg/FFprobe npm packages for media features.
- Optional Piper binary and compatible voice model for speech synthesis.

## Development

    npm install
    npm run dev

The development command starts Vite at 127.0.0.1:5173 and opens Electron.

## Build and test

    npm test
    npm run build
    npm start

Create a Windows installer with npm run dist:win. Build outputs are written to release/.

## Troubleshooting

1. Start Ollama and verify that http://127.0.0.1:11434/api/version responds locally.
2. Pull a model using the Ollama CLI or the in-app model manager.
3. Refresh runtime status in Models & settings.
4. If the Electron window is blank, run npm run dev from a terminal and inspect the first Vite or renderer error.

## Limitations and safety

- This is not yet a byte-for-byte restoration of the recovered v0.6.1 source archive.
- The media timeline currently assembles files in sequence and uses stream copy; clips generally need compatible codecs, dimensions, and frame rates.
- General mouse/keyboard automation, screen capture/OCR, full original timeline editing, advanced captions/voiceover, streaming responses, and full API provider settings are not complete.
- Piper assets are not bundled.
- Desktop actions are allow-listed; arbitrary shell commands are not exposed to the renderer.
- Review generated output before running actions or publishing media.

See RESTORE-ROADMAP.md for the remaining work and restoration status.
