'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '../../../../components/AuthProvider'
import { agreementUrl } from '../../../../lib/documents'
import { tenantRentalHistory, type ActiveRental } from '../../../../lib/tenancy'

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-divider py-3 last:border-0">
      <span className="text-sm text-content-secondary">{label}</span>
      <span className="text-right font-medium text-content">{value}</span>
    </div>
  )
}

/** The app's Lease Details screen — the terms of one tenancy, plus its agreement. */
export default function LeaseDetailsPage() {
  const { user } = useAuth()
  const params = useParams<{ id: string }>()
  const [rental, setRental] = useState<ActiveRental | null | 'missing'>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      // Rules scope active_rentals reads to the parties on the rental, so the
      // tenant's own list is the cheapest way to fetch one by id.
      const all = await tenantRentalHistory(user.uid)
      setRental(all.find((r) => r.id === params.id) ?? 'missing')
    })()
  }, [user, params.id])

  async function openAgreement() {
    setError(null)
    setBusy(true)
    const res = await agreementUrl('active_rentals', params.id)
    setBusy(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    window.open(res.url, '_blank', 'noopener,noreferrer')
  }

  if (!user) return null

  if (rental === null) return <p className="text-sm text-content-secondary">Loading…</p>

  if (rental === 'missing') {
    return (
      <div className="card p-8 text-center">
        <p className="text-content-secondary">That rental is not on your account.</p>
        <Link href="/dashboard/rentals" className="btn-ghost mt-5 inline-block px-6 py-3 no-underline">
          Back to my rentals
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-content">{rental.propertyTitle}</h2>
        <p className="mt-0.5 text-sm text-content-secondary">{rental.propertyAddress}</p>
      </div>

      <section className="card px-5 py-1">
        <Row label="Status" value={rental.status} />
        <Row label="Rent" value={`${formatNaira(rental.rentAmount)} / ${rental.rentFrequency}`} />
        {rental.agentFee > 0 && <Row label="Agent fee" value={formatNaira(rental.agentFee)} />}
        <Row label="Total paid" value={formatNaira(rental.totalPaid)} />
        <Row label="Lease start" value={formatDate(rental.leaseStartDate)} />
        <Row label="Lease end" value={formatDate(rental.leaseEndDate)} />
        <Row label="Next payment due" value={formatDate(rental.nextPaymentDue)} />
        <Row label="Landlord" value={rental.landlordName || '—'} />
        {rental.landlordPhone && <Row label="Landlord phone" value={rental.landlordPhone} />}
      </section>

      <section className="card p-6">
        <h3 className="font-semibold text-content">Tenancy agreement</h3>
        <p className="mt-1 text-sm text-content-secondary">
          Status: {rental.agreementStatus}. The document is held in private storage and opened
          through a short-lived signed link.
        </p>
        {error && <p className="mt-3 text-sm text-error">{error}</p>}
        <button
          className="btn-primary mt-4 px-5 py-2.5 text-sm"
          disabled={busy || !rental.agreementUrl}
          onClick={openAgreement}
        >
          {busy ? 'Opening…' : rental.agreementUrl ? 'Open agreement' : 'No agreement uploaded yet'}
        </button>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/issues" className="btn-ghost px-5 py-2.5 text-sm no-underline">
          Report an issue
        </Link>
        <Link href="/dashboard/tenancy" className="btn-ghost px-5 py-2.5 text-sm no-underline">
          Rent and move-out
        </Link>
      </div>
    </div>
  )
}
