'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../components/AuthProvider'
import { SECOND_DOCUMENT, submitVerification } from '../../../lib/verification'
import type { AccountType } from '../../../lib/user-profile'

const STATUS_COPY: Record<string, { title: string; body: string; tone: 'ok' | 'wait' | 'bad' }> = {
  verified: {
    title: 'You are verified',
    body: 'You can book inspections and rent.',
    tone: 'ok',
  },
  pending: {
    title: 'Under review',
    body: 'An admin is reviewing your documents. You will be able to book inspections once approved.',
    tone: 'wait',
  },
  rejected: {
    title: 'Verification was rejected',
    body: 'Check the details below and submit again.',
    tone: 'bad',
  },
}

export default function VerificationPage() {
  const router = useRouter()
  const { user, profile, ready, refreshProfile } = useAuth()

  const [nin, setNin] = useState('')
  const [ninSlip, setNinSlip] = useState<File | null>(null)
  const [secondDocument, setSecondDocument] = useState<File | null>(null)
  const [guarantorId, setGuarantorId] = useState<File | null>(null)
  const [experienceProof, setExperienceProof] = useState<File | null>(null)
  const [guarantorName, setGuarantorName] = useState('')
  const [guarantorPhone, setGuarantorPhone] = useState('')
  const [guarantorAddress, setGuarantorAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const accountType = profile?.accountType as AccountType | undefined

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !ninSlip || !secondDocument || !accountType) return
    setError(null)
    setBusy(true)
    const err = await submitVerification(user.uid, {
      accountType,
      nin,
      ninSlip,
      secondDocument,
      guarantorId,
      guarantor:
        accountType === 'agent'
          ? {
              name: guarantorName.trim(),
              phone: guarantorPhone.trim(),
              address: guarantorAddress.trim(),
              experienceProof,
            }
          : undefined,
    })
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setDone(true)
    await refreshProfile()
  }

  if (!ready || !user) {
    return (
      <main className="mesh-bg min-h-screen">
        <div className="container py-16 text-[var(--text-secondary)]">Loading…</div>
      </main>
    )
  }

  const status = profile?.verificationStatus ?? 'none'
  const copy = STATUS_COPY[status]
  const spec = accountType ? SECOND_DOCUMENT[accountType] : null

  return (
    <main className="mesh-bg min-h-screen">
      <div className="container max-w-2xl py-12">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-[var(--primary)] no-underline hover:underline"
        >
          ← Dashboard
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-[var(--text-primary)]">Get verified</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          ClearRent verifies every party before money moves. You need this before you can book an
          inspection.
        </p>

        {copy && (
          <div
            className="card mt-6 border-l-4 p-5"
            style={{
              borderLeftColor:
                copy.tone === 'ok'
                  ? 'var(--primary)'
                  : copy.tone === 'wait'
                    ? 'var(--secondary)'
                    : '#dc2626',
            }}
          >
            <p className="font-semibold text-[var(--text-primary)]">{copy.title}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{copy.body}</p>
          </div>
        )}

        {done && status !== 'verified' && (
          <div className="card mt-6 border-l-4 border-l-[var(--primary)] p-5">
            <p className="font-semibold text-[var(--text-primary)]">Submitted</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Your NIN is encrypted and your documents are queued for admin review.
            </p>
          </div>
        )}

        {status !== 'verified' && status !== 'pending' && (
          <form onSubmit={handleSubmit} className="card mt-6 space-y-5 p-6">
            <label className="block">
              <span className="text-sm font-medium text-[var(--text-primary)]">NIN</span>
              <span className="mt-0.5 block text-xs text-[var(--text-hint)]">
                11 digits. Encrypted on our servers — never stored in the clear.
              </span>
              <input
                className="input-field mt-1.5 px-4 py-3 tracking-[0.2em]"
                inputMode="numeric"
                maxLength={11}
                required
                value={nin}
                onChange={(e) => setNin(e.target.value.replace(/\D/g, ''))}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-[var(--text-primary)]">NIN slip</span>
              <span className="mt-0.5 block text-xs text-[var(--text-hint)]">
                A photo or scan of your NIN slip.
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                required
                className="mt-1.5 text-sm text-[var(--text-secondary)]"
                onChange={(e) => setNinSlip(e.target.files?.[0] ?? null)}
              />
            </label>

            {/* The second document differs by role — a tenant proves income,
                a landlord and an agent prove address. */}
            <label className="block">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {spec?.label ?? 'Supporting document'}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--text-hint)]">
                {spec?.hint}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                required
                className="mt-1.5 text-sm text-[var(--text-secondary)]"
                onChange={(e) => setSecondDocument(e.target.files?.[0] ?? null)}
              />
            </label>

            {accountType === 'agent' && (
              <div className="space-y-5 border-t border-[var(--divider)] pt-5">
                <div>
                  <h2 className="font-semibold text-[var(--text-primary)]">Your guarantor</h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Agents handle inspections on other people&apos;s property, so we need
                    someone who vouches for you.
                  </p>
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    Guarantor name
                  </span>
                  <input
                    className="input-field mt-1.5 px-4 py-3"
                    required
                    value={guarantorName}
                    onChange={(e) => setGuarantorName(e.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    Guarantor phone
                  </span>
                  <input
                    className="input-field mt-1.5 px-4 py-3"
                    type="tel"
                    placeholder="0803 123 4567"
                    required
                    value={guarantorPhone}
                    onChange={(e) => setGuarantorPhone(e.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    Guarantor address
                  </span>
                  <input
                    className="input-field mt-1.5 px-4 py-3"
                    required
                    value={guarantorAddress}
                    onChange={(e) => setGuarantorAddress(e.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    Guarantor ID
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    required
                    className="mt-1.5 text-sm text-[var(--text-secondary)]"
                    onChange={(e) => setGuarantorId(e.target.files?.[0] ?? null)}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    Proof of experience
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--text-hint)]">
                    Optional.
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="mt-1.5 text-sm text-[var(--text-secondary)]"
                    onChange={(e) => setExperienceProof(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button className="btn-primary w-full px-6 py-3" type="submit" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit for verification'}
            </button>
            <p className="text-xs text-[var(--text-hint)]">
              Documents upload to private storage. They cannot be replaced once submitted, and
              only you and an admin can read them.
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
