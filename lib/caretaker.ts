import { getFunctions, httpsCallable } from 'firebase/functions'
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { clientApp, clientDb, initAppCheck } from './firebase-client'

/**
 * Caretakers: who manages a listing day to day.
 *
 * A caretaker stands in for the landlord on the management surfaces — issues,
 * maintenance, and the tenant thread — and nowhere near the money. They can
 * never change rent, payout details, agreement terms or a deposit settlement,
 * because the rules give them no clause at all on the collections those live
 * in, not because a guard says no.
 *
 * `properties.caretakerId` is written ONLY by the Cloud Functions on the admin
 * SDK. The owner-update rule lets a landlord CLEAR it (revoking is theirs to
 * do) and never set it, so an appointment always requires the invitee to agree.
 * Everything here therefore goes through a callable — there is no client write.
 */

export type CaretakerInvite = {
  id: string
  landlordId: string
  landlordName: string
  caretakerId: string
  caretakerName: string
  propertyIds: string[]
  propertyTitles: string[]
  status: 'pending' | 'accepted' | 'declined' | 'revoked'
}

function fns() {
  initAppCheck()
  return getFunctions(clientApp(), 'us-central1')
}

function toInvite(id: string, x: Record<string, unknown>): CaretakerInvite {
  return {
    id,
    landlordId: (x.landlordId as string) ?? '',
    landlordName: (x.landlordName as string) ?? 'Your landlord',
    caretakerId: (x.caretakerId as string) ?? '',
    caretakerName: (x.caretakerName as string) ?? 'Your caretaker',
    // `appliedPropertyIds` is what acceptance ACTUALLY wrote — a unit can drop
    // out between invite and accept (sold, deleted, re-caretakered), so an
    // accepted invite describes itself by what landed, not what was asked for.
    propertyIds: ((x.appliedPropertyIds ?? x.propertyIds ?? []) as string[]) ?? [],
    propertyTitles: ((x.propertyTitles ?? []) as string[]) ?? [],
    status: (x.status as CaretakerInvite['status']) ?? 'pending',
  }
}

/** Every caretaker arrangement this landlord has, in any state. */
export async function invitesForLandlord(uid: string): Promise<CaretakerInvite[]> {
  const snap = await getDocs(
    query(collection(clientDb(), 'caretaker_invites'), where('landlordId', '==', uid)),
  )
  return snap.docs.map((d) => toInvite(d.id, d.data()))
}

/** Every invitation naming this user as the caretaker, in any state. */
export async function myInvites(uid: string): Promise<CaretakerInvite[]> {
  const snap = await getDocs(
    query(collection(clientDb(), 'caretaker_invites'), where('caretakerId', '==', uid)),
  )
  return snap.docs.map((d) => toInvite(d.id, d.data()))
}

/**
 * Live version of {@link myInvites}, for the banner that is a caretaker's only
 * entry point. An invitation arrives because a LANDLORD acted, so it is by
 * definition never something this user's own navigation would surface — a
 * one-time read leaves them staring at a page that will not change.
 *
 * Returns the unsubscribe function.
 */
export function watchMyInvites(
  uid: string,
  onChange: (rows: CaretakerInvite[]) => void,
): () => void {
  return onSnapshot(
    query(collection(clientDb(), 'caretaker_invites'), where('caretakerId', '==', uid)),
    (snap) => onChange(snap.docs.map((d) => toInvite(d.id, d.data()))),
  )
}

/** Titles of the properties this user currently manages, live. */
export function watchManagedProperties(
  uid: string,
  onChange: (rows: { id: string; title: string }[]) => void,
): () => void {
  return onSnapshot(
    query(collection(clientDb(), 'properties'), where('caretakerId', '==', uid)),
    (snap) =>
      onChange(
        snap.docs.map((d) => ({
          id: d.id,
          title: (d.data().title as string) ?? 'Untitled property',
        })),
      ),
  )
}

/**
 * Who does this number belong to? Called before {@link inviteCaretaker} so the
 * landlord confirms a NAME rather than trusting the digits they typed — one
 * mistyped digit would otherwise appoint a real stranger to a tenant's issues
 * and messages, and they could simply accept.
 *
 * Rate-limited server-side, and it verifies the caller owns the units named
 * before it resolves the phone, so it cannot be used as a phone-to-name lookup.
 */
export async function lookupCaretakerCandidate(
  phone: string,
  propertyIds: string[],
): Promise<{ caretakerName?: string; error?: string }> {
  try {
    const fn = httpsCallable<
      { phone: string; propertyIds: string[] },
      { caretakerName: string; unitCount: number }
    >(fns(), 'lookupCaretakerCandidate')
    const res = await fn({ phone: phone.trim(), propertyIds })
    return { caretakerName: res.data.caretakerName }
  } catch (err) {
    return { error: messageFrom(err, 'Could not check that number.') }
  }
}

/** Returns null on success, or a message to show the landlord. */
export async function inviteCaretaker(
  phone: string,
  propertyIds: string[],
  buildingId?: string | null,
): Promise<string | null> {
  try {
    const fn = httpsCallable<
      { phone: string; propertyIds: string[]; buildingId?: string | null },
      { success: boolean }
    >(fns(), 'inviteCaretaker')
    await fn({ phone: phone.trim(), propertyIds, buildingId: buildingId ?? null })
    return null
  } catch (err) {
    return messageFrom(err, 'Could not send that invitation.')
  }
}

/** Accept or decline an invitation. Returns null on success. */
export async function respondToInvite(
  inviteId: string,
  accept: boolean,
): Promise<string | null> {
  try {
    const fn = httpsCallable<
      { inviteId: string; action: 'accept' | 'decline' },
      { success: boolean }
    >(fns(), 'respondToCaretakerInvite')
    await fn({ inviteId, action: accept ? 'accept' : 'decline' })
    return null
  } catch (err) {
    return messageFrom(err, 'Could not record your answer.')
  }
}

/**
 * End an arrangement. Either party may call it: the landlord removes the
 * caretaker, or the caretaker steps back. Clearing `caretakerId` directly would
 * leave the other units on the same invite, and the tenant threads, behind.
 */
export async function revokeCaretaker(
  inviteId: string,
  reason?: string,
): Promise<string | null> {
  try {
    const fn = httpsCallable<{ inviteId: string; reason?: string }, { success: boolean }>(
      fns(),
      'revokeCaretaker',
    )
    await fn({ inviteId, reason })
    return null
  } catch (err) {
    return messageFrom(err, 'Could not remove the caretaker.')
  }
}

/**
 * The callables' messages are written for the end user, so surface them rather
 * than a generic string wherever one came back.
 */
function messageFrom(err: unknown, fallback: string): string {
  const message = (err as { message?: string })?.message
  return message && message.length > 0 ? message : fallback
}
