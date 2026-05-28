/**
 * ui/Button.tsx — Reusable button with variant, size, loading state
 */
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'
import Spinner from './Spinner'

export type ButtonVariant = 'accent' | 'ghost' | 'danger' | 'success' | 'outline'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  accent: 'btn-accent',
  ghost:  'btn-ghost',
  danger: [
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl',
    'font-semibold text-sm text-white transition-all duration-200 select-none cursor-pointer',
    'bg-danger hover:bg-danger/90 active:scale-[0.98]',
    'shadow-[0_2px_12px_rgba(239,68,68,0.3)] hover:shadow-glow-danger',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none',
  ].join(' '),
  success: [
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl',
    'font-semibold text-sm text-white transition-all duration-200 select-none cursor-pointer',
    'bg-success hover:bg-success/90 active:scale-[0.98]',
    'shadow-[0_2px_12px_rgba(34,197,94,0.3)] hover:shadow-glow-success',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none',
  ].join(' '),
  outline: [
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl',
    'font-medium text-sm text-accent-light transition-all duration-200 select-none cursor-pointer',
    'border border-accent/40 bg-accent/5 hover:bg-accent/10 hover:border-accent',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' '),
}

const sizeClasses: Record<ButtonSize, string> = {
  xs: '!px-3 !py-1.5 !text-xs !rounded-lg',
  sm: '!px-4 !py-2 !text-sm',
  md: '',
  lg: '!px-6 !py-3 !text-base',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'accent',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  className,
  disabled,
  ...props
}, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={clsx(
      variantClasses[variant],
      sizeClasses[size],
      fullWidth && 'w-full',
      className,
    )}
    {...props}
  >
    {loading ? (
      <Spinner size="sm" />
    ) : leftIcon ? (
      <span className="shrink-0">{leftIcon}</span>
    ) : null}
    {children}
    {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
  </button>
))

Button.displayName = 'Button'
export default Button
