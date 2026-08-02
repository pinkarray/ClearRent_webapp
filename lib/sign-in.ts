import { signInWithEmailAndPassword } from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { clientApp, clientAuth } from './firebase-client'

/*
  Password sign-in by phone number OR email.

  WHY THIS EXISTS. Web previously defaulted to phone OTP for every sign-in,
  which costs an SMS per login — a per-login cost that grows with success, and
  the one part of auth that gets more expensive the better the product does.
  The Flutter app already solved this (`auth_service.dart:888` signInWithPhone):
  OTP is spent ONCE at signup to prove the number is really theirs, and every
  sign-in after that is a password. Web is simply catching up to the app.

  HOW PHONE+PASSWORD WORKS. Firebase has no "sign in with phone and password"
  primitive. Every ClearRent account already carries a linked email/password
  credential — not for convenience, but because `initializePayment` reads
  `request.auth.token.email` and rejects with `failed-precondition` when it is
  absent (see linkEmailPassword in user-profile.ts). So the number is resolved
  to that email server-side by `lookupEmailByPhone`, and the real sign-in is
  email+password.

  That callable is deliberately unauthenticated (it runs before sign-in) and is
  IP + phone rate-limited server-side, which is what stops it being used to
  enumerate which numbers hold accounts.
*/

/** Anything starting with + or a digit is treated as a phone number. */
export function looksLikePhone(identifier: string): boolean {
  return /^[+\d]/.test(identifier.trim())
}

/**
 * Resolves a Nigerian phone number to the account's email.
 *
 * The server normalises the number itself (`normalizeNigerianPhone`), so
 * 0906…, 234906… and +234906… all resolve to the same account — which matters,
 * because a user does not remember which form they signed up with.
 */
async function emailForPhone(phone: string): Promise<string> {
  const fn = httpsCallable<{ phone: string }, { email?: string }>(
    // No initAppCheck() here: the callable sets enforceAppCheck:false because
    // it must work before a session exists.
    getFunctions(clientApp(), 'us-central1'),
    'lookupEmailByPhone',
  )
  const res = await fn({ phone: phone.trim() })
  const email = res.data?.email
  if (!email) {
    throw new Error('No account found for that phone number.')
  }
  return email
}

/**
 * Signs in with an identifier (phone or email) plus a password.
 * Returns null on success, or a message to show.
 */
export async function signInWithPassword(
  identifier: string,
  password: string,
): Promise<string | null> {
  try {
    const email = looksLikePhone(identifier) ?
      await emailForPhone(identifier) :
      identifier.trim()

    await signInWithEmailAndPassword(clientAuth(), email, password)
    return null
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''

    // Firebase returns invalid-credential for both a wrong password and an
    // unknown account, deliberately, so the message must not distinguish them
    // either — saying "no such account" would confirm which numbers are
    // registered.
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      return 'That phone number or email and password do not match.'
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many attempts. Wait a few minutes, or sign in with a code instead.'
    }
    if (code === 'auth/invalid-email') {
      return 'Enter your phone number or the email on your account.'
    }
    if (code === 'functions/resource-exhausted') {
      return 'Too many attempts from this network. Try again shortly.'
    }
    return err instanceof Error ? err.message : 'Sign-in failed.'
  }
}
