'use client'

import Link from 'next/link'
import { useAuth } from './AuthProvider'
import { useTheme } from './ThemeProvider'

/*
  Chrome for the public browse pages. They sit outside AppShell because they
  must stay server-rendered for SEO and must work signed out - but they had no
  navigation at all, so a signed-in tenant tapping "Browse" fell out of the app
  onto a page whose only exit was the Back button.

  Only this header is a client component; the listings themselves stay server
  components underneath.
*/
export default function PublicHeader() {
  const { user, ready } = useAuth()
  const { theme, setTheme } = useTheme()
  const order = ['light', 'dark', 'system'] as const

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 no-underline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/clearrent_mark_color.svg" alt="" className="h-7 w-7" />
          <span className="text-base font-bold text-secondary">
            Clear<span className="text-primary">Rent</span>
          </span>
        </Link>

        <Link
          href="/properties"
          className="text-sm font-medium text-content-secondary no-underline hover:text-primary"
        >
          Browse
        </Link>

        <div className="flex flex-1 items-center justify-end gap-2">
          <button
            title={`Theme: ${theme}`}
            aria-label={`Theme: ${theme}. Click to change.`}
            className="flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-surface-secondary text-sm"
            onClick={() => setTheme(order[(order.indexOf(theme) + 1) % order.length])}
          >
            {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '⚙️'}
          </button>

          {/* Nothing renders until auth settles, so the label never flips from
              "Log in" to "Dashboard" under the user's cursor. */}
          {ready && (
            <Link
              href={user ? '/dashboard' : '/login'}
              className="btn-primary px-4 py-2 text-sm no-underline"
            >
              {user ? 'Dashboard' : 'Log in'}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
