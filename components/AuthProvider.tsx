'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { clientAuth, clientDb, initAppCheck, isClientConfigured } from '../lib/firebase-client'
import { getUserProfile, type UserProfile } from '../lib/user-profile'
import { disablePush } from '../lib/push'

type AuthState = {
  user: User | null
  profile: UserProfile | null
  /** False until Firebase has restored any persisted session. */
  ready: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // This provider wraps the WHOLE app, including pages that never touch
    // Firebase. Throwing here would blank the marketing and legal pages over a
    // missing client env var, so an unconfigured deploy degrades to "signed
    // out" instead. Auth-dependent pages surface it themselves.
    if (!isClientConfigured()) {
      console.error(
        'Firebase web config missing — NEXT_PUBLIC_FIREBASE_* is not set. Sign-in is unavailable.',
      )
      // Async so the "ready" flip is not a synchronous setState in the effect
      // body; the page still settles on its first paint.
      ;(async () => setReady(true))()
      return
    }

    // Before any Firebase traffic, so gated callables have a token to send.
    initAppCheck()

    // LIVE, not a one-shot read.
    //
    // This was `getUserProfile` once per sign-in, so the profile a page saw
    // was whatever was true when the tab loaded. Anything the SERVER changed
    // afterwards was invisible until a full reload — and the case that bit
    // was verification: finalizeWebVerification sets verificationStatus to
    // 'pending', the cached profile still said nothing, so the verification
    // page fell back to 'none', re-rendered the empty form, and invited a
    // second NIN submission and a SECOND payment for an application that was
    // already paid for and queued.
    //
    // Every page reading `profile` benefits — verification status, account
    // type, bank-details flag — so this is fixed here rather than per screen.
    let unsubProfile: (() => void) | null = null
    const unsubAuth = onAuthStateChanged(clientAuth(), (u) => {
      setUser(u)
      unsubProfile?.()
      unsubProfile = null
      if (!u) {
        setProfile(null)
        setReady(true)
        return
      }
      unsubProfile = onSnapshot(
        doc(clientDb(), 'users', u.uid),
        (snap) => {
          setProfile(
            snap.exists()
              ? ({ uid: u.uid, ...(snap.data() as Omit<UserProfile, 'uid'>) })
              : null,
          )
          setReady(true)
        },
        (err) => {
          // Never leave the app stuck on a loading gate because the stream
          // dropped; pages handle a null profile already.
          console.error('Profile stream failed', err)
          setReady(true)
        },
      )
    })

    return () => {
      unsubProfile?.()
      unsubAuth()
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      ready,
      refreshProfile: async () => {
        if (user) setProfile(await getUserProfile(user.uid))
      },
      signOut: async () => {
        // Detach this browser's push token FIRST, while the user is still
        // authenticated — the users-doc write needs their auth. Skipping it
        // would leave a shared device receiving the previous user's
        // notifications forever.
        if (user) await disablePush(user.uid)
        await fbSignOut(clientAuth())
      },
    }),
    [user, profile, ready],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
