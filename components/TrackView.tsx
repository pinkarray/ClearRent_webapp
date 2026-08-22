'use client'

import { useEffect, useRef } from 'react'
import { doc, increment, updateDoc } from 'firebase/firestore'
import { useAuth } from './AuthProvider'
import { clientDb } from '../lib/firebase-client'

/**
 * Counts one view of a listing.
 *
 * Web counted NONE. `viewCount` was written once, as 0, at creation and never
 * touched again — so every view from public browse was invisible and the
 * landlord's "Total Views" only ever reflected the app.
 *
 * Mirrors the app's rule (`property_detail_screen.dart:314`): only a signed-in
 * TENANT. That keeps the number meaning the same thing on both surfaces.
 *
 * The app also checks `!_isOwner`; here the accountType gate already covers it,
 * because an owner is a landlord and never a tenant. This page deliberately
 * cannot see `landlordId` — the public projection in `lib/property.ts` withholds
 * it and that projection IS the access control, so an explicit owner check
 * would mean leaking the owner to every visitor to save a check we already have.
 *
 * Anonymous browsers are not counted — `firestore.rules` requires auth for the
 * counter update, and counting them would need a server route. Worth deciding
 * separately; it changes what the number means, rather than fixing a bug.
 */
export default function TrackView({ propertyId }: { propertyId: string }) {
  const { user, profile } = useAuth()
  // React 18 mounts twice in development; without this the same visit counts
  // two views.
  const counted = useRef(false)

  useEffect(() => {
    if (counted.current) return
    if (!user || !profile) return
    if (profile.accountType !== 'tenant') return

    counted.current = true
    // Best effort: a view counter must never surface an error over a listing.
    void updateDoc(doc(clientDb(), 'properties', propertyId), {
      viewCount: increment(1),
    }).catch(() => {})
  }, [user, profile, propertyId])

  return null
}
