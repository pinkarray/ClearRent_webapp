'use client'

import { useState } from 'react'
import {
  TIME_SLOT_LABEL,
  isSlotStillBookable,
} from '../lib/inspections'
import {
  abandonReschedule,
  approveReschedule,
  counterPropose,
  declineReschedule,
  isReceiverOf,
  proposeReschedule,
  readProposal,
  receiverCannotCounter,
  withinRescheduleWindow,
} from '../lib/reschedule'

/*
  Moving an approved inspection, from either side.

  Three states, and only one is ever on screen:

    no proposal        -> offer to propose one
    yours is waiting   -> say so, offer to withdraw it
    theirs is waiting  -> accept, counter once, decline, or withdraw

  Declining is deliberately worded as ending the inspection, because Row 19
  sets status to 'declined' and triggers a refund. Someone who just wants to
  keep the original time wants Withdraw, and conflating the two would cancel
  inspections by accident.
*/

const SLOTS = ['morning', 'afternoon', 'late_afternoon', 'evening']

export function RescheduleActions({
  requestId,
  rescheduleProposal,
  requestedDate,
  status,
  rescheduleCount,
  role,
  actorRole,
  uid,
}: {
  requestId: string
  rescheduleProposal: unknown
  requestedDate: Date | null
  status: string
  rescheduleCount: number
  role: 'tenant' | 'handler'
  /** Precise role, stored on the proposal so the app can read it back. */
  actorRole: 'tenant' | 'agent' | 'landlord'
  uid: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [reason, setReason] = useState('')

  const proposal = readProposal(rescheduleProposal)

  async function run(fn: () => Promise<string | null>) {
    setBusy(true)
    setError(null)
    const err = await fn()
    setBusy(false)
    if (err) setError(err)
    else {
      setOpen(false)
      setDate('')
      setSlot('')
      setReason('')
    }
  }

  // Only an approved inspection can be moved, and only up to the cutoff.
  if (status !== 'approved') return null

  const canStart =
    !proposal && rescheduleCount < 2 && withinRescheduleWindow(requestedDate)
  const theirs = proposal !== null && isReceiverOf(proposal, role)
  const mine = proposal !== null && !theirs

  // Past the cutoff with nothing pending there is nothing useful to show.
  if (!canStart && !proposal) return null

  const form = (
    <div className="mt-3 space-y-3">
      <input
        type="date"
        className="input w-full"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <select
        className="input w-full"
        value={slot}
        onChange={(e) => setSlot(e.target.value)}
      >
        <option value="">Choose a time</option>
        {SLOTS.filter((s) => !date || isSlotStillBookable(date, s)).map((s) => (
          <option key={s} value={s}>
            {TIME_SLOT_LABEL[s] ?? s}
          </option>
        ))}
      </select>
      <input
        className="input w-full"
        placeholder="Why the change?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </div>
  )

  const canSend = date !== '' && slot !== '' && reason.trim() !== ''

  return (
    <div className="mt-4 border-t border-divider pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-content-hint">
        Reschedule
      </p>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}

      {mine && proposal && (
        <>
          <p className="mt-2 text-sm text-content-secondary">
            You asked to move this to{' '}
            <span className="font-medium text-content">
              {proposal.proposedDate?.toLocaleDateString('en-NG', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }) ?? 'a new date'}
              , {proposal.proposedTimeDisplay}
            </span>
            . Waiting for a reply.
          </p>
          <button
            className="btn-ghost mt-3 px-5 py-2.5 text-sm"
            disabled={busy}
            onClick={() => void run(() => abandonReschedule(requestId))}
          >
            Withdraw the request
          </button>
        </>
      )}

      {theirs && proposal && (
        <>
          <p className="mt-2 text-sm text-content-secondary">
            The {proposal.proposedBy === 'tenant' ? 'tenant' : 'handler'} asked
            to move this to{' '}
            <span className="font-medium text-content">
              {proposal.proposedDate?.toLocaleDateString('en-NG', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }) ?? 'a new date'}
              , {proposal.proposedTimeDisplay}
            </span>
            {proposal.reason ? `: "${proposal.reason}"` : ''}
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            <button
              className="btn-primary px-5 py-2.5 text-sm"
              disabled={busy}
              onClick={() => void run(() => approveReschedule(requestId, role))}
            >
              Accept the new time
            </button>

            {!receiverCannotCounter(proposal) && (
              <button
                className="btn-ghost px-5 py-2.5 text-sm"
                disabled={busy}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? 'Never mind' : 'Suggest another time'}
              </button>
            )}

            <button
              className="btn-ghost px-5 py-2.5 text-sm"
              disabled={busy}
              onClick={() => void run(() => abandonReschedule(requestId))}
            >
              Keep the original time
            </button>

            {/* Ends the inspection and refunds. Worded so nobody presses it
                expecting to keep the original slot. */}
            <button
              className="btn-ghost px-5 py-2.5 text-sm text-error"
              disabled={busy}
              onClick={() => {
                const why = window.prompt(
                  'Declining CANCELS this inspection and refunds it. Why?',
                )
                if (why === null) return
                void run(() =>
                  declineReschedule(requestId, role, actorRole, why),
                )
              }}
            >
              Decline and cancel
            </button>
          </div>

          {open && (
            <>
              {form}
              <button
                className="btn-primary mt-3 px-5 py-2.5 text-sm"
                disabled={busy || !canSend}
                onClick={() =>
                  void run(() =>
                    counterPropose(requestId, actorRole, uid, {
                      date: new Date(`${date}T00:00:00`),
                      slot,
                      reason,
                    }),
                  )
                }
              >
                Send this time instead
              </button>
            </>
          )}
        </>
      )}

      {canStart && (
        <>
          <button
            className="btn-ghost mt-2 px-5 py-2.5 text-sm"
            disabled={busy}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Never mind' : 'Ask to move this inspection'}
          </button>
          {open && (
            <>
              {form}
              <button
                className="btn-primary mt-3 px-5 py-2.5 text-sm"
                disabled={busy || !canSend}
                onClick={() =>
                  void run(() =>
                    proposeReschedule(requestId, actorRole, uid, {
                      date: new Date(`${date}T00:00:00`),
                      slot,
                      reason,
                    }),
                  )
                }
              >
                Send request
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
