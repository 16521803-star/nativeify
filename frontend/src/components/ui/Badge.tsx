/**
 * ui/Badge.tsx — Status / label badges
 */
import type { ReactNode } from 'react'
import clsx from 'clsx'

export type BadgeVariant = 'accent' | 'success' | 'warning' | 'danger' | 'muted' | 'cyan'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  dot?: boolean
  className?: string
}

const variantMap: Record<BadgeVariant, string> = {
  accent:  'bg-accent/15 text-accent-light border-accent/20',
  success: 'bg-success/15 text-success border-success/20',
  warning: 'bg-warning/15 text-warning border-warning/20',
  danger:  'bg-danger/15 text-danger border-danger/20',
  muted:   'bg-surface-3 text-text-secondary border-surface-4',
  cyan:    'bg-cyan/15 text-cyan border-cyan/20',
}

const dotColorMap: Record<BadgeVariant, string> = {
  accent:  'bg-accent-light',
  success: 'bg-success',
  warning: 'bg-warning',
  danger:  'bg-danger',
  muted:   'bg-text-muted',
  cyan:    'bg-cyan',
}

export default function Badge({ variant = 'muted', children, dot, className }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full',
      'text-[11px] font-semibold uppercase tracking-wider border',
      variantMap[variant],
      className,
    )}>
      {dot && (
        <span className={clsx(
          'w-1.5 h-1.5 rounded-full shrink-0',
          dotColorMap[variant],
          variant !== 'muted' && 'animate-pulse',
        )} />
      )}
      {children}
    </span>
  )
}
