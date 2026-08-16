import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getStorage, ref, uploadBytes } from 'firebase/storage'
import { clientApp, clientDb, initAppCheck } from './firebase-client'

/**
 * From a completed inspection to a tenancy, and out again.
 *
 *   rate inspection → express interest → landlord accepts → tenant accepts the
 *   agreement (this is what "finalizes" it) → tenant pays rent → move out
 *
 * Money and identity fields on a rental interest are IMMUTABLE after creation
 * and creation itself is server-only (`allow create: if false`). A client could
 * once mint an interest claiming ₦100 against a ₦1.2m tenancy, which the rules
 * then froze and `initializePayment` charged. Everything here therefore either
 * goes through a callable or touches only the allowlisted lifecycle fields.
 */

function callables() {
  initAppCheck()
  return getFunctions(clientApp(), 'us-central1')
}

/**
 * Expresses interest in renting, off the back of a completed inspection.
 *
 * Server-side this derives every amount from the property and pricing config.
 * Two gates it enforces that are worth surfacing in the UI: the inspection must
 * be `completed`, and the tenant must have RATED it — the rating is what backs
 * the handler's payment, so it is required, not optional.
 */
export async function createRentalInterest(
  inspectionRequestId: string,
): Promise<{ interestId: string } | { error: string }> {
  try {
    const fn = httpsCallable<
      { inspectionRequestId: string },
      { interestId: string; created: boolean }
    >(callables(), 'createRentalInterest')
    const res = await fn({ inspectionRequestId })
    return { interestId: res.data.interestId }
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    const message = err instanceof Error ? err.message : ''
    if (code === 'functions/failed-precondition') {
      return { error: message || 'Complete and rate the inspection first.' }
    }
    if (code === 'functions/unauthenticated') {
      return { error: 'The request was rejected (App Check or sign-in). Reload and try again.' }
    }
    return { error: message || 'Could not express interest.' }
  }
}

export type RentalInterest = {
  id: string
  propertyId: string
  propertyTitle: string
  tenantId: string
  tenantName: string
  landlordId: string
  status: string
  rentAmount: number
  paymentAmount: number
}

function interestsQuery(field: 'tenantId' | 'landlordId', uid: string) {
  return query(collection(clientDb(), 'rental_interests'), where(field, '==', uid))
}

function toInterest(d: QueryDocumentSnapshot): RentalInterest {
  const x = d.data()
  return {
    id: d.id,
    propertyId: (x.propertyId as string) ?? '',
    propertyTitle: (x.propertyTitle as string) ?? '(property)',
    tenantId: (x.tenantId as string) ?? '',
    tenantName: (x.tenantName as string) ?? 'Tenant',
    landlordId: (x.landlordId as string) ?? '',
    status: (x.status as string) ?? 'pending_acceptance',
    rentAmount: (x.rentAmount as number) ?? 0,
    paymentAmount: (x.paymentAmount as number) ?? 0,
  } satisfies RentalInterest
}

/**
 * LIVE rental interests.
 *
 * Every step of a tenancy is one party waiting on the other — the tenant sits
 * on this page after expressing interest while the landlord accepts elsewhere,
 * and acceptance is what unlocks the agreement and then rent. A one-time read
 * left whoever was waiting looking at a stale screen with no reason to reload.
 *
 * Returns the unsubscribe function.
 */
export function watchInterests(
  field: 'tenantId' | 'landlordId',
  uid: string,
  onChange: (rows: RentalInterest[]) => void,
): () => void {
  return onSnapshot(interestsQuery(field, uid), (snap) =>
    onChange(snap.docs.map(toInterest)),
  )
}

/**
 * The landlord accepts a tenant. Only the lifecycle fields are touched — every
 * amount on the document is immutable by rule.
 */
export async function acceptRentalInterest(interestId: string): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'rental_interests', interestId), {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not accept. Only the landlord on this interest can.'
  }
}

export type ActiveRental = {
  id: string
  rentalInterestId: string
  propertyId: string
  propertyTitle: string
  tenantId: string
  landlordId: string
  status: string
  agreementStatus: string
  rentPaymentStatus: string
  rentAmount: number
  /**
   * The landlord declared a mid-tenancy revision changes terms only, not the
   * rent. Shown to the tenant beside the declared figure so checking it is
   * reading one number rather than auditing a document — and contradicting it
   * raises an admin alert (`agreement_rent_mismatch`).
   */
  agreementRevisionTermsOnly: boolean
  agreementRevisionDeclaredRent: number
  // Lease detail. Written by rental_interest_ops on first tenancy and by
  // renewal_ops:484 on promotion; both surfaces read the same names.
  propertyAddress: string
  landlordName: string
  landlordPhone: string | null
  agentFee: number
  totalPaid: number
  rentFrequency: string
  leaseStartDate: Date | null
  leaseEndDate: Date | null
  nextPaymentDue: Date | null
  agreementUrl: string
  /** Why the tenant sent the agreement back, when agreementStatus is disputed. */
  tenantDisputeReason: string | null
  /**
   * How far the move-out handover has got: '' | 'awaiting_evidence' |
   * 'awaiting_condition' | 'awaiting_settlement' | 'awaiting_confirm' |
   * 'closed'. The TENANCY is already over by the time any of this runs — what
   * is unresolved is the caution deposit, and the PROPERTY stays off the
   * market until this reaches 'closed'.
   */
  handoverStage: string
  /** Withheld from the deposit, and why. Declared by the landlord. */
  cautionDeductionAmount: number
  cautionDeductionReason: string | null
  /** The tenant already answered, so nothing is outstanding from them. */
  handoverTenantConfirmedAt: Date | null
  /** The tenant disputed the settlement; an admin resolves it, not a timeout. */
  tenantContested: boolean
  /** Snapshotted at acceptance, so a later listing edit cannot change it. */
  cautionDeposit: number
  createdAt: Date | null
}

function toRental(d: QueryDocumentSnapshot): ActiveRental {
  const x = d.data()
  return {
      id: d.id,
      rentalInterestId: (x.rentalInterestId as string) ?? '',
      propertyId: (x.propertyId as string) ?? '',
      propertyTitle: (x.propertyTitle as string) ?? '(property)',
      tenantId: (x.tenantId as string) ?? '',
      landlordId: (x.landlordId as string) ?? '',
      status: (x.status as string) ?? 'active',
      agreementStatus: (x.agreementStatus as string) ?? 'pending',
      rentPaymentStatus: (x.rentPaymentStatus as string) ?? 'unpaid',
      rentAmount: (x.rentAmount as number) ?? 0,
      agreementRevisionTermsOnly: x.agreementRevisionTermsOnly === true,
      agreementRevisionDeclaredRent:
        (x.agreementRevisionDeclaredRent as number) ?? 0,
      propertyAddress: (x.propertyAddress as string) ?? '',
      landlordName: (x.landlordName as string) ?? '',
      landlordPhone: (x.landlordPhone as string) ?? null,
      agentFee: (x.agentFee as number) ?? 0,
      totalPaid: (x.totalPaid as number) ?? 0,
      rentFrequency: (x.rentFrequency as string) ?? 'yearly',
      leaseStartDate: x.leaseStartDate?.toDate?.() ?? null,
      leaseEndDate: x.leaseEndDate?.toDate?.() ?? null,
      nextPaymentDue: x.nextPaymentDue?.toDate?.() ?? null,
      agreementUrl: (x.agreementUrl as string) ?? '',
      tenantDisputeReason: (x.tenantDisputeReason as string) ?? null,
      handoverStage: (x.handoverStage as string) ?? '',
      cautionDeductionAmount: (x.cautionDeductionAmount as number) ?? 0,
      cautionDeductionReason: (x.cautionDeductionReason as string) ?? null,
      handoverTenantConfirmedAt:
        x.handoverTenantConfirmedAt?.toDate?.() ?? null,
      tenantContested: x.tenantContested === true,
      cautionDeposit: (x.cautionDeposit as number) ?? 0,
      createdAt: x.createdAt?.toDate?.() ?? null,
  } satisfies ActiveRental
}

function rentalsQuery(field: 'tenantId' | 'landlordId', uid: string) {
  return query(collection(clientDb(), 'active_rentals'), where(field, '==', uid))
}

/** One-time read, for pages that only ever render a snapshot of history. */
export async function activeRentals(
  field: 'tenantId' | 'landlordId',
  uid: string,
): Promise<ActiveRental[]> {
  const snap = await getDocs(rentalsQuery(field, uid))
  return snap.docs.map(toRental)
}

/**
 * LIVE active rentals — the agreement and rent steps both change under whoever
 * is waiting. Returns the unsubscribe function.
 */
export function watchActiveRentals(
  field: 'tenantId' | 'landlordId',
  uid: string,
  onChange: (rows: ActiveRental[]) => void,
): () => void {
  return onSnapshot(rentalsQuery(field, uid), (snap) =>
    onChange(snap.docs.map(toRental)),
  )
}

/** Every rental this tenant has had, newest first — the app's "My rentals". */
export async function tenantRentalHistory(uid: string): Promise<ActiveRental[]> {
  const rentals = await activeRentals('tenantId', uid)
  return rentals.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

/** The landlord's side of the same list. */
export async function landlordRentals(uid: string): Promise<ActiveRental[]> {
  const rentals = await activeRentals('landlordId', uid)
  return rentals.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

/**
 * Attaches an uploaded tenancy agreement to a rental.
 *
 * `agreementUrl` holds the STORAGE PATH, not a URL — the file is private and is
 * only ever served through `getSignedAgreementUrl`, which checks rental
 * membership server-side (storage rules cannot: they cannot read Firestore).
 *
 * Only allowlisted fields may be written here; `firestore.rules:1054` rejects
 * the whole update if it touches anything else, which is what stops a landlord
 * self-applying a rent change through this path.
 */
export async function attachAgreement(
  rentalId: string,
  storagePath: string,
): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'active_rentals', rentalId), {
      agreementUrl: storagePath,
      agreementUploadedAt: serverTimestamp(),
      agreementStatus: 'pending_review',
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not attach that agreement.'
  }
}

/**
 * The tenant accepts by uploading a copy they have SIGNED.
 *
 * Acceptance used to be a tap that wrote a status and a timestamp, leaving the
 * agreement itself untouched — so the only evidence a tenant agreed was a row
 * in ClearRent's own database, which a tenant could simply deny. The signed
 * document is the acceptance now.
 *
 * The landlord signs their agreement ONCE, against the property, before any
 * tenant exists. So the copy a tenant downloads already carries the landlord's
 * signature, and the copy they upload back carries BOTH — that single document
 * is the fully-executed agreement, which is why this finalizes outright. There
 * is deliberately no counter-sign round trip: it would have the landlord print
 * and re-upload the same document only to add a signature they could have
 * added once.
 *
 * Uploads under the tenant's own uid, which Storage already permits. The
 * landlord reads it back via getSignedAgreementUrl (`which: 'tenantSigned'`),
 * which checks tenancy membership — a storage rule cannot.
 *
 * Only allowlisted fields may be written; an extra one rejects the whole write.
 */
export async function acceptAgreement(
  rentalId: string,
  uid: string,
  signedFile: File,
): Promise<string | null> {
  try {
    const ext = signedFile.name.includes('.') ? signedFile.name.split('.').pop() : 'pdf'
    const path = `agreements/${uid}/agreement_${Date.now()}.${ext}`
    await uploadBytes(ref(getStorage(clientApp()), path), signedFile)

    await updateDoc(doc(clientDb(), 'active_rentals', rentalId), {
      tenantSignedUrl: path,
      tenantSignedAt: serverTimestamp(),
      // Same upload, second role: both signatures are on this one document,
      // so it is also the agreement of record.
      executedAgreementUrl: path,
      executedAt: serverTimestamp(),
      agreementStatus: 'finalized',
      tenantAcceptedAt: serverTimestamp(),
      landlordFinalizedAt: serverTimestamp(),
      tenantDisputeReason: null,
      updatedAt: serverTimestamp(),
    })
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not accept the agreement.'
  }
}

/**
 * Records rent after Paystack. Server-side this flips the interest to
 * 'rent_paid' and stamps the active rental in one transaction, but only if the
 * caller is the tenant, the interest is 'accepted', and the agreement is
 * finalized.
 */
export async function recordRentPayment(
  rentalInterestId: string,
  paymentReference: string,
): Promise<string | null> {
  try {
    const fn = httpsCallable<{ rentalInterestId: string; paymentReference: string }, unknown>(
      callables(),
      'recordRentPayment',
    )
    await fn({ rentalInterestId, paymentReference })
    return null
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    const message = err instanceof Error ? err.message : ''
    if (code === 'functions/failed-precondition') {
      return message || 'This rental is not ready for payment yet.'
    }
    return message || 'Could not record the rent payment.'
  }
}

/**
 * The tenant gives notice. `status`, `moveOutRequestedAt` and
 * `moveOutIntendedDate` are all inside the active_rentals update allowlist.
 */
export async function requestMoveOut(
  rentalId: string,
  intendedDate: Date,
  reason: string,
): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'active_rentals', rentalId), {
      // 'moveout_pending' is the canonical value, not a camelCase variant:
      // moveoutAutoConfirmSweep queries `status == 'moveout_pending'` and the
      // app's ActiveRentalStatus parses that exact string. Web previously wrote
      // 'moveOutRequested', which nothing recognised — so a move-out started on
      // web could neither be confirmed by the landlord nor auto-confirmed, and
      // the tenancy simply hung.
      status: 'moveout_pending',
      moveOutRequestedAt: serverTimestamp(),
      moveOutIntendedDate: Timestamp.fromDate(intendedDate),
      endReason: reason,
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not submit your move-out notice.'
  }
}

/**
 * The outgoing tenant confirms the caution deposit reached them, which closes
 * the handover and releases the property for relisting.
 *
 * ClearRent never holds the deposit — the money moves landlord-to-tenant
 * off-platform — so this confirmation is the only signal that it arrived. The
 * app writes exactly these two fields (ActiveRentalService.handoverConfirmPaid)
 * and both are in the active_rentals update allowlist.
 *
 * A silence sweep closes it after 7 days IF the landlord uploaded proof of
 * transfer, so a tenant who never answers does not trap the unit forever — but
 * a landlord who never paid cannot wait it out either.
 */
export async function confirmDepositReceived(
  rentalId: string,
): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'active_rentals', rentalId), {
      handoverStage: 'closed',
      handoverTenantConfirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not record your confirmation.'
  }
}

/**
 * The tenant says the deposit did NOT arrive, or that the deduction is wrong.
 *
 * This deliberately does not close the handover: a contested settlement is an
 * admin's to resolve, and the silence sweep skips `tenantContested` rentals so
 * a dispute can never be decided by timeout.
 */
export async function contestSettlement(
  rentalId: string,
  statement: string,
): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'active_rentals', rentalId), {
      tenantContested: true,
      tenantContestStatement: statement,
      contestedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not record your response.'
  }
}

/**
 * The landlord confirms handover, which ends the tenancy and frees the unit.
 * Only valid from 'moveout_pending'; the auto-confirm sweep makes the same
 * transition server-side if the landlord never acts, so this is a shortcut,
 * not a veto.
 *
 * A deduction of 0 means the deposit is returned in full — the default.
 * Anything withheld must carry a reason: the tenant gets their money back
 * unless the landlord says otherwise, on the record. ClearRent never holds
 * this money, so these fields are a declaration and an audit trail, not a
 * transfer. The amount is clamped to the deposit actually on the rental.
 */
export async function confirmMoveOut(
  rentalId: string,
  opts: { cautionDeductionAmount?: number; cautionDeductionReason?: string } = {},
): Promise<string | null> {
  try {
    const snap = await getDoc(doc(clientDb(), 'active_rentals', rentalId))
    if (!snap.exists()) return 'That rental no longer exists.'
    const data = snap.data()
    if (data.status !== 'moveout_pending') {
      return 'This tenancy is not awaiting a move-out confirmation.'
    }

    const deposit = Number(data.cautionDeposit ?? 0)
    const requested = Math.max(0, opts.cautionDeductionAmount ?? 0)
    const deducted = Math.min(requested, deposit)
    if (deducted > 0 && !opts.cautionDeductionReason?.trim()) {
      return 'Give a reason for withholding part of the deposit.'
    }

    await updateDoc(doc(clientDb(), 'active_rentals', rentalId), {
      status: 'ended_by_tenant',
      endedAt: serverTimestamp(),
      cautionDeductionAmount: deducted,
      cautionDeductionReason: deducted > 0 ? opts.cautionDeductionReason?.trim() : null,
      cautionDeclaredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not confirm the move-out.'
  }
}

/**
 * The tenant raises a concern instead of accepting. This is the other half of
 * [acceptAgreement] — without it a tenant who disagrees with the agreement has
 * only two options, accept it or stall, and the landlord is never told why.
 * The landlord re-uploads a revised copy, which returns it to 'pending_review'.
 */
export async function disputeAgreement(
  rentalId: string,
  reason: string,
): Promise<string | null> {
  if (!reason.trim()) return 'Say what needs changing.'
  try {
    await updateDoc(doc(clientDb(), 'active_rentals', rentalId), {
      agreementStatus: 'disputed',
      tenantDisputeReason: reason.trim(),
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not send your response.'
  }
}

/**
 * The tenant contradicts the landlord's "terms only" declaration.
 *
 * Deliberately distinct from [disputeAgreement]: this asserts a specific,
 * checkable claim about the rent. It parks the agreement as disputed — which
 * is what stops it being signable — and the onAgreementReady trigger turns
 * `tenantFlaggedRentChange` into a critical admin alert carrying both the
 * landlord's declaration and this claim.
 */
export async function flagRentChange(
  rentalId: string,
  reason: string,
): Promise<string | null> {
  try {
    await updateDoc(doc(clientDb(), 'active_rentals', rentalId), {
      agreementStatus: 'disputed',
      tenantFlaggedRentChange: true,
      tenantDisputeReason:
        reason.trim() ||
        'This revision changes my rent, but it was sent as a terms-only change.',
      updatedAt: serverTimestamp(),
    })
    return null
  } catch {
    return 'Could not flag this. Please try again.'
  }
}
