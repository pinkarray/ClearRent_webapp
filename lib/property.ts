import { adminDb } from './firebase-admin'

/**
 * The only shape of a property that may reach a browser on a public page.
 *
 * Deliberately absent, and they must stay absent: `address`, `latitude`,
 * `longitude`, `landlordId`, `landlordName`, `landlordPhone`, `ownershipDocUrl`,
 * `ownershipDocStatus`, payout/earnings fields, and anything under the
 * `private/location` subdoc. Firestore rules cannot filter fields, which is the
 * whole reason these pages are server-rendered — the projection below IS the
 * access control.
 */
export type PublicProperty = {
  id: string
  title: string
  description: string
  propertyType: string
  bedrooms: number
  bathrooms: number
  toilets: number
  livingRooms: number
  kitchens: number
  images: string[]
  videoUrl: string | null
  /** Area-level only: LGA, city, state. Never the street. */
  approximateAddress: string
  city: string
  state: string
  lga: string
  rent: number
  rentFrequency: string
  agentFee: number
  cautionDeposit: number
  cautionDepositRefundable: boolean
  amenities: string[]
  rules: string[]
  recurringDues: { name?: string; amount?: number; frequency?: string }[]
  ceilingTypes: string[]
  createdAt: string | null
}

type RawProperty = Record<string, unknown>

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/**
 * A flat can mix ceiling types (POP in the living room, slate in the bedroom),
 * so the current field is a list. Legacy docs carry a single `ceilingType`
 * string where 'false_ceiling' means 'pop'. Direct port of
 * `PropertyModel._parseCeilingTypes` — reading only the plural field would
 * silently blank the ceiling on every older listing.
 */
function parseCeilingTypes(d: RawProperty): string[] {
  if (Array.isArray(d.ceilingTypes)) return d.ceilingTypes.map((e) => String(e))
  const legacy = typeof d.ceilingType === 'string' ? d.ceilingType : ''
  if (legacy.length === 0) return []
  return [legacy === 'false_ceiling' ? 'pop' : legacy]
}

/**
 * Area-level address, mirroring `PropertyModel.approximateAddress` in the
 * Flutter app so both surfaces render the same string.
 */
function approximateAddress(d: RawProperty): string {
  const parts = [str(d.lga), str(d.city), str(d.state)].filter((p) => p.length > 0)
  return parts.length === 0 ? 'Location available after approval' : parts.join(', ')
}

/**
 * Ownership-doc status that actually governs a listing. A unit grouped under a
 * building carries the literal 'inherited' as a MARKER, not an approval — the
 * building holds the single document an admin reviews. Resolve through the
 * building or a grouped unit reads as un-reviewed-but-not-rejected and walks
 * straight past a check keyed on `!== 'rejected'`.
 *
 * Mirrors `_effectiveDocStatus` in property_detail_screen.dart, including its
 * default: unknown building ⇒ 'pending', never 'verified'.
 */
function effectiveDocStatus(d: RawProperty, buildingStatuses: Map<string, string>): string {
  const buildingId = str(d.buildingId)
  if (buildingId.length > 0) return buildingStatuses.get(buildingId) ?? 'pending'
  return str(d.ownershipDocStatus, 'none')
}

/**
 * The publication gate. ALL must hold before a listing is shown to the public.
 * Written as an allowlist on the literal 'verified' — the rules file documents
 * how a denylist let 'inherited' and 'not_uploaded' walk through every guard.
 */
function isPublishable(d: RawProperty, buildingStatuses: Map<string, string>): boolean {
  // `isListable` in the Flutter model: the landlord's availability toggle AND
  // an actually-open spot.
  const hasAvailableSpots = num(d.currentTenantsCount) < num(d.maxTenants, 1)
  return (
    d.isAvailable === true &&
    hasAvailableSpots &&
    d.readyForInspections === true &&
    effectiveDocStatus(d, buildingStatuses) === 'verified'
  )
}

function toPublicProperty(id: string, d: RawProperty): PublicProperty {
  const createdAt = d.createdAt as { toDate?: () => Date } | undefined

  return {
    id,
    title: str(d.title),
    description: str(d.description),
    propertyType: str(d.propertyType, 'flat'),
    bedrooms: num(d.bedrooms),
    bathrooms: num(d.bathrooms),
    toilets: num(d.toilets),
    livingRooms: num(d.livingRooms, 1),
    kitchens: num(d.kitchens, 1),
    images: strList(d.images),
    videoUrl: typeof d.videoUrl === 'string' ? d.videoUrl : null,
    approximateAddress: approximateAddress(d),
    city: str(d.city),
    state: str(d.state),
    lga: str(d.lga),
    rent: num(d.rent),
    rentFrequency: str(d.rentFrequency, 'yearly'),
    agentFee: num(d.agentFee),
    cautionDeposit: num(d.cautionDeposit),
    // Absent field ⇒ refundable: every listing predating the flag was
    // advertised as refundable, same default as the Flutter model.
    cautionDepositRefundable: d.cautionDepositRefundable !== false,
    amenities: strList(d.amenities),
    rules: strList(d.rules),
    recurringDues: Array.isArray(d.recurringDues)
      ? (d.recurringDues as PublicProperty['recurringDues'])
      : [],
    ceilingTypes: parseCeilingTypes(d),
    createdAt: createdAt?.toDate ? createdAt.toDate().toISOString() : null,
  }
}

/**
 * Loads the ownership-doc status of every building referenced by [docs], so
 * grouped units can be resolved without an N+1 read per unit.
 */
async function loadBuildingStatuses(docs: RawProperty[]): Promise<Map<string, string>> {
  const ids = [...new Set(docs.map((d) => str(d.buildingId)).filter((id) => id.length > 0))]
  const statuses = new Map<string, string>()
  if (ids.length === 0) return statuses

  const db = adminDb()
  const snaps = await db.getAll(...ids.map((id) => db.collection('buildings').doc(id)))
  for (const snap of snaps) {
    if (!snap.exists) continue
    statuses.set(snap.id, str(snap.data()?.ownershipDocStatus, 'none'))
  }
  return statuses
}

export type PropertyFilters = {
  state?: string
  city?: string
  lga?: string
  propertyType?: string
  bedrooms?: number
  minRent?: number
  maxRent?: number
}

function matchesFilters(p: PublicProperty, f: PropertyFilters): boolean {
  const eq = (a: string, b?: string) => !b || a.toLowerCase() === b.toLowerCase()
  return (
    eq(p.state, f.state) &&
    eq(p.city, f.city) &&
    eq(p.lga, f.lga) &&
    eq(p.propertyType, f.propertyType) &&
    (f.bedrooms === undefined || p.bedrooms === f.bedrooms) &&
    (f.minRent === undefined || p.rent >= f.minRent) &&
    (f.maxRent === undefined || p.rent <= f.maxRent)
  )
}

/**
 * Published listings, newest first.
 *
 * The gate is applied in memory rather than as Firestore `where` clauses on
 * purpose: the effective doc status of a grouped unit lives on its building and
 * cannot be expressed as a query, and equality filters combined with an
 * `orderBy` would need a composite index deployed from the `clearrent` repo.
 * Fine at the current catalogue size; revisit with a composite index and
 * pagination when listing volume makes the full scan wasteful.
 */
export async function getPublishedProperties(
  filters: PropertyFilters = {},
  limit = 200,
): Promise<PublicProperty[]> {
  const snap = await adminDb()
    .collection('properties')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()

  const raw = snap.docs.map((d) => ({ id: d.id, data: d.data() as RawProperty }))
  const buildingStatuses = await loadBuildingStatuses(raw.map((r) => r.data))

  return raw
    .filter((r) => isPublishable(r.data, buildingStatuses))
    .map((r) => toPublicProperty(r.id, r.data))
    .filter((p) => matchesFilters(p, filters))
}

/**
 * A single published listing, or null when it does not exist or has not passed
 * the gate. Returning null for an unpublished listing is deliberate: a detail
 * page must not confirm that an unvetted property exists.
 */
export async function getPublishedProperty(id: string): Promise<PublicProperty | null> {
  const snap = await adminDb().collection('properties').doc(id).get()
  if (!snap.exists) return null

  const data = snap.data() as RawProperty
  const buildingStatuses = await loadBuildingStatuses([data])
  if (!isPublishable(data, buildingStatuses)) return null

  return toPublicProperty(snap.id, data)
}

// ── Formatting, mirroring the Flutter model's helpers ──

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

/** Rent + agent fee + caution deposit, same definition as `totalPackage`. */
export function totalPackage(p: PublicProperty): number {
  return p.rent + p.agentFee + p.cautionDeposit
}
