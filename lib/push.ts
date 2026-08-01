import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from 'firebase/messaging'
import {
  arrayRemove,
  arrayUnion,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { clientApp, clientDb } from './firebase-client'

/*
  Web push for tenants, landlords and agents.

  The token goes into the SAME `users/{uid}.fcmTokens` array the Flutter app
  writes (`notification_service.dart:108`), so the existing
  `onNotificationCreated` trigger fans out to web with no server change at all.
  A person signed in on both their phone and a browser gets both.

  `fcmTokens` is not in the users-update blocklist (`firestore.rules:95`), which
  forbids only the server-authoritative fields, so this is a legal self-write.
*/

export type PushState = 'unsupported' | 'denied' | 'default' | 'granted'

/**
 * Whether this browser can do web push at all.
 *
 * On iOS this returns false in a normal Safari tab regardless of version —
 * Apple only exposes push to a site installed to the Home Screen (iOS 16.4+).
 * That is not a bug; it is why the UI prompts to install first.
 */
export async function pushSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
  return isSupported()
}

/** True when running as an installed PWA rather than a browser tab. */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS predates display-mode and uses a non-standard flag.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/** True on an iPhone/iPad that has not installed the app yet. */
export function iosNeedsInstall(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !isInstalled()
}

export function currentPermission(): PushState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission as PushState
}

/**
 * Asks for permission, mints a token, and stores it against this user.
 *
 * Must be called from a user gesture — browsers ignore the prompt otherwise,
 * and Safari permanently denies a site that asks without one.
 *
 * Returns null on success, or a message to show.
 */
export async function enablePush(uid: string): Promise<string | null> {
  if (!(await pushSupported())) {
    return iosNeedsInstall()
      ? 'On iPhone, add ClearRent to your Home Screen first — iOS does not allow notifications from a Safari tab.'
      : 'This browser does not support notifications.'
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    return 'Notifications are not configured yet. Try again later.'
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return permission === 'denied'
      ? 'Notifications are blocked for this site. Allow them in your browser settings, then try again.'
      : 'Notification permission was not granted.'
  }

  try {
    // Registered explicitly rather than relying on the SDK default, so a
    // failure surfaces here instead of producing a token that never receives.
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      { scope: '/' },
    )

    const token = await getToken(getMessaging(clientApp()), {
      vapidKey,
      serviceWorkerRegistration: registration,
    })
    if (!token) return 'The browser did not return a push token. Try again.'

    // arrayUnion so a browser token never displaces the phone's.
    await updateDoc(doc(clientDb(), 'users', uid), {
      fcmTokens: arrayUnion(token),
      updatedAt: serverTimestamp(),
    })
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not enable notifications.'
  }
}

/**
 * Detaches this browser from the signing-out user.
 *
 * NOT optional. A token is per-browser, not per-account: without this, signing
 * out on a shared or family device leaves the previous user's token on their
 * document, and they keep receiving that person's inspection and tenancy
 * notifications indefinitely. The Flutter app does the same on logout
 * (`notification_service.dart:137`).
 *
 * Best-effort throughout — a failure here must never block sign-out, so every
 * step swallows its error.
 */
export async function disablePush(uid: string): Promise<void> {
  try {
    if (!(await pushSupported())) return

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    if (!vapidKey) return

    const registration = await navigator.serviceWorker.getRegistration('/')
    if (!registration) return

    const messaging = getMessaging(clientApp())
    // Read the current token before deleting it — that is the value to pull
    // off the user document.
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    })

    if (token) {
      await updateDoc(doc(clientDb(), 'users', uid), {
        fcmTokens: arrayRemove(token),
        updatedAt: serverTimestamp(),
      }).catch(() => {})
      // Invalidate it with FCM too, so the next sign-in mints a fresh one
      // rather than reusing a token the server may already have pruned.
      await deleteToken(messaging).catch(() => {})
    }
  } catch {
    // Sign-out proceeds regardless.
  }
}

/**
 * Shows notifications that arrive while a tab is focused.
 *
 * The service worker handles background messages only; in the foreground FCM
 * hands the payload to the page and nothing displays unless we do it.
 * Returns an unsubscribe function.
 */
export async function watchForegroundPush(
  onPush: (title: string, body: string) => void,
): Promise<() => void> {
  if (!(await pushSupported())) return () => {}
  try {
    return onMessage(getMessaging(clientApp()), (payload) => {
      onPush(
        payload.notification?.title ?? 'ClearRent',
        payload.notification?.body ?? '',
      )
    })
  } catch {
    return () => {}
  }
}
