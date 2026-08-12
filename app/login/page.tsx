'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PhoneOtpForm } from '../../components/PhoneOtpForm'
import { PasswordField } from '../../components/PasswordField'
import { isClientConfigured } from '../../lib/firebase-client'
import { signInWithPassword } from '../../lib/sign-in'

/*
  Password is the default and OTP is the fallback - the reverse of how this page
  started, and it matches the app (`login_screen.dart`: password tabs, with OTP
  reserved for signup).

  The cost argument is the point: OTP-per-login means the auth bill scales with
  how often people come back, so success is punished. One SMS at signup proves
  the number is theirs; passwords carry every sign-in after that.

  OTP stays reachable because it is also the de-facto password recovery path -
  a user who has forgotten their password can still get in with a code.
*/
export default function LoginPage() {
  const router = useRouter()
  const [useCode, setUseCode] = useState(false)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const err = await signInWithPassword(identifier, password)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    router.push('/dashboard')
  }

  return (
    <main className="app-surface min-h-screen bg-bg">
      <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
        <Link
          href="/"
          className="text-sm font-medium text-primary no-underline hover:underline"
        >
          ← ClearRent
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-content">Log in</h1>

        {!isClientConfigured() && (
          <div className="card mt-6 border-l-4 border-l-secondary p-5">
            <p className="font-semibold text-content">Sign-in is unavailable</p>
            <p className="mt-1 text-sm text-content-secondary">
              This deployment is missing its Firebase web configuration. Browsing still works.
            </p>
          </div>
        )}

        <div className="card mt-6 p-6">
          {useCode ? (
            <>
              <p className="mb-4 text-sm text-content-secondary">
                We&apos;ll text you a one-time code. Use this if you have forgotten your
                password.
              </p>
              <PhoneOtpForm onVerified={() => router.push('/dashboard')} submitLabel="Log in" />
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-content">
                  Phone number or email
                </span>
                <input
                  className="input-field mt-1.5 px-4 py-3"
                  // Not type="email": this field legitimately takes a phone
                  // number, and the browser would reject one as malformed.
                  type="text"
                  inputMode="text"
                  autoComplete="username"
                  placeholder="0801 234 5678"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </label>

              <PasswordField
                label="Password"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
              />

              {error && <p className="text-sm text-error">{error}</p>}

              <button className="btn-primary w-full px-6 py-3" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Log in'}
              </button>
            </form>
          )}

          <button
            className="mt-4 w-full text-sm text-content-secondary underline"
            onClick={() => {
              setUseCode(!useCode)
              setError(null)
            }}
          >
            {useCode ? 'Use my password instead' : 'Sign in with a code instead'}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-content-secondary">
          New here?{' '}
          <Link href="/signup" className="font-medium text-primary no-underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  )
}
