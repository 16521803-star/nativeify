# Nativeify 🎙️→🗣️

> **Convert your English speech into fluent, native-level English audio — fully local, fully private.**

Nativeify is a local AI-powered application that takes your recorded or uploaded English audio, transcribes it, automatically corrects grammar and fluency using a local LLM, and regenerates it as polished native-English speech — all without sending a single byte to the cloud.

---

## ✨ Features

- 🎤 **Record or upload** audio (drag-and-drop supported)
- 📝 **Transcribe** speech locally using faster-whisper
- ✏️ **Auto-correct** grammar & fluency with a local LLM (Ollama / llama3.2:3b)
- 🔊 **Synthesize** native-sounding audio via XTTS-v2
- 🔁 **Before/after comparison** audio player
- 🌍 **Speaker modes:** Preserve voice · US Male · US Female · British
- 🎭 **Voice cloning** from a sample clip (XTTS-v2)
- 📤 **Export** as TXT, WAV, or MP3
- 📦 **Batch processing** mode for multiple files
- 🖥️ **100% offline** after model download
- ⚡ **GPU acceleration** (CUDA) supported

---

## 🖼️ Screenshots

> _Screenshots coming soon — run the app to see the live UI._

---

## 🛠️ Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| FFmpeg | Any recent | [ffmpeg.org](https://ffmpeg.org/download.html) — must be in PATH |
| Ollama | Latest | [ollama.com](https://ollama.com) |
| CUDA Toolkit | 11.8+ | Optional — for GPU acceleration |

---

## 🚀 Quick Start (3 commands)

```bash
# 1. Clone the repo
git clone https://github.com/yourname/nativeify.git
cd nativeify

# 2. Install all dependencies
make install

# 3. Download AI models (~4GB total)
make download-models

# 4. Start the app
make start
# → Opens http://localhost:3000
```

---

## 🔧 Manual Setup

### 1. Clone

```bash
git clone https://github.com/yourname/nativeify.git
cd nativeify
```

### 2. Configure environment

```bash
# Copy the example env files
cp .env.example .env
cp backend/.env.example backend/.env
```

Edit `backend/.env` to configure model paths, GPU settings, etc.

### 3. Backend setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate
# Activate (Linux/macOS)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create output directory
mkdir output
```

### 4. Frontend setup

```bash
cd frontend
npm install
```

### 5. Start services

**Terminal 1 — Backend:**
```bash
cd backend
.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## ⚡ GPU Setup (CUDA)

For GPU-accelerated transcription and TTS:

```bash
# Install PyTorch with CUDA 11.8
pip install torch==2.5.1+cu118 torchaudio==2.5.1+cu118 --index-url https://download.pytorch.org/whl/cu118

# Set in backend/.env:
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=float16
TTS_DEVICE=cuda
```

Verify GPU is detected:
```bash
python -c "import torch; print(torch.cuda.is_available())"
```

---

## 🦙 Ollama Setup

### Install Ollama

**Windows:**
Download from [ollama.com/download](https://ollama.com/download/windows)

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Pull the grammar model

```bash
# Recommended: fast, 2GB RAM
ollama pull llama3.2:3b

# Alternative: higher quality, 4GB RAM
ollama pull mistral:7b

# Verify it's running
ollama list
```

### Verify Ollama is accessible

```bash
curl http://localhost:11434/api/tags
```

---

## 📥 Model Download

Download all AI models in one command:

```bash
python scripts/download_models.py
```

This downloads:
| Model | Size | Purpose |
|---|---|---|
| faster-whisper medium | ~1.5 GB | Speech transcription |
| XTTS-v2 | ~1.8 GB | Text-to-speech synthesis |
| llama3.2:3b (via Ollama) | ~2.0 GB | Grammar correction |

> **Total:** ~5.3 GB disk space required

---

## 📡 API Reference

Base URL: `http://localhost:8000/api/v1`

### `GET /health`
Check service status.

**Response:**
```json
{
  "status": "ok",
  "services": {
    "whisper": "ready",
    "ollama": "ready",
    "tts": "ready"
  },
  "version": "1.0.0"
}
```

---

### `POST /transcribe`
Transcribe an audio file to text.

**Request:** `multipart/form-data`
```
audio: <audio file>  (wav, mp3, ogg, flac, m4a)
language: en         (optional)
vad_filter: true     (optional)
```

**Response:**
```json
{
  "text": "Hello, my name is John and I want to talk about...",
  "language": "en",
  "duration": 12.5,
  "words": [
    { "word": "Hello", "start": 0.0, "end": 0.4 }
  ]
}
```

---

### `POST /correct`
Correct grammar and improve fluency.

**Request:** `application/json`
```json
{
  "text": "I am go to store yesterday for buy some milk.",
  "style": "native"
}
```

**Response:**
```json
{
  "original": "I am go to store yesterday for buy some milk.",
  "corrected": "I went to the store yesterday to buy some milk.",
  "diff": [
    { "type": "delete", "text": "am go" },
    { "type": "insert", "text": "went" },
    { "type": "equal", "text": " to " },
    { "type": "delete", "text": "store" },
    { "type": "insert", "text": "the store" }
  ],
  "changes_count": 4
}
```

---

### `POST /synthesize`
Generate speech audio from text.

**Request:** `multipart/form-data`
```
data: {"text": "...", "speaker": "us_female", "speed": 1.0}
voice_sample: <wav file>  (optional — for voice cloning)
```

**Response:**
```json
{
  "audio_url": "/output/abc123.wav",
  "duration": 5.2,
  "sample_rate": 24000
}
```

---

### `POST /process-all`
Run the full pipeline in one call: transcribe → correct → synthesize.

**Request:** `multipart/form-data`
```
audio: <audio file>
options: {"language": "en", "speaker": "us_female", "style": "native", "vad_filter": true}
```

**Response:**
```json
{
  "transcription": { ... },
  "correction": { ... },
  "synthesis": { ... },
  "processing_time": 8.4
}
```

---

## ⚙️ Configuration Reference

All settings are controlled via environment variables in `backend/.env`:

| Variable | Default | Description |
|---|---|---|
| `BACKEND_PORT` | `8000` | FastAPI server port |
| `WHISPER_MODEL_SIZE` | `medium` | `tiny`·`base`·`small`·`medium`·`large-v3` |
| `WHISPER_DEVICE` | `auto` | `auto`·`cpu`·`cuda` |
| `WHISPER_COMPUTE_TYPE` | `float16` | `float16`·`int8`·`float32` |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.2:3b` | LLM model name |
| `OLLAMA_TIMEOUT` | `60` | Request timeout (seconds) |
| `TTS_ENGINE` | `xtts` | `xtts`·`fish` |
| `TTS_DEVICE` | `auto` | `auto`·`cpu`·`cuda` |
| `OUTPUT_DIR` | `./output` | Generated audio output directory |
| `MAX_AUDIO_DURATION` | `300` | Max input audio length (seconds) |

---

## 🐳 Docker Setup

Run everything with Docker Compose (GPU optional):

```bash
# Build and start all services
make docker-up

# View logs
make docker-logs

# Stop
make docker-down
```

For GPU support, ensure [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) is installed.

---

## 🔧 Troubleshooting

### ❌ `Ollama connection refused`
Ensure Ollama is running:
```bash
ollama serve
# or on Windows: open Ollama from system tray
```

### ❌ `CUDA out of memory`
Switch to CPU or use a smaller model:
```env
WHISPER_MODEL_SIZE=small
WHISPER_DEVICE=cpu
TTS_DEVICE=cpu
```

### ❌ `ffmpeg not found`
Install FFmpeg and ensure it's in your PATH:
```bash
# Windows (via winget)
winget install ffmpeg

# Verify
ffmpeg -version
```

### ❌ XTTS model download fails
Download manually:
```python
from TTS.api import TTS
TTS("tts_models/multilingual/multi-dataset/xtts_v2")
```

### ❌ Frontend can't reach backend
Check CORS setting in `backend/.env`:
```env
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```
And verify backend is running on port 8000.

### ❌ `WebRTC VAD error` on Windows
Install the Visual C++ Redistributable:
[Download here](https://aka.ms/vs/17/release/vc_redist.x64.exe)

---

## 📁 Project Structure

```
nativeify/
├── frontend/          # React + TypeScript + TailwindCSS UI
├── backend/           # Python FastAPI AI pipeline
├── models/            # Downloaded AI models (git-ignored)
├── output/            # Generated audio files (git-ignored)
├── docker/            # Docker Compose + Dockerfiles
├── scripts/           # Setup and start scripts
├── PLAN.md            # Detailed implementation plan
└── README.md          # This file
```

---

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

[MIT License](LICENSE) — free to use, modify, and distribute.

---

<p align="center">Built with ❤️ using faster-whisper · Ollama · XTTS-v2 · FastAPI · React</p>
