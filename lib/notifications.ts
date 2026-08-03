import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type QuerySnapshot,
} from 'firebase/firestore'
import { clientDb } from './firebase-client'

/*
  Notifications are written only by Cloud Functions — `firestore.rules:1245` is
  `allow create: if false` for clients. A recipient may read their own and mark
  them read, and nothing else: the update rule allowlists exactly
  `['read', 'readAt']` (rules:1259), so adding any other field rejects the whole
  write.

  Note the field is `read`, not `isRead`. The activities feed uses `isRead`; the
  two collections are not interchangeable.
*/

export type AppNotification = {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  /** Route hint written by the functions, e.g. `/tenant/inspections`. */
  route: string | null
  createdAt: Date | null
}

// Filter by userId only and sort in memory — the composite index for a
// server-side orderBy alongside this where() is not provisioned, and a
// missing index throws rather than degrading.
function myNotificationsQuery(uid: string) {
  return query(collection(clientDb(), 'notifications'), where('userId', '==', uid))
}

function toNotifications(snap: QuerySnapshot): AppNotification[] {
  const rows = snap.docs.map((d) => {
    const x = d.data()
    const payload = (x.payload as Record<string, string> | undefined) ?? {}
    return {
      id: d.id,
      type: (x.type as string) ?? 'general',
      title: (x.title as string) ?? '',
      body: (x.body as string) ?? '',
      read: x.read === true,
      route: payload.route ?? null,
      createdAt: x.createdAt?.toDate?.() ?? null,
    }
  })
  return rows.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

export async function myNotifications(uid: string): Promise<AppNotification[]> {
  return toNotifications(await getDocs(myNotificationsQuery(uid)))
}

/**
 * Live notifications, for the shell's unread badge.
 *
 * Every notification is written by a Cloud Function reacting to what someone
 * else did, so the badge is by definition never something this user's own
 * navigation should have to discover.
 *
 * Returns the unsubscribe function.
 */
export function watchMyNotifications(
  uid: string,
  onChange: (rows: AppNotification[]) => void,
): () => void {
  return onSnapshot(myNotificationsQuery(uid), (snap) => onChange(toNotifications(snap)))
}

export async function markRead(id: string): Promise<void> {
  await updateDoc(doc(clientDb(), 'notifications', id), {
    read: true,
    readAt: serverTimestamp(),
  })
}

export async function markAllRead(rows: AppNotification[]): Promise<void> {
  await Promise.all(rows.filter((r) => !r.read).map((r) => markRead(r.id)))
}

/**
 * `payload.route` holds a Flutter route. The constants are declared across
 * `functions/src/*_ops.ts` (e.g. `inspection_reminders_ops.ts:21`); this maps
 * the ones with a web equivalent. Anything unmapped renders without a link
 * rather than as a dead one — /agent/* has no web surface at all yet.
 */
export function webRoute(route: string | null): string | null {
  if (!route) return null
  const map: Record<string, string> = {
    '/tenant/home': '/dashboard',
    '/tenant/inspections': '/dashboard/inspections',
    '/tenant/my-rentals': '/dashboard/rentals',
    '/tenant/issue-history': '/dashboard/issues',
    '/landlord/inspections': '/dashboard/requests',
  }
  return map[route] ?? null
}
