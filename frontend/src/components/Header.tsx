/**
 * Header.tsx — Top navigation bar
 * Shows: Logo + tagline, backend connection status, version badge
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic2, Wifi, WifiOff, Activity } from 'lucide-react'
import Badge from './ui/Badge'
import { pingBackend } from '@/services/api'

type ConnectionStatus = 'checking' | 'connected' | 'disconnected'

export default function Header() {
  const [status, setStatus] = useState<ConnectionStatus>('checking')
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const checkConnection = async () => {
    try {
      await pingBackend()
      setStatus('connected')
    } catch {
      setStatus('disconnected')
    }
    setLastChecked(new Date())
  }

  useEffect(() => {
    checkConnection()
    // Re-check every 30 seconds
    const interval = setInterval(checkConnection, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-surface-4 bg-surface-1/80 backdrop-blur-sm z-40">

      {/* ── Logo ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-accent/60 shadow-glow-accent-sm">
          <Mic2 size={16} className="text-white" />
          {/* Subtle inner glow ring */}
          <div className="absolute inset-0 rounded-xl border border-white/10" />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-base tracking-tight text-gradient">
            Nativeify
          </span>
          <Badge variant="muted" className="hidden sm:inline-flex">v1.0</Badge>
        </div>
        <span className="hidden md:block text-text-muted text-xs ml-1">
          — Speak like a native
        </span>
      </div>

      {/* ── Right section ─────────────────────────────── */}
      <div className="flex items-center gap-3">

        {/* Connection status indicator */}
        <button
          onClick={checkConnection}
          title={`Backend ${status}${lastChecked ? ` · checked ${lastChecked.toLocaleTimeString()}` : ''}`}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 border border-surface-4 hover:border-surface-3 transition-colors text-xs font-medium"
        >
          <AnimatePresence mode="wait">
            {status === 'checking' && (
              <motion.span key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Activity size={13} className="text-text-muted animate-pulse" />
              </motion.span>
            )}
            {status === 'connected' && (
              <motion.span key="connected" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
                <Wifi size={13} className="text-success" />
              </motion.span>
            )}
            {status === 'disconnected' && (
              <motion.span key="disconnected" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
                <WifiOff size={13} className="text-danger" />
              </motion.span>
            )}
          </AnimatePresence>

          <span className={
            status === 'connected' ? 'text-success' :
            status === 'disconnected' ? 'text-danger' :
            'text-text-muted'
          }>
            {status === 'checking'    ? 'Connecting…' :
             status === 'connected'   ? 'Backend ready' :
             'Backend offline'}
          </span>
        </button>

        {/* AI badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-light animate-pulse" />
          <span className="text-xs font-medium text-accent-light">Local AI</span>
        </div>
      </div>
    </header>
  )
}
