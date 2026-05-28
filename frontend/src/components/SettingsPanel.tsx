/**
 * SettingsPanel.tsx — Model configuration and app settings form
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Save, RotateCcw, ChevronDown, Cpu, Mic2, Brain, Volume2, Sliders } from 'lucide-react'
import clsx from 'clsx'
import { useAppStore } from '@/store/useAppStore'
import type { AppSettings } from '@/types'
import Button from './ui/Button'
import Badge from './ui/Badge'

function Section({ title, icon: Icon, children }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-5 py-4 hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon size={15} className="text-accent-light shrink-0" />
          <span className="text-sm font-semibold text-text-primary">{title}</span>
        </div>
        <ChevronDown
          size={14}
          className={clsx('text-text-muted transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-5 pb-5 flex flex-col gap-4 border-t border-surface-4"
        >
          <div className="pt-4 flex flex-col gap-4">{children}</div>
        </motion.div>
      )}
    </div>
  )
}

function Field({ label, sublabel, children }: {
  label: string
  sublabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="sm:w-44 shrink-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {sublabel && <p className="text-[11px] text-text-muted mt-0.5">{sublabel}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function Select({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="input-field text-sm pr-8 appearance-none bg-no-repeat"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239490B5' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundPosition: 'right 12px center' }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative w-10 h-5.5 rounded-full transition-colors duration-200 shrink-0',
        checked ? 'bg-accent' : 'bg-surface-4',
      )}
      style={{ height: '1.375rem' }}
    >
      <motion.div
        animate={{ x: checked ? 18 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
      />
    </button>
  )
}

export default function SettingsPanel({ className }: { className?: string }) {
  const { settings, updateSettings, resetSettings } = useAppStore()
  const [saved, setSaved] = useState(false)

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    updateSettings({ [key]: value })
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className={clsx('flex flex-col gap-4', className)}>
      {/* ── Whisper STT ──────────────────────────────────── */}
      <Section title="Speech Recognition (Whisper)" icon={Mic2}>
        <Field label="Model Size" sublabel="Larger = more accurate, slower">
          <Select
            value={settings.whisperModel}
            onChange={v => update('whisperModel', v as AppSettings['whisperModel'])}
            options={[
              { value: 'tiny',     label: 'Tiny — fastest (~39M params)' },
              { value: 'base',     label: 'Base — fast (~74M params)' },
              { value: 'small',    label: 'Small — balanced (~244M params)' },
              { value: 'medium',   label: 'Medium — recommended (~769M params)' },
              { value: 'large-v2', label: 'Large v2 — highest quality' },
              { value: 'large-v3', label: 'Large v3 — latest' },
            ]}
          />
        </Field>
        <Field label="Voice Activity Detection" sublabel="Skip silent segments">
          <Toggle checked={settings.vadFilter} onChange={v => update('vadFilter', v)} />
        </Field>
        <Field label="Noise Reduction" sublabel="FFmpeg pre-processing">
          <Toggle checked={settings.noiseReduction} onChange={v => update('noiseReduction', v)} />
        </Field>
      </Section>

      {/* ── Ollama LLM ───────────────────────────────────── */}
      <Section title="Grammar Correction (Ollama)" icon={Brain}>
        <Field label="Model" sublabel="Must be pulled via ollama pull">
          <input
            type="text"
            value={settings.ollamaModel}
            onChange={e => update('ollamaModel', e.target.value)}
            placeholder="e.g. llama3.2:3b"
            className="input-field text-sm font-mono"
          />
        </Field>
        <Field label="Correction Style" sublabel="Tone of corrections">
          <Select
            value={settings.correctionStyle}
            onChange={v => update('correctionStyle', v as AppSettings['correctionStyle'])}
            options={[
              { value: 'native', label: 'Native — natural everyday English' },
              { value: 'formal', label: 'Formal — professional / business' },
              { value: 'casual', label: 'Casual — relaxed, conversational' },
            ]}
          />
        </Field>
      </Section>

      {/* ── TTS Engine ───────────────────────────────────── */}
      <Section title="Voice Synthesis (TTS)" icon={Volume2}>
        <Field label="Engine">
          <Select
            value={settings.ttsEngine}
            onChange={v => update('ttsEngine', v as AppSettings['ttsEngine'])}
            options={[
              { value: 'xtts', label: 'XTTS-v2 — best quality + voice cloning' },
              { value: 'fish', label: 'Fish Speech — lightweight alternative' },
            ]}
          />
        </Field>
        <Field label="Speaking Speed" sublabel={`${settings.ttsSpeed.toFixed(1)}× (0.5–2.0)`}>
          <input
            type="range"
            min={0.5} max={2.0} step={0.1}
            value={settings.ttsSpeed}
            onChange={e => update('ttsSpeed', parseFloat(e.target.value))}
            className="w-full accent-accent"
          />
        </Field>
      </Section>

      {/* ── Hardware ─────────────────────────────────────── */}
      <Section title="Hardware" icon={Cpu}>
        <Field label="Device" sublabel="Inference device for AI models">
          <Select
            value={settings.device}
            onChange={v => update('device', v as AppSettings['device'])}
            options={[
              { value: 'auto', label: 'Auto — detect CUDA or fall back to CPU' },
              { value: 'cuda', label: 'CUDA — NVIDIA GPU (recommended)' },
              { value: 'cpu',  label: 'CPU — slower, no GPU required' },
            ]}
          />
        </Field>
      </Section>

      {/* ── API ──────────────────────────────────────────── */}
      <Section title="Connection" icon={Sliders}>
        <Field label="Backend URL" sublabel="FastAPI server address">
          <input
            type="url"
            value={settings.apiBaseUrl}
            onChange={e => update('apiBaseUrl', e.target.value)}
            placeholder="http://localhost:8000/api/v1"
            className="input-field text-sm font-mono"
          />
        </Field>
      </Section>

      {/* ── Actions ──────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="accent" onClick={handleSave} leftIcon={<Save size={14} />}>
          {saved ? 'Saved ✓' : 'Save Settings'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => { resetSettings(); setSaved(false) }}
          leftIcon={<RotateCcw size={14} />}
        >
          Reset Defaults
        </Button>
        <Badge variant="muted" className="ml-auto">
          Settings saved to localStorage
        </Badge>
      </div>
    </div>
  )
}
