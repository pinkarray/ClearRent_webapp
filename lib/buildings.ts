import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { clientDb } from './firebase-client'

/**
 * Buildings group a landlord's unit listings under one ownership document,
 * exactly as the app's BuildingService does. Each unit is still its own
 * listing with its own rent and tenant; the building is what an admin verifies
 * once for all of them.
 */

export type Building = {
  id: string
  name: string
  structure: string
  ownershipDocStatus: string
}

/** BuildingModel.structures, in the app's chip order. */
export const STRUCTURES: Array<[value: string, label: string]> = [
  ['duplex', 'Duplex'],
  ['bungalow', 'Bungalow'],
  ['storeyBuilding', 'Storey building'],
  ['blockOfFlats', 'Block of flats'],
  ['compound', 'Compound'],
  ['faceMeIFaceYou', 'Face me I face you'],
  ['detachedHouse', 'Detached house'],
  ['other', 'Other'],
]

export function structureLabel(value: string): string {
  return STRUCTURES.find(([v]) => v === value)?.[1] ?? ''
}

/**
 * PropertyModel.unitTypes. 'bungalow' is absent on purpose: it describes the
 * building, and offering it here produced "Room 2 - 1 Bedroom Bungalow".
 */
export const UNIT_TYPES = [
  'room',
  'roomAndParlour',
  'selfContain',
  'flat',
  'duplex',
  'semiDetachedDuplex',
]

/** PropertyModel.floors. */
export const FLOORS: Array<[value: string, label: string]> = [
  ['ground', 'Ground floor'],
  ['1', '1st floor'],
  ['2', '2nd floor'],
  ['3', '3rd floor'],
  ['4', '4th floor'],
  ['5', '5th floor'],
  ['6', '6th floor'],
  ['7', '7th floor'],
  ['8', '8th floor'],
  ['9', '9th floor'],
  ['10', '10th floor'],
]

/** "A" for 1 - which of a compound's buildings, derived so it can't contradict. */
export function buildingLetter(n: number): string {
  return String.fromCharCode(64 + Math.min(Math.max(n, 1), 26))
}

export function letterNumber(label: string): number {
  if (!label) return 1
  return Math.min(Math.max(label.toUpperCase().charCodeAt(0) - 64, 1), 26)
}

/** The caller's buildings, newest first. Scoped to landlordId for the list rule. */
export async function myBuildings(uid: string): Promise<Building[]> {
  const snap = await getDocs(
    query(collection(clientDb(), 'buildings'), where('landlordId', '==', uid)),
  )
  return snap.docs
    .map((d) => ({ d, at: d.data().createdAt?.toMillis?.() ?? 0 }))
    .sort((a, b) => b.at - a.at)
    .map(({ d }) => ({
      id: d.id,
      name: (d.data().name as string) ?? '',
      structure: (d.data().structure as string) ?? '',
      ownershipDocStatus: (d.data().ownershipDocStatus as string) ?? 'none',
    }))
}

export type ExistingUnit = { unitLabel: string; structure: string; buildingLabel: string }

/**
 * Units already listed in a building, so a second "Flat 1" is caught and a
 * compound's existing buildings can be picked rather than retyped. Fails open:
 * an unreadable list blocks nothing.
 */
export async function unitsInBuilding(buildingId: string): Promise<ExistingUnit[]> {
  try {
    const snap = await getDocs(
      query(collection(clientDb(), 'properties'), where('buildingId', '==', buildingId)),
    )
    return snap.docs.map((d) => ({
      unitLabel: String(d.data().unitLabel ?? ''),
      structure: String(d.data().unitBuildingStructure ?? ''),
      buildingLabel: String(d.data().unitBuildingLabel ?? ''),
    }))
  } catch {
    return []
  }
}

/**
 * Creates a building carrying the shared ownership document, born 'pending'.
 * firestore.rules requires the document path to be the caller's own upload.
 */
export async function createBuilding(
  uid: string,
  b: {
    name: string
    address: string
    structure: string
    ownershipDocUrl: string
    ownershipDocType: string
  },
): Promise<string> {
  const ref = await addDoc(collection(clientDb(), 'buildings'), {
    landlordId: uid,
    name: b.name.trim(),
    address: b.address.trim(),
    structure: b.structure,
    ownershipDocUrl: b.ownershipDocUrl,
    ownershipDocType: b.ownershipDocType,
    ownershipDocStatus: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}
