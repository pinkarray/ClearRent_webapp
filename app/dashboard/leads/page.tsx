'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../components/AuthProvider'
import { agentProfile, discoverProperties, type HandledProperty } from '../../../lib/agent'
import { servesArea } from '../../../lib/agents'
import { getOrCreatePitchConversation } from '../../../lib/chat'
import { formatNaira } from '../../../lib/format'

/*
  Leads: available listings from verified landlords that have no handler yet.

  An agent cannot claim one — assignment is the landlord's call
  (`property_service.dart:945`), and the rules give an agent no write on a
  property they are not already assigned to. So the action here is to pitch,
  which is what the app's Discover screen does too.
*/
export default function LeadsPage() {
  const { user, profile } = useAuth()
  const router = useRouter()
  const [rows, setRows] = useState<HandledProperty[] | null>(null)
  const [areas, setAreas] = useState<string[]>([])
  const [onlyMine, setOnlyMine] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pitch(p: HandledProperty) {
    if (!user) return
    setError(null)
    setBusyId(p.id)
    const res = await getOrCreatePitchConversation(p.landlordId, {
      uid: user.uid,
      name: profile?.fullName ?? 'Agent',
    })
    setBusyId(null)
    if ('error' in res) {
      setError(res.error)
      return
    }
    router.push(`/dashboard/messages/${res.id}`)
  }

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const [profile, properties] = await Promise.all([
        agentProfile(user.uid),
        discoverProperties(),
      ])
      setAreas(profile.serviceAreas)
      setRows(properties)
    })()
  }, [user])

  const visible = useMemo(() => {
    if (!rows) return null
    if (!onlyMine || areas.length === 0) return rows
    const agent = { serviceAreas: areas } as Parameters<typeof servesArea>[0]
    return rows.filter((p) => servesArea(agent, p.lga) || servesArea(agent, p.city))
  }, [rows, areas, onlyMine])

  if (!user) return null

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <p className="font-semibold text-content">Landlords choose their handler</p>
        <p className="mt-1 text-sm text-content-secondary">
          You cannot claim a listing. Pitch the landlord — if they assign you, it appears
          under the properties you handle.
        </p>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {areas.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-content-secondary">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
          />
          Only areas I cover ({areas.length})
        </label>
      )}

      {areas.length === 0 && (
        <div className="card border-l-4 border-l-secondary p-5">
          <p className="font-semibold text-content">Set your coverage first</p>
          <p className="mt-1 text-sm text-content-secondary">
            Without service areas you will not surface to landlords looking for an agent.
          </p>
          <Link
            href="/dashboard/coverage"
            className="btn-primary mt-4 inline-block px-5 py-2.5 text-sm no-underline"
          >
            Set coverage
          </Link>
        </div>
      )}

      {visible === null ? (
        <p className="text-sm text-content-secondary">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-content-secondary">
            {onlyMine && areas.length > 0
              ? 'No unassigned listings in the areas you cover.'
              : 'No unassigned listings right now.'}
          </p>
          {onlyMine && areas.length > 0 && (
            <button
              className="btn-ghost mt-5 px-5 py-2.5 text-sm"
              onClick={() => setOnlyMine(false)}
            >
              Show every area
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-content">{p.title}</p>
                  <p className="truncate text-sm text-content-secondary">
                    {p.approximateAddress}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-primary">
                  {formatNaira(p.rent)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-content-secondary">
                <span>{p.landlordName}</span>
                {p.agentFee > 0 && <span>Agent fee {formatNaira(p.agentFee)}</span>}
                {p.ownershipDocStatus !== 'verified' && (
                  <span className="chip chip-pending">Ownership unverified</span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/properties/${p.id}`}
                  className="btn-ghost px-4 py-2 text-sm no-underline"
                >
                  View listing
                </Link>
                <button
                  className="btn-primary px-4 py-2 text-sm"
                  disabled={busyId === p.id}
                  onClick={() => pitch(p)}
                >
                  {busyId === p.id ? 'Opening…' : 'Pitch the landlord'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
