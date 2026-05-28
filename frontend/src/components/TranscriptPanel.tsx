/**
 * TranscriptPanel.tsx — Side-by-side original + corrected transcript display
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, FileText } from 'lucide-react'
import clsx from 'clsx'
import type { CorrectResult, TranscribeResult } from '@/types'
import DiffViewer from './DiffViewer'

interface TranscriptPanelProps {
  transcription: TranscribeResult | null
  correction: CorrectResult | null
  className?: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded-lg hover:bg-surface-3 transition-colors text-text-muted hover:text-text-secondary"
      aria-label="Copy text"
    >
      {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
    </button>
  )
}

interface PanelProps {
  title: string
  subtitle?: string
  text: string
  badge?: React.ReactNode
  highlight?: boolean
}

function TextPanel({ title, subtitle, text, badge, highlight }: PanelProps) {
  return (
    <div className={clsx(
      'glass-card p-4 flex flex-col gap-3 h-full',
      highlight && 'border-accent/30',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text-primary">{title}</p>
          {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge}
          <CopyButton text={text} />
        </div>
      </div>
      <p className="text-sm text-text-secondary leading-relaxed flex-1 whitespace-pre-wrap">
        {text}
      </p>
      <p className="text-[11px] text-text-muted font-mono">{text.length} chars</p>
    </div>
  )
}

export default function TranscriptPanel({ transcription, correction, className }: TranscriptPanelProps) {
  const [activeTab, setActiveTab] = useState<'split' | 'diff'>('split')

  if (!transcription && !correction) {
    return (
      <div className={clsx('glass-card p-8 flex flex-col items-center justify-center gap-3 text-center', className)}>
        <div className="w-12 h-12 rounded-2xl bg-surface-3 flex items-center justify-center">
          <FileText size={22} className="text-text-muted" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-secondary">No transcript yet</p>
          <p className="text-xs text-text-muted mt-1">Record or upload audio to see results here</p>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('flex flex-col gap-3', className)}>
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-xl w-fit border border-surface-4">
        {(['split', 'diff'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize',
              activeTab === tab
                ? 'bg-surface-1 text-text-primary shadow-sm border border-surface-4'
                : 'text-text-muted hover:text-text-secondary',
            )}
          >
            {tab === 'split' ? 'Side by Side' : 'Diff View'}
          </button>
        ))}
      </div>

      {activeTab === 'split' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {transcription && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <TextPanel
                title="Original Transcript"
                subtitle={`${transcription.language.toUpperCase()} · ${transcription.duration.toFixed(1)}s`}
                text={transcription.text}
              />
            </motion.div>
          )}
          {correction && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
              <TextPanel
                title="Corrected Text"
                subtitle={`${correction.changes_count} change${correction.changes_count !== 1 ? 's' : ''} made`}
                text={correction.corrected}
                highlight
                badge={
                  correction.changes_count > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent-light">
                      {correction.changes_count} edits
                    </span>
                  )
                }
              />
            </motion.div>
          )}
        </div>
      ) : (
        correction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <DiffViewer correction={correction} />
          </motion.div>
        )
      )}
    </div>
  )
}
