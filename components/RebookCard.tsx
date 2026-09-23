'use client'

import { useEffect, useState } from 'react'
import { TIME_SLOT_LABEL, rebookInspection } from '../lib/inspections'
import { handlerFreeSlots } from '../lib/reschedule'

const SLOTS = ['morning', 'afternoon', 'late_afternoon', 'evening']

/**
 * Picking a new time for a viewing the tenant may rebook: one an admin
 * reopened after a missed or disputed visit, or one that expired unapproved.
 *
 * Nothing is refunded and nothing is charged again - the fee already paid
 * carries over, and the request goes back to the handler for approval
 * (firestore.rules Row 25). Only times the handler is actually free are
 * offered, the same check the booking sheet and reschedule form use.
 */
export function RebookCard({
  requestId,
  propertyId,
  onDone,
}: {
  requestId: string
  propertyId: string
  onDone: () => void
}) {
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checked, setChecked] = useState<{ date: string; slots: string[] | null } | null>(
    null,
  )
  const freeSlots = checked && checked.date === date ? checked.slots : undefined

  useEffect(() => {
    if (!date) return
    let live = true
    void handlerFreeSlots(propertyId, new Date(`${date}T12:00:00`)).then((slots) => {
      if (live) setChecked({ date, slots })
    })
    return () => {
      live = false
    }
  }, [date, propertyId])

  async function book() {
    if (!date || !slot) return
    setBusy(true)
    setError(null)
    const err = await rebookInspection(requestId, new Date(`${date}T12:00:00`), slot)
    setBusy(false)
    if (err) setError(err)
    else onDone()
  }

  return (
    <div className="mt-4 border-t border-divider pt-4">
      <p className="text-sm text-content">
        Pick a new time for this viewing. Your payment carries over, and the
        handler approves the new time as usual.
      </p>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}

      <label className="mt-3 block text-sm text-content-secondary">
        New date
        <input
          type="date"
          className="input-field mt-1 px-3 py-2.5"
          min={new Date().toISOString().slice(0, 10)}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      <select
        className="input-field mt-3 px-3 py-2.5"
        value={slot}
        onChange={(e) => setSlot(e.target.value)}
      >
        <option value="">Choose a time</option>
        {SLOTS.filter((s) => !freeSlots || freeSlots.includes(s)).map((s) => (
          <option key={s} value={s}>
            {TIME_SLOT_LABEL[s] ?? s}
          </option>
        ))}
      </select>
      {date && freeSlots && freeSlots.length === 0 && (
        <p className="mt-2 text-sm text-content-secondary">
          No free times that day. Pick another date.
        </p>
      )}

      <button
        className="btn-primary mt-3 px-5 py-2.5 text-sm"
        disabled={busy || !date || !slot}
        onClick={() => void book()}
      >
        {busy ? 'Booking…' : 'Book this time'}
      </button>
    </div>
  )
}
