import { doc, onSnapshot } from 'firebase/firestore'
import { clientDb } from './firebase-client'

/**
 * Money owed back to a tenant — a cancelled or declined inspection, or a rental
 * interest that lost the property to someone else.
 *
 * Records are created SERVER-SIDE by triggers (`admin_money_ops.ts`) with
 * `status: 'pending'` and the beneficiary's bank details, then settled by an
 * admin via `markRefundPaid`. Clients never create or mutate them — the rules
 * allow `create: if false` — so this is read-only by design.
 *
 * Doc id is the SOURCE id: `refunds/{inspectionRequestId}` for an inspection,
 * `refunds/{rentalInterestId}` for a losing interest. That is why this is a
 * doc-get and not a query: the rules deliberately forbid collection-wide
 * listing to anyone but an admin.
 *
 * Web showed none of this. A tenant whose inspection was cancelled had money
 * owed to them and no way to see that it was coming, which the app has
 * surfaced on its inspections screen all along.
 */
export type Refund = {
  id: string
  status: 'pending' | 'paid' | 'cancelled'
  amount: number
  reason: string
  propertyTitle: string | null
  paidAt: Date | null
}

/** Live refund for a source doc (inspection request or rental interest). */
export function watchRefund(
  sourceId: string,
  cb: (r: Refund | null) => void,
): () => void {
  return onSnapshot(
    doc(clientDb(), 'refunds', sourceId),
    (snap) => {
      if (!snap.exists()) {
        cb(null)
        return
      }
      const d = snap.data()
      cb({
        id: snap.id,
        status: (d.status as Refund['status']) ?? 'pending',
        amount: typeof d.amount === 'number' ? d.amount : 0,
        reason: (d.reason as string) ?? '',
        propertyTitle: (d.propertyTitle as string) ?? null,
        paidAt: d.paidAt?.toDate?.() ?? null,
      })
    },
    // A denial here means the doc isn't ours or doesn't exist yet; treat it as
    // "no refund" rather than surfacing a permission error to the tenant.
    () => cb(null),
  )
}
