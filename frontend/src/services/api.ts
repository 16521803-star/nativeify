/**
 * Nativeify Frontend — Typed API Client
 *
 * All HTTP calls to the FastAPI backend live here.
 * - Strongly typed request/response shapes
 * - Centralised error handling → throws ApiError
 * - Multipart form data support for file uploads
 * - Configurable base URL (from Zustand settings)
 */

import type {
  ApiError,
  CorrectResult,
  CorrectionStyle,
  HealthResponse,
  ProcessResult,
  SpeakerMode,
  SpeakerPreset,
  SynthesizeResult,
  TranscribeResult,
} from '@/types'

// =============================================================
//  Base URL
// =============================================================

/** Read from Vite env or fall back to localhost */
const DEFAULT_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

let _baseUrl = DEFAULT_BASE

/** Update base URL at runtime (e.g. from settings panel) */
export function setApiBaseUrl(url: string) {
  _baseUrl = url.replace(/\/$/, '')
}

export function getApiBaseUrl(): string {
  return _baseUrl
}

// =============================================================
//  Internal Fetch Wrapper
// =============================================================

/**
 * Core fetch wrapper that:
 * 1. Prepends the base URL
 * 2. Parses JSON responses
 * 3. Converts error responses into typed ApiError throws
 */
async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${_baseUrl}${path}`

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init.headers,
      },
    })
  } catch (networkErr) {
    // Network-level failure (no connection, backend down)
    throw {
      error: 'network_error',
      detail: `Cannot reach backend at ${_baseUrl}. Is the server running?`,
      code: 0,
    } satisfies ApiError
  }

  // Parse body (may be JSON or plain text)
  let body: unknown
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    body = await response.json()
  } else {
    body = await response.text()
  }

  if (!response.ok) {
    // Backend returned an error — normalise into ApiError shape
    if (typeof body === 'object' && body !== null) {
      const err = body as Record<string, unknown>
      throw {
        error: String(err.error ?? err.detail ?? 'api_error'),
        detail: String(err.detail ?? err.message ?? JSON.stringify(err)),
        code: response.status,
      } satisfies ApiError
    }
    throw {
      error: 'api_error',
      detail: String(body),
      code: response.status,
    } satisfies ApiError
  }

  return body as T
}

// =============================================================
//  Health
// =============================================================

/** GET /health — check all service statuses */
export async function checkHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health')
}

/** GET /health/ping — lightweight liveness check */
export async function pingBackend(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>('/health/ping')
}

/** GET /health/speakers — available speaker presets */
export async function getSpeakers(): Promise<SpeakerPreset[]> {
  const data = await apiFetch<{ speakers: SpeakerPreset[] }>('/health/speakers')
  return data.speakers
}

// =============================================================
//  Transcription
// =============================================================

export interface TranscribeOptions {
  language?: string
  vadFilter?: boolean
  denoise?: boolean
}

/**
 * POST /transcribe
 * Upload an audio Blob and receive a transcription.
 *
 * @param audio     The audio Blob (from MediaRecorder or File input)
 * @param filename  Filename with extension — used to determine format
 * @param options   Optional transcription settings
 */
export async function transcribeAudio(
  audio: Blob,
  filename: string = 'recording.wav',
  options: TranscribeOptions = {},
): Promise<TranscribeResult> {
  const form = new FormData()
  form.append('audio', audio, filename)
  form.append('language', options.language ?? 'en')
  form.append('vad_filter', String(options.vadFilter ?? true))
  form.append('denoise', String(options.denoise ?? false))

  return apiFetch<TranscribeResult>('/transcribe', {
    method: 'POST',
    body: form,
    // Do NOT set Content-Type — browser sets multipart boundary automatically
  })
}

// =============================================================
//  Correction
// =============================================================

export interface CorrectOptions {
  style?: CorrectionStyle
}

/**
 * POST /correct
 * Grammar-correct and improve fluency of the given text.
 *
 * @param text    The raw transcribed text
 * @param options Correction style (native / formal / casual)
 */
export async function correctText(
  text: string,
  options: CorrectOptions = {},
): Promise<CorrectResult> {
  return apiFetch<CorrectResult>('/correct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      style: options.style ?? 'native',
    }),
  })
}

// =============================================================
//  Synthesis
// =============================================================

export interface SynthesizeOptions {
  speaker?: SpeakerMode
  speed?: number
  voiceSample?: File | null
}

/**
 * POST /synthesize
 * Generate native-English speech audio from text.
 *
 * @param text    The corrected text to speak
 * @param options Speaker mode, speed, optional voice sample file
 */
export async function synthesizeSpeech(
  text: string,
  options: SynthesizeOptions = {},
): Promise<SynthesizeResult> {
  const form = new FormData()

  // Serialize the main payload as a JSON string in the 'data' field
  form.append(
    'data',
    JSON.stringify({
      text,
      speaker: options.speaker ?? 'us_female',
      speed: options.speed ?? 1.0,
    }),
  )

  // Attach optional voice sample for cloning
  if (options.voiceSample) {
    form.append('voice_sample', options.voiceSample, options.voiceSample.name)
  }

  return apiFetch<SynthesizeResult>('/synthesize', {
    method: 'POST',
    body: form,
  })
}

// =============================================================
//  Full Pipeline
// =============================================================

export interface ProcessAllOptions {
  language?: string
  speaker?: SpeakerMode
  style?: CorrectionStyle
  vadFilter?: boolean
  speed?: number
  denoise?: boolean
  voiceSample?: File | null
}

/**
 * POST /process-all
 * Run the full pipeline in a single request:
 * transcribe → correct → synthesize
 *
 * @param audio     Input audio Blob
 * @param filename  Filename with extension
 * @param options   Pipeline options
 * @param onProgress Optional callback for step progress updates (0–100)
 */
export async function processAll(
  audio: Blob,
  filename: string = 'recording.wav',
  options: ProcessAllOptions = {},
  onProgress?: (step: string, pct: number) => void,
): Promise<ProcessResult> {
  const form = new FormData()

  // Audio file
  form.append('audio', audio, filename)

  // Pipeline options as JSON string
  const opts = {
    language: options.language ?? 'en',
    speaker: options.speaker ?? 'us_female',
    style: options.style ?? 'native',
    vad_filter: options.vadFilter ?? true,
    speed: options.speed ?? 1.0,
    denoise: options.denoise ?? false,
  }
  form.append('options', JSON.stringify(opts))

  // Optional voice cloning sample
  if (options.voiceSample) {
    form.append('voice_sample', options.voiceSample, options.voiceSample.name)
  }

  // Simulate step-level progress since the backend runs them sequentially
  onProgress?.('uploading', 5)

  const result = await apiFetch<ProcessResult>('/process-all', {
    method: 'POST',
    body: form,
  })

  onProgress?.('done', 100)
  return result
}

// =============================================================
//  Export Helpers
// =============================================================

/**
 * Download text as a .txt file.
 * Runs entirely client-side — no network request needed.
 */
export function exportAsText(text: string, filename = 'nativeify-transcript.txt') {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  triggerDownload(blob, filename)
}

/**
 * Download audio from the backend output URL as a .wav file.
 * The backend serves the file as a static file via /output/*.
 */
export async function exportAsWav(
  audioUrl: string,
  filename = 'nativeify-output.wav',
) {
  const fullUrl = resolveAudioUrl(audioUrl)
  const response = await fetch(fullUrl)
  if (!response.ok) throw new Error('Failed to fetch audio file')
  const blob = await response.blob()
  triggerDownload(blob, filename)
}

/**
 * Request MP3 conversion from the backend, then trigger download.
 * NOTE: The /synthesize endpoint returns WAV by default.
 * To get MP3, we fetch the WAV and rely on the backend's FFmpeg conversion.
 * For now: download WAV with .mp3 extension (browser handles it).
 * A dedicated /export/mp3 endpoint can be added in a future phase.
 */
export async function exportAsMp3(
  audioUrl: string,
  filename = 'nativeify-output.mp3',
) {
  // Same as WAV for now — backend MP3 conversion endpoint is Phase 9
  await exportAsWav(audioUrl, filename)
}

/** Resolve a relative /output/... URL to a full URL using the backend base */
export function resolveAudioUrl(relativeUrl: string): string {
  if (relativeUrl.startsWith('http')) return relativeUrl
  const backendBase = _baseUrl.replace('/api/v1', '')
  return `${backendBase}${relativeUrl}`
}

/** Programmatically trigger a file download in the browser */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// =============================================================
//  Error Utilities
// =============================================================

/** Type guard — check if a thrown value is an ApiError */
export function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'error' in err &&
    'code' in err
  )
}

/** Format an error (ApiError or unknown) into a human-readable string */
export function formatError(err: unknown): string {
  if (isApiError(err)) {
    return err.detail ?? err.error ?? 'Unknown API error'
  }
  if (err instanceof Error) return err.message
  return String(err)
}
