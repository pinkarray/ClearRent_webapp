'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '../../../../components/AuthProvider'
import {
  READINESS_ITEMS,
  loadListingForEdit,
  markReadyForInspections,
  saveListingEdits,
  type EditableListing,
} from '../../../../lib/listing-ops'

function csv(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function EditListingPage() {

  const params = useParams<{ id: string }>()
  const propertyId = params.id
  const { user } = useAuth()

  const [listing, setListing] = useState<EditableListing | null>(null)
  const [amenities, setAmenities] = useState('')
  const [rules, setRules] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    const l = await loadListingForEdit(propertyId)
    setListing(l)
    setAmenities(l?.amenities.join(', ') ?? '')
    setRules(l?.rules.join(', ') ?? '')
  }, [propertyId])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      await load()
    })()
  }, [user, load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!listing) return
    setError(null)
    setMessage(null)
    setBusy(true)
    const err = await saveListingEdits(propertyId, {
      ...listing,
      amenities: csv(amenities),
      rules: csv(rules),
    })
    setBusy(false)
    if (err) setError(err)
    else setMessage('Changes saved.')
  }

  async function handleMarkReady() {
    setError(null)
    setMessage(null)
    setBusy(true)
    const err = await markReadyForInspections(propertyId, confirmed)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setMessage('Marked ready for inspections.')
    await load()
  }

  if (!user || !listing) {
    return <p className="text-sm text-content-secondary">Loading…</p>
  }

  const frozen = listing.currentTenantsCount > 0
  const set = <K extends keyof EditableListing>(k: K, v: EditableListing[K]) =>
    setListing((l) => (l ? { ...l, [k]: v } : l))

  return (
    <>
      <div>
        <p className="truncate text-lg font-semibold text-content">{listing.title}</p>

        <div className="mb-6 mt-3 flex flex-wrap gap-3">
          <Link
            href={`/dashboard/listings/${propertyId}/health`}
            className="btn-ghost px-4 py-2 text-sm no-underline"
          >
            Property health
          </Link>
          <Link
            href={`/dashboard/listings/${propertyId}/agent`}
            className="btn-ghost px-4 py-2 text-sm no-underline"
          >
            Assign an agent
          </Link>
        </div>

        {frozen && (
          <div className="card mb-6 border-l-4 border-l-secondary p-5">
            <p className="font-semibold text-content">
              Money terms are locked
            </p>
            <p className="mt-1 text-sm text-content-secondary">
              This property has {listing.currentTenantsCount} sitting tenant
              {listing.currentTenantsCount === 1 ? '' : 's'}. Rent, agent fee and the caution
              deposit are part of the deal they accepted, so they cannot change until the unit
              is empty.
            </p>
          </div>
        )}

        <form onSubmit={handleSave} className="card mt-6 space-y-4 p-6">
          <label className="block">
            <span className="text-sm font-medium text-content">Title</span>
            <input
              className="input-field mt-1.5 px-4 py-3"
              value={listing.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-content">Description</span>
            <textarea
              className="input-field mt-1.5 px-4 py-3"
              rows={4}
              value={listing.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-content">Rent (₦)</span>
              <input
                className="input-field mt-1.5 px-4 py-3"
                type="number"
                disabled={frozen}
                value={listing.rent}
                onChange={(e) => set('rent', Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-content">
                Agent fee (₦)
              </span>
              <input
                className="input-field mt-1.5 px-4 py-3"
                type="number"
                disabled={frozen}
                value={listing.agentFee}
                onChange={(e) => set('agentFee', Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-content">
                Caution deposit (₦)
              </span>
              <input
                className="input-field mt-1.5 px-4 py-3"
                type="number"
                disabled={frozen}
                value={listing.cautionDeposit}
                onChange={(e) => set('cautionDeposit', Number(e.target.value))}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-content">
            <input
              type="checkbox"
              disabled={frozen}
              checked={listing.cautionDepositRefundable}
              onChange={(e) => set('cautionDepositRefundable', e.target.checked)}
            />
            Caution deposit is refundable at move-out
          </label>

          <label className="block">
            <span className="text-sm font-medium text-content">Amenities</span>
            <input
              className="input-field mt-1.5 px-4 py-3"
              value={amenities}
              onChange={(e) => setAmenities(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-content">House rules</span>
            <input
              className="input-field mt-1.5 px-4 py-3"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-content">
            <input
              type="checkbox"
              checked={listing.isAvailable}
              onChange={(e) => set('isAvailable', e.target.checked)}
            />
            Available for rent
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-primary">{message}</p>}

          <button className="btn-primary w-full px-6 py-3" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        <div className="card mt-6 p-6">
          <h2 className="font-semibold text-content">Ready for inspections</h2>
          <p className="mt-1 text-sm text-content-secondary">
            A listing is only bookable once you have vetted it. Confirm every item.
          </p>
          <div className="mt-4 space-y-2">
            {READINESS_ITEMS.map((item) => (
              <label
                key={item.key}
                className="flex items-start gap-2 text-sm text-content"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmed[item.key] === true}
                  onChange={(e) =>
                    setConfirmed((c) => ({ ...c, [item.key]: e.target.checked }))
                  }
                />
                {item.label}
              </label>
            ))}
          </div>
          <button
            className="btn-ghost mt-5 w-full px-6 py-3"
            onClick={handleMarkReady}
            disabled={busy}
          >
            Mark ready for inspections
          </button>
        </div>
      </div>
    </>
  )
}
