'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { isSaved, toggleSaved } from '../lib/saved'

/**
 * The heart on a listing. Rendered from the server-side property page, so it
 * carries its own auth state — a signed-out visitor is sent to sign in rather
 * than shown a control that silently does nothing.
 */
export default function SaveButton({ propertyId }: { propertyId: string }) {
  const { user, ready } = useAuth()
  const router = useRouter()
  // Starts unsaved: a signed-out visitor has no saved state to fetch, and for a
  // signed-in one the first paint is corrected by the effect below.
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    ;(async () => setSaved(await isSaved(user.uid, propertyId)))()
  }, [user, propertyId])

  async function onClick() {
    if (!user) {
      router.push('/login')
      return
    }
    setBusy(true)
    // Flip immediately; a failed write is corrected on the next load, and the
    // alternative is a heart that lags behind the tap.
    setSaved((s) => !s)
    const next = await toggleSaved(user.uid, propertyId)
    setSaved(next)
    setBusy(false)
  }

  return (
    <button
      onClick={onClick}
      disabled={busy || !ready}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save this property'}
      className={`flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-medium transition-colors ${
        saved
          ? 'border-error bg-error-tint text-error'
          : 'border-border text-content-secondary hover:border-primary hover:text-primary'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.75}
        aria-hidden
      >
        <path d="M12 20.5 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 1 1 19.4 13Z" />
      </svg>
      {saved ? 'Saved' : 'Save'}
    </button>
  )
}
