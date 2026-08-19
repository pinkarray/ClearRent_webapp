'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from './AuthProvider'
import { Calendar } from './Calendar'
import {
  TIME_SLOT_DISPLAY,
  TIME_SLOT_LABEL,
  availableInspectionSlots,
  createInspectionRequest,
  isSlotStillBookable,
  loadBookableProperty,
  type BookableProperty,
} from '../lib/inspections'

/** Local calendar day as 'YYYY-MM-DD'. `toISOString` is UTC and, at WAT+1,
 *  reports yesterday for any time before 01:00. */
function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

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
  // Slots the SERVER says are free for the chosen date. null = not resolved
  // yet or the call failed; never treated as "all free".
  const [freeSlots, setFreeSlots] = useState<string[] | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const p = await loadBookableProperty(propertyId)
      setProperty(p)
      // Today survives only while one of the property's slots is still beyond
      // the lead time, otherwise the calendar would offer a day whose every
      // slot the time picker then rejects. Mirrors the app's getAvailableDates.
      const today = toLocalISO(new Date())
      const openToday = p?.inspectionTimeSlots.some((s) => isSlotStillBookable(today, s))
      setMinDate(openToday ? today : toLocalISO(new Date(Date.now() + 86400000)))
    })()
  }, [user, propertyId])

  // Availability is server-side: the handler's offered slots minus the ones
  // they are already booked for. Filtering the property's raw list by
  // time-of-day alone (what this did before) let a tenant book a taken slot
  // and pay for it, leaving a charge to refund by hand.
  useEffect(() => {
    if (!date || !propertyId) {
      setFreeSlots(null)
      return
    }
    let cancelled = false
    setSlotsLoading(true)
    setSlot('')
    ;(async () => {
      const s = await availableInspectionSlots(propertyId, new Date(`${date}T00:00:00`))
      if (cancelled) return
      setFreeSlots(s)
      setSlotsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [date, propertyId])

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
          Two things first - both are required before an inspection can be booked.
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
          The handler will approve or decline it. You pay only after it is approved - nothing
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
  // On today, a slot that has already started (or is inside the lead time) is
  // not offered. Any future date leaves the list untouched.
  // Server list ∩ still-bookable-today. When the server call has not resolved
  // (or failed) we show NOTHING rather than the unfiltered list — offering a
  // slot we cannot vouch for is what caused the pay-then-refund bug.
  const slots = !date
    ? []
    : (freeSlots ?? []).filter((s) => isSlotStillBookable(date, s))

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
              onChange={(iso) => {
                setDate(iso)
                // Moving to today can invalidate an already-picked slot.
                if (slot && !isSlotStillBookable(iso, slot)) setSlot('')
              }}
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
          {!date ? (
            <p className="text-sm text-content-secondary">Pick a date first.</p>
          ) : slotsLoading ? (
            <p className="text-sm text-content-secondary">Checking what is free…</p>
          ) : freeSlots === null ? (
            // The availability call failed. Say so rather than showing the
            // unchecked list — an offered slot we cannot vouch for is how a
            // tenant ends up paying for a booking that gets declined.
            <p className="text-sm text-error">
              Could not check availability. Please try again.
            </p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-content-secondary">
              No times left on this date. Try another day.
            </p>
          ) : null}
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
