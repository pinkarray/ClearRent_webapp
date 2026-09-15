'use client'

import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { getStorage, ref, uploadBytesResumable } from 'firebase/storage'
import { clientApp, clientDb } from './firebase-client'

/*
  The move-out walkthrough, on web. A port of the app's ConditionService.submit:
  same document, same Storage paths, same seal, so either surface can read what
  the other recorded.

  Before this a web-only tenant could not record it at all, and the handover sat
  at `awaiting_evidence` until they found a phone with the app on it.
*/

/** `stageNotUpdated`: sealed, but the handover did not move on. Not retryable. */
export type ConditionSubmitResult = 'success' | 'alreadySealed' | 'failed' | 'stageNotUpdated'

/** The extension off the file NAME, reduced to letters and digits. */
function extOf(file: File, fallback: string): string {
  return (file.name.split('.').pop() ?? '').replace(/[^a-z0-9]/gi, '') || fallback
}

/**
 * Writes the record FIRST, marked pending, then uploads, then seals. A video on
 * a mobile connection is the thing most likely to fail, and this way a failed
 * attempt still exists and can be retried: rules only refuse edits once
 * `capturedAt` is set.
 *
 * [onProgress] reports 0..1 across the whole submission, not per file.
 */
export async function submitMoveOutCondition(opts: {
  rentalId: string
  uid: string
  partyRole: 'tenant' | 'landlord'
  videos: File[]
  images: File[]
  notes: string
  onProgress: (fraction: number) => void
}): Promise<ConditionSubmitResult> {
  const { rentalId, uid, videos, images } = opts
  if (videos.length === 0 && images.length === 0) return 'failed'
  const record = doc(clientDb(), 'active_rentals', rentalId, 'condition', 'move_out', 'parties', uid)

  // A sealed record can never be replaced; say so rather than let the write
  // come back as a denial that reads like a bad connection.
  try {
    const existing = await getDoc(record)
    if (existing.exists() && existing.data().capturedAt) return 'alreadySealed'
  } catch {
    // Best-effort; the write below still maps a refusal.
  }

  try {
    await setDoc(
      record,
      { partyRole: opts.partyRole, notes: opts.notes, pending: true, createdAt: serverTimestamp() },
      { merge: true },
    )
  } catch (err) {
    return (err as { code?: string }).code === 'permission-denied' ? 'alreadySealed' : 'failed'
  }

  const total = [...videos, ...images].reduce((n, f) => n + f.size, 0)
  let sent = 0
  const storage = getStorage(clientApp())

  function put(path: string, file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(ref(storage, path), file)
      task.on(
        'state_changed',
        (s) => total > 0 && opts.onProgress(Math.min((sent + s.bytesTransferred) / total, 1)),
        reject,
        () => {
          sent += file.size
          resolve()
        },
      )
    })
  }

  const videoPaths: string[] = []
  const imagePaths: string[] = []
  try {
    // Must match the Storage rule and getConditionMediaUrl:
    // condition/{uid}/{rentalId}/{mediaId}.
    for (let i = 0; i < videos.length; i++) {
      const path = `condition/${uid}/${rentalId}/move_out_video_${Date.now()}_${i}.${extOf(videos[i], 'mp4')}`
      await put(path, videos[i])
      videoPaths.push(path)
    }
    for (let i = 0; i < images.length; i++) {
      const path = `condition/${uid}/${rentalId}/move_out_image_${Date.now()}_${i}.${extOf(images[i], 'jpg')}`
      await put(path, images[i])
      imagePaths.push(path)
    }
  } catch {
    // Left pending and unsealed, so a retry is still allowed.
    return 'failed'
  }

  try {
    // capturedAt seals it.
    await setDoc(
      record,
      { videoPaths, imagePaths, pending: false, capturedAt: serverTimestamp() },
      { merge: true },
    )
  } catch {
    return 'failed'
  }

  // Only the tenant's recording is what the landlord is waiting on. Same write
  // as the app's handoverEvidenceRecorded.
  if (opts.partyRole === 'tenant') {
    try {
      await updateDoc(doc(clientDb(), 'active_rentals', rentalId), {
        handoverStage: 'awaiting_condition',
        handoverEvidenceAt: serverTimestamp(),
        handoverEvidencePending: false,
        updatedAt: serverTimestamp(),
      })
    } catch {
      return 'stageNotUpdated'
    }
  }
  return 'success'
}

export type WalkthroughRecord = { videoPaths: string[]; imagePaths: string[]; notes: string }

/**
 * One party's SEALED move-out record, or null if there is none yet. A pending
 * record is not evidence - its upload may never have landed - so it is skipped.
 */
export async function sealedMoveOutRecord(
  rentalId: string,
  partyId: string,
): Promise<WalkthroughRecord | null> {
  const snap = await getDoc(
    doc(clientDb(), 'active_rentals', rentalId, 'condition', 'move_out', 'parties', partyId),
  )
  const x = snap.data()
  if (!x?.capturedAt) return null
  return {
    videoPaths: (x.videoPaths as string[]) ?? [],
    imagePaths: (x.imagePaths as string[]) ?? [],
    notes: (x.notes as string) ?? '',
  }
}
