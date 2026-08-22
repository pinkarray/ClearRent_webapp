'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../components/AuthProvider'
import { timeAgo } from '../../../lib/format'
import { landlordFeed, type FeedItem } from '../../../lib/landlord'

/**
 * A glyph per event type, so the feed scans without reading every line.
 *
 * Keyed on types from BOTH logs now — the activity types written by the
 * clients and the notification types written by the Cloud Functions. Anything
 * unmapped falls back to a dot rather than disappearing.
 */
const GLYPH: Record<string, string> = {
  // written by the clients into `activities`
  propertyViewed: '👁',
  propertyAdded: '🏠',
  inquiry: '💬',
  payment: '₦',
  property_assigned: '🤝',
  moveout_requested: '📦',
  // written by the functions into `notifications`
  issue_reported: '⚠',
  issue_updated: '🔧',
  issue_pending_reminder: '⏳',
  inspection_request: '📅',
  inspection_arrival: '📍',
  rental_interest_paid: '₦',
  rental_accept_reminder: '⏳',
  rental_expired: '⌛',
  agreement_finalized: '📄',
  caretaker_accepted: '🛠',
  caretaker_declined: '🛠',
  agent_declined: '🤝',
  agent_removed: '🤝',
  handover_closed: '🔑',
  handover_resolved: '🔑',
  handover_condition_reminder: '📦',
  moveout_auto_confirmed: '📦',
  moveout_pending_reminder: '📦',
  listing_suspension: '🚫',
}

export default function ActivityPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<FeedItem[] | null>(null)

  useEffect(() => {
    if (!user) return
    ;(async () => setRows(await landlordFeed(user.uid)))()
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
            Views, inquiries, inspections and tenancy events on your listings show up
            here.
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
                  <div className="flex items-start gap-2">
                    {a.unread && (
                      <span
                        aria-hidden
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                      />
                    )}
                    <p className="font-medium text-content">{a.title}</p>
                  </div>
                  <p className="mt-0.5 text-sm text-content-secondary">{a.message}</p>
                  <p className="mt-1 text-xs text-content-hint">{timeAgo(a.createdAt)}</p>
                </div>
              </div>
            )
            return a.href ? (
              <Link key={a.id} href={a.href} className="card block p-4 no-underline">
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
