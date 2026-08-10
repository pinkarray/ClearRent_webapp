import { getFunctions, httpsCallable } from 'firebase/functions'
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { getStorage, ref, uploadBytes } from 'firebase/storage'
import { clientApp, clientDb, initAppCheck } from './firebase-client'
import { phoneToE164 } from './phone'
import type { AccountType } from './user-profile'

/**
 * Identity verification. Two separate things happen, and they are not
 * interchangeable:
 *
 *  1. `submitNin` — a callable that AES-256-GCM encrypts the NIN server-side
 *     into `users/{uid}.nin`. The raw NIN must never be written from the
 *     client; the old client-side `updateUserProfile({'nin': …})` path was
 *     replaced precisely because it stored it in the clear.
 *  2. Document upload + a `verification_requests` doc for ADMIN review.
 *
 * Nobody self-verifies. `verificationStatus` goes to 'pending' here and only an
 * admin moves it to 'verified'. Every downstream gate — listing a property,
 * booking an inspection — reads that field as the source of truth.
 *
 * EACH ROLE SUBMITS DIFFERENT DOCUMENTS. The storage folder, the
 * `verificationDocs` key and the `verification_requests` key all differ per
 * role, and the admin review UI reads those exact names — a tenant filed under
 * `utilityBillUrl` is a record the reviewer cannot interpret.
 */

const NIN_PATTERN = /^\d{11}$/

/** Encrypts and stores the NIN. Returns null on success, or a message. */
export async function submitNin(nin: string): Promise<string | null> {
  const trimmed = nin.trim()
  if (!NIN_PATTERN.test(trimmed)) return 'A NIN is exactly 11 digits.'

  initAppCheck()
  try {
    const fn = httpsCallable<{ nin: string }, { success?: boolean }>(
      getFunctions(clientApp(), 'us-central1'),
      'submitNin',
    )
    const res = await fn({ nin: trimmed })
    return res.data?.success === false ? 'Could not store your NIN.' : null
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    // enforceAppCheck rejections arrive as `unauthenticated`, which reads like
    // an expired session and is not one. Say what it actually is.
    if (code === 'functions/unauthenticated') {
      return 'Verification rejected the request (App Check or sign-in). Reload and try again.'
    }
    return err instanceof Error ? err.message : 'Could not submit your NIN.'
  }
}

/**
 * Uploads one document to the private, versioned verification path.
 * Storage rules allow create-only (`resource == null`) — an approved document
 * can never be replaced, so each submission gets its own timestamped path.
 * Returns the storage PATH, not a URL: these are identity documents and must
 * never sit behind a public link.
 */
async function uploadDocument(uid: string, folder: string, file: File): Promise<string> {
  const path = `verification/${uid}/${folder}/${Date.now()}`
  await uploadBytes(ref(getStorage(clientApp()), path), file)
  return path
}

/**
 * The second document each role must provide, alongside the NIN slip.
 * `folder` is the storage folder, `docKey` the `verificationDocs` field, and
 * `requestKey` the `verification_requests` field — all three are role-specific
 * and must match what the app writes.
 */
export const SECOND_DOCUMENT: Record<
  AccountType,
  { folder: string; docKey: string; requestKey: string; label: string; hint: string }
> = {
  tenant: {
    folder: 'proof_of_income',
    docKey: 'proofOfIncome',
    requestKey: 'proofOfIncomeUrl',
    label: 'Proof of income',
    hint: 'A payslip, bank statement or employment letter.',
  },
  landlord: {
    folder: 'utility_bill',
    docKey: 'utilityBill',
    requestKey: 'utilityBillUrl',
    label: 'Proof of address',
    hint: 'A recent utility bill.',
  },
  agent: {
    folder: 'proof_of_address',
    docKey: 'proofOfAddress',
    requestKey: 'proofOfAddressUrl',
    label: 'Proof of address',
    hint: 'A recent utility bill.',
  },
}

export type GuarantorInput = {
  name: string
  phone: string
  address: string
  /** Agents may attach evidence of prior experience. Optional. */
  experienceProof?: File | null
}

export type VerificationInput = {
  accountType: AccountType
  nin: string
  ninSlip: File
  secondDocument: File
  /** Required for agents only. */
  guarantor?: GuarantorInput
  /** Agents only: a photo/scan of the guarantor's ID. */
  guarantorId?: File | null
}

/**
 * Verification fees, for DISPLAY only.
 *
 * `resolveServerAmount` in the backend prices verification from the user's
 * accountType and charges that regardless of what the client sends, so these
 * numbers can only ever be wrong on screen, never wrong on the invoice. Kept in
 * step with `DEFAULT_PRICING.verification` in `functions/src/pricing.ts`.
 */
export const VERIFICATION_FEES: Record<AccountType, number> = {
  tenant: 3000,
  agent: 7000,
  landlord: 12000,
}

/**
 * Uploads a first-time verification and queues it AWAITING PAYMENT.
 *
 * Web used to write `status: 'pending'` here and stop, on the belief — stated
 * in this function's own comment — that the verification fee had been removed.
 * It had not: the fee is still priced server-side per role, so every web
 * signup was verified for free while the app charged for the same thing.
 *
 * Payment cannot happen before this, because paying redirects to Paystack and
 * back through a different origin — the chosen `File` objects would not
 * survive the trip. So the documents are stored first and the request is
 * parked at `awaiting_payment`, which the admin queue (`status == 'pending'`)
 * deliberately does not show. `finalizeVerificationPayment` promotes it once
 * the money lands.
 *
 * Returns the new request id, or a message to show.
 */
export async function submitVerification(
  uid: string,
  input: VerificationInput,
): Promise<{ requestId: string } | { error: string }> {
  const spec = SECOND_DOCUMENT[input.accountType]

  if (input.accountType === 'agent') {
    if (!input.guarantorId) return { error: 'Agents must upload a guarantor ID.' }
    if (!input.guarantor) return { error: 'Agents must provide guarantor details.' }
    if (!phoneToE164(input.guarantor.phone)) {
      return { error: 'Enter a valid Nigerian phone number for your guarantor.' }
    }
  }

  const ninError = await submitNin(input.nin)
  if (ninError) return { error: ninError }

  try {
    const ninUrl = await uploadDocument(uid, 'nin', input.ninSlip)
    const secondUrl = await uploadDocument(uid, spec.folder, input.secondDocument)

    const verificationDocs: Record<string, string> = {
      nin: ninUrl,
      [spec.docKey]: secondUrl,
    }

    const request: Record<string, unknown> = {
      userId: uid,
      userType: input.accountType,
      // NOT 'pending': the admin queue reads that, and an unpaid application
      // must not reach a reviewer. Promoted on the payment callback.
      status: 'awaiting_payment',
      ninUrl,
      [spec.requestKey]: secondUrl,
      submittedAt: serverTimestamp(),
    }

    if (input.accountType === 'agent' && input.guarantorId && input.guarantor) {
      const guarantorIdUrl = await uploadDocument(uid, 'guarantor_id', input.guarantorId)
      verificationDocs.guarantorId = guarantorIdUrl
      request.guarantorIdUrl = guarantorIdUrl

      const normalizedPhone = phoneToE164(input.guarantor.phone)
      request.guarantorName = input.guarantor.name
      request.guarantorPhone = normalizedPhone
      request.guarantorAddress = input.guarantor.address

      if (input.guarantor.experienceProof) {
        const experienceProofUrl = await uploadDocument(
          uid,
          'experience_proof',
          input.guarantor.experienceProof,
        )
        verificationDocs.experienceProof = experienceProofUrl
        request.experienceProofUrl = experienceProofUrl
      }

      await updateDoc(doc(clientDb(), 'users', uid), {
        guarantorName: input.guarantor.name,
        guarantorPhone: normalizedPhone,
        guarantorAddress: input.guarantor.address,
      })
    }

    // Documents are stored now so they survive the redirect to Paystack, but
    // verificationStatus stays untouched: nothing about this application is
    // real until it is paid for, and flipping the user to 'pending' here is
    // what let a web signup look verified-in-progress without paying.
    await updateDoc(doc(clientDb(), 'users', uid), {
      verificationDocs,
      updatedAt: serverTimestamp(),
    })

    const ref = await addDoc(collection(clientDb(), 'verification_requests'), request)
    return { requestId: ref.id }
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : 'Could not submit your verification.',
    }
  }
}

/**
 * Promotes a paid verification into the admin review queue.
 *
 * Called from the payment callback once Paystack confirms. Splitting it from
 * the upload is what makes the fee unavoidable: the documents exist, but no
 * reviewer sees them and `verificationStatus` never moves until the charge
 * clears.
 */
export async function finalizeVerificationPayment(
  uid: string,
  requestId: string,
  reference: string,
): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'verification_requests', requestId), {
      status: 'pending',
      paymentReference: reference,
      paymentStatus: 'paid',
      paidAt: serverTimestamp(),
    })
    await updateDoc(doc(clientDb(), 'users', uid), {
      verificationStatus: 'pending',
      // Renewals carry no new NIN — lets admin tell an annual renewal from a
      // first-time application in the review queue.
      isRenewal: false,
      verificationSubmittedAt: serverTimestamp(),
      verificationPaymentReference: reference,
      verificationPaymentStatus: 'paid',
      updatedAt: serverTimestamp(),
    })
    return null
  } catch (err) {
    return err instanceof Error
      ? err.message
      : 'Payment went through but we could not queue your review. Contact support.'
  }
}
