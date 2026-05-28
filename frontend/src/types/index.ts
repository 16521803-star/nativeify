/**
 * Nativeify Frontend — TypeScript Type Definitions
 *
 * Central type file for all data shapes used across the app.
 * Mirrors the backend Pydantic schemas exactly.
 */

// =============================================================
//  Enumerations
// =============================================================

/** Available TTS speaker / voice modes */
export type SpeakerMode = 'preserve' | 'us_male' | 'us_female' | 'british'

/** Grammar correction style */
export type CorrectionStyle = 'native' | 'formal' | 'casual'

/** Steps in the processing pipeline */
export type PipelineStep =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'transcribing'
  | 'correcting'
  | 'synthesizing'
  | 'done'
  | 'error'

/** App navigation pages */
export type AppPage = 'main' | 'batch' | 'settings'

/** Audio export formats */
export type ExportFormat = 'txt' | 'wav' | 'mp3'

/** TTS engine backend */
export type TTSEngine = 'xtts' | 'fish'

/** Batch item status */
export type BatchItemStatus = 'pending' | 'processing' | 'done' | 'error'

// =============================================================
//  API Response Types (mirrors backend Pydantic schemas)
// =============================================================

/** A single word with start/end timestamps from Whisper */
export interface WordTimestamp {
  word: string
  start: number
  end: number
  probability: number
}

/** Response from POST /api/v1/transcribe */
export interface TranscribeResult {
  text: string
  language: string
  duration: number
  words: WordTimestamp[]
}

/** A single chunk in an original ↔ corrected text diff */
export interface DiffChunk {
  /** 'equal' | 'insert' | 'delete' */
  type: 'equal' | 'insert' | 'delete'
  text: string
}

/** Response from POST /api/v1/correct */
export interface CorrectResult {
  original: string
  corrected: string
  diff: DiffChunk[]
  changes_count: number
}

/** Response from POST /api/v1/synthesize */
export interface SynthesizeResult {
  /** Relative URL path — prefix with backend base URL to play */
  audio_url: string
  duration: number
  sample_rate: number
}

/** Per-step timing breakdown from the pipeline */
export interface ProcessTimings {
  transcription_s: number
  correction_s: number
  synthesis_s: number
  total_s: number
}

/** Response from POST /api/v1/process-all */
export interface ProcessResult {
  transcription: TranscribeResult
  correction: CorrectResult
  synthesis: SynthesizeResult
  timings: ProcessTimings
}

/** Per-service status from GET /api/v1/health */
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error'
  version: string
  services: {
    whisper: string
    ollama: string
    tts: string
    audio: string
  }
}

/** Speaker preset metadata from GET /api/v1/health/speakers */
export interface SpeakerPreset {
  mode: SpeakerMode
  label: string
  description: string
  icon: string
  requires_sample: boolean
}

/** Standard error shape from the backend */
export interface ApiError {
  error: string
  detail?: string
  code: number
}

// =============================================================
//  Pipeline State
// =============================================================

/** Full state of a single pipeline step */
export interface StepState {
  status: 'waiting' | 'active' | 'done' | 'error'
  label: string
  detail?: string
  durationMs?: number
}

export interface PipelineState {
  steps: {
    transcribe: StepState
    correct: StepState
    synthesize: StepState
  }
  overall: PipelineStep
  progress: number   // 0–100
  errorMessage?: string
}

// =============================================================
//  App Settings
// =============================================================

export interface AppSettings {
  /** Whisper model size */
  whisperModel: 'tiny' | 'base' | 'small' | 'medium' | 'large-v2' | 'large-v3'
  /** Ollama model name */
  ollamaModel: string
  /** TTS engine */
  ttsEngine: TTSEngine
  /** TTS/Whisper device */
  device: 'auto' | 'cpu' | 'cuda'
  /** Apply noise reduction before transcription */
  noiseReduction: boolean
  /** Enable VAD silence filtering */
  vadFilter: boolean
  /** Grammar correction style */
  correctionStyle: CorrectionStyle
  /** TTS speaking speed */
  ttsSpeed: number
  /** Backend API base URL */
  apiBaseUrl: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  whisperModel: 'medium',
  ollamaModel: 'llama3.2:3b',
  ttsEngine: 'xtts',
  device: 'auto',
  noiseReduction: false,
  vadFilter: true,
  correctionStyle: 'native',
  ttsSpeed: 1.0,
  apiBaseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1',
}

// =============================================================
//  Batch Processing
// =============================================================

export interface BatchJob {
  id: string
  filename: string
  file: File
  status: BatchItemStatus
  result?: ProcessResult
  error?: string
  /** Duration of processing in ms */
  processingMs?: number
}

// =============================================================
//  Audio State
// =============================================================

export interface AudioState {
  /** URL for the original recorded/uploaded audio */
  originalUrl: string | null
  /** URL for the synthesized output audio */
  outputUrl: string | null
  /** Duration of the original audio in seconds */
  originalDuration: number | null
  /** Duration of the synthesized audio in seconds */
  outputDuration: number | null
  /** The raw Blob from MediaRecorder (if recorded in-browser) */
  recordingBlob: Blob | null
  /** Recording duration in seconds (live counter) */
  recordingDuration: number
  /** Whether the mic is currently recording */
  isRecording: boolean
}

// =============================================================
//  UI State Helpers
// =============================================================

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  durationMs?: number
}

/** Props shared by all page components */
export interface PageProps {
  className?: string
}
