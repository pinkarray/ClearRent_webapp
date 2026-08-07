'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '../../../../components/AuthProvider'
import { useFillViewport } from '../../../../lib/use-fill-viewport'
import {
  clearUnread,
  counterparty,
  deleteMessage,
  editMessage,
  getConversation,
  markMessagesRead,
  mentionTargets,
  patchConversationPreview,
  resolveMentions,
  sendMessage,
  splitMentions,
  watchMessages,
  type Conversation,
  type MentionTarget,
  type Message,
} from '../../../../lib/chat'

export default function ThreadPage() {
  const { user, profile } = useAuth()
  const params = useParams<{ id: string }>()
  const [conversation, setConversation] = useState<Conversation | null | 'missing'>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Non-null while the composer is rewriting an existing message.
  const [editingId, setEditingId] = useState<string | null>(null)
  // Candidates offered while an '@' is being typed; empty hides the picker.
  const [mentionMatches, setMentionMatches] = useState<MentionTarget[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const shellRef = useFillViewport<HTMLDivElement>()

  const targets =
    conversation && conversation !== 'missing' && user
      ? mentionTargets(conversation, user.uid)
      : []

  /**
   * Matches the textarea's height to its content, capped by max-h-32 in the
   * class list. Reset to 'auto' first or the box can only ever grow — a
   * scrollHeight read against an already-tall element never shrinks.
   */
  function grow() {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const c = await getConversation(params.id, user.uid)
      setConversation(c ?? 'missing')
      if (c) await clearUnread(params.id, user.uid)
    })()
  }, [user, params.id])

  useEffect(() => {
    if (!user || conversation === null || conversation === 'missing') return
    return watchMessages(params.id, setMessages)
  }, [user, conversation, params.id])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  // Receipt on every frame, not just on open, so a message arriving while the
  // thread is already on screen still turns the sender's second tick.
  useEffect(() => {
    if (!user || messages.length === 0) return
    void markMessagesRead(params.id, user.uid, messages)
  }, [user, params.id, messages])

  /**
   * Recompute the mention picker from the caret. Only fires on an '@' that
   * starts a word, so an email address mid-sentence doesn't open it, and only
   * while the token after it has no whitespace — handles are single words.
   */
  function syncMentions(value: string, caret: number) {
    const before = value.slice(0, caret)
    const at = before.lastIndexOf('@')
    if (at < 0 || (at > 0 && before[at - 1].trim() !== '')) {
      setMentionMatches([])
      return
    }
    const q = before.slice(at + 1)
    if (/\s/.test(q)) {
      setMentionMatches([])
      return
    }
    const hits = targets.filter((t) => t.handle.toLowerCase().startsWith(q.toLowerCase()))
    // An exact, complete handle needs no picker — the user is done typing it.
    const done = hits.length === 1 && hits[0].handle.toLowerCase() === q.toLowerCase()
    setMentionMatches(done ? [] : hits)
  }

  /** Replace the partial "@que" at the caret with the chosen handle. */
  function pickMention(target: MentionTarget) {
    const el = inputRef.current
    const caret = el?.selectionStart ?? text.length
    const at = text.slice(0, caret).lastIndexOf('@')
    if (at < 0) return
    const replacement = `@${target.handle} `
    const next = text.slice(0, at) + replacement + text.slice(caret)
    setText(next)
    setMentionMatches([])
    // Put the caret after the inserted handle rather than at the end of a
    // message the user may still be editing the middle of.
    requestAnimationFrame(() => {
      const pos = at + replacement.length
      el?.focus()
      el?.setSelectionRange(pos, pos)
    })
  }

  function startEditing(m: Message) {
    setEditingId(m.id)
    setText(m.text)
    setMentionMatches([])
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      grow()
    })
  }

  function cancelEditing() {
    setEditingId(null)
    setText('')
    setMentionMatches([])
    if (inputRef.current) inputRef.current.style.height = 'auto'
  }

  async function remove(m: Message) {
    if (!confirm('Delete this message for everyone in the chat?')) return
    if (editingId === m.id) cancelEditing()
    setError(null)
    const err = await deleteMessage(params.id, m.id)
    if (err) {
      setError(err)
      return
    }
    // Keep the inbox preview honest — otherwise the list still shows the text
    // that was just deleted.
    if (messages[messages.length - 1]?.id === m.id) {
      await patchConversationPreview(params.id, 'Message deleted')
    }
  }

  async function send(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!user || !text.trim() || busy) return
    setError(null)
    setBusy(true)

    const isLast = messages[messages.length - 1]?.id === editingId
    const err = editingId
      ? await editMessage(params.id, editingId, text, resolveMentions(text, targets))
      : await sendMessage(
          params.id,
          {
            uid: user.uid,
            name: profile?.fullName ?? 'You',
            role: profile?.accountType ?? '',
          },
          text,
          resolveMentions(text, targets),
        )
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    if (editingId && isLast) await patchConversationPreview(params.id, text.trim())

    setEditingId(null)
    setMentionMatches([])
    setText('')
    // Collapse back to one line; the height was set inline, so clearing the
    // value alone would leave the box as tall as the sent message.
    if (inputRef.current) inputRef.current.style.height = 'auto'
  }

  if (!user) return null
  if (conversation === null) return <p className="text-sm text-content-secondary">Loading…</p>

  if (conversation === 'missing') {
    return (
      <div className="card p-8 text-center">
        <p className="text-content-secondary">That conversation is not available.</p>
        <Link
          href="/dashboard/messages"
          className="btn-ghost mt-5 inline-block px-6 py-3 no-underline"
        >
          Back to messages
        </Link>
      </div>
    )
  }

  // The rules require a verified sender (`firestore.rules:538`), so the composer
  // says so up front instead of letting the send fail with permission-denied.
  const canSend = profile?.verificationStatus === 'verified'

  return (
    /*
      A thread is a full-height column, not normal flowing content: the message
      list takes whatever space is left and the composer sits directly above the
      nav. Previously the list had a fixed min-height and everything after it
      floated wherever the content happened to end, leaving a band of dead
      space.

      useFillViewport measures where this element actually starts rather than
      subtracting AppShell's chrome by hand — which broke once already when the
      nav became a floating capsule and a NextStep banner appeared above the
      page content.
    */
    <div ref={shellRef} className="flex flex-col">
      <div className="mb-3 shrink-0">
        <p className="font-semibold text-content">{counterparty(conversation, user.uid)}</p>
        <Link
          href={`/properties/${conversation.propertyId}`}
          className="text-sm text-content-secondary no-underline hover:underline"
        >
          {conversation.propertyTitle}
        </Link>
      </div>

      <div className="card min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-content-hint">
            No messages yet. Say hello.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user.uid
            const system = m.senderId === 'system'
            if (system) {
              return (
                <p
                  key={m.id}
                  className="mx-auto max-w-md rounded-sm bg-surface-secondary px-3 py-2 text-center text-xs text-content-secondary"
                >
                  {m.text}
                </p>
              )
            }
            if (m.deleted) {
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <p className="max-w-[80%] rounded-md border border-border px-3.5 py-2.5 text-sm italic text-content-hint">
                    This message was deleted
                  </p>
                </div>
              )
            }
            return (
              <div
                key={m.id}
                className={`group flex items-center gap-2 ${
                  mine ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Author-only controls. Kept beside the bubble rather than
                    inside it so they never reflow the message text. */}
                {mine && (
                  <span className="flex shrink-0 gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => startEditing(m)}
                      className="text-[11px] text-content-secondary underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(m)}
                      className="text-[11px] text-error underline"
                    >
                      Delete
                    </button>
                  </span>
                )}
                <div
                  className={`max-w-[80%] rounded-md px-3.5 py-2.5 ${
                    mine
                      ? 'bg-primary text-white'
                      : 'bg-surface-secondary text-content'
                  }`}
                >
                  {!mine && (
                    <p className="text-xs font-semibold opacity-70">{m.senderName}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {splitMentions(m.text, targets).map((part, i) =>
                      part.mention ? (
                        <span
                          key={i}
                          className={`font-semibold ${mine ? 'underline' : 'text-primary'}`}
                        >
                          {part.text}
                        </span>
                      ) : (
                        <span key={i}>{part.text}</span>
                      ),
                    )}
                  </p>
                  <p className={`mt-1 text-[11px] ${mine ? 'text-white/70' : 'text-content-hint'}`}>
                    {m.editedAt && <span className="italic">edited · </span>}
                    {m.timestamp?.toLocaleTimeString('en-NG', {
                      hour: 'numeric',
                      minute: '2-digit',
                    }) ?? ''}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="mt-3 shrink-0 text-sm text-error">{error}</p>}

      {canSend ? (
        /*
          A textarea, not an input. A single-line input scrolls sideways once
          the text passes its width, so on a phone you lose sight of what you
          are writing — and every space nudges the scroll position, which is
          what made typing feel like the words were jumping around. A textarea
          wraps instead, so the text stays visible, and it grows to a few lines
          before scrolling.
        */
        <div className="mt-3 shrink-0">
          {/* @-mention picker, above the composer so it never covers what is
              being typed. At most two people are on a thread. */}
          {mentionMatches.length > 0 && (
            <ul className="mb-2 overflow-hidden rounded-md border border-border">
              {mentionMatches.map((t) => (
                <li key={t.uid}>
                  <button
                    type="button"
                    onClick={() => pickMention(t)}
                    className="flex w-full items-baseline gap-2 px-3 py-2 text-left hover:bg-surface-secondary"
                  >
                    <span className="text-sm font-semibold text-content">{t.fullName}</span>
                    <span className="text-xs text-content-secondary">
                      @{t.handle} · {t.role}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {editingId && (
            <div className="mb-2 flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-xs text-content-secondary">Editing message</span>
              <button
                type="button"
                onClick={cancelEditing}
                className="text-xs text-content-secondary underline"
              >
                Cancel
              </button>
            </div>
          )}

          <form onSubmit={send} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              className="input-field max-h-32 flex-1 resize-none px-4 py-3"
              placeholder="Write a message"
              aria-label="Message"
              enterKeyHint="send"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                syncMentions(e.target.value, e.target.selectionStart ?? 0)
                grow()
              }}
              onKeyDown={(e) => {
                // Enter sends; Shift+Enter starts a new line.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(e)
                }
              }}
            />
            <button
              className="btn-primary shrink-0 px-5 py-3 text-sm"
              type="submit"
              disabled={busy || !text.trim()}
            >
              {busy ? 'Saving…' : editingId ? 'Save' : 'Send'}
            </button>
          </form>
        </div>
      ) : (
        <div className="card mt-3 shrink-0 border-l-4 border-l-secondary p-5">
          <p className="font-semibold text-content">Verify to send messages</p>
          <p className="mt-1 text-sm text-content-secondary">
            You can read this conversation, but sending requires a verified account.
          </p>
          <Link
            href="/dashboard/verification"
            className="btn-primary mt-4 inline-block px-5 py-2.5 text-sm no-underline"
          >
            Get verified
          </Link>
        </div>
      )}
    </div>
  )
}
