/**
 * ExportPanel.tsx — TXT / WAV / MP3 download buttons
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, FileAudio, Music, Download, Clock } from 'lucide-react'
import clsx from 'clsx'
import { exportAsText, exportAsWav, exportAsMp3, formatError } from '@/services/api'
import type { CorrectResult, SynthesizeResult, ProcessTimings } from '@/types'

interface ExportPanelProps {
  correction: CorrectResult | null
  synthesis: SynthesizeResult | null
  timings?: ProcessTimings | null
  className?: string
}

interface ExportButtonProps {
  icon: React.ElementType
  label: string
  sublabel: string
  color: string
  onClick: () => Promise<void>
  disabled?: boolean
}

function ExportButton({ icon: Icon, label, sublabel, color, onClick, disabled }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handle = async () => {
    if (loading || disabled) return
    setLoading(true); setErr(null); setDone(false)
    try {
      await onClick()
      setDone(true)
      setTimeout(() => setDone(false), 2500)
    } catch (e) {
      setErr(formatError(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.button
      onClick={handle}
      disabled={disabled || loading}
      whileHover={{ scale: disabled ? 1 : 1.03, y: disabled ? 0 : -2 }}
      whileTap={{ scale: 0.97 }}
      className={clsx(
        'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-150 cursor-pointer',
        'bg-surface-2 border-surface-4 hover:border-surface-3 text-center',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        done && 'border-success/40 bg-success/5',
      )}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}22`, border: `1px solid ${color}33` }}
      >
        {loading
          ? <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          : done
          ? <span className="text-success text-base">✓</span>
          : <Icon size={18} style={{ color }} />
        }
      </div>
      <div>
        <p className="text-xs font-semibold text-text-primary">{label}</p>
        <p className="text-[10px] text-text-muted">{sublabel}</p>
      </div>
      {err && <p className="text-[10px] text-danger">{err}</p>}
    </motion.button>
  )
}

export default function ExportPanel({ correction, synthesis, timings, className }: ExportPanelProps) {
  const hasText = !!correction?.corrected
  const hasAudio = !!synthesis?.audio_url

  if (!hasText && !hasAudio) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('glass-card p-5 flex flex-col gap-4', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary">Export</p>
          <p className="text-xs text-text-muted">Download your results</p>
        </div>
        {timings && (
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <Clock size={11} />
            <span className="font-mono">{timings.total_s.toFixed(1)}s total</span>
          </div>
        )}
      </div>

      {/* Export buttons */}
      <div className="grid grid-cols-3 gap-3">
        <ExportButton
          icon={FileText}
          label="TXT"
          sublabel="Corrected text"
          color="#9490B5"
          disabled={!hasText}
          onClick={async () => exportAsText(correction!.corrected)}
        />
        <ExportButton
          icon={FileAudio}
          label="WAV"
          sublabel="Lossless audio"
          color="#7C5CFC"
          disabled={!hasAudio}
          onClick={async () => exportAsWav(synthesis!.audio_url)}
        />
        <ExportButton
          icon={Music}
          label="MP3"
          sublabel="Compressed audio"
          color="#22D3EE"
          disabled={!hasAudio}
          onClick={async () => exportAsMp3(synthesis!.audio_url)}
        />
      </div>

      {/* Timings breakdown */}
      {timings && (
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-surface-4">
          {[
            { label: 'Transcribe', value: timings.transcription_s },
            { label: 'Correct',    value: timings.correction_s },
            { label: 'Synthesize', value: timings.synthesis_s },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-[10px] text-text-muted">{label}</p>
              <p className="text-xs font-mono font-semibold text-text-secondary">{value.toFixed(1)}s</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
