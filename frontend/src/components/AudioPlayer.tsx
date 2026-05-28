/**
 * AudioPlayer.tsx — Before/After comparison audio player
 *
 * Shows two WaveSurfer instances (original + synthesised) side by side.
 * Each has its own play/pause/seek and shows duration.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Volume2, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { resolveAudioUrl } from '@/services/api'

interface TrackPlayerProps {
  label: string
  sublabel?: string
  audioUrl: string
  accentColor: string
  progressColor: string
  id: string
}

function TrackPlayer({ label, sublabel, audioUrl, accentColor, progressColor, id }: TrackPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<{
    playPause: () => void
    isPlaying: () => boolean
    on: (event: string, cb: (...args: unknown[]) => void) => void
    destroy: () => void
    getDuration: () => number
    getCurrentTime: () => number
    seekTo: (progress: number) => void
  } | null>(null)

  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fullUrl = resolveAudioUrl(audioUrl)

  useEffect(() => {
    if (!containerRef.current) return
    let ws: typeof wsRef.current = null

    import('wavesurfer.js').then(({ default: WaveSurfer }) => {
      if (!containerRef.current) return
      ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: accentColor,
        progressColor,
        cursorColor: progressColor,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 56,
        normalize: true,
        interact: true,
      }) as typeof wsRef.current

      wsRef.current = ws
      ws!.load(fullUrl)
      ws!.on('ready', () => {
        setDuration(ws!.getDuration())
        setLoading(false)
      })
      ws!.on('play', () => {
        setPlaying(true)
        timerRef.current = setInterval(() => setCurrentTime(ws!.getCurrentTime()), 100)
      })
      ws!.on('pause', () => {
        setPlaying(false)
        timerRef.current && clearInterval(timerRef.current)
      })
      ws!.on('finish', () => {
        setPlaying(false)
        setCurrentTime(0)
        timerRef.current && clearInterval(timerRef.current)
      })
    })

    return () => {
      timerRef.current && clearInterval(timerRef.current)
      ws?.destroy()
    }
  }, [fullUrl, accentColor, progressColor])

  const togglePlay = () => wsRef.current?.playPause()

  const fmt = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary">{label}</p>
          {sublabel && <p className="text-xs text-text-muted">{sublabel}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Volume2 size={13} className="text-text-muted" />
          {loading && <div className="skeleton h-3 w-12 rounded" />}
          {!loading && (
            <span className="font-mono text-xs text-text-secondary tabular-nums">
              {fmt(currentTime)} / {fmt(duration)}
            </span>
          )}
        </div>
      </div>

      {/* Waveform */}
      <div
        ref={containerRef}
        id={id}
        className="w-full rounded-lg overflow-hidden waveform-container bg-surface-2"
        style={{ minHeight: 56 }}
      />

      {/* Controls */}
      <div className="flex items-center gap-3">
        <motion.button
          onClick={togglePlay}
          disabled={loading}
          whileTap={{ scale: 0.9 }}
          className={clsx(
            'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
            'transition-colors duration-150 disabled:opacity-40',
          )}
          style={{ background: loading ? undefined : progressColor + '22', border: `1px solid ${progressColor}44` }}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing
            ? <Pause size={15} style={{ color: progressColor }} />
            : <Play size={15} style={{ color: progressColor }} className="translate-x-px" />
          }
        </motion.button>

        {/* Progress bar (click-to-seek) */}
        <div
          className="flex-1 h-1.5 rounded-full bg-surface-3 cursor-pointer overflow-hidden"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const pct = (e.clientX - rect.left) / rect.width
            wsRef.current?.seekTo(Math.max(0, Math.min(1, pct)))
            setCurrentTime(pct * duration)
          }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%', background: progressColor }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Main AudioPlayer (before + after) ─────────────────────────

interface AudioPlayerProps {
  originalUrl: string | null
  outputUrl: string | null
  className?: string
}

export default function AudioPlayer({ originalUrl, outputUrl, className }: AudioPlayerProps) {
  if (!originalUrl && !outputUrl) return null

  return (
    <div className={clsx('grid grid-cols-1 sm:grid-cols-2 gap-4', className)}>
      {originalUrl && (
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
          <TrackPlayer
            id="player-original"
            label="Original Recording"
            sublabel="Your voice"
            audioUrl={originalUrl}
            accentColor="#504E6B"
            progressColor="#9490B5"
          />
        </motion.div>
      )}
      {outputUrl && (
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <TrackPlayer
            id="player-output"
            label="Native Audio"
            sublabel="AI-synthesised output"
            audioUrl={outputUrl}
            accentColor="#4A3880"
            progressColor="#7C5CFC"
          />
        </motion.div>
      )}
    </div>
  )
}
