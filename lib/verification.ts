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
 * Submits a first-time verification for any role: encrypts the NIN, uploads the
 * role's documents, flips `verificationStatus` to 'pending' and queues an admin
 * review.
 *
 * The verification fee was removed from pricing, so unlike the app's older flow
 * this carries no payment reference.
 */
export async function submitVerification(
  uid: string,
  input: VerificationInput,
): Promise<string | null> {
  const spec = SECOND_DOCUMENT[input.accountType]

  if (input.accountType === 'agent') {
    if (!input.guarantorId) return 'Agents must upload a guarantor ID.'
    if (!input.guarantor) return 'Agents must provide guarantor details.'
    if (!phoneToE164(input.guarantor.phone)) {
      return 'Enter a valid Nigerian phone number for your guarantor.'
    }
  }

  const ninError = await submitNin(input.nin)
  if (ninError) return ninError

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
      status: 'pending',
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

    await updateDoc(doc(clientDb(), 'users', uid), {
      verificationStatus: 'pending',
      // Renewals carry no new NIN — lets admin tell an annual renewal from a
      // first-time application in the review queue.
      isRenewal: false,
      verificationSubmittedAt: serverTimestamp(),
      verificationDocs,
      updatedAt: serverTimestamp(),
    })

    await addDoc(collection(clientDb(), 'verification_requests'), request)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not submit your verification.'
  }
}
