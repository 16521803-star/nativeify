import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // ── Color Palette ────────────────────────────────
      colors: {
        // Deep dark surfaces (ElevenLabs-inspired)
        surface: {
          DEFAULT: '#09090F',   // Deepest background
          1: '#0F0F1A',         // Card / panel background
          2: '#16162A',         // Elevated card
          3: '#1E1E30',         // Input / hover / border
          4: '#28283D',         // Subtle border
        },
        // Primary accent — electric purple
        accent: {
          DEFAULT: '#7C5CFC',
          light: '#9B82FD',
          dim: 'rgba(124, 92, 252, 0.15)',
          glow: 'rgba(124, 92, 252, 0.35)',
        },
        // Secondary accent — cyan for waveform / progress
        cyan: {
          DEFAULT: '#22D3EE',
          dim: 'rgba(34, 211, 238, 0.15)',
        },
        // Status colors
        success: {
          DEFAULT: '#22C55E',
          dim: 'rgba(34, 197, 94, 0.15)',
        },
        warning: {
          DEFAULT: '#F59E0B',
          dim: 'rgba(245, 158, 11, 0.15)',
        },
        danger: {
          DEFAULT: '#EF4444',
          dim: 'rgba(239, 68, 68, 0.15)',
        },
        // Text hierarchy
        text: {
          primary: '#F0EEFF',
          secondary: '#9490B5',
          muted: '#504E6B',
          disabled: '#3A3855',
        },
        // Diff colors
        diff: {
          insert: 'rgba(34, 197, 94, 0.25)',
          delete: 'rgba(239, 68, 68, 0.25)',
          'insert-text': '#4ADE80',
          'delete-text': '#F87171',
        },
      },

      // ── Typography ────────────────────────────────────
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },

      // ── Spacing ───────────────────────────────────────
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '72': '18rem',
        '80': '20rem',
        '88': '22rem',
        '96': '24rem',
      },

      // ── Border Radius ─────────────────────────────────
      borderRadius: {
        '4xl': '2rem',
      },

      // ── Box Shadow (glow effects) ─────────────────────
      boxShadow: {
        'glow-accent': '0 0 20px rgba(124, 92, 252, 0.4)',
        'glow-accent-sm': '0 0 10px rgba(124, 92, 252, 0.25)',
        'glow-success': '0 0 16px rgba(34, 197, 94, 0.35)',
        'glow-danger': '0 0 16px rgba(239, 68, 68, 0.35)',
        'glow-cyan': '0 0 16px rgba(34, 211, 238, 0.35)',
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
        'card-hover': '0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,92,252,0.2)',
      },

      // ── Animations ────────────────────────────────────
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(124, 92, 252, 0)' },
          '50%': { boxShadow: '0 0 0 8px rgba(124, 92, 252, 0.25)' },
        },
        'record-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' },
          '50%': { boxShadow: '0 0 0 12px rgba(239, 68, 68, 0.2)' },
        },
        'wave-bar': {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'record-pulse': 'record-pulse 1.5s ease-in-out infinite',
        'wave-bar': 'wave-bar 1.2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
        'scale-in': 'scale-in 0.2s ease-out forwards',
        'spin-slow': 'spin-slow 2s linear infinite',
      },

      // ── Backdrop Blur ─────────────────────────────────
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
} satisfies Config
