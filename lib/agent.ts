import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { clientApp, clientDb, initAppCheck } from './firebase-client'

/*
  The agent's own side: coverage, availability, the properties they handle, and
  the leads they can chase.

  Two rules shape almost everything here (`firestore.rules:326` and `:336`).
  An assigned agent may write to a property they handle, but ONLY these exact
  field sets:

    readiness  → readyForInspections, readinessCheckedAt, readinessCheckedBy,
                 readinessChecklist, updatedAt
    scheduling → inspectionDays, inspectionTimeSlots, updatedAt

  Both are `hasOnly`, so slipping one extra key into either write rejects the
  whole update. Nothing else on a property is agent-writable — rent, address and
  availability stay the landlord's.
*/

/** The compiled fallback list, mirroring `agent_service_areas_screen.dart:28`. */
const COMPILED_AREAS = [
  'Ikeja', 'Lekki', 'Victoria Island', 'Ikoyi', 'Surulere', 'Yaba', 'Gbagada',
  'Maryland', 'Ojodu', 'Ogba', 'Magodo', 'Ajah', 'Sangotedo', 'Ikorodu',
  'Festac', 'Amuwo Odofin', 'Apapa', 'Isolo', 'Oshodi', 'Mushin', 'Ikotun',
  'Egbeda', 'Alimosho', 'Agege', 'Ifako-Ijaiye', 'Berger', 'Omole', 'Isheri',
  'Oregun', 'Alausa', 'Anthony', 'Palmgrove', 'Bariga', 'Shomolu', 'Ogudu',
  'Ketu', 'Mile 12', 'Ojota', 'Obalende', 'Marina', 'Lagos Island', 'Epe',
  'Badagry',
]

/**
 * Areas an agent can cover.
 *
 * `config/areas` lets an admin publish a new area without a store release, and
 * the app merges it over the compiled list. Web does the same so the two
 * surfaces never offer different coverage options; the compiled list is the
 * fallback when the doc is missing or unreadable.
 */
export async function serviceAreaOptions(): Promise<string[]> {
  try {
    const snap = await getDoc(doc(clientDb(), 'config', 'areas'))
    const remote = snap.data()?.areas
    if (remote && typeof remote === 'object') {
      const merged = new Set([...COMPILED_AREAS, ...Object.keys(remote)])
      return [...merged].sort()
    }
  } catch {
    // Fall through to the compiled list.
  }
  return [...COMPILED_AREAS].sort()
}

export const DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
]

export const TIME_SLOTS = [
  { value: 'morning', label: 'Morning (9AM – 12PM)' },
  { value: 'afternoon', label: 'Afternoon (12PM – 3PM)' },
  { value: 'late_afternoon', label: 'Late afternoon (3PM – 6PM)' },
] as const

export type AgentProfile = {
  serviceAreas: string[]
  baseLocation: string
  availableDays: string[]
  availableTimeSlots: string[]
  totalInspections: number
  rating: number
  totalRatings: number
}

/** Defaults match the app's, so an agent who has never saved looks the same on both. */
export async function agentProfile(uid: string): Promise<AgentProfile> {
  const snap = await getDoc(doc(clientDb(), 'users', uid))
  const x = snap.data() ?? {}
  const list = (v: unknown, fallback: string[]) =>
    Array.isArray(v) ? v.filter((i): i is string => typeof i === 'string') : fallback

  return {
    serviceAreas: list(x.serviceAreas, []),
    baseLocation: (x.baseLocation as string) ?? '',
    availableDays: list(x.availableDays, [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ]),
    availableTimeSlots: list(x.availableTimeSlots, [
      'morning', 'afternoon', 'late_afternoon',
    ]),
    totalInspections: (x.totalInspections as number) ?? 0,
    rating: (x.rating as number) ?? 0,
    totalRatings: (x.totalRatings as number) ?? 0,
  }
}

export async function saveServiceAreas(uid: string, areas: string[]): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'users', uid), {
      serviceAreas: areas,
      updatedAt: serverTimestamp(),
    })
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not save your areas.'
  }
}

export async function saveAvailability(
  uid: string,
  days: string[],
  slots: string[],
): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'users', uid), {
      availableDays: days,
      availableTimeSlots: slots,
      availabilityUpdatedAt: serverTimestamp(),
    })
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not save your availability.'
  }
}

export type HandledProperty = {
  id: string
  title: string
  approximateAddress: string
  city: string
  lga: string
  rent: number
  agentFee: number
  landlordId: string
  landlordName: string
  images: string[]
  isAvailable: boolean
  readyForInspections: boolean
  ownershipDocStatus: string
  inspectionDays: string[]
  inspectionTimeSlots: string[]
}

function toHandled(id: string, x: Record<string, unknown>): HandledProperty {
  const list = (v: unknown) =>
    Array.isArray(v) ? v.filter((i): i is string => typeof i === 'string') : []
  const city = (x.city as string) ?? ''
  const lga = (x.lga as string) ?? ''
  return {
    id,
    title: (x.title as string) ?? '(untitled)',
    approximateAddress: [lga, city, (x.state as string) ?? ''].filter(Boolean).join(', '),
    city,
    lga,
    rent: (x.rent as number) ?? 0,
    agentFee: (x.agentFee as number) ?? 0,
    landlordId: (x.landlordId as string) ?? '',
    landlordName: (x.landlordName as string) ?? 'Landlord',
    images: list(x.images),
    isAvailable: x.isAvailable === true,
    readyForInspections: x.readyForInspections === true,
    ownershipDocStatus: (x.ownershipDocStatus as string) ?? 'none',
    inspectionDays: list(x.inspectionDays),
    inspectionTimeSlots: list(x.inspectionTimeSlots),
  }
}

/** Properties this agent is assigned to handle. */
export async function handledProperties(uid: string): Promise<HandledProperty[]> {
  const snap = await getDocs(
    query(collection(clientDb(), 'properties'), where('assignedAgentId', '==', uid)),
  )
  return snap.docs.map((d) => toHandled(d.id, d.data()))
}

/**
 * Unassigned listings an agent could pitch for.
 *
 * Mirrors `agent_discover_properties_screen.dart:64`: verified landlords first,
 * then their available properties, then drop anything already assigned or with
 * a rejected ownership document. It is two round trips because Firestore has no
 * join, and `in` is capped at 30 values so the landlord ids are chunked.
 *
 * Note this is a LEAD list, not a claim list — an agent cannot assign
 * themselves. Only the landlord can (`property_service.dart:945`), so the
 * action here is to pitch, which is what the app does too.
 */
export async function discoverProperties(): Promise<HandledProperty[]> {
  const landlords = await getDocs(
    query(
      collection(clientDb(), 'users'),
      where('accountType', '==', 'landlord'),
      where('verificationStatus', '==', 'verified'),
    ),
  )
  const ids = landlords.docs.map((d) => d.id)
  if (ids.length === 0) return []

  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30))

  const results = await Promise.all(
    chunks.map((chunk) =>
      getDocs(
        query(
          collection(clientDb(), 'properties'),
          where('landlordId', 'in', chunk),
          where('isAvailable', '==', true),
        ),
      ),
    ),
  )

  const out: HandledProperty[] = []
  for (const snap of results) {
    for (const d of snap.docs) {
      const x = d.data()
      const assigned = (x.assignedAgentId as string) ?? ''
      if (assigned) continue
      if (x.ownershipDocStatus === 'rejected') continue
      out.push(toHandled(d.id, x))
    }
  }
  return out
}

/** The checklist an agent must affirm before a property becomes bookable. */
export const READINESS_CHECKLIST: Record<string, string> = {
  visited: "I've visited/inspected this property in person",
  accurate_media: 'The photos, video and description match the property',
  accurate_address: 'The address and location are correct',
  accessible: "It's accessible and ready to show tenants",
}

/**
 * Vets a property and makes it bookable. Every item must be confirmed — the app
 * enforces the same, and a half-vetted listing is the thing this gate exists to
 * prevent.
 */
export async function confirmReadiness(
  propertyId: string,
  uid: string,
  confirmed: Record<string, boolean>,
): Promise<string | null> {
  const keys = Object.keys(READINESS_CHECKLIST)
  if (!keys.every((k) => confirmed[k])) {
    return 'Confirm every item before marking the property ready.'
  }
  try {
    // Exactly the five keys the readiness rule allows — no more.
    await updateDoc(doc(clientDb(), 'properties', propertyId), {
      readyForInspections: true,
      readinessCheckedAt: serverTimestamp(),
      readinessCheckedBy: uid,
      readinessChecklist: keys,
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not mark this property ready. You must be its assigned agent.'
  }
}

/** Sets when this property can be inspected. Field-scoped by the same rules. */
export async function saveInspectionSchedule(
  propertyId: string,
  days: string[],
  slots: string[],
): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'properties', propertyId), {
      inspectionDays: days,
      inspectionTimeSlots: slots,
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not save the schedule. You must be this property’s assigned agent.'
  }
}

/**
 * Steps back from a property. Server-side because it is not a simple field
 * write: it clears the assignment, preserves the agent fee as `savedAgentFee`
 * so the landlord does not lose it, and resets readiness. Enforces App Check.
 */
export async function unassignFromProperty(
  propertyId: string,
  reason: string,
): Promise<string | null> {
  try {
    initAppCheck()
    const fn = httpsCallable<{ propertyId: string; reason: string }, unknown>(
      getFunctions(clientApp(), 'us-central1'),
      'agentUnassignFromProperty',
    )
    await fn({ propertyId, reason })
    return null
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    if (code === 'functions/unauthenticated') {
      return 'The request was rejected (App Check or sign-in). Reload and try again.'
    }
    return err instanceof Error ? err.message : 'Could not step back from this property.'
  }
}
