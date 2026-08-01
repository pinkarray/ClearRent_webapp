'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../components/AuthProvider'
import { agreementUrl, tenantPayments, type PaymentRecord } from '../../../lib/documents'
import { tenantRentalHistory, type ActiveRental } from '../../../lib/tenancy'

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** The app's Documents screen: agreements on one side, payment receipts on the other. */
export default function DocumentsPage() {
  const { user } = useAuth()
  const [rentals, setRentals] = useState<ActiveRental[] | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const [r, p] = await Promise.all([
        tenantRentalHistory(user.uid),
        tenantPayments(user.uid),
      ])
      setRentals(r)
      setPayments(p)
    })()
  }, [user])

  async function open(rentalId: string) {
    setError(null)
    setBusyId(rentalId)
    const res = await agreementUrl('active_rentals', rentalId)
    setBusyId(null)
    if ('error' in res) {
      setError(res.error)
      return
    }
    window.open(res.url, '_blank', 'noopener,noreferrer')
  }

  if (!user) return null

  const withAgreements = rentals?.filter((r) => r.agreementUrl) ?? []

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
          Tenancy agreements
        </h2>
        {error && <p className="mt-3 text-sm text-error">{error}</p>}
        {rentals === null ? (
          <p className="mt-3 text-sm text-content-secondary">Loading…</p>
        ) : withAgreements.length === 0 ? (
          <div className="card mt-3 p-6 text-center text-sm text-content-secondary">
            No agreements yet. One appears here once your landlord uploads it.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {withAgreements.map((r) => (
              <div
                key={r.id}
                className="card flex flex-wrap items-center justify-between gap-3 p-5"
              >
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/rentals/${r.id}`}
                    className="font-medium text-content no-underline hover:underline"
                  >
                    {r.propertyTitle}
                  </Link>
                  <p className="text-sm text-content-secondary">
                    {formatDate(r.leaseStartDate)} → {formatDate(r.leaseEndDate)}
                  </p>
                </div>
                <button
                  className="btn-ghost shrink-0 px-4 py-2 text-sm"
                  disabled={busyId === r.id}
                  onClick={() => open(r.id)}
                >
                  {busyId === r.id ? 'Opening…' : 'Open'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
          Payments
        </h2>
        {payments === null ? (
          <p className="mt-3 text-sm text-content-secondary">Loading…</p>
        ) : payments.length === 0 ? (
          <div className="card mt-3 p-6 text-center text-sm text-content-secondary">
            Your payment history appears here after you pay on ClearRent.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {payments.map((p) => (
              <div
                key={p.id}
                className="card flex flex-wrap items-center justify-between gap-3 p-5"
              >
                <div className="min-w-0">
                  <p className="font-medium capitalize text-content">
                    {p.type.replace(/_/g, ' ')}
                    {p.propertyTitle ? ` · ${p.propertyTitle}` : ''}
                  </p>
                  <p className="truncate text-sm text-content-secondary">
                    {formatDate(p.createdAt)}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-content">{formatNaira(p.amount)}</p>
                  <span
                    className={`chip ${p.status === 'success' ? 'chip-success' : 'chip-pending'}`}
                  >
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
