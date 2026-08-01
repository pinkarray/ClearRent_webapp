'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../components/AuthProvider'
import { handledProperties, type HandledProperty } from '../../../lib/agent'
import { formatNaira, rentPeriod } from '../../../lib/format'

/** Why a property this agent handles is, or is not, bookable. */
function state(p: HandledProperty): { label: string; tone: string } {
  if (p.ownershipDocStatus !== 'verified') {
    return { label: 'Awaiting ownership verification', tone: 'chip-pending' }
  }
  if (!p.readyForInspections) return { label: 'Needs your vetting', tone: 'chip-error' }
  if (!p.isAvailable) return { label: 'Marked unavailable', tone: '' }
  return { label: 'Bookable', tone: 'chip-live' }
}

export default function HandlingPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<HandledProperty[] | null>(null)

  useEffect(() => {
    if (!user) return
    ;(async () => setRows(await handledProperties(user.uid)))()
  }, [user])

  if (!user) return null

  const needsVetting =
    rows?.filter((p) => p.ownershipDocStatus === 'verified' && !p.readyForInspections) ?? []

  return (
    <div className="space-y-6">
      {needsVetting.length > 0 && (
        <div className="card border-l-4 border-l-error p-5">
          <p className="font-semibold text-content">
            {needsVetting.length} propert{needsVetting.length === 1 ? 'y needs' : 'ies need'}{' '}
            vetting
          </p>
          <p className="mt-1 text-sm text-content-secondary">
            A property is not bookable — and you earn nothing from it — until you confirm the
            readiness checklist.
          </p>
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-content-secondary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-content-secondary">You are not handling any properties yet.</p>
          <p className="mt-1 text-sm text-content-hint">
            Landlords choose their handler. Pitch for listings under Leads, and keep your
            coverage current so you show up for the right areas.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard/leads" className="btn-primary px-5 py-2.5 text-sm no-underline">
              Find leads
            </Link>
            <Link href="/dashboard/coverage" className="btn-ghost px-5 py-2.5 text-sm no-underline">
              Set coverage
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => {
            const s = state(p)
            return (
              <Link
                key={p.id}
                href={`/dashboard/handling/${p.id}`}
                className="card block p-5 no-underline"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-content">{p.title}</p>
                    <p className="truncate text-sm text-content-secondary">
                      {p.approximateAddress}
                    </p>
                  </div>
                  <span className={`chip shrink-0 ${s.tone}`}>{s.label}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-content-secondary">
                  <span>
                    {formatNaira(p.rent)}
                    {rentPeriod('yearly')}
                  </span>
                  {p.agentFee > 0 && <span>Your fee {formatNaira(p.agentFee)}</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
