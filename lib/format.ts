/**
 * Pure display helpers, split out of `lib/property.ts` so client components can
 * import them. `lib/property.ts` pulls in `firebase-admin` at module scope, and
 * importing anything from it on the client drags the Admin SDK into the browser
 * bundle.
 */

export function formatNaira(amount: number): string {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1000) return `₦${(amount / 1000).toFixed(0)}K`
  return `₦${amount.toFixed(0)}`
}

export function formatNairaFull(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`
}

export function rentPeriod(frequency: string): string {
  return frequency === 'yearly' ? '/year' : '/month'
}

/**
 * The app's propertyType vocabulary (PropertyModel.typeLabels). Values are
 * camelCase, so the old `.replace(/_/g, ' ')` rendered 'selfContain' as-is.
 */
// 'miniFlat' is not pickable anywhere: it is the same dwelling as
// 'roomAndParlour', which is the word Nigerians actually use. The label stays
// so a doc written while both were offered still renders.
const TYPE_LABELS: Record<string, string> = {
  flat: 'Flat',
  duplex: 'Duplex',
  semiDetachedDuplex: 'Semi-Detached Duplex',
  bungalow: 'Bungalow',
  selfContain: 'Self Contain',
  room: 'Room',
  roomAndParlour: 'Room & Parlour',
  miniFlat: 'Mini Flat',
  shop: 'Shop',
  office: 'Office',
}

export function propertyTypeLabel(value: string): string {
  return TYPE_LABELS[value] ?? value
}

/**
 * Types that are ONE space. They have no meaningful bedroom count — what
 * separates them is which facilities are the tenant's own, so their spec is
 * [sharedFacilities], not "1 bed · 1 bath".
 */
export function isSingleSpace(type: string): boolean {
  return (
    type === 'room' ||
    type === 'roomAndParlour' ||
    type === 'selfContain' ||
    type === 'miniFlat'
  )
}

/** "shared bathroom · shared kitchen". Empty when nothing is shared. */
export function sharedFacilities(p: {
  bathroomAccess: string
  toiletAccess: string
  kitchenAccess: string
}): string {
  const parts: string[] = []
  if (p.bathroomAccess === 'shared') parts.push('shared bathroom')
  if (p.toiletAccess === 'shared') parts.push('shared toilet')
  if (p.kitchenAccess === 'shared') parts.push('shared kitchen')
  else if (p.kitchenAccess === 'none') parts.push('no kitchen')
  return parts.join(' · ')
}

/** BuildingModel.structures — what the whole building is. */
const STRUCTURE_LABELS: Record<string, string> = {
  duplex: 'duplex',
  bungalow: 'bungalow',
  storeyBuilding: 'storey building',
  blockOfFlats: 'block of flats',
  compound: 'compound',
  faceMeIFaceYou: 'face me I face you',
  detachedHouse: 'detached house',
  other: '',
}

const FLOOR_LABELS: Record<string, string> = {
  ground: 'Ground floor',
  '1': '1st floor',
  '2': '2nd floor',
  '3': '3rd floor',
  '4': '4th floor',
}

/**
 * "Room 2 · 1st floor · in a duplex" — which unit this is, and what it sits in.
 * Empty for a whole-property listing. The building's NAME is never included: it
 * routinely carries the street address the location gate exists to withhold.
 */
export function unitContext(p: {
  unitLabel: string
  floor: string
  structure: string
}): string {
  const parts: string[] = []
  if (p.unitLabel) parts.push(p.unitLabel)
  if (p.floor) parts.push(FLOOR_LABELS[p.floor] ?? `Floor ${p.floor}`)
  const structure = p.structure ? STRUCTURE_LABELS[p.structure] : ''
  if (structure) parts.push(`in a ${structure}`)
  return parts.join(' · ')
}

export function formatDate(d: Date | null): string {
  if (!d) return '-'
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "3 hours ago" / "2 days ago", for feeds where an exact stamp is noise. */
export function timeAgo(d: Date | null): string {
  if (!d) return ''
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(d)
}
