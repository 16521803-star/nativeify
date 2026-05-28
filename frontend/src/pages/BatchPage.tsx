/**
 * BatchPage.tsx — Multi-file queue processing page
 *
 * Provides drag-and-drop ingestion for multiple audio files,
 * status tracking (pending / processing / done / error), sequential execution,
 * summary stats, and detailed per-file inspection (diff viewer + audio playback).
 */
import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Square,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Sparkles,
  Download,
  Eye,
  FileAudio,
  Clock,
  X,
  FileText,
  Music,
  ArrowLeft
} from 'lucide-react'
import clsx from 'clsx'

import { useAppStore } from '@/store/useAppStore'
import { processAll, resolveAudioUrl, exportAsText, exportAsWav } from '@/services/api'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import DiffViewer from '@/components/DiffViewer'

export default function BatchPage() {
  const store = useAppStore()
  const { batchJobs, addBatchJobs, updateBatchJob, removeBatchJob, clearBatchJobs, settings, speakerMode, voiceSampleFile } = store

  const [isProcessingBatch, setIsProcessingBatch] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  
  // Track if current batch run should abort
  const abortRef = useRef(false)

  // ── Drag and Drop Ingestion ──────────────────────────────
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'))
    if (files.length > 0) {
      addBatchJobs(files)
      store.addToast({
        type: 'success',
        title: 'Files added',
        description: `Successfully added ${files.length} audio files to the queue.`
      })
    } else {
      store.addToast({
        type: 'error',
        title: 'Invalid files',
        description: 'Please drop audio files only.'
      })
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      addBatchJobs(files)
      store.addToast({
        type: 'success',
        title: 'Files added',
        description: `Successfully added ${files.length} audio files to the queue.`
      })
    }
  }

  // ── Batch Execution ──────────────────────────────────────
  const handleStartBatch = async () => {
    const pendingJobs = batchJobs.filter(job => job.status === 'pending' || job.status === 'error')
    if (pendingJobs.length === 0) return

    setIsProcessingBatch(true)
    abortRef.current = false

    store.addToast({
      type: 'info',
      title: 'Starting Batch',
      description: `Processing ${pendingJobs.length} files sequentially...`
    })

    for (const job of pendingJobs) {
      if (abortRef.current) {
        store.addToast({
          type: 'warning',
          title: 'Batch Cancelled',
          description: 'The batch processing run was aborted.'
        })
        break
      }

      updateBatchJob(job.id, { status: 'processing', error: undefined })
      const startTime = performance.now()

      try {
        const result = await processAll(
          job.file,
          job.filename,
          {
            language: 'en',
            speaker: speakerMode,
            style: settings.correctionStyle,
            vadFilter: settings.vadFilter,
            speed: settings.ttsSpeed,
            denoise: settings.noiseReduction,
            voiceSample: voiceSampleFile ?? undefined,
          }
        )

        const processingMs = Math.round(performance.now() - startTime)
        updateBatchJob(job.id, {
          status: 'done',
          result,
          processingMs,
        })
      } catch (err: any) {
        const processingMs = Math.round(performance.now() - startTime)
        const errMsg = err.detail ?? err.error ?? String(err)
        updateBatchJob(job.id, {
          status: 'error',
          error: errMsg,
          processingMs,
        })
      }
    }

    setIsProcessingBatch(false)
  }

  const handleCancelBatch = () => {
    abortRef.current = true
    // Mark processing jobs as pending
    batchJobs.forEach(job => {
      if (job.status === 'processing') {
        updateBatchJob(job.id, { status: 'pending' })
      }
    })
    setIsProcessingBatch(false)
  }

  // ── Statistics ───────────────────────────────────────────
  const totalCount = batchJobs.length
  const doneCount = batchJobs.filter(j => j.status === 'done').length
  const errorCount = batchJobs.filter(j => j.status === 'error').length
  const processingCount = batchJobs.filter(j => j.status === 'processing').length
  const pendingCount = batchJobs.filter(j => j.status === 'pending').length

  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
  const selectedJob = batchJobs.find(j => j.id === selectedJobId)

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient tracking-tight">Batch Studio</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Process multiple files sequentially with identical correction & speaker settings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearBatchJobs}
              disabled={isProcessingBatch}
              leftIcon={<Trash2 size={13} />}
            >
              Clear Queue
            </Button>
          )}
          {isProcessingBatch ? (
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancelBatch}
              leftIcon={<Square size={13} fill="currentColor" />}
            >
              Cancel Run
            </Button>
          ) : (
            <Button
              variant="accent"
              size="sm"
              onClick={handleStartBatch}
              disabled={pendingCount === 0}
              leftIcon={<Play size={13} fill="currentColor" />}
            >
              Start Batch
            </Button>
          )}
        </div>
      </div>

      {/* Queue Progress and Summary */}
      {totalCount > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 md:col-span-3 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text-secondary">Batch Progress</span>
              <span className="text-xs text-text-muted">{doneCount} / {totalCount} completed ({progressPercent}%)</span>
            </div>
            <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden border border-surface-4">
              <motion.div
                className="bg-accent h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-text-muted mt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-text-muted" /> {pendingCount} Pending
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" /> {processingCount} Processing
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-success" /> {doneCount} Completed
              </span>
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-danger">
                  <span className="w-2 h-2 rounded-full bg-danger" /> {errorCount} Failed
                </span>
              )}
            </div>
          </div>

          <div className="glass-card p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Queue Volume</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-bold text-text-primary">{totalCount}</span>
              <span className="text-sm text-text-muted">Files</span>
            </div>
            <span className="text-xs text-text-muted mt-2 block">
              Config: {speakerMode === 'preserve' ? 'Preserve Voice' : speakerMode} · {settings.correctionStyle} style
            </span>
          </div>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          'border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer text-center',
          isDragging
            ? 'border-accent bg-accent/5 scale-[0.99] shadow-inner'
            : 'border-surface-4 hover:border-surface-6 bg-surface-1 hover:bg-surface-2',
        )}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          accept="audio/*"
          className="hidden"
        />
        <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center border border-surface-4">
          <Plus className="text-text-secondary" size={20} />
        </div>
        <div>
          <p className="font-semibold text-text-primary">Add Audio Files to Queue</p>
          <p className="text-xs text-text-muted mt-1">Drag & drop files here, or click to browse</p>
        </div>
        <p className="text-[10px] text-text-muted">Supports WAV, MP3, M4A, WEBM formats</p>
      </div>

      {/* Main List */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Processing Queue</h2>
        {batchJobs.length === 0 ? (
          <div className="glass-card p-12 text-center flex flex-col items-center justify-center gap-3">
            <FileAudio size={40} className="text-text-muted" />
            <p className="font-medium text-text-secondary">No files in queue</p>
            <p className="text-xs text-text-muted max-w-[280px]">Add audio files above to configure a batch execution run.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {batchJobs.map((job) => (
                <motion.div
                  key={job.id}
                  layoutId={`job-card-${job.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={clsx(
                    'glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border transition-all',
                    selectedJobId === job.id ? 'border-accent/40 bg-accent/5' : 'border-surface-4 hover:border-surface-5'
                  )}
                >
                  {/* File Metadata */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-surface-3 border border-surface-4 flex items-center justify-center shrink-0">
                      {job.status === 'processing' ? (
                        <Spinner size="sm" />
                      ) : (
                        <FileAudio size={18} className="text-text-secondary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-text-primary truncate" title={job.filename}>
                        {job.filename}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                        <span>{formatBytes(job.file.size)}</span>
                        <span>•</span>
                        <span>{job.file.type.split('/')[1]?.toUpperCase() || 'AUDIO'}</span>
                        {job.processingMs && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Clock size={11} /> {(job.processingMs / 1000).toFixed(1)}s
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Indicator & Control buttons */}
                  <div className="flex items-center justify-between md:justify-end gap-3.5">
                    {/* Status Badge */}
                    <div>
                      {job.status === 'pending' && (
                        <Badge variant="ghost">Pending</Badge>
                      )}
                      {job.status === 'processing' && (
                        <Badge variant="warning" dot>Processing</Badge>
                      )}
                      {job.status === 'done' && (
                        <Badge variant="success" dot>Completed</Badge>
                      )}
                      {job.status === 'error' && (
                        <Badge variant="danger" dot>Failed</Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      {job.status === 'done' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setSelectedJobId(job.id)}
                            title="Inspect output"
                          >
                            <Eye size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => exportAsText(job.result!.correction.corrected, `${job.filename}-corrected.txt`)}
                            title="Download transcript"
                          >
                            <FileText size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => exportAsWav(job.result!.synthesis.audio_url, `${job.filename}-corrected.wav`)}
                            title="Download audio"
                          >
                            <Download size={14} />
                          </Button>
                        </>
                      )}

                      {job.status === 'error' && (
                        <div
                          className="text-danger hover:text-danger-hover p-1.5"
                          title={job.error}
                        >
                          <AlertCircle size={15} />
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={job.status === 'processing' || isProcessingBatch}
                        onClick={() => removeBatchJob(job.id)}
                        className="text-text-muted hover:text-danger"
                        title="Remove file"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Inspect Drawer / Detail Modal for Selected Job */}
      <AnimatePresence>
        {selectedJob && selectedJob.status === 'done' && selectedJob.result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-end"
            onClick={() => setSelectedJobId(null)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-full max-w-2xl h-full bg-surface-1 border-l border-surface-4 flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-surface-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon-sm" onClick={() => setSelectedJobId(null)}>
                    <ArrowLeft size={16} />
                  </Button>
                  <div>
                    <h3 className="font-bold text-text-primary text-base">Inspect Job</h3>
                    <p className="text-xs text-text-muted mt-0.5 truncate max-w-[400px]">
                      {selectedJob.filename}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setSelectedJobId(null)}>
                  <X size={16} />
                </Button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-2 rounded-xl p-3 border border-surface-4">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block">Duration</span>
                    <span className="text-sm font-semibold text-text-primary">
                      {selectedJob.result.transcription.duration.toFixed(1)}s Original
                    </span>
                  </div>
                  <div className="bg-surface-2 rounded-xl p-3 border border-surface-4">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block">Fluency Changes</span>
                    <span className="text-sm font-semibold text-text-primary">
                      {selectedJob.result.correction.changes_count} corrections
                    </span>
                  </div>
                </div>

                {/* Diff Viewer */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Fluency Diff</span>
                  <div className="glass-card p-4 max-h-[220px] overflow-y-auto">
                    <DiffViewer correction={selectedJob.result.correction} />
                  </div>
                </div>

                {/* Transcripts comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Original</span>
                    <div className="bg-surface-2 border border-surface-4 rounded-xl p-4 text-sm text-text-secondary leading-relaxed max-h-[160px] overflow-y-auto">
                      {selectedJob.result.transcription.text}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Corrected</span>
                    <div className="bg-surface-2 border border-surface-4 rounded-xl p-4 text-sm text-text-primary leading-relaxed max-h-[160px] overflow-y-auto font-medium">
                      {selectedJob.result.correction.corrected}
                    </div>
                  </div>
                </div>

                {/* Output Audio Preview */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Output Audio</span>
                  <div className="bg-surface-2 border border-surface-4 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                        <Music size={14} />
                      </div>
                      <span className="text-xs text-text-secondary truncate max-w-[200px]">
                        {selectedJob.filename.replace(/\.[^/.]+$/, "")}_corrected.wav
                      </span>
                    </div>
                    <audio
                      src={resolveAudioUrl(selectedJob.result.synthesis.audio_url)}
                      controls
                      className="h-9 max-w-full outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-surface-4 flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1"
                  leftIcon={<FileText size={14} />}
                  onClick={() => exportAsText(selectedJob.result!.correction.corrected, `${selectedJob.filename}-corrected.txt`)}
                >
                  Export TXT
                </Button>
                <Button
                  variant="accent"
                  className="flex-1"
                  leftIcon={<Download size={14} />}
                  onClick={() => exportAsWav(selectedJob.result!.synthesis.audio_url, `${selectedJob.filename}-corrected.wav`)}
                >
                  Download Audio
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
