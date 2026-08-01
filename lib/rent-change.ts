import { Timestamp, addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { clientDb } from './firebase-client'

/*
  Landlord-filed rent changes. Mirrors `rent_review_service.dart` and
  `request_rent_change_screen.dart`.

  Two shapes, decided by whether anyone is living there:
  - OCCUPIED → `scheduled`. Targets a specific sitting tenancy; the increase
    applies at that tenant's next renewal, never mid-lease.
  - VACANT   → `immediate`. No tenant, no effective date.

  The landlord cannot approve their own request: `firestore.rules:1101` gives
  update rights to admin only, and create requires `status == 'pending'`. So
  this writes the filing and nothing else — the decision happens in the admin
  dashboard, and the approved increase is applied by a Cloud Function.
*/

export const RENT_CHANGE_REASONS = [
  { value: 'improvements', label: 'Improvements', desc: 'Renovations or upgrades to the property' },
  { value: 'market', label: 'Market rate', desc: 'Aligning with current market prices' },
  { value: 'both', label: 'Both', desc: 'Improvements and market movement' },
] as const

/** Must match OCCUPYING_RENTAL_STATUSES server-side (`rent_review_service.dart:20`). */
export const OCCUPYING_STATUSES = ['active', 'expiring_soon', 'grace_locked']

export type RentChangeRequest = {
  id: string
  propertyTitle: string
  currentRent: number
  proposedRent: number
  changeType: string
  status: string
  justification: string
  createdAt: Date | null
}

export type FileRentChangeInput = {
  landlordId: string
  propertyId: string
  propertyTitle: string
  currentRent: number
  proposedRent: number
  reasonType: string
  justification: string
  /** Present for a scheduled review; absent means the unit is vacant. */
  rental?: { id: string; tenantId: string }
}

export async function fileRentChange(input: FileRentChangeInput): Promise<string | null> {
  const scheduled = Boolean(input.rental)
  try {
    await addDoc(collection(clientDb(), 'rent_review_requests'), {
      landlordId: input.landlordId,
      tenantId: scheduled ? input.rental!.tenantId : '',
      rentalId: scheduled ? input.rental!.id : '',
      propertyId: input.propertyId,
      propertyTitle: input.propertyTitle,
      currentRent: input.currentRent,
      proposedRent: input.proposedRent,
      // Staged to filing time, exactly as the app does. The increase lands at
      // the tenant's next renewal; a filing-time date guarantees it has passed
      // by then, so the increase is never silently skipped.
      ...(scheduled ? { effectiveDate: Timestamp.now() } : {}),
      reasonType: input.reasonType,
      justification: input.justification.trim(),
      revisedAgreementUrl: '',
      changeType: scheduled ? 'scheduled' : 'immediate',
      // Rules require exactly this at creation.
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not file that request.'
  }
}

export async function myRentChangeRequests(landlordId: string): Promise<RentChangeRequest[]> {
  const snap = await getDocs(
    query(collection(clientDb(), 'rent_review_requests'), where('landlordId', '==', landlordId)),
  )
  return snap.docs
    .map((d) => {
      const x = d.data()
      return {
        id: d.id,
        propertyTitle: (x.propertyTitle as string) ?? '(property)',
        currentRent: (x.currentRent as number) ?? 0,
        proposedRent: (x.proposedRent as number) ?? 0,
        changeType: (x.changeType as string) ?? 'scheduled',
        status: (x.status as string) ?? 'pending',
        justification: (x.justification as string) ?? '',
        createdAt: x.createdAt?.toDate?.() ?? null,
      }
    })
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}
