'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '../../../../../components/AuthProvider'
import {
  OCCUPYING_STATUSES,
  RENT_CHANGE_REASONS,
  fileRentChange,
} from '../../../../../lib/rent-change'
import { landlordRentals, type ActiveRental } from '../../../../../lib/tenancy'

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
}

/**
 * Files a rent change against one tenancy. The landlord cannot approve it —
 * `firestore.rules:1101` reserves that for an admin — so this form ends at
 * "submitted for review", which is the honest outcome.
 */
export default function RentChangePage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams<{ id: string }>()

  const [rental, setRental] = useState<ActiveRental | null | 'missing'>(null)
  const [proposed, setProposed] = useState('')
  const [reasonType, setReasonType] = useState<string>('market')
  const [justification, setJustification] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const all = await landlordRentals(user.uid)
      setRental(all.find((r) => r.id === params.id) ?? 'missing')
    })()
  }, [user, params.id])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !rental || rental === 'missing') return

    const next = Number(proposed)
    if (!Number.isFinite(next) || next <= 0) {
      setError('Enter the new rent as a number.')
      return
    }

    setError(null)
    setBusy(true)
    const err = await fileRentChange({
      landlordId: user.uid,
      propertyId: rental.propertyId,
      propertyTitle: rental.propertyTitle,
      currentRent: rental.rentAmount,
      proposedRent: next,
      reasonType,
      justification,
      // Occupied tenancies get a scheduled review targeting this rental; the
      // server re-checks occupancy, so this is a form choice, not a grant.
      rental: OCCUPYING_STATUSES.includes(rental.status)
        ? { id: rental.id, tenantId: rental.tenantId }
        : undefined,
    })
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setDone(true)
  }

  if (!user) return null
  if (rental === null) return <p className="text-sm text-content-secondary">Loading…</p>

  if (rental === 'missing') {
    return (
      <div className="card p-8 text-center">
        <p className="text-content-secondary">That rental is not one of yours.</p>
        <Link
          href="/dashboard/rentals"
          className="btn-ghost mt-5 inline-block px-6 py-3 no-underline"
        >
          Back to rentals
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="card p-8 text-center">
        <p className="text-lg font-semibold text-content">Submitted for review</p>
        <p className="mt-2 text-sm text-content-secondary">
          An admin reviews every rent change. If approved, the new rent applies at your
          tenant&apos;s next renewal — never mid-lease.
        </p>
        <button
          className="btn-primary mt-6 px-6 py-3"
          onClick={() => router.push('/dashboard/rentals')}
        >
          Back to rentals
        </button>
      </div>
    )
  }

  const occupied = OCCUPYING_STATUSES.includes(rental.status)

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-content">{rental.propertyTitle}</h2>
        <p className="mt-0.5 text-sm text-content-secondary">
          Current rent {formatNaira(rental.rentAmount)} / {rental.rentFrequency}
        </p>
      </div>

      <div className="card border-l-4 border-l-secondary p-5">
        <p className="font-semibold text-content">
          {occupied ? 'Scheduled review' : 'Immediate change'}
        </p>
        <p className="mt-1 text-sm text-content-secondary">
          {occupied
            ? 'This unit is occupied, so an approved increase takes effect at the tenant’s next renewal. Rent never changes mid-lease.'
            : 'This unit is vacant, so an approved change applies to the listing straight away.'}
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-content">New rent</span>
        <input
          className="input-field mt-1.5 px-4 py-3"
          inputMode="numeric"
          required
          placeholder={String(rental.rentAmount)}
          value={proposed}
          onChange={(e) => setProposed(e.target.value.replace(/\D/g, ''))}
        />
      </label>

      <div>
        <span className="text-sm font-medium text-content">Why</span>
        <div className="mt-2 space-y-2">
          {RENT_CHANGE_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReasonType(r.value)}
              className={`block w-full rounded-sm border px-4 py-3 text-left ${
                reasonType === r.value ? 'border-primary bg-primary-tint' : 'border-border'
              }`}
            >
              <span className="block text-sm font-medium text-content">{r.label}</span>
              <span className="block text-xs text-content-secondary">{r.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-content">Justification</span>
        <span className="mt-0.5 block text-xs text-content-hint">
          An admin reads this. Be specific — what changed, and what it cost.
        </span>
        <textarea
          className="input-field mt-1.5 px-4 py-3"
          rows={4}
          required
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
        />
      </label>

      {error && <p className="text-sm text-error">{error}</p>}

      <button className="btn-primary w-full px-6 py-3" type="submit" disabled={busy}>
        {busy ? 'Submitting…' : 'Submit for review'}
      </button>
    </form>
  )
}
