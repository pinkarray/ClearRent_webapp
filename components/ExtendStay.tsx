'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { clientDb } from '../lib/firebase-client'
import { startPayment } from '../lib/payments'
import { formatNairaFull } from '../lib/format'

/**
 * Extends a furnished stay, mirroring the app's extend sheet: pick more months
 * (up to the listing's longest stay), pay rent only. The payment callback
 * calls completeStayExtension, which re-verifies and moves the end date. The
 * server prices it from the rental; the total here is what it will charge.
 */
export function ExtendStay({
  rentalId,
  propertyId,
  propertyTitle,
  stayMonths,
  monthlyRent,
  leaseEndDate,
}: {
  rentalId: string
  propertyId: string
  propertyTitle: string
  stayMonths: number
  monthlyRent: number
  leaseEndDate: Date | null
}) {
  const [maxStay, setMaxStay] = useState<number | null>(null)
  // config/pricing.extensionFee; the server charges it either way.
  const [fee, setFee] = useState(2500)
  const [months, setMonths] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDoc(doc(clientDb(), 'properties', propertyId))
      .then((s) => {
        const m = s.data()?.maxStayMonths
        setMaxStay(typeof m === 'number' ? m : 11)
      })
      .catch(() => setMaxStay(11))
    getDoc(doc(clientDb(), 'config', 'pricing'))
      .then((s) => {
        const f = s.data()?.extensionFee
        if (typeof f === 'number') setFee(f)
      })
      .catch(() => {})
  }, [propertyId])

  if (maxStay === null) return null
  const room = Math.max(0, maxStay - stayMonths)

  async function pay() {
    setBusy(true)
    setError(null)
    try {
      await startPayment('extension', monthlyRent * months + fee, '/dashboard/tenancy', {
        sourceId: rentalId,
        months,
        propertyTitle,
        description: `Stay extension for ${propertyTitle}`,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the payment.')
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-md bg-surface-secondary p-4">
      <p className="font-semibold text-content">
        Your stay ends {leaseEndDate ? leaseEndDate.toLocaleDateString('en-GB') : 'soon'}
      </p>
      {room === 0 ? (
        <p className="mt-0.5 text-sm text-content-secondary">
          This stay is already as long as the landlord allows.
        </p>
      ) : (
        <>
          <p className="mt-0.5 text-sm text-content-secondary">
            Extend it: you pay the rent for the extra months, which all goes to the landlord, plus
            a {formatNairaFull(fee)} processing fee. Up to {maxStay} months in all; you have{' '}
            {stayMonths}.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select
              className="input-field w-auto px-3 py-2 text-sm"
              value={months}
              disabled={busy}
              onChange={(e) => setMonths(Number(e.target.value))}
              aria-label="Months to add"
            >
              {Array.from({ length: room }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m} more month{m === 1 ? '' : 's'}
                </option>
              ))}
            </select>
            <button className="btn-primary px-4 py-2 text-sm" disabled={busy} onClick={pay}>
              {busy ? 'Working…' : `Pay ${formatNairaFull(monthlyRent * months + fee)} and extend`}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-error">{error}</p>}
        </>
      )}
    </div>
  )
}
