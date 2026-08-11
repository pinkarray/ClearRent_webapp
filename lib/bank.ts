import { getFunctions, httpsCallable } from 'firebase/functions'
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { clientApp, clientDb, initAppCheck } from './firebase-client'

/**
 * Payout account on file.
 *
 * Rules require `hasBankDetails == true` before a tenant may request an
 * inspection or a handler may accept one (`actorHasBankDetails()`), so that any
 * dispute refund or payout has a destination an admin can settle to.
 *
 * The account details themselves live in the locked `users/{uid}/private/bank`
 * subdoc; only the non-sensitive boolean sits on the user doc, which is what
 * the rules read.
 */

export type ResolvedAccount = { accountName: string }

/**
 * Validates an account number against a bank via Paystack, server-side.
 * `resolveAccount` enforces App Check and holds the Paystack secret — the
 * browser never sees it.
 */
export async function resolveAccount(
  accountNumber: string,
  bankCode: string,
): Promise<{ accountName?: string; error?: string }> {
  if (!/^\d{10}$/.test(accountNumber.trim())) {
    return { error: 'Account number must be 10 digits.' }
  }

  initAppCheck()
  try {
    const fn = httpsCallable<{ accountNumber: string; bankCode: string }, ResolvedAccount>(
      getFunctions(clientApp(), 'us-central1'),
      'resolveAccount',
    )
    const res = await fn({ accountNumber: accountNumber.trim(), bankCode })
    return { accountName: res.data.accountName }
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    if (code === 'functions/not-found') {
      return { error: 'Account could not be resolved. Check the number and bank.' }
    }
    // Paystack rate-limits /bank/resolve per integration.
    if (code === 'functions/resource-exhausted') {
      return { error: 'Too many lookups just now. Wait a moment and try again.' }
    }
    if (code === 'functions/unauthenticated') {
      return { error: 'The request was rejected (App Check or sign-in). Reload and try again.' }
    }
    return { error: err instanceof Error ? err.message : 'Could not resolve that account.' }
  }
}

export type BankDetails = {
  accountNumber: string
  bankCode: string
  bankName: string
  accountName: string
}

/**
 * Writes the account to the private subdoc, then flips `hasBankDetails`.
 * Order matters: the flag is what rules trust, so it must not be set before the
 * details it claims exist are actually stored.
 */
export async function saveBankDetails(uid: string, bank: BankDetails): Promise<string | null> {
  try {
    await setDoc(
      doc(clientDb(), 'users', uid, 'private', 'bank'),
      { ...bank, updatedAt: serverTimestamp() },
      { merge: true },
    )
    await updateDoc(doc(clientDb(), 'users', uid), {
      hasBankDetails: true,
      updatedAt: serverTimestamp(),
    })
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not save your bank details.'
  }
}

/**
 * The common Nigerian banks with their Paystack codes. Kept short on purpose —
 * Paystack's /bank list is long and the resolve call is the real validation.
 */
export const BANKS: { code: string; name: string }[] = [
  { code: '044', name: 'Access Bank' },
  { code: '063', name: 'Access Bank (Diamond)' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '030', name: 'Heritage Bank' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '526', name: 'Parallex Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'Suntrust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank For Africa' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '999992', name: 'OPay' },
  { code: '999991', name: 'PalmPay' },
  { code: '50211', name: 'Kuda Bank' },
  // 50515, not 090267. Paystack keys fintechs/MFBs by its own 5-digit code;
  // 090267 is Kuda's CBN/NIP code, so /bank/resolve answered
  // "Unknown bank code: 090267" and the account could never be verified.
  { code: '50515', name: 'Moniepoint MFB' },
]
