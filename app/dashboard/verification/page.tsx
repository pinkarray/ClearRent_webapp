'use client'

import { useState } from 'react'
import { useAuth } from '../../../components/AuthProvider'
import {
  SECOND_DOCUMENT,
  VERIFICATION_FEES,
  submitVerification,
} from '../../../lib/verification'
import { startPayment } from '../../../lib/payments'
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
  // No refreshProfile: submitting now hands the browser to Paystack, and the
  // callback page is what moves the account to 'pending' on the way back.
  const { user, profile } = useAuth()

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

  const accountType = profile?.accountType as AccountType | undefined

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !ninSlip || !secondDocument || !accountType) return
    setError(null)
    setBusy(true)
    const result = await submitVerification(user.uid, {
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
    if ('error' in result) {
      setBusy(false)
      setError(result.error)
      return
    }

    // Documents are stored; the application is parked at 'awaiting_payment'
    // and no reviewer sees it until this charge clears. The amount is
    // display-only — the server prices verification from the account type.
    try {
      await startPayment(
        'verification',
        VERIFICATION_FEES[accountType],
        '/dashboard/verification',
        { requestId: result.requestId },
      )
      // startPayment navigates to Paystack; nothing after this runs.
    } catch (err) {
      setBusy(false)
      setError(
        err instanceof Error
          ? err.message
          : 'Your documents were saved but we could not start the payment. Try again.',
      )
    }
  }

  if (!user) return null

  const status = profile?.verificationStatus ?? 'none'
  const copy = STATUS_COPY[status]
  const spec = accountType ? SECOND_DOCUMENT[accountType] : null

  return (
    <>
      <div className="mx-auto max-w-2xl">
        <p className="text-content-secondary">
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
                    : 'var(--error)',
            }}
          >
            <p className="font-semibold text-content">{copy.title}</p>
            <p className="mt-1 text-sm text-content-secondary">{copy.body}</p>
          </div>
        )}

        {status !== 'verified' && status !== 'pending' && (
          <form onSubmit={handleSubmit} className="card mt-6 space-y-5 p-6">
            <label className="block">
              <span className="text-sm font-medium text-content">NIN</span>
              <span className="mt-0.5 block text-xs text-content-hint">
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
              <span className="text-sm font-medium text-content">NIN slip</span>
              <span className="mt-0.5 block text-xs text-content-hint">
                A photo or scan of your NIN slip.
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                required
                className="mt-1.5 text-sm text-content-secondary"
                onChange={(e) => setNinSlip(e.target.files?.[0] ?? null)}
              />
            </label>

            {/* The second document differs by role — a tenant proves income,
                a landlord and an agent prove address. */}
            <label className="block">
              <span className="text-sm font-medium text-content">
                {spec?.label ?? 'Supporting document'}
              </span>
              <span className="mt-0.5 block text-xs text-content-hint">
                {spec?.hint}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                required
                className="mt-1.5 text-sm text-content-secondary"
                onChange={(e) => setSecondDocument(e.target.files?.[0] ?? null)}
              />
            </label>

            {accountType === 'agent' && (
              <div className="space-y-5 border-t border-divider pt-5">
                <div>
                  <h2 className="font-semibold text-content">Your guarantor</h2>
                  <p className="mt-1 text-sm text-content-secondary">
                    Agents handle inspections on other people&apos;s property, so we need
                    someone who vouches for you.
                  </p>
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-content">
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
                  <span className="text-sm font-medium text-content">
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
                  <span className="text-sm font-medium text-content">
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
                  <span className="text-sm font-medium text-content">
                    Guarantor ID
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    required
                    className="mt-1.5 text-sm text-content-secondary"
                    onChange={(e) => setGuarantorId(e.target.files?.[0] ?? null)}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-content">
                    Proof of experience
                  </span>
                  <span className="mt-0.5 block text-xs text-content-hint">
                    Optional.
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="mt-1.5 text-sm text-content-secondary"
                    onChange={(e) => setExperienceProof(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            )}

            {error && <p className="text-sm text-error">{error}</p>}

            <button className="btn-primary w-full px-6 py-3" type="submit" disabled={busy}>
              {busy ? 'Submitting…' : `Pay ₦${(accountType ? VERIFICATION_FEES[accountType] : 0).toLocaleString('en-NG')} and submit`}
            </button>
            <p className="text-xs text-content-hint">
              Documents upload to private storage. They cannot be replaced once submitted, and
              only you and an admin can read them.
            </p>
          </form>
        )}
      </div>
    </>
  )
}
