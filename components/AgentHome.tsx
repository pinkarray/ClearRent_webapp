'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from './AuthProvider'
import { agentProfile, watchHandledProperties, type AgentProfile } from '../lib/agent'

/*
  The agent's dashboard: what they handle, what still needs vetting, and how
  they get more work.

  The "needs vetting" count leads because it is the one number that costs the
  agent money - an unvetted property cannot be booked, so it earns nothing.
*/
export default function AgentHome({ verified }: { verified: boolean }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<AgentProfile | null>(null)
  const [counts, setCounts] = useState<{ handling: number; unvetted: number } | null>(null)

  const uid = user?.uid

  // The agent's own profile changes only by their own action.
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    ;(async () => {
      const p = await agentProfile(uid)
      if (!cancelled) setProfile(p)
    })()
    return () => {
      cancelled = true
    }
  }, [uid])

  // Live: the landlord does the assigning, so both counts move without this
  // agent touching anything.
  useEffect(() => {
    if (!uid) return
    return watchHandledProperties(uid, (properties) =>
      setCounts({
        handling: properties.length,
        unvetted: properties.filter(
          (x) => x.ownershipDocStatus === 'verified' && !x.readyForInspections,
        ).length,
      }),
    )
  }, [uid])

  return (
    <>
      {!verified && (
        <section className="card border-l-4 border-l-secondary p-5">
          <p className="font-semibold text-content">Verify to start handling inspections</p>
          <p className="mt-1 text-sm text-content-secondary">
            Agents need identity verification and a guarantor before a landlord can assign
            them, and before you can message anyone.
          </p>
          <Link
            href="/dashboard/verification"
            className="btn-primary mt-4 inline-block px-5 py-2.5 text-sm no-underline"
          >
            Get verified
          </Link>
        </section>
      )}

      {counts && counts.unvetted > 0 && (
        <section className="card border-l-4 border-l-error p-5">
          <p className="font-semibold text-content">
            {counts.unvetted} propert{counts.unvetted === 1 ? 'y needs' : 'ies need'} vetting
          </p>
          <p className="mt-1 text-sm text-content-secondary">
            They cannot be booked until you confirm the readiness checklist, so they earn you
            nothing in the meantime.
          </p>
          <Link
            href="/dashboard/handling"
            className="btn-primary mt-4 inline-block px-5 py-2.5 text-sm no-underline"
          >
            Vet them
          </Link>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Handling', value: counts?.handling ?? '-' },
          { label: 'Inspections done', value: profile?.totalInspections ?? '-' },
          {
            label: 'Rating',
            value:
              profile && profile.totalRatings > 0
                ? `${profile.rating.toFixed(1)}★`
                : 'Not rated',
          },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-sm text-content-secondary">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-content">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="card p-6">
        <h3 className="text-lg font-semibold text-content">Your work</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { href: '/dashboard/handling', label: 'Properties you handle' },
            { href: '/dashboard/requests', label: 'Inspection requests' },
            { href: '/dashboard/leads', label: 'Find leads' },
            { href: '/dashboard/coverage', label: 'Coverage & availability' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="btn-ghost px-4 py-3 text-center text-sm no-underline"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </section>

      {profile && profile.serviceAreas.length === 0 && (
        <section className="card border-l-4 border-l-secondary p-5">
          <p className="font-semibold text-content">You have no service areas set</p>
          <p className="mt-1 text-sm text-content-secondary">
            Landlords picking a handler see agents who cover the property&apos;s area first.
            Without any, you do not surface at all.
          </p>
          <Link
            href="/dashboard/coverage"
            className="btn-primary mt-4 inline-block px-5 py-2.5 text-sm no-underline"
          >
            Set your areas
          </Link>
        </section>
      )}
    </>
  )
}
