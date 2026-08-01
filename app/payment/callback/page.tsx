'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '../../../components/AuthProvider'
import {
  clearPendingPayment,
  pendingPayment,
  verifyPayment,
  type PendingPayment,
} from '../../../lib/payments'
import { confirmInspectionPayment } from '../../../lib/inspections'
import { completeRenewal } from '../../../lib/renewal'
import { recordRentPayment } from '../../../lib/tenancy'

type Phase = 'working' | 'done' | 'failed'

/**
 * Where Paystack sends the browser after checkout.
 *
 * The path is NOT ours to choose: `initializePayment` hardcodes
 * `callback_url = https://verealtytech.com/payment/callback`, so this file must
 * live at exactly that path. The mobile app shares the same callback.
 *
 * Two steps happen here:
 *
 *  1. `verifyPayment` — asks the server to confirm with Paystack that the
 *     transaction really succeeded. Landing on this URL proves nothing; anyone
 *     can navigate here with a made-up reference.
 *  2. The type-specific follow-up. For an inspection that is
 *     `confirmInspectionPayment`, which flips the request to paid and performs
 *     the address reveal server-side.
 *
 * Both are idempotent, so a refresh mid-flight is safe. Note the Paystack
 * webhook independently reconciles the charge into `payments/{reference}`, so
 * the money is recorded even if the user closes this page — but the reveal is
 * triggered from here, which is why the page matters.
 */
function PaymentCallback() {
  const params = useSearchParams()
  const { user, ready } = useAuth()
  const [phase, setPhase] = useState<Phase>('working')
  const [message, setMessage] = useState('Confirming your payment…')
  const [pending, setPending] = useState<PendingPayment | null>(null)

  // Paystack sends both; they carry the same value.
  const reference = params.get('reference') ?? params.get('trxref')

  useEffect(() => {
    if (!ready) return
    ;(async () => {
      if (!user) {
        setPhase('failed')
        setMessage('Sign in to confirm this payment.')
        return
      }
      if (!reference) {
        setPhase('failed')
        setMessage('No payment reference in the link.')
        return
      }

      let verified
      try {
        verified = await verifyPayment(reference)
      } catch (err) {
        setPhase('failed')
        setMessage(
          err instanceof Error ? err.message : 'We could not confirm the payment with Paystack.',
        )
        return
      }

      if (verified.success !== true) {
        setPhase('failed')
        setMessage(
          typeof verified.gatewayResponse === 'string' && verified.gatewayResponse
            ? String(verified.gatewayResponse)
            : 'Paystack reported that the payment did not succeed.',
        )
        return
      }

      // Recovered from Firestore, not sessionStorage — the redirect crosses
      // origins when a payment is started anywhere other than production.
      const p = await pendingPayment()
      setPending(p)

      if (p?.type === 'inspection') {
        const requestId = typeof p.context?.requestId === 'string' ? p.context.requestId : null
        if (!requestId) {
          setPhase('failed')
          setMessage(
            'Payment succeeded but we lost track of which inspection it was for. Contact support with reference ' +
              reference +
              '.',
          )
          return
        }
        const err = await confirmInspectionPayment(requestId, reference)
        if (err) {
          setPhase('failed')
          setMessage(err)
          return
        }
      }

      if (p?.type === 'rent') {
        const interestId =
          typeof p.context?.rentalInterestId === 'string' ? p.context.rentalInterestId : null
        if (!interestId) {
          setPhase('failed')
          setMessage(
            'Payment succeeded but we lost track of which tenancy it was for. Contact support with reference ' +
              reference +
              '.',
          )
          return
        }
        const err = await recordRentPayment(interestId, reference)
        if (err) {
          setPhase('failed')
          setMessage(err)
          return
        }
      }

      if (p?.type === 'renewal') {
        const sourceId = typeof p.context?.sourceId === 'string' ? p.context.sourceId : null
        if (!sourceId) {
          setPhase('failed')
          setMessage(
            'Payment succeeded but we lost track of which tenancy it renewed. Contact support with reference ' +
              reference +
              '.',
          )
          return
        }
        // A linked tenancy is promoted into a real rental; an active one is
        // extended. Different callables — see lib/renewal.ts.
        const err = await completeRenewal(sourceId, p.context?.isLinked === true, reference)
        if (err) {
          setPhase('failed')
          setMessage(err)
          return
        }
      }

      await clearPendingPayment()
      setPhase('done')
      setMessage(
        p?.type === 'inspection'
          ? 'Payment confirmed. The exact address has been released to you.'
          : p?.type === 'rent'
            ? 'Rent paid. Your tenancy is now active.'
            : p?.type === 'renewal'
              ? 'Renewal complete. Your tenancy has been extended.'
              : 'Payment confirmed.',
      )
    })()
  }, [ready, user, reference])

  return (
    <main className="mesh-bg min-h-screen">
      <div className="container max-w-md py-20">
        <div className="card p-8 text-center">
          <p className="text-3xl">{phase === 'done' ? '✓' : phase === 'failed' ? '!' : '…'}</p>
          <h1 className="mt-3 text-xl font-bold text-content">
            {phase === 'done'
              ? 'All set'
              : phase === 'failed'
                ? 'Something went wrong'
                : 'One moment'}
          </h1>
          <p className="mt-2 text-sm text-content-secondary">{message}</p>

          {reference && (
            <p className="mt-4 break-all text-xs text-content-hint">
              Reference: {reference}
            </p>
          )}

          {phase !== 'working' && (
            <Link
              href={pending?.returnPath ?? '/dashboard'}
              className="btn-primary mt-6 block w-full px-6 py-3 no-underline"
            >
              Continue
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}

export default function PaymentCallbackPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense
      fallback={
        <main className="mesh-bg min-h-screen">
          <div className="container py-20 text-center text-content-secondary">Loading…</div>
        </main>
      }
    >
      <PaymentCallback />
    </Suspense>
  )
}
