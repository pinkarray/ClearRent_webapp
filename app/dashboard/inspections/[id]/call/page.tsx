'use client'

import { use, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng'
import { useAuth } from '../../../../../components/AuthProvider'
import { joinVideoViewing } from '../../../../../lib/video-viewing'

/**
 * The tenant's side of a video viewing. The host films the property from the
 * app; the tenant watches here, mic on and camera off unless they turn it on.
 * Works in iPhone Safari. The Agora SDK touches `window` at import, so it is
 * loaded only in the browser.
 */
export default function VideoCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, ready } = useAuth()
  const [status, setStatus] = useState('Connecting…')
  const [hasRemote, setHasRemote] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(false)
  // On a bad network the SDK can retry for minutes. After 15s, or a dropped
  // connection, offer a Reconnect that starts over with a fresh token.
  const [lost, setLost] = useState(false)
  const lostTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remoteRef = useRef<HTMLDivElement>(null)
  const localRef = useRef<HTMLDivElement>(null)
  const client = useRef<IAgoraRTCClient | null>(null)
  const mic = useRef<IMicrophoneAudioTrack | null>(null)
  const cam = useRef<ICameraVideoTrack | null>(null)

  useEffect(() => {
    if (!ready || !user) return
    let left = false

    ;(async () => {
      try {
        setStatus('Getting the call details…')
        const creds = await joinVideoViewing(id)
        setStatus('Loading video…')
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
        AgoraRTC.setLogLevel(3) // warnings and errors only
        const c = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
        client.current = c

        c.on('user-published', async (remote, mediaType) => {
          await c.subscribe(remote, mediaType)
          if (mediaType === 'video' && remoteRef.current) {
            remote.videoTrack?.play(remoteRef.current, { fit: 'contain' })
            setHasRemote(true)
          }
          if (mediaType === 'audio') remote.audioTrack?.play()
        })
        c.on('user-unpublished', (_remote, mediaType) => {
          if (mediaType === 'video') setHasRemote(false)
        })
        c.on('user-left', () => {
          setHasRemote(false)
          setStatus('Your host left the call.')
        })
        c.on('connection-state-change', (state, _prev, reason) => {
          if (state === 'RECONNECTING') {
            setStatus('Weak network, reconnecting…')
            lostTimer.current ??= setTimeout(() => setLost(true), 15000)
          } else if (state === 'CONNECTED') {
            if (lostTimer.current) clearTimeout(lostTimer.current)
            lostTimer.current = null
            setLost(false)
          } else if (state === 'DISCONNECTED' && reason !== 'LEAVE') {
            setLost(true)
          }
        })

        setStatus('Joining the call…')
        // On a bad network join can retry for a long time; say so rather than
        // leaving the page on a spinner.
        await Promise.race([
          c.join(creds.appId, creds.channel, creds.token, creds.uid),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Could not reach the video service. Check your connection (mobile data often works better than weak Wi-Fi) and try again.')),
              30000,
            ),
          ),
        ])
        if (left) return
        mic.current = await AgoraRTC.createMicrophoneAudioTrack()
        await c.publish([mic.current])
        setStatus('Waiting for your host’s video…')
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Could not join the call.')
      }
    })()

    return () => {
      left = true
      if (lostTimer.current) clearTimeout(lostTimer.current)
      mic.current?.close()
      cam.current?.close()
      void client.current?.leave()
    }
  }, [id, ready, user])

  async function toggleMic() {
    if (!mic.current) return
    await mic.current.setEnabled(!micOn)
    setMicOn(!micOn)
  }

  async function toggleCamera() {
    const c = client.current
    if (!c) return
    if (!cameraOn) {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
      cam.current ??= await AgoraRTC.createCameraVideoTrack({ encoderConfig: '360p_1' })
      await cam.current.setEnabled(true)
      if (!c.localTracks.includes(cam.current)) await c.publish([cam.current])
      if (localRef.current) cam.current.play(localRef.current)
    } else {
      await cam.current?.setEnabled(false)
    }
    setCameraOn(!cameraOn)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="relative flex-1">
        <div ref={remoteRef} className="absolute inset-0" />
        {!hasRemote && (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-white/70">
            {status}
          </p>
        )}
        {lost && (
          <div className="absolute inset-x-6 top-24 rounded-2xl bg-black/80 p-4 text-center">
            <p className="text-sm">Connection lost. Mobile data is often better than weak Wi-Fi.</p>
            {/* A reload rejoins from scratch with a fresh token. */}
            <button
              className="mt-3 rounded-full bg-white/20 px-5 py-2 text-sm"
              onClick={() => window.location.reload()}
            >
              Reconnect
            </button>
          </div>
        )}
        <div
          ref={localRef}
          className={`absolute right-4 top-4 h-40 w-28 overflow-hidden rounded-xl bg-white/10 ${cameraOn ? '' : 'hidden'}`}
        />
      </div>
      <div className="flex items-center justify-center gap-4 p-6">
        <button className="rounded-full bg-white/20 px-5 py-3 text-sm" onClick={() => void toggleMic()}>
          {micOn ? 'Mute' : 'Unmute'}
        </button>
        <button className="rounded-full bg-white/20 px-5 py-3 text-sm" onClick={() => void toggleCamera()}>
          {cameraOn ? 'Camera off' : 'Camera on'}
        </button>
        <Link className="rounded-full bg-red-600 px-5 py-3 text-sm" href="/dashboard/inspections">
          Leave
        </Link>
      </div>
    </div>
  )
}
