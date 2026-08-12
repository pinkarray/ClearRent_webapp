'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from './AuthProvider'
import { formatDate } from '../lib/format'
import { isRenewable, tenantLinks } from '../lib/renewal'
import { tenantRentalHistory } from '../lib/tenancy'

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
}

/*
  Both rental sources in one list, as `TenantRental` does in the app: an
  `active_rentals` doc (the full inspection → rent funnel) and a confirmed
  `tenancy_links` doc (a landlord-added tenant whose rent is collected off
  platform until they renew here). They renew through different callables, so
  the origin is carried through rather than flattened away.
*/
type Row = {
  id: string
  linked: boolean
  title: string
  address: string
  rent: number
  frequency: string
  status: string
  start: Date | null
  end: Date | null
}

function tone(status: string): string {
  if (status === 'active') return 'chip-live'
  if (isRenewable(status)) return 'chip-pending'
  if (status === 'moveout_pending' || status === 'moveOutRequested') return 'chip-pending'
  return ''
}

function label(status: string): string {
  if (status === 'expiring_soon') return 'Expiring soon'
  if (status === 'grace_locked') return 'Term ended - renew'
  return status.replace(/_/g, ' ')
}

export default function TenantRentals() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const [rentals, links] = await Promise.all([
        tenantRentalHistory(user.uid),
        tenantLinks(user.uid),
      ])
      setRows([
        ...rentals.map((r) => ({
          id: r.id,
          linked: false,
          title: r.propertyTitle,
          address: r.propertyAddress,
          rent: r.rentAmount,
          frequency: r.rentFrequency,
          status: r.status,
          start: r.leaseStartDate,
          end: r.leaseEndDate,
        })),
        ...links.map((l) => ({
          id: l.id,
          linked: true,
          title: l.propertyTitle,
          address: l.propertyAddress,
          rent: l.rentAmount,
          frequency: l.rentFrequency,
          // A confirmed link past its term is renewable in exactly the same
          // way; the server decides, so derive the same signal from the dates.
          status:
            l.leaseEndDate && l.leaseEndDate.getTime() < Date.now()
              ? 'grace_locked'
              : 'active',
          start: l.leaseStartDate,
          end: l.leaseEndDate,
        })),
      ])
    })()
  }, [user])

  if (!user) return null

  return (
    <div>
      {rows === null ? (
        <p className="text-sm text-content-secondary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-content-secondary">You have no rentals yet.</p>
          <Link href="/properties" className="btn-primary mt-5 inline-block px-6 py-3 no-underline">
            Browse properties
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={`${r.linked ? 'link' : 'rental'}-${r.id}`} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-content">{r.title}</p>
                  <p className="truncate text-sm text-content-secondary">{r.address}</p>
                </div>
                <span className={`chip shrink-0 ${tone(r.status)}`}>{label(r.status)}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-content-secondary">
                <span>
                  {formatNaira(r.rent)} / {r.frequency}
                </span>
                <span>
                  {formatDate(r.start)} → {formatDate(r.end)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {!r.linked && (
                  <Link
                    href={`/dashboard/rentals/${r.id}`}
                    className="btn-ghost px-4 py-2 text-sm no-underline"
                  >
                    Lease details
                  </Link>
                )}
                {isRenewable(r.status) && (
                  <Link
                    href={`/dashboard/rentals/${r.id}/renew?linked=${r.linked ? '1' : '0'}`}
                    className="btn-primary px-4 py-2 text-sm no-underline"
                  >
                    Renew
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
