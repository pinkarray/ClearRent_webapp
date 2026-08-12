'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
import {
  ISSUE_CATEGORIES,
  ISSUE_PRIORITIES,
  confirmIssueResolved,
  disputeIssueResolution,
  reportIssue,
  watchTenantIssues,
  type Issue,
} from '../lib/issues'
import { activeRentals, type ActiveRental } from '../lib/tenancy'

function formatDate(d: Date | null): string {
  if (!d) return ''
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusTone(status: string): string {
  if (status === 'resolved') return 'chip-success'
  if (status === 'in_progress') return 'chip-info'
  return 'chip-pending'
}

/*
  The app splits this across Report Issue and My Issues. On web they are one
  page: the history is the thing you arrive for, and reporting is a form above
  it. Same collection, same fields, same landlord activity record.
*/
export default function TenantIssueCentre() {
  const { user, profile } = useAuth()
  const [issues, setIssues] = useState<Issue[] | null>(null)
  const [rentals, setRentals] = useState<ActiveRental[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyIssue, setBusyIssue] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [rentalId, setRentalId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>(ISSUE_CATEGORIES[0].value)
  const [priority, setPriority] = useState<string>('medium')

  const uid = user?.uid

  // Rentals only change through this tenant's own tenancy actions, so a
  // one-time read is enough.
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    ;(async () => {
      const r = await activeRentals('tenantId', uid)
      if (cancelled) return
      setRentals(r)
      // An issue must name a property, so default to the only one when there
      // is exactly one — the common case.
      if (r.length === 1) setRentalId(r[0].id)
    })()
    return () => {
      cancelled = true
    }
  }, [uid])

  // Live: the landlord resolves an issue from their own queue, so the tenant
  // who reported it has no reason to reload and would otherwise keep seeing
  // "open" long after it was fixed.
  useEffect(() => {
    if (!uid) return
    return watchTenantIssues(uid, setIssues)
  }, [uid])

  async function confirmFix(issueId: string) {
    setError(null)
    setBusyIssue(issueId)
    const err = await confirmIssueResolved(issueId)
    setBusyIssue(null)
    if (err) setError(err)
    // The listener moves the card to resolved.
  }

  async function rejectFix(issueId: string) {
    const reason = window.prompt("What's still wrong?")
    if (!reason?.trim()) return
    setError(null)
    setBusyIssue(issueId)
    const err = await disputeIssueResolution(issueId, reason)
    setBusyIssue(null)
    if (err) setError(err)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const rental = rentals.find((r) => r.id === rentalId)
    if (!rental) {
      setError('Pick which property this is about.')
      return
    }
    setError(null)
    setBusy(true)
    const err = await reportIssue({
      propertyId: rental.propertyId,
      propertyTitle: rental.propertyTitle,
      tenantId: user.uid,
      tenantName: profile?.fullName ?? 'Tenant',
      landlordId: rental.landlordId,
      landlordName: rental.landlordName,
      title,
      description,
      category,
      priority,
    })
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setTitle('')
    setDescription('')
    setOpen(false)
    // The listener above delivers the new issue; no reload needed.
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {rentals.length === 0 ? (
        <div className="card p-6">
          <p className="font-medium text-content">Nothing to report against yet</p>
          <p className="mt-1 text-sm text-content-secondary">
            Issues are raised against a property you rent. Once a tenancy is active you can
            report one here and your landlord is notified.
          </p>
        </div>
      ) : !open ? (
        <button className="btn-primary px-5 py-2.5 text-sm" onClick={() => setOpen(true)}>
          Report an issue
        </button>
      ) : (
        <form onSubmit={submit} className="card space-y-5 p-6">
          {rentals.length > 1 && (
            <label className="block">
              <span className="text-sm font-medium text-content">Property</span>
              <select
                className="input-field mt-1.5 px-4 py-3"
                value={rentalId}
                onChange={(e) => setRentalId(e.target.value)}
                required
              >
                <option value="">Select a property</option>
                {rentals.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.propertyTitle}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="text-sm font-medium text-content">What is wrong?</span>
            <input
              className="input-field mt-1.5 px-4 py-3"
              required
              maxLength={100}
              placeholder="Kitchen tap is leaking"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-content">Details</span>
            <textarea
              className="input-field mt-1.5 px-4 py-3"
              required
              rows={4}
              placeholder="When it started, what you have tried, anything the landlord should know."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div>
            <span className="text-sm font-medium text-content">Category</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {ISSUE_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`rounded-sm border px-3 py-1.5 text-sm ${
                    category === c.value
                      ? 'border-primary bg-primary-tint text-primary'
                      : 'border-border text-content-secondary'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm font-medium text-content">Priority</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {ISSUE_PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`rounded-sm border px-3 py-2 text-left ${
                    priority === p.value ? 'border-primary bg-primary-tint' : 'border-border'
                  }`}
                >
                  <span className="block text-sm font-medium text-content">{p.label}</span>
                  <span className="block text-xs text-content-secondary">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex flex-wrap gap-3">
            <button className="btn-primary px-5 py-2.5 text-sm" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send to landlord'}
            </button>
            <button
              className="btn-ghost px-5 py-2.5 text-sm"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
          Reported issues
        </h2>
        {issues === null ? (
          <p className="mt-3 text-sm text-content-secondary">Loading…</p>
        ) : issues.length === 0 ? (
          <div className="card mt-3 p-6 text-center text-sm text-content-secondary">
            You have not reported any issues.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {issues.map((i) => (
              <div key={i.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-content">{i.title}</p>
                    <p className="truncate text-sm text-content-secondary">
                      {i.propertyTitle} · {i.category} · {formatDate(i.createdAt)}
                    </p>
                  </div>
                  <span className={`chip shrink-0 ${statusTone(i.status)}`}>
                    {i.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="mt-3 text-sm text-content-secondary">{i.description}</p>

                {/*
                  The landlord saying it is fixed does not close it - it lands
                  here and waits for the person who lives with the problem.
                  Without these two buttons the tenant could see "pending
                  confirmation" and had no way to answer either way.
                */}
                {i.status === 'pending_confirmation' && (
                  <div className="mt-4 border-t border-divider pt-4">
                    <p className="text-sm text-content">
                      Your landlord marked this fixed. Is it sorted?
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        className="btn-primary px-5 py-2.5 text-sm"
                        disabled={busyIssue === i.id}
                        onClick={() => void confirmFix(i.id)}
                      >
                        {busyIssue === i.id ? 'Saving…' : 'Yes, it is fixed'}
                      </button>
                      <button
                        className="btn-ghost px-5 py-2.5 text-sm"
                        disabled={busyIssue === i.id}
                        onClick={() => void rejectFix(i.id)}
                      >
                        Not fixed
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
