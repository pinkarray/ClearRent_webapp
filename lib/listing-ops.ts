import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytes } from 'firebase/storage'
import { clientApp, clientAuth, clientDb } from './firebase-client'

/**
 * The readiness checklist, copied from `PropertyService.readinessChecklistItems`.
 * Order and keys must match — the stored `readinessChecklist` array is read by
 * the app and by admin tooling.
 */
export const READINESS_ITEMS: { key: string; label: string }[] = [
  { key: 'visited', label: "I've visited/inspected this property in person" },
  { key: 'accurate_media', label: 'The photos, video and description match the property' },
  { key: 'accurate_address', label: 'The address and location are correct' },
  { key: 'accessible', label: "It's accessible and ready to show tenants" },
]

/**
 * Marks a property bookable. Mirrors `markReadyForInspections`: every item must
 * be confirmed, and the write is limited to the readiness fields so it satisfies
 * the field-scoped rule clause (which is what the assigned-agent path relies on;
 * the landlord path rides the owner-update rule).
 */
export async function markReadyForInspections(
  propertyId: string,
  confirmed: Record<string, boolean>,
): Promise<string | null> {
  const all = READINESS_ITEMS.every((i) => confirmed[i.key] === true)
  if (!all) return 'Please confirm every item before marking the property ready.'

  try {
    await updateDoc(doc(clientDb(), 'properties', propertyId), {
      readyForInspections: true,
      readinessCheckedAt: serverTimestamp(),
      readinessCheckedBy: clientAuth().currentUser?.uid,
      readinessChecklist: READINESS_ITEMS.filter((i) => confirmed[i.key] === true).map(
        (i) => i.key,
      ),
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not update the property. Please try again.'
  }
}

export type EditableListing = {
  title: string
  description: string
  rent: number
  agentFee: number
  cautionDeposit: number
  cautionDepositRefundable: boolean
  isAvailable: boolean
  amenities: string[]
  rules: string[]
  /**
   * Sitting tenants freeze the money terms. Rules reject any change to rent,
   * agentFee, cautionDeposit or cautionDepositRefundable once
   * currentTenantsCount > 0 — that is the deal the tenant accepted. The form
   * disables those fields rather than letting the write fail opaquely.
   */
  currentTenantsCount: number
  /**
   * Whether the property is already vetted and bookable. The assigned agent can
   * set this too, so the landlord's page must read it rather than assume — it
   * previously always showed the checklist, hiding the agent's vetting from the
   * landlord and asking them to redo work that was already done.
   */
  readyForInspections: boolean
  readinessCheckedBy: string
  /**
   * 'none' | 'pending' | 'verified' | 'rejected' | 'inherited'. Read-only here:
   * the owner changes it only by uploading a document, via uploadOwnershipDoc.
   * 'inherited' means the reviewed artifact is the BUILDING's document, so this
   * unit has none of its own and must not be asked for one.
   */
  ownershipDocStatus: string
  ownershipDocRejectionReason: string
}

export async function loadListingForEdit(propertyId: string): Promise<EditableListing | null> {
  const snap = await getDoc(doc(clientDb(), 'properties', propertyId))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    title: (d.title as string) ?? '',
    description: (d.description as string) ?? '',
    rent: (d.rent as number) ?? 0,
    agentFee: (d.agentFee as number) ?? 0,
    cautionDeposit: (d.cautionDeposit as number) ?? 0,
    cautionDepositRefundable: d.cautionDepositRefundable !== false,
    isAvailable: d.isAvailable === true,
    amenities: Array.isArray(d.amenities) ? (d.amenities as string[]) : [],
    rules: Array.isArray(d.rules) ? (d.rules as string[]) : [],
    currentTenantsCount: (d.currentTenantsCount as number) ?? 0,
    readyForInspections: d.readyForInspections === true,
    readinessCheckedBy: (d.readinessCheckedBy as string) ?? '',
    ownershipDocStatus: (d.ownershipDocStatus as string) ?? 'none',
    ownershipDocRejectionReason: (d.ownershipDocRejectionReason as string) ?? '',
  }
}

/**
 * Saves owner-editable fields. Money terms are only included when there is no
 * sitting tenant; `isVerified`, `landlordId`, `buildingId` and the ownership-doc
 * fields are never written here because rules pin every one of them.
 */
export async function saveListingEdits(
  propertyId: string,
  edits: EditableListing,
): Promise<string | null> {
  const payload: Record<string, unknown> = {
    title: edits.title,
    description: edits.description,
    isAvailable: edits.isAvailable,
    amenities: edits.amenities,
    rules: edits.rules,
    updatedAt: serverTimestamp(),
  }

  if (edits.currentTenantsCount <= 0) {
    payload.rent = edits.rent
    payload.agentFee = edits.agentFee
    payload.cautionDeposit = edits.cautionDeposit
    payload.cautionDepositRefundable = edits.cautionDepositRefundable
  }

  try {
    await updateDoc(doc(clientDb(), 'properties', propertyId), payload)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : 'Could not save your changes.'
  }
}

/**
 * Attach (or replace) the ownership document on a listing that already exists.
 *
 * Needed for two situations that had no path on web at all:
 *  - listings created before the upload step existed, which sit at status
 *    `'none'` — admin can neither verify nor reject those, so they are frozen
 *    out of public browse forever with nothing anyone can do about it;
 *  - a document an admin REJECTED, which the owner must be able to replace.
 *
 * Always lands on `'pending'`. rules:427 lets an owner move the status back to
 * review and nothing else — `'verified'` and `'rejected'` are the admin's, and
 * changing the file or the type forces the status back to `'pending'` so an
 * approval can never carry over to a document the admin never saw.
 */
export async function uploadOwnershipDoc(
  uid: string,
  propertyId: string,
  file: File,
  docType: 'c_of_o' | 'deed' | 'other',
): Promise<string | null> {
  try {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'pdf'
    // Storage rules make this path write-once, so every submission gets its own
    // timestamped name rather than overwriting the rejected one.
    const path = `ownership/${uid}/cofo_${Date.now()}.${ext}`
    await uploadBytes(storageRef(getStorage(clientApp()), path), file)

    await updateDoc(doc(clientDb(), 'properties', propertyId), {
      ownershipDocUrl: path,
      ownershipDocType: docType,
      ownershipDocStatus: 'pending',
      updatedAt: serverTimestamp(),
    })
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not upload that document.'
  }
}
