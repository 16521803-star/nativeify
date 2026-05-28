# Nativeify — Master Implementation Plan

> **Goal:** Local AI app that converts English speech → fluent native-level English audio. Fully offline. No cloud dependencies.

---

## Design Decisions (Locked)

| Concern | Choice | Reason |
|---|---|---|
| Frontend | React + TypeScript + TailwindCSS (browser-based, port 3000) | Simpler than Electron, still polished |
| Backend | Python FastAPI (port 8000) | Async, fast, great for AI pipelines |
| STT | faster-whisper (medium model) | Fast, accurate, runs CPU/GPU |
| LLM | Ollama → llama3.2:3b | Fast, ~2GB RAM, great grammar quality |
| TTS | XTTS-v2 (default) + Fish Speech option | Best voice quality + voice cloning |
| Audio | FFmpeg | Universal audio processing |
| State | Zustand | Lightweight, no boilerplate |
| Styling | TailwindCSS + custom CSS vars | ElevenLabs-inspired dark UI |

---

## Directory Structure (Final)

```
nativeify/
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Spinner.tsx
│   │   │   │   └── Tooltip.tsx
│   │   │   ├── AudioPlayer.tsx
│   │   │   ├── BatchPage.tsx (moved here if simple)
│   │   │   ├── DiffViewer.tsx
│   │   │   ├── DropZone.tsx
│   │   │   ├── ExportPanel.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── ProgressPipeline.tsx
│   │   │   ├── RecordButton.tsx
│   │   │   ├── SettingsPanel.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TranscriptPanel.tsx
│   │   │   ├── VoiceSelector.tsx
│   │   │   └── WaveformVisualizer.tsx
│   │   ├── hooks/
│   │   │   ├── useAudioRecorder.ts
│   │   │   ├── useWaveform.ts
│   │   │   └── useKeyboardShortcuts.ts
│   │   ├── pages/
│   │   │   ├── MainPage.tsx
│   │   │   ├── BatchPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── store/
│   │   │   └── useAppStore.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── correct.py
│   │   │   │   ├── health.py
│   │   │   │   ├── process.py
│   │   │   │   ├── synthesize.py
│   │   │   │   └── transcribe.py
│   │   │   ├── __init__.py
│   │   │   └── router.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── dependencies.py
│   │   │   └── logging_config.py
│   │   ├── models/
│   │   │   └── schemas.py
│   │   ├── services/
│   │   │   ├── audio.py
│   │   │   ├── correction.py
│   │   │   ├── synthesis.py
│   │   │   └── transcription.py
│   │   └── main.py
│   ├── .env.example
│   └── requirements.txt
│
├── models/
│   └── .gitkeep
│
├── docker/
│   ├── .dockerignore
│   ├── Dockerfile.backend
│   └── docker-compose.yml
│
├── scripts/
│   ├── download_models.py
│   ├── setup.ps1
│   ├── setup.sh
│   ├── start.ps1
│   └── start.sh
│
├── .env.example
├── .gitignore
├── LICENSE
├── Makefile
└── README.md
```

---

## Phase 1 — Root Config Files

**Files to create:**

### `.gitignore`
```
# Python
__pycache__/
*.pyc
*.pyo
.venv/
venv/
*.egg-info/
dist/
.pytest_cache/

# Node
node_modules/
frontend/dist/
frontend/.vite/

# Models (large binary files)
models/**/*.bin
models/**/*.pth
models/**/*.onnx
models/**/*.safetensors
!models/.gitkeep

# Env
.env
backend/.env

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Audio output
output/
```

### `.env.example`
```env
# ── Backend ─────────────────────────────────────────────
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
BACKEND_RELOAD=true
LOG_LEVEL=info

# ── Whisper STT ──────────────────────────────────────────
WHISPER_MODEL_SIZE=medium        # tiny | base | small | medium | large-v3
WHISPER_DEVICE=auto              # auto | cpu | cuda
WHISPER_COMPUTE_TYPE=float16     # float16 | int8 | float32
WHISPER_LANGUAGE=en

# ── Ollama LLM ───────────────────────────────────────────
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_TIMEOUT=60

# ── TTS Engine ───────────────────────────────────────────
TTS_ENGINE=xtts                  # xtts | fish
XTTS_MODEL_PATH=./models/xtts
FISH_MODEL_PATH=./models/fish
TTS_DEVICE=auto                  # auto | cpu | cuda

# ── Audio ────────────────────────────────────────────────
FFMPEG_PATH=ffmpeg               # path to ffmpeg binary
OUTPUT_DIR=./output
MAX_AUDIO_DURATION=300           # seconds (5 min limit)

# ── CORS ─────────────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### `Makefile`
```makefile
.PHONY: install backend frontend start stop docker-up docker-down lint test clean

# ── Setup ────────────────────────────────────────────────
install:
	@echo "Installing backend dependencies..."
	cd backend && python -m venv .venv && .venv\Scripts\pip install -r requirements.txt
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "Done! Run 'make start' to launch."

# ── Dev ──────────────────────────────────────────────────
backend:
	cd backend && .venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

frontend:
	cd frontend && npm run dev

start:
	@echo "Starting Nativeify..."
	powershell -ExecutionPolicy Bypass -File scripts/start.ps1

# ── Docker ───────────────────────────────────────────────
docker-up:
	docker compose -f docker/docker-compose.yml up -d

docker-down:
	docker compose -f docker/docker-compose.yml down

# ── QA ───────────────────────────────────────────────────
lint:
	cd backend && .venv\Scripts\ruff check app/
	cd frontend && npm run lint

test:
	cd backend && .venv\Scripts\pytest tests/ -v

clean:
	cd frontend && rm -rf dist node_modules/.cache
	cd backend && find . -name "__pycache__" -exec rm -rf {} +
```

### `LICENSE`
Standard MIT License with current year and "Nativeify Contributors".

### `README.md`
See Phase 9 for full content.

---

## Phase 2 — Backend Core

### `backend/requirements.txt`
```
fastapi==0.115.5
uvicorn[standard]==0.32.1
python-multipart==0.0.12
httpx==0.28.1
pydantic==2.10.3
pydantic-settings==2.6.1
loguru==0.7.3
faster-whisper==1.1.0
TTS==0.22.0
torch==2.5.1
torchaudio==2.5.1
aiofiles==24.1.0
python-dotenv==1.0.1
ruff==0.8.4
pytest==8.3.4
pytest-asyncio==0.24.0
diff-match-patch==20241021
webrtcvad==2.0.10
noisereduce==3.0.3
soundfile==0.12.1
numpy==2.1.3
```

### `backend/app/core/config.py`
```python
from pydantic_settings import BaseSettings
from pathlib import Path
from functools import lru_cache

class Settings(BaseSettings):
    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_reload: bool = True
    log_level: str = "info"

    # Whisper
    whisper_model_size: str = "medium"
    whisper_device: str = "auto"
    whisper_compute_type: str = "float16"
    whisper_language: str = "en"

    # Ollama
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    ollama_timeout: int = 60

    # TTS
    tts_engine: str = "xtts"
    xtts_model_path: Path = Path("./models/xtts")
    fish_model_path: Path = Path("./models/fish")
    tts_device: str = "auto"

    # Audio
    ffmpeg_path: str = "ffmpeg"
    output_dir: Path = Path("./output")
    max_audio_duration: int = 300

    # CORS
    allowed_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

### `backend/app/core/logging_config.py`
```python
import sys
from loguru import logger
from app.core.config import get_settings

def setup_logging():
    settings = get_settings()
    logger.remove()
    logger.add(sys.stderr, level=settings.log_level.upper(),
               format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{line}</cyan> — <level>{message}</level>")
    logger.add("logs/nativeify.log", rotation="10 MB", retention="7 days",
               level="DEBUG", compression="zip")
    return logger
```

### `backend/app/core/dependencies.py`
Singleton service holders loaded at startup via FastAPI lifespan. Returns cached service instances.

### `backend/app/models/schemas.py`
```python
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum

class SpeakerMode(str, Enum):
    PRESERVE = "preserve"
    US_MALE = "us_male"
    US_FEMALE = "us_female"
    BRITISH = "british"

class TranscribeRequest(BaseModel):
    language: str = "en"
    vad_filter: bool = True

class TranscribeResponse(BaseModel):
    text: str
    language: str
    duration: float
    words: list[dict] = []

class CorrectRequest(BaseModel):
    text: str
    style: str = "native"  # native | formal | casual

class CorrectResponse(BaseModel):
    original: str
    corrected: str
    diff: list[dict]      # [{type: "equal"|"insert"|"delete", text: str}]
    changes_count: int

class SynthesizeRequest(BaseModel):
    text: str
    speaker: SpeakerMode = SpeakerMode.US_FEMALE
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    voice_sample_path: Optional[str] = None

class SynthesizeResponse(BaseModel):
    audio_url: str
    duration: float
    sample_rate: int

class ProcessAllRequest(BaseModel):
    language: str = "en"
    speaker: SpeakerMode = SpeakerMode.US_FEMALE
    style: str = "native"
    vad_filter: bool = True

class ProcessAllResponse(BaseModel):
    transcription: TranscribeResponse
    correction: CorrectResponse
    synthesis: SynthesizeResponse
    processing_time: float

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    code: int
```

### `backend/app/main.py`
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import get_settings
from app.core.logging_config import setup_logging
from app.core.dependencies import startup_services, shutdown_services
from app.api.router import api_router
import os

logger = setup_logging()
settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Nativeify backend starting...")
    os.makedirs(settings.output_dir, exist_ok=True)
    await startup_services()
    logger.info("✅ All services ready")
    yield
    logger.info("🛑 Shutting down...")
    await shutdown_services()

app = FastAPI(
    title="Nativeify API",
    description="Local AI speech-to-native-speech pipeline",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve generated audio files
app.mount("/output", StaticFiles(directory=str(settings.output_dir)), name="output")

app.include_router(api_router, prefix="/api/v1")
```

---

## Phase 3 — Backend Services

### `backend/app/services/transcription.py`

**Purpose:** Wraps faster-whisper for async audio transcription.

**Key implementation points:**
- Load model once at startup (singleton pattern)
- Accept audio file path, return TranscribeResponse
- Support VAD filter (built into faster-whisper)
- Auto-detect GPU vs CPU
- Return word-level timestamps

```python
# Key logic sketch:
class TranscriptionService:
    def __init__(self, settings):
        device = self._resolve_device(settings.whisper_device)
        self.model = WhisperModel(
            settings.whisper_model_size,
            device=device,
            compute_type=settings.whisper_compute_type
        )

    async def transcribe(self, audio_path: str, vad_filter=True) -> TranscribeResponse:
        # Run in thread pool (CPU-bound)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, self._transcribe_sync, audio_path, vad_filter)
        return result

    def _transcribe_sync(self, audio_path, vad_filter):
        segments, info = self.model.transcribe(audio_path, vad_filter=vad_filter,
                                                word_timestamps=True)
        full_text = " ".join(s.text for s in segments)
        return TranscribeResponse(text=full_text.strip(), ...)
```

### `backend/app/services/correction.py`

**Purpose:** Uses Ollama to grammar-correct and fluency-improve the text.

**Key implementation points:**
- Async httpx client to Ollama REST API
- Carefully engineered system prompt for native-English correction
- Generate diff using `diff-match-patch`
- Handle Ollama not running (graceful error)

**System prompt template:**
```
You are a native English language editor. The user will give you a transcribed speech text.
Your job is to:
1. Fix all grammar and spelling errors
2. Make the text sound natural and fluent like a native speaker
3. Preserve the original meaning exactly
4. Keep the same formality level
5. Return ONLY the corrected text, nothing else. No explanations.
```

```python
class CorrectionService:
    async def correct(self, text: str) -> CorrectResponse:
        corrected = await self._call_ollama(text)
        diff = self._generate_diff(text, corrected)
        return CorrectResponse(original=text, corrected=corrected, diff=diff, ...)

    async def _call_ollama(self, text: str) -> str:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f"{self.ollama_host}/api/generate", json={
                "model": self.model,
                "prompt": f"[INST]{SYSTEM_PROMPT}\n\nText: {text}[/INST]",
                "stream": False,
            })
        return response.json()["response"].strip()
```

### `backend/app/services/synthesis.py`

**Purpose:** Text-to-speech using XTTS-v2.

**Key implementation points:**
- Lazy load TTS model (heavy, ~2GB)
- Speaker presets defined as reference audio paths or speaker names
- Generate to output dir with unique filename
- Support voice cloning: accepts sample WAV path
- Return relative URL path for frontend

**Speaker presets (XTTS-v2 built-in voices):**
```python
SPEAKER_MAP = {
    "us_male": "Aaron Dreschner",
    "us_female": "Claribel Dervla",
    "british": "Viktor Eka",  # closest British available
}
```

```python
class SynthesisService:
    def _load_model(self):
        from TTS.api import TTS
        self.tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(self.device)

    async def synthesize(self, text, speaker, voice_sample=None) -> SynthesizeResponse:
        output_path = self.output_dir / f"{uuid4()}.wav"
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._synthesize_sync, text, speaker, voice_sample, output_path)
        return SynthesizeResponse(audio_url=f"/output/{output_path.name}", ...)
```

### `backend/app/services/audio.py`

**Purpose:** FFmpeg-based audio processing.

**Key implementation points:**
- Convert any input format to 16kHz mono WAV (required by Whisper)
- Apply noise reduction
- Convert WAV → MP3 for export
- Extract duration

```python
class AudioService:
    async def prepare_for_transcription(self, input_path: str) -> str:
        """Convert to 16kHz mono WAV."""
        output_path = input_path.replace(".", "_processed.")
        cmd = [self.ffmpeg, "-i", input_path, "-ar", "16000", "-ac", "1",
               "-f", "wav", output_path, "-y"]
        await self._run_ffmpeg(cmd)
        return output_path

    async def convert_to_mp3(self, wav_path: str) -> str:
        mp3_path = wav_path.replace(".wav", ".mp3")
        cmd = [self.ffmpeg, "-i", wav_path, "-codec:a", "libmp3lame",
               "-qscale:a", "2", mp3_path, "-y"]
        await self._run_ffmpeg(cmd)
        return mp3_path

    async def reduce_noise(self, input_path: str) -> str:
        # FFmpeg afftdn filter
        ...
```

---

## Phase 4 — Backend API Routes

### `GET /api/v1/health`
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

### `POST /api/v1/transcribe`
- **Input:** `multipart/form-data` with `audio` file + optional `language`, `vad_filter`
- **Flow:** Save upload → AudioService.prepare() → TranscriptionService.transcribe()
- **Output:** `TranscribeResponse`

### `POST /api/v1/correct`
- **Input:** `application/json` `{ text, style }`
- **Flow:** CorrectionService.correct(text)
- **Output:** `CorrectResponse` with diff

### `POST /api/v1/synthesize`
- **Input:** `multipart/form-data` with `data` (JSON) + optional `voice_sample` file
- **Flow:** SynthesisService.synthesize()
- **Output:** `SynthesizeResponse` with audio URL

### `POST /api/v1/process-all`
- **Input:** `multipart/form-data` with `audio` file + `options` JSON
- **Flow:** transcribe → correct → synthesize (sequential, logs each step)
- **Output:** `ProcessAllResponse`

### `backend/app/api/router.py`
```python
from fastapi import APIRouter
from app.api.routes import health, transcribe, correct, synthesize, process

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(transcribe.router, prefix="/transcribe", tags=["Transcription"])
api_router.include_router(correct.router, prefix="/correct", tags=["Correction"])
api_router.include_router(synthesize.router, prefix="/synthesize", tags=["Synthesis"])
api_router.include_router(process.router, prefix="/process-all", tags=["Pipeline"])
```

---

## Phase 5 — Frontend Scaffold

### `frontend/package.json` — key dependencies:
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "zustand": "^5.0.2",
    "wavesurfer.js": "^7.8.12",
    "diff-match-patch": "^1.0.5",
    "lucide-react": "^0.468.0",
    "framer-motion": "^11.15.0",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.2",
    "tailwindcss": "^3.4.17",
    "autoprefixer": "^10.4.20",
    "vite": "^6.0.5"
  }
}
```

### `frontend/tailwind.config.ts` — Custom dark theme:
```typescript
// Extend with custom Nativeify color palette:
colors: {
  surface: {
    DEFAULT: '#0A0A0F',   // deepest background
    1: '#111118',         // card background
    2: '#1A1A24',         // elevated card
    3: '#24242F',         // input/hover
  },
  accent: {
    DEFAULT: '#7C5CFC',   // primary purple (ElevenLabs-inspired)
    hover: '#9B82FD',
    dim: '#7C5CFC33',
  },
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  text: {
    primary: '#F1F0FF',
    secondary: '#8B89A8',
    muted: '#4A4860',
  }
}
```

### `frontend/src/index.css`
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --accent: #7C5CFC;
  --accent-glow: #7C5CFC44;
}

* { box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; background: #0A0A0F; color: #F1F0FF; }

/* Custom scrollbar */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #4A4860; border-radius: 4px; }

/* Glowing accent animations */
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 var(--accent-glow); }
  50% { box-shadow: 0 0 20px 8px var(--accent-glow); }
}
.glow-pulse { animation: pulse-glow 2s ease-in-out infinite; }
```

---

## Phase 6 — Frontend Types & State

### `frontend/src/types/index.ts`
```typescript
export type SpeakerMode = 'preserve' | 'us_male' | 'us_female' | 'british';
export type PipelineStep = 'idle' | 'recording' | 'transcribing' | 'correcting' | 'synthesizing' | 'done' | 'error';
export type ExportFormat = 'txt' | 'wav' | 'mp3';
export type AppPage = 'main' | 'batch' | 'settings';

export interface DiffChunk {
  type: 'equal' | 'insert' | 'delete';
  text: string;
}

export interface TranscribeResult {
  text: string;
  language: string;
  duration: number;
  words: Array<{ word: string; start: number; end: number }>;
}

export interface CorrectResult {
  original: string;
  corrected: string;
  diff: DiffChunk[];
  changes_count: number;
}

export interface SynthesizeResult {
  audio_url: string;
  duration: number;
  sample_rate: number;
}

export interface ProcessResult {
  transcription: TranscribeResult;
  correction: CorrectResult;
  synthesis: SynthesizeResult;
  processing_time: number;
}

export interface AppSettings {
  whisperModel: string;
  ollamaModel: string;
  ttsEngine: 'xtts' | 'fish';
  ttsDevice: 'auto' | 'cpu' | 'cuda';
  noiseReduction: boolean;
  vadFilter: boolean;
  correctionStyle: 'native' | 'formal' | 'casual';
}
```

### `frontend/src/store/useAppStore.ts`
```typescript
// Zustand store — single source of truth
interface AppState {
  // Navigation
  currentPage: AppPage;

  // Recording
  isRecording: boolean;
  recordingBlob: Blob | null;
  recordingDuration: number;

  // Pipeline
  pipelineStep: PipelineStep;
  progress: number; // 0-100

  // Results
  transcription: TranscribeResult | null;
  correction: CorrectResult | null;
  synthesis: SynthesizeResult | null;

  // Audio (original uploaded/recorded)
  originalAudioUrl: string | null;
  outputAudioUrl: string | null;

  // Settings
  speakerMode: SpeakerMode;
  settings: AppSettings;
  voiceSampleFile: File | null;

  // UI
  error: string | null;
  apiBaseUrl: string;

  // Actions
  setPage: (page: AppPage) => void;
  setRecording: (v: boolean) => void;
  setRecordingBlob: (blob: Blob | null) => void;
  setStep: (step: PipelineStep, progress?: number) => void;
  setResults: (t: TranscribeResult, c: CorrectResult, s: SynthesizeResult) => void;
  setSpeaker: (mode: SpeakerMode) => void;
  setSettings: (s: Partial<AppSettings>) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}
```

### `frontend/src/services/api.ts`
```typescript
// Typed API client

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

export async function transcribeAudio(blob: Blob, options?: {...}): Promise<TranscribeResult>
export async function correctText(text: string, style?: string): Promise<CorrectResult>
export async function synthesizeAudio(text: string, speaker: SpeakerMode, voiceSample?: File): Promise<SynthesizeResult>
export async function processAll(blob: Blob, options: ProcessOptions): Promise<ProcessResult>
export async function checkHealth(): Promise<HealthResponse>
```

---

## Phase 7 — Frontend Components

### Component Inventory

| Component | Description | Key Libraries |
|---|---|---|
| `Header` | App logo, nav tabs, status dot | lucide-react |
| `Sidebar` | Page navigation | framer-motion |
| `RecordButton` | Animated mic button, start/stop | Web Audio API |
| `WaveformVisualizer` | Live + playback waveform | wavesurfer.js |
| `AudioPlayer` | Before/after comparison player | wavesurfer.js |
| `DropZone` | Drag-and-drop file upload | HTML5 DnD API |
| `TranscriptPanel` | Shows original + corrected text | - |
| `DiffViewer` | Word-level diff highlighting | diff-match-patch |
| `VoiceSelector` | Speaker mode radio picker | framer-motion |
| `ProgressPipeline` | 4-step progress bar | framer-motion |
| `ExportPanel` | TXT/WAV/MP3 download buttons | - |
| `SettingsPanel` | Model config form | - |
| `ui/Button` | Styled button variants | clsx |
| `ui/Badge` | Status badges | - |
| `ui/Spinner` | Loading spinner | CSS animation |

### `RecordButton.tsx` — Behavior:
- Default state: circular purple mic button
- On click: starts recording (MediaRecorder API)
- Recording state: pulsing red dot, shows timer, waveform animates
- On stop: saves blob, triggers pipeline

### `WaveformVisualizer.tsx` — Behavior:
- Uses WaveSurfer.js
- Shows live input bar chart during recording
- Shows full waveform for recorded/uploaded file
- Colored accent gradient on waveform fill

### `DiffViewer.tsx` — Behavior:
- Green highlight = added text (insertions)
- Red strikethrough = removed text (deletions)
- White = unchanged
- Word-level granularity

### `VoiceSelector.tsx` — Options:
```
🎤 Preserve Voice   → use voice cloning with recorded sample
👨🇺🇸 US Male       → Aaron (XTTS built-in)
👩🇺🇸 US Female     → Claribel (XTTS built-in)
🎩 British          → Viktor (XTTS built-in)
```

### `ProgressPipeline.tsx` — Steps:
```
[1. Record/Upload] → [2. Transcribe] → [3. Correct] → [4. Synthesize]
```
Each step has: icon, label, status (waiting/active/done/error)

---

## Phase 8 — Frontend Pages

### `MainPage.tsx` — Layout
```
┌─────────────────────────────────────────────┐
│  Header (logo + nav)                        │
├──────────┬──────────────────────────────────┤
│ Sidebar  │   Main Content Area             │
│          │  ┌────────────────────────────┐  │
│ • Main   │  │  DropZone / RecordButton   │  │
│ • Batch  │  │  WaveformVisualizer        │  │
│ • Settings│  │  VoiceSelector             │  │
│          │  │  [Process Button]           │  │
│          │  │  ProgressPipeline           │  │
│          │  ├────────────────────────────┤  │
│          │  │  TranscriptPanel (split)   │  │
│          │  │  DiffViewer                │  │
│          │  ├────────────────────────────┤  │
│          │  │  AudioPlayer (before/after)│  │
│          │  │  ExportPanel               │  │
│          │  └────────────────────────────┘  │
└──────────┴──────────────────────────────────┘
```

### `BatchPage.tsx` — Layout
- File list table (drag multiple files)
- Queue with status per file
- Bulk download when done

### `SettingsPage.tsx` — Sections
- Model Configuration (Whisper size, Ollama model, TTS engine)
- Audio Settings (noise reduction, VAD)
- API Connection (backend URL, health status)
- Advanced (GPU device, compute type)

---

## Phase 9 — Docker & Scripts

### `docker/docker-compose.yml`
```yaml
version: '3.9'
services:
  backend:
    build:
      context: ../backend
      dockerfile: ../docker/Dockerfile.backend
    ports: ["8000:8000"]
    volumes:
      - ../models:/app/models
      - ../output:/app/output
    environment:
      - OLLAMA_HOST=http://ollama:11434
    depends_on: [ollama]
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

  ollama:
    image: ollama/ollama:latest
    ports: ["11434:11434"]
    volumes:
      - ollama_data:/root/.ollama

volumes:
  ollama_data:
```

### `docker/Dockerfile.backend`
```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### `scripts/start.ps1`
```powershell
# One-command Windows startup
Write-Host "Starting Nativeify..." -ForegroundColor Cyan

# Start Ollama if not running
if (-not (Get-Process -Name "ollama" -ErrorAction SilentlyContinue)) {
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep 2
}

# Start backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

# Start frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "✅ Nativeify running at http://localhost:3000" -ForegroundColor Green
Start-Process "http://localhost:3000"
```

### `scripts/download_models.py`
```python
# Downloads:
# 1. faster-whisper medium model (auto-download via library)
# 2. XTTS-v2 model (auto-download via TTS library)
# 3. Pulls llama3.2:3b via Ollama CLI

import subprocess, sys
from TTS.api import TTS
from faster_whisper import WhisperModel

def download_whisper():
    print("Downloading Whisper medium model...")
    WhisperModel("medium", device="cpu")

def download_xtts():
    print("Downloading XTTS-v2 model (~1.8GB)...")
    TTS("tts_models/multilingual/multi-dataset/xtts_v2")

def download_ollama_model():
    print("Pulling llama3.2:3b via Ollama...")
    subprocess.run(["ollama", "pull", "llama3.2:3b"], check=True)

if __name__ == "__main__":
    download_whisper()
    download_xtts()
    download_ollama_model()
    print("✅ All models ready!")
```

---

## Phase 10 — README

### Sections:
1. **Overview** — what it does, screenshot placeholder
2. **Features** — bulleted list
3. **Prerequisites** — Python 3.12+, Node 20+, FFmpeg, Ollama
4. **Quick Start** (3 commands)
5. **Manual Setup** — step by step
6. **GPU Setup** — CUDA/ROCm config
7. **Ollama Setup** — install + pull model
8. **Model Download** — `python scripts/download_models.py`
9. **API Reference** — all endpoints with example request/response
10. **Configuration** — full `.env` reference table
11. **Troubleshooting** — common errors + fixes
12. **Contributing**
13. **License**

---

## Implementation Order (Recommended)

```
Phase 1  → Root config files (gitignore, env, Makefile, LICENSE)
Phase 2  → Backend core (main.py, config, logging, deps, schemas)
Phase 3  → Backend services (transcription → correction → synthesis → audio)
Phase 4  → Backend API routes + router
Phase 5  → Frontend scaffold (package.json, vite, tailwind, index.html)
Phase 6  → Frontend types, store, API client
Phase 7  → Frontend UI components
Phase 8  → Frontend pages (MainPage, BatchPage, SettingsPage)
Phase 9  → Docker + scripts
Phase 10 → README
```

**Estimated time per phase:** 15–30 min each
**Total estimated:** ~4–5 hours for full implementation

---

## Key Conventions

- **Python:** async/await throughout, type hints everywhere, loguru for logging
- **TypeScript:** strict mode, no `any`, named exports
- **API errors:** always return `ErrorResponse` with HTTP status code
- **File uploads:** use `/tmp/nativeify_*` temp files, clean up after processing
- **Audio:** always convert to 16kHz mono WAV before Whisper
- **CORS:** only allow `localhost:3000` in dev, configurable via env
- **Secrets:** never hardcode, always from `.env`
