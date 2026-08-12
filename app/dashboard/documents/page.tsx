'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../components/AuthProvider'
import {
  agreementStatusLabel,
  agreementUrl,
  isPaid,
  paymentTypeLabel,
  tenantPayments,
  type PaymentRecord,
} from '../../../lib/documents'
import { tenantRentalHistory, type ActiveRental } from '../../../lib/tenancy'
import { tenantLinks, type TenancyLink } from '../../../lib/renewal'

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
}

function formatDate(d: Date | null): string {
  if (!d) return '-'
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(d: Date | null): string {
  if (!d) return '-'
  return d.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * The app's Documents screen: agreements on one side, payment receipts on the
 * other.
 *
 * Kept deliberately at parity with `documents_screen.dart` — the same
 * agreements (including landlord-LINKED tenancies, which web used to omit
 * entirely), the same status wording, the same paid-total summary and the same
 * tappable receipt.
 */
export default function DocumentsPage() {
  const { user } = useAuth()
  const [rentals, setRentals] = useState<ActiveRental[] | null>(null)
  const [links, setLinks] = useState<TenancyLink[]>([])
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<PaymentRecord | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const [r, l, p] = await Promise.all([
        tenantRentalHistory(user.uid),
        // A landlord-linked tenancy carries its own agreement. The app shows
        // these beside rental agreements; without them a linked tenant saw an
        // empty Documents page and had no way to reach their own lease.
        tenantLinks(user.uid).catch(() => []),
        tenantPayments(user.uid),
      ])
      setRentals(r)
      setLinks(l)
      setPayments(p)
    })()
  }, [user])

  async function open(collectionName: 'active_rentals' | 'tenancy_links', id: string) {
    setError(null)
    setBusyId(id)
    const res = await agreementUrl(collectionName, id)
    setBusyId(null)
    if ('error' in res) {
      setError(res.error)
      return
    }
    window.open(res.url, '_blank', 'noopener,noreferrer')
  }

  async function share(collectionName: 'active_rentals' | 'tenancy_links', id: string, title: string) {
    setError(null)
    setBusyId(id)
    const res = await agreementUrl(collectionName, id)
    setBusyId(null)
    if ('error' in res) {
      setError(res.error)
      return
    }
    const text = `${title}\n${res.url}`
    // navigator.share exists on phones and almost nowhere on desktop, so the
    // clipboard is the fallback rather than a dead button.
    if (navigator.share) {
      await navigator.share({ title, text }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(text).catch(() => {})
    setError('Agreement link copied to your clipboard.')
  }

  async function copyReference(reference: string) {
    await navigator.clipboard.writeText(reference).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!user) return null

  const withAgreements = rentals?.filter((r) => r.agreementUrl) ?? []
  const linkedWithAgreements = links.filter((l) => l.agreementUrl)
  const agreementCount = withAgreements.length + linkedWithAgreements.length

  const paid = payments?.filter((p) => isPaid(p.status)) ?? []
  const totalPaid = paid.reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
          Tenancy agreements
        </h2>
        {error && <p className="mt-3 text-sm text-error">{error}</p>}
        {rentals === null ? (
          <p className="mt-3 text-sm text-content-secondary">Loading…</p>
        ) : agreementCount === 0 ? (
          <div className="card mt-3 p-6 text-center text-sm text-content-secondary">
            No agreements yet. One appears here once your landlord uploads it.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {withAgreements.map((r) => (
              <div key={r.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/rentals/${r.id}`}
                      className="font-medium text-content no-underline hover:underline"
                    >
                      {r.propertyTitle}
                    </Link>
                    <p className="text-sm text-content-secondary">
                      {formatDate(r.leaseStartDate)} → {formatDate(r.leaseEndDate)}
                    </p>
                    <p className="text-sm text-content-secondary">
                      {r.landlordName} · {formatNaira(r.rentAmount)}/
                      {r.rentFrequency === 'yearly' ? 'yr' : 'mo'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      className="btn-ghost px-4 py-2 text-sm"
                      disabled={busyId === r.id}
                      onClick={() => open('active_rentals', r.id)}
                    >
                      {busyId === r.id ? 'Opening…' : 'Open'}
                    </button>
                    <button
                      className="btn-ghost px-4 py-2 text-sm"
                      disabled={busyId === r.id}
                      onClick={() =>
                        share(
                          'active_rentals',
                          r.id,
                          `Tenancy Agreement - ${r.propertyTitle}`,
                        )
                      }
                    >
                      Share
                    </button>
                  </div>
                </div>
                <p className="mt-3 border-t border-border pt-3 text-sm text-content-secondary">
                  {agreementStatusLabel(r.agreementStatus)}
                </p>
              </div>
            ))}

            {linkedWithAgreements.map((l) => (
              <div key={l.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-content">{l.propertyTitle}</p>
                    <p className="text-sm text-content-secondary">
                      {formatDate(l.leaseStartDate)} → {formatDate(l.leaseEndDate)}
                    </p>
                    <p className="text-sm text-content-secondary">
                      {l.landlordName} · {formatNaira(l.rentAmount)}/
                      {l.rentFrequency === 'yearly' ? 'yr' : 'mo'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="chip chip-success">Linked</span>
                    <button
                      className="btn-ghost px-4 py-2 text-sm"
                      disabled={busyId === l.id}
                      onClick={() => open('tenancy_links', l.id)}
                    >
                      {busyId === l.id ? 'Opening…' : 'Open'}
                    </button>
                    <button
                      className="btn-ghost px-4 py-2 text-sm"
                      disabled={busyId === l.id}
                      onClick={() =>
                        share('tenancy_links', l.id, `Tenancy Agreement - ${l.propertyTitle}`)
                      }
                    >
                      Share
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
          Payments
        </h2>
        {payments === null ? (
          <p className="mt-3 text-sm text-content-secondary">Loading…</p>
        ) : payments.length === 0 ? (
          <div className="card mt-3 p-6 text-center text-sm text-content-secondary">
            Your payment history appears here after you pay on ClearRent.
          </div>
        ) : (
          <>
            <div className="card mt-3 flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-content-secondary">Total paid</p>
                <p className="text-2xl font-semibold text-primary">
                  {formatNaira(totalPaid)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold text-content">{paid.length}</p>
                <p className="text-xs text-content-secondary">transactions</p>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {payments.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setReceipt(p)}
                  className="card flex w-full flex-wrap items-center justify-between gap-3 p-5 text-left"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-content">
                      {paymentTypeLabel(p.type)}
                      {p.propertyTitle ? ` · ${p.propertyTitle}` : ''}
                    </p>
                    <p className="truncate text-sm text-content-secondary">
                      {formatDate(p.createdAt)}
                      {p.reference ? ` · ${p.reference}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-content">{formatNaira(p.amount)}</p>
                    <span className={`chip ${isPaid(p.status) ? 'chip-success' : 'chip-pending'}`}>
                      {isPaid(p.status) ? 'Paid' : p.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {receipt && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Payment receipt"
          onClick={() => setReceipt(null)}
        >
          <div
            className="card w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-sm font-semibold uppercase tracking-wide text-content-hint">
              Payment receipt
            </p>
            <p className="mt-3 text-center text-3xl font-semibold text-content">
              {formatNaira(receipt.amount)}
            </p>
            <p className="mt-2 text-center">
              <span className={`chip ${isPaid(receipt.status) ? 'chip-success' : 'chip-pending'}`}>
                {isPaid(receipt.status) ? 'Successful' : receipt.status}
              </span>
            </p>

            <dl className="mt-5 space-y-2 rounded-md bg-surface-secondary p-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-content-secondary">Type</dt>
                <dd className="text-right text-content">{paymentTypeLabel(receipt.type)}</dd>
              </div>
              {receipt.propertyTitle && (
                <div className="flex justify-between gap-3">
                  <dt className="text-content-secondary">Property</dt>
                  <dd className="text-right text-content">{receipt.propertyTitle}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-content-secondary">Date</dt>
                <dd className="text-right text-content">{formatDateTime(receipt.createdAt)}</dd>
              </div>
              {receipt.userEmail && (
                <div className="flex justify-between gap-3">
                  <dt className="text-content-secondary">Email</dt>
                  <dd className="break-all text-right text-content">{receipt.userEmail}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-content-secondary">Reference</dt>
                <dd className="break-all text-right text-content">
                  {receipt.reference}
                  <button
                    type="button"
                    onClick={() => void copyReference(receipt.reference)}
                    className="ml-2 text-xs text-primary underline"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </dd>
              </div>
            </dl>

            <button
              type="button"
              className="btn-ghost mt-5 w-full px-4 py-3 text-sm"
              onClick={() => setReceipt(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
