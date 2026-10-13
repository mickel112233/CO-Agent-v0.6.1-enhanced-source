# Install CO-Agent

CO-Agent is a local-first desktop AI workspace. The packaged Windows app is the easiest way to try it; building from source is intended for developers. Ollama is optional for the interface, but it is required for local-model chat. CO-Agent does not silently install Ollama or download a model.

## Windows packaged build

1. Open the repository’s [Windows Download workflow](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/actions/workflows/windows-download.yml) and choose the latest successful run.
2. Download the `CO-Agent-Windows-…` artifact from that run and extract the ZIP.
3. Run **CO-Agent Setup 0.6.1.exe** to install, or use the standalone app ZIP if you prefer a portable copy.
4. Launch CO-Agent. If Windows shows a SmartScreen warning for an unsigned test build, proceed only if you trust the source and have verified the artifact.
5. In the app’s **Install & setup** page, connect Ollama and download a model—or skip local setup and configure a cloud API provider in **Models & settings**.

## Install Ollama for local chat

Install [Ollama](https://ollama.com/download) for your operating system and start it. CO-Agent can offer a Windows winget installer from the setup page; the app requests confirmation before running it. On macOS or Linux, use the official Ollama download instructions.

After installation, select **Check connection** in CO-Agent. Once the local runtime is detected, choose a model. Suggested starter sizes are approximately 1 GB (`qwen2.5:1.5b`), 2 GB (`qwen2.5:3b`), 2.5 GB (`phi4-mini`), or 3.3 GB (`gemma3:4b`); actual download size varies by model tag and quantization. Keep additional disk space and memory available. Downloads can take several minutes and can be cancelled or retried.

## Build from source

Requirements: Node.js 22 recommended, npm, and Git. For local AI chat, install and run Ollama separately.

```bash
git clone --recurse-submodules https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source.git
cd CO-Agent-v0.6.1-enhanced-source
npm install
npm test
npm run build
npm run dev
```

## Optional voice setup

The onboarding page offers LuxTTS as an optional addition. It creates an isolated Python environment and may download several gigabytes of dependencies or model weights. It is not required for chat. Setup progress and cancellation are shown in the app.

For build/package details and optional tools, see the project [README](README.md).