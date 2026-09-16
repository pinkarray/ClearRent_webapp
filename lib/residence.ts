'use client'

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { clientDb } from './firebase-client'

/*
  Where a landlord lives: ONE fact, answered once. A port of the app's
  LandlordResidence and ResidenceService, writing the same private document and
  the same listing fields, so either surface can answer and both stay in step.

  Private (users/{uid}/private/residence) because user docs are readable by any
  signed-in account. Listings carry only the coarse line a tenant needs.
*/

export type ResidenceKind = 'own' | 'rent' | 'abroad'

export type Residence = {
  kind: ResidenceKind
  state: string | null
  area: string | null
  country: string | null
  /** The listed building marked "I live here". Only ever set for 'own'. */
  homeBuildingId: string | null
  homeBuildingName: string | null
}

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
  'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

function residenceDoc(uid: string) {
  return doc(clientDb(), 'users', uid, 'private', 'residence')
}

function fromData(x: Record<string, unknown> | undefined): Residence | null {
  if (!x?.kind) return null
  return {
    kind: x.kind as ResidenceKind,
    state: (x.state as string) ?? null,
    area: (x.area as string) ?? null,
    country: (x.country as string) ?? null,
    homeBuildingId: (x.homeBuildingId as string) ?? null,
    homeBuildingName: (x.homeBuildingName as string) ?? null,
  }
}

export async function getResidence(uid: string): Promise<Residence | null> {
  return fromData((await getDoc(residenceDoc(uid))).data())
}

export function watchResidence(uid: string, onChange: (r: Residence | null) => void) {
  return onSnapshot(
    residenceDoc(uid),
    (s) => onChange(fromData(s.data())),
    () => onChange(null),
  )
}

export function residenceSummary(r: Residence): string {
  const place = r.area ? `${r.state} (${r.area})` : r.state ?? ''
  if (r.kind === 'own') return `In a property I own, ${place}`
  if (r.kind === 'rent') return `In a place I rent, ${place}`
  return `Outside Nigeria (${r.country ?? ''})`
}

/** Same derivation as LandlordResidence.listingFields in the app. */
function listingFields(r: Residence, buildingId: string | null) {
  const onPremises = r.kind === 'own' && !!buildingId && buildingId === r.homeBuildingId
  return {
    landlordResidence: onPremises ? 'on_premises' : r.kind === 'abroad' ? 'abroad' : 'elsewhere',
    landlordResidenceRegion: r.kind === 'abroad' || onPremises ? null : r.state,
    landlordLivesInProperty: onPremises,
    landlordLivesOnPremises: onPremises,
  }
}

/**
 * Saves the residence and rewrites the residence fields on every listing. A
 * landlord abroad also has self-handled listings taken out of "ready": nobody
 * would be there to open the door, and firestore.rules refuses to mark them
 * ready again until an agent or caretaker handles them.
 */
export async function saveResidence(uid: string, residence: Residence): Promise<string | null> {
  const r: Residence =
    residence.kind === 'own' ? residence : { ...residence, homeBuildingId: null, homeBuildingName: null }
  const complete = r.kind === 'abroad' ? !!r.country?.trim() : !!r.state
  if (!complete) return 'Please finish telling us where you live.'
  try {
    await setDoc(residenceDoc(uid), { ...r, updatedAt: serverTimestamp() })
    const snap = await getDocs(query(collection(clientDb(), 'properties'), where('landlordId', '==', uid)))
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(clientDb())
      for (const d of snap.docs.slice(i, i + 400)) {
        const x = d.data()
        const selfHandled = (x.inspectionHandler ?? 'self') === 'self'
        batch.update(d.ref, {
          ...listingFields(r, (x.buildingId as string) ?? null),
          ...(r.kind === 'abroad' && selfHandled && x.readyForInspections === true
            ? { readyForInspections: false }
            : {}),
          updatedAt: serverTimestamp(),
        })
      }
      await batch.commit()
    }
    return null
  } catch {
    return 'Could not save where you live. Please try again.'
  }
}
