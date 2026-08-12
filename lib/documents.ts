import { collection, getDocs, query, where } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { clientApp, clientDb, initAppCheck } from './firebase-client'

export type PaymentRecord = {
  id: string
  type: string
  amount: number
  status: string
  reference: string
  propertyTitle: string
  userEmail: string
  createdAt: Date | null
}

/**
 * A settled payment.
 *
 * The stored value is `completed` — written by `paystack_service.dart:306` and
 * by every server-side path in `admin_money_ops` / `index.ts`. This page used
 * to test for `success`, which nothing writes, so every payment rendered as
 * pending no matter how long ago it cleared.
 */
export function isPaid(status: string): boolean {
  return status === 'completed'
}

/** Display label for a payment `type`, matching `documents_screen.dart`. */
export function paymentTypeLabel(type: string): string {
  switch (type) {
    case 'verification':
      return 'Verification fee'
    case 'inspection':
      return 'Inspection fee'
    case 'listing':
      return 'Listing fee'
    case 'rent':
      return 'Rent payment'
    case 'rent_payout':
      return 'Rent payout'
    default:
      return 'Payment'
  }
}

/**
 * What an `agreementStatus` means to the tenant. Same wording as the app's
 * `_agreementStatusLabel`, so the two surfaces describe one state identically.
 */
export function agreementStatusLabel(status: string): string {
  switch (status) {
    case 'accepted':
      return 'You accepted - awaiting landlord finalization'
    case 'disputed':
      return 'You raised concerns - awaiting landlord response'
    case 'finalized':
      return 'Finalized - agreement is in effect'
    default:
      return 'Uploaded - awaiting your review'
  }
}

/**
 * The tenant's payment history.
 *
 * Filters by userId and sorts in memory rather than adding `orderBy('createdAt')`
 * — the composite index that would need is not provisioned, and when it is
 * missing Firestore throws rather than degrading. In the app that surfaced as a
 * permanently empty Payments tab (`documents_screen.dart:85`). Same shape here
 * so web does not reintroduce the bug.
 */
export async function tenantPayments(uid: string): Promise<PaymentRecord[]> {
  const snap = await getDocs(
    query(collection(clientDb(), 'payments'), where('userId', '==', uid)),
  )
  const rows = snap.docs.map((d) => {
    const x = d.data()
    return {
      id: d.id,
      type: (x.type as string) ?? 'payment',
      amount: (x.amount as number) ?? 0,
      status: (x.status as string) ?? 'unknown',
      reference: (x.reference as string) ?? '',
      propertyTitle: (x.propertyTitle as string) ?? '',
      userEmail: (x.userEmail as string) ?? '',
      createdAt: x.createdAt?.toDate?.() ?? null,
    }
  })
  return rows.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

/**
 * A short-lived signed URL for a tenancy agreement. The document lives in
 * private storage, so it is never linked directly — the callable checks the
 * caller is a party on the rental before signing.
 *
 * `getSignedAgreementUrl` is one of the App-Check-enforced callables, so it
 * fails as `unauthenticated` until the web reCAPTCHA provider is registered.
 * That is reported plainly rather than as "session expired", which is how the
 * same failure was misdiagnosed on Android.
 */
export async function agreementUrl(
  collectionName: 'active_rentals' | 'tenancy_links',
  docId: string,
): Promise<{ url: string } | { error: string }> {
  try {
    initAppCheck()
    const fn = httpsCallable<
      { collection: string; docId: string },
      { url: string }
    >(getFunctions(clientApp(), 'us-central1'), 'getSignedAgreementUrl')
    const res = await fn({ collection: collectionName, docId })
    return { url: res.data.url }
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    if (code === 'functions/unauthenticated') {
      return {
        error:
          'The server rejected this request (App Check is not yet registered for web). Open the agreement in the ClearRent app for now.',
      }
    }
    return {
      error: err instanceof Error ? err.message : 'Could not open that document.',
    }
  }
}
