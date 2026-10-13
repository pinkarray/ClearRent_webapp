import { addDoc, collection, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore'
import { clientDb } from './firebase-client'

/**
 * The landlord's "recent activity" feed.
 *
 * These records are written by the CLIENT, not by a Cloud Function trigger -
 * `ActivityService` in the Flutter app does it. So anything the web does
 * silently misses the feed unless the web writes them too, which is exactly
 * what happened: web-created listings and web-booked inspections never showed
 * up on the landlord's phone.
 *
 * Field names and `type` values must match the app's, since the same feed
 * renders both.
 */

type ActivityType = 'propertyAdded' | 'payment' | 'inspection_request'

async function addActivity(fields: Record<string, unknown>): Promise<void> {
  try {
    await addDoc(collection(clientDb(), 'activities'), {
      ...fields,
      isRead: false,
      createdAt: serverTimestamp(),
    })
  } catch {
    // Never fail the user's actual action because the feed entry didn't land.
    // Same posture as the app, which logs and moves on.
  }
}

/**
 * Records a new listing. Deduped on (landlordId, propertyId, type) exactly as
 * the app does, so a retried create does not double-post.
 */
export async function trackPropertyAdded(
  landlordId: string,
  propertyId: string,
  propertyTitle: string,
): Promise<void> {
  try {
    const existing = await getDocs(
      query(
        collection(clientDb(), 'activities'),
        where('landlordId', '==', landlordId),
        where('propertyId', '==', propertyId),
        where('type', '==', 'propertyAdded' satisfies ActivityType),
        limit(1),
      ),
    )
    if (!existing.empty) return
  } catch {
    // If the dedup read fails, fall through and write - a duplicate entry is
    // better than a missing one.
  }

  await addActivity({
    landlordId,
    type: 'propertyAdded' satisfies ActivityType,
    title: 'Property Listed',
    subtitle: propertyTitle,
    propertyId,
    propertyTitle,
    actorId: landlordId,
    actorName: 'You',
  })
}

/**
 * Records a booking on the landlord's feed exactly as the app does
 * (inspection_service.dart): type 'inspection_request' with the request id,
 * which the app routes to Inspection Requests. Filed as an 'inquiry' before,
 * it opened a "message this person" sheet with no way to the request.
 */
export async function trackInspectionRequest(args: {
  landlordId: string
  propertyId: string
  propertyTitle: string
  tenantId: string
  tenantName: string
  requestId: string
  isVideo: boolean
}): Promise<void> {
  await addActivity({
    landlordId: args.landlordId,
    type: 'inspection_request' satisfies ActivityType,
    title: 'New Inspection Request',
    subtitle: args.isVideo
      ? `${args.tenantName} wants a video viewing of ${args.propertyTitle}`
      : `${args.tenantName} wants to inspect ${args.propertyTitle}`,
    propertyId: args.propertyId,
    propertyTitle: args.propertyTitle,
    actorId: args.tenantId,
    actorName: args.tenantName,
    relatedId: args.requestId,
  })
}

/** Records money received against a property. */
export async function trackPayment(args: {
  landlordId: string
  propertyId: string
  propertyTitle: string
  tenantId: string
  tenantName: string
  amount: number
}): Promise<void> {
  await addActivity({
    landlordId: args.landlordId,
    type: 'payment' satisfies ActivityType,
    title: 'Rent payment received',
    subtitle: `₦${args.amount.toLocaleString('en-NG')} from ${args.tenantName}`,
    propertyId: args.propertyId,
    propertyTitle: args.propertyTitle,
    actorId: args.tenantId,
    actorName: args.tenantName,
  })
}
