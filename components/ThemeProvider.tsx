'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  // localStorage does not exist during SSR, so the saved choice genuinely
  // cannot be the initial state: a lazy initialiser would return 'system' on
  // the server and the saved theme on the client, and ThemeButton renders from
  // `theme`, so the markup would not match on hydration. Reading it after
  // mount is the correct trade, and the pre-paint script in app/layout.tsx
  // already put the right theme on <html>, so this no longer causes a flash —
  // only the toggle's own icon settles a frame later.
  useEffect(() => {
    const saved = localStorage.getItem('clearrent-theme') as Theme | null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setThemeState(saved)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const mq = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = (t: Theme) => {
      const resolved = t === 'system' ? (mq.matches ? 'dark' : 'light') : t
      setResolvedTheme(resolved)
      root.setAttribute('data-theme', resolved)
    }

    apply(theme)

    if (theme === 'system') {
      const handler = () => apply('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('clearrent-theme', t)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)