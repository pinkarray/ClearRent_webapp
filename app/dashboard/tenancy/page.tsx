'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../components/AuthProvider'
import { startPayment } from '../../../lib/payments'
import {
  acceptAgreement,
  acceptRentalInterest,
  activeRentals,
  landlordInterests,
  requestMoveOut,
  tenantInterests,
  type ActiveRental,
  type RentalInterest,
} from '../../../lib/tenancy'

const INTEREST_COPY: Record<string, string> = {
  pending_acceptance: 'Waiting for the landlord to accept',
  accepted: 'Accepted',
  rent_paid: 'Rent paid',
  rejected: 'Declined',
}

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
}

/**
 * The tenancy stage: interests awaiting acceptance, then the active rental
 * with its agreement, rent and move-out steps. Shown to both sides — a landlord
 * sees interests to accept, a tenant sees what they owe and can do next.
 */
export default function TenancyPage() {
  const router = useRouter()
  const { user, profile, ready } = useAuth()
  const [interests, setInterests] = useState<RentalInterest[] | null>(null)
  const [rentals, setRentals] = useState<ActiveRental[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isLandlord = profile?.accountType === 'landlord'

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  const load = useCallback(async () => {
    if (!user) return
    const [i, r] = await Promise.all([
      isLandlord ? landlordInterests(user.uid) : tenantInterests(user.uid),
      activeRentals(isLandlord ? 'landlordId' : 'tenantId', user.uid),
    ])
    setInterests(i)
    setRentals(r)
  }, [user, isLandlord])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      await load()
    })()
  }, [user, load])

  async function run(id: string, fn: () => Promise<string | null>) {
    setError(null)
    setBusy(id)
    const err = await fn()
    setBusy(null)
    if (err) setError(err)
    else await load()
  }

  async function payRent(r: ActiveRental) {
    setError(null)
    setBusy(r.id)
    try {
      // Amount is display-only; the server recomputes from the interest.
      await startPayment('rent', r.rentAmount, '/dashboard/tenancy', {
        rentalInterestId: r.rentalInterestId,
        propertyId: r.propertyId,
      })
    } catch (err) {
      setBusy(null)
      setError(err instanceof Error ? err.message : 'Could not start the payment.')
    }
  }

  async function moveOut(r: ActiveRental) {
    const when = window.prompt('Intended move-out date (YYYY-MM-DD)')
    if (!when) return
    const parsed = new Date(`${when}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) {
      setError('That date was not valid.')
      return
    }
    const reason = window.prompt('Reason for moving out') ?? ''
    await run(r.id, () => requestMoveOut(r.id, parsed, reason))
  }

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

        <h1 className="mt-4 text-3xl font-bold text-[var(--text-primary)]">Tenancy</h1>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--text-hint)]">
          Rental interests
        </h2>
        {interests === null ? (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Loading…</p>
        ) : interests.length === 0 ? (
          <div className="card mt-3 p-6 text-center text-sm text-[var(--text-secondary)]">
            {isLandlord
              ? 'No tenants have expressed interest yet.'
              : 'Once you complete and rate an inspection, you can express interest from My inspections.'}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {interests.map((i) => (
              <div key={i.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text-primary)]">{i.propertyTitle}</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {isLandlord ? i.tenantName : formatNaira(i.paymentAmount) + ' total'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--surface-secondary)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                    {INTEREST_COPY[i.status] ?? i.status}
                  </span>
                </div>

                {isLandlord && i.status === 'pending_acceptance' && (
                  <button
                    className="btn-primary mt-4 px-5 py-2.5 text-sm"
                    disabled={busy === i.id}
                    onClick={() => run(i.id, () => acceptRentalInterest(i.id))}
                  >
                    {busy === i.id ? 'Working…' : 'Accept this tenant'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-[var(--text-hint)]">
          Active rentals
        </h2>
        {rentals === null ? (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Loading…</p>
        ) : rentals.length === 0 ? (
          <div className="card mt-3 p-6 text-center text-sm text-[var(--text-secondary)]">
            Nothing active yet.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {rentals.map((r) => (
              <div key={r.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text-primary)]">{r.propertyTitle}</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {formatNaira(r.rentAmount)} · agreement {r.agreementStatus} · rent{' '}
                      {r.rentPaymentStatus}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--surface-secondary)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                    {r.status}
                  </span>
                </div>

                {!isLandlord && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {r.agreementStatus !== 'finalized' && (
                      <button
                        className="btn-primary px-5 py-2.5 text-sm"
                        disabled={busy === r.id}
                        onClick={() => run(r.id, () => acceptAgreement(r.id))}
                      >
                        Accept agreement
                      </button>
                    )}

                    {r.agreementStatus === 'finalized' && r.rentPaymentStatus !== 'paid' && (
                      <button
                        className="btn-primary px-5 py-2.5 text-sm"
                        disabled={busy === r.id}
                        onClick={() => payRent(r)}
                      >
                        Pay rent {formatNaira(r.rentAmount)}
                      </button>
                    )}

                    {r.rentPaymentStatus === 'paid' && r.status === 'active' && (
                      <button
                        className="btn-ghost px-5 py-2.5 text-sm"
                        disabled={busy === r.id}
                        onClick={() => moveOut(r)}
                      >
                        Give move-out notice
                      </button>
                    )}
                  </div>
                )}

                {!isLandlord && r.agreementStatus !== 'finalized' && (
                  <p className="mt-3 text-xs text-[var(--text-hint)]">
                    Accepting the agreement finalizes it — that is what unlocks rent payment.
                    There is no separate landlord step.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
