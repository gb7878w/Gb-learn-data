"""Synthèse Piper pour scripts/generate-audio.mjs.

Lit sur l'entrée standard {"jobs": [{"voice": "en_GB-cori-high", "text": "…", "out": "x.wav"}]},
télécharge les voix manquantes dans .piper/ et écrit un WAV par élément.
"""
import json
import sys
import wave
from pathlib import Path

from piper import PiperVoice, SynthesisConfig
from piper.download_voices import download_voice

CACHE = Path(__file__).resolve().parent.parent / ".piper"
# Débit un peu ralenti, plus confortable pour un débutant.
CONFIG = SynthesisConfig(length_scale=1.15)


def main() -> None:
    jobs = json.load(sys.stdin)["jobs"]
    CACHE.mkdir(exist_ok=True)
    voices: dict[str, PiperVoice] = {}
    for job in jobs:
        name = job["voice"]
        if name not in voices:
            if not (CACHE / f"{name}.onnx").exists():
                download_voice(name, CACHE)
            voices[name] = PiperVoice.load(CACHE / f"{name}.onnx")
        with wave.open(job["out"], "wb") as wav:
            voices[name].synthesize_wav(job["text"], wav, syn_config=CONFIG)


if __name__ == "__main__":
    main()
