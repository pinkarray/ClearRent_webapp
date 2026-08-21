'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useAuth } from '../../../components/AuthProvider'
import { clientDb } from '../../../lib/firebase-client'
import {
  myInvites,
  respondToInvite,
  revokeCaretaker,
  type CaretakerInvite,
} from '../../../lib/caretaker'

type ManagedProperty = { id: string; title: string; area: string }

/*
  Caretaking: the invitations waiting on this user, and the properties they
  already manage.

  Deliberately NOT a nav tab. A caretaker is an existing tenant, landlord or
  agent — accountType still decides which capsule they get — so this hangs off
  Profile, the one surface every role shares. Same reasoning as the app, where
  it lives in Settings.

  `properties` is readable by any signed-in user, so listing by caretakerId
  needs no rules change; it must still be scoped by that field, which is also
  the one the caller's rule branch reads everywhere else.
*/
export default function CaretakingPage() {
  const { user } = useAuth()
  const [invites, setInvites] = useState<CaretakerInvite[] | null>(null)
  const [properties, setProperties] = useState<ManagedProperty[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setInvites(await myInvites(user.uid))
    const snap = await getDocs(
      query(collection(clientDb(), 'properties'), where('caretakerId', '==', user.uid)),
    )
    setProperties(
      snap.docs.map((d) => {
        const x = d.data()
        return {
          id: d.id,
          title: (x.title as string) ?? 'Untitled property',
          area: [x.lga, x.city].filter(Boolean).join(', '),
        }
      }),
    )
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function answer(invite: CaretakerInvite, accept: boolean) {
    setBusy(invite.id)
    setError(null)
    const err = await respondToInvite(invite.id, accept)
    if (err) setError(err)
    await load()
    setBusy(null)
  }

  async function stepBack(invite: CaretakerInvite) {
    setBusy(invite.id)
    setError(null)
    const err = await revokeCaretaker(invite.id)
    if (err) setError(err)
    await load()
    setBusy(null)
  }

  const pending = invites?.filter((i) => i.status === 'pending') ?? []
  const active = invites?.filter((i) => i.status === 'accepted') ?? []

  return (
    <div className="space-y-8">
      {error ? (
        <div className="card border-error/40 p-4 text-sm text-error">{error}</div>
      ) : null}

      {pending.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
            Invitations
          </h2>
          <div className="mt-3 space-y-3">
            {pending.map((i) => (
              <div key={i.id} className="card border-primary/40 p-5">
                <p className="font-medium text-content">
                  {i.landlordName} wants you to manage{' '}
                  {i.propertyIds.length === 1
                    ? (i.propertyTitles[0] ?? 'their property')
                    : `${i.propertyIds.length} units`}
                </p>
                {i.propertyIds.length > 1 && i.propertyTitles.length > 0 ? (
                  <p className="mt-1 text-sm text-content-secondary">
                    {i.propertyTitles.join(', ')}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-content-secondary">
                  You would handle issues, maintenance and messages with the tenant.
                  You cannot change the rent or anything to do with money.
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    className="btn-ghost px-5 py-2.5 text-sm"
                    disabled={busy === i.id}
                    onClick={() => answer(i, false)}
                  >
                    Decline
                  </button>
                  <button
                    className="btn-primary px-5 py-2.5 text-sm"
                    disabled={busy === i.id}
                    onClick={() => answer(i, true)}
                  >
                    {busy === i.id ? 'Working…' : 'Accept'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
          You manage
        </h2>
        {invites === null ? (
          <p className="mt-3 text-sm text-content-secondary">Loading…</p>
        ) : properties.length === 0 ? (
          <div className="card mt-3 p-6 text-center text-sm text-content-secondary">
            You do not manage any properties. When a landlord invites you as
            caretaker, the invitation shows up here.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {properties.map((p) => {
              const grant = active.find((i) => i.propertyIds.includes(p.id))
              return (
                <div key={p.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-content">{p.title}</p>
                      <p className="truncate text-sm text-content-secondary">{p.area}</p>
                    </div>
                    <div className="flex shrink-0 gap-3">
                      <Link
                        className="btn-ghost px-4 py-2 text-sm no-underline"
                        href={`/dashboard/listings/${p.id}/health`}
                      >
                        Open
                      </Link>
                      {grant ? (
                        <button
                          className="btn-ghost px-4 py-2 text-sm text-error"
                          disabled={busy === grant.id}
                          onClick={() => stepBack(grant)}
                        >
                          Step back
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
