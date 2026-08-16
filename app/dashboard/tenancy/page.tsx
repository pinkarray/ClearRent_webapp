'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AgreementUpload from '../../../components/AgreementUpload'
import { useAuth } from '../../../components/AuthProvider'
import { getOrCreatePropertyConversation } from '../../../lib/chat'
import { agreementUrl } from '../../../lib/documents'
import { startPayment } from '../../../lib/payments'
import {
  acceptAgreement,
  acceptRentalInterest,
  confirmDepositReceived,
  contestSettlement,
  handoverProofLink,
  disputeAgreement,
  flagRentChange,
  requestMoveOut,
  watchActiveRentals,
  watchInterests,
  type ActiveRental,
  type RentalInterest,
} from '../../../lib/tenancy'

const INTEREST_COPY: Record<string, string> = {
  pending_acceptance: 'Waiting for the landlord to accept',
  accepted: 'Accepted',
  rent_paid: 'Rent paid',
  rejected: 'Declined',
}

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
}

/**
 * The tenancy stage: interests awaiting acceptance, then the active rental
 * with its agreement, rent and move-out steps. Shown to both sides — a landlord
 * sees interests to accept, a tenant sees what they owe and can do next.
 */
export default function TenancyPage() {
  const { user, profile } = useAuth()
  const router = useRouter()
  const [interests, setInterests] = useState<RentalInterest[] | null>(null)
  const [rentals, setRentals] = useState<ActiveRental[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Rental id whose signed copy we are collecting, or null. */
  const [signingFor, setSigningFor] = useState<string | null>(null)

  const isLandlord = profile?.accountType === 'landlord'

  // LIVE on both collections. This page is the whole tenancy handover, and
  // every step hands off to the other party: the tenant waits here for the
  // landlord to accept, the landlord waits for the agreement to be accepted,
  // and that acceptance is what unlocks rent. A one-time read stranded whoever
  // was waiting on a screen that never changed.
  useEffect(() => {
    if (!user) return
    const field = isLandlord ? 'landlordId' : 'tenantId'
    const unsubs = [
      watchInterests(field, user.uid, setInterests),
      watchActiveRentals(field, user.uid, setRentals),
    ]
    return () => unsubs.forEach((u) => u())
  }, [user, isLandlord])

  /** The rental an accepted interest produced. `onRentalInterestAccepted`
   *  creates it under the interest's own id, and also records the id in
   *  rentalInterestId — either match identifies it. */
  function rentalFor(interestId: string): ActiveRental | undefined {
    return (rentals ?? []).find(
      (r) => r.id === interestId || r.rentalInterestId === interestId,
    )
  }

  async function run(id: string, fn: () => Promise<string | null>) {
    setError(null)
    setBusy(id)
    const err = await fn()
    setBusy(null)
    if (err) setError(err)
  }

  async function payRent(r: ActiveRental) {
    setError(null)
    setBusy(r.id)
    try {
      // Amount is display-only; the server recomputes from the interest.
      await startPayment('rent', r.rentAmount, '/dashboard/tenancy', {
        rentalInterestId: r.rentalInterestId,
        propertyId: r.propertyId,
      })
    } catch (err) {
      setBusy(null)
      setError(err instanceof Error ? err.message : 'Could not start the payment.')
    }
  }

  async function moveOut(r: ActiveRental) {
    const when = window.prompt('Intended move-out date (YYYY-MM-DD)')
    if (!when) return
    const parsed = new Date(`${when}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) {
      setError('That date was not valid.')
      return
    }
    const reason = window.prompt('Reason for moving out') ?? ''
    await run(r.id, () => requestMoveOut(r.id, parsed, reason))
  }

  async function depositArrived(r: ActiveRental) {
    await run(r.id, () => confirmDepositReceived(r.id))
  }

  async function depositMissing(r: ActiveRental) {
    const statement = window.prompt(
      'What happened? (e.g. the money never arrived, or the deduction is wrong)',
    )
    if (!statement?.trim()) return
    await run(r.id, () => contestSettlement(r.id, statement.trim()))
  }

  async function viewProof(r: ActiveRental) {
    setError(null)
    setBusy(r.id)
    const res = await handoverProofLink(r.id, r.handoverProofUrl)
    setBusy(null)
    if ('error' in res) {
      setError(res.error)
      return
    }
    window.open(res.url, '_blank', 'noopener,noreferrer')
  }

  async function dispute(r: ActiveRental) {
    const reason = window.prompt('What needs changing in the agreement?')
    if (!reason?.trim()) return
    await run(r.id, () => disputeAgreement(r.id, reason))
  }

  async function messageLandlord(r: ActiveRental) {
    if (!user) return
    setError(null)
    setBusy(r.id)
    const res = await getOrCreatePropertyConversation({
      propertyId: r.propertyId,
      propertyTitle: r.propertyTitle,
      landlordId: r.landlordId,
      landlordName: r.landlordName || 'Landlord',
      tenantId: user.uid,
      tenantName: profile?.fullName ?? 'Tenant',
    })
    setBusy(null)
    if ('error' in res) {
      setError(res.error)
      return
    }
    router.push(`/dashboard/messages/${res.id}`)
  }

  async function openAgreement(rentalId: string) {
    setError(null)
    setBusy(rentalId)
    const res = await agreementUrl('active_rentals', rentalId)
    setBusy(null)
    if ('error' in res) {
      setError(res.error)
      return
    }
    window.open(res.url, '_blank', 'noopener')
  }

  if (!user) return null

  return (
    <>
      <div>
        {error && <p className="mb-4 text-sm text-error">{error}</p>}

        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
          Rental interests
        </h2>
        {interests === null ? (
          <p className="mt-3 text-sm text-content-secondary">Loading…</p>
        ) : interests.length === 0 ? (
          <div className="card mt-3 p-6 text-center text-sm text-content-secondary">
            {isLandlord ? (
              'No tenants have expressed interest yet.'
            ) : (
              <>
                Once you have completed and rated an inspection, you tell the landlord you
                want to rent it - from{' '}
                {/* Was a bare mention of "My inspections", which is only useful
                    if you already know where that is. */}
                <Link href="/dashboard/inspections" className="text-primary no-underline underline">
                  My inspections
                </Link>
                .
              </>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {interests.map((i) => (
              <div key={i.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-content">{i.propertyTitle}</p>
                    <p className="text-sm text-content-secondary">
                      {isLandlord ? i.tenantName : formatNaira(i.paymentAmount) + ' total'}
                    </p>
                  </div>
                  <span className="chip shrink-0">
                    {INTEREST_COPY[i.status] ?? i.status}
                  </span>
                </div>

                {isLandlord && i.status === 'pending_acceptance' && (
                  <button
                    className="btn-primary mt-4 px-5 py-2.5 text-sm"
                    disabled={busy === i.id}
                    onClick={() => run(i.id, () => acceptRentalInterest(i.id))}
                  >
                    {busy === i.id ? 'Working…' : 'Accept this tenant'}
                  </button>
                )}

                {/* Accepting used to end here, with the card simply flipping to
                    "Accepted" - and the next thing the landlord owes lives in
                    the section below, which they had no reason to look at.

                    A property that carries a signed agreement template no longer
                    needs anything uploaded: onRentalInterestAccepted copies it
                    onto the rental at acceptance. Telling the landlord to upload
                    one anyway sent them looking for work already done. */}
                {isLandlord && i.status === 'accepted' && (
                  <p className="mt-3 text-sm text-content-secondary">
                    {rentalFor(i.id)?.agreementUrl ? (
                      <>
                        Accepted, and your agreement was attached automatically.
                        Next: your tenant signs it - rent unlocks the moment they do.
                      </>
                    ) : (
                      <>
                        Accepted. Next: upload the tenancy agreement under{' '}
                        <strong className="text-content">Active rentals</strong> below - your
                        tenant cannot pay rent until they have accepted it.
                      </>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-content-hint">
          Active rentals
        </h2>
        {rentals === null ? (
          <p className="mt-3 text-sm text-content-secondary">Loading…</p>
        ) : rentals.length === 0 ? (
          <div className="card mt-3 p-6 text-center text-sm text-content-secondary">
            Nothing active yet.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {rentals.map((r) => (
              <div key={r.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-content">{r.propertyTitle}</p>
                    <p className="text-sm text-content-secondary">
                      {formatNaira(r.rentAmount)} · agreement {r.agreementStatus} · rent{' '}
                      {r.rentPaymentStatus}
                    </p>
                  </div>
                  <span className="chip shrink-0">
                    {r.status}
                  </span>
                </div>

                {/* The handover. The TENANCY is already over here — what is
                    unresolved is the caution deposit, and the PROPERTY stays
                    off the market until the tenant answers. Web had no surface
                    for this at all, so a tenant could only close it from the
                    app and the landlord's unit sat stranded. */}
                {!isLandlord &&
                  r.handoverStage === 'awaiting_confirm' &&
                  !r.tenantContested && (
                    <div className="mt-4 rounded-lg border border-warning/40 bg-warning/5 p-4">
                      <p className="font-semibold text-content">
                        Were you paid your caution deposit?
                      </p>
                      <p className="mt-1 text-sm text-content-secondary">
                        Your landlord says they have returned{' '}
                        {formatNaira(
                          Math.max(r.cautionDeposit - r.cautionDeductionAmount, 0),
                        )}
                        {r.cautionDeductionAmount > 0 && (
                          <>
                            , after withholding{' '}
                            {formatNaira(r.cautionDeductionAmount)}
                            {r.cautionDeductionReason
                              ? ` for "${r.cautionDeductionReason}"`
                              : ''}
                          </>
                        )}
                        . Your tenancy is already over - this only settles the
                        money.
                      </p>
                      {r.handoverProofUrl && (
                        <button
                          className="mt-2 text-sm font-medium text-primary underline"
                          disabled={busy === r.id}
                          onClick={() => void viewProof(r)}
                        >
                          See their proof of payment
                        </button>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="btn-primary px-5 py-2.5 text-sm"
                          disabled={busy === r.id}
                          onClick={() => void depositArrived(r)}
                        >
                          Yes, I was paid
                        </button>
                        <button
                          className="btn-ghost px-5 py-2.5 text-sm"
                          disabled={busy === r.id}
                          onClick={() => void depositMissing(r)}
                        >
                          No, something is wrong
                        </button>
                      </div>
                    </div>
                  )}

                {!isLandlord && r.tenantContested && (
                  <div className="mt-4 rounded-lg border border-error/40 bg-error/5 p-4">
                    <p className="font-semibold text-content">
                      You reported a problem with this settlement
                    </p>
                    <p className="mt-1 text-sm text-content-secondary">
                      Your landlord has been notified and an admin is reviewing
                      it. This will NOT close on its own while the dispute is
                      open, so nothing is decided by you waiting.
                    </p>
                  </div>
                )}

                {/* The landlord's half of the tenancy, inline. This is the
                    step a live run lost: the accept happens on this page, so
                    the upload belongs on it too rather than only on Rentals. */}
                {isLandlord && (
                  <div className="mt-4 border-t border-divider pt-4">
                    <AgreementUpload rental={r} />
                  </div>
                )}

                {!isLandlord && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {/* Read it before you sign it. The file is private, so it
                        is fetched through getSignedAgreementUrl rather than
                        linked - and asking someone to accept a document they
                        cannot open is not a real choice. */}
                    {r.agreementUrl && (
                      <button
                        className="btn-ghost px-5 py-2.5 text-sm"
                        disabled={busy === r.id}
                        onClick={() => void openAgreement(r.id)}
                      >
                        {busy === r.id ? 'Opening…' : 'View agreement'}
                      </button>
                    )}

                    {/* Accepting means uploading a copy you have SIGNED. A tap
                        alone left the document untouched, so the only record a
                        tenant agreed was a row in our own database - which a
                        tenant could deny. The landlord signed before sending,
                        so the returned copy carries both signatures. */}
                    {r.agreementStatus !== 'finalized' &&
                      r.agreementStatus !== 'accepted' && (
                        <button
                          className="btn-primary px-5 py-2.5 text-sm"
                          disabled={busy === r.id || !r.agreementUrl}
                          onClick={() => setSigningFor(r.id)}
                        >
                          Sign &amp; accept
                        </button>
                      )}

                    {/* Showing the rent on record turns the check into reading
                        one number instead of auditing a document. Without it
                        the flag exists but almost never fires. */}
                    {r.agreementRevisionTermsOnly &&
                      r.agreementStatus !== 'finalized' && (
                        <p className="w-full rounded-md border-l-4 border-l-secondary bg-surface-secondary p-3 text-sm text-content">
                          Your landlord says this revision changes the terms only,
                          and that your rent stays at{' '}
                          <strong>
                            {formatNaira(
                              r.agreementRevisionDeclaredRent || r.rentAmount,
                            )}
                          </strong>
                          . Check the document before you sign - if it says
                          anything different, flag it instead.
                        </p>
                      )}

                    {/* Contradicting the landlord's declaration is its own
                        action, not buried in "Raise a concern": it asserts a
                        checkable claim about the rent, blocks signing, and
                        raises a critical admin alert with both sides on it. */}
                    {r.agreementRevisionTermsOnly &&
                      r.agreementStatus !== 'finalized' &&
                      r.agreementStatus !== 'disputed' && (
                        <button
                          className="btn-ghost px-5 py-2.5 text-sm text-error"
                          disabled={busy === r.id}
                          onClick={() =>
                            run(r.id, () =>
                              flagRentChange(
                                r.id,
                                prompt('What does the document say?') ?? '',
                              ),
                            )
                          }
                        >
                          This changes my rent
                        </button>
                      )}

                    {/* The other half of accepting: without it a tenant who
                        disagrees can only stall, and the landlord is never
                        told why. Sends it back for a corrected upload. */}
                    {r.agreementStatus !== 'finalized' &&
                      r.agreementStatus !== 'disputed' &&
                      r.agreementUrl && (
                        <button
                          className="btn-ghost px-5 py-2.5 text-sm"
                          disabled={busy === r.id}
                          onClick={() => void dispute(r)}
                        >
                          Raise a concern
                        </button>
                      )}

                    {r.agreementStatus === 'finalized' && r.rentPaymentStatus !== 'paid' && (
                      <button
                        className="btn-primary px-5 py-2.5 text-sm"
                        disabled={busy === r.id}
                        onClick={() => payRent(r)}
                      >
                        Pay rent {formatNaira(r.rentAmount)}
                      </button>
                    )}

                    {r.rentPaymentStatus === 'paid' && r.status === 'active' && (
                      <button
                        className="btn-ghost px-5 py-2.5 text-sm"
                        disabled={busy === r.id}
                        onClick={() => moveOut(r)}
                      >
                        Give move-out notice
                      </button>
                    )}

                    {/* Not gated on the agreement: the most likely moment to
                        need your landlord is when something about the
                        paperwork is wrong or missing. */}
                    <button
                      className="btn-ghost px-5 py-2.5 text-sm"
                      disabled={busy === r.id}
                      onClick={() => void messageLandlord(r)}
                    >
                      Message landlord
                    </button>
                  </div>
                )}

                {!isLandlord && r.agreementStatus !== 'finalized' && (
                  <p className="mt-3 text-xs text-content-hint">
                    {r.agreementUrl
                      ? 'Accepting the agreement finalizes it - that is what unlocks rent payment. There is no separate landlord step.'
                      : 'Waiting for your landlord to upload the tenancy agreement. You can accept it here once they do, and that unlocks rent payment.'}
                  </p>
                )}

                {!isLandlord && r.agreementStatus === 'disputed' && (
                  <p className="mt-2 text-xs text-content-hint">
                    Sent back to your landlord. They will upload a corrected version.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {signingFor && user && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Sign and accept"
          onClick={() => setSigningFor(null)}
        >
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-content">Sign &amp; accept</p>
            <p className="mt-2 text-sm text-content-secondary">
              To accept, sign the agreement and upload the signed copy:
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-content-secondary">
              <li>Download and read it - your landlord has already signed it</li>
              <li>Print and sign it, or sign on your device</li>
              <li>Photograph or scan the signed pages</li>
              <li>Upload it here - that completes the agreement</li>
            </ol>
            <p className="mt-3 text-xs text-content-hint">
              The copy you send back carries both signatures. For court-admissible
              proof, get the agreement stamped at LIRS/SIRS.
            </p>

            <label className="btn-primary mt-5 block w-full cursor-pointer px-5 py-3 text-center text-sm">
              {busy === signingFor ? 'Uploading…' : 'Choose signed copy'}
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                disabled={busy === signingFor}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  const id = signingFor
                  void run(id, () => acceptAgreement(id, user.uid, file)).then(() =>
                    setSigningFor(null),
                  )
                }}
              />
            </label>
            <button
              type="button"
              className="btn-ghost mt-2 w-full px-5 py-2.5 text-sm"
              onClick={() => setSigningFor(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
