import {
  RecaptchaVerifier,
  signInWithCustomToken,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { clientApp, clientAuth, initAppCheck } from './firebase-client'

/**
 * Firebase phone auth on web.
 *
 * Unlike App Check - which I measured as UNENFORCED for Firestore, Storage and
 * Identity Toolkit on this project - reCAPTCHA here is NOT optional. Firebase
 * requires a RecaptchaVerifier for every `signInWithPhoneNumber` call on web;
 * without it sign-in fails. This is separate from, and additional to, the
 * App Check reCAPTCHA provider the gated callables need.
 *
 * Authorized domains are already configured on this project: localhost,
 * clearrent-app.firebaseapp.com, clearrent-app.web.app, verealtytech.com.
 */

let verifier: RecaptchaVerifier | null = null

/**
 * Creates (once) the invisible reCAPTCHA bound to [containerId].
 * Reused across resends - Firebase throws if two verifiers share a container.
 */
function getVerifier(containerId: string): RecaptchaVerifier {
  if (verifier) return verifier
  verifier = new RecaptchaVerifier(clientAuth(), containerId, { size: 'invisible' })
  return verifier
}

/** Discards the verifier so the next attempt starts from a clean widget. */
export function resetVerifier(): void {
  try {
    verifier?.clear()
  } catch {
    // Already torn down with the DOM node; nothing to clean up.
  }
  verifier = null
}

/**
 * Sends an OTP. [e164Phone] must already be normalised by `phoneToE164`.
 *
 * Test numbers configured on this project (e.g. +2349060883232 with code
 * 123456) short-circuit real SMS, which is what makes onboarding testable
 * without burning message quota.
 */
export async function sendOtp(
  e164Phone: string,
  containerId: string,
): Promise<SentCode> {
  const viaServer = await requestServerOtp(e164Phone)
  if (viaServer) return viaServer
  return {
    kind: 'firebase',
    confirmation: await signInWithPhoneNumber(clientAuth(), e164Phone, getVerifier(containerId)),
  }
}

/**
 * Who sent the code. Firebase Phone Auth fails for Glo and Airtel numbers
 * (17499 / Error 39), so config/otp can route codes through our own
 * requestPhoneOtp CF (Termii); those are checked by verifyPhoneOtp instead of
 * a ConfirmationResult.
 */
export type SentCode =
  | { kind: 'firebase'; confirmation: ConfirmationResult }
  | { kind: 'clearrent'; phone: string }

function callables() {
  initAppCheck()
  return getFunctions(clientApp(), 'us-central1')
}

/**
 * Null means "use Firebase": config/otp says so, or the CF is unreachable or
 * not deployed, in which case Firebase still serves MTN and 9mobile. A bad
 * number or too many requests is thrown, since Firebase would not do better.
 */
async function requestServerOtp(e164Phone: string): Promise<SentCode | null> {
  try {
    const res = await httpsCallable<{ phone: string }, { provider?: string }>(
      callables(),
      'requestPhoneOtp',
    )({ phone: e164Phone })
    return res.data.provider === 'termii' ? { kind: 'clearrent', phone: e164Phone } : null
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'functions/invalid-argument' || code === 'functions/resource-exhausted') {
      throw err
    }
    console.warn('requestPhoneOtp failed; using Firebase', code)
    return null
  }
}

/** Checks the code and signs in. Throws with a user-facing message. */
export async function confirmCode(
  sent: SentCode,
  code: string,
): Promise<{ uid: string; isNewUser: boolean }> {
  if (sent.kind === 'firebase') {
    const cred = await sent.confirmation.confirm(code)
    return {
      uid: cred.user.uid,
      isNewUser: cred.user.metadata.creationTime === cred.user.metadata.lastSignInTime,
    }
  }
  const res = await httpsCallable<
    { phone: string; code: string },
    { token: string; isNewUser: boolean }
  >(callables(), 'verifyPhoneOtp')({ phone: sent.phone, code })
  const cred = await signInWithCustomToken(clientAuth(), res.data.token)
  return { uid: cred.user.uid, isNewUser: res.data.isNewUser === true }
}
