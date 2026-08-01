'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
import {
  currentPermission,
  enablePush,
  iosNeedsInstall,
  pushSupported,
  type PushState,
} from '../lib/push'

/*
  Turns on push for this browser.

  Shown at the top of the notifications page rather than buried in a settings
  screen: someone reading their notification list is exactly the person who
  wants to stop having to check it.
*/
export default function PushToggle() {
  const { user } = useAuth()
  const [supported, setSupported] = useState<boolean | null>(null)
  const [needsInstall, setNeedsInstall] = useState(false)
  const [state, setState] = useState<PushState>('default')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    ;(async () => {
      setSupported(await pushSupported())
      setNeedsInstall(iosNeedsInstall())
      setState(currentPermission())
    })()
  }, [])

  // Nothing to offer once it is on, or before we know.
  if (!user || supported === null) return null
  if (state === 'granted' && !done) return null

  async function enable() {
    if (!user) return
    setError(null)
    setBusy(true)
    const err = await enablePush(user.uid)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setState('granted')
    setDone(true)
  }

  if (done) {
    return (
      <div className="card mb-4 border-l-4 border-l-primary p-5">
        <p className="font-semibold text-content">Notifications are on</p>
        <p className="mt-1 text-sm text-content-secondary">
          You will be told about inspections, your tenancy and messages without
          opening this page.
        </p>
      </div>
    )
  }

  // iOS refuses push in a Safari tab regardless of version, so explain the
  // install step rather than showing a button that cannot work.
  if (needsInstall) {
    return (
      <div className="card mb-4 border-l-4 border-l-secondary p-5">
        <p className="font-semibold text-content">Get notified on your iPhone</p>
        <p className="mt-1 text-sm text-content-secondary">
          Tap <strong>Share → Add to Home Screen</strong>, open ClearRent from
          there, then come back and turn notifications on. iOS does not allow
          them from a Safari tab.
        </p>
      </div>
    )
  }

  if (supported === false) return null

  if (state === 'denied') {
    return (
      <div className="card mb-4 border-l-4 border-l-secondary p-5">
        <p className="font-semibold text-content">Notifications are blocked</p>
        <p className="mt-1 text-sm text-content-secondary">
          Allow notifications for this site in your browser settings, then
          reload this page.
        </p>
      </div>
    )
  }

  return (
    <div className="card mb-4 border-l-4 border-l-primary p-5">
      <p className="font-semibold text-content">Stop checking this page</p>
      <p className="mt-1 text-sm text-content-secondary">
        Get inspection updates, tenancy changes and messages as notifications,
        even when ClearRent is closed.
      </p>
      {error && <p className="mt-3 text-sm text-error">{error}</p>}
      <button
        className="btn-primary mt-4 px-5 py-2.5 text-sm"
        disabled={busy}
        onClick={enable}
      >
        {busy ? 'Enabling…' : 'Turn on notifications'}
      </button>
    </div>
  )
}
