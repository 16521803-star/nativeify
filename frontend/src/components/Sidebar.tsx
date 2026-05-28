/**
 * Sidebar.tsx — Left navigation panel
 */
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mic2, Layers, Settings, Github, BookOpen } from 'lucide-react'
import clsx from 'clsx'
import { useAppStore } from '@/store/useAppStore'
import { selectPendingBatchCount } from '@/store/useAppStore'

interface NavItem {
  label: string
  icon: React.ElementType
  path: string
  badge?: number | string
}

export default function Sidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const pendingBatch = useAppStore(selectPendingBatchCount)

  const navItems: NavItem[] = [
    { label: 'Studio',  icon: Mic2,   path: '/' },
    { label: 'Batch',   icon: Layers, path: '/batch', badge: pendingBatch || undefined },
    { label: 'Settings',icon: Settings,path: '/settings' },
  ]

  return (
    <aside className="w-[220px] shrink-0 flex flex-col h-full bg-surface-1 border-r border-surface-4">

      {/* Nav items */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.path
          return (
            <motion.button
              key={item.path}
              onClick={() => navigate(item.path)}
              whileTap={{ scale: 0.97 }}
              className={clsx(
                'nav-item w-full relative',
                active && 'active',
              )}
              id={`nav-${item.label.toLowerCase()}`}
            >
              {/* Active indicator bar */}
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
              <Icon size={16} className="shrink-0" />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent text-white min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
            </motion.button>
          )
        })}
      </nav>

      {/* Bottom links */}
      <div className="p-3 border-t border-surface-4 flex flex-col gap-1">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-item text-text-muted hover:text-text-secondary"
        >
          <Github size={15} />
          <span className="text-xs">GitHub</span>
        </a>
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-item text-text-muted hover:text-text-secondary"
        >
          <BookOpen size={15} />
          <span className="text-xs">API Docs</span>
        </a>
        <p className="text-[10px] text-text-disabled px-3 pt-1">
          Nativeify v1.0.0 · MIT
        </p>
      </div>
    </aside>
  )
}
