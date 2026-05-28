/**
 * ProgressPipeline.tsx — 3-step pipeline progress tracker
 * Steps: Transcribe → Correct → Synthesize
 */
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, Wand2, Volume2, Check, Loader2, Clock } from 'lucide-react'
import clsx from 'clsx'
import type { PipelineStep } from '@/types'
import { useAppStore } from '@/store/useAppStore'

interface Step {
  key: string
  label: string
  sublabel: string
  icon: React.ElementType
  activeOn: PipelineStep[]
  doneOn: PipelineStep[]
}

const STEPS: Step[] = [
  {
    key: 'transcribe',
    label: 'Transcribe',
    sublabel: 'Speech → text',
    icon: FileText,
    activeOn: ['transcribing'],
    doneOn: ['correcting', 'synthesizing', 'done'],
  },
  {
    key: 'correct',
    label: 'Correct',
    sublabel: 'Grammar & fluency',
    icon: Wand2,
    activeOn: ['correcting'],
    doneOn: ['synthesizing', 'done'],
  },
  {
    key: 'synthesize',
    label: 'Synthesize',
    sublabel: 'Native voice',
    icon: Volume2,
    activeOn: ['synthesizing'],
    doneOn: ['done'],
  },
]

interface ProgressPipelineProps {
  className?: string
}

export default function ProgressPipeline({ className }: ProgressPipelineProps) {
  const { pipelineStep, progress, errorMessage } = useAppStore()
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const isProcessing = ['uploading', 'transcribing', 'correcting', 'synthesizing'].includes(pipelineStep)
    if (!isProcessing) {
      setElapsed(0)
      return
    }

    const interval = setInterval(() => {
      setElapsed(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [pipelineStep])

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const isIdle = pipelineStep === 'idle'
  if (isIdle) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={clsx('glass-card p-5 flex flex-col gap-4', className)}
    >
      {/* Overall progress bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
            {pipelineStep === 'done' ? '✅ Complete' :
             pipelineStep === 'error' ? '❌ Failed' :
             pipelineStep === 'recording' ? '🔴 Recording…' :
             pipelineStep === 'uploading' ? '⬆️ Uploading…' :
             '⚙️ Processing…'}
            {['uploading', 'transcribing', 'correcting', 'synthesizing'].includes(pipelineStep) && (
              <span className="text-text-muted font-mono font-normal">({formatTime(elapsed)})</span>
            )}
          </span>
          <span className="text-xs font-mono text-text-muted tabular-nums">{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
          <motion.div
            className={clsx(
              'h-full rounded-full',
              pipelineStep === 'error' ? 'bg-danger' :
              pipelineStep === 'done'  ? 'bg-success' :
              'bg-gradient-to-r from-accent to-accent-light',
            )}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        {pipelineStep === 'error' && errorMessage && (
          <p className="text-xs text-danger mt-1">{errorMessage}</p>
        )}
        {['uploading', 'transcribing', 'correcting', 'synthesizing'].includes(pipelineStep) && (
          <div className="flex items-start gap-1.5 text-[10px] text-text-muted bg-surface-2/30 border border-surface-4/40 rounded-lg p-2.5 mt-1 leading-relaxed animate-in fade-in duration-300">
            <Clock size={11} className="mt-0.5 shrink-0 text-accent" />
            <div>
              <span className="font-semibold text-text-secondary">Note on local processing:</span>{' '}
              Generating speech with voice cloning (XTTS) runs entirely offline on your machine. On CPU systems, this typically takes around 1 to 2 minutes. Please keep this tab active.
            </div>
          </div>
        )}
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-between gap-2">
        {STEPS.map((step, idx) => {
          const active = step.activeOn.includes(pipelineStep)
          const done = step.doneOn.includes(pipelineStep)
          const waiting = !active && !done
          const Icon = step.icon

          return (
            <div key={step.key} className="flex items-center gap-2 flex-1">
              {/* Step circle */}
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <motion.div
                  animate={{
                    scale: active ? [1, 1.08, 1] : 1,
                    transition: active ? { duration: 1.2, repeat: Infinity } : {},
                  }}
                  className={clsx(
                    'w-9 h-9 rounded-full flex items-center justify-center border-2 shrink-0',
                    done    && 'bg-success/15 border-success',
                    active  && 'bg-accent/15 border-accent',
                    waiting && 'bg-surface-3 border-surface-4',
                  )}
                >
                  {done ? (
                    <Check size={16} className="text-success" />
                  ) : active ? (
                    <Loader2 size={16} className="text-accent-light animate-spin" />
                  ) : (
                    <Icon size={15} className={clsx(waiting ? 'text-text-muted' : 'text-accent')} />
                  )}
                </motion.div>
                <div className="text-center">
                  <p className={clsx(
                    'text-[11px] font-semibold',
                    done && 'text-success',
                    active && 'text-accent-light',
                    waiting && 'text-text-muted',
                  )}>
                    {step.label}
                  </p>
                  <p className="text-[10px] text-text-muted hidden sm:block">{step.sublabel}</p>
                </div>
              </div>

              {/* Connector line */}
              {idx < STEPS.length - 1 && (
                <div className="h-0.5 flex-1 max-w-12 rounded-full bg-surface-3 overflow-hidden mb-5">
                  <motion.div
                    className="h-full bg-success rounded-full"
                    animate={{ width: done ? '100%' : '0%' }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
