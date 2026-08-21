'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from './AuthProvider'
import {
  watchManagedProperties,
  watchMyInvites,
  type CaretakerInvite,
} from '../lib/caretaker'

/**
 * The caretaker's way in, shown on the dashboard home whatever role they are —
 * and shown to nobody else. Mirrors `caretaker_banner.dart`, including its
 * three states, in order:
 *
 *  1. A pending invitation → an action prompt. Someone is waiting on an answer.
 *  2. Properties they already manage → a quiet entry to that work.
 *  3. Neither → nothing at all.
 *
 * Web had none of this: /dashboard/caretaking existed but hung off Profile
 * alone, so an invited caretaker had to already know where to look. That is
 * exactly where testing stalled on 2026-08-20.
 *
 * Both streams are live Firestore state rather than a stored flag, so the
 * banner appears the moment an invitation is sent and disappears the moment
 * the arrangement ends.
 */
export default function CaretakerBanner() {
  const { user } = useAuth()
  const [invites, setInvites] = useState<CaretakerInvite[]>([])
  const [managed, setManaged] = useState<{ id: string; title: string }[]>([])

  useEffect(() => {
    if (!user) return
    const stop = watchMyInvites(user.uid, setInvites)
    return () => stop()
  }, [user])

  useEffect(() => {
    if (!user) return
    const stop = watchManagedProperties(user.uid, setManaged)
    return () => stop()
  }, [user])

  const pending = invites.find((i) => i.status === 'pending')

  if (pending) {
    const count = pending.propertyIds.length
    const what =
      count === 1
        ? pending.propertyTitles[0] ?? 'their property'
        : `${count} units`
    return (
      <Banner
        emphasised
        title="Caretaker invitation"
        subtitle={`${pending.landlordName} wants you to manage ${what}. Tap to accept or decline.`}
      />
    )
  }

  if (managed.length > 0) {
    return (
      <Banner
        title="Properties you manage"
        subtitle={managed.length === 1 ? managed[0].title : `${managed.length} properties`}
      />
    )
  }

  return null
}

function Banner({
  title,
  subtitle,
  emphasised = false,
}: {
  title: string
  subtitle: string
  emphasised?: boolean
}) {
  return (
    <Link
      href="/dashboard/caretaking"
      className={`card flex items-center gap-3 p-4 no-underline ${
        emphasised ? 'border-l-4 border-l-primary' : ''
      }`}
    >
      <span aria-hidden className="text-xl">
        🛠️
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm font-semibold ${
            emphasised ? 'text-primary' : 'text-content'
          }`}
        >
          {title}
        </span>
        <span className="mt-0.5 block truncate text-sm text-content-secondary">
          {subtitle}
        </span>
      </span>
      <span aria-hidden className="text-content-hint">
        ›
      </span>
    </Link>
  )
}
