import {
  Timestamp,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { clientApp, clientDb, initAppCheck } from './firebase-client'

/**
 * From a completed inspection to a tenancy, and out again.
 *
 *   rate inspection → express interest → landlord accepts → tenant accepts the
 *   agreement (this is what "finalizes" it) → tenant pays rent → move out
 *
 * Money and identity fields on a rental interest are IMMUTABLE after creation
 * and creation itself is server-only (`allow create: if false`). A client could
 * once mint an interest claiming ₦100 against a ₦1.2m tenancy, which the rules
 * then froze and `initializePayment` charged. Everything here therefore either
 * goes through a callable or touches only the allowlisted lifecycle fields.
 */

function callables() {
  initAppCheck()
  return getFunctions(clientApp(), 'us-central1')
}

/**
 * Expresses interest in renting, off the back of a completed inspection.
 *
 * Server-side this derives every amount from the property and pricing config.
 * Two gates it enforces that are worth surfacing in the UI: the inspection must
 * be `completed`, and the tenant must have RATED it — the rating is what backs
 * the handler's payment, so it is required, not optional.
 */
export async function createRentalInterest(
  inspectionRequestId: string,
): Promise<{ interestId: string } | { error: string }> {
  try {
    const fn = httpsCallable<
      { inspectionRequestId: string },
      { interestId: string; created: boolean }
    >(callables(), 'createRentalInterest')
    const res = await fn({ inspectionRequestId })
    return { interestId: res.data.interestId }
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    const message = err instanceof Error ? err.message : ''
    if (code === 'functions/failed-precondition') {
      return { error: message || 'Complete and rate the inspection first.' }
    }
    if (code === 'functions/unauthenticated') {
      return { error: 'The request was rejected (App Check or sign-in). Reload and try again.' }
    }
    return { error: message || 'Could not express interest.' }
  }
}

export type RentalInterest = {
  id: string
  propertyId: string
  propertyTitle: string
  tenantId: string
  tenantName: string
  landlordId: string
  status: string
  rentAmount: number
  paymentAmount: number
}

function interestsQuery(field: 'tenantId' | 'landlordId', uid: string) {
  return query(collection(clientDb(), 'rental_interests'), where(field, '==', uid))
}

function toInterest(d: QueryDocumentSnapshot): RentalInterest {
  const x = d.data()
  return {
    id: d.id,
    propertyId: (x.propertyId as string) ?? '',
    propertyTitle: (x.propertyTitle as string) ?? '(property)',
    tenantId: (x.tenantId as string) ?? '',
    tenantName: (x.tenantName as string) ?? 'Tenant',
    landlordId: (x.landlordId as string) ?? '',
    status: (x.status as string) ?? 'pending_acceptance',
    rentAmount: (x.rentAmount as number) ?? 0,
    paymentAmount: (x.paymentAmount as number) ?? 0,
  } satisfies RentalInterest
}

/**
 * LIVE rental interests.
 *
 * Every step of a tenancy is one party waiting on the other — the tenant sits
 * on this page after expressing interest while the landlord accepts elsewhere,
 * and acceptance is what unlocks the agreement and then rent. A one-time read
 * left whoever was waiting looking at a stale screen with no reason to reload.
 *
 * Returns the unsubscribe function.
 */
export function watchInterests(
  field: 'tenantId' | 'landlordId',
  uid: string,
  onChange: (rows: RentalInterest[]) => void,
): () => void {
  return onSnapshot(interestsQuery(field, uid), (snap) =>
    onChange(snap.docs.map(toInterest)),
  )
}

/**
 * The landlord accepts a tenant. Only the lifecycle fields are touched — every
 * amount on the document is immutable by rule.
 */
export async function acceptRentalInterest(interestId: string): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'rental_interests', interestId), {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not accept. Only the landlord on this interest can.'
  }
}

export type ActiveRental = {
  id: string
  rentalInterestId: string
  propertyId: string
  propertyTitle: string
  tenantId: string
  landlordId: string
  status: string
  agreementStatus: string
  rentPaymentStatus: string
  rentAmount: number
  // Lease detail. Written by rental_interest_ops on first tenancy and by
  // renewal_ops:484 on promotion; both surfaces read the same names.
  propertyAddress: string
  landlordName: string
  landlordPhone: string | null
  agentFee: number
  totalPaid: number
  rentFrequency: string
  leaseStartDate: Date | null
  leaseEndDate: Date | null
  nextPaymentDue: Date | null
  agreementUrl: string
  createdAt: Date | null
}

function toRental(d: QueryDocumentSnapshot): ActiveRental {
  const x = d.data()
  return {
      id: d.id,
      rentalInterestId: (x.rentalInterestId as string) ?? '',
      propertyId: (x.propertyId as string) ?? '',
      propertyTitle: (x.propertyTitle as string) ?? '(property)',
      tenantId: (x.tenantId as string) ?? '',
      landlordId: (x.landlordId as string) ?? '',
      status: (x.status as string) ?? 'active',
      agreementStatus: (x.agreementStatus as string) ?? 'pending',
      rentPaymentStatus: (x.rentPaymentStatus as string) ?? 'unpaid',
      rentAmount: (x.rentAmount as number) ?? 0,
      propertyAddress: (x.propertyAddress as string) ?? '',
      landlordName: (x.landlordName as string) ?? '',
      landlordPhone: (x.landlordPhone as string) ?? null,
      agentFee: (x.agentFee as number) ?? 0,
      totalPaid: (x.totalPaid as number) ?? 0,
      rentFrequency: (x.rentFrequency as string) ?? 'yearly',
      leaseStartDate: x.leaseStartDate?.toDate?.() ?? null,
      leaseEndDate: x.leaseEndDate?.toDate?.() ?? null,
      nextPaymentDue: x.nextPaymentDue?.toDate?.() ?? null,
      agreementUrl: (x.agreementUrl as string) ?? '',
      createdAt: x.createdAt?.toDate?.() ?? null,
  } satisfies ActiveRental
}

function rentalsQuery(field: 'tenantId' | 'landlordId', uid: string) {
  return query(collection(clientDb(), 'active_rentals'), where(field, '==', uid))
}

/** One-time read, for pages that only ever render a snapshot of history. */
export async function activeRentals(
  field: 'tenantId' | 'landlordId',
  uid: string,
): Promise<ActiveRental[]> {
  const snap = await getDocs(rentalsQuery(field, uid))
  return snap.docs.map(toRental)
}

/**
 * LIVE active rentals — the agreement and rent steps both change under whoever
 * is waiting. Returns the unsubscribe function.
 */
export function watchActiveRentals(
  field: 'tenantId' | 'landlordId',
  uid: string,
  onChange: (rows: ActiveRental[]) => void,
): () => void {
  return onSnapshot(rentalsQuery(field, uid), (snap) =>
    onChange(snap.docs.map(toRental)),
  )
}

/** Every rental this tenant has had, newest first — the app's "My rentals". */
export async function tenantRentalHistory(uid: string): Promise<ActiveRental[]> {
  const rentals = await activeRentals('tenantId', uid)
  return rentals.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

/** The landlord's side of the same list. */
export async function landlordRentals(uid: string): Promise<ActiveRental[]> {
  const rentals = await activeRentals('landlordId', uid)
  return rentals.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

/**
 * Attaches an uploaded tenancy agreement to a rental.
 *
 * `agreementUrl` holds the STORAGE PATH, not a URL — the file is private and is
 * only ever served through `getSignedAgreementUrl`, which checks rental
 * membership server-side (storage rules cannot: they cannot read Firestore).
 *
 * Only allowlisted fields may be written here; `firestore.rules:1054` rejects
 * the whole update if it touches anything else, which is what stops a landlord
 * self-applying a rent change through this path.
 */
export async function attachAgreement(
  rentalId: string,
  storagePath: string,
): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'active_rentals', rentalId), {
      agreementUrl: storagePath,
      agreementUploadedAt: serverTimestamp(),
      agreementStatus: 'pending_review',
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not attach that agreement.'
  }
}

/**
 * The tenant accepts the tenancy agreement, which FINALIZES it — there is no
 * separate landlord finalize step, deliberately, so a quiet landlord cannot
 * strand an accepted tenant. This is also what unlocks rent payment:
 * `recordRentPayment` rejects anything whose agreementStatus is not
 * 'finalized'.
 *
 * Only allowlisted fields may be written; an extra one rejects the whole write.
 */
export async function acceptAgreement(rentalId: string): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'active_rentals', rentalId), {
      agreementStatus: 'finalized',
      tenantAcceptedAt: serverTimestamp(),
      landlordFinalizedAt: serverTimestamp(),
      tenantDisputeReason: null,
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not accept the agreement.'
  }
}

/**
 * Records rent after Paystack. Server-side this flips the interest to
 * 'rent_paid' and stamps the active rental in one transaction, but only if the
 * caller is the tenant, the interest is 'accepted', and the agreement is
 * finalized.
 */
export async function recordRentPayment(
  rentalInterestId: string,
  paymentReference: string,
): Promise<string | null> {
  try {
    const fn = httpsCallable<{ rentalInterestId: string; paymentReference: string }, unknown>(
      callables(),
      'recordRentPayment',
    )
    await fn({ rentalInterestId, paymentReference })
    return null
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    const message = err instanceof Error ? err.message : ''
    if (code === 'functions/failed-precondition') {
      return message || 'This rental is not ready for payment yet.'
    }
    return message || 'Could not record the rent payment.'
  }
}

/**
 * The tenant gives notice. `status`, `moveOutRequestedAt` and
 * `moveOutIntendedDate` are all inside the active_rentals update allowlist.
 */
export async function requestMoveOut(
  rentalId: string,
  intendedDate: Date,
  reason: string,
): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'active_rentals', rentalId), {
      status: 'moveOutRequested',
      moveOutRequestedAt: serverTimestamp(),
      moveOutIntendedDate: Timestamp.fromDate(intendedDate),
      endReason: reason,
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not submit your move-out notice.'
  }
}
