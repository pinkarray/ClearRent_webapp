'use client'

import { useState } from 'react'
import {
  completeInspection,
  confirmMet,
  markArrived,
  rateInspection,
} from '../lib/inspections'

export type InspectionState = {
  id: string
  status: string
  paymentStatus: string
  /** The scheduled slot. Arrival/completion only open on this calendar day. */
  requestedDate: Date | null
  tenantArrived: boolean
  handlerArrived: boolean
  tenantConfirmedMet: boolean
  handlerConfirmedMet: boolean
  tenantRated: boolean
  /** Who the tenant rates: the agent when agent-handled, else the landlord. */
  handlerId: string
  handlerName: string
  handlerType: 'agent' | 'landlord'
  /**
   * The landlord lives in the unit AND is handling it themselves, so they are
   * already there. "I've arrived" reads as nonsense to them — see
   * `handlerIsResident` in `inspection_request_model.dart`, which this
   * mirrors. An assigned agent still travels, whoever lives there.
   */
  handlerIsResident?: boolean
}

/** Same calendar day in the viewer's timezone. Mirrors the app's _isToday. */
function isToday(d: Date): boolean {
  const n = new Date()
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  )
}

/**
 * Drives the shared part of the inspection state machine, from both sides.
 *
 * The order is enforced by rules, not just by this UI:
 *   approved → both arrive → both confirm met → handler completes → tenant rates
 *
 * Each step is field-scoped so neither party can act for the other — a tenant
 * cannot mark the handler arrived, and neither can complete a visit that both
 * have not confirmed happened.
 */
export function InspectionActions({
  state,
  role,
  uid,
  onDone,
}: {
  state: InspectionState
  role: 'tenant' | 'handler'
  uid: string
  onDone: () => void | Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')

  async function run(fn: () => Promise<string | null>) {
    setError(null)
    setBusy(true)
    const err = await fn()
    setBusy(false)
    if (err) setError(err)
    else await onDone()
  }

  const mine = role === 'tenant'
  // Only meaningful when the landlord handles it themselves; an assigned agent
  // travels regardless of who lives there.
  const resident = state.handlerIsResident === true &&
    state.handlerType === 'landlord'
  const iArrived = mine ? state.tenantArrived : state.handlerArrived
  const theyArrived = mine ? state.handlerArrived : state.tenantArrived
  const iConfirmed = mine ? state.tenantConfirmedMet : state.handlerConfirmedMet
  const bothArrived = state.tenantArrived && state.handlerArrived
  const bothConfirmed = state.tenantConfirmedMet && state.handlerConfirmedMet

  // Nothing to do until it is approved and (when chargeable) paid — and not
  // before the day itself. Without the date check a Sunday visitor could mark
  // arrived, confirm met and complete a Monday inspection, which is how a
  // visit that never happened ends up on the record backing the handler's
  // payout. The app has always gated this (_isToday); web had not.
  const settled =
    state.status === 'approved' &&
    (state.paymentStatus === 'paid' || state.paymentStatus === 'not_required')

  const onTheDay = state.requestedDate !== null && isToday(state.requestedDate)
  const live = settled && onTheDay
  const waiting = settled && !onTheDay

  if (!live && !waiting && state.status !== 'completed') return null

  return (
    <div className="mt-4 border-t border-divider pt-4">
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {waiting && (
        <p className="text-sm text-content-secondary">
          {state.requestedDate
            ? `Arrival and completion open on ${state.requestedDate.toLocaleDateString(
                'en-NG',
                { weekday: 'long', day: 'numeric', month: 'long' },
              )}.`
            : 'This inspection has no scheduled date on file — contact support.'}
        </p>
      )}

      {live && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-content-hint">
            On the day
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            {!iArrived ? (
              <button
                className="btn-primary px-5 py-2.5 text-sm"
                disabled={busy}
                onClick={() => run(() => markArrived(state.id, role))}
              >
                {resident && !mine ? "I'm at home and ready" : "I've arrived"}
              </button>
            ) : (
              <span className="text-sm text-content-secondary">
                {resident && !mine ? '✓ You are ready' : '✓ You arrived'}
              </span>
            )}

            <span className="text-sm text-content-secondary">
              {theyArrived
                ? mine && resident
                  ? '✓ Landlord is at the property and ready'
                  : `✓ ${mine ? 'Handler' : 'Tenant'} arrived`
                : `Waiting for the ${mine ? 'handler' : 'tenant'}`}
            </span>
          </div>

          {bothArrived && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {!iConfirmed ? (
                <button
                  className="btn-ghost px-5 py-2.5 text-sm"
                  disabled={busy}
                  onClick={() => run(() => confirmMet(state.id, role))}
                >
                  Confirm we met
                </button>
              ) : (
                <span className="text-sm text-content-secondary">✓ You confirmed</span>
              )}
            </div>
          )}

          {role === 'handler' && bothConfirmed && (
            <button
              className="btn-primary mt-3 px-5 py-2.5 text-sm"
              disabled={busy}
              onClick={() => run(() => completeInspection(state.id, uid, state.handlerType))}
            >
              Mark inspection complete
            </button>
          )}
        </>
      )}

      {state.status === 'completed' && role === 'tenant' && !state.tenantRated && (
        <div>
          <p className="text-sm font-medium text-content">
            Rate {state.handlerName}
          </p>
          <p className="mt-0.5 text-xs text-content-hint">
            Required before you can express interest in renting — it is what confirms the visit
            happened.
          </p>

          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                onClick={() => setRating(n)}
                className="text-2xl leading-none"
                style={{ color: n <= rating ? 'var(--secondary)' : 'var(--border)' }}
              >
                ★
              </button>
            ))}
          </div>

          <textarea
            className="input-field mt-2 px-4 py-3"
            rows={2}
            placeholder="Anything worth noting? (optional)"
            value={review}
            onChange={(e) => setReview(e.target.value)}
          />

          <button
            className="btn-primary mt-3 px-5 py-2.5 text-sm"
            disabled={busy || rating === 0}
            onClick={() =>
              run(() =>
                rateInspection(state.id, rating, review.trim(), {
                  id: state.handlerId,
                  type: state.handlerType,
                  name: state.handlerName,
                }),
              )
            }
          >
            {busy ? 'Saving…' : 'Submit rating'}
          </button>
        </div>
      )}

      {state.status === 'completed' && state.tenantRated && role === 'tenant' && (
        <p className="text-sm text-content-secondary">
          ✓ Rated. You can now express interest in renting this property.
        </p>
      )}
    </div>
  )
}
