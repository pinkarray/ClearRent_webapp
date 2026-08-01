'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../components/AuthProvider'
import { counterparty, myConversations, type Conversation } from '../../../lib/chat'
import { timeAgo } from '../../../lib/format'

export default function MessagesPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Conversation[] | null>(null)

  useEffect(() => {
    if (!user) return
    ;(async () => setRows(await myConversations(user.uid)))()
  }, [user])

  if (!user) return null

  return (
    <div>
      {rows === null ? (
        <p className="text-sm text-content-secondary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-content-secondary">No conversations yet.</p>
          <p className="mt-1 text-sm text-content-hint">
            Messaging opens up once you are dealing with a landlord or an agent on a property.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/messages/${c.id}`}
              className="card flex items-center gap-4 p-4 no-underline"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-semibold text-content">
                    {counterparty(c, user.uid)}
                  </p>
                  <span className="shrink-0 text-xs text-content-hint">
                    {timeAgo(c.lastMessageTime)}
                  </span>
                </div>
                <p className="truncate text-sm text-content-secondary">{c.propertyTitle}</p>
                <p className="truncate text-sm text-content-hint">
                  {c.lastMessageSenderId === user.uid ? 'You: ' : ''}
                  {c.lastMessage || 'No messages yet'}
                </p>
              </div>
              {c.unread > 0 && (
                <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
                  {c.unread}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
