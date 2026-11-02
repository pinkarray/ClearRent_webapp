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
import { getStorage, ref as storageRef, uploadBytes } from 'firebase/storage'
import { clientApp, clientDb } from './firebase-client'
import { trackPropertyAdded } from './activity'
import { getPricing } from './listing-fee'
import { stayPayload, type Stay } from './stay'
import { createBuilding } from './buildings'

/** One unit inside a building. Absent when the whole property is let. */
export type UnitInput = {
  /** An existing building to join; its ownership document covers this unit. */
  buildingId: string | null
  /** A building to create now, carrying the ownership document. */
  newBuilding: { name: string; structure: string } | null
  /** Derived from type + number, "Self Contain 2". */
  unitLabel: string
  floor: string
  /** 'private' | 'shared', kitchen and living room also 'none'. */
  bathroomAccess: string
  toiletAccess: string
  kitchenAccess: string
  livingRoomAccess: string
  /** The building the unit sits in: the site's structure, or on a compound the one picked. */
  unitBuildingStructure: string | null
  /** "A", "B" - only on a compound. */
  unitBuildingLabel: string | null
}

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
  /** 'unfurnished' | 'partly' | 'fully'. Required by the form. */
  furnishing: string
  /** How it is let. A furnished stay overrides rentFrequency to 'monthly'. */
  stay: Stay
  amenities: string[]
  rules: string[]
  landlordLivesInProperty: boolean
  landlordLivesOnPremises: boolean
  currentTenantsCount: number
  hasCaretaker: boolean
  caretakerLivesOnPremises: boolean
  /** A flat can mix ceiling types, so this is a list - matches the app. */
  ceilingTypes: string[]
  videoUrl: string | null
  unit: UnitInput | null
  /**
   * Proof of ownership - a C of O, deed of assignment, or other document.
   * Null only for a unit joining an existing building, which inherits that
   * building's document.
   *
   * REQUIRED otherwise, exactly as the app requires it (`add_property_screen.dart:1344`).
   * Web used to write `ownershipDocStatus: 'none'` and collect nothing, which
   * made every web listing a dead end: admin gates verify/reject on status
   * `'pending'`, so a `'none'` listing showed "No document uploaded" with no
   * action available, and could never be verified or published.
   */
  ownershipDocFile: File | null
  /** Matches the app's `_ownershipDocType`. */
  ownershipDocType: 'c_of_o' | 'deed' | 'other'
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
 *    adminReviewPropertyDoc - a listing is born unreviewed.
 *  - The exact address and coordinates never touch the parent doc; they go to
 *    `properties/{id}/private/location`, which rules gate to the owner, the
 *    assigned agent, an admin, or a tenant with an approved inspection.
 */
export async function createListing(uid: string, input: ListingInput): Promise<string> {
  const db = clientDb()
  const unit = input.unit
  const joining = !!unit?.buildingId

  // Uploaded BEFORE the property doc is written: storage rules make
  // `ownership/{uid}/{docId}` write-once (`resource == null`), so a failed
  // upload must not leave behind a listing claiming a document it never got.
  // The stored value is the PATH, not a download URL - the same as the app
  // (`property_service.dart:91`), which is what the admin viewer resolves.
  let ownershipDocPath: string | null = null
  if (!joining) {
    const file = input.ownershipDocFile
    if (!file) throw new Error('Attach proof of ownership.')
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'pdf'
    ownershipDocPath = `ownership/${uid}/cofo_${Date.now()}.${ext}`
    await uploadBytes(storageRef(getStorage(clientApp()), ownershipDocPath), file)
  }

  // A new building takes the document; the unit inherits it. Same order as the
  // app: building first, so the property can name it (rules check it is ours).
  let buildingId = unit?.buildingId ?? null
  if (unit?.newBuilding && ownershipDocPath) {
    buildingId = await createBuilding(uid, {
      name: unit.newBuilding.name,
      address: input.address,
      structure: unit.newBuilding.structure,
      ownershipDocUrl: ownershipDocPath,
      ownershipDocType: input.ownershipDocType,
    })
  }

  const userSnap = await getDoc(doc(db, 'users', uid))
  const userData = userSnap.data()
  const landlordName = (userData?.fullName as string | undefined) ?? 'Landlord'
  const landlordPhone = (userData?.phone as string | undefined) ?? ''
  // The flat viewing fee, stored on the listing as the app does. It was 0 here,
  // and a 0 handler share made every web-listed viewing unpayable to its handler.
  const pricing = await getPricing()

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
    // construction - the parent doc is readable by every signed-in user.
    city: input.city,
    state: input.state,
    lga: input.lga,
    rent: input.rent,
    rentFrequency: input.rentFrequency,
    agentFee: input.agentFee,
    cautionDeposit: input.cautionDeposit,
    cautionDepositRefundable: input.cautionDepositRefundable,
    furnishing: input.furnishing,
    ...stayPayload(input.stay),
    // Born hidden, as the app creates it; adminReviewPropertyDoc sets it true
    // on approval. `true` here put unreviewed web listings in front of agents
    // on Discover, which filters on availability alone.
    isAvailable: false,
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
    // The access fields are asked and stored only for a unit inside a
    // building, where every type can share (a self contain in a compound still
    // queues for the toilet). A whole property has nobody to share with, and
    // public pages gate the sharing rows on `grouped`, so omitting them there
    // shows nothing rather than "Not stated".
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
    inspectionFeeTotal: pricing.inspectionTotal,
    inspectionTransportFee: 0,
    inspectionServiceFee: pricing.inspectionHandler,
    inspectionAgentCluster: null,
    inspectionPropertyCluster: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    // A whole property is born awaiting review with its document attached;
    // 'verified' is the admin's to write, via adminReviewPropertyDoc. A unit
    // carries no document and reads its building's - rules insist on
    // 'inherited' and no doc fields for it.
    ...(buildingId && unit
      ? {
          buildingId,
          ownershipDocStatus: 'inherited',
          unitLabel: unit.unitLabel,
          ...(unit.floor ? { floor: unit.floor } : {}),
          bathroomAccess: unit.bathroomAccess,
          toiletAccess: unit.toiletAccess,
          kitchenAccess: unit.kitchenAccess,
          livingRoomAccess: unit.livingRoomAccess,
          ...(unit.unitBuildingStructure
            ? { unitBuildingStructure: unit.unitBuildingStructure }
            : {}),
          ...(unit.unitBuildingLabel ? { unitBuildingLabel: unit.unitBuildingLabel } : {}),
        }
      : {
          ownershipDocStatus: 'pending',
          ownershipDocUrl: ownershipDocPath,
          ownershipDocType: input.ownershipDocType,
        }),
  }

  // The parent doc must be committed BEFORE the subdoc: the subdoc's write rule
  // reads the parent's landlordId with get(), which is not visible for a doc
  // created in the same batch. Same ordering as the Flutter service.
  const ref = await addDoc(collection(db, 'properties'), propertyData)

  await setDoc(doc(db, 'properties', ref.id, 'private', 'location'), {
    address: input.address,
    updatedAt: serverTimestamp(),
  })

  // Lifetime counter, only ever incremented - it decides whether the landlord
  // has already used their free first listing. Never fail the creation on it.
  try {
    await updateDoc(doc(db, 'users', uid), { totalListingsCreated: increment(1) })
  } catch {
    // Non-fatal, exactly as in the Flutter service.
  }

  // The activity feed is written by the client, not by a trigger - without this
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
