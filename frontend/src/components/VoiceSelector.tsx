/**
 * VoiceSelector.tsx — Speaker / voice mode radio picker
 */
import { motion } from 'framer-motion'
import clsx from 'clsx'
import type { SpeakerMode } from '@/types'
import { useAppStore } from '@/store/useAppStore'

interface VoiceOption {
  mode: SpeakerMode
  label: string
  description: string
  flag: string
  requiresSample?: boolean
}

const OPTIONS: VoiceOption[] = [
  { mode: 'us_female',  label: 'US Female',     description: 'Warm American English',   flag: '🇺🇸' },
  { mode: 'us_male',    label: 'US Male',        description: 'Clear American English',  flag: '🇺🇸' },
  { mode: 'british',    label: 'British',        description: 'Refined British accent',  flag: '🇬🇧' },
  { mode: 'preserve',   label: 'My Voice',       description: 'Clone your voice',        flag: '🎤', requiresSample: true },
]

interface VoiceSelectorProps {
  className?: string
}

export default function VoiceSelector({ className }: VoiceSelectorProps) {
  const { speakerMode, setSpeakerMode, voiceSampleFile, setVoiceSampleFile } = useAppStore()

  const handleSampleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setVoiceSampleFile(file)
    e.target.value = ''
  }

  return (
    <div className={clsx('flex flex-col gap-3', className)}>
      <p className="text-sm font-semibold text-text-primary">Voice</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {OPTIONS.map((opt) => {
          const active = speakerMode === opt.mode
          return (
            <motion.button
              key={opt.mode}
              id={`voice-${opt.mode}`}
              onClick={() => setSpeakerMode(opt.mode)}
              whileTap={{ scale: 0.96 }}
              className={clsx(
                'relative flex flex-col items-center gap-2 p-3 rounded-xl border text-center',
                'transition-all duration-150 cursor-pointer select-none',
                active
                  ? 'bg-accent/10 border-accent/50 shadow-glow-accent-sm'
                  : 'bg-surface-2 border-surface-4 hover:border-surface-3 hover:bg-surface-2',
              )}
              aria-pressed={active}
            >
              {/* Active ring */}
              {active && (
                <motion.div
                  layoutId="voice-ring"
                  className="absolute inset-0 rounded-xl border-2 border-accent pointer-events-none"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              <span className="text-2xl leading-none">{opt.flag}</span>

              <div className="space-y-0.5">
                <p className={clsx(
                  'text-xs font-semibold leading-tight',
                  active ? 'text-accent-light' : 'text-text-primary',
                )}>
                  {opt.label}
                </p>
                <p className="text-[10px] text-text-muted leading-tight">{opt.description}</p>
              </div>

              {/* Active check */}
              {active && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-accent flex items-center justify-center"
                >
                  <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
                    <path d="M1 2.5L2.8 4.2L6 1" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.div>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Voice cloning sample upload (only when preserve selected) */}
      {speakerMode === 'preserve' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <label
            htmlFor="voice-sample-input"
            className={clsx(
              'flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer',
              'border border-dashed transition-colors duration-150',
              voiceSampleFile
                ? 'border-success/40 bg-success/5'
                : 'border-surface-4 hover:border-accent/40 bg-surface-2',
            )}
          >
            <span className="text-lg">{voiceSampleFile ? '✅' : '🎙️'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-primary">
                {voiceSampleFile ? voiceSampleFile.name : 'Upload voice sample'}
              </p>
              <p className="text-[10px] text-text-muted">
                {voiceSampleFile ? 'Click to replace · ~6s WAV recommended' : '6–30 second WAV clip of your voice'}
              </p>
            </div>
            <input
              id="voice-sample-input"
              type="file"
              accept=".wav,.mp3,.ogg,.flac"
              onChange={handleSampleUpload}
              className="sr-only"
            />
          </label>
        </motion.div>
      )}
    </div>
  )
}
