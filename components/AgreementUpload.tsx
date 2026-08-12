'use client'

import { useState } from 'react'
import { getStorage, ref, uploadBytes } from 'firebase/storage'
import { useAuth } from './AuthProvider'
import { clientApp } from '../lib/firebase-client'
import { agreementUrl } from '../lib/documents'
import { attachAgreement, type ActiveRental } from '../lib/tenancy'

/*
  The landlord's half of the agreement, as a self-contained block.

  It was previously only inside LandlordRentals, i.e. on /dashboard/rentals -
  but the landlord's preceding action, accepting the tenant, happens on
  /dashboard/tenancy. So the moment they finished accepting, the next thing they
  had to do was on a page nothing pointed at, and in a live run the owner hunted
  for it. Extracting it means the upload can sit on both screens rather than
  being a place you must first know exists.

  Owns its own busy/error state so either host can drop it in without
  co-ordinating a shared spinner.
*/
function agreementTone(status: string): string {
  if (status === 'finalized') return 'chip-success'
  if (status === 'disputed') return 'chip-error'
  if (status === 'pending_review' || status === 'accepted') return 'chip-info'
  return 'chip-pending'
}

/** What the landlord is actually waiting on, in their own terms. */
function statusLine(r: ActiveRental): string {
  if (!r.agreementUrl) {
    return 'Your tenant cannot accept - and cannot pay rent - until you upload the signed tenancy agreement here.'
  }
  if (r.agreementStatus === 'disputed') {
    return 'Your tenant sent this back. Upload a corrected version to put it in front of them again.'
  }
  if (r.agreementStatus === 'finalized') {
    return 'Accepted by your tenant. Rent is unlocked.'
  }
  return 'Uploaded. Waiting for your tenant to read and accept it - that is what unlocks rent.'
}

export default function AgreementUpload({ rental }: { rental: ActiveRental }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState<'upload' | 'open' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    if (!user) return
    setError(null)
    setBusy('upload')
    try {
      // Same path shape the app writes (`property_service.dart:112`); storage
      // rules only permit a write under the uploader's own uid.
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'pdf'
      const path = `agreements/${user.uid}/agreement_${Date.now()}.${ext}`
      await uploadBytes(ref(getStorage(clientApp()), path), file)
      const err = await attachAgreement(rental.id, path)
      if (err) setError(err)
      // The host's snapshot listener delivers the updated card.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setBusy(null)
    }
  }

  async function open() {
    setError(null)
    setBusy('open')
    const res = await agreementUrl('active_rentals', rental.id)
    setBusy(null)
    if ('error' in res) {
      setError(res.error)
      return
    }
    window.open(res.url, '_blank', 'noopener,noreferrer')
  }

  const missing = !rental.agreementUrl

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-content">Tenancy agreement</p>
          <span className={`chip mt-1 ${agreementTone(rental.agreementStatus)}`}>
            {missing ? 'not uploaded' : rental.agreementStatus.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          {rental.agreementUrl && (
            <button
              className="btn-ghost px-4 py-2 text-sm"
              disabled={busy !== null}
              onClick={() => void open()}
            >
              {busy === 'open' ? 'Opening…' : 'Open'}
            </button>
          )}

          {/* Re-upload stays available: a corrected document is the normal fix
              when a tenant disputes the terms. */}
          <label
            className={`${
              missing || rental.agreementStatus === 'disputed' ? 'btn-primary' : 'btn-ghost'
            } cursor-pointer px-4 py-2 text-sm`}
          >
            {busy === 'upload'
              ? 'Uploading…'
              : rental.agreementUrl
                ? 'Replace'
                : 'Upload agreement'}
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              disabled={busy !== null}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void upload(f)
              }}
            />
          </label>
        </div>
      </div>

      <p className="mt-2 text-sm text-content-secondary">{statusLine(rental)}</p>

      {rental.agreementStatus === 'disputed' && rental.tenantDisputeReason && (
        <p className="mt-1 text-sm text-content-secondary">
          “{rental.tenantDisputeReason}”
        </p>
      )}

      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </div>
  )
}
