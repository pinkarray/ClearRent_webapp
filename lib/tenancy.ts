import {
  Timestamp,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
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

async function loadInterests(field: 'tenantId' | 'landlordId', uid: string) {
  const snap = await getDocs(
    query(collection(clientDb(), 'rental_interests'), where(field, '==', uid)),
  )
  return snap.docs.map((d) => {
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
  })
}

export const tenantInterests = (uid: string) => loadInterests('tenantId', uid)
export const landlordInterests = (uid: string) => loadInterests('landlordId', uid)

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
}

export async function activeRentals(
  field: 'tenantId' | 'landlordId',
  uid: string,
): Promise<ActiveRental[]> {
  const snap = await getDocs(
    query(collection(clientDb(), 'active_rentals'), where(field, '==', uid)),
  )
  return snap.docs.map((d) => {
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
    } satisfies ActiveRental
  })
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
