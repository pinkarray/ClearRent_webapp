import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { clientDb } from './firebase-client'
import { trackPropertyAdded } from './activity'

export type ListingInput = {
  title: string
  description: string
  propertyType: string
  bedrooms: number
  bathrooms: number
  toilets: number
  livingRooms: number
  guestRooms: number
  kitchens: number
  images: string[]
  /** Exact street address. Goes ONLY to the gated private/location subdoc. */
  address: string
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
  landlordLivesInProperty: boolean
  landlordLivesOnPremises: boolean
  currentTenantsCount: number
  hasCaretaker: boolean
  caretakerLivesOnPremises: boolean
  /** A flat can mix ceiling types, so this is a list — matches the app. */
  ceilingTypes: string[]
  videoUrl: string | null
}

/**
 * Creates a property exactly as `PropertyService.createProperty` does in the
 * Flutter app, so a listing made on the web is indistinguishable from one made
 * on the phone. Deviating here would give the two surfaces different documents
 * and quietly break every reader that assumes the app's shape.
 *
 * Three things this must not get wrong, all enforced by firestore.rules too:
 *  - `landlordId` is the caller's own uid.
 *  - `isVerified` is false. It is the ADMIN's badge, written by
 *    adminReviewPropertyDoc — a listing is born unreviewed.
 *  - The exact address and coordinates never touch the parent doc; they go to
 *    `properties/{id}/private/location`, which rules gate to the owner, the
 *    assigned agent, an admin, or a tenant with an approved inspection.
 */
export async function createListing(uid: string, input: ListingInput): Promise<string> {
  const db = clientDb()

  const userSnap = await getDoc(doc(db, 'users', uid))
  const userData = userSnap.data()
  const landlordName = (userData?.fullName as string | undefined) ?? 'Landlord'
  const landlordPhone = (userData?.phone as string | undefined) ?? ''

  const propertyData = {
    landlordId: uid,
    title: input.title,
    description: input.description,
    propertyType: input.propertyType,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    toilets: input.toilets,
    livingRooms: input.livingRooms,
    guestRooms: input.guestRooms,
    kitchens: input.kitchens,
    images: input.images,
    // Area-level only. `address`, `latitude` and `longitude` are absent by
    // construction — the parent doc is readable by every signed-in user.
    city: input.city,
    state: input.state,
    lga: input.lga,
    rent: input.rent,
    rentFrequency: input.rentFrequency,
    agentFee: input.agentFee,
    cautionDeposit: input.cautionDeposit,
    cautionDepositRefundable: input.cautionDepositRefundable,
    isAvailable: true,
    isVerified: false,
    amenities: input.amenities,
    rules: input.rules,
    landlordName,
    landlordPhone,
    inspectionHandler: 'self',
    inspectionDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    inspectionTimeSlots: ['morning', 'afternoon', 'late_afternoon'],
    assignedAgentId: null,
    assignedAgentName: null,
    assignedAgentPhone: null,
    // One listing = one tenancy. Everything priced on this doc is singular, and
    // the accept-time slot guard keys off this number, so it is not the
    // landlord's to raise. firestore.rules pins it to 1.
    maxTenants: 1,
    // Web lists WHOLE properties only — it writes no buildingId — so there is
    // nobody to share with and the access fields do not apply. They are asked
    // and stored only for a unit inside a building, where every type can share
    // (a self contain in a compound still queues for the toilet). Public pages
    // gate the sharing rows on `grouped`, so omitting them shows nothing here
    // rather than "Not stated".
    viewCount: 0,
    inquiryCount: 0,
    savedCount: 0,
    landlordLivesInProperty: input.landlordLivesInProperty,
    ...(input.videoUrl ? { videoUrl: input.videoUrl } : {}),
    ...(input.ceilingTypes.length > 0 ? { ceilingTypes: input.ceilingTypes } : {}),
    landlordLivesOnPremises: input.landlordLivesOnPremises,
    currentTenantsCount: input.currentTenantsCount,
    hasCaretaker: input.hasCaretaker,
    caretakerLivesOnPremises: input.caretakerLivesOnPremises,
    inspectionFeeTotal: 0,
    inspectionTransportFee: 0,
    inspectionServiceFee: 0,
    inspectionAgentCluster: null,
    inspectionPropertyCluster: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    // Standalone listing with no document uploaded yet. 'none' is inside the
    // owner allowlist in rules; 'inherited' would be rejected here because
    // there is no building to inherit from.
    ownershipDocStatus: 'none',
  }

  // The parent doc must be committed BEFORE the subdoc: the subdoc's write rule
  // reads the parent's landlordId with get(), which is not visible for a doc
  // created in the same batch. Same ordering as the Flutter service.
  const ref = await addDoc(collection(db, 'properties'), propertyData)

  await setDoc(doc(db, 'properties', ref.id, 'private', 'location'), {
    address: input.address,
    updatedAt: serverTimestamp(),
  })

  // Lifetime counter, only ever incremented — it decides whether the landlord
  // has already used their free first listing. Never fail the creation on it.
  try {
    await updateDoc(doc(db, 'users', uid), { totalListingsCreated: increment(1) })
  } catch {
    // Non-fatal, exactly as in the Flutter service.
  }

  // The activity feed is written by the client, not by a trigger — without this
  // a web-created listing never appears in the landlord's recent activity.
  await trackPropertyAdded(uid, ref.id, input.title)

  return ref.id
}

/** Uploads one image to the same Cloudinary cloud + unsigned preset the app uses. */
export async function uploadImage(file: File, uid: string): Promise<string> {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', preset ?? '')
  body.append('folder', `clearrent/properties/${uid}`)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: 'POST',
    body,
  })
  if (!res.ok) throw new Error(`Cloudinary upload failed (${res.status})`)

  const json = (await res.json()) as { secure_url?: string }
  if (!json.secure_url) throw new Error('Cloudinary returned no secure_url')
  return json.secure_url
}
