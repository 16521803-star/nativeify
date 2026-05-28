/**
 * DiffViewer.tsx — Word-level diff with green/red highlights
 */
import { motion } from 'framer-motion'
import clsx from 'clsx'
import type { CorrectResult, DiffChunk } from '@/types'

interface DiffViewerProps {
  correction: CorrectResult
  className?: string
}

export default function DiffViewer({ correction, className }: DiffViewerProps) {
  const { diff, changes_count } = correction

  if (!diff.length) return null

  return (
    <div className={clsx('glass-card p-5 flex flex-col gap-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary">Changes</p>
          <p className="text-xs text-text-muted mt-0.5">
            {changes_count} correction{changes_count !== 1 ? 's' : ''} applied
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-success/30 border border-success/40 shrink-0" />
            <span className="text-text-secondary">Added</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-danger/30 border border-danger/40 shrink-0" />
            <span className="text-text-secondary">Removed</span>
          </span>
        </div>
      </div>

      {/* Diff body */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-sm leading-8 tracking-wide"
      >
        {diff.map((chunk, i) => (
          <DiffChunkSpan key={i} chunk={chunk} />
        ))}
      </motion.div>
    </div>
  )
}

function DiffChunkSpan({ chunk }: { chunk: DiffChunk }) {
  if (chunk.type === 'equal') {
    return <span className="text-text-secondary">{chunk.text}</span>
  }

  if (chunk.type === 'insert') {
    return (
      <motion.span
        initial={{ opacity: 0, backgroundColor: 'rgba(34,197,94,0.4)' }}
        animate={{ opacity: 1, backgroundColor: 'rgba(34,197,94,0.18)' }}
        transition={{ duration: 0.5 }}
        className="diff-insert mx-0.5 rounded px-1"
      >
        {chunk.text}
      </motion.span>
    )
  }

  // delete
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="diff-delete mx-0.5 rounded px-1"
    >
      {chunk.text}
    </motion.span>
  )
}
