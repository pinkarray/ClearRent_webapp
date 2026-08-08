'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useAuth } from '../../../components/AuthProvider'
import { clientDb } from '../../../lib/firebase-client'
import { startPayment } from '../../../lib/payments'
import { InspectionActions } from '../../../components/InspectionActions'
import { createRentalInterest, watchInterests } from '../../../lib/tenancy'

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
  handlerIsResident?: boolean
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
  const { user } = useAuth()
  const router = useRouter()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [interestId, setInterestId] = useState<string | null>(null)
  // Properties this tenant has ALREADY claimed. Without it the card kept
  // offering "I want to rent this" for a place they had already rented —
  // createRentalInterest is idempotent so it was not a double-charge, but being
  // asked to start a tenancy you are already in reads as the app not knowing
  // who you are.
  const [claimed, setClaimed] = useState<Set<string>>(new Set())

  // Live, so the CTA disappears the instant the interest is filed rather than
  // on the next navigation.
  useEffect(() => {
    if (!user) return
    return watchInterests('tenantId', user.uid, (rows) =>
      setClaimed(new Set(rows.map((i) => i.propertyId))),
    )
  }, [user])

  async function expressInterest(r: Row) {
    setPayError(null)
    setPayingId(r.id)
    const res = await createRentalInterest(r.id)
    setPayingId(null)
    if ('error' in res) {
      setPayError(res.error)
      return
    }
    setInterestId(res.interestId)
    // Take them where the next step actually happens. Telling someone to "go
    // to Tenancy" only works if they know where that is — and Tenancy is not
    // in the tenant's bottom nav.
    router.push('/dashboard/tenancy')
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

  // LIVE, not a one-time read. An inspection is two parties taking turns: the
  // tenant sits on this page after booking while the handler approves from
  // somewhere else entirely. With getDocs the tenant kept reading "Waiting for
  // the handler to approve" long after it had been approved, because nothing
  // ever re-fetched.
  useEffect(() => {
    if (!user) return
    // Rules scope list access to a party on the request, so this query must
    // filter by tenantId — an unscoped read is rejected.
    return onSnapshot(
      query(
        collection(clientDb(), 'inspection_requests'),
        where('tenantId', '==', user.uid),
        orderBy('createdAt', 'desc'),
      ),
      (snap) => {
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
              handlerIsResident: x.landlordLivesInProperty === true,
            }
          }),
        )
      },
    )
  }, [user, reloadKey])

  if (!user) return null

  return (
    <>
      <div>
        {payError && <p className="mb-4 text-sm text-error">{payError}</p>}

        {rows === null ? (
          <p className="text-sm text-content-secondary">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-content-secondary">No inspection requests yet.</p>
            <Link
              href="/properties"
              className="btn-primary mt-5 inline-block px-6 py-3 no-underline"
            >
              Browse properties
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/properties/${r.propertyId}`}
                      className="font-semibold text-content no-underline hover:underline"
                    >
                      {r.propertyTitle}
                    </Link>
                    <p className="text-sm text-content-secondary">{r.propertyAddress}</p>
                  </div>
                  <span className="chip shrink-0">
                    {STATUS_COPY[r.status] ?? r.status}
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
                  {r.totalFee > 0 && <span>{formatNaira(r.totalFee)}</span>}
                </div>

                {r.status === 'approved' && r.paymentStatus === 'unpaid' && (
                  <div className="mt-4 border-t border-divider pt-4">
                    <p className="text-sm text-content-secondary">
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
                  <div className="mt-4 rounded-md bg-surface-secondary p-4">
                    <p className="text-xs text-content-secondary">Exact address</p>
                    <p className="mt-0.5 font-medium text-content">
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

                {/* The step nobody found. It is not a footnote on a finished
                    inspection — it is how a tenancy starts, and nothing else
                    on the platform moves until the tenant does it. Given its
                    own tinted block for that reason. */}
                {/* Already told them — the tenancy is under way, so point at it
                    instead of asking the same question again. */}
                {r.status === 'completed' && claimed.has(r.propertyId) && (
                  <div className="mt-4 border-t border-divider pt-4">
                    <p className="text-sm text-content-secondary">
                      You told the landlord you want to rent this.{' '}
                      <Link href="/dashboard/tenancy" className="text-primary no-underline underline">
                        Track it under Tenancy
                      </Link>
                      .
                    </p>
                  </div>
                )}

                {r.status === 'completed' && r.tenantRated && !claimed.has(r.propertyId) && (
                  <div className="mt-4 rounded-md bg-primary-tint p-4">
                    <p className="font-semibold text-content">Next step — want to rent it?</p>
                    <p className="mt-0.5 text-sm text-content-secondary">
                      Telling the landlord is what starts the tenancy. They cannot offer you
                      the place until you do, and nothing is charged now.
                    </p>
                    <button
                      className="btn-primary mt-3 px-5 py-2.5 text-sm"
                      disabled={payingId === r.id}
                      onClick={() => expressInterest(r)}
                    >
                      {payingId === r.id ? 'Working…' : 'I want to rent this'}
                    </button>
                    {interestId && (
                      <p className="mt-2 text-sm text-primary">
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
    </>
  )
}
