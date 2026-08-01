'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../../components/AuthProvider'
import { formatDate } from '../../../lib/format'
import { landlordEarnings, type Earnings } from '../../../lib/landlord'

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
}

function tone(status: string): string {
  if (status === 'completed') return 'chip-success'
  if (status === 'failed') return 'chip-error'
  return 'chip-pending'
}

export default function EarningsPage() {
  const { user } = useAuth()
  const [data, setData] = useState<Earnings | null>(null)

  useEffect(() => {
    if (!user) return
    ;(async () => setData(await landlordEarnings(user.uid)))()
  }, [user])

  if (!user) return null
  if (!data) return <p className="text-sm text-content-secondary">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total', value: data.total, accent: 'text-content' },
          { label: 'Settled', value: data.completed, accent: 'text-success' },
          { label: 'Pending payout', value: data.pending, accent: 'text-secondary-dark' },
        ].map((stat) => (
          <div key={stat.label} className="card p-5">
            <p className="text-sm text-content-secondary">{stat.label}</p>
            <p className={`mt-1 text-2xl font-bold ${stat.accent}`}>
              {formatNaira(stat.value)}
            </p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
          Transactions
        </h2>
        {data.transactions.length === 0 ? (
          <div className="card mt-3 p-8 text-center">
            <p className="text-content-secondary">No transactions yet.</p>
            <p className="mt-1 text-sm text-content-hint">
              Inspection fees and rent settlements appear here once money moves.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {data.transactions.map((t) => (
              <div
                key={t.id}
                className="card flex flex-wrap items-center justify-between gap-3 p-5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-content">{t.propertyTitle}</p>
                  <p className="truncate text-sm text-content-secondary">
                    {t.tenantName} · {formatDate(t.createdAt)}
                  </p>
                  {t.reference && (
                    <p className="truncate text-xs text-content-hint">{t.reference}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-content">{formatNaira(t.amount)}</p>
                  <span className={`chip ${tone(t.status)}`}>{t.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
