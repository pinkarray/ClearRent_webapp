'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { clientApp, clientDb, initAppCheck } from '../lib/firebase-client'

/**
 * Lets a tenant rate their landlord once the tenancy has ended. The server
 * (rateLandlord) checks they really were the tenant, that it has ended, and
 * that this tenancy has not been rated before. The comment goes to ClearRent;
 * listings only ever show the average, and only while the admin has that
 * switched on.
 */
export default function RateLandlord({ rentalId }: { rentalId: string }) {
  const [rated, setRated] = useState<number | null | undefined>(undefined)
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDoc(doc(clientDb(), 'landlord_reviews', rentalId))
      .then((s) => setRated(s.exists() ? Number(s.data().stars) : null))
      .catch(() => setRated(null))
  }, [rentalId])

  if (rated === undefined) return null
  if (rated !== null) {
    return (
      <p className="mt-4 text-sm text-content-secondary">
        You rated your landlord {rated} ★. Thank you.
      </p>
    )
  }

  async function submit() {
    if (stars < 1) {
      setError('Pick from 1 to 5 stars.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      initAppCheck()
      await httpsCallable(getFunctions(clientApp(), 'us-central1'), 'rateLandlord')({
        rentalId,
        stars,
        comment: comment.trim(),
      })
      setRated(stars)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not go through.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-border p-4">
      <p className="font-semibold text-content">How was your landlord?</p>
      <p className="mt-1 text-sm text-content-secondary">
        Your rating helps the next tenant. Your comment goes to ClearRent only.
      </p>
      <div className="mt-3 flex gap-1" role="radiogroup" aria-label="Stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            onClick={() => setStars(n)}
            className="text-2xl leading-none"
            style={{ color: n <= stars ? 'var(--secondary)' : 'var(--border)' }}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        className="input-field mt-3 w-full px-3 py-2 text-sm"
        rows={2}
        maxLength={500}
        placeholder="Anything ClearRent should know (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button className="btn-primary mt-3 px-5 py-2 text-sm" disabled={busy} onClick={() => void submit()}>
        {busy ? 'Sending…' : 'Submit rating'}
      </button>
    </div>
  )
}
