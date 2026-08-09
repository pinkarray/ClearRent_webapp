import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { clientApp, clientDb, initAppCheck } from './firebase-client'
import { trackInquiry } from './activity'

/**
 * Booking an inspection.
 *
 * This is a plain Firestore write, NOT a callable — `createRentalInterest` is a
 * different, later step (it runs after the inspection is completed and rated).
 * So no App Check is involved here; `firestore.rules` is the enforcement:
 *
 *   allow create: if request.auth != null && actorHasBankDetails()
 *                 && propertyIsReady();
 *
 * The checks below mirror `InspectionService`'s client gates so the tenant gets
 * a sentence explaining what's missing rather than a bare permission error.
 */

export const TIME_SLOT_DISPLAY: Record<string, string> = {
  morning: '9:00 AM - 12:00 PM',
  afternoon: '12:00 PM - 3:00 PM',
  late_afternoon: '3:00 PM - 6:00 PM',
  evening: '6:00 PM - 8:00 PM',
}

export const TIME_SLOT_LABEL: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  late_afternoon: 'Late afternoon',
  evening: 'Evening',
}

/** Start-of-window hour, folded into the requested date. Matches the app. */
const TIME_SLOT_START_HOUR: Record<string, number> = {
  morning: 9,
  afternoon: 12,
  late_afternoon: 15,
  evening: 18,
}

/**
 * How far ahead a slot must start to still be bookable.
 *
 * Mirrors `InspectionService.bookingLeadTime` in the app and `LEAD_TIME_MS` in
 * `inspection_slots_ops.ts`. Web previously used a flat 24 hours, which made
 * today unbookable here while both the app and the server still allowed it.
 */
export const BOOKING_LEAD_MS = 2 * 60 * 60 * 1000

/** Whether [slot] on [dateISO] ('YYYY-MM-DD') still starts beyond the lead time. */
export function isSlotStillBookable(dateISO: string, slot: string): boolean {
  const hour = TIME_SLOT_START_HOUR[slot]
  // Unknown slot: a data problem, not a timing one. Leave it to the caller.
  if (hour === undefined) return true
  const [y, m, d] = dateISO.split('-').map(Number)
  return new Date(y, m - 1, d, hour).getTime() > Date.now() + BOOKING_LEAD_MS
}

function composeScheduledDateTime(date: Date, slot: string): Date {
  const hour = TIME_SLOT_START_HOUR[slot]
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (hour !== undefined) d.setHours(hour, 0, 0, 0)
  return d
}

/**
 * The property fields booking needs. Read client-side by the signed-in tenant —
 * `properties` is readable by any authenticated user, so this does not need the
 * public projection (which deliberately omits landlordId and the fee fields).
 */
export type BookableProperty = {
  id: string
  title: string
  images: string[]
  approximateAddress: string
  landlordId: string
  landlordName: string
  landlordPhone: string | null
  inspectionHandler: string
  assignedAgentId: string | null
  readyForInspections: boolean
  landlordLivesInProperty: boolean
  inspectionDays: string[]
  inspectionTimeSlots: string[]
  inspectionFeeTotal: number
  inspectionTransportFee: number
  inspectionServiceFee: number
  inspectionPropertyCluster: string | null
  inspectionAgentCluster: string | null
}

function approximateAddress(d: Record<string, unknown>): string {
  const parts = [d.lga, d.city, d.state]
    .map((p) => (typeof p === 'string' ? p : ''))
    .filter((p) => p.length > 0)
  return parts.length === 0 ? 'Location available after approval' : parts.join(', ')
}

export async function loadBookableProperty(id: string): Promise<BookableProperty | null> {
  const snap = await getDoc(doc(clientDb(), 'properties', id))
  if (!snap.exists()) return null
  const d = snap.data() as Record<string, unknown>

  const num = (v: unknown) => (typeof v === 'number' ? v : 0)
  const str = (v: unknown) => (typeof v === 'string' ? v : '')

  return {
    id: snap.id,
    title: str(d.title),
    images: Array.isArray(d.images) ? (d.images as string[]) : [],
    approximateAddress: approximateAddress(d),
    landlordId: str(d.landlordId),
    landlordName: str(d.landlordName) || 'Landlord',
    landlordPhone: typeof d.landlordPhone === 'string' ? d.landlordPhone : null,
    inspectionHandler: str(d.inspectionHandler) || 'self',
    assignedAgentId: typeof d.assignedAgentId === 'string' ? d.assignedAgentId : null,
    readyForInspections: d.readyForInspections === true,
    landlordLivesInProperty: d.landlordLivesInProperty === true,
    inspectionDays: Array.isArray(d.inspectionDays) ? (d.inspectionDays as string[]) : [],
    inspectionTimeSlots: Array.isArray(d.inspectionTimeSlots)
      ? (d.inspectionTimeSlots as string[])
      : [],
    inspectionFeeTotal: num(d.inspectionFeeTotal),
    inspectionTransportFee: num(d.inspectionTransportFee),
    inspectionServiceFee: num(d.inspectionServiceFee),
    inspectionPropertyCluster:
      typeof d.inspectionPropertyCluster === 'string' ? d.inspectionPropertyCluster : null,
    inspectionAgentCluster:
      typeof d.inspectionAgentCluster === 'string' ? d.inspectionAgentCluster : null,
  }
}

/** Statuses that count as an open request — one per tenant per property. */
const ACTIVE_STATUSES = [
  'pending',
  'approved',
  'pendingPayment',
  'pendingVerification',
  'declinedByAgent',
]

export async function hasActiveRequest(propertyId: string, tenantId: string): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(clientDb(), 'inspection_requests'),
      where('propertyId', '==', propertyId),
      where('tenantId', '==', tenantId),
      where('status', 'in', ACTIVE_STATUSES),
    ),
  )
  return !snap.empty
}

async function isUserVerified(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(clientDb(), 'users', uid))
  return snap.exists() && snap.data()?.verificationStatus === 'verified'
}

export type BookingInput = {
  property: BookableProperty
  requestedDate: Date
  requestedTimeSlot: string
  notes: string
}

export type BookingResult = { requestId: string } | { error: string }

/**
 * Creates the inspection request.
 *
 * Pay-after-approve: nothing is charged here. A fee-bearing request is born
 * 'unpaid' and the tenant pays once the handler approves; a free one is
 * 'not_required'. Status is always 'pending' — no money has moved.
 *
 * Only the AREA-level address is stored on the request. The exact street
 * address stays in the gated `private/location` subdoc and is revealed to the
 * tenant when the handler approves.
 */
export async function createInspectionRequest(
  tenantId: string,
  input: BookingInput,
): Promise<BookingResult> {
  const { property } = input

  if (!property.readyForInspections) {
    return { error: 'This property has not been vetted for inspections yet.' }
  }
  if (!(await isUserVerified(tenantId))) {
    return { error: 'Your account must be verified before you can book an inspection.' }
  }
  if (!(await isUserVerified(property.landlordId))) {
    return { error: 'The landlord on this property is not verified yet.' }
  }

  const isAgentHandled =
    property.inspectionHandler === 'agent' && property.assignedAgentId !== null
  if (isAgentHandled && !(await isUserVerified(property.assignedAgentId as string))) {
    return { error: 'The agent handling this property is not verified yet.' }
  }

  if (await hasActiveRequest(property.id, tenantId)) {
    return { error: 'You already have an open inspection request on this property.' }
  }

  const tenantSnap = await getDoc(doc(clientDb(), 'users', tenantId))
  const tenant = tenantSnap.data() ?? {}

  let agentName: string | null = null
  let agentPhone: string | null = null
  let agentLatitude: number | null = null
  let agentLongitude: number | null = null
  let agentBaseLocation: string | null = null

  if (isAgentHandled) {
    const agentSnap = await getDoc(doc(clientDb(), 'users', property.assignedAgentId as string))
    const a = agentSnap.data() ?? {}
    agentName = (a.fullName as string) ?? null
    agentPhone = (a.phone as string) ?? null
    agentLatitude = typeof a.baseLatitude === 'number' ? a.baseLatitude : null
    agentLongitude = typeof a.baseLongitude === 'number' ? a.baseLongitude : null
    agentBaseLocation = (a.baseLocation as string) ?? null
  }

  // Flat-fee model: the tenant pays inspectionFeeTotal, the handler earns
  // inspectionServiceFee, ClearRent keeps the remainder. All three are already
  // resolved on the property, so nothing is recomputed here.
  const totalFee = property.inspectionFeeTotal
  const transportFee = property.inspectionTransportFee
  const agentServiceFee = property.inspectionServiceFee
  const agentEarnings = agentServiceFee + transportFee
  const clearrentFee = Math.max(0, totalFee - agentEarnings)

  try {
    const ref = await addDoc(collection(clientDb(), 'inspection_requests'), {
      propertyId: property.id,
      propertyTitle: property.title,
      propertyImage: property.images[0] ?? '',
      // Area level only — the street address is released on approval.
      propertyAddress: property.approximateAddress,

      tenantId,
      tenantName: (tenant.fullName as string) ?? 'Tenant',
      tenantPhone: (tenant.phone as string) ?? null,

      landlordId: property.landlordId,
      landlordName: property.landlordName,
      landlordPhone: property.landlordPhone,

      agentId: isAgentHandled ? property.assignedAgentId : null,
      agentName,
      agentPhone,
      agentLatitude,
      agentLongitude,
      agentBaseLocation,

      requestedDate: Timestamp.fromDate(
        composeScheduledDateTime(input.requestedDate, input.requestedTimeSlot),
      ),
      requestedTimeSlot: input.requestedTimeSlot,
      requestedTimeDisplay:
        TIME_SLOT_DISPLAY[input.requestedTimeSlot] ?? input.requestedTimeSlot,
      notes: input.notes,

      agentCluster: property.inspectionAgentCluster,
      propertyCluster: property.inspectionPropertyCluster,
      propertyArea: null,
      transportFee,
      agentServiceFee,
      clearrentFee,
      totalFee,
      agentEarnings,

      isSelfHandled: property.inspectionHandler !== 'agent',
      landlordLivesInProperty: property.landlordLivesInProperty,

      paymentStatus: totalFee > 0 ? 'unpaid' : 'not_required',
      paymentReference: null,
      paymentProofUrl: null,
      paidAt: null,
      paymentVerifiedAt: null,
      paymentVerifiedBy: null,
      refundedAt: null,
      refundReason: null,

      status: 'pending',
      declinedBy: null,
      declineReason: null,
      declinedAt: null,
      landlordOverrideDeadline: null,

      wasOverridden: false,
      overriddenBy: null,
      originalDeclineBy: null,

      completedAt: null,
      tenantRating: null,
      tenantReview: null,

      tenantArrived: false,
      tenantArrivedAt: null,
      handlerArrived: false,
      handlerArrivedAt: null,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // Surfaces the booking on the landlord's recent-activity feed. Written by
    // the client here because that is where the app writes it too — there is no
    // trigger doing it server-side.
    await trackInquiry({
      landlordId: property.landlordId,
      propertyId: property.id,
      propertyTitle: property.title,
      tenantId,
      tenantName: (tenant.fullName as string) ?? 'Tenant',
    })

    return { requestId: ref.id }
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    if (code === 'permission-denied') {
      return {
        error:
          'Rules rejected the booking. Check that your payout account is on file and the property is marked ready.',
      }
    }
    return { error: err instanceof Error ? err.message : 'Could not create the request.' }
  }
}

// ── Handler decisions ────────────────────────────────────────────────

/**
 * The handler approves. Rules restrict this to a field-scoped write of
 * ['status', 'updatedAt'] by the agent (when agent-handled) or the landlord,
 * and only from 'pending' / 'pendingVerification'. The handler must also have a
 * payout account on file, so an inspection payout has a destination.
 *
 * Nothing is charged here — the tenant pays after approval.
 */
export async function approveInspection(requestId: string): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'inspection_requests', requestId), {
      status: 'approved',
      updatedAt: serverTimestamp(),
    })
    return null
  } catch (err) {
    if ((err as { code?: string })?.code === 'permission-denied') {
      return 'Rules rejected the approval. Check you are the handler and have a payout account on file.'
    }
    return err instanceof Error ? err.message : 'Could not approve the request.'
  }
}

/**
 * Declines. The target status differs by who is declining, and the two rule
 * clauses allow different field sets — an agent decline is `declinedByAgent`
 * (the landlord may still override it), a landlord decline is final.
 */
export async function declineInspection(
  requestId: string,
  reason: string,
  as: 'agent' | 'landlord',
  uid: string,
): Promise<string | null> {
  const base = {
    declinedBy: uid,
    declineReason: reason,
    declinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  try {
    await updateDoc(
      doc(clientDb(), 'inspection_requests', requestId),
      as === 'agent'
        ? {
            ...base,
            status: 'declinedByAgent',
            // 12-hour window for the landlord to override the agent.
            landlordOverrideDeadline: Timestamp.fromDate(
              new Date(Date.now() + 12 * 60 * 60 * 1000),
            ),
            originalDeclineBy: uid,
          }
        : { ...base, status: 'declined', wasOverridden: false, overriddenBy: null },
    )
    return null
  } catch (err) {
    if ((err as { code?: string })?.code === 'permission-denied') {
      return 'Rules rejected the decline. Check the request is still open.'
    }
    return err instanceof Error ? err.message : 'Could not decline the request.'
  }
}

// ── Payment confirmation ─────────────────────────────────────────────

/**
 * Confirms a paid inspection and triggers the address reveal.
 *
 * The callable does the interesting part server-side: it flips paymentStatus to
 * 'paid', copies the EXACT street address and coordinates from the gated
 * `private/location` subdoc onto the request, and writes the
 * `properties/{id}/reveals/{tenantId}` grant. That is why the tenant suddenly
 * sees a real address — the client never reads the private subdoc itself.
 *
 * Idempotent: replaying it on an already-paid request returns alreadyPaid.
 */
export async function confirmInspectionPayment(
  requestId: string,
  paymentReference: string,
): Promise<string | null> {
  initAppCheck()
  try {
    const fn = httpsCallable<
      { requestId: string; paymentReference: string },
      { success?: boolean; alreadyPaid?: boolean }
    >(getFunctions(clientApp(), 'us-central1'), 'confirmInspectionPayment')
    await fn({ requestId, paymentReference })
    return null
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    if (code === 'functions/failed-precondition') {
      return 'This inspection is not approved yet, so it cannot be paid.'
    }
    if (code === 'functions/unauthenticated') {
      return 'The request was rejected (App Check or sign-in). Reload and try again.'
    }
    return err instanceof Error ? err.message : 'Could not confirm the payment.'
  }
}

// ── The meeting: arrive → confirm met → complete → rate ──────────────

/**
 * Each side marks their own arrival. Rules field-scope these so neither party
 * can flip the other's flag — a tenant cannot claim the handler showed up.
 */
export async function markArrived(
  requestId: string,
  as: 'tenant' | 'handler',
): Promise<string | null> {
  const fields =
    as === 'tenant'
      ? { tenantArrived: true, tenantArrivedAt: serverTimestamp() }
      : { handlerArrived: true, handlerArrivedAt: serverTimestamp() }
  try {
    await updateDoc(doc(clientDb(), 'inspection_requests', requestId), {
      ...fields,
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not record your arrival. The inspection must be approved first.'
  }
}

/**
 * Each side confirms the meeting actually happened. Only possible once BOTH
 * arrival flags are set — a meeting needs two halves, and the rule checks both
 * before letting either party confirm.
 */
export async function confirmMet(
  requestId: string,
  as: 'tenant' | 'handler',
): Promise<string | null> {
  const fields =
    as === 'tenant'
      ? { tenantConfirmedMet: true, tenantConfirmedMetAt: serverTimestamp() }
      : { handlerConfirmedMet: true, handlerConfirmedMetAt: serverTimestamp() }
  try {
    await updateDoc(doc(clientDb(), 'inspection_requests', requestId), {
      ...fields,
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Both of you must mark yourselves arrived before confirming the meeting.'
  }
}

/**
 * The handler closes the inspection. Rules require BOTH confirmed-met flags, so
 * this cannot be used to complete a visit that never happened. Completion
 * triggers the creditInspectionEarnings function, which is why
 * agentPayoutStatus starts at 'pending'.
 */
export async function completeInspection(
  requestId: string,
  uid: string,
  handlerType: 'agent' | 'landlord',
): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'inspection_requests', requestId), {
      status: 'completed',
      completedAt: serverTimestamp(),
      agentPayoutStatus: 'pending',
      completedBy: uid,
      completedByType: handlerType,
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Both parties must confirm the meeting before it can be completed.'
  }
}

/**
 * The tenant rates the handler. Required before expressing rental interest —
 * `createRentalInterest` rejects an unrated inspection, because the rating is
 * the tenant's confirmation the visit genuinely happened and is what backs the
 * handler's payment.
 *
 * The client never writes aggregate rating/totalRatings; a Cloud Function
 * recomputes the ratee's Bayesian average from this write, and rules lock the
 * aggregate fields.
 */
export async function rateInspection(
  requestId: string,
  rating: number,
  review: string,
  ratee: { id: string; type: 'agent' | 'landlord'; name: string },
): Promise<string | null> {
  if (rating < 1 || rating > 5) return 'Choose a rating between 1 and 5.'
  try {
    await updateDoc(doc(clientDb(), 'inspection_requests', requestId), {
      tenantRating: rating,
      tenantReview: review,
      tenantRated: true,
      ratingSubmittedAt: serverTimestamp(),
      ratedUserId: ratee.id,
      ratedUserType: ratee.type,
      ratedUserName: ratee.name,
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not save your rating. It may already have been submitted.'
  }
}
