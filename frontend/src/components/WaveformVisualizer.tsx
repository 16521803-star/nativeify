/**
 * WaveformVisualizer.tsx — Live mic waveform + static audio waveform
 *
 * Two modes:
 * - live: draws real-time bar chart from AnalyserNode during recording
 * - static: renders WaveSurfer.js waveform from an audio URL
 */
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

interface WaveformVisualizerProps {
  /** 'live' draws real-time bars; 'static' renders a playable wavesurfer waveform */
  mode: 'live' | 'static'
  /** URL of the audio file (static mode only) */
  audioUrl?: string
  /** Whether the mic is active (live mode only) */
  isActive?: boolean
  className?: string
  height?: number
}

const BAR_COUNT = 60
const LIVE_BAR_COUNT = 48

export default function WaveformVisualizer({
  mode,
  audioUrl,
  isActive = false,
  className,
  height = 80,
}: WaveformVisualizerProps) {
  // ── Live mode state ──────────────────────────────────
  const [bars, setBars] = useState<number[]>(Array(LIVE_BAR_COUNT).fill(0.05))
  const animFrameRef = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // ── Static mode ref ──────────────────────────────────
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<unknown>(null)

  // ── Live waveform ────────────────────────────────────
  useEffect(() => {
    if (mode !== 'live') return

    if (isActive) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        streamRef.current = stream
        const ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 128
        source.connect(analyser)
        analyserRef.current = analyser

        const data = new Uint8Array(analyser.frequencyBinCount)
        const draw = () => {
          analyser.getByteFrequencyData(data)
          const normalized = Array.from(data).slice(0, LIVE_BAR_COUNT).map(v => Math.max(0.05, v / 255))
          setBars(normalized)
          animFrameRef.current = requestAnimationFrame(draw)
        }
        draw()
      }).catch(() => {
        // No mic access — animate fake bars
        let t = 0
        const fake = () => {
          t += 0.08
          const fakeData = Array.from({ length: LIVE_BAR_COUNT }, (_, i) =>
            0.1 + 0.3 * Math.abs(Math.sin(t + i * 0.3))
          )
          setBars(fakeData)
          animFrameRef.current = requestAnimationFrame(fake)
        }
        fake()
      })
    } else {
      // Recording stopped — decay bars to zero
      cancelAnimationFrame(animFrameRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      setBars(Array(LIVE_BAR_COUNT).fill(0.05))
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [mode, isActive])

  // ── Static WaveSurfer waveform ───────────────────────
  useEffect(() => {
    if (mode !== 'static' || !audioUrl || !waveformRef.current) return

    let ws: { destroy: () => void } | null = null

    import('wavesurfer.js').then(({ default: WaveSurfer }) => {
      if (!waveformRef.current) return
      // Destroy previous instance
      if (wavesurferRef.current) (wavesurferRef.current as { destroy: () => void }).destroy()

      ws = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#504E6B',
        progressColor: '#7C5CFC',
        cursorColor: '#9B82FD',
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: height - 8,
        normalize: true,
        interact: false,   // AudioPlayer handles interaction
      })
      ws.load(audioUrl)
      wavesurferRef.current = ws
    })

    return () => { ws?.destroy() }
  }, [mode, audioUrl, height])

  // ── Render ───────────────────────────────────────────
  if (mode === 'live') {
    return (
      <div
        className={clsx('flex items-end justify-center gap-[2px] w-full', className)}
        style={{ height }}
        aria-label="Live audio waveform"
      >
        {bars.map((amp, i) => (
          <motion.div
            key={i}
            className={clsx(
              'rounded-full w-[3px] shrink-0 transition-colors duration-100',
              isActive ? 'bg-accent' : 'bg-surface-4',
            )}
            animate={{ scaleY: isActive ? amp : 0.05 }}
            style={{
              height: '100%',
              transformOrigin: 'bottom',
              opacity: isActive ? 0.5 + amp * 0.5 : 0.3,
            }}
            transition={{ duration: 0.06 }}
          />
        ))}
      </div>
    )
  }

  // Static mode
  if (!audioUrl) {
    return (
      <div
        className={clsx(
          'flex items-center justify-center w-full rounded-xl bg-surface-2 border border-surface-4',
          className,
        )}
        style={{ height }}
      >
        <p className="text-xs text-text-muted">No audio loaded</p>
      </div>
    )
  }

  return (
    <div
      ref={waveformRef}
      className={clsx('w-full rounded-xl overflow-hidden waveform-container', className)}
      style={{ height }}
      aria-label="Audio waveform"
    />
  )
}
