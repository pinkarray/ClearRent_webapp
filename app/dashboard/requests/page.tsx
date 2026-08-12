'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { useAuth } from '../../../components/AuthProvider'
import { clientDb } from '../../../lib/firebase-client'
import { approveInspection, declineInspection } from '../../../lib/inspections'
import { InspectionActions } from '../../../components/InspectionActions'

type Row = {
  id: string
  propertyId: string
  propertyTitle: string
  tenantName: string
  tenantPhone: string | null
  requestedDate: Date | null
  requestedTimeDisplay: string
  notes: string
  status: string
  paymentStatus: string
  totalFee: number
  agentEarnings: number
  isAgentHandled: boolean
  tenantArrived: boolean
  handlerArrived: boolean
  tenantConfirmedMet: boolean
  handlerConfirmedMet: boolean
  tenantRated: boolean
  handlerId: string
  handlerName: string
  handlerType: 'agent' | 'landlord'
  handlerIsResident?: boolean
}

const OPEN_STATUSES = ['pending', 'pendingVerification', 'declinedByAgent']

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
}

/**
 * The handler's queue: inspection requests on properties this user handles.
 *
 * Two separate queries rather than one — Firestore has no OR across fields, and
 * rules scope list access to a party on the request, so each query must filter
 * by a field naming this user.
 */
export default function HandlerRequestsPage() {
  const { user, profile } = useAuth()
  const [asLandlord, setAsLandlord] = useState<Row[] | null>(null)
  const [asAgent, setAsAgent] = useState<Row[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /**
   * Both queries are LIVE. A tenant booking an inspection has to appear here
   * without the handler reloading — they are the one being waited on, and a
   * request they never see is a booking that quietly expires.
   *
   * Each side is kept separately and merged on render, rather than re-fetching
   * on every snapshot: Firestore has no OR across fields, so this is two
   * queries, and the same request can match both when the landlord is also the
   * assigned agent.
   */
  const toRow = useCallback(
    (d: QueryDocumentSnapshot): Row => {
      const x = d.data()
      return {
        id: d.id,
        propertyId: (x.propertyId as string) ?? '',
        propertyTitle: (x.propertyTitle as string) ?? '(property)',
        tenantName: (x.tenantName as string) ?? 'Tenant',
        tenantPhone: (x.tenantPhone as string) ?? null,
        requestedDate: x.requestedDate?.toDate?.() ?? null,
        requestedTimeDisplay: (x.requestedTimeDisplay as string) ?? '',
        notes: (x.notes as string) ?? '',
        status: (x.status as string) ?? 'pending',
        paymentStatus: (x.paymentStatus as string) ?? 'not_required',
        totalFee: (x.totalFee as number) ?? 0,
        agentEarnings: (x.agentEarnings as number) ?? 0,
        isAgentHandled: x.agentId === user?.uid,
        tenantArrived: x.tenantArrived === true,
        handlerArrived: x.handlerArrived === true,
        tenantConfirmedMet: x.tenantConfirmedMet === true,
        handlerConfirmedMet: x.handlerConfirmedMet === true,
        tenantRated: x.tenantRated === true,
        handlerId: (x.agentId as string) ?? (x.landlordId as string) ?? '',
        handlerName: (x.agentName as string) ?? (x.landlordName as string) ?? 'the handler',
        handlerType: x.agentId ? 'agent' : 'landlord',
        handlerIsResident: x.landlordLivesInProperty === true,
      }
    },
    [user],
  )

  useEffect(() => {
    if (!user) return
    const base = collection(clientDb(), 'inspection_requests')
    const unsubs = [
      onSnapshot(
        query(base, where('landlordId', '==', user.uid), orderBy('createdAt', 'desc')),
        (snap) => setAsLandlord(snap.docs.map(toRow)),
      ),
      onSnapshot(
        query(base, where('agentId', '==', user.uid), orderBy('createdAt', 'desc')),
        (snap) => setAsAgent(snap.docs.map(toRow)),
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [user, toRow])

  // Both lists are ordered newest-first, so a merge that keeps first-seen wins
  // preserves that order while dropping the duplicate.
  const rows = useMemo(() => {
    if (asLandlord === null && asAgent === null) return null
    const seen = new Set<string>()
    return [...(asLandlord ?? []), ...(asAgent ?? [])].filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })
  }, [asLandlord, asAgent])

  async function handleApprove(r: Row) {
    setError(null)
    setBusyId(r.id)
    const err = await approveInspection(r.id)
    setBusyId(null)
    if (err) setError(err)
  }

  async function handleDecline(r: Row) {
    if (!user) return
    const reason = window.prompt('Why are you declining? The tenant will see this.')
    if (reason === null) return
    setError(null)
    setBusyId(r.id)
    const err = await declineInspection(
      r.id,
      reason.trim() || 'No reason given',
      r.isAgentHandled ? 'agent' : 'landlord',
      user.uid,
    )
    setBusyId(null)
    if (err) setError(err)
  }

  if (!user) return null

  const open = rows?.filter((r) => OPEN_STATUSES.includes(r.status)) ?? []
  const rest = rows?.filter((r) => !OPEN_STATUSES.includes(r.status)) ?? []

  return (
    <>
      <div>
        {!profile?.hasBankDetails && (
          <div className="card mb-6 border-l-4 border-l-secondary p-5">
            <p className="font-semibold text-content">
              Add a payout account to approve
            </p>
            <p className="mt-1 text-sm text-content-secondary">
              Rules require a payout destination before you can accept an inspection - that is
              where your {formatNaira(7000)} handler fee is settled.{' '}
              <Link href="/dashboard/bank" className="text-primary no-underline">
                Add one
              </Link>
              .
            </p>
          </div>
        )}

        {error && <p className="mb-4 text-sm text-error">{error}</p>}

        {rows === null ? (
          <p className="text-sm text-content-secondary">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-content-secondary">No inspection requests yet.</p>
          </div>
        ) : (
          <>
            {open.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
                  Needs your decision
                </h2>
                {open.map((r) => (
                  <div key={r.id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/properties/${r.propertyId}`}
                          className="font-semibold text-content no-underline hover:underline"
                        >
                          {r.propertyTitle}
                        </Link>
                        <p className="text-sm text-content-secondary">
                          {r.tenantName}
                          {r.tenantPhone ? ` · ${r.tenantPhone}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-primary">
                        You earn {formatNaira(r.agentEarnings)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-content-secondary">
                      {r.requestedDate && (
                        <span>
                          {r.requestedDate.toLocaleDateString('en-NG', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      )}
                      {r.requestedTimeDisplay && <span>{r.requestedTimeDisplay}</span>}
                    </div>

                    {r.notes && (
                      <p className="mt-3 rounded-md bg-surface-secondary p-3 text-sm text-content-secondary">
                        {r.notes}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        className="btn-primary px-6 py-2.5 text-sm"
                        disabled={busyId === r.id || !profile?.hasBankDetails}
                        onClick={() => handleApprove(r)}
                      >
                        {busyId === r.id ? 'Working…' : 'Approve'}
                      </button>
                      <button
                        className="btn-ghost px-6 py-2.5 text-sm"
                        disabled={busyId === r.id}
                        onClick={() => handleDecline(r)}
                      >
                        Decline
                      </button>
                    </div>

                    <p className="mt-3 text-xs text-content-hint">
                      The tenant pays {formatNaira(r.totalFee)} after you approve. Nothing has
                      been charged yet.
                    </p>
                  </div>
                ))}
              </div>
            )}

            {rest.length > 0 && (
              <div className="mt-8 space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
                  Everything else
                </h2>
                {rest.map((r) => (
                  <div
                    key={r.id}
                    className="card flex flex-wrap items-center justify-between gap-3 p-5"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-content">
                        {r.propertyTitle}
                      </p>
                      <p className="text-sm text-content-secondary">{r.tenantName}</p>
                    </div>
                    <span className="chip shrink-0">
                      {r.status}
                      {r.paymentStatus === 'paid' ? ' · paid' : ''}
                    </span>

                    <div className="w-full">
                      <InspectionActions
                        state={r}
                        role="handler"
                        uid={user.uid}
                        // Listeners keep the list current.
                        onDone={() => {}}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
