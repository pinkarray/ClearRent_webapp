'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from './AuthProvider'
import { Calendar } from './Calendar'
import {
  TIME_SLOT_DISPLAY,
  TIME_SLOT_LABEL,
  createInspectionRequest,
  loadBookableProperty,
  type BookableProperty,
} from '../lib/inspections'

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
}

/**
 * Inspection booking on the public property page.
 *
 * The page itself is server-rendered from the PUBLIC projection, which
 * deliberately omits landlordId, the fee fields and the inspection schedule.
 * Rather than widen that projection — it is the access control for anonymous
 * visitors — this component reads the full property doc itself once the user is
 * signed in, which `properties` rules already permit for any authenticated user.
 */
export function BookInspection({ propertyId }: { propertyId: string }) {
  const { user, profile, ready } = useAuth()

  const [property, setProperty] = useState<BookableProperty | null>(null)
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  // Earliest bookable day. Resolved on mount rather than during render — the
  // clock is not a pure input.
  const [minDate, setMinDate] = useState('')

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setMinDate(new Date(Date.now() + 86400000).toISOString().slice(0, 10))
      setProperty(await loadBookableProperty(propertyId))
    })()
  }, [user, propertyId])

  if (!ready) {
    return (
      <div className="card p-6 text-sm text-content-secondary">Loading…</div>
    )
  }

  // ── Signed out ──
  if (!user) {
    return (
      <div className="card p-6">
        <h2 className="text-base font-semibold text-content">
          Book an inspection
        </h2>
        <p className="mt-2 text-sm text-content-secondary">
          The exact street address is released once your inspection is{' '}
          <strong>approved and paid</strong>.
        </p>
        <Link
          href="/login"
          className="btn-primary mt-4 block w-full px-6 py-3 text-center no-underline"
        >
          Log in to book
        </Link>
        <p className="mt-3 text-center text-sm text-content-secondary">
          New here?{' '}
          <Link href="/signup" className="text-primary no-underline">
            Create an account
          </Link>
        </p>
      </div>
    )
  }

  const verified = profile?.verificationStatus === 'verified'
  const hasBank = profile?.hasBankDetails === true

  // ── Signed in, but the rules' preconditions are not met ──
  if (!verified || !hasBank) {
    return (
      <div className="card p-6">
        <h2 className="text-base font-semibold text-content">
          Book an inspection
        </h2>
        <p className="mt-2 text-sm text-content-secondary">
          Two things first — both are required before an inspection can be booked.
        </p>
        <div className="mt-4 space-y-3">
          {!verified && (
            <Link
              href="/dashboard/verification"
              className="btn-ghost block px-4 py-2.5 text-center text-sm no-underline"
            >
              {profile?.verificationStatus === 'pending'
                ? 'Verification under review'
                : 'Get verified'}
            </Link>
          )}
          {!hasBank && (
            <Link
              href="/dashboard/bank"
              className="btn-ghost block px-4 py-2.5 text-center text-sm no-underline"
            >
              Add a payout account
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (requestId) {
    return (
      <div className="card border-l-4 border-l-primary p-6">
        <h2 className="text-base font-semibold text-content">Request sent</h2>
        <p className="mt-2 text-sm text-content-secondary">
          The handler will approve or decline it. You pay only after it is approved — nothing
          has been charged yet.
        </p>
        <Link
          href="/dashboard/inspections"
          className="btn-primary mt-4 block w-full px-6 py-3 text-center no-underline"
        >
          View my inspections
        </Link>
      </div>
    )
  }

  if (!property) {
    return <div className="card p-6 text-sm text-content-secondary">Loading…</div>
  }

  const allowedDays = property.inspectionDays
  const slots = property.inspectionTimeSlots

  // The calendar only offers days the handler shows on, so a selected date is
  // valid by construction — this is just for the confirmation line.
  const prettyDate = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString('en-NG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !property) return
    setError(null)
    setBusy(true)
    const res = await createInspectionRequest(user.uid, {
      property,
      requestedDate: new Date(`${date}T00:00:00`),
      requestedTimeSlot: slot,
      notes: notes.trim(),
    })
    setBusy(false)
    if ('error' in res) setError(res.error)
    else setRequestId(res.requestId)
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6">
      <h2 className="text-base font-semibold text-content">Book an inspection</h2>

      {property.inspectionFeeTotal > 0 && (
        <div className="mt-3 rounded-md bg-surface-secondary p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-content-secondary">Inspection fee</span>
            <span className="font-bold text-primary">
              {formatNaira(property.inspectionFeeTotal)}
            </span>
          </div>
          <p className="mt-1 text-xs text-content-hint">
            Charged only after the handler approves. Nothing is taken now.
          </p>
        </div>
      )}

      <div className="mt-4">
        <span className="text-sm font-medium text-content">Preferred date</span>
        <div className="mt-1.5">
          {minDate && (
            <Calendar
              value={date}
              onChange={setDate}
              minISO={minDate}
              allowedDayNames={allowedDays}
            />
          )}
        </div>
        {date && (
          <p className="mt-2 text-sm text-content-secondary">
            Selected: <span className="font-medium text-content">{prettyDate}</span>
          </p>
        )}
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-content">Time</legend>
        <div className="mt-2 grid gap-2">
          {slots.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSlot(s)}
              className="rounded-md px-4 py-3 text-left text-sm"
              style={{
                background: slot === s ? 'var(--primary)' : 'var(--surface-secondary)',
                color: slot === s ? '#fff' : 'var(--text-primary)',
                border: '1px solid ' + (slot === s ? 'var(--primary)' : 'var(--border)'),
              }}
            >
              <span className="font-medium">{TIME_SLOT_LABEL[s] ?? s}</span>
              <span className={slot === s ? 'opacity-90' : 'text-content-secondary'}>
                {' '}
                · {TIME_SLOT_DISPLAY[s] ?? ''}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-content">
          Notes <span className="text-content-hint">(optional)</span>
        </span>
        <textarea
          className="input-field mt-1.5 px-4 py-3"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        className="btn-primary mt-5 w-full px-6 py-3"
        type="submit"
        disabled={busy || !date || !slot}
      >
        {busy ? 'Requesting…' : 'Request inspection'}
      </button>

      <p className="mt-3 text-xs text-content-hint">
        The exact street address is released once your inspection is approved and paid.
      </p>
    </form>
  )
}
