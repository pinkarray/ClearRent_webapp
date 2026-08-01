import type { Config } from 'tailwindcss'

/*
  Colours resolve to the CSS custom properties in `app/globals.css`, which are
  themselves copied from the app's `lib/core/constants/colors.dart`. Going
  through the vars rather than hard-coding hexes here is what lets
  `[data-theme="dark"]` flip the whole palette in one place.

  The vars hold hex/rgba literals rather than raw channels, so the `/opacity`
  modifier does not work on these. Use the `-tint` tokens instead — they mirror
  the app's `successLight`/`errorLight` family.

  Text colours live under `content` (`text-content`, `text-content-secondary`)
  because `primary` is already the brand green.
*/
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          light: 'var(--primary-light)',
          dark: 'var(--primary-dark)',
          tint: 'var(--primary-tint)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          light: 'var(--secondary-light)',
          dark: 'var(--secondary-dark)',
          tint: 'var(--secondary-tint)',
        },
        bg: {
          DEFAULT: 'var(--bg)',
          secondary: 'var(--bg-secondary)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          secondary: 'var(--surface-secondary)',
        },
        border: 'var(--border)',
        divider: 'var(--divider)',
        content: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          hint: 'var(--text-hint)',
          inverse: 'var(--text-inverse)',
        },
        success: { DEFAULT: 'var(--success)', tint: 'var(--success-tint)' },
        error: { DEFAULT: 'var(--error)', tint: 'var(--error-tint)' },
        warning: { DEFAULT: 'var(--warning)', tint: 'var(--warning-tint)' },
        info: { DEFAULT: 'var(--info)', tint: 'var(--info-tint)' },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        primary: 'var(--shadow-primary)',
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        serif: ['Lora', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
