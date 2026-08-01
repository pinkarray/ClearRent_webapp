'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../components/AuthProvider'
import { timeAgo } from '../../../lib/format'
import { landlordActivities, type Activity } from '../../../lib/landlord'

/** A glyph per activity type, so the feed scans without reading every line. */
const GLYPH: Record<string, string> = {
  property_viewed: '👁',
  inquiry: '💬',
  issue_reported: '⚠',
  inspection_requested: '📅',
  inspection_completed: '✓',
  payment_received: '₦',
  rental_started: '🔑',
}

export default function ActivityPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Activity[] | null>(null)

  useEffect(() => {
    if (!user) return
    ;(async () => setRows(await landlordActivities(user.uid)))()
  }, [user])

  if (!user) return null

  return (
    <div>
      {rows === null ? (
        <p className="text-sm text-content-secondary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-content-secondary">No activity yet.</p>
          <p className="mt-1 text-sm text-content-hint">
            Views, inquiries and inspection events on your listings show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((a) => {
            const inner = (
              <div className="flex items-start gap-3">
                <span aria-hidden className="mt-0.5 text-lg leading-none">
                  {GLYPH[a.type] ?? '•'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-content">{a.title}</p>
                  <p className="mt-0.5 text-sm text-content-secondary">{a.message}</p>
                  <p className="mt-1 text-xs text-content-hint">{timeAgo(a.createdAt)}</p>
                </div>
              </div>
            )
            return a.propertyId ? (
              <Link
                key={a.id}
                href={`/dashboard/listings/${a.propertyId}`}
                className="card block p-4 no-underline"
              >
                {inner}
              </Link>
            ) : (
              <div key={a.id} className="card p-4">
                {inner}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
