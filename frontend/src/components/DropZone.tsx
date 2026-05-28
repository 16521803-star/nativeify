/**
 * DropZone.tsx — Drag-and-drop + click-to-upload audio file input
 */
import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileAudio, X, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'

const ACCEPTED_TYPES = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg',
  'audio/flac', 'audio/m4a', 'audio/aac', 'audio/webm', 'audio/x-wav']
const ACCEPTED_EXT = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.webm', '.aac']
const MAX_MB = 100

interface DropZoneProps {
  onFileSelected: (file: File, url: string) => void
  hasFile?: boolean
  filename?: string
  disabled?: boolean
  className?: string
}

export default function DropZone({ onFileSelected, hasFile, filename, disabled, className }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validate = (file: File): string | null => {
    if (file.size > MAX_MB * 1024 * 1024) return `File too large (max ${MAX_MB} MB)`
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    const validType = ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXT.includes(ext)
    if (!validType) return `Unsupported format. Use: ${ACCEPTED_EXT.join(', ')}`
    return null
  }

  const handleFile = useCallback((file: File) => {
    setError(null)
    const err = validate(file)
    if (err) { setError(err); return }
    const url = URL.createObjectURL(file)
    onFileSelected(file, url)
  }, [onFileSelected])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [disabled, handleFile])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const fileSizeMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)

  return (
    <div className={clsx('relative', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXT.join(',')}
        onChange={onInputChange}
        className="sr-only"
        id="audio-file-input"
        aria-label="Upload audio file"
        disabled={disabled}
      />

      <motion.div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); !disabled && setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        animate={{
          borderColor: dragOver ? '#7C5CFC' : hasFile ? '#22C55E44' : '#28283D',
          backgroundColor: dragOver ? 'rgba(124,92,252,0.06)' : hasFile ? 'rgba(34,197,94,0.04)' : 'transparent',
        }}
        transition={{ duration: 0.15 }}
        className={clsx(
          'relative flex flex-col items-center justify-center gap-3 p-8',
          'border-2 border-dashed rounded-2xl cursor-pointer min-h-[140px]',
          'transition-colors duration-150 select-none',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <AnimatePresence mode="wait">
          {hasFile ? (
            <motion.div
              key="has-file"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary truncate max-w-[200px]">
                  {filename}
                </p>
                <p className="text-xs text-text-muted mt-0.5">Click to change file</p>
              </div>
            </motion.div>
          ) : dragOver ? (
            <motion.div
              key="drag"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2"
            >
              <motion.div
                animate={{ y: [-4, 0, -4] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center"
              >
                <Upload size={20} className="text-accent-light" />
              </motion.div>
              <p className="text-sm font-semibold text-accent-light">Drop to upload</p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 text-center"
            >
              <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center">
                <FileAudio size={20} className="text-text-muted" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-secondary">
                  <span className="text-accent-light underline underline-offset-2">Browse</span>
                  {' '}or drag & drop audio
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {ACCEPTED_EXT.join(' · ')} · max {MAX_MB} MB
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs"
          >
            <X size={12} className="shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
