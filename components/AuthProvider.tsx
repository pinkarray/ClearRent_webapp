'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth'
import { clientAuth, initAppCheck } from '../lib/firebase-client'
import { getUserProfile, type UserProfile } from '../lib/user-profile'

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
    // Before any Firebase traffic, so gated callables have a token to send.
    initAppCheck()
    return onAuthStateChanged(clientAuth(), async (u) => {
      setUser(u)
      setProfile(u ? await getUserProfile(u.uid) : null)
      setReady(true)
    })
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
