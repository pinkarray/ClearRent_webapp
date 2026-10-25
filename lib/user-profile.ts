import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  sendEmailVerification,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { clientAuth, clientDb } from './firebase-client'
import { phoneToE164 } from './phone'

/**
 * Links an email/password credential to a phone-signed-in account, mirroring
 * `AuthService.linkEmailToPhoneAccount`.
 *
 * This is NOT cosmetic. `initializePayment` reads `request.auth.token.email`
 * and rejects with `failed-precondition` ("No email on your account") when it
 * is absent. A phone-only Firebase user has no email on their token no matter
 * what the Firestore user doc says, so without this link every payment - the
 * inspection fee, rent, renewals - fails at the first step.
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

  // Best-effort, same as the app - never fail signup because the mail bounced.
  try {
    await sendEmailVerification(user)
  } catch {
    // Ignore.
  }
  return null
}

/**
 * Creates an account from email and password, for people whose network never
 * delivers the SMS code (Airtel). Mirrors `AuthService.signUp` in the app.
 *
 * Returns null on success, or a message to show the user.
 */
export async function createEmailAccount(
  email: string,
  password: string,
): Promise<string | null> {
  try {
    const cred = await createUserWithEmailAndPassword(clientAuth(), email, password)
    try {
      await sendEmailVerification(cred.user)
    } catch {
      // Ignore, as in linkEmailPassword.
    }
    return null
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    if (code === 'auth/email-already-in-use') {
      return 'That email already has an account. Log in instead.'
    }
    if (code === 'auth/invalid-email') return 'That email address is not valid.'
    if (code === 'auth/weak-password') return 'Password must be at least 6 characters.'
    return err instanceof Error ? err.message : 'Could not create the account.'
  }
}

/**
 * Whether another account already holds this number. Only a courtesy for email
 * signups, whose number is typed and never confirmed, same as
 * `isPhoneTakenByAnotherAccount` in the app: a failed read answers false.
 */
export async function isPhoneTakenByAnotherAccount(
  e164: string,
  uid: string,
): Promise<boolean> {
  try {
    const snap = await getDocs(
      query(collection(clientDb(), 'users'), where('phone', '==', e164), limit(2)),
    )
    return snap.docs.some((d) => d.id !== uid)
  } catch {
    return false
  }
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
   * onboarded landlord cannot list yet - by design, on both surfaces.
   */
  verificationStatus?: string
  totalListingsCreated?: number
  /** Rules require this before a tenant may request an inspection. */
  hasBankDetails?: boolean
  /**
   * Urgent issues left unanswered past the admin rung (server-written by
   * issueResponseReminders). Rules refuse a new listing or a relist while any
   * remain; it empties the moment the landlord responds.
   */
  overdueUrgentIssues?: string[]
  /** Server-written by adminSetListingSuspension; rules enforce it. */
  listingSuspended?: boolean
  listingSuspendedUntil?: { toDate?: () => Date } | null
}

/**
 * Why this landlord may not publish or relist right now, or null when they
 * may. Mirrors the firestore.rules checks so the page can say why instead of
 * failing on a bare permissions error.
 */
export function publishBlockReason(p: UserProfile | null): string | null {
  if (!p) return null
  const until = p.listingSuspendedUntil?.toDate?.() ?? null
  if (p.listingSuspended === true && (!until || until > new Date())) {
    return until
      ? `Your listings are suspended until ${until.toLocaleDateString('en-NG')}, so you cannot publish or relist.`
      : 'Your listings are suspended, so you cannot publish or relist.'
  }
  if (p.overdueUrgentIssues?.length) {
    return 'An urgent issue a tenant reported has been waiting on you for over 3 days. ' +
      'Respond to it in Issues before you publish or relist a property.'
  }
  return null
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
  /** Typed by an email signup, E.164. Saved unverified; authPhone wins. */
  typedPhone?: string
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

  // Typed, not proven: written so the person can be found and called, and
  // flagged false so nothing treats it as ownership. authPhone overwrites it.
  if (input.typedPhone) {
    data.phone = input.typedPhone
    data.phoneVerified = false
  }

  if (input.authPhone) {
    data.phone = input.authPhone
    data.phoneVerified = true
  }

  if (input.accountType === 'agent') {
    if (input.baseLocation) data.baseLocation = input.baseLocation
    if (input.serviceAreas?.length) data.serviceAreas = input.serviceAreas
    // Agents start unverified - an admin verifies them later.
    data.isVerified = false
    data.totalInspections = 0
  }

  // NO rating / totalRatings seeded here, for agents or landlords.
  //
  // Rules reserve those fields to the rating Cloud Function, and the
  // owner-update clause refuses ANY write that touches them. `saveAccountType`
  // already created users/{uid} before this runs, so this merge is an UPDATE,
  // not a create - which made the whole profile save fail and left landlords
  // and agents unable to finish signing up at all. Tenants were unaffected
  // only because they seed neither field. Every reader defaults a missing
  // rating to 0. Same fix as auth_service.dart in the app.

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
