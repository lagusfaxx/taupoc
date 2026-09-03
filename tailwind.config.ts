import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1.25rem', lg: '2rem' },
      screens: { '2xl': '1440px' },
    },
    extend: {
      colors: {
        // Superficies: negro técnico, no negro puro (evita banding en fotografía)
        ink: {
          DEFAULT: '#07090B',
          900: '#0B0E11',
          800: '#11151A',
          700: '#181D23',
          600: '#222831',
          500: '#2E3641',
        },
        line: {
          DEFAULT: '#232A33',
          soft: '#1A2027',
          bright: '#39424E',
        },
        chalk: {
          DEFAULT: '#F4F6F8',
          dim: '#B9C1CB',
          faint: '#7C8795',
        },
        // Acento base de marca (agua TAUPOC). Se sobrescribe por producto vía --accent.
        aqua: {
          DEFAULT: '#00E0B8',
          400: '#2BF0CE',
          600: '#00B896',
          700: '#008E74',
        },
        signal: {
          ok: '#22C58B',
          warn: '#F0A93B',
          bad: '#F04B4B',
          info: '#4B9BF0',
        },
      },
      fontFamily: {
        display: ['Saira', 'Barlow Condensed', 'Oswald', 'Impact', 'system-ui', 'sans-serif'],
        sans: ['Barlow', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.045em',
        wider: '0.06em',
        widest: '0.14em',
        mega: '0.28em',
      },
      borderRadius: {
        none: '0',
        xs: '2px',
        sm: '3px',
        DEFAULT: '4px',
      },
      boxShadow: {
        lift: '0 24px 60px -24px rgba(0,0,0,0.75)',
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 18px 40px -28px rgba(0,0,0,0.9)',
        glow: '0 0 0 1px var(--accent), 0 0 28px -8px var(--accent)',
      },
      backgroundImage: {
        'grid-tech':
          'linear-gradient(rgba(255,255,255,.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.028) 1px, transparent 1px)',
        'fade-b': 'linear-gradient(to bottom, transparent, rgba(7,9,11,0.92) 72%, #07090B)',
        'fade-r': 'linear-gradient(to right, rgba(7,9,11,0.96) 8%, rgba(7,9,11,0.62) 46%, transparent 78%)',
      },
      backgroundSize: { 'grid-tech': '56px 56px' },
      keyframes: {
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'sweep': {
          '0%': { transform: 'translateX(-110%)' },
          '100%': { transform: 'translateX(110%)' },
        },
        'pulse-dot': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.25' },
        },
        'cart-pop': {
          '0%': { transform: 'scale(.4)', opacity: '0' },
          '55%': { transform: 'scale(1.35)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'cart-nudge': {
          '0%,100%': { transform: 'translateY(0) scale(1)' },
          '35%': { transform: 'translateY(-3px) scale(1.12)' },
          '70%': { transform: 'translateY(1px) scale(.97)' },
        },
        'cart-ring': {
          '0%': { transform: 'scale(.5)', opacity: '.85' },
          '100%': { transform: 'scale(1.7)', opacity: '0' },
        },
      },
      animation: {
        'rise-in': 'rise-in .6s cubic-bezier(.2,.7,.2,1) both',
        sweep: 'sweep 1.4s cubic-bezier(.4,0,.2,1) infinite',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
        'cart-pop': 'cart-pop .42s cubic-bezier(.2,.9,.25,1.4) both',
        'cart-nudge': 'cart-nudge .5s cubic-bezier(.2,.7,.2,1) both',
        'cart-ring': 'cart-ring .6s cubic-bezier(.2,.7,.2,1) forwards',
      },
      transitionTimingFunction: {
        tech: 'cubic-bezier(.2,.7,.2,1)',
      },
    },
  },
  plugins: [],
};
export default config;
