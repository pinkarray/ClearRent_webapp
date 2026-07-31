import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

/**
 * Server-side Firestore access for public pages.
 *
 * Properties are NOT publicly readable (`firestore.rules`: `allow read: if
 * request.auth != null`), so anonymous browse has to be server-rendered through
 * the Admin SDK. The Admin SDK bypasses rules entirely — every field that
 * reaches the browser must go through `toPublicProperty` in ./property.
 *
 * Credentials belong to `clearrent-web-ssr@`, a service account scoped to
 * Firestore only (roles/datastore.user). It is deliberately NOT the Firebase
 * Admin SDK default account, which also carries Auth and Storage admin.
 */
function getAdminApp(): App {
  const existing = getApps()
  if (existing.length > 0) return existing[0]

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp())
}
