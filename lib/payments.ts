import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { clientAuth, clientDb, initAppCheck } from './firebase-client'

/**
 * Paystack on web, via the same Cloud Functions the app uses.
 *
 * The server calls `transaction/initialize` and hands back an
 * `authorizationUrl`, so the browser just navigates there. That means no
 * Paystack public key and no inline JS on the client — a smaller surface than
 * the app's mobile SDK integration.
 *
 * Pricing is server-authoritative: `resolveServerAmount` recomputes the charge
 * from the payment type and metadata, and the client's `amount` is display-only
 * for everything except renewals. Do not "fix" a wrong total here — fix it in
 * the pricing resolver.
 *
 * Both callables enforce App Check, so `initAppCheck()` must have run. When it
 * has not, these fail with `unauthenticated` — which reads like an expired
 * session and is not one.
 */

const REGION = 'us-central1'

export type PaymentType = 'verification' | 'inspection' | 'listing' | 'rent' | 'renewal'

export type InitializedPayment = {
  authorizationUrl: string
  accessCode: string
  reference: string
}

function callables() {
  initAppCheck()
  return getFunctions(undefined, REGION)
}

/**
 * Starts a payment and returns Paystack's hosted checkout URL.
 * [amount] is in Naira and display-only for every type but 'renewal'.
 */
export async function initializePayment(
  type: PaymentType,
  amount: number,
  metadata: Record<string, unknown> = {},
): Promise<InitializedPayment> {
  const fn = httpsCallable<
    { type: PaymentType; amount: number; metadata: Record<string, unknown> },
    InitializedPayment
  >(callables(), 'initializePayment')

  const res = await fn({ type, amount, metadata })
  return res.data
}

/** Confirms a payment after Paystack redirects back. */
export async function verifyPayment(reference: string): Promise<Record<string, unknown>> {
  const fn = httpsCallable<{ reference: string }, Record<string, unknown>>(
    callables(),
    'verifyPayment',
  )
  const res = await fn({ reference })
  return res.data as Record<string, unknown>
}

/**
 * Asks the server to start a payment, then hands the browser to Paystack.
 * [returnPath] is where Paystack should send the user back to; the reference is
 * appended so the return page can verify it.
 */
export async function startPayment(
  type: PaymentType,
  amount: number,
  returnPath: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const init = await initializePayment(type, amount, {
    ...metadata,
    // Read back on return so we know which payment to verify.
    webReturnPath: returnPath,
  })

  // What the callback page needs must survive the round trip — and the round
  // trip crosses ORIGINS: `initializePayment` hardcodes
  // callback_url = https://verealtytech.com/payment/callback, so a payment
  // started on localhost comes back on the production domain. sessionStorage
  // is per-origin and would be gone. Firestore is not, and this subdoc is
  // owner-read/write.
  const uid = clientAuth().currentUser?.uid
  if (uid) {
    await setDoc(doc(clientDb(), 'users', uid, 'private', 'pendingPayment'), {
      reference: init.reference,
      type,
      returnPath,
      // e.g. { requestId } for an inspection — the callback needs it to call
      // confirmInspectionPayment, and verifyPayment does not echo metadata back.
      context: metadata,
      startedAt: serverTimestamp(),
    })
  }

  window.location.href = init.authorizationUrl
}

export type PendingPayment = {
  reference: string
  type: PaymentType
  returnPath: string
  context: Record<string, unknown>
}

/** The payment awaiting confirmation after a Paystack redirect, if any. */
export async function pendingPayment(): Promise<PendingPayment | null> {
  const uid = clientAuth().currentUser?.uid
  if (!uid) return null
  const snap = await getDoc(doc(clientDb(), 'users', uid, 'private', 'pendingPayment'))
  if (!snap.exists()) return null
  return snap.data() as PendingPayment
}

export async function clearPendingPayment(): Promise<void> {
  const uid = clientAuth().currentUser?.uid
  if (!uid) return
  await deleteDoc(doc(clientDb(), 'users', uid, 'private', 'pendingPayment'))
}

/** True when the signed-in user can pay — the auth token must carry an email. */
export function canPay(): boolean {
  return Boolean(clientAuth().currentUser?.email)
}
