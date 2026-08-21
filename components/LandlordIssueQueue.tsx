'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from './AuthProvider'
import { formatDate } from '../lib/format'
import { caretakerIssues, landlordIssues, setIssueStatus, type LandlordIssue } from '../lib/landlord'

const OPEN_STATUSES = ['open', 'in_progress', 'pending_confirmation']

function statusTone(status: string): string {
  if (status === 'resolved') return 'chip-success'
  if (status === 'in_progress') return 'chip-info'
  return 'chip-pending'
}

function priorityTone(priority: string): string {
  if (priority === 'high') return 'chip-error'
  if (priority === 'low') return 'chip-info'
  return 'chip-pending'
}

/** The landlord's maintenance queue — the counterpart of the tenant's /issues. */
/**
 * The owner's issue queue, and — with `propertyId` set — the caretaker's view
 * of the same queue for the one unit they manage.
 *
 * The two differ ONLY in the query, because the rules evaluate a list against
 * the query's constraints: a caretaker must pin `propertyId`, a landlord
 * `landlordId`. Triage actions are identical; `setIssueStatus` writes exactly
 * the keys the caretaker's update allowlist permits.
 */
export default function LandlordIssueQueue({ propertyId }: { propertyId?: string }) {
  const { user } = useAuth()
  const [rows, setRows] = useState<LandlordIssue[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setRows(propertyId ? await caretakerIssues(propertyId) : await landlordIssues(user.uid))
  }, [user, propertyId])

  useEffect(() => {
    ;(async () => {
      await load()
    })()
  }, [load])

  async function move(
    id: string,
    status: 'in_progress' | 'pending_confirmation' | 'resolved',
  ) {
    setError(null)
    setBusyId(id)
    const err = await setIssueStatus(id, status)
    setBusyId(null)
    if (err) {
      setError(err)
      return
    }
    await load()
  }

  if (!user) return null

  const open = rows?.filter((r) => OPEN_STATUSES.includes(r.status)) ?? []
  const closed = rows?.filter((r) => !OPEN_STATUSES.includes(r.status)) ?? []

  function card(i: LandlordIssue) {
    return (
      <div key={i.id} className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-content">{i.title}</p>
            <p className="truncate text-sm text-content-secondary">
              {i.propertyTitle} · {i.tenantName} · {formatDate(i.createdAt)}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <span className={`chip ${priorityTone(i.priority)}`}>{i.priority}</span>
            <span className={`chip ${statusTone(i.status)}`}>
              {i.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm text-content-secondary">{i.description}</p>

        {OPEN_STATUSES.includes(i.status) && (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-divider pt-4">
            {i.status === 'open' && (
              <button
                className="btn-ghost px-4 py-2 text-sm"
                disabled={busyId === i.id}
                onClick={() => move(i.id, 'in_progress')}
              >
                Start work
              </button>
            )}
            {i.status !== 'pending_confirmation' && (
              <button
                className="btn-primary px-4 py-2 text-sm"
                disabled={busyId === i.id}
                onClick={() => move(i.id, 'resolved')}
              >
                {busyId === i.id ? 'Saving…' : 'Mark resolved'}
              </button>
            )}
            <Link
              href={`/dashboard/listings/${i.propertyId}`}
              className="btn-ghost px-4 py-2 text-sm no-underline"
            >
              View listing
            </Link>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-error">{error}</p>}

      {rows === null ? (
        <p className="text-sm text-content-secondary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-content-secondary">No issues reported.</p>
          <p className="mt-1 text-sm text-content-hint">
            Anything your tenants report about a property lands here.
          </p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
                Needs attention
              </h2>
              {open.map(card)}
            </div>
          )}
          {closed.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
                Resolved
              </h2>
              {closed.map(card)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
