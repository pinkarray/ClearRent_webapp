import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { clientDb } from './firebase-client'

/*
  Mirrors `conversation_service.dart`.

  Rules worth knowing before changing anything here (`firestore.rules:471`):
  - `list` requires the caller be a participant, so the inbox query MUST filter
    `participants array-contains uid`. An unscoped read is rejected.
  - Sending a message requires the sender be an ACTIVE participant AND
    `isVerified()`. An unverified tenant gets `permission-denied` on send, not
    on open - so the composer is disabled up front rather than failing at the
    end.
  - Messages carry `timestamp`, not `createdAt`. The ordering index is on
    `timestamp` ascending.
*/

export type Conversation = {
  id: string
  propertyId: string
  propertyTitle: string
  landlordId: string
  landlordName: string
  tenantId: string
  tenantName: string
  agentId: string
  agentName: string
  participants: string[]
  lastMessage: string
  lastMessageTime: Date | null
  lastMessageSenderId: string
  unread: number
}

export type Message = {
  id: string
  senderId: string
  senderName: string
  senderRole: string
  text: string
  imageUrl: string | null
  timestamp: Date | null
  /** Set once the author rewrote it; null means never edited. */
  editedAt: Date | null
  /** Soft delete — the doc survives with its text blanked. */
  deleted: boolean
  /** User ids the author @-mentioned. */
  mentions: string[]
  isRead: boolean
}

function toConversation(id: string, x: Record<string, unknown>, uid: string): Conversation {
  const unreadCounts = (x.unreadCounts as Record<string, number> | undefined) ?? {}
  return {
    id,
    propertyId: (x.propertyId as string) ?? '',
    propertyTitle: (x.propertyTitle as string) ?? '(property)',
    landlordId: (x.landlordId as string) ?? '',
    landlordName: (x.landlordName as string) ?? '',
    tenantId: (x.tenantId as string) ?? '',
    tenantName: (x.tenantName as string) ?? '',
    agentId: (x.agentId as string) ?? '',
    agentName: (x.agentName as string) ?? '',
    participants: Array.isArray(x.participants)
      ? x.participants.filter((p): p is string => typeof p === 'string')
      : [],
    lastMessage: (x.lastMessage as string) ?? '',
    lastMessageTime: (x.lastMessageTime as Timestamp | undefined)?.toDate?.() ?? null,
    lastMessageSenderId: (x.lastMessageSenderId as string) ?? '',
    unread: unreadCounts[uid] ?? 0,
  }
}

function myConversationsQuery(uid: string) {
  return query(
    collection(clientDb(), 'conversations'),
    where('participants', 'array-contains', uid),
  )
}

/**
 * Sorted newest-first in memory rather than by `orderBy`, because pairing
 * array-contains with an orderBy needs a composite index.
 */
function sortConversations(rows: Conversation[]): Conversation[] {
  return rows.sort(
    (a, b) => (b.lastMessageTime?.getTime() ?? 0) - (a.lastMessageTime?.getTime() ?? 0),
  )
}

/**
 * The inbox, live.
 *
 * The thread itself was already realtime, but the list around it was not — so
 * a conversation someone else started, and every unread count, only appeared
 * if you happened to navigate. Both are things the OTHER party changes.
 *
 * Returns the unsubscribe function.
 */
export function watchMyConversations(
  uid: string,
  onChange: (rows: Conversation[]) => void,
): () => void {
  return onSnapshot(myConversationsQuery(uid), (snap) =>
    onChange(sortConversations(snap.docs.map((d) => toConversation(d.id, d.data(), uid)))),
  )
}

export async function getConversation(id: string, uid: string): Promise<Conversation | null> {
  const snap = await getDoc(doc(clientDb(), 'conversations', id))
  if (!snap.exists()) return null
  return toConversation(snap.id, snap.data(), uid)
}

/**
 * Live message stream. Chat is the one screen where polling is visibly wrong,
 * so this is the only realtime listener on the web surface.
 */
export function watchMessages(
  conversationId: string,
  onChange: (messages: Message[]) => void,
): () => void {
  return onSnapshot(
    query(
      collection(clientDb(), 'conversations', conversationId, 'messages'),
      orderBy('timestamp', 'asc'),
    ),
    (snap) => {
      onChange(
        snap.docs.map((d) => {
          const x = d.data()
          return {
            id: d.id,
            senderId: (x.senderId as string) ?? '',
            senderName: (x.senderName as string) ?? '',
            senderRole: (x.senderRole as string) ?? '',
            text: (x.text as string) ?? '',
            imageUrl: (x.imageUrl as string) ?? null,
            timestamp: (x.timestamp as Timestamp | undefined)?.toDate?.() ?? null,
            editedAt: (x.editedAt as Timestamp | undefined)?.toDate?.() ?? null,
            deleted: x.deleted === true,
            mentions: Array.isArray(x.mentions)
              ? x.mentions.filter((m): m is string => typeof m === 'string')
              : [],
            isRead: x.isRead === true,
          }
        }),
      )
    },
  )
}

/**
 * Receipt everything the other side sent, so their second tick turns.
 *
 * The app's `markConversationAsRead` did this and web did not, which is half
 * of why a read message stayed on one tick: the reader's screen showed it, but
 * nothing ever wrote the flag back. Called on every stream frame, not just on
 * open, so a message that lands while the thread is already on screen is
 * receipted too.
 *
 * Best-effort — a failed receipt is never worth surfacing to the reader.
 */
export async function markMessagesRead(
  conversationId: string,
  uid: string,
  messages: Message[],
): Promise<void> {
  const unread = messages.filter((m) => !m.isRead && m.senderId !== uid)
  if (unread.length === 0) return

  await Promise.all(
    unread.map((m) =>
      updateDoc(
        doc(clientDb(), 'conversations', conversationId, 'messages', m.id),
        { isRead: true },
      ).catch(() => {}),
    ),
  )
}

/**
 * Rewrite the text of a message the caller sent.
 *
 * The rules accept only `text` / `editedAt` / `mentions` from the author
 * (`firestore.rules`, `isAuthorEdit`), so adding any other field here fails
 * the whole write rather than being ignored.
 */
export async function editMessage(
  conversationId: string,
  messageId: string,
  text: string,
  mentions: string[] = [],
): Promise<string | null> {
  const trimmed = text.trim()
  if (!trimmed) return 'A message cannot be empty.'
  try {
    await updateDoc(
      doc(clientDb(), 'conversations', conversationId, 'messages', messageId),
      { text: trimmed, editedAt: Timestamp.now(), mentions },
    )
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not edit that message.'
  }
}

/**
 * Soft-delete a message the caller sent. The text must be blanked — the rules
 * require it, because a `deleted` flag over intact text leaves the message
 * readable to anything reading the document directly.
 */
export async function deleteMessage(
  conversationId: string,
  messageId: string,
): Promise<string | null> {
  try {
    await updateDoc(
      doc(clientDb(), 'conversations', conversationId, 'messages', messageId),
      { text: '', deleted: true, deletedAt: Timestamp.now(), mentions: [] },
    )
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not delete that message.'
  }
}

/**
 * Keep the inbox preview honest after an edit or delete — without it the list
 * would still show the text the author just replaced or removed.
 *
 * Deliberately does NOT touch `lastMessageTime` or the unread counts: editing
 * is not a new message and must not re-badge the thread for the other party.
 */
export async function patchConversationPreview(
  conversationId: string,
  preview: string,
): Promise<void> {
  try {
    await updateDoc(doc(clientDb(), 'conversations', conversationId), {
      lastMessage: preview,
    })
  } catch {
    // A stale preview is not worth surfacing.
  }
}

/** Returns null on success, or a message to show the sender. */
export async function sendMessage(
  conversationId: string,
  sender: { uid: string; name: string; role: string },
  text: string,
  mentions: string[] = [],
): Promise<string | null> {
  const trimmed = text.trim()
  if (!trimmed) return null

  try {
    const conversationRef = doc(clientDb(), 'conversations', conversationId)
    await addDoc(collection(conversationRef, 'messages'), {
      conversationId,
      senderId: sender.uid,
      senderName: sender.name,
      senderRole: sender.role,
      text: trimmed,
      timestamp: Timestamp.now(),
      isRead: false,
      ...(mentions.length > 0 ? { mentions } : {}),
    })

    // The inbox reads these, and the app writes them on every send. Skipping it
    // would leave the other party's list showing a stale preview and no badge.
    const snap = await getDoc(conversationRef)
    const participants = (snap.data()?.participants as string[] | undefined) ?? []
    const bumps: Record<string, unknown> = {
      lastMessage: trimmed,
      lastMessageTime: Timestamp.now(),
      lastMessageSenderId: sender.uid,
    }
    for (const p of participants) {
      if (p !== sender.uid) bumps[`unreadCounts.${p}`] = increment(1)
    }
    await updateDoc(conversationRef, bumps)
    return null
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    if (code === 'permission-denied') {
      return 'Messaging requires a verified account. Complete verification first.'
    }
    return err instanceof Error ? err.message : 'Could not send that message.'
  }
}

export async function clearUnread(conversationId: string, uid: string): Promise<void> {
  try {
    await updateDoc(doc(clientDb(), 'conversations', conversationId), {
      [`unreadCounts.${uid}`]: 0,
    })
  } catch {
    // A failed badge reset is not worth interrupting the conversation for.
  }
}

/**
 * The agent → landlord pitch thread, mirroring
 * `conversation_service.dart:871`.
 *
 * Deduped on (landlordId, agentId, conversationType) so an agent pitching the
 * same landlord about a second property reuses the existing thread rather than
 * opening a parallel one — the pitch is about the agent, not the property,
 * which is why `propertyId` is deliberately empty.
 *
 * Both parties must be verified. The app checks this client-side before
 * creating; the rules enforce it on the first message either way, so an
 * unverified agent gets a thread they cannot send in. Checked here too, so the
 * failure is explained rather than silent.
 */
export async function getOrCreatePitchConversation(
  landlordId: string,
  agent: { uid: string; name: string },
): Promise<{ id: string } | { error: string }> {
  if (!landlordId) return { error: 'That listing has no landlord on it.' }

  try {
    const existing = await getDocs(
      query(
        collection(clientDb(), 'conversations'),
        where('landlordId', '==', landlordId),
        where('agentId', '==', agent.uid),
        where('conversationType', '==', 'agent_pitch'),
      ),
    )
    if (!existing.empty) return { id: existing.docs[0].id }

    const landlordSnap = await getDoc(doc(clientDb(), 'users', landlordId))
    const landlord = landlordSnap.data()
    if (!landlord) return { error: 'Could not find that landlord.' }
    if (landlord.verificationStatus !== 'verified') {
      return { error: 'That landlord is not verified yet, so messaging is closed.' }
    }

    const ref = await addDoc(collection(clientDb(), 'conversations'), {
      propertyId: '',
      propertyTitle: 'Agent Services Inquiry',
      propertyImage: '',
      landlordId,
      landlordName: (landlord.fullName as string) ?? 'Landlord',
      tenantId: '',
      tenantName: '',
      agentId: agent.uid,
      agentName: agent.name,
      participants: [landlordId, agent.uid],
      lastMessage: '',
      lastMessageTime: Timestamp.now(),
      lastMessageSenderId: '',
      unreadCounts: { [landlordId]: 0, [agent.uid]: 0 },
      conversationType: 'agent_pitch',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return { id: ref.id }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not start that conversation.',
    }
  }
}

/**
 * The tenant ↔ landlord thread about a specific property, mirroring
 * `conversation_service.dart:190`.
 *
 * Deduped on the (propertyId, landlordId, tenantId) tuple. The lookup queries
 * by the CALLER's own participation rather than by that tuple directly,
 * because the tightened list rule only accepts owner-scoped shapes — the
 * caller's own conversation set is small, so filtering in memory is cheap and
 * needs no composite index.
 *
 * Note this carries NO conversationType: the app's property conversations
 * leave it unset, and setting one here would make the two surfaces stop
 * deduping against each other and open parallel threads for one tenancy.
 */
export async function getOrCreatePropertyConversation(input: {
  propertyId: string
  propertyTitle: string
  propertyImage?: string
  landlordId: string
  landlordName: string
  tenantId: string
  tenantName: string
}): Promise<{ id: string } | { error: string }> {
  const { propertyId, landlordId, tenantId } = input
  if (!landlordId || !tenantId) return { error: 'Missing a party on this tenancy.' }

  try {
    const mine = await getDocs(
      query(
        collection(clientDb(), 'conversations'),
        where('participants', 'array-contains', tenantId),
      ),
    )
    const match = mine.docs.find((d) => {
      const x = d.data()
      return (
        x.propertyId === propertyId &&
        x.landlordId === landlordId &&
        x.tenantId === tenantId
      )
    })
    if (match) return { id: match.id }

    const ref = await addDoc(collection(clientDb(), 'conversations'), {
      propertyId,
      propertyTitle: input.propertyTitle,
      propertyImage: input.propertyImage ?? '',
      landlordId,
      landlordName: input.landlordName,
      tenantId,
      tenantName: input.tenantName,
      agentId: '',
      agentName: '',
      participants: [landlordId, tenantId],
      lastMessage: '',
      lastMessageTime: Timestamp.now(),
      lastMessageSenderId: '',
      unreadCounts: { [landlordId]: 0, [tenantId]: 0 },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return { id: ref.id }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not open that conversation.',
    }
  }
}

/**
 * Someone on the thread who can be @-mentioned.
 *
 * `handle` is a single token — the parser reads the word after '@' and full
 * names contain spaces — so it is the person's first name, falling back to
 * their role. Mirrors `_MentionTarget` in `chat_screen.dart`; the two must
 * agree or a mention typed on one surface won't highlight on the other.
 */
export type MentionTarget = {
  uid: string
  handle: string
  fullName: string
  role: string
}

export function mentionTargets(c: Conversation, uid: string): MentionTarget[] {
  const raw = [
    { uid: c.landlordId, name: c.landlordName, role: 'Landlord' },
    { uid: c.tenantId, name: c.tenantName, role: 'Tenant' },
    { uid: c.agentId, name: c.agentName, role: 'Agent' },
  ].filter((e) => e.uid && e.uid !== uid)

  const firstName = (name: string) =>
    (name.trim().split(/\s+/)[0] ?? '').replace(/\W/g, '')

  const handles = raw.map((e) => firstName(e.name) || e.role)

  return raw.map((e, i) => ({
    uid: e.uid,
    // Two people sharing a first name would otherwise answer to one handle.
    handle:
      handles.filter((h) => h === handles[i]).length > 1
        ? e.name.replace(/\W/g, '')
        : handles[i],
    fullName: e.name || e.role,
    role: e.role,
  }))
}

/** Escape a handle for use inside a RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Which handles actually survive in the text being sent. Resolved from the
 * final string rather than from what was clicked, so a mention the user typed
 * over or deleted doesn't ship a phantom uid.
 */
export function resolveMentions(text: string, targets: MentionTarget[]): string[] {
  return targets
    .filter((t) => new RegExp(`@${escapeRe(t.handle)}\\b`, 'i').test(text))
    .map((t) => t.uid)
}

/**
 * Split message text into plain and mentioned runs for rendering.
 *
 * Derived from the text against the thread's CURRENT members rather than from
 * the stored `mentions` ids, so an old message still reads correctly and no
 * stale span gets highlighted.
 */
export function splitMentions(
  text: string,
  targets: MentionTarget[],
): { text: string; mention: boolean }[] {
  if (targets.length === 0 || !text.includes('@')) return [{ text, mention: false }]

  const pattern = new RegExp(`@(${targets.map((t) => escapeRe(t.handle)).join('|')})\\b`, 'gi')
  const parts: { text: string; mention: boolean }[] = []
  let cursor = 0
  for (const m of text.matchAll(pattern)) {
    const start = m.index ?? 0
    if (start > cursor) parts.push({ text: text.slice(cursor, start), mention: false })
    parts.push({ text: m[0], mention: true })
    cursor = start + m[0].length
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), mention: false })
  return parts
}

/** Who the other side is, for the inbox row and the thread header. */
export function counterparty(c: Conversation, uid: string): string {
  // A pitch thread has no tenant — it is the agent and the landlord.
  if (c.agentId === uid) return c.landlordName || 'Landlord'
  if (c.landlordId === uid) return c.agentName || c.tenantName || 'Tenant'
  if (c.tenantId === uid) return c.agentId ? c.agentName || c.landlordName : c.landlordName
  return c.tenantName || 'Tenant'
}
