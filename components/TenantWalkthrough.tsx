'use client'

import { useEffect, useState } from 'react'
import { sealedMoveOutRecord, type WalkthroughRecord } from '../lib/condition'
import { openInNewTab } from '../lib/open-in-new-tab'
import { handoverProofLink } from '../lib/tenancy'

/*
  The former tenant's move-out walkthrough, for the landlord on web. The app
  shows it on the handover screen; web had nothing, so a web landlord was asked
  to check the unit and declare a deduction without ever seeing the recording a
  deduction has to be argued against.

  Media is private to the uploader in Storage, so each file opens through the
  same membership-checked signed link the proof of transfer uses.
*/
export default function TenantWalkthrough({
  rentalId,
  tenantId,
}: {
  rentalId: string
  tenantId: string
}) {
  const [record, setRecord] = useState<WalkthroughRecord | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    sealedMoveOutRecord(rentalId, tenantId)
      .then(setRecord)
      .catch(() => setRecord(null))
  }, [rentalId, tenantId])

  if (record === undefined) return null
  if (record === null) {
    return <p className="mt-2 text-sm text-content-hint">No walkthrough from your former tenant.</p>
  }

  async function open(path: string) {
    setError(null)
    const err = await openInNewTab(() => handoverProofLink(rentalId, path))
    if (err) setError(err)
  }

  return (
    <div className="mt-3">
      <p className="text-sm font-medium text-content">Their move-out walkthrough</p>
      {record.notes && (
        <p className="mt-1 text-sm italic text-content-secondary">&ldquo;{record.notes}&rdquo;</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {record.videoPaths.map((p, i) => (
          <button key={p} className="btn-ghost px-4 py-2 text-sm" onClick={() => void open(p)}>
            Watch video {i + 1}
          </button>
        ))}
        {record.imagePaths.map((p, i) => (
          <button key={p} className="btn-ghost px-4 py-2 text-sm" onClick={() => void open(p)}>
            Photo {i + 1}
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-error">{error}</p>}
    </div>
  )
}
