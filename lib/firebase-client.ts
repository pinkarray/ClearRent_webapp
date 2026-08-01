import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

/**
 * Firebase Web SDK, used ONLY for the authenticated landlord flow.
 *
 * Public browse does not touch this — it is server-rendered through
 * firebase-admin, because properties are not publicly readable.
 *
 * Why the landlord writes from the client rather than through a server route:
 * `firestore.rules` enforces the create guards (self-assigned landlordId, a
 * user doc with verificationStatus == 'verified', isVerified pinned false, the
 * ownershipDocStatus allowlist). The Admin SDK bypasses rules, so a server
 * write would mean re-implementing every one of those guards as a second
 * source of truth. Writing as the signed-in user means the web and the Flutter
 * app are enforced by the same rules file.
 *
 * App Check: service-level enforcement is UNENFORCED for Firestore, Storage and
 * Identity Toolkit, but `enforceAppCheck: true` on a callable is enforced
 * per-function regardless of that setting. `createRentalInterest`,
 * `confirmInspectionPayment`, `recordRentPayment`, `submitNin` and friends all
 * set it, so every transactional feature needs a valid App Check token.
 * `initAppCheck` below attaches one.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

/**
 * True when the NEXT_PUBLIC_FIREBASE_* values were present at build time.
 *
 * They are inlined into the bundle by Next, so if the deploy environment is
 * missing them every value here is undefined and `initializeApp` throws. That
 * used to happen inside AuthProvider, which sits in the root layout — taking
 * down the marketing and legal pages, which need Firebase for nothing at all.
 * Callers check this and degrade instead.
 */
export function isClientConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId)
}

export function clientApp(): FirebaseApp {
  if (!isClientConfigured()) {
    throw new Error(
      'Firebase web config is missing. Set the NEXT_PUBLIC_FIREBASE_* environment variables.',
    )
  }
  const existing = getApps()
  return existing.length > 0 ? existing[0] : initializeApp(config)
}

let appCheckStarted = false

/**
 * Attaches App Check to every subsequent Firebase call.
 *
 * Must run in the browser and exactly once — initializeAppCheck throws if
 * called twice on the same app. Call it before anything that hits a gated
 * callable; it is safe to call repeatedly.
 *
 * When this is missing or fails, gated callables reject with `unauthenticated`,
 * which the Flutter app historically mislabelled "session expired" — a day was
 * lost to that on Android. If a callable starts returning `unauthenticated` on
 * web, suspect this before suspecting the user's session.
 */
export function initAppCheck(): void {
  if (appCheckStarted || typeof window === 'undefined') return
  if (!isClientConfigured()) return

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  if (!siteKey) {
    console.warn('App Check: NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set — gated callables will fail.')
    return
  }

  initializeAppCheck(clientApp(), {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  })
  appCheckStarted = true
}

export function clientAuth(): Auth {
  return getAuth(clientApp())
}

export function clientDb(): Firestore {
  return getFirestore(clientApp())
}
