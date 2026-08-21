'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '../../../../components/AuthProvider'
import { PropertyAgreementSection } from '../../../../components/PropertyAgreementSection'
import { fingerprint } from '../../../../lib/form-state'
import {
  READINESS_ITEMS,
  loadListingForEdit,
  markReadyForInspections,
  saveListingEdits,
  uploadOwnershipDoc,
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
  /**
   * The form as it is stored. Save stays disabled until something differs, so
   * "Saved" is visible state rather than a message that scrolls away — and a
   * landlord cannot fire the same write twice by tapping again.
   */
  const [savedState, setSavedState] = useState<string | null>(null)

  const [docFile, setDocFile] = useState<File | null>(null)
  const [docType, setDocType] = useState<'c_of_o' | 'deed' | 'other'>('c_of_o')
  const [docBusy, setDocBusy] = useState(false)

  const load = useCallback(async () => {
    const l = await loadListingForEdit(propertyId)
    const a = l?.amenities.join(', ') ?? ''
    const r = l?.rules.join(', ') ?? ''
    setListing(l)
    setAmenities(a)
    setRules(r)
    setSavedState(fingerprint([l, a, r]))
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
    if (err) {
      setError(err)
      return
    }
    setMessage('Changes saved.')
    setSavedState(fingerprint([listing, amenities, rules]))
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

  const dirty =
    savedState !== null && fingerprint([listing, amenities, rules]) !== savedState
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
          <Link
            href={`/dashboard/listings/${propertyId}/caretaker`}
            className="btn-ghost px-4 py-2 text-sm no-underline"
          >
            Caretaker
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

          <button
            className="btn-primary w-full px-6 py-3"
            type="submit"
            disabled={busy || !dirty}
          >
            {busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </form>

        {user && (
          <PropertyAgreementSection
            propertyId={propertyId}
            uid={user.uid}
            rent={listing.rent}
          />
        )}

        {/*
          A listing with no document (or a rejected one) is otherwise stuck for
          good: admin gates Verify/Reject on status 'pending', so 'none' offers
          them nothing to act on and the listing can never reach public browse.
          'inherited' units are skipped — their document lives on the building.
        */}
        {listing.ownershipDocStatus !== 'inherited' &&
          listing.ownershipDocStatus !== 'verified' && (
            <div className="card mt-6 p-6">
              <h2 className="font-semibold text-content">Ownership document</h2>

              {listing.ownershipDocStatus === 'pending' ? (
                <p className="mt-1 text-sm text-content-secondary">
                  Submitted. An admin is reviewing it. You can replace it below if you
                  sent the wrong file.
                </p>
              ) : listing.ownershipDocStatus === 'rejected' ? (
                <p className="mt-1 text-sm text-content-secondary">
                  An admin rejected this document
                  {listing.ownershipDocRejectionReason
                    ? `: ${listing.ownershipDocRejectionReason}`
                    : '.'}{' '}
                  Upload a replacement to send it back for review.
                </p>
              ) : (
                <p className="mt-1 text-sm text-content-secondary">
                  This listing has no ownership document, so an admin cannot approve it
                  and it will not reach public browse. Upload one to fix that - a C of O
                  or deed runs to several pages, so send it as one PDF.
                </p>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <select
                  className="input-field px-4 py-3"
                  value={docType}
                  onChange={(e) =>
                    setDocType(e.target.value as 'c_of_o' | 'deed' | 'other')
                  }
                >
                  <option value="c_of_o">Certificate of Occupancy</option>
                  <option value="deed">Deed of Assignment</option>
                  <option value="other">Other property document</option>
                </select>
                <input
                  className="input-field px-4 py-3"
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <button
                className="btn-primary mt-4 w-full px-6 py-3"
                disabled={!docFile || docBusy}
                onClick={async () => {
                  if (!docFile || !user) return
                  setDocBusy(true)
                  setError(null)
                  setMessage(null)
                  const err = await uploadOwnershipDoc(
                    user.uid,
                    propertyId,
                    docFile,
                    docType,
                  )
                  setDocBusy(false)
                  if (err) {
                    setError(err)
                    return
                  }
                  setDocFile(null)
                  setMessage('Document sent for review.')
                  await load()
                }}
              >
                {docBusy ? 'Uploading…' : 'Send for review'}
              </button>
            </div>
          )}

        <div className="card mt-6 p-6">
          <h2 className="font-semibold text-content">Ready for inspections</h2>
          {listing.readyForInspections ? (
            <p className="mt-1 text-sm text-content-secondary">
              This property is vetted and bookable
              {listing.readinessCheckedBy && listing.readinessCheckedBy !== user.uid
                ? ' - your assigned agent confirmed it.'
                : '.'}{' '}
              Tenants can request inspections now.
            </p>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </>
  )
}
