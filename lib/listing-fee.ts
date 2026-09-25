import { collection, doc, getDoc, getDocs, query, where, type Timestamp } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { clientApp, clientDb, initAppCheck } from './firebase-client'
import { startPayment } from './payments'

/*
  The listing fee and the viewing fee, as config/pricing sets them.

  The first listing is free; every later one costs `listing`. The server is
  the judge: confirmListingFee is the only thing that can mark a listing paid,
  and an admin cannot publish one that still owes. What is here decides what
  to SHOW, with the same defaults as functions/src/pricing.ts.
*/

export type Pricing = {
  listing: number
  inspectionTotal: number
  inspectionHandler: number
  /** Lowest rent a listing may have; firestore.rules enforces the same floor. */
  minRent: number
}

const DEFAULTS: Pricing = {
  listing: 10000,
  inspectionTotal: 10000,
  inspectionHandler: 7000,
  minRent: 10000,
}

export async function getPricing(): Promise<Pricing> {
  try {
    const d = (await getDoc(doc(clientDb(), 'config', 'pricing'))).data() ?? {}
    const insp = (d.inspection ?? {}) as Record<string, unknown>
    return {
      listing: typeof d.listing === 'number' ? d.listing : DEFAULTS.listing,
      inspectionTotal: typeof insp.total === 'number' ? insp.total : DEFAULTS.inspectionTotal,
      inspectionHandler:
        typeof insp.handler === 'number' ? insp.handler : DEFAULTS.inspectionHandler,
      minRent: typeof d.minRent === 'number' ? d.minRent : DEFAULTS.minRent,
    }
  } catch {
    return DEFAULTS
  }
}

/**
 * Whether a listing owes the fee: unpaid, not yet live, and the landlord has
 * a listing created before it. With no [propertyId], asks about a listing not yet
 * created, which owes when the landlord has any listing at all.
 */
export async function listingFeeOwed(landlordId: string, propertyId?: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(clientDb(), 'properties'), where('landlordId', '==', landlordId)),
  )
  if (!propertyId) return !snap.empty

  const self = snap.docs.find((d) => d.id === propertyId)
  if (!self || self.data().listingFeeStatus === 'paid') return false
  // Already live: listed before the fee was enforced, not charged afterwards.
  if (self.data().isVerified === true) return false
  const createdAt = (self.data().createdAt as Timestamp | undefined)?.toMillis()
  if (createdAt === undefined) return false
  return snap.docs.some((d) => {
    if (d.id === propertyId) return false
    const other = (d.data().createdAt as Timestamp | undefined)?.toMillis()
    return other !== undefined && other < createdAt
  })
}

/** Sends the landlord to Paystack for this listing's fee. */
export async function payListingFee(propertyId: string, amount: number): Promise<void> {
  await startPayment('listing', amount, `/dashboard/listings/${propertyId}`, { propertyId })
}

/** Called from the payment callback once Paystack has redirected back. */
export async function confirmListingFee(
  propertyId: string,
  paymentReference: string,
): Promise<string | null> {
  initAppCheck()
  try {
    const fn = httpsCallable<
      { propertyId: string; paymentReference: string },
      { success?: boolean; alreadyPaid?: boolean }
    >(getFunctions(clientApp(), 'us-central1'), 'confirmListingFee')
    await fn({ propertyId, paymentReference })
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not confirm the listing fee.'
  }
}
