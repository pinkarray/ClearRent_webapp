import {
  Timestamp,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { clientDb } from './firebase-client'
import { TIME_SLOT_DISPLAY, composeScheduledDateTime } from './inspections'

/*
  Moving an approved inspection.

  This is a negotiation, not a setting: one side proposes, the other accepts,
  counters once, declines, or either side withdraws. It mirrors
  InspectionService in the app and firestore.rules Rows 16 to 20, which are
  hasOnly allowlists, so every write below sends exactly the keys its row
  permits and nothing else. One stray field fails the whole update.

  None of this existed on web, so a tenant or handler who needed a different
  time had to go and find the app.
*/

/** The live proposal sitting on a request, if any. */
export type RescheduleProposal = {
  /** Precise role, because the app writes it that way. */
  proposedBy: 'tenant' | 'agent' | 'landlord'
  proposedByUserId: string
  proposedDate: Date | null
  proposedTimeSlot: string
  proposedTimeDisplay: string
  reason: string
  tenantHasCountered: boolean
  handlerHasCountered: boolean
}

export function readProposal(
  x: unknown,
): RescheduleProposal | null {
  if (!x || typeof x !== 'object') return null
  const p = x as Record<string, unknown>
  const by = p.proposedBy
  if (by !== 'tenant' && by !== 'agent' && by !== 'landlord') return null
  return {
    proposedBy: by,
    proposedByUserId: (p.proposedByUserId as string) ?? '',
    proposedDate: (p.proposedDate as { toDate?: () => Date })?.toDate?.() ?? null,
    proposedTimeSlot: (p.proposedTimeSlot as string) ?? '',
    proposedTimeDisplay: (p.proposedTimeDisplay as string) ?? '',
    reason: (p.reason as string) ?? '',
    tenantHasCountered: p.tenantHasCountered === true,
    handlerHasCountered: p.handlerHasCountered === true,
  }
}

/**
 * You are the side being asked, not the side asking.
 *
 * Only the SIDE matters, so agent and landlord collapse into "handler" here
 * even though the stored value distinguishes them.
 */
export function isReceiverOf(
  proposal: RescheduleProposal,
  role: 'tenant' | 'handler',
): boolean {
  return proposal.proposedBy === 'tenant' ? role === 'handler' : role === 'tenant'
}

/** The receiver has already spent their one counter. Mirrors the app getter. */
export function receiverCannotCounter(p: RescheduleProposal): boolean {
  return p.proposedBy !== 'tenant' ? p.tenantHasCountered : p.handlerHasCountered
}

/**
 * Rescheduling closes two hours before the slot, the same cutoff as the app.
 * Past that the visit is imminent and the honest answer is cancel, not move.
 */
export function withinRescheduleWindow(requestedDate: Date | null): boolean {
  if (!requestedDate) return false
  return Date.now() < requestedDate.getTime() - 2 * 60 * 60 * 1000
}

function proposalMap(
  as: 'tenant' | 'agent' | 'landlord',
  uid: string,
  date: Date,
  slot: string,
  reason: string,
  countered: { tenant: boolean; handler: boolean },
) {
  return {
    proposedBy: as,
    proposedByUserId: uid,
    proposedDate: Timestamp.fromDate(composeScheduledDateTime(date, slot)),
    proposedTimeSlot: slot,
    proposedTimeDisplay: TIME_SLOT_DISPLAY[slot] ?? slot,
    reason: reason.trim(),
    proposedAt: Timestamp.fromDate(new Date()),
    tenantHasCountered: countered.tenant,
    handlerHasCountered: countered.handler,
  }
}

/**
 * Ask to move an approved inspection. Row 16.
 *
 * Capped at two moves per request, and blocked while a proposal is already
 * waiting, so this cannot become an endless negotiation that never reaches a
 * visit. Guards are re-read from the document rather than trusted from the UI,
 * which can be stale by the time the button is pressed.
 */
export async function proposeReschedule(
  requestId: string,
  as: 'tenant' | 'agent' | 'landlord',
  uid: string,
  opts: { date: Date; slot: string; reason: string },
): Promise<string | null> {
  if (!opts.reason.trim()) return 'Give a reason for moving it.'
  try {
    const ref = doc(clientDb(), 'inspection_requests', requestId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return 'That inspection no longer exists.'
    const d = snap.data()
    if (d.status !== 'approved') return 'Only an approved inspection can be moved.'
    if (d.rescheduleProposal) return 'There is already a proposal waiting on a reply.'
    if ((d.rescheduleCount ?? 0) >= 2) {
      return 'This inspection has been moved twice already. Cancel and book again.'
    }
    if (!withinRescheduleWindow(d.requestedDate?.toDate?.() ?? null)) {
      return 'It is too close to the slot to move it. Cancel it instead.'
    }
    await updateDoc(ref, {
      rescheduleProposal: proposalMap(as, uid, opts.date, opts.slot, opts.reason, {
        tenant: false,
        handler: false,
      }),
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not propose a new time.'
  }
}

/**
 * Counter with a different time. Row 17.
 *
 * Each side gets exactly ONE counter, tracked by the two flags carried on the
 * proposal itself, which is why they are read and carried forward rather than
 * reset.
 */
export async function counterPropose(
  requestId: string,
  as: 'tenant' | 'agent' | 'landlord',
  uid: string,
  opts: { date: Date; slot: string; reason: string },
): Promise<string | null> {
  if (!opts.reason.trim()) return 'Give a reason for the different time.'
  try {
    const ref = doc(clientDb(), 'inspection_requests', requestId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return 'That inspection no longer exists.'
    const d = snap.data()
    const current = readProposal(d.rescheduleProposal)
    if (!current) return 'There is no proposal to counter.'
    const role: 'tenant' | 'handler' = as === 'tenant' ? 'tenant' : 'handler'
    if (!isReceiverOf(current, role)) return 'You proposed this one, wait for a reply.'
    if (receiverCannotCounter(current)) {
      return 'You have already countered once. Accept it or decline it.'
    }
    if (!withinRescheduleWindow(d.requestedDate?.toDate?.() ?? null)) {
      return 'It is too close to the slot to move it. Cancel it instead.'
    }
    await updateDoc(ref, {
      rescheduleProposal: proposalMap(as, uid, opts.date, opts.slot, opts.reason, {
        tenant: current.tenantHasCountered || role === 'tenant',
        handler: current.handlerHasCountered || role === 'handler',
      }),
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not send your counter-proposal.'
  }
}

/**
 * Accept the proposed time. Row 18.
 *
 * Moves the slot AND clears every arrival and on-way flag, because they belong
 * to a visit that is no longer happening. Leaving them set would let somebody
 * who turned up at the old time still count as present at the new one.
 */
export async function approveReschedule(
  requestId: string,
  role: 'tenant' | 'handler',
): Promise<string | null> {
  try {
    const ref = doc(clientDb(), 'inspection_requests', requestId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return 'That inspection no longer exists.'
    const current = readProposal(snap.data().rescheduleProposal)
    if (!current) return 'There is no proposal to accept.'
    if (!isReceiverOf(current, role)) return 'You proposed this one, wait for a reply.'
    if (!current.proposedDate) return 'That proposal has no date on it.'
    await updateDoc(ref, {
      requestedDate: Timestamp.fromDate(
        composeScheduledDateTime(current.proposedDate, current.proposedTimeSlot),
      ),
      requestedTimeSlot: current.proposedTimeSlot,
      requestedTimeDisplay: current.proposedTimeDisplay,
      rescheduleProposal: null,
      rescheduleCount: increment(1),
      tenantArrived: false,
      tenantArrivedAt: null,
      handlerArrived: false,
      handlerArrivedAt: null,
      tenantOnWay: false,
      tenantOnWayAt: null,
      handlerOnWay: false,
      handlerOnWayAt: null,
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not accept the new time.'
  }
}

/**
 * Refuse the proposed time, which ends the inspection. Row 19.
 *
 * Declining does NOT mean "keep the original": it declines the whole request
 * and the refund follows server-side. To keep the original time, withdraw the
 * proposal instead.
 */
export async function declineReschedule(
  requestId: string,
  role: 'tenant' | 'handler',
  actorRole: 'tenant' | 'agent' | 'landlord',
  reason: string,
): Promise<string | null> {
  if (!reason.trim()) return 'Give a reason so the other party knows why.'
  try {
    const ref = doc(clientDb(), 'inspection_requests', requestId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return 'That inspection no longer exists.'
    const current = readProposal(snap.data().rescheduleProposal)
    if (!current) return 'There is no proposal to decline.'
    if (!isReceiverOf(current, role)) return 'You proposed this one, wait for a reply.'
    await updateDoc(ref, {
      status: 'declined',
      declinedBy: actorRole,
      declineReason: reason.trim(),
      declinedAt: serverTimestamp(),
      rescheduleProposal: null,
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not decline the new time.'
  }
}

/**
 * Withdraw the proposal and keep the original time. Row 20.
 *
 * Open to EITHER party, including whoever proposed it, which is the way out
 * for a proposer who changed their mind. Unlike declining, nothing is
 * cancelled and nothing is refunded.
 */
export async function abandonReschedule(requestId: string): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'inspection_requests', requestId), {
      rescheduleProposal: null,
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not withdraw the proposal.'
  }
}
