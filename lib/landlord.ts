import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { clientDb } from './firebase-client'

/*
  Landlord-side reads.

  Every query here filters by `landlordId == uid`, and that is not stylistic:
  `firestore.rules` scopes `list` on transactions (1230), issues (1121) and
  activities to a party on the document. An unscoped read is rejected outright
  rather than returning a filtered set.

  Sorting is done in memory throughout. The composite indexes for
  `where(...) + orderBy('createdAt')` are not provisioned, and a missing index
  makes Firestore throw - which is how the app's Payments tab ended up
  permanently empty. The app does the same client-side sort for exactly this
  reason (`earnings_screen.dart:47`).
*/

export type Transaction = {
  id: string
  propertyId: string
  propertyTitle: string
  tenantId: string
  tenantName: string
  amount: number
  status: 'pending' | 'completed' | 'failed'
  reference: string
  createdAt: Date | null
}

export type Earnings = {
  total: number
  pending: number
  completed: number
  transactions: Transaction[]
}

function parseStatus(v: unknown): Transaction['status'] {
  return v === 'completed' || v === 'failed' ? v : 'pending'
}

export async function landlordEarnings(uid: string): Promise<Earnings> {
  const snap = await getDocs(
    query(collection(clientDb(), 'transactions'), where('landlordId', '==', uid)),
  )

  const transactions = snap.docs
    .map((d) => {
      const x = d.data()
      return {
        id: d.id,
        propertyId: (x.propertyId as string) ?? '',
        propertyTitle: (x.propertyTitle as string) ?? 'Unknown property',
        tenantId: (x.tenantId as string) ?? '',
        tenantName: (x.tenantName as string) ?? 'Unknown tenant',
        amount: (x.amount as number) ?? 0,
        status: parseStatus(x.status),
        reference: (x.reference as string) ?? '',
        createdAt: x.createdAt?.toDate?.() ?? null,
      }
    })
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))

  return {
    total: transactions.reduce((sum, t) => sum + t.amount, 0),
    pending: transactions
      .filter((t) => t.status === 'pending')
      .reduce((sum, t) => sum + t.amount, 0),
    completed: transactions
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0),
    transactions,
  }
}

export type Activity = {
  id: string
  type: string
  title: string
  message: string
  propertyId: string
  actorName: string
  isRead: boolean
  createdAt: Date | null
}

/** The landlord's feed: views, inquiries, issues, payment events. */
export async function landlordActivities(uid: string): Promise<Activity[]> {
  const snap = await getDocs(
    query(collection(clientDb(), 'activities'), where('landlordId', '==', uid)),
  )
  return snap.docs
    .map((d) => {
      const x = d.data()
      return {
        id: d.id,
        type: (x.type as string) ?? 'general',
        title: (x.title as string) ?? '',
        message: (x.message as string) ?? '',
        propertyId: (x.propertyId as string) ?? '',
        actorName: (x.actorName as string) ?? '',
        // Activities use `isRead`; notifications use `read`. Not interchangeable.
        isRead: x.isRead === true,
        createdAt: x.createdAt?.toDate?.() ?? null,
      }
    })
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

export type LandlordIssue = {
  id: string
  propertyId: string
  propertyTitle: string
  tenantName: string
  title: string
  description: string
  category: string
  priority: string
  status: string
  createdAt: Date | null
}

export async function landlordIssues(uid: string): Promise<LandlordIssue[]> {
  const snap = await getDocs(
    query(collection(clientDb(), 'issues'), where('landlordId', '==', uid)),
  )
  return snap.docs
    .map((d) => {
      const x = d.data()
      return {
        id: d.id,
        propertyId: (x.propertyId as string) ?? '',
        propertyTitle: (x.propertyTitle as string) ?? '(property)',
        tenantName: (x.tenantName as string) ?? 'Tenant',
        title: (x.title as string) ?? '',
        description: (x.description as string) ?? '',
        category: (x.category as string) ?? 'other',
        priority: (x.priority as string) ?? 'medium',
        status: (x.status as string) ?? 'open',
        createdAt: x.createdAt?.toDate?.() ?? null,
      }
    })
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

/**
 * Moves an issue along. The tenant's notification is fired by a Firestore
 * trigger, not from here — clients cannot create notifications at all
 * (`firestore.rules:1245`), and writing one would double up with the trigger.
 *
 * Mirrors `landlord_issues_screen.dart:463`, including the timestamp that goes
 * with each terminal status.
 */
export async function setIssueStatus(
  issueId: string,
  status: 'in_progress' | 'pending_confirmation' | 'resolved',
): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'issues', issueId), {
      status,
      updatedAt: serverTimestamp(),
      ...(status === 'pending_confirmation'
        ? { pendingConfirmationAt: serverTimestamp() }
        : {}),
      ...(status === 'resolved' ? { resolvedAt: serverTimestamp() } : {}),
    })
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not update that issue.'
  }
}
