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

/** One rent band of the landlord's and agent's service fee; upTo null = no ceiling. */
export type FeeBand = { upTo: number | null; landlord: number; agent: number }

export type Pricing = {
  listing: number
  inspectionTotal: number
  inspectionHandler: number
  /** Lowest rent a listing may have; firestore.rules enforces the same floor. */
  minRent: number
  /** Landlord and agent service fee by rent band, lowest first. */
  serviceFeeBands: FeeBand[]
}

const DEFAULTS: Pricing = {
  listing: 10000,
  inspectionTotal: 10000,
  inspectionHandler: 7000,
  minRent: 10000,
  serviceFeeBands: [
    { upTo: 300000, landlord: 7500, agent: 3750 },
    { upTo: 700000, landlord: 15000, agent: 7500 },
    { upTo: 1500000, landlord: 30000, agent: 15000 },
    { upTo: 3000000, landlord: 50000, agent: 25000 },
    { upTo: null, landlord: 75000, agent: 37500 },
  ],
}

/** The configured bands, or the defaults if any entry is malformed (as the server does). */
function toBands(raw: unknown): FeeBand[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULTS.serviceFeeBands
  const out: FeeBand[] = []
  for (const b of raw as Record<string, unknown>[]) {
    const upTo = b?.upTo
    if ((upTo !== null && typeof upTo !== 'number') || typeof b.landlord !== 'number' || typeof b.agent !== 'number') {
      return DEFAULTS.serviceFeeBands
    }
    out.push({ upTo: upTo as number | null, landlord: b.landlord, agent: b.agent })
  }
  out.sort((x, y) => (x.upTo ?? Infinity) - (y.upTo ?? Infinity))
  return out[out.length - 1].upTo === null ? out : DEFAULTS.serviceFeeBands
}

/** The landlord's service fee for a deal of this rent (a furnished stay's whole stay). */
export function landlordServiceFee(rent: number, bands: FeeBand[]): number {
  const band = bands.find((b) => b.upTo === null || rent <= b.upTo) ?? bands[bands.length - 1]
  return band?.landlord ?? 0
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
      serviceFeeBands: toBands(d.serviceFeeBands),
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
