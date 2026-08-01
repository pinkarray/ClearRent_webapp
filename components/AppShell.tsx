'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
import { useTheme } from './ThemeProvider'
import { myNotifications } from '../lib/notifications'

/*
  The signed-in chrome. Before this existed every product route was a bare
  <main> with an ad-hoc "← ClearRent" link, so the only way to move between
  screens was the browser Back button — the main reason the web read as a
  website rather than the app.

  Mirrors the app's navigation model (`landlord_home_screen.dart:1450`,
  `tenant_home_screen.dart:2346`): Home / Saved / Messages / Profile for a
  tenant, Dashboard / Properties / Messages / Profile for a landlord, with
  Profile as a menu hub for everything else. Desktop gets those tabs as a
  sidebar, mobile as a bottom bar, which is where a thumb expects them.

  The app drops an unverified tenant to two tabs; here Saved and Messages both
  work unverified (you can browse and read), so the tab set does not change —
  the verification gate lives where it actually bites, on sending and booking.
*/

type Tab = { href: string; label: string; icon: keyof typeof icons }

const icons = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M4 5h16v14H4z',
  heart: 'M12 20.5 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 1 1 19.4 13Z',
  building: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 21V9h4a1 1 0 0 1 1 1v11M3 21h18M7.5 8h3M7.5 12h3M7.5 16h3',
  chat: 'M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0',
} as const

function Icon({ name, className }: { name: keyof typeof icons; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={icons[name]} />
    </svg>
  )
}

function tabsFor(accountType: string | undefined): Tab[] {
  if (accountType === 'landlord') {
    return [
      { href: '/dashboard', label: 'Home', icon: 'home' },
      { href: '/dashboard/requests', label: 'Requests', icon: 'inbox' },
      { href: '/dashboard/messages', label: 'Messages', icon: 'chat' },
      { href: '/dashboard/profile', label: 'Profile', icon: 'user' },
    ]
  }
  if (accountType === 'tenant') {
    return [
      { href: '/dashboard', label: 'Home', icon: 'home' },
      { href: '/dashboard/saved', label: 'Saved', icon: 'heart' },
      { href: '/dashboard/messages', label: 'Messages', icon: 'chat' },
      { href: '/dashboard/profile', label: 'Profile', icon: 'user' },
    ]
  }
  if (accountType === 'agent') {
    // Mirrors the app's agent tabs: their work, their leads, messages, profile.
    return [
      { href: '/dashboard', label: 'Home', icon: 'home' },
      { href: '/dashboard/handling', label: 'Properties', icon: 'building' },
      { href: '/dashboard/messages', label: 'Messages', icon: 'chat' },
      { href: '/dashboard/profile', label: 'Profile', icon: 'user' },
    ]
  }
  // No role set yet — Home carries the role picker.
  return [
    { href: '/dashboard', label: 'Home', icon: 'home' },
    { href: '/dashboard/profile', label: 'Profile', icon: 'user' },
  ]
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

/**
 * Wraps a signed-in page. Handles the redirect to /login itself so individual
 * pages no longer each repeat that effect.
 */
export default function AppShell({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, profile, ready, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  // Read once per shell mount rather than a live listener — the badge is a
  // nudge, not something that needs to tick during a session.
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const rows = await myNotifications(user.uid)
      setUnread(rows.filter((r) => !r.read).length)
    })()
  }, [user, pathname])

  if (!ready || !user) {
    return (
      <div className="app-surface flex min-h-screen items-center justify-center bg-bg text-content-secondary">
        Loading…
      </div>
    )
  }

  const tabs = tabsFor(profile?.accountType)
  const firstName = profile?.fullName?.split(' ')[0]
  const bell = (
    <Link
      href="/dashboard/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border bg-surface-secondary text-content-secondary no-underline"
    >
      <Icon name="bell" className="h-[18px] w-[18px]" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )

  return (
    <div className="app-surface min-h-screen bg-bg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface lg:flex">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-5 py-5 no-underline"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/clearrent_mark_color.svg" alt="" className="h-8 w-8" />
          <span className="text-[17px] font-bold text-secondary">
            Clear<span className="text-primary">Rent</span>
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {tabs.map((tab) => {
            const active = isActive(pathname, tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium no-underline transition-colors ${
                  active
                    ? 'bg-primary-tint text-primary'
                    : 'text-content-secondary hover:bg-surface-secondary hover:text-content'
                }`}
              >
                <Icon name={tab.icon} className="h-5 w-5 shrink-0" />
                {tab.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-border px-3 py-3">
          <p className="truncate px-3 text-sm font-medium text-content">
            {firstName ?? 'Your account'}
          </p>
          <p className="truncate px-3 text-xs text-content-hint">
            {user.phoneNumber ?? user.email}
          </p>
          <div className="mt-2 flex gap-1">
            {bell}
            <ThemeButton theme={theme} setTheme={setTheme} />
            <button
              className="flex-1 rounded-sm px-3 py-2 text-left text-sm text-content-secondary hover:bg-surface-secondary hover:text-content"
              onClick={async () => {
                await signOut()
                router.push('/')
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
        <Link href="/" className="flex items-center gap-2 no-underline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/clearrent_mark_color.svg" alt="ClearRent" className="h-7 w-7" />
        </Link>
        <h1 className="flex-1 truncate text-base font-semibold text-content">
          {title ?? ''}
        </h1>
        {bell}
        <ThemeButton theme={theme} setTheme={setTheme} />
      </header>

      {/* pb-20 clears the fixed bottom bar on mobile. */}
      <main className="pb-20 lg:pb-0 lg:pl-60">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:py-10">
          {title && (
            <h1 className="mb-6 hidden text-2xl font-bold text-content lg:block">{title}</h1>
          )}
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium no-underline ${
                active ? 'text-primary' : 'text-content-hint'
              }`}
            >
              <Icon name={tab.icon} className="h-[22px] w-[22px]" />
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

function ThemeButton({
  theme,
  setTheme,
}: {
  theme: ReturnType<typeof useTheme>['theme']
  setTheme: ReturnType<typeof useTheme>['setTheme']
}) {
  const order = ['light', 'dark', 'system'] as const
  return (
    <button
      title={`Theme: ${theme}`}
      aria-label={`Theme: ${theme}. Click to change.`}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border bg-surface-secondary text-sm"
      onClick={() => setTheme(order[(order.indexOf(theme) + 1) % order.length])}
    >
      {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '⚙️'}
    </button>
  )
}
