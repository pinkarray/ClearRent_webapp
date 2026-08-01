'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useAuth } from '../../../../../components/AuthProvider'
import { formatDate } from '../../../../../lib/format'
import { canPay, startPayment } from '../../../../../lib/payments'
import { dealFee, tenantLinks } from '../../../../../lib/renewal'
import { tenantRentalHistory } from '../../../../../lib/tenancy'

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
}

type Source = {
  title: string
  address: string
  rent: number
  frequency: string
  end: Date | null
}

/*
  Renewal / promotion checkout, the web counterpart of
  `renewal_payment_screen.dart`.

  The tenant is charged rent + the deal-completion fee. The amount shown is
  computed here for display only — `resolveServerAmount` (pricing.ts:221)
  recomputes `rentAmount + dealFee` from the source document and rejects the
  payment if the caller is not that document's tenant.

  The completion callable is dispatched on the return leg, in
  `/payment/callback`, because it needs a Paystack reference that only exists
  after checkout.
*/
function RenewPage() {
  const { user } = useAuth()
  const params = useParams<{ id: string }>()
  const search = useSearchParams()
  const linked = search.get('linked') === '1'

  const [source, setSource] = useState<Source | null | 'missing'>(null)
  const [fee, setFee] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setFee(await dealFee())
      if (linked) {
        const links = await tenantLinks(user.uid)
        const l = links.find((x) => x.id === params.id)
        setSource(
          l
            ? {
                title: l.propertyTitle,
                address: l.propertyAddress,
                rent: l.rentAmount,
                frequency: l.rentFrequency,
                end: l.leaseEndDate,
              }
            : 'missing',
        )
        return
      }
      const rentals = await tenantRentalHistory(user.uid)
      const r = rentals.find((x) => x.id === params.id)
      setSource(
        r
          ? {
              title: r.propertyTitle,
              address: r.propertyAddress,
              rent: r.rentAmount,
              frequency: r.rentFrequency,
              end: r.leaseEndDate,
            }
          : 'missing',
      )
    })()
  }, [user, params.id, linked])

  async function pay() {
    if (!source || source === 'missing' || fee === null) return
    if (!canPay()) {
      setError(
        'Your account has no email address, which Paystack requires. Add one under your profile first.',
      )
      return
    }
    setError(null)
    setBusy(true)
    try {
      await startPayment('renewal', source.rent + fee, '/dashboard/rentals', {
        sourceId: params.id,
        isLinked: linked,
        propertyTitle: source.title,
      })
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Could not start the payment.')
    }
  }

  if (!user) return null
  if (source === null || fee === null) {
    return <p className="text-sm text-content-secondary">Loading…</p>
  }

  if (source === 'missing') {
    return (
      <div className="card p-8 text-center">
        <p className="text-content-secondary">That tenancy is not on your account.</p>
        <Link
          href="/dashboard/rentals"
          className="btn-ghost mt-5 inline-block px-6 py-3 no-underline"
        >
          Back to my rentals
        </Link>
      </div>
    )
  }

  const total = source.rent + fee

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-content">{source.title}</h2>
        <p className="mt-0.5 text-sm text-content-secondary">{source.address}</p>
        {source.end && (
          <p className="mt-1 text-sm text-content-secondary">
            Current term ends {formatDate(source.end)}
          </p>
        )}
      </div>

      <section className="card px-5 py-1">
        <div className="flex items-baseline justify-between gap-2 border-b border-divider py-3">
          <span className="text-sm text-content-secondary">
            Rent ({source.frequency})
          </span>
          <span className="font-medium text-content">{formatNaira(source.rent)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 border-b border-divider py-3">
          <span className="text-sm text-content-secondary">Deal completion fee</span>
          <span className="font-medium text-content">{formatNaira(fee)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 py-3">
          <span className="font-semibold text-content">Total</span>
          <span className="text-lg font-bold text-primary">{formatNaira(total)}</span>
        </div>
      </section>

      {linked && (
        <div className="card border-l-4 border-l-primary p-5">
          <p className="font-semibold text-content">This moves your tenancy onto ClearRent</p>
          <p className="mt-1 text-sm text-content-secondary">
            Your landlord added you as an existing tenant. Paying here creates a full tenancy
            record, so the agreement, receipts and issue history live in one place from now on.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <button className="btn-primary w-full px-6 py-3" disabled={busy} onClick={pay}>
        {busy ? 'Redirecting to Paystack…' : `Pay ${formatNaira(total)}`}
      </button>

      <p className="text-xs text-content-hint">
        Payment is confirmed with Paystack on our servers before your tenancy is extended.
      </p>
    </div>
  )
}

export default function RenewPageWrapper() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={<p className="text-sm text-content-secondary">Loading…</p>}>
      <RenewPage />
    </Suspense>
  )
}
