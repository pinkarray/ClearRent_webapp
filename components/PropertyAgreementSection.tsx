'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getPropertyAgreement,
  isAgreementStale,
  removePropertyAgreement,
  savePropertyAgreement,
  type PropertyAgreement,
} from '../lib/property-agreement'

/**
 * The tenancy agreement kept against a property, uploadable before any tenant
 * exists.
 *
 * Mirrors the app's "My properties" agreements tab. Whatever is on file here is
 * copied onto a tenancy automatically when the landlord accepts someone
 * (`createRentalForAcceptedInterest`), so accepting no longer waits on finding
 * and uploading a document.
 */
export function PropertyAgreementSection({
  propertyId,
  uid,
  rent,
}: {
  propertyId: string
  uid: string
  rent: number
}) {
  const [agreement, setAgreement] = useState<PropertyAgreement | null | 'loading'>(
    'loading',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setAgreement(await getPropertyAgreement(propertyId))
  }, [propertyId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Clear immediately so re-picking the same file still fires onChange.
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return

    setError(null)
    setBusy(true)
    // Stamped with the rent it was written for, so a later rent review is
    // detectable rather than silently binding a new tenant to the old price.
    const err = await savePropertyAgreement(uid, propertyId, file, rent)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    await load()
  }

  async function handleRemove() {
    if (
      !confirm(
        'Remove this agreement? New tenants will no longer get it automatically. ' +
          'Tenancies that already have it keep their copy.',
      )
    ) {
      return
    }
    setError(null)
    setBusy(true)
    const err = await removePropertyAgreement(propertyId)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    await load()
  }

  const has = agreement !== null && agreement !== 'loading'
  const stale = has && isAgreementStale(agreement, rent)

  return (
    <div className="card mt-6 p-6">
      <h2 className="font-semibold text-content">Tenancy agreement</h2>
      <p className="mt-1 text-sm text-content-secondary">
        Sign your agreement and upload it here. Everyone you accept gets that signed
        copy automatically, prints it, signs it and sends it back — so the returned
        document carries both signatures and you never sign twice.
      </p>

      {agreement === 'loading' ? (
        <p className="mt-4 text-sm text-content-secondary">Loading…</p>
      ) : (
        <>
          <div
            className={`mt-4 rounded-md border-l-4 p-4 text-sm ${
              !has
                ? 'border-l-border bg-surface-secondary text-content-secondary'
                : stale
                  ? 'border-l-secondary bg-surface-secondary text-content'
                  : 'border-l-primary bg-surface-secondary text-content'
            }`}
          >
            {!has
              ? 'No signed agreement on file yet.'
              : stale
                ? 'Rent has changed since this was uploaded, so it will NOT be sent automatically. Replace it with one showing the new rent.'
                : 'On file — the next tenant you accept gets this to sign and return.'}
          </div>

          {error && <p className="mt-3 text-sm text-error">{error}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost px-5 py-2.5 text-sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy
                ? 'Uploading…'
                : has
                  ? 'Replace agreement'
                  : 'Upload signed agreement'}
            </button>
            {has && (
              <button
                type="button"
                className="btn-ghost px-5 py-2.5 text-sm text-error"
                disabled={busy}
                onClick={() => void handleRemove()}
              >
                Remove
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            aria-label="Tenancy agreement file"
            onChange={(e) => void handleFile(e)}
          />
        </>
      )}
    </div>
  )
}
