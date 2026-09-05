'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useAuth } from './AuthProvider'
import { clientDb } from '../lib/firebase-client'
import {
  watchActiveRentals,
  watchInterests,
  type ActiveRental,
  type RentalInterest,
} from '../lib/tenancy'

/*
  "What do I do next?" - answered in one place, on every signed-in page.

  A live two-device run on 2026-08-06 lost a cold user twice, and both times the
  data was correct and the notification fired; only the on-screen next step was
  missing. A tenant who has just rated an inspection has no idea that expressing
  interest is a thing, and a landlord who has just accepted a tenant is given no
  route to the agreement upload - it lives on a different tab, so the owner had
  to hunt for it.

  Both failures share a shape: the state machine advanced somewhere else, and the
  screen you are standing on does not mention it. So this is deliberately NOT on
  the dashboard home - it renders inside AppShell, above every page, because the
  whole problem is that people are standing somewhere other than home when their
  turn comes.

  It names ONE step. A list of things you could do is what the dashboard already
  is, and it is what failed.
*/

type Tone = 'action' | 'waiting'

/*
  A rental is BORN 'pending_payment' - rental_interest_ops creates it the moment
  the landlord accepts, and only flips it to 'active' once rent lands
  (`rental_interest_ops.ts:322`). So an allowlist of {active, moveout_pending}
  would have excluded exactly the rentals this banner exists for: the ones still
  waiting on an agreement upload and a rent payment.

  Hence a denylist of the terminal states instead. `expiring_soon` and
  `grace_locked` are live too, and a new one appearing should default to being
  shown rather than silently swallowing someone's next step.
*/
const ENDED = new Set([
  'expired',
  'terminated',
  'ended_by_tenant',
  'ended_by_landlord',
])

/*
  A handover outlives the tenancy that produced it.

  `liveRentals` is deliberately left alone: it feeds the tenant branch too, and
  an ended rental leaking into those checks would be a worse bug than the one
  being fixed. The handover lookup below scans the FULL list instead, because
  the rental it needs is terminal by definition - the tenancy ended, and the
  caution deposit did not end with it.

  Only the two stages the landlord can actually act on. `awaiting_evidence` and
  `awaiting_confirm` sit with the former tenant, and a banner telling someone to
  do a thing they cannot do is worse than no banner.
*/
const LANDLORD_TURN: Record<string, { title: string; detail: string; cta: string }> = {
  awaiting_condition: {
    title: 'Check the unit and record its condition',
    detail:
      'the tenancy has ended but the handover has not. Nothing can be settled, ' +
      'and the unit cannot be relisted, until you record what condition you ' +
      'found it in.',
    cta: 'Record condition',
  },
  awaiting_settlement: {
    title: 'Settle the caution deposit',
    detail:
      'your former tenant is waiting on their deposit. Send it, attach proof of ' +
      'the transfer, and the handover closes itself once they confirm.',
    cta: 'Settle deposit',
  },
}

/** Settled or not, a handover is open until the stage reaches closed. */
function isHandoverOpen(r: ActiveRental): boolean {
  return r.handoverStage.length > 0 && r.handoverStage !== 'closed'
}

function liveRentals(rentals: ActiveRental[]): ActiveRental[] {
  return rentals.filter((r) => !ENDED.has(r.status))
}

type Step = {
  title: string
  detail: string
  href: string
  cta: string
  tone: Tone
}

type TenantInspection = {
  id: string
  propertyId: string
  propertyTitle: string
  status: string
  paymentStatus: string
  tenantRated: boolean
}

/**
 * The tenant's turn, most urgent first. Money owed outranks paperwork, which
 * outranks anything we are only waiting on.
 */
function tenantStep(
  interests: RentalInterest[],
  rentals: ActiveRental[],
  inspections: TenantInspection[],
): Step | null {
  const live = liveRentals(rentals)

  const payable = live.find(
    (r) => r.agreementStatus === 'finalized' && r.rentPaymentStatus !== 'paid',
  )
  if (payable) {
    return {
      title: 'Pay your rent',
      detail: `${payable.propertyTitle} - your agreement is finalized, so rent is now unlocked.`,
      href: '/dashboard/tenancy',
      cta: 'Pay rent',
      tone: 'action',
    }
  }

  const toSign = live.find(
    (r) => r.agreementUrl && r.agreementStatus !== 'finalized' && r.agreementStatus !== 'disputed',
  )
  if (toSign) {
    return {
      title: 'Review your tenancy agreement',
      detail: `${toSign.propertyTitle} - read it, then accept. Accepting is what unlocks rent payment.`,
      href: '/dashboard/tenancy',
      cta: 'Open agreement',
      tone: 'action',
    }
  }

  // Rated, completed, and no interest filed for that property yet. This is the
  // step nobody found: it is the entire point of having done the inspection.
  const claimed = new Set(interests.map((i) => i.propertyId))
  const rentable = inspections.find(
    (i) => i.status === 'completed' && i.tenantRated && !claimed.has(i.propertyId),
  )
  if (rentable) {
    return {
      title: 'Want to rent it? Tell the landlord',
      detail: `You inspected ${rentable.propertyTitle}. Expressing interest is what starts the tenancy - the landlord cannot offer it to you until you do.`,
      href: '/dashboard/inspections',
      cta: 'I want to rent it',
      tone: 'action',
    }
  }

  // Rating is not optional — createRentalInterest rejects an unrated
  // inspection — so it is a step, not a nicety.
  const toRate = inspections.find((i) => i.status === 'completed' && !i.tenantRated)
  if (toRate) {
    return {
      title: 'Rate your inspection',
      detail: `${toRate.propertyTitle} - required before you can say you want to rent it.`,
      href: '/dashboard/inspections',
      cta: 'Rate it',
      tone: 'action',
    }
  }

  const toPayFor = inspections.find(
    (i) => i.status === 'approved' && i.paymentStatus === 'unpaid',
  )
  if (toPayFor) {
    return {
      title: 'Pay to confirm your inspection',
      detail: `${toPayFor.propertyTitle} - approved. Paying confirms the visit and releases the exact address.`,
      href: '/dashboard/inspections',
      cta: 'Pay now',
      tone: 'action',
    }
  }

  const accepted = interests.find((i) => i.status === 'accepted')
  if (accepted && !live.some((r) => r.agreementUrl)) {
    return {
      title: 'Your landlord accepted you',
      detail: `${accepted.propertyTitle} - they are preparing the tenancy agreement. You will get a notification when it is ready to sign.`,
      href: '/dashboard/tenancy',
      cta: 'View tenancy',
      tone: 'waiting',
    }
  }

  const pending = interests.find((i) => i.status === 'pending_acceptance')
  if (pending) {
    return {
      title: 'Waiting for the landlord',
      detail: `${pending.propertyTitle} - they have been notified that you want to rent it.`,
      href: '/dashboard/tenancy',
      cta: 'View tenancy',
      tone: 'waiting',
    }
  }

  return null
}

/**
 * The landlord's turn. The agreement upload is the one that got lost, so it is
 * spelled out rather than labelled "Rentals" — the destination tab's name was
 * never the problem, knowing to go there was.
 */
function landlordStep(interests: RentalInterest[], rentals: ActiveRental[]): Step | null {
  const pending = interests.filter((i) => i.status === 'pending_acceptance')
  if (pending.length > 0) {
    const first = pending[0]
    return {
      title:
        pending.length === 1
          ? `${first.tenantName} wants to rent ${first.propertyTitle}`
          : `${pending.length} tenants want to rent from you`,
      detail: 'Accepting creates the tenancy. Nothing is charged to them until you do.',
      href: '/dashboard/tenancy',
      cta: 'Review and accept',
      tone: 'action',
    }
  }

  const live = liveRentals(rentals)

  const disputed = live.find((r) => r.agreementStatus === 'disputed')
  if (disputed) {
    return {
      title: 'Upload a corrected agreement',
      detail: `${disputed.propertyTitle} - your tenant sent the agreement back${
        disputed.tenantDisputeReason ? `: “${disputed.tenantDisputeReason}”` : '.'
      }`,
      href: '/dashboard/rentals',
      cta: 'Upload corrected copy',
      tone: 'action',
    }
  }

  // The findability failure, stated as the instruction it is. Rent cannot be
  // paid until the tenant accepts an agreement, and no agreement exists until
  // the landlord puts one here — so this blocks the whole rest of the flow.
  const needsAgreement = live.find((r) => !r.agreementUrl)
  if (needsAgreement) {
    return {
      title: 'Upload the tenancy agreement',
      detail: `${needsAgreement.propertyTitle} - your tenant is waiting on this. They cannot accept, and cannot pay rent, until you upload it.`,
      href: '/dashboard/rentals',
      cta: 'Upload agreement',
      tone: 'action',
    }
  }

  const moveout = live.find((r) => r.status === 'moveout_pending')
  if (moveout) {
    return {
      title: 'Confirm a move-out',
      detail: `${moveout.propertyTitle} - confirm once you have the keys back. It confirms itself after the notice period if you do nothing.`,
      href: '/dashboard/rentals',
      cta: 'Confirm move-out',
      tone: 'action',
    }
  }

  // Deliberately `rentals`, not `live`: an open handover only ever sits on an
  // ENDED tenancy, so the live filter excluded exactly the case this exists
  // for. A landlord was left holding a former tenant's deposit with nothing on
  // the dashboard saying so, and the only route to it was a rentals page they
  // had no reason to open.
  const handover = rentals.find(
    (r) => isHandoverOpen(r) && LANDLORD_TURN[r.handoverStage],
  )
  if (handover) {
    const step = LANDLORD_TURN[handover.handoverStage]
    return {
      title: step.title,
      detail: `${handover.propertyTitle} - ${step.detail}`,
      href: '/dashboard/rentals',
      cta: step.cta,
      tone: 'action',
    }
  }

  const awaiting = live.find(
    (r) => r.agreementStatus === 'pending_review' || r.agreementStatus === 'accepted',
  )
  if (awaiting) {
    return {
      title: 'Waiting on your tenant',
      detail: `${awaiting.propertyTitle} - they are reviewing the agreement. Rent unlocks the moment they accept it.`,
      href: '/dashboard/rentals',
      cta: 'View rental',
      tone: 'waiting',
    }
  }

  return null
}

export default function NextStep() {
  const { user, profile } = useAuth()
  const pathname = usePathname()
  const [interests, setInterests] = useState<RentalInterest[]>([])
  const [rentals, setRentals] = useState<ActiveRental[]>([])
  const [inspections, setInspections] = useState<TenantInspection[]>([])

  const uid = user?.uid
  const accountType = profile?.accountType
  const isLandlord = accountType === 'landlord'
  const isTenant = accountType === 'tenant'

  // Live, for the same reason every other tenancy surface is: each step here is
  // the OTHER party's move, so a one-time read would leave the banner telling
  // someone to do a thing they had already done.
  useEffect(() => {
    if (!uid || (!isLandlord && !isTenant)) return
    const field = isLandlord ? 'landlordId' : 'tenantId'
    const unsubs = [
      watchInterests(field, uid, setInterests),
      watchActiveRentals(field, uid, setRentals),
    ]
    return () => unsubs.forEach((u) => u())
  }, [uid, isLandlord, isTenant])

  // Tenant only — the inspection is where "I want to rent this" is unlocked.
  // Single equality filter, deliberately unordered: no composite index needed.
  useEffect(() => {
    if (!uid || !isTenant) return
    return onSnapshot(
      query(collection(clientDb(), 'inspection_requests'), where('tenantId', '==', uid)),
      (snap) =>
        setInspections(
          snap.docs.map((d) => {
            const x = d.data()
            return {
              id: d.id,
              propertyId: (x.propertyId as string) ?? '',
              propertyTitle: (x.propertyTitle as string) ?? 'that property',
              status: (x.status as string) ?? 'pending',
              paymentStatus: (x.paymentStatus as string) ?? 'not_required',
              tenantRated: x.tenantRated === true,
            }
          }),
        ),
    )
  }, [uid, isTenant])

  if (!isLandlord && !isTenant) return null

  const step = isLandlord
    ? landlordStep(interests, rentals)
    : tenantStep(interests, rentals, inspections)

  if (!step) return null
  // Already looking at the page that carries the action — the banner would just
  // be repeating the buttons underneath it.
  if (pathname === step.href) return null

  const action = step.tone === 'action'

  return (
    <div
      className={`card mb-6 border-l-4 p-5 ${
        action ? 'border-l-primary' : 'border-l-secondary'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-content-hint">
            {action ? 'Your next step' : 'In progress'}
          </p>
          <p className="mt-1 font-semibold text-content">{step.title}</p>
          <p className="mt-1 text-sm text-content-secondary">{step.detail}</p>
        </div>
        <Link
          href={step.href}
          className={`${
            action ? 'btn-primary' : 'btn-ghost'
          } shrink-0 px-5 py-2.5 text-sm no-underline`}
        >
          {step.cta}
        </Link>
      </div>
    </div>
  )
}
