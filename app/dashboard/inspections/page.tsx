'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { useAuth } from '../../../components/AuthProvider'
import { clientDb } from '../../../lib/firebase-client'
import { startPayment } from '../../../lib/payments'
import { InspectionActions } from '../../../components/InspectionActions'
import { createRentalInterest } from '../../../lib/tenancy'

type Row = {
  id: string
  propertyId: string
  propertyTitle: string
  propertyAddress: string
  requestedDate: Date | null
  requestedTimeDisplay: string
  status: string
  paymentStatus: string
  totalFee: number
  tenantArrived: boolean
  handlerArrived: boolean
  tenantConfirmedMet: boolean
  handlerConfirmedMet: boolean
  tenantRated: boolean
  handlerId: string
  handlerName: string
  handlerType: 'agent' | 'landlord'
}

/**
 * What each status means to the tenant. Kept explicit rather than prettifying
 * the raw enum, because 'pendingVerification' and 'declinedByAgent' mean
 * nothing to a person looking at their own booking.
 */
const STATUS_COPY: Record<string, string> = {
  pending: 'Waiting for the handler to approve',
  approved: 'Approved',
  pendingPayment: 'Approved — payment needed',
  pendingVerification: 'Checking your payment',
  declinedByAgent: 'Declined by the agent — the landlord may still approve',
  declined: 'Declined',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
}

export default function TenantInspectionsPage() {
  const router = useRouter()
  const { user, ready } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [interestId, setInterestId] = useState<string | null>(null)

  async function expressInterest(r: Row) {
    setPayError(null)
    setPayingId(r.id)
    const res = await createRentalInterest(r.id)
    setPayingId(null)
    if ('error' in res) setPayError(res.error)
    else setInterestId(res.interestId)
  }

  async function handlePay(r: Row) {
    setPayError(null)
    setPayingId(r.id)
    try {
      // The amount is display-only — resolveServerAmount recomputes the real
      // charge from the payment type, so a tampered client cannot underpay.
      await startPayment('inspection', r.totalFee, '/dashboard/inspections', {
        requestId: r.id,
        propertyId: r.propertyId,
      })
    } catch (err) {
      setPayingId(null)
      setPayError(err instanceof Error ? err.message : 'Could not start the payment.')
    }
  }

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      // Rules scope list access to a party on the request, so this query must
      // filter by tenantId — an unscoped read is rejected.
      const snap = await getDocs(
        query(
          collection(clientDb(), 'inspection_requests'),
          where('tenantId', '==', user.uid),
          orderBy('createdAt', 'desc'),
        ),
      )
      setRows(
        snap.docs.map((d) => {
          const x = d.data()
          return {
            id: d.id,
            propertyId: (x.propertyId as string) ?? '',
            propertyTitle: (x.propertyTitle as string) ?? '(property)',
            propertyAddress: (x.propertyAddress as string) ?? '',
            requestedDate: x.requestedDate?.toDate?.() ?? null,
            requestedTimeDisplay: (x.requestedTimeDisplay as string) ?? '',
            status: (x.status as string) ?? 'pending',
            paymentStatus: (x.paymentStatus as string) ?? 'not_required',
            totalFee: (x.totalFee as number) ?? 0,
            tenantArrived: x.tenantArrived === true,
            handlerArrived: x.handlerArrived === true,
            tenantConfirmedMet: x.tenantConfirmedMet === true,
            handlerConfirmedMet: x.handlerConfirmedMet === true,
            tenantRated: x.tenantRated === true,
            // The handler is the assigned agent when there is one, else the
            // landlord — that is who the tenant rates.
            handlerId: (x.agentId as string) ?? (x.landlordId as string) ?? '',
            handlerName:
              (x.agentName as string) ?? (x.landlordName as string) ?? 'the handler',
            handlerType: x.agentId ? 'agent' : 'landlord',
          }
        }),
      )
    })()
  }, [user, reloadKey])

  if (!ready || !user) {
    return (
      <main className="mesh-bg min-h-screen">
        <div className="container py-16 text-[var(--text-secondary)]">Loading…</div>
      </main>
    )
  }

  return (
    <main className="mesh-bg min-h-screen">
      <div className="container max-w-3xl py-12">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-[var(--primary)] no-underline hover:underline"
        >
          ← Dashboard
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-[var(--text-primary)]">My inspections</h1>

        {payError && <p className="mt-4 text-sm text-red-600">{payError}</p>}

        {rows === null ? (
          <p className="mt-6 text-sm text-[var(--text-secondary)]">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="card mt-6 p-8 text-center">
            <p className="text-[var(--text-secondary)]">No inspection requests yet.</p>
            <Link
              href="/properties"
              className="btn-primary mt-5 inline-block px-6 py-3 no-underline"
            >
              Browse properties
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/properties/${r.propertyId}`}
                      className="font-semibold text-[var(--text-primary)] no-underline hover:underline"
                    >
                      {r.propertyTitle}
                    </Link>
                    <p className="text-sm text-[var(--text-secondary)]">{r.propertyAddress}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--surface-secondary)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                    {STATUS_COPY[r.status] ?? r.status}
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
                  {r.totalFee > 0 && <span>{formatNaira(r.totalFee)}</span>}
                </div>

                {r.status === 'approved' && r.paymentStatus === 'unpaid' && (
                  <div className="mt-4 border-t border-[var(--divider)] pt-4">
                    <p className="text-sm text-[var(--text-secondary)]">
                      Approved. Pay {formatNaira(r.totalFee)} to confirm and unlock the exact
                      address.
                    </p>
                    <button
                      className="btn-primary mt-3 px-6 py-2.5 text-sm"
                      disabled={payingId === r.id}
                      onClick={() => handlePay(r)}
                    >
                      {payingId === r.id ? 'Redirecting…' : `Pay ${formatNaira(r.totalFee)}`}
                    </button>
                  </div>
                )}

                {r.paymentStatus === 'paid' && (
                  <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] p-4">
                    <p className="text-xs text-[var(--text-secondary)]">Exact address</p>
                    <p className="mt-0.5 font-medium text-[var(--text-primary)]">
                      {r.propertyAddress}
                    </p>
                  </div>
                )}

                <InspectionActions
                  state={r}
                  role="tenant"
                  uid={user.uid}
                  onDone={() => setReloadKey((k) => k + 1)}
                />

                {r.status === 'completed' && r.tenantRated && (
                  <div className="mt-4 border-t border-[var(--divider)] pt-4">
                    <p className="text-sm text-[var(--text-secondary)]">
                      Like it? Tell the landlord you want to rent it.
                    </p>
                    <button
                      className="btn-primary mt-3 px-5 py-2.5 text-sm"
                      disabled={payingId === r.id}
                      onClick={() => expressInterest(r)}
                    >
                      {payingId === r.id ? 'Working…' : 'I want to rent this'}
                    </button>
                    {interestId && (
                      <p className="mt-2 text-sm text-[var(--primary)]">
                        Sent —{' '}
                        <Link href="/dashboard/tenancy" className="no-underline underline">
                          track it under Tenancy
                        </Link>
                        .
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
