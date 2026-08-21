'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../components/AuthProvider'
import PushToggle from '../../../components/PushToggle'
import { timeAgo } from '../../../lib/format'
import {
  markAllRead,
  markRead,
  myNotifications,
  webRoute,
  type AppNotification,
} from '../../../lib/notifications'

export default function NotificationsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<AppNotification[] | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setRows(await myNotifications(user.uid))
  }, [user])

  useEffect(() => {
    ;(async () => {
      await load()
    })()
  }, [load])

  async function readAll() {
    if (!rows) return
    setBusy(true)
    await markAllRead(rows)
    await load()
    setBusy(false)
  }

  if (!user) return null

  const unread = rows?.filter((r) => !r.read).length ?? 0

  return (
    <div>
      <PushToggle />

      {unread > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-content-secondary">
            {unread} unread
          </p>
          <button
            className="btn-ghost px-4 py-2 text-sm"
            disabled={busy}
            onClick={readAll}
          >
            {busy ? 'Marking…' : 'Mark all read'}
          </button>
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-content-secondary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-content-secondary">Nothing here yet.</p>
          <p className="mt-1 text-sm text-content-hint">
            Updates about your inspections, tenancy and payments land here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((n) => {
            const href = webRoute(n.route, n.conversationId)
            const body = (
              <>
                <div className="flex items-start gap-3">
                  {!n.read && (
                    <span
                      aria-hidden
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                    />
                  )}
                  <div className={`min-w-0 flex-1 ${n.read ? 'pl-5' : ''}`}>
                    <p className={`text-content ${n.read ? '' : 'font-semibold'}`}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-sm text-content-secondary">{n.body}</p>
                    <p className="mt-1 text-xs text-content-hint">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              </>
            )

            // Opening a notification marks it read, matching the app. Without a
            // web route there is nowhere to go, so it becomes a plain button
            // that still clears the unread state.
            return href ? (
              <Link
                key={n.id}
                href={href}
                onClick={() => {
                  if (!n.read) void markRead(n.id)
                }}
                className="card block p-4 no-underline"
              >
                {body}
              </Link>
            ) : (
              <button
                key={n.id}
                className="card block w-full p-4 text-left"
                onClick={async () => {
                  if (n.read) return
                  await markRead(n.id)
                  await load()
                }}
              >
                {body}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
