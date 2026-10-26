'use client'

import { useEffect, useState } from 'react'
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import { clientDb } from '../lib/firebase-client'

type Announcement = { id: string; title: string; body: string }

/**
 * Admin announcements, as the app's AnnouncementsBanner shows them: the newest
 * one for this user's role (or naming them), posted after they joined, not yet
 * dismissed. Dismissals are stored on the user doc, so a dismiss here also
 * hides it in the app. The website showed none, so a landlord who only uses it
 * never heard about a fee change.
 */
export default function AnnouncementsBanner({
  uid,
  accountType,
}: {
  uid: string
  accountType: string | undefined
}) {
  const [items, setItems] = useState<Announcement[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let unsub: (() => void) | undefined
    let cancelled = false
    void (async () => {
      const u = (await getDoc(doc(clientDb(), 'users', uid))).data() ?? {}
      if (cancelled) return
      const joined: Date = u.createdAt?.toDate?.() ?? new Date(2000, 0, 1)
      setDismissed(new Set(Array.isArray(u.dismissedAnnouncements) ? u.dismissedAnnouncements : []))
      unsub = onSnapshot(
        query(collection(clientDb(), 'announcements'), orderBy('createdAt', 'desc'), limit(20)),
        (snap) => {
          setItems(
            snap.docs
              .filter((d) => {
                const x = d.data()
                const at: Date | undefined = x.createdAt?.toDate?.()
                if (at && at < joined) return false
                const target = (x.targetType as string) ?? 'all'
                const ids: string[] = Array.isArray(x.targetIds) ? x.targetIds : []
                return target === 'all' || target === accountType || ids.includes(uid)
              })
              .map((d) => ({
                id: d.id,
                title: (d.data().title as string) ?? '',
                body: (d.data().body as string) ?? '',
              })),
          )
        },
        () => setItems([]),
      )
    })()
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [uid, accountType])

  const a = items.find((i) => !dismissed.has(i.id))
  if (!a) return null

  async function dismiss(id: string) {
    setDismissed((s) => new Set([...s, id]))
    setOpen(false)
    try {
      await updateDoc(doc(clientDb(), 'users', uid), { dismissedAnnouncements: arrayUnion(id) })
    } catch {
      // Hidden for this visit; it will show again next time.
    }
  }

  return (
    <section
      className="rounded-lg p-4"
      style={{ border: '1px solid var(--info, #3b82f6)', background: 'var(--surface)' }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-content">{a.title}</p>
          <p
            className={`mt-1 whitespace-pre-line text-sm text-content-secondary ${open ? '' : 'line-clamp-2'}`}
          >
            {a.body}
          </p>
          <button
            className="mt-2 text-sm text-primary"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'Show less' : 'Read more'}
          </button>
        </div>
        <button
          aria-label="Dismiss announcement"
          className="shrink-0 px-1 text-content-hint"
          onClick={() => void dismiss(a.id)}
        >
          ×
        </button>
      </div>
    </section>
  )
}
