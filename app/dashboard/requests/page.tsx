'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
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
  const router = useRouter()
  const { user, profile, ready } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  const load = useCallback(async () => {
    if (!user) return
    const base = collection(clientDb(), 'inspection_requests')
    const [asLandlord, asAgent] = await Promise.all([
      getDocs(query(base, where('landlordId', '==', user.uid), orderBy('createdAt', 'desc'))),
      getDocs(query(base, where('agentId', '==', user.uid), orderBy('createdAt', 'desc'))),
    ])

    const seen = new Set<string>()
    const out: Row[] = []
    for (const d of [...asLandlord.docs, ...asAgent.docs]) {
      if (seen.has(d.id)) continue
      seen.add(d.id)
      const x = d.data()
      out.push({
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
        isAgentHandled: x.agentId === user.uid,
        tenantArrived: x.tenantArrived === true,
        handlerArrived: x.handlerArrived === true,
        tenantConfirmedMet: x.tenantConfirmedMet === true,
        handlerConfirmedMet: x.handlerConfirmedMet === true,
        tenantRated: x.tenantRated === true,
        handlerId: (x.agentId as string) ?? (x.landlordId as string) ?? '',
        handlerName: (x.agentName as string) ?? (x.landlordName as string) ?? 'the handler',
        handlerType: x.agentId ? 'agent' : 'landlord',
      })
    }
    setRows(out)
  }, [user])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      await load()
    })()
  }, [user, load])

  async function handleApprove(r: Row) {
    setError(null)
    setBusyId(r.id)
    const err = await approveInspection(r.id)
    setBusyId(null)
    if (err) setError(err)
    else await load()
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
    else await load()
  }

  if (!ready || !user) {
    return (
      <main className="mesh-bg min-h-screen">
        <div className="container py-16 text-[var(--text-secondary)]">Loading…</div>
      </main>
    )
  }

  const open = rows?.filter((r) => OPEN_STATUSES.includes(r.status)) ?? []
  const rest = rows?.filter((r) => !OPEN_STATUSES.includes(r.status)) ?? []

  return (
    <main className="mesh-bg min-h-screen">
      <div className="container max-w-3xl py-12">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-[var(--primary)] no-underline hover:underline"
        >
          ← Dashboard
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-[var(--text-primary)]">
          Inspection requests
        </h1>

        {!profile?.hasBankDetails && (
          <div className="card mt-6 border-l-4 border-l-[var(--secondary)] p-5">
            <p className="font-semibold text-[var(--text-primary)]">
              Add a payout account to approve
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Rules require a payout destination before you can accept an inspection — that is
              where your {formatNaira(7000)} handler fee is settled.{' '}
              <Link href="/dashboard/bank" className="text-[var(--primary)] no-underline">
                Add one
              </Link>
              .
            </p>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {rows === null ? (
          <p className="mt-6 text-sm text-[var(--text-secondary)]">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="card mt-6 p-8 text-center">
            <p className="text-[var(--text-secondary)]">No inspection requests yet.</p>
          </div>
        ) : (
          <>
            {open.length > 0 && (
              <div className="mt-6 space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-hint)]">
                  Needs your decision
                </h2>
                {open.map((r) => (
                  <div key={r.id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/properties/${r.propertyId}`}
                          className="font-semibold text-[var(--text-primary)] no-underline hover:underline"
                        >
                          {r.propertyTitle}
                        </Link>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {r.tenantName}
                          {r.tenantPhone ? ` · ${r.tenantPhone}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-[var(--primary)]">
                        You earn {formatNaira(r.agentEarnings)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--text-secondary)]">
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
                      <p className="mt-3 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] p-3 text-sm text-[var(--text-secondary)]">
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

                    <p className="mt-3 text-xs text-[var(--text-hint)]">
                      The tenant pays {formatNaira(r.totalFee)} after you approve. Nothing has
                      been charged yet.
                    </p>
                  </div>
                ))}
              </div>
            )}

            {rest.length > 0 && (
              <div className="mt-8 space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-hint)]">
                  Everything else
                </h2>
                {rest.map((r) => (
                  <div
                    key={r.id}
                    className="card flex flex-wrap items-center justify-between gap-3 p-5"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text-primary)]">
                        {r.propertyTitle}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">{r.tenantName}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--surface-secondary)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                      {r.status}
                      {r.paymentStatus === 'paid' ? ' · paid' : ''}
                    </span>

                    <div className="w-full">
                      <InspectionActions
                        state={r}
                        role="handler"
                        uid={user.uid}
                        onDone={load}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
