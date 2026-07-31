import { addDoc, collection, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore'
import { clientDb } from './firebase-client'

/**
 * The landlord's "recent activity" feed.
 *
 * These records are written by the CLIENT, not by a Cloud Function trigger —
 * `ActivityService` in the Flutter app does it. So anything the web does
 * silently misses the feed unless the web writes them too, which is exactly
 * what happened: web-created listings and web-booked inspections never showed
 * up on the landlord's phone.
 *
 * Field names and `type` values must match the app's, since the same feed
 * renders both.
 */

type ActivityType = 'propertyAdded' | 'inquiry' | 'payment'

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
    // If the dedup read fails, fall through and write — a duplicate entry is
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
 * Records a tenant's interest in a property. The app files an inspection
 * request under the 'inquiry' type, which is what the landlord's feed shows as
 * "New inquiry from …".
 */
export async function trackInquiry(args: {
  landlordId: string
  propertyId: string
  propertyTitle: string
  tenantId: string
  tenantName: string
}): Promise<void> {
  await addActivity({
    landlordId: args.landlordId,
    type: 'inquiry' satisfies ActivityType,
    title: `New inquiry from ${args.tenantName}`,
    subtitle: args.propertyTitle,
    propertyId: args.propertyId,
    propertyTitle: args.propertyTitle,
    actorId: args.tenantId,
    actorName: args.tenantName,
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
