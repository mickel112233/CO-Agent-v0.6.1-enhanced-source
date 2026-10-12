#!/usr/bin/env python3
"""CO-Agent's narrow JSON-in/JSON-out LuxTTS worker. No command execution is exposed."""
import json
import os
import sys
import traceback

def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)

def main():
    try:
        request = json.load(sys.stdin)
        text = str(request.get("text", "")).strip()
        reference = os.path.abspath(str(request.get("referenceAudio", "")))
        output = os.path.abspath(str(request.get("outputPath", "")))
        steps = int(request.get("numSteps", 4))
        speed = float(request.get("speed", 1.0))
        if not text or len(text) > 12000:
            raise ValueError("Text must contain 1–12,000 characters.")
        if not os.path.isfile(reference):
            raise ValueError("Reference audio file does not exist.")
        if not output.lower().endswith(".wav"):
            raise ValueError("Output filename must end in .wav.")
        if steps < 1 or steps > 12 or speed < 0.5 or speed > 2:
            raise ValueError("Invalid generation settings.")
        emit({"stage": "loading", "message": "Loading LuxTTS model; first run may download model weights."})
        from zipvoice.luxvoice import LuxTTS
        import soundfile as sf
        model = LuxTTS("YatharthS/LuxTTS", device="cuda" if __import__("torch").cuda.is_available() else "cpu")
        emit({"stage": "encoding", "message": "Encoding reference voice."})
        prompt = model.encode_prompt(reference, duration=5, rms=0.01)
        emit({"stage": "generating", "message": "Generating speech."})
        audio = model.generate_speech(text, prompt, num_steps=steps, speed=speed)
        waveform = audio.detach().cpu().numpy().squeeze()
        if waveform.size == 0:
            raise RuntimeError("LuxTTS returned empty audio.")
        os.makedirs(os.path.dirname(output), exist_ok=True)
        sf.write(output, waveform, 48000)
        if not os.path.isfile(output) or os.path.getsize(output) < 44:
            raise RuntimeError("Output WAV validation failed.")
        emit({"ok": True, "output": output, "sampleRate": 48000, "bytes": os.path.getsize(output)})
    except Exception as exc:
        emit({"ok": False, "error": (str(exc) or exc.__class__.__name__)[:1600]})
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
