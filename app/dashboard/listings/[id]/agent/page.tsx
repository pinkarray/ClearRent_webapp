'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { useAuth } from '../../../../../components/AuthProvider'
import { assignAgent, servesArea, verifiedAgents, type Agent } from '../../../../../lib/agents'
import { clientDb } from '../../../../../lib/firebase-client'

type Listing = {
  title: string
  lga: string
  city: string
  assignedAgentId: string
  assignedAgentName: string
}

/** Assign an inspection handler to a listing — the app's Select Agent screen. */
export default function SelectAgentPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams<{ id: string }>()

  const [listing, setListing] = useState<Listing | null | 'missing'>(null)
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const snap = await getDoc(doc(clientDb(), 'properties', params.id))
      const x = snap.data()
      if (!snap.exists() || x?.landlordId !== user.uid) {
        setListing('missing')
        return
      }
      setListing({
        title: (x.title as string) ?? '(untitled)',
        lga: (x.lga as string) ?? '',
        city: (x.city as string) ?? '',
        assignedAgentId: (x.assignedAgentId as string) ?? '',
        assignedAgentName: (x.assignedAgentName as string) ?? '',
      })
      setAgents(await verifiedAgents())
    })()
  }, [user, params.id])

  async function choose(agent: Agent) {
    setError(null)
    setBusyId(agent.id)
    const err = await assignAgent(params.id, agent)
    setBusyId(null)
    if (err) {
      setError(err)
      return
    }
    router.push(`/dashboard/listings/${params.id}`)
  }

  if (!user) return null
  if (listing === null) return <p className="text-sm text-content-secondary">Loading…</p>

  if (listing === 'missing') {
    return (
      <div className="card p-8 text-center">
        <p className="text-content-secondary">That listing is not one of yours.</p>
        <Link href="/dashboard" className="btn-ghost mt-5 inline-block px-6 py-3 no-underline">
          Back to dashboard
        </Link>
      </div>
    )
  }

  // The area the property sits in, used to surface agents who cover it first.
  const area = listing.lga || listing.city
  const sorted = [...(agents ?? [])].sort((a, b) => {
    const covers = Number(servesArea(b, area)) - Number(servesArea(a, area))
    return covers !== 0 ? covers : b.rating - a.rating
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-content">{listing.title}</h2>
        {area && <p className="mt-0.5 text-sm text-content-secondary">{area}</p>}
      </div>

      <div className="card border-l-4 border-l-secondary p-5">
        <p className="font-semibold text-content">Assigning pauses bookings</p>
        <p className="mt-1 text-sm text-content-secondary">
          The handler is changing, so this listing is marked not-ready until the new agent
          vets it in the app. It comes off public browse until they do.
        </p>
      </div>

      {listing.assignedAgentId && (
        <p className="text-sm text-content-secondary">
          Currently handled by <strong>{listing.assignedAgentName}</strong>.
        </p>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      {agents === null ? (
        <p className="text-sm text-content-secondary">Loading agents…</p>
      ) : sorted.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-content-secondary">No verified agents available yet.</p>
          <p className="mt-1 text-sm text-content-hint">
            You can keep handling inspections yourself in the meantime.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((a) => {
            const covers = servesArea(a, area)
            const current = a.id === listing.assignedAgentId
            return (
              <div key={a.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-content">{a.fullName}</p>
                    <p className="text-sm text-content-secondary">
                      {a.baseLocation || 'Location not set'}
                      {a.totalInspections > 0 && ` · ${a.totalInspections} inspections`}
                      {a.totalRatings > 0 && ` · ${a.rating.toFixed(1)}★`}
                    </p>
                  </div>
                  {covers && area && <span className="chip chip-live shrink-0">Covers {area}</span>}
                </div>

                {a.serviceAreas.length > 0 && (
                  <p className="mt-2 text-sm text-content-hint">
                    {a.serviceAreas.join(', ')}
                  </p>
                )}

                <button
                  className="btn-primary mt-4 px-5 py-2.5 text-sm"
                  disabled={busyId === a.id || current}
                  onClick={() => choose(a)}
                >
                  {current ? 'Currently assigned' : busyId === a.id ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
