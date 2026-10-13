import { getFunctions, httpsCallable } from 'firebase/functions'
import { clientApp, initAppCheck } from './firebase-client'

/** What the call page needs to join the Agora channel. */
export type VideoCallCredentials = {
  appId: string
  channel: string
  uid: number
  token: string
}

/**
 * Joins a video viewing the host has already opened from the app (the host
 * must start it there: it checks their GPS against the property's confirmed
 * pin). Joining is also what records the tenant's arrival. Throws with the
 * server's message when the call isn't open yet or isn't theirs.
 */
export async function joinVideoViewing(requestId: string): Promise<VideoCallCredentials> {
  initAppCheck()
  const res = await httpsCallable<{ requestId: string }, VideoCallCredentials>(
    getFunctions(clientApp(), 'us-central1'),
    'joinVideoViewing',
  )({ requestId })
  return res.data
}
