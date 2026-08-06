'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AgreementUpload from './AgreementUpload'
import { useAuth } from './AuthProvider'
import { formatDate } from '../lib/format'
import { confirmMoveOut, watchActiveRentals, type ActiveRental } from '../lib/tenancy'

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
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

  if (!user) return null

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-error">{error}</p>}

      {rows === null ? (
        <p className="text-sm text-content-secondary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-content-secondary">No tenants yet.</p>
          {/* It appears on ACCEPTANCE, not on payment — rental_interest_ops
              creates it there. The old copy told landlords to wait for a
              payment that cannot happen until they have uploaded an agreement
              from this very page. */}
          <p className="mt-1 text-sm text-content-hint">
            A rental appears here as soon as you accept a tenant — that is where you upload
            the tenancy agreement.
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
              <AgreementUpload rental={r} />
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
