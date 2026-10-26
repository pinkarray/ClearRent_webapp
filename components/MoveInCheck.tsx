'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { clientDb } from '../lib/firebase-client'
import { stayFromDoc, type InventoryItem } from '../lib/stay'
import { confirmMoveIn, reportMoveInProblem } from '../lib/tenancy'
import { useAskText } from './AskText'

/**
 * The furnished-stay move-in check, mirroring the app's MoveInCheckCard: the
 * tenant compares the place and its item list with the listing and confirms,
 * or says what does not match. The landlord's payout waits for this, or for
 * the deadline to pass in silence.
 */
export function MoveInCheck({
  rentalId,
  propertyId,
  deadline,
  frozenItems,
}: {
  rentalId: string
  propertyId: string
  deadline: Date | null
  /** The list frozen on the rental at acceptance; preferred over the listing's. */
  frozenItems: InventoryItem[]
}) {
  // Fetched only for a rental from before the list was frozen on it.
  const [fetched, setFetched] = useState<InventoryItem[] | null>(null)
  const items = frozenItems.length > 0 ? frozenItems : fetched
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Shown until the live rental catches up with the server's write.
  const [done, setDone] = useState<string | null>(null)
  const [askText, askDialog] = useAskText()
  // Read once: the clock is not render-pure.
  const [now] = useState(() => Date.now())

  const needsFetch = frozenItems.length === 0
  useEffect(() => {
    if (!needsFetch) return
    getDoc(doc(clientDb(), 'properties', propertyId))
      .then((s) => setFetched(stayFromDoc(s.data() ?? {}).inventory))
      .catch(() => setFetched([]))
  }, [propertyId, needsFetch])

  async function confirm() {
    setBusy(true)
    setError(null)
    const err = await confirmMoveIn(rentalId)
    setBusy(false)
    if (err) setError(err)
    else setDone('Thanks. The landlord will now be paid.')
  }

  async function report() {
    const text = await askText({
      title: 'What does not match?',
      label: 'Say what is missing, broken or different from the listing.',
      cta: 'Send report',
    })
    if (!text) return
    setBusy(true)
    setError(null)
    const err = await reportMoveInProblem(rentalId, text)
    setBusy(false)
    if (err) setError(err)
    else
      setDone(
        'Reported. ClearRent will contact you, and the landlord is not paid until it is settled.',
      )
  }

  const hoursLeft = deadline
    ? Math.max(0, Math.min(48, Math.floor((deadline.getTime() - now) / 3600_000)))
    : null

  return (
    <div className="mt-4 rounded-md p-4" style={{ border: '1px solid var(--primary)' }}>
      <p className="font-semibold text-content">Check the place</p>
      <p className="mt-0.5 text-sm text-content-secondary">
        {done ??
          `Does the place, and everything on this list, match the listing? The landlord is paid once you confirm${
            hoursLeft === null ? '' : `, or in ${hoursLeft} hours if you say nothing`
          }.`}
      </p>
      {!done && (
        <>
          <ul className="mt-3 space-y-2">
            {items === null && <li className="text-sm text-content-hint">Loading the item list…</li>}
            {items?.map((item) => (
              <li key={item.name} className="flex items-center gap-3 text-sm text-content">
                {item.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.photoUrl} alt={item.name} className="h-10 w-10 rounded-md object-cover" />
                ) : (
                  <span className="h-10 w-10 rounded-md bg-surface-secondary" />
                )}
                <span className="flex-1">{item.name}</span>
                <span className="text-content-secondary">× {item.qty}</span>
              </li>
            ))}
          </ul>
          {error && <p className="mt-2 text-sm text-error">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn-ghost px-4 py-2 text-sm" disabled={busy} onClick={report}>
              Something is wrong
            </button>
            <button className="btn-primary px-4 py-2 text-sm" disabled={busy} onClick={confirm}>
              All good
            </button>
          </div>
        </>
      )}
      {askDialog}
    </div>
  )
}
