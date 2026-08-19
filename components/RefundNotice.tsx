'use client'

import { useEffect, useState } from 'react'
import { watchRefund, type Refund } from '../lib/refunds'

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
}

/**
 * Money owed back on a cancelled or declined inspection, or a rental interest
 * that lost the property.
 *
 * Renders nothing unless a refund record exists, so it is safe to drop onto
 * every row. Refunds are settled by an admin out of band, so the honest thing
 * to show a tenant is that it is queued and for how much — not a promise about
 * when.
 */
export function RefundNotice({ sourceId }: { sourceId: string }) {
  const [refund, setRefund] = useState<Refund | null>(null)

  useEffect(() => {
    // Subscription built in an effect, not in render — a listener created
    // during render re-subscribes on every rebuild.
    const unsub = watchRefund(sourceId, setRefund)
    return () => unsub()
  }, [sourceId])

  if (!refund || refund.status === 'cancelled') return null

  const paid = refund.status === 'paid'
  return (
    <div className="mt-4 border-t border-divider pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-content">
          {paid ? 'Refund sent' : 'Refund due to you'}
        </span>
        <span className={`font-semibold ${paid ? 'text-success' : 'text-primary'}`}>
          {formatNaira(refund.amount)}
        </span>
      </div>
      <p className="mt-1 text-sm text-content-secondary">
        {paid
          ? `Paid to your bank account${
              refund.paidAt
                ? ' on ' +
                  refund.paidAt.toLocaleDateString('en-NG', {
                    day: 'numeric',
                    month: 'short',
                  })
                : ''
            }.`
          : 'Queued for payout to the bank account on your profile. Add one under Bank details if you have not yet.'}
      </p>
    </div>
  )
}
