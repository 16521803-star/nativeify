/**
 * RecordButton.tsx — Animated microphone record/stop button
 *
 * Uses the MediaRecorder Web API.
 * On start: shows pulsing red ring, live timer.
 * On stop: calls onRecordingComplete with the audio Blob.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Square, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { useAppStore } from '@/store/useAppStore'

interface RecordButtonProps {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void
  disabled?: boolean
  className?: string
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function RecordButton({ onRecordingComplete, disabled, className }: RecordButtonProps) {
  const { isRecording, setRecording, setRecordingBlob, setRecordingDuration } = useAppStore()

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [micAvailable, setMicAvailable] = useState(true)

  // Check mic permission on mount
  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(s => { s.getTracks().forEach(t => t.stop()); setMicAvailable(true) })
      .catch(() => setMicAvailable(false))
  }, [])

  // Cleanup on unmount
  useEffect(() => () => {
    timerRef.current && clearInterval(timerRef.current)
    mediaRecorderRef.current?.state === 'recording' && mediaRecorderRef.current.stop()
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      })

      // Prefer WAV-compatible format, fall back to webm
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const duration = (Date.now() - startTimeRef.current) / 1000
        setRecordingBlob(blob)
        setRecordingDuration(duration)
        setRecording(false)
        setElapsed(0)
        timerRef.current && clearInterval(timerRef.current)
        onRecordingComplete(blob, duration)
      }

      recorder.start(250) // Collect data every 250ms
      startTimeRef.current = Date.now()
      setRecording(true)

      // Live timer
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 200)

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied'
      setError(msg)
      setMicAvailable(false)
    }
  }, [onRecordingComplete, setRecording, setRecordingBlob, setRecordingDuration])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
  }, [])

  const handleClick = () => {
    if (disabled) return
    isRecording ? stopRecording() : startRecording()
  }

  return (
    <div className={clsx('flex flex-col items-center gap-4', className)}>

      {/* ── Main Button ─────────────────────────────────── */}
      <div className="relative">
        {/* Outer ring pulse (recording only) */}
        <AnimatePresence>
          {isRecording && (
            <>
              <motion.div
                key="ring1"
                className="absolute inset-0 rounded-full border-2 border-danger/40"
                animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.div
                key="ring2"
                className="absolute inset-0 rounded-full border-2 border-danger/20"
                animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
              />
            </>
          )}
        </AnimatePresence>

        {/* Button core */}
        <motion.button
          id="record-button"
          onClick={handleClick}
          disabled={disabled || !micAvailable}
          whileHover={{ scale: disabled ? 1 : 1.05 }}
          whileTap={{ scale: disabled ? 1 : 0.94 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className={clsx(
            'relative w-20 h-20 rounded-full flex items-center justify-center',
            'transition-all duration-300 shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2',
            'focus-visible:ring-offset-surface',
            isRecording
              ? 'bg-danger shadow-glow-danger focus-visible:ring-danger'
              : 'bg-gradient-to-br from-accent to-accent/70 shadow-glow-accent focus-visible:ring-accent',
            (disabled || !micAvailable) && 'opacity-50 cursor-not-allowed',
          )}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          <AnimatePresence mode="wait">
            {isRecording ? (
              <motion.div
                key="stop"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Square size={28} className="text-white fill-white" />
              </motion.div>
            ) : (
              <motion.div
                key="mic"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Mic size={30} className="text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* ── Status text ─────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isRecording ? (
          <motion.div
            key="timer"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="flex flex-col items-center gap-1"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
              <span className="font-mono text-lg font-semibold text-danger tabular-nums">
                {formatTime(elapsed)}
              </span>
            </div>
            <p className="text-xs text-text-secondary">Click to stop recording</p>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-danger text-sm"
          >
            <AlertCircle size={14} />
            <span>{error}</span>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="flex flex-col items-center gap-1"
          >
            <p className="text-sm font-medium text-text-secondary">
              {micAvailable ? 'Click to record' : 'Mic unavailable'}
            </p>
            <p className="text-xs text-text-muted">or drag & drop an audio file below</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
