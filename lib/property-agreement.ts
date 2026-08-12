import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getStorage, ref, uploadBytes } from 'firebase/storage'
import { clientApp, clientDb } from './firebase-client'

/*
  The blank tenancy agreement a landlord keeps against a PROPERTY, before any
  tenant exists. Mirrors `PropertyService.savePropertyAgreement` in the app -
  same storage path, same subdoc, same field names - because
  `createRentalForAcceptedInterest` reads it server-side and does not care which
  client wrote it.

  Storage: `agreements/{uid}/agreement_{millis}.{ext}`, private. Storage rules
  allow the uploader (landlord) and admin only; a tenant receives the document
  once it is copied onto their rental, via the getSignedAgreementUrl callable
  which checks membership.

  Firestore: `properties/{id}/private/agreement`, whose rule admits only the
  owner, the assigned agent and admin - deliberately NOT the location-reveal
  grant that the sibling `private/{docId}` rule honours.
*/

export type PropertyAgreement = {
  storagePath: string
  /**
   * The rent this document was written for. Acceptance refuses to auto-attach
   * when it no longer matches the property's rent, so a rent review can never
   * bind a new tenant to a document quoting the old price.
   */
  rentAtUpload: number
  uploadedAt: Date | null
}

function agreementRef(propertyId: string) {
  return doc(clientDb(), 'properties', propertyId, 'private', 'agreement')
}

export async function getPropertyAgreement(
  propertyId: string,
): Promise<PropertyAgreement | null> {
  try {
    const snap = await getDoc(agreementRef(propertyId))
    const x = snap.data()
    const storagePath = (x?.storagePath as string) ?? ''
    if (!storagePath) return null
    return {
      storagePath,
      rentAtUpload: (x?.rentAtUpload as number) ?? 0,
      uploadedAt: x?.uploadedAt?.toDate?.() ?? null,
    }
  } catch {
    // Rules deny anyone who is not the owner/agent/admin — treat as "none".
    return null
  }
}

/**
 * Upload a document and record it against the property.
 *
 * Every upload gets a uniquely-timestamped path, which is what makes replacing
 * safe: a tenancy that already copied the old path keeps pointing at the exact
 * document its tenant reviewed.
 *
 * Returns null on success, or a message to show.
 */
export async function savePropertyAgreement(
  uid: string,
  propertyId: string,
  file: File,
  rentAtUpload: number,
): Promise<string | null> {
  if (!propertyId) return 'Missing property.'
  try {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'pdf'
    const path = `agreements/${uid}/agreement_${Date.now()}.${ext}`
    await uploadBytes(ref(getStorage(clientApp()), path), file)

    await setDoc(
      agreementRef(propertyId),
      {
        storagePath: path,
        rentAtUpload,
        uploadedAt: serverTimestamp(),
        uploadedBy: uid,
      },
      { merge: true },
    )
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not save that agreement.'
  }
}

/**
 * Stop future tenancies inheriting this agreement. Tenancies that already
 * copied it keep their own copy.
 */
export async function removePropertyAgreement(propertyId: string): Promise<string | null> {
  try {
    await deleteDoc(agreementRef(propertyId))
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not remove that agreement.'
  }
}

/** True when the property's rent has moved on since the agreement was written. */
export function isAgreementStale(a: PropertyAgreement, currentRent: number): boolean {
  return a.rentAtUpload > 0 && currentRent > 0 && a.rentAtUpload !== currentRent
}
