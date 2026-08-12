import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { clientDb } from './firebase-client'

/*
  Saved properties live at `users/{uid}/savedProperties/{propertyId}` - a
  subcollection the owner alone can read or write (`firestore.rules:125`).

  Note the root `saved_properties` collection is `allow read, write: if false`
  (rules:589). It is dead, not an alternative - writing there fails silently
  from the caller's point of view. Mirrors `saved_properties_service.dart`.
*/

function savedRef(uid: string) {
  return collection(clientDb(), 'users', uid, 'savedProperties')
}

export async function savedPropertyIds(uid: string): Promise<string[]> {
  const snap = await getDocs(savedRef(uid))
  return snap.docs.map((d) => d.id)
}

export async function isSaved(uid: string, propertyId: string): Promise<boolean> {
  const snap = await getDoc(doc(savedRef(uid), propertyId))
  return snap.exists()
}

/** Returns the new saved state. */
export async function toggleSaved(uid: string, propertyId: string): Promise<boolean> {
  const ref = doc(savedRef(uid), propertyId)
  if ((await getDoc(ref)).exists()) {
    await deleteDoc(ref)
    return false
  }
  await setDoc(ref, { propertyId, savedAt: serverTimestamp() })
  return true
}

/** The fields a saved-list card needs. Deliberately not the whole document. */
export type SavedProperty = {
  id: string
  title: string
  approximateAddress: string
  rent: number
  rentFrequency: string
  bedrooms: number
  bathrooms: number
  toilets: number
  image: string | null
  isAvailable: boolean
}

/**
 * Reads the saved properties themselves.
 *
 * A signed-in client may read `/properties` (`firestore.rules:177` is
 * `allow read: if request.auth != null`), which is why this does not need the
 * server-rendered path that public browse uses. Only the display fields are
 * lifted out — the raw document also carries landlordId and payout data that no
 * screen here has a reason to hold.
 *
 * `documentId() in [...]` is capped at 30 values per query, so ids are chunked.
 */
export async function loadSavedProperties(ids: string[]): Promise<SavedProperty[]> {
  if (ids.length === 0) return []

  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30))

  const results = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(clientDb(), 'properties'), where(documentId(), 'in', chunk))),
    ),
  )

  const out: SavedProperty[] = []
  for (const snap of results) {
    for (const d of snap.docs) {
      const x = d.data()
      const images = Array.isArray(x.images)
        ? x.images.filter((i): i is string => typeof i === 'string')
        : []
      const city = (x.city as string) ?? ''
      const state = (x.state as string) ?? ''
      const lga = (x.lga as string) ?? ''
      out.push({
        id: d.id,
        title: (x.title as string) ?? '(untitled)',
        // Same area-level string the public pages show — never the street.
        approximateAddress: [lga, city, state].filter(Boolean).join(', '),
        rent: (x.rent as number) ?? 0,
        rentFrequency: (x.rentFrequency as string) ?? 'yearly',
        bedrooms: (x.bedrooms as number) ?? 0,
        bathrooms: (x.bathrooms as number) ?? 0,
        toilets: (x.toilets as number) ?? 0,
        image: images[0] ?? null,
        isAvailable: x.isAvailable === true,
      })
    }
  }
  return out
}
