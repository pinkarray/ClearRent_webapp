'use client'

import { useState } from 'react'
import { submitMoveOutCondition } from '../lib/condition'

/*
  The tenant's move-out walkthrough, on web. Mirrors the app's capture screen:
  a video is required, photos are optional, and once submitted it is sealed.

  `capture` opens the camera on a phone, as the app does, so the recording is of
  the unit now rather than an old clip from the gallery. On a computer it falls
  back to choosing a file, which is the only option there.
*/
export default function MoveOutConditionCapture({
  rentalId,
  uid,
}: {
  rentalId: string
  uid: string
}) {
  const [videos, setVideos] = useState<File[]>([])
  const [images, setImages] = useState<File[]>([])
  const [notes, setNotes] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // No transcoder in the browser, so size is the thing to warn about: a phone
  // records roughly 70 MB a minute, which on mobile data is a very long wait.
  const totalMb = [...videos, ...images].reduce((n, f) => n + f.size, 0) / (1024 * 1024)

  async function submit() {
    if (videos.length === 0) {
      setError('Record a walkthrough video first. It is what protects your deposit.')
      return
    }
    setError(null)
    setProgress(0)
    const result = await submitMoveOutCondition({
      rentalId,
      uid,
      partyRole: 'tenant',
      videos,
      images,
      notes: notes.trim(),
      onProgress: setProgress,
    })
    setProgress(null)
    if (result === 'failed') {
      setError('The upload did not finish. Check your connection and try again - nothing was lost.')
    } else if (result === 'alreadySealed') {
      setError('A walkthrough is already recorded for this tenancy and cannot be replaced.')
    } else if (result === 'stageNotUpdated') {
      setError('Recording saved, but the status did not update. Please contact support.')
    }
    // On success the live rental listener moves the card on by itself.
  }

  const uploading = progress !== null

  return (
    <div className="mt-4 rounded-lg border border-warning/40 bg-warning/5 p-4">
      <p className="font-semibold text-content">Record the condition you left it in</p>
      <p className="mt-1 text-sm text-content-secondary">
        Your walkthrough is what a deduction has to be argued against. Without it, a claim
        on your deposit has nothing to answer to.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <label className={`btn-ghost cursor-pointer px-4 py-2 text-sm ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
          {videos.length === 0 ? 'Record walkthrough video' : `${videos.length} video - add another`}
          <input
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setVideos((v) => [...v, f])
              e.target.value = ''
            }}
          />
        </label>
        <label className={`btn-ghost cursor-pointer px-4 py-2 text-sm ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
          {images.length === 0 ? 'Add close-up photos (optional)' : `${images.length} photo - add another`}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setImages((i) => [...i, f])
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {(videos.length > 0 || images.length > 0) && !uploading && (
        <button
          className="mt-2 text-sm text-content-hint underline"
          onClick={() => {
            setVideos([])
            setImages([])
          }}
        >
          Clear and start again
        </button>
      )}

      <textarea
        className="input-field mt-3 px-3 py-2.5 text-sm"
        rows={2}
        placeholder="Notes (optional) - anything the camera does not show"
        value={notes}
        disabled={uploading}
        onChange={(e) => setNotes(e.target.value)}
      />

      {totalMb > 50 && !uploading && (
        <p className="mt-2 text-xs text-content-hint">
          About {Math.round(totalMb)} MB. On mobile data this can take a while - keep this page
          open until it finishes.
        </p>
      )}

      <p className="mt-2 text-xs text-content-hint">
        Once submitted this cannot be changed or deleted - by you or by the other party. That is
        what makes it worth anything.
      </p>

      {uploading && (
        <div className="mt-3">
          <p className="text-sm text-content-secondary">
            Uploading {Math.round((progress ?? 0) * 100)}% - keep this page open.
          </p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-divider">
            <div className="h-full bg-primary" style={{ width: `${(progress ?? 0) * 100}%` }} />
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-error">{error}</p>}

      <button
        className="btn-primary mt-3 px-5 py-2.5 text-sm"
        disabled={uploading}
        onClick={() => void submit()}
      >
        {uploading ? 'Uploading…' : 'Submit recording'}
      </button>
    </div>
  )
}
