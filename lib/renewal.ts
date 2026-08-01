import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { clientApp, clientDb, initAppCheck } from './firebase-client'

/*
  Renewal (System D). A tenancy reaches its term and the tenant pays again.

  Two shapes, two callables, dispatched exactly as
  `active_rental_service.dart:28` does:
  - an `active_rentals` doc  → `completeActiveRenewal` (extends the lease)
  - a `tenancy_links` doc    → `completeLinkedPromotion` (creates a real rental
                               from a landlord-added, off-platform tenant)

  Both re-verify the Paystack reference server-side before touching anything, so
  a client that skips the payment and calls this directly gets
  `failed-precondition`.
*/

export const DEFAULT_DEAL_FEE = 5000

/**
 * The tenant's ₦5,000 deal-completion fee, read from `config/pricing` so a
 * change does not need a deploy (`functions/src/pricing.ts:38` holds the same
 * default). `config/*` is readable by any signed-in user.
 *
 * This is for display only — `resolveServerAmount` recomputes
 * `rentAmount + dealFee` from the source document, so a tampered client total
 * cannot change what is charged.
 */
export async function dealFee(): Promise<number> {
  try {
    const snap = await getDoc(doc(clientDb(), 'config', 'pricing'))
    const v = snap.data()?.dealFee
    return typeof v === 'number' ? v : DEFAULT_DEAL_FEE
  } catch {
    return DEFAULT_DEAL_FEE
  }
}

/** A landlord-added tenancy whose rent is collected off-platform, until renewal. */
export type TenancyLink = {
  id: string
  propertyId: string
  propertyTitle: string
  propertyAddress: string
  landlordId: string
  landlordName: string
  rentAmount: number
  rentFrequency: string
  status: string
  leaseStartDate: Date | null
  leaseEndDate: Date | null
  agreementUrl: string
}

export async function tenantLinks(uid: string): Promise<TenancyLink[]> {
  const snap = await getDocs(
    query(
      collection(clientDb(), 'tenancy_links'),
      where('tenantId', '==', uid),
      where('status', '==', 'confirmed'),
    ),
  )
  return snap.docs.map((d) => {
    const x = d.data()
    return {
      id: d.id,
      propertyId: (x.propertyId as string) ?? '',
      propertyTitle: (x.propertyTitle as string) ?? '(property)',
      propertyAddress: (x.propertyAddress as string) ?? '',
      landlordId: (x.landlordId as string) ?? '',
      landlordName: (x.landlordName as string) ?? '',
      rentAmount: (x.rentAmount as number) ?? 0,
      rentFrequency: (x.rentFrequency as string) ?? 'yearly',
      status: (x.status as string) ?? 'confirmed',
      leaseStartDate: x.leaseStartDate?.toDate?.() ?? null,
      leaseEndDate: x.leaseEndDate?.toDate?.() ?? null,
      agreementUrl: (x.agreementUrl as string) ?? '',
    }
  })
}

/**
 * The server sets these on the rental when the term is near or past. Renewal is
 * offered on exactly these two, matching `TenantRental.lifecycle`.
 */
export function isRenewable(status: string): boolean {
  return status === 'expiring_soon' || status === 'grace_locked'
}

/** Returns null on success, or a message to show the tenant. */
export async function completeRenewal(
  sourceId: string,
  isLinked: boolean,
  paymentReference: string,
): Promise<string | null> {
  try {
    initAppCheck()
    const name = isLinked ? 'completeLinkedPromotion' : 'completeActiveRenewal'
    const fn = httpsCallable<
      { sourceId: string; paymentReference: string },
      { success?: boolean }
    >(getFunctions(clientApp(), 'us-central1'), name)
    const res = await fn({ sourceId, paymentReference })
    if (res.data?.success !== true) {
      return 'The renewal did not complete. Your payment is recorded — contact support with the reference.'
    }
    return null
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    const message = err instanceof Error ? err.message : ''
    if (code === 'functions/failed-precondition') {
      return message || 'The payment could not be verified.'
    }
    if (code === 'functions/unauthenticated') {
      return 'The request was rejected (App Check or sign-in). Reload and try again.'
    }
    return message || 'Could not complete the renewal.'
  }
}
