#!/usr/bin/env python
"""
scripts/download_models.py — Offline AI model pre-downloader
Downloads Whisper (medium) and Coqui XTTS-v2 models to ensure Nativeify operates completely offline.
"""
import os
import sys
from pathlib import Path

# Ensure paths are resolved relative to project root
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

def download_whisper(model_size="medium"):
    print(f"[*] Downloading Whisper '{model_size}' model to cache...")
    try:
        from faster_whisper import WhisperModel
        # Setting device to cpu and compute_type to int8 allows download on any machine without GPU requirements
        WhisperModel(model_size, device="cpu", compute_type="int8")
        print(f"[+] Whisper '{model_size}' downloaded successfully.")
    except Exception as e:
        print(f"[-] Failed to download Whisper model: {e}", file=sys.stderr)

def download_xtts():
    print("[*] Downloading XTTS-v2 model (~1.8 GB)...")
    try:
        # Coqui TTS downloads models automatically on initialization of the API wrapper
        from TTS.api import TTS
        TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", gpu=False)
        print("[+] XTTS-v2 model downloaded successfully.")
    except Exception as e:
        print(f"[-] Failed to download XTTS-v2 model: {e}", file=sys.stderr)

def main():
    print("=========================================================")
    print("         Nativeify Offline AI Model Downloader          ")
    print("=========================================================")
    
    # Ensure folders exist
    os.makedirs(PROJECT_ROOT / "models" / "whisper", exist_ok=True)
    os.makedirs(PROJECT_ROOT / "models" / "xtts", exist_ok=True)
    
    download_whisper()
    download_xtts()
    
    print("\n[+] All default models downloaded. Nativeify can now run completely offline!")
    print("=========================================================")

if __name__ == "__main__":
    main()
