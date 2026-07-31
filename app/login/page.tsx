'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { PhoneOtpForm } from '../../components/PhoneOtpForm'
import { PasswordField } from '../../components/PasswordField'
import { clientAuth } from '../../lib/firebase-client'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'phone' | 'email'>('phone')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signInWithEmailAndPassword(clientAuth(), email.trim(), password)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mesh-bg min-h-screen">
      <div className="container max-w-md py-16">
        <Link
          href="/"
          className="text-sm font-medium text-[var(--primary)] no-underline hover:underline"
        >
          ← ClearRent
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-[var(--text-primary)]">Log in</h1>

        <div className="mt-6 flex gap-2">
          {(['phone', 'email'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setError(null)
              }}
              className="flex-1 rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium"
              style={{
                background: mode === m ? 'var(--primary)' : 'var(--surface-secondary)',
                color: mode === m ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {m === 'phone' ? 'Phone' : 'Email'}
            </button>
          ))}
        </div>

        <div className="card mt-4 p-6">
          {mode === 'phone' ? (
            <PhoneOtpForm onVerified={() => router.push('/dashboard')} submitLabel="Log in" />
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-[var(--text-primary)]">Email</span>
                <input
                  className="input-field mt-1.5 px-4 py-3"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <PasswordField
                label="Password"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button className="btn-primary w-full px-6 py-3" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Log in'}
              </button>
              <p className="text-xs text-[var(--text-hint)]">
                Most accounts sign in by phone. Email works only for accounts that were given a
                password, which is mainly staff.
              </p>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          New here?{' '}
          <Link href="/signup" className="font-medium text-[var(--primary)] no-underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  )
}
