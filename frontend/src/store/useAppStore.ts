/**
 * Nativeify Frontend — Zustand Application Store
 *
 * Single source of truth for all app state.
 * Split into logical slices: audio, pipeline, results, settings, UI.
 *
 * Usage anywhere in the app:
 *   const { isRecording, setRecording } = useAppStore()
 */

import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import type {
  AppPage,
  AppSettings,
  AudioState,
  BatchJob,
  CorrectResult,
  ExportFormat,
  PipelineStep,
  ProcessResult,
  SpeakerMode,
  SynthesizeResult,
  ToastMessage,
  TranscribeResult,
} from '@/types'
import { DEFAULT_SETTINGS } from '@/types'

// =============================================================
//  State Shape
// =============================================================

interface AppState {
  // ── Navigation ──────────────────────────────────────────
  currentPage: AppPage

  // ── Audio ────────────────────────────────────────────────
  audio: AudioState

  // ── Pipeline ─────────────────────────────────────────────
  pipelineStep: PipelineStep
  progress: number         // 0–100
  errorMessage: string | null

  // ── Results ──────────────────────────────────────────────
  transcription: TranscribeResult | null
  correction: CorrectResult | null
  synthesis: SynthesizeResult | null

  // ── Speaker / Voice ──────────────────────────────────────
  speakerMode: SpeakerMode
  voiceSampleFile: File | null

  // ── Settings ─────────────────────────────────────────────
  settings: AppSettings

  // ── Batch ────────────────────────────────────────────────
  batchJobs: BatchJob[]

  // ── Toasts ───────────────────────────────────────────────
  toasts: ToastMessage[]

  // ==========================================================
  //  Actions
  // ==========================================================

  // Navigation
  setPage: (page: AppPage) => void

  // Recording / Audio
  setRecording: (isRecording: boolean) => void
  setRecordingBlob: (blob: Blob | null) => void
  setRecordingDuration: (seconds: number) => void
  setOriginalAudio: (url: string | null, duration?: number | null) => void
  setOutputAudio: (url: string | null, duration?: number | null) => void
  clearAudio: () => void

  // Pipeline
  setStep: (step: PipelineStep, progress?: number) => void
  setProgress: (progress: number) => void
  setError: (message: string | null) => void

  // Results
  setTranscription: (result: TranscribeResult | null) => void
  setCorrection: (result: CorrectResult | null) => void
  setSynthesis: (result: SynthesizeResult | null) => void
  setProcessResult: (result: ProcessResult) => void

  // Speaker
  setSpeakerMode: (mode: SpeakerMode) => void
  setVoiceSampleFile: (file: File | null) => void

  // Settings
  updateSettings: (patch: Partial<AppSettings>) => void
  resetSettings: () => void

  // Batch
  addBatchJobs: (files: File[]) => void
  updateBatchJob: (id: string, patch: Partial<BatchJob>) => void
  removeBatchJob: (id: string) => void
  clearBatchJobs: () => void

  // Toasts
  addToast: (toast: Omit<ToastMessage, 'id'>) => void
  removeToast: (id: string) => void

  // Global reset (new session)
  resetSession: () => void
}

// =============================================================
//  Initial State Values
// =============================================================

const initialAudioState: AudioState = {
  originalUrl: null,
  outputUrl: null,
  originalDuration: null,
  outputDuration: null,
  recordingBlob: null,
  recordingDuration: 0,
  isRecording: false,
}

// =============================================================
//  Store
// =============================================================

export const useAppStore = create<AppState>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // ── Initial State ──────────────────────────────
          currentPage: 'main',
          audio: initialAudioState,
          pipelineStep: 'idle',
          progress: 0,
          errorMessage: null,
          transcription: null,
          correction: null,
          synthesis: null,
          speakerMode: 'us_female',
          voiceSampleFile: null,
          settings: DEFAULT_SETTINGS,
          batchJobs: [],
          toasts: [],

          // ── Navigation ─────────────────────────────────
          setPage: (page) => set({ currentPage: page }, false, 'setPage'),

          // ── Recording / Audio ──────────────────────────
          setRecording: (isRecording) =>
            set(
              (s) => ({ audio: { ...s.audio, isRecording } }),
              false,
              'setRecording',
            ),

          setRecordingBlob: (blob) =>
            set(
              (s) => ({ audio: { ...s.audio, recordingBlob: blob } }),
              false,
              'setRecordingBlob',
            ),

          setRecordingDuration: (seconds) =>
            set(
              (s) => ({ audio: { ...s.audio, recordingDuration: seconds } }),
              false,
              'setRecordingDuration',
            ),

          setOriginalAudio: (url, duration = null) =>
            set(
              (s) => ({
                audio: { ...s.audio, originalUrl: url, originalDuration: duration },
              }),
              false,
              'setOriginalAudio',
            ),

          setOutputAudio: (url, duration = null) =>
            set(
              (s) => ({
                audio: { ...s.audio, outputUrl: url, outputDuration: duration },
              }),
              false,
              'setOutputAudio',
            ),

          clearAudio: () =>
            set(
              { audio: initialAudioState },
              false,
              'clearAudio',
            ),

          // ── Pipeline ───────────────────────────────────
          setStep: (step, progress) =>
            set(
              {
                pipelineStep: step,
                progress: progress ?? progressForStep(step),
                errorMessage: step !== 'error' ? null : get().errorMessage,
              },
              false,
              `setStep:${step}`,
            ),

          setProgress: (progress) =>
            set({ progress }, false, 'setProgress'),

          setError: (message) =>
            set(
              { errorMessage: message, pipelineStep: message ? 'error' : 'idle' },
              false,
              'setError',
            ),

          // ── Results ────────────────────────────────────
          setTranscription: (result) =>
            set({ transcription: result }, false, 'setTranscription'),

          setCorrection: (result) =>
            set({ correction: result }, false, 'setCorrection'),

          setSynthesis: (result) =>
            set({ synthesis: result }, false, 'setSynthesis'),

          setProcessResult: (result) =>
            set(
              {
                transcription: result.transcription,
                correction: result.correction,
                synthesis: result.synthesis,
                pipelineStep: 'done',
                progress: 100,
              },
              false,
              'setProcessResult',
            ),

          // ── Speaker ────────────────────────────────────
          setSpeakerMode: (mode) =>
            set({ speakerMode: mode }, false, 'setSpeakerMode'),

          setVoiceSampleFile: (file) =>
            set({ voiceSampleFile: file }, false, 'setVoiceSampleFile'),

          // ── Settings ───────────────────────────────────
          updateSettings: (patch) =>
            set(
              (s) => ({ settings: { ...s.settings, ...patch } }),
              false,
              'updateSettings',
            ),

          resetSettings: () =>
            set({ settings: DEFAULT_SETTINGS }, false, 'resetSettings'),

          // ── Batch ──────────────────────────────────────
          addBatchJobs: (files) => {
            const newJobs: BatchJob[] = files.map((file) => ({
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              filename: file.name,
              file,
              status: 'pending',
            }))
            set(
              (s) => ({ batchJobs: [...s.batchJobs, ...newJobs] }),
              false,
              'addBatchJobs',
            )
          },

          updateBatchJob: (id, patch) =>
            set(
              (s) => ({
                batchJobs: s.batchJobs.map((j) =>
                  j.id === id ? { ...j, ...patch } : j,
                ),
              }),
              false,
              'updateBatchJob',
            ),

          removeBatchJob: (id) =>
            set(
              (s) => ({ batchJobs: s.batchJobs.filter((j) => j.id !== id) }),
              false,
              'removeBatchJob',
            ),

          clearBatchJobs: () =>
            set({ batchJobs: [] }, false, 'clearBatchJobs'),

          // ── Toasts ─────────────────────────────────────
          addToast: (toast) => {
            const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
            const newToast: ToastMessage = { id, durationMs: 4000, ...toast }
            set(
              (s) => ({ toasts: [...s.toasts, newToast] }),
              false,
              'addToast',
            )
            // Auto-dismiss after durationMs
            if (newToast.durationMs && newToast.durationMs > 0) {
              setTimeout(() => {
                get().removeToast(id)
              }, newToast.durationMs)
            }
          },

          removeToast: (id) =>
            set(
              (s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }),
              false,
              'removeToast',
            ),

          // ── Global Reset ───────────────────────────────
          resetSession: () =>
            set(
              {
                audio: initialAudioState,
                pipelineStep: 'idle',
                progress: 0,
                errorMessage: null,
                transcription: null,
                correction: null,
                synthesis: null,
                voiceSampleFile: null,
              },
              false,
              'resetSession',
            ),
        }),

        {
          name: 'nativeify-store',
          // Only persist settings and speaker mode — not audio blobs or results
          partialize: (state) => ({
            settings: state.settings,
            speakerMode: state.speakerMode,
            currentPage: state.currentPage,
          }),
        },
      ),
    ),
    { name: 'NativeifyStore' },
  ),
)

// =============================================================
//  Helpers
// =============================================================

/** Map pipeline step → natural progress percentage */
function progressForStep(step: PipelineStep): number {
  const map: Record<PipelineStep, number> = {
    idle:         0,
    recording:    0,
    uploading:    5,
    transcribing: 20,
    correcting:   55,
    synthesizing: 75,
    done:         100,
    error:        0,
  }
  return map[step] ?? 0
}

// =============================================================
//  Selectors (memoised derived state)
// =============================================================

/** True if the pipeline is actively running */
export const selectIsProcessing = (s: AppState) =>
  ['uploading', 'transcribing', 'correcting', 'synthesizing'].includes(s.pipelineStep)

/** True if results are available to display */
export const selectHasResults = (s: AppState) =>
  s.transcription !== null && s.correction !== null && s.synthesis !== null

/** True if audio input is ready (recorded or uploaded) */
export const selectHasAudioInput = (s: AppState) =>
  s.audio.recordingBlob !== null || s.audio.originalUrl !== null

/** The full URL to the output audio (prefixed with backend base) */
export const selectOutputAudioFullUrl = (s: AppState): string | null => {
  if (!s.synthesis?.audio_url) return null
  const base = s.settings.apiBaseUrl.replace('/api/v1', '')
  return `${base}${s.synthesis.audio_url}`
}

/** Count of pending batch jobs */
export const selectPendingBatchCount = (s: AppState) =>
  s.batchJobs.filter((j) => j.status === 'pending').length
