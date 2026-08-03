import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { clientDb } from './firebase-client'

/*
  Mirrors `report_issue_screen.dart:203` field for field. The category and
  priority vocabularies are closed sets shared with the app and the landlord's
  issue queue — inventing a new value here would render as a blank chip there.

  `firestore.rules:1121` scopes list access to a party on the issue, so the
  query below must filter by tenantId; an unscoped read is rejected outright.
*/

export const ISSUE_CATEGORIES = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'structural', label: 'Structural' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'pest', label: 'Pest control' },
  { value: 'security', label: 'Security' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'other', label: 'Other' },
] as const

export const ISSUE_PRIORITIES = [
  { value: 'low', label: 'Low', desc: 'Can wait a few days' },
  { value: 'medium', label: 'Medium', desc: 'Needs attention soon' },
  { value: 'high', label: 'High', desc: 'Urgent, affects daily life' },
] as const

export type Issue = {
  id: string
  propertyId: string
  propertyTitle: string
  title: string
  description: string
  category: string
  priority: string
  status: string
  createdAt: Date | null
}

export type ReportIssueInput = {
  propertyId: string
  propertyTitle: string
  tenantId: string
  tenantName: string
  landlordId: string
  landlordName: string
  title: string
  description: string
  category: string
  priority: string
}

/** Returns null on success, or a message to show the user. */
export async function reportIssue(input: ReportIssueInput): Promise<string | null> {
  try {
    await addDoc(collection(clientDb(), 'issues'), {
      // The app writes an empty rentalId here too — issues are keyed to the
      // property, not the rental term.
      rentalId: '',
      propertyId: input.propertyId,
      tenantId: input.tenantId,
      landlordId: input.landlordId,
      propertyTitle: input.propertyTitle,
      tenantName: input.tenantName,
      landlordName: input.landlordName,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      priority: input.priority,
      // Photo upload is app-only for now; the field must still exist so the
      // landlord's gallery does not read undefined.
      images: [],
      status: 'open',
      reportedBy: input.tenantId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // The landlord's activity feed is how they learn about this — the app
    // writes the same record, so both surfaces produce one feed.
    await addDoc(collection(clientDb(), 'activities'), {
      landlordId: input.landlordId,
      type: 'issue_reported',
      title: 'New Issue Reported',
      message: `${input.tenantName} reported a ${input.category} issue at ${input.propertyTitle}.`,
      propertyId: input.propertyId,
      actorId: input.tenantId,
      actorName: input.tenantName,
      isRead: false,
      createdAt: serverTimestamp(),
    })
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not report that issue.'
  }
}

function tenantIssuesQuery(tenantId: string) {
  return query(
    collection(clientDb(), 'issues'),
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc'),
  )
}

function toIssue(d: QueryDocumentSnapshot): Issue {
  const x = d.data()
  return {
    id: d.id,
    propertyId: (x.propertyId as string) ?? '',
    propertyTitle: (x.propertyTitle as string) ?? '(property)',
    title: (x.title as string) ?? '',
    description: (x.description as string) ?? '',
    category: (x.category as string) ?? 'other',
    priority: (x.priority as string) ?? 'medium',
    status: (x.status as string) ?? 'open',
    createdAt: x.createdAt?.toDate?.() ?? null,
  }
}

/**
 * The tenant's own issues, live.
 *
 * The landlord resolves an issue from their own queue, so the tenant who
 * reported it is exactly the party with no reason to reload — a one-time read
 * left them staring at "open" long after it was fixed.
 *
 * Returns the unsubscribe function.
 */
export function watchTenantIssues(
  tenantId: string,
  onChange: (rows: Issue[]) => void,
): () => void {
  return onSnapshot(tenantIssuesQuery(tenantId), (snap) =>
    onChange(snap.docs.map(toIssue)),
  )
}

/**
 * The tenant closes the loop after the landlord says it is fixed.
 *
 * An issue does NOT go straight to resolved on the landlord's word — it lands
 * on 'pending_confirmation' and waits for the person who actually lives with
 * the problem. `issuePendingConfirmationReminders` nags from the server if
 * they go quiet. Web had no action for this step, so a tenant could see
 * "pending confirmation" and had no way to confirm anything.
 */
export async function confirmIssueResolved(issueId: string): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'issues', issueId), {
      status: 'resolved',
      resolvedAt: serverTimestamp(),
      tenantConfirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not confirm that fix.'
  }
}

/**
 * The other answer: it is not actually fixed. Sends it back to the landlord's
 * In Progress list with the tenant's reason attached, rather than leaving them
 * to guess why the confirmation never came.
 */
export async function disputeIssueResolution(
  issueId: string,
  reason: string,
): Promise<string | null> {
  if (!reason.trim()) return 'Say what is still wrong.'
  try {
    await updateDoc(doc(clientDb(), 'issues', issueId), {
      status: 'in_progress',
      tenantDisputeReason: reason.trim(),
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not send that back.'
  }
}
