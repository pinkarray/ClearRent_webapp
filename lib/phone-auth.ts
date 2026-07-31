import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth'
import { clientAuth } from './firebase-client'

/**
 * Firebase phone auth on web.
 *
 * Unlike App Check — which I measured as UNENFORCED for Firestore, Storage and
 * Identity Toolkit on this project — reCAPTCHA here is NOT optional. Firebase
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
 * Reused across resends — Firebase throws if two verifiers share a container.
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
): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(clientAuth(), e164Phone, getVerifier(containerId))
}
