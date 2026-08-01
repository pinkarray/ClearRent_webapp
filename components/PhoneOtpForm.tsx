'use client'

import { useState } from 'react'
import type { ConfirmationResult } from 'firebase/auth'
import { resetVerifier, sendOtp } from '../lib/phone-auth'
import { phoneToE164 } from '../lib/phone'

/**
 * Phone + OTP, shared by /login and /signup. Calls [onVerified] with the
 * signed-in uid once the code is confirmed; the caller decides where to go.
 *
 * The invisible reCAPTCHA container must exist in the DOM before sendOtp runs,
 * which is why it is rendered unconditionally below rather than on demand.
 */
export function PhoneOtpForm({
  onVerified,
  submitLabel = 'Continue',
}: {
  onVerified: (uid: string, isNewUser: boolean) => void | Promise<void>
  submitLabel?: string
}) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const e164 = phoneToE164(phone)
    if (!e164) {
      setError('Enter a valid Nigerian mobile number, e.g. 0803 123 4567.')
      return
    }

    setBusy(true)
    try {
      setConfirmation(await sendOtp(e164, 'recaptcha-container'))
    } catch (err) {
      // A failed attempt leaves the widget in a state Firebase will not reuse.
      resetVerifier()
      setError(err instanceof Error ? err.message : 'Could not send the code.')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!confirmation) return
    setError(null)
    setBusy(true)
    try {
      const cred = await confirmation.confirm(code.trim())
      await onVerified(cred.user.uid, cred.user.metadata.creationTime === cred.user.metadata.lastSignInTime)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code was not accepted.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {!confirmation ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-content">Phone number</span>
            <input
              className="input-field mt-1.5 px-4 py-3"
              type="tel"
              autoComplete="tel"
              placeholder="0803 123 4567"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full px-6 py-3" type="submit" disabled={busy}>
            {busy ? 'Sending code…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <p className="text-sm text-content-secondary">
            We sent a 6-digit code to {phoneToE164(phone)}.
          </p>
          <label className="block">
            <span className="text-sm font-medium text-content">
              Verification code
            </span>
            <input
              className="input-field mt-1.5 px-4 py-3 tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full px-6 py-3" type="submit" disabled={busy}>
            {busy ? 'Verifying…' : submitLabel}
          </button>
          <button
            type="button"
            className="w-full text-sm text-content-secondary underline"
            onClick={() => {
              resetVerifier()
              setConfirmation(null)
              setCode('')
            }}
          >
            Use a different number
          </button>
        </form>
      )}

      {/* Must be present in the DOM before sendOtp runs. */}
      <div id="recaptcha-container" />
    </>
  )
}
