/**
 * ui/Spinner.tsx — Loading spinner
 */
import clsx from 'clsx'

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  color?: 'accent' | 'white' | 'muted'
  className?: string
}

const sizeMap = { xs: 'w-3 h-3', sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
const colorMap = {
  accent: 'border-accent/20 border-t-accent',
  white:  'border-white/20 border-t-white',
  muted:  'border-surface-4 border-t-text-secondary',
}

export default function Spinner({ size = 'md', color = 'accent', className }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={clsx(
        'rounded-full border-2 animate-spin',
        sizeMap[size],
        colorMap[color],
        className,
      )}
    />
  )
}
