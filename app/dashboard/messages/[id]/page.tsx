'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '../../../../components/AuthProvider'
import {
  clearUnread,
  counterparty,
  getConversation,
  sendMessage,
  watchMessages,
  type Conversation,
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
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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

  async function send(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!user || !text.trim() || busy) return
    setError(null)
    setBusy(true)
    const err = await sendMessage(
      params.id,
      {
        uid: user.uid,
        name: profile?.fullName ?? 'You',
        role: profile?.accountType ?? '',
      },
      text,
    )
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
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
      bottom tab bar. Previously the list had a fixed min-height and everything
      after it floated wherever the content happened to end, leaving a band of
      dead space.

      .thread-shell (globals.css) sizes this against --app-vh, the genuinely
      visible height published by ViewportSync, and shrinks further when the
      keyboard is up — at which point the tab bar hides itself, so the composer
      ends up directly above the keyboard.
    */
    <div className="thread-shell flex flex-col">
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
            return (
              <div
                key={m.id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
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
                  <p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>
                  <p className={`mt-1 text-[11px] ${mine ? 'text-white/70' : 'text-content-hint'}`}>
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
        <form onSubmit={send} className="mt-3 flex shrink-0 items-end gap-2">
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
            {busy ? 'Sending…' : 'Send'}
          </button>
        </form>
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
