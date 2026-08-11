'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PhoneOtpForm } from '../../components/PhoneOtpForm'
import { PasswordField } from '../../components/PasswordField'
import { useAuth } from '../../components/AuthProvider'
import {
  linkEmailPassword,
  saveAccountType,
  saveUserProfile,
  type AccountType,
} from '../../lib/user-profile'

const ACCOUNT_TYPES: { id: AccountType; label: string; blurb: string }[] = [
  { id: 'landlord', label: 'Landlord', blurb: 'I have property to rent out.' },
  { id: 'tenant', label: 'Tenant', blurb: 'I am looking for a place to rent.' },
  { id: 'agent', label: 'Agent', blurb: 'I handle inspections for landlords.' },
]

const INCOME_RANGES = [
  { id: 'below_100k', label: 'Below ₦100K' },
  { id: '100k_200k', label: '₦100K – ₦200K' },
  { id: '200k_500k', label: '₦200K – ₦500K' },
  { id: '500k_1m', label: '₦500K – ₦1M' },
  { id: 'above_1m', label: 'Above ₦1M' },
]

type Step = 'type' | 'phone' | 'profile'

export default function SignupPage() {
  const router = useRouter()
  const { user, refreshProfile } = useAuth()

  const [step, setStep] = useState<Step>('type')
  const [accountType, setAccountType] = useState<AccountType | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [occupation, setOccupation] = useState('')
  const [employer, setEmployer] = useState('')
  const [incomeRange, setIncomeRange] = useState('')
  const [baseLocation, setBaseLocation] = useState('')
  const [serviceAreas, setServiceAreas] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleVerified(uid: string) {
    if (accountType) await saveAccountType(uid, accountType)
    setStep('profile')
  }

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !accountType) return
    setError(null)
    // A mistyped password is not recoverable from this screen: the account is
    // already created against the phone, and this password is the only way to
    // sign in by email afterwards. Catch it here rather than at the next
    // sign-in, weeks later, with no idea what was typed.
    if (password !== confirmPassword) {
      setError('Those passwords do not match.')
      return
    }
    setBusy(true)
    try {
      // Must happen before the profile write: payments read the email off the
      // AUTH token, not off the user doc.
      const linkError = await linkEmailPassword(email.trim(), password)
      if (linkError) {
        setError(linkError)
        setBusy(false)
        return
      }

      await saveUserProfile(user.uid, {
        fullName: fullName.trim(),
        email: email.trim(),
        accountType,
        authPhone: user.phoneNumber,
        occupation: occupation.trim() || undefined,
        employer: employer.trim() || undefined,
        incomeRange: incomeRange || undefined,
        baseLocation: baseLocation.trim() || undefined,
        serviceAreas: serviceAreas
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      })
      await refreshProfile()
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mesh-bg min-h-screen">
      <div className="container max-w-md py-16">
        <Link
          href="/"
          className="text-sm font-medium text-primary no-underline hover:underline"
        >
          ← ClearRent
        </Link>

        <div className="mt-4 flex items-center gap-2">
          {(['type', 'phone', 'profile'] as Step[]).map((s, i) => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full"
              style={{
                background:
                  (['type', 'phone', 'profile'] as Step[]).indexOf(step) >= i
                    ? 'var(--primary)'
                    : 'var(--border)',
              }}
            />
          ))}
        </div>

        {step === 'type' && (
          <>
            <h1 className="mt-6 text-2xl font-bold text-content">
              How will you use ClearRent?
            </h1>
            <div className="mt-6 space-y-3">
              {ACCOUNT_TYPES.map((t) => (
                <button
                  key={t.id}
                  className="card w-full p-5 text-left"
                  style={{
                    borderColor: accountType === t.id ? 'var(--primary)' : 'var(--border)',
                    borderWidth: accountType === t.id ? 2 : 1,
                  }}
                  onClick={() => setAccountType(t.id)}
                >
                  <span className="font-semibold text-content">{t.label}</span>
                  <span className="mt-1 block text-sm text-content-secondary">
                    {t.blurb}
                  </span>
                </button>
              ))}
            </div>
            <button
              className="btn-primary mt-6 w-full px-6 py-3"
              disabled={!accountType}
              onClick={() => setStep('phone')}
            >
              Continue
            </button>
          </>
        )}

        {step === 'phone' && (
          <>
            <h1 className="mt-6 text-2xl font-bold text-content">
              Verify your phone
            </h1>
            <p className="mt-2 text-sm text-content-secondary">
              This is how you will sign in, on web and in the app.
            </p>
            <div className="card mt-6 p-6">
              <PhoneOtpForm onVerified={handleVerified} submitLabel="Verify" />
            </div>
            <button
              className="mt-4 w-full text-sm text-content-secondary underline"
              onClick={() => setStep('type')}
            >
              Back
            </button>
          </>
        )}

        {step === 'profile' && (
          <>
            <h1 className="mt-6 text-2xl font-bold text-content">
              Tell us about you
            </h1>
            <form onSubmit={handleProfile} className="card mt-6 space-y-4 p-6">
              <label className="block">
                <span className="text-sm font-medium text-content">Full name</span>
                <input
                  className="input-field mt-1.5 px-4 py-3"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-content">Email</span>
                <span className="mt-0.5 block text-xs text-content-hint">
                  Receipts and payments use this address.
                </span>
                {/* `username`, not `email`: this address IS the sign-in
                    identifier, and browsers use a username field next to a
                    new-password field to recognise a REGISTRATION form. That
                    recognition is what makes them offer to generate and save a
                    strong password — with `email` alone many simply don't. */}
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
                hint="At least 6 characters. Lets you sign in by email as well as phone."
                autoComplete="new-password"
                minLength={6}
                value={password}
                onChange={setPassword}
              />

              <PasswordField
                label="Confirm password"
                hint="Type it again so a slip on the keyboard doesn't lock you out."
                autoComplete="new-password"
                minLength={6}
                value={confirmPassword}
                onChange={setConfirmPassword}
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-xs text-red-500">
                  These do not match yet.
                </p>
              )}

              {accountType === 'tenant' && (
                <>
                  <label className="block">
                    <span className="text-sm font-medium text-content">
                      Occupation
                    </span>
                    <input
                      className="input-field mt-1.5 px-4 py-3"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-content">
                      Employer
                    </span>
                    <input
                      className="input-field mt-1.5 px-4 py-3"
                      value={employer}
                      onChange={(e) => setEmployer(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-content">
                      Monthly income
                    </span>
                    <select
                      className="input-field mt-1.5 px-4 py-3"
                      value={incomeRange}
                      onChange={(e) => setIncomeRange(e.target.value)}
                    >
                      <option value="">Prefer not to say</option>
                      {INCOME_RANGES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              {accountType === 'agent' && (
                <>
                  <label className="block">
                    <span className="text-sm font-medium text-content">
                      Base location
                    </span>
                    <input
                      className="input-field mt-1.5 px-4 py-3"
                      value={baseLocation}
                      onChange={(e) => setBaseLocation(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-content">
                      Service areas
                    </span>
                    <span className="mt-0.5 block text-xs text-content-hint">
                      Comma separated.
                    </span>
                    <input
                      className="input-field mt-1.5 px-4 py-3"
                      value={serviceAreas}
                      onChange={(e) => setServiceAreas(e.target.value)}
                    />
                  </label>
                </>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
              <button className="btn-primary w-full px-6 py-3" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Finish'}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-content-secondary">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary no-underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  )
}
