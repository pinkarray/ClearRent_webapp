'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStorage, ref, uploadBytes } from 'firebase/storage'
import { useAuth } from './AuthProvider'
import { clientApp } from '../lib/firebase-client'
import { agreementUrl } from '../lib/documents'
import { formatDate } from '../lib/format'
import {
  attachAgreement,
  confirmMoveOut,
  watchActiveRentals,
  type ActiveRental,
} from '../lib/tenancy'

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
}

function agreementTone(status: string): string {
  if (status === 'finalized') return 'chip-success'
  if (status === 'disputed') return 'chip-error'
  if (status === 'pending_review' || status === 'accepted') return 'chip-info'
  return 'chip-pending'
}

/*
  The landlord's tenants, and the agreement workflow that sits on each one.

  Combines the app's Rentals and Agreements screens: they read the same
  `active_rentals` documents and the agreement is the main thing a landlord does
  to a rental, so splitting them across two web routes would just mean two
  identical lists.
*/
export default function LandlordRentals() {
  const { user } = useAuth()
  const [rows, setRows] = useState<ActiveRental[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deduction, setDeduction] = useState<
    Record<string, { amount?: string; reason?: string }>
  >({})

  const uid = user?.uid

  // Live: every step shown here is the TENANT's move — accepting the
  // agreement, disputing it, paying rent, giving move-out notice. A one-time
  // read meant the landlord sat on a stale card for all of them.
  useEffect(() => {
    if (!uid) return
    return watchActiveRentals('landlordId', uid, (rentals) =>
      setRows(
        [...rentals].sort(
          (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
        ),
      ),
    )
  }, [uid])

  async function upload(rentalId: string, file: File) {
    if (!user) return
    setError(null)
    setBusyId(rentalId)
    try {
      // Same path shape the app writes (`property_service.dart:112`); storage
      // rules only permit a write under the uploader's own uid.
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'pdf'
      const path = `agreements/${user.uid}/agreement_${Date.now()}.${ext}`
      await uploadBytes(ref(getStorage(clientApp()), path), file)
      const err = await attachAgreement(rentalId, path)
      if (err) {
        setError(err)
        return
      }
      // The listener delivers the updated card.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmHandover(rentalId: string) {
    setError(null)
    setBusyId(rentalId)
    const d = deduction[rentalId] ?? {}
    const err = await confirmMoveOut(rentalId, {
      cautionDeductionAmount: d.amount ? Number(d.amount) : 0,
      cautionDeductionReason: d.reason,
    })
    setBusyId(null)
    if (err) setError(err)
  }

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

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-error">{error}</p>}

      {rows === null ? (
        <p className="text-sm text-content-secondary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-content-secondary">No tenants yet.</p>
          <p className="mt-1 text-sm text-content-hint">
            A rental appears here once you accept a tenant and they pay.
          </p>
        </div>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-content">{r.propertyTitle}</p>
                <p className="truncate text-sm text-content-secondary">{r.propertyAddress}</p>
              </div>
              <span className={`chip shrink-0 ${r.status === 'active' ? 'chip-live' : ''}`}>
                {r.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-content-secondary">
              <span>{formatNaira(r.rentAmount)} / {r.rentFrequency}</span>
              <span>
                {formatDate(r.leaseStartDate)} → {formatDate(r.leaseEndDate)}
              </span>
              <span>Rent {r.rentPaymentStatus}</span>
            </div>

            <div className="mt-4 border-t border-divider pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-content">Tenancy agreement</p>
                  <span className={`chip mt-1 ${agreementTone(r.agreementStatus)}`}>
                    {r.agreementStatus.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  {r.agreementUrl && (
                    <button
                      className="btn-ghost px-4 py-2 text-sm"
                      disabled={busyId === r.id}
                      onClick={() => open(r.id)}
                    >
                      {busyId === r.id ? 'Opening…' : 'Open'}
                    </button>
                  )}

                  {/* Re-upload stays available: a corrected document is the
                      normal fix when a tenant disputes the terms. */}
                  <label className="btn-primary cursor-pointer px-4 py-2 text-sm">
                    {busyId === r.id
                      ? 'Uploading…'
                      : r.agreementUrl
                        ? 'Replace'
                        : 'Upload agreement'}
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      disabled={busyId === r.id}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void upload(r.id, f)
                      }}
                    />
                  </label>
                </div>
              </div>

              {r.agreementStatus === 'disputed' && (
                <div className="mt-3">
                  <p className="text-sm text-error">
                    The tenant raised concerns with this agreement. Upload a corrected version.
                  </p>
                  {r.tenantDisputeReason && (
                    <p className="mt-1 text-sm text-content-secondary">
                      “{r.tenantDisputeReason}”
                    </p>
                  )}
                </div>
              )}
            </div>

            {/*
              Move-out handover. The tenant has given notice; confirming ends
              the tenancy and frees the unit. If the landlord never acts, the
              auto-confirm sweep does this server-side — so this is a shortcut,
              not a veto, which is why there is no "reject" here.
            */}
            {r.status === 'moveout_pending' && (
              <div className="mt-4 border-t border-divider pt-4">
                <p className="text-sm font-medium text-content">Move-out requested</p>
                <p className="mt-1 text-sm text-content-secondary">
                  Confirm once you have taken back the keys. If you do nothing this
                  confirms itself after the notice period.
                </p>

                {r.cautionDeposit > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-content-secondary">
                      Caution deposit on record: {formatNaira(r.cautionDeposit)}. It is
                      returned in full unless you declare a deduction — ClearRent never
                      holds this money, so this is a record, not a transfer.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <input
                        type="number"
                        min={0}
                        max={r.cautionDeposit}
                        placeholder="Withhold (₦0)"
                        className="input-field w-40 px-3 py-2 text-sm"
                        value={deduction[r.id]?.amount ?? ''}
                        onChange={(e) =>
                          setDeduction((d) => ({
                            ...d,
                            [r.id]: { ...d[r.id], amount: e.target.value },
                          }))
                        }
                      />
                      <input
                        type="text"
                        placeholder="Reason (required if withholding)"
                        className="input-field min-w-0 flex-1 px-3 py-2 text-sm"
                        value={deduction[r.id]?.reason ?? ''}
                        onChange={(e) =>
                          setDeduction((d) => ({
                            ...d,
                            [r.id]: { ...d[r.id], reason: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                )}

                <button
                  className="btn-primary mt-3 px-5 py-2.5 text-sm"
                  disabled={busyId === r.id}
                  onClick={() => void confirmHandover(r.id)}
                >
                  {busyId === r.id ? 'Confirming…' : 'Confirm move-out'}
                </button>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/dashboard/listings/${r.propertyId}`}
                className="btn-ghost px-4 py-2 text-sm no-underline"
              >
                View listing
              </Link>
              <Link
                href={`/dashboard/rentals/${r.id}/rent-change`}
                className="btn-ghost px-4 py-2 text-sm no-underline"
              >
                Request rent change
              </Link>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
