/**
 * MainPage.tsx — Studio page: the core Nativeify experience
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────┐
 * │  Input Zone: RecordButton + DropZone + Waveform     │
 * │  VoiceSelector                                       │
 * │  Process Button                                      │
 * │  ProgressPipeline (shown when active)               │
 * ├─────────────────────────────────────────────────────┤
 * │  Results: TranscriptPanel | AudioPlayer | Export    │
 * └─────────────────────────────────────────────────────┘
 */
import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, RotateCcw, Upload, Mic } from 'lucide-react'
import clsx from 'clsx'

import RecordButton from '@/components/RecordButton'
import WaveformVisualizer from '@/components/WaveformVisualizer'
import DropZone from '@/components/DropZone'
import VoiceSelector from '@/components/VoiceSelector'
import ProgressPipeline from '@/components/ProgressPipeline'
import TranscriptPanel from '@/components/TranscriptPanel'
import AudioPlayer from '@/components/AudioPlayer'
import ExportPanel from '@/components/ExportPanel'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

import { useAppStore, selectIsProcessing, selectHasResults } from '@/store/useAppStore'
import { processAll, formatError, resolveAudioUrl } from '@/services/api'

type InputMode = 'record' | 'upload'

export default function MainPage() {
  const store = useAppStore()
  const isProcessing = useAppStore(selectIsProcessing)
  const hasResults = useAppStore(selectHasResults)

  const [inputMode, setInputMode] = useState<InputMode>('record')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedUrl, setUploadedUrl]   = useState<string | null>(null)
  const [timings, setTimings]           = useState<null | import('@/types').ProcessTimings>(null)

  const audioRef = useRef<{ blob: Blob; filename: string } | null>(null)

  // ── Input handlers ─────────────────────────────────────

  const handleRecordingComplete = useCallback((blob: Blob, duration: number) => {
    const url = URL.createObjectURL(blob)
    audioRef.current = { blob, filename: 'recording.webm' }
    store.setOriginalAudio(url, duration)
    store.setStep('idle')
  }, [store])

  const handleFileSelected = useCallback((file: File, url: string) => {
    setUploadedFile(file)
    setUploadedUrl(url)
    audioRef.current = { blob: file, filename: file.name }
    store.setOriginalAudio(url, null)
    store.setStep('idle')
  }, [store])

  // ── Process ────────────────────────────────────────────

  const handleProcess = useCallback(async () => {
    if (!audioRef.current || isProcessing) return

    store.setStep('uploading', 5)
    store.setTranscription(null)
    store.setCorrection(null)
    store.setSynthesis(null)

    const { blob, filename } = audioRef.current
    const { settings, speakerMode, voiceSampleFile } = store

    try {
      // Step callbacks to update pipeline UI during the single request
      store.setStep('transcribing', 20)

      const result = await processAll(
        blob,
        filename,
        {
          language: 'en',
          speaker: speakerMode,
          style: settings.correctionStyle,
          vadFilter: settings.vadFilter,
          speed: settings.ttsSpeed,
          denoise: settings.noiseReduction,
          voiceSample: voiceSampleFile ?? undefined,
        },
        (step, pct) => {
          if (step === 'done') store.setStep('done', 100)
        },
      )

      // Manually step through for visual feedback after response
      store.setStep('correcting', 55)
      await new Promise(r => setTimeout(r, 300))
      store.setStep('synthesizing', 75)
      await new Promise(r => setTimeout(r, 300))

      store.setProcessResult(result)
      setTimings(result.timings)

      // Set output audio URL
      const outputFull = resolveAudioUrl(result.synthesis.audio_url)
      store.setOutputAudio(outputFull, result.synthesis.duration)

      store.addToast({
        type: 'success',
        title: 'Processing complete!',
        description: `Done in ${result.timings.total_s.toFixed(1)}s · ${result.correction.changes_count} corrections made`,
      })

    } catch (err) {
      const msg = formatError(err)
      store.setError(msg)
      store.addToast({ type: 'error', title: 'Processing failed', description: msg })
    }
  }, [isProcessing, store])

  const handleReset = () => {
    store.resetSession()
    setUploadedFile(null)
    setUploadedUrl(null)
    setTimings(null)
    audioRef.current = null
  }

  const hasAudioInput = !!(store.audio.recordingBlob || uploadedFile)
  const canProcess = hasAudioInput && !isProcessing

  const originalUrl = store.audio.originalUrl ?? uploadedUrl
  const outputUrl   = store.audio.outputUrl

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-6 pb-12">

      {/* ── Page Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gradient tracking-tight">Studio</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Record or upload speech → get fluent native-level audio
          </p>
        </div>
        {hasResults && (
          <Button variant="ghost" size="sm" onClick={handleReset} leftIcon={<RotateCcw size={13} />}>
            New Session
          </Button>
        )}
      </div>

      {/* ── Input Card ──────────────────────────────────── */}
      <motion.div layout className="glass-card p-6 flex flex-col gap-6">

        {/* Input mode tabs */}
        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-surface-2 rounded-xl border border-surface-4 gap-1">
            {([
              { mode: 'record', icon: Mic,    label: 'Record' },
              { mode: 'upload', icon: Upload,  label: 'Upload' },
            ] as const).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                id={`input-tab-${mode}`}
                onClick={() => setInputMode(mode)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                  inputMode === mode
                    ? 'bg-surface-1 text-text-primary shadow-sm border border-surface-4'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          {hasAudioInput && (
            <Badge variant="success" dot>Ready</Badge>
          )}
        </div>

        {/* Input content */}
        <AnimatePresence mode="wait">
          {inputMode === 'record' ? (
            <motion.div
              key="record"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center gap-6"
            >
              <RecordButton
                onRecordingComplete={handleRecordingComplete}
                disabled={isProcessing}
              />

              {/* Live or post-record waveform */}
              <div className="w-full">
                <WaveformVisualizer
                  mode={store.audio.isRecording ? 'live' : (originalUrl ? 'static' : 'live')}
                  audioUrl={originalUrl ?? undefined}
                  isActive={store.audio.isRecording}
                  height={72}
                  className="rounded-xl overflow-hidden"
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4"
            >
              <DropZone
                onFileSelected={handleFileSelected}
                hasFile={!!uploadedFile}
                filename={uploadedFile?.name}
                disabled={isProcessing}
              />
              {uploadedUrl && (
                <WaveformVisualizer
                  mode="static"
                  audioUrl={uploadedUrl}
                  height={64}
                  className="rounded-xl overflow-hidden"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Divider */}
        <div className="divider" />

        {/* Voice selector */}
        <VoiceSelector />

        {/* Divider */}
        <div className="divider" />

        {/* Process button */}
        <div className="flex items-center gap-4">
          <Button
            id="process-button"
            variant="accent"
            size="lg"
            loading={isProcessing}
            disabled={!canProcess}
            onClick={handleProcess}
            leftIcon={!isProcessing ? <Sparkles size={16} /> : undefined}
            className="flex-1 sm:flex-none sm:min-w-[200px]"
          >
            {isProcessing ? 'Processing…' : 'Process Audio'}
          </Button>

          {!hasAudioInput && (
            <p className="text-sm text-text-muted">
              {inputMode === 'record'
                ? 'Record audio first to continue'
                : 'Upload an audio file to continue'}
            </p>
          )}
        </div>
      </motion.div>

      {/* ── Pipeline Progress ───────────────────────────── */}
      <AnimatePresence>
        {store.pipelineStep !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <ProgressPipeline />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results ─────────────────────────────────────── */}
      <AnimatePresence>
        {hasResults && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col gap-5"
          >
            {/* Section label */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-surface-4" />
              <span className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                Results
              </span>
              <div className="h-px flex-1 bg-surface-4" />
            </div>

            {/* Transcript: original + corrected */}
            <TranscriptPanel
              transcription={store.transcription}
              correction={store.correction}
            />

            {/* Audio comparison player */}
            <AudioPlayer
              originalUrl={originalUrl}
              outputUrl={outputUrl}
            />

            {/* Export */}
            <ExportPanel
              correction={store.correction}
              synthesis={store.synthesis}
              timings={timings}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast Notifications ─────────────────────────── */}
      <ToastContainer />
    </div>
  )
}

// ── Toast container ────────────────────────────────────────────

function ToastContainer() {
  const { toasts, removeToast } = useAppStore()

  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.22 }}
            className={clsx(
              'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl',
              'border shadow-lg max-w-[340px] backdrop-blur-sm',
              toast.type === 'success' && 'bg-success/10 border-success/30',
              toast.type === 'error'   && 'bg-danger/10  border-danger/30',
              toast.type === 'warning' && 'bg-warning/10 border-warning/30',
              toast.type === 'info'    && 'bg-accent/10  border-accent/30',
            )}
          >
            <span className="text-lg shrink-0 mt-0.5">
              {toast.type === 'success' ? '✅' :
               toast.type === 'error'   ? '❌' :
               toast.type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-text-secondary mt-0.5">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-text-muted hover:text-text-secondary text-sm ml-2 shrink-0"
              aria-label="Dismiss"
            >✕</button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
