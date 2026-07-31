import { EmailAuthProvider, linkWithCredential, sendEmailVerification } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { clientAuth, clientDb } from './firebase-client'
import { phoneToE164 } from './phone'

/**
 * Links an email/password credential to a phone-signed-in account, mirroring
 * `AuthService.linkEmailToPhoneAccount`.
 *
 * This is NOT cosmetic. `initializePayment` reads `request.auth.token.email`
 * and rejects with `failed-precondition` ("No email on your account") when it
 * is absent. A phone-only Firebase user has no email on their token no matter
 * what the Firestore user doc says, so without this link every payment — the
 * inspection fee, rent, renewals — fails at the first step.
 *
 * Returns null on success, or a message to show the user.
 */
export async function linkEmailPassword(
  email: string,
  password: string,
): Promise<string | null> {
  const user = clientAuth().currentUser
  if (!user) return 'No signed-in user.'

  // Already linked (e.g. resuming a half-finished signup).
  if (user.email) return null

  try {
    await linkWithCredential(user, EmailAuthProvider.credential(email, password))
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use') {
      return 'That email is already used by another account. Try a different one.'
    }
    if (code === 'auth/weak-password') return 'Password must be at least 6 characters.'
    return err instanceof Error ? err.message : 'Could not link that email.'
  }

  // Best-effort, same as the app — never fail signup because the mail bounced.
  try {
    await sendEmailVerification(user)
  } catch {
    // Ignore.
  }
  return null
}

export type AccountType = 'tenant' | 'landlord' | 'agent'

/**
 * The subset of the user doc the web reads. The app writes more (tenant budget
 * preferences, agent service areas); those are preserved on merge writes.
 */
export type UserProfile = {
  uid: string
  fullName?: string
  email?: string
  accountType?: AccountType
  phone?: string
  phoneVerified?: boolean
  profileCompleted?: boolean
  /**
   * Set by NIN verification, NOT by onboarding. `firestore.rules` requires
   * 'verified' before a landlord may create a property, so a freshly
   * onboarded landlord cannot list yet — by design, on both surfaces.
   */
  verificationStatus?: string
  totalListingsCreated?: number
  /** Rules require this before a tenant may request an inspection. */
  hasBankDetails?: boolean
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(clientDb(), 'users', uid))
  if (!snap.exists()) return null
  return { uid, ...(snap.data() as Omit<UserProfile, 'uid'>) }
}

export type ProfileInput = {
  fullName: string
  email: string
  accountType: AccountType
  /** The signed-in phone number, already E.164 from Firebase Auth. */
  authPhone: string | null
  // Agent-only
  baseLocation?: string
  serviceAreas?: string[]
  // Tenant-only
  occupation?: string
  employer?: string
  incomeRange?: string
  maritalStatus?: string
  budgetMin?: number
  budgetMax?: number
  preferredAreas?: string[]
}

/**
 * Writes the user doc exactly as `AuthService.saveUserProfile` does, so a
 * person onboarding on web is indistinguishable from one onboarding in the app.
 *
 * Note what is deliberately NOT written: `verificationStatus`. That is set by
 * NIN verification (`submitNin`), and the properties create rule reads it as
 * the source of truth precisely because a client must not be able to fake it.
 */
export async function saveUserProfile(uid: string, input: ProfileInput): Promise<void> {
  const data: Record<string, unknown> = {
    uid,
    fullName: input.fullName,
    // Denormalised for the app's tenant name search.
    fullNameLower: input.fullName.toLowerCase(),
    email: input.email,
    accountType: input.accountType,
    profileCompleted: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  if (input.authPhone) {
    data.phone = input.authPhone
    data.phoneVerified = true
  }

  if (input.accountType === 'agent') {
    if (input.baseLocation) data.baseLocation = input.baseLocation
    if (input.serviceAreas?.length) data.serviceAreas = input.serviceAreas
    // Agents start unverified — an admin verifies them later.
    data.isVerified = false
    data.rating = 0.0
    data.totalInspections = 0
    data.totalRatings = 0
  }

  if (input.accountType === 'landlord') {
    data.rating = 0.0
    data.totalRatings = 0
  }

  if (input.accountType === 'tenant') {
    if (input.occupation) data.occupation = input.occupation
    if (input.employer) data.employer = input.employer
    if (input.incomeRange) data.incomeRange = input.incomeRange
    if (input.maritalStatus) data.maritalStatus = input.maritalStatus
    if (input.budgetMin && input.budgetMin > 0) data.budgetMin = input.budgetMin
    if (input.budgetMax && input.budgetMax > 0) data.budgetMax = input.budgetMax
    if (input.preferredAreas?.length) data.preferredAreas = input.preferredAreas
  }

  await setDoc(doc(clientDb(), 'users', uid), data, { merge: true })
}

/** Records the chosen account type before profile setup completes. */
export async function saveAccountType(uid: string, accountType: AccountType): Promise<void> {
  await setDoc(
    doc(clientDb(), 'users', uid),
    { accountType, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

export { phoneToE164 }
