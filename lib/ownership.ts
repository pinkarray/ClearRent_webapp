import { collection, documentId, getDocs, query, where } from 'firebase/firestore'
import { clientDb } from './firebase-client'

/*
  Client-side counterpart of `effectiveDocStatus` in lib/property.ts.

  A unit grouped under a building carries the literal 'inherited' as a MARKER,
  not an approval - the building holds the single document an admin reviews. So
  a raw `ownershipDocStatus !== 'verified'` check reports a fully-reviewed unit
  as "awaiting verification", which is exactly what it did on the landlord
  dashboard while the admin correctly showed it as reviewed.

  The server already resolved this for public browse. This exists so the
  signed-in surfaces agree with it instead of each re-deriving the rule.

  Default matches the server and `_effectiveDocStatus` in the Flutter model:
  an unknown building is 'pending', NEVER 'verified'. Failing open here would
  mean an unreviewed unit reading as approved.
*/

type Ownable = {
  buildingId?: string | null
  ownershipDocStatus?: string | null
}

/**
 * Resolves each property's governing ownership status.
 *
 * Fetches only the buildings actually referenced, chunked because Firestore
 * caps `documentId() in [...]` at 30 values. Returns a map keyed by whatever
 * `keyOf` yields, so callers can key by property id.
 */
export async function resolveDocStatuses<T extends Ownable>(
  items: T[],
  keyOf: (item: T) => string,
): Promise<Map<string, string>> {
  const buildingIds = [
    ...new Set(items.map((i) => i.buildingId).filter((b): b is string => !!b)),
  ]

  const statuses = new Map<string, string>()
  for (let i = 0; i < buildingIds.length; i += 30) {
    const snap = await getDocs(
      query(
        collection(clientDb(), 'buildings'),
        where(documentId(), 'in', buildingIds.slice(i, i + 30)),
      ),
    )
    snap.forEach((d) => {
      statuses.set(d.id, (d.get('ownershipDocStatus') as string) ?? 'pending')
    })
  }

  const out = new Map<string, string>()
  for (const item of items) {
    out.set(
      keyOf(item),
      item.buildingId
        ? statuses.get(item.buildingId) ?? 'pending'
        : item.ownershipDocStatus ?? 'none',
    )
  }
  return out
}
