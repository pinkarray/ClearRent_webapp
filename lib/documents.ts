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
  createdAt: Date | null
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
