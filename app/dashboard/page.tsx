'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import AgentHome from '../../components/AgentHome'
import CaretakerBanner from '../../components/CaretakerBanner'
import { useAuth } from '../../components/AuthProvider'
import { clientDb } from '../../lib/firebase-client'
import { resolveDocStatuses } from '../../lib/ownership'
import { saveAccountType, type AccountType } from '../../lib/user-profile'

type OwnListing = {
  id: string
  title: string
  city: string
  state: string
  isAvailable: boolean
  readyForInspections: boolean
  ownershipDocStatus: string
  buildingId: string | null
}

/**
 * Explains, in the landlord's terms, why a listing is or is not on public
 * browse. The three conditions are the same gate `lib/property.ts` applies
 * server-side.
 *
 * `ownershipDocStatus` here is the EFFECTIVE status, resolved through the
 * building for grouped units. Checking the raw field reported reviewed units
 * as "awaiting verification" while the admin correctly showed them approved.
 */
function listingState(l: OwnListing): { label: string; tone: 'live' | 'pending' } {
  if (l.ownershipDocStatus !== 'verified') {
    return { label: 'Awaiting ownership verification', tone: 'pending' }
  }
  if (!l.readyForInspections) return { label: 'Not yet marked ready', tone: 'pending' }
  if (!l.isAvailable) return { label: 'Marked unavailable', tone: 'pending' }
  return { label: 'Live on public browse', tone: 'live' }
}

export default function DashboardPage() {
  // AppShell guarantees a signed-in user before children render.
  const { user, profile, refreshProfile } = useAuth()
  const [listings, setListings] = useState<OwnListing[] | null>(null)
  const [savingType, setSavingType] = useState(false)
  const uid = user?.uid
  const accountType = profile?.accountType

  // Live: an admin verifies the ownership document from the staff dashboard,
  // so the flip to "Live on public browse" is never something the landlord's
  // own navigation would surface.
  useEffect(() => {
    if (!uid || accountType !== 'landlord') return

    // Each snapshot needs an async status resolution, so a slow earlier
    // response could otherwise land after a newer one and undo it.
    let seq = 0
    return onSnapshot(
      query(collection(clientDb(), 'properties'), where('landlordId', '==', uid)),
      async (snap) => {
        const mine = ++seq
        const raw = snap.docs.map((d) => {
          const x = d.data()
          return {
            id: d.id,
            title: (x.title as string) ?? '(untitled)',
            city: (x.city as string) ?? '',
            state: (x.state as string) ?? '',
            isAvailable: x.isAvailable === true,
            readyForInspections: x.readyForInspections === true,
            ownershipDocStatus: (x.ownershipDocStatus as string) ?? 'none',
            buildingId: (x.buildingId as string) ?? null,
          }
        })

        // Grouped units carry 'inherited'; the building holds the reviewed doc.
        const effective = await resolveDocStatuses(raw, (p) => p.id)
        if (mine !== seq) return
        setListings(
          raw.map((p) => ({
            ...p,
            ownershipDocStatus: effective.get(p.id) ?? p.ownershipDocStatus,
          })),
        )
      },
    )
  }, [uid, accountType])

  if (!user) return null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-content">
          {profile?.fullName ? `Hello, ${profile.fullName.split(' ')[0]}` : 'Your dashboard'}
        </h2>
        <p className="mt-0.5 text-sm text-content-secondary">
          {accountType ? `Signed in as ${accountType}` : 'Signed in'}
        </p>
      </div>

      {/*
        Above the role sections, because a caretaker keeps whatever accountType
        they signed up with — the role decides their capsule, not this work.
        Renders nothing for everyone else.
      */}
      <CaretakerBanner />

      {/*
        Accounts predating web onboarding (and the two staff accounts) have no
        accountType, and every section below keys off it. Without this they
        would land on an empty dashboard with no way forward.
      */}
      {!accountType && (
        <section className="card p-6">
          <h3 className="font-semibold text-content">How do you use ClearRent?</h3>
          <p className="mt-1 text-sm text-content-secondary">
            This account has no role set yet. Pick one to see your tools.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(['landlord', 'tenant', 'agent'] as AccountType[]).map((t) => (
              <button
                key={t}
                className="btn-ghost px-4 py-3 capitalize"
                disabled={savingType}
                onClick={async () => {
                  setSavingType(true)
                  await saveAccountType(user.uid, t)
                  await refreshProfile()
                  setSavingType(false)
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </section>
      )}

      {accountType && !profile?.profileCompleted && (
        <section className="card border-l-4 border-l-secondary p-5">
          <p className="font-semibold text-content">Finish setting up</p>
          <p className="mt-1 text-sm text-content-secondary">
            Your profile is incomplete.{' '}
            <Link href="/signup" className="text-primary no-underline">
              Complete it
            </Link>
            .
          </p>
        </section>
      )}

      {accountType === 'landlord' && (
        <>
          {profile?.verificationStatus !== 'verified' && (
            <section className="card border-l-4 border-l-secondary p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-content">Verify your identity to list</p>
                  <p className="mt-0.5 text-sm text-content-secondary">
                    Listing requires a verified account.
                  </p>
                </div>
                <span className="chip chip-pending shrink-0">
                  {profile?.verificationStatus ?? 'Not started'}
                </span>
              </div>
              <Link
                href="/dashboard/verification"
                className="btn-primary mt-4 inline-block px-5 py-2.5 text-sm no-underline"
              >
                Get verified
              </Link>
            </section>
          )}

          <section className="card p-6">
            <h3 className="text-lg font-semibold text-content">Inspection requests</h3>
            <p className="mt-1 text-sm text-content-secondary">
              Approve or decline tenants who want to view your properties. You earn ₦7,000
              per completed inspection.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/dashboard/requests" className="btn-primary px-5 py-2.5 text-sm no-underline">
                View requests
              </Link>
              <Link href="/dashboard/tenancy" className="btn-ghost px-5 py-2.5 text-sm no-underline">
                Tenancy
              </Link>
            </div>
          </section>

          <section className="card p-6">
            <h3 className="text-lg font-semibold text-content">Managing your properties</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { href: '/dashboard/rentals', label: 'Rentals & agreements' },
                { href: '/dashboard/earnings', label: 'Earnings' },
                { href: '/dashboard/issues', label: 'Issues' },
                { href: '/dashboard/activity', label: 'Recent activity' },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="btn-ghost px-4 py-3 text-center text-sm no-underline"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-content">Your listings</h3>
            <Link href="/list" className="btn-primary px-4 py-2 text-sm no-underline">
              Add property
            </Link>
          </div>

          {listings === null ? (
            <p className="text-sm text-content-secondary">Loading listings…</p>
          ) : listings.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-content-secondary">No listings yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {listings.map((l) => {
                const state = listingState(l)
                return (
                  <Link
                    key={l.id}
                    href={`/dashboard/listings/${l.id}`}
                    className="card flex items-center justify-between gap-4 p-4 no-underline"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-content">{l.title}</p>
                      <p className="truncate text-sm text-content-secondary">
                        {[l.city, l.state].filter(Boolean).join(', ')}
                      </p>
                    </div>
                    <span
                      className={`chip shrink-0 ${
                        state.tone === 'live' ? 'chip-live' : 'chip-pending'
                      }`}
                    >
                      {state.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}

      {accountType === 'tenant' && (
        <>
          {/*
            Both of these are enforced by firestore.rules on the
            inspection_requests create - verificationStatus via the client
            gate, hasBankDetails via actorHasBankDetails(). Showing them as a
            checklist means the tenant knows why booking is unavailable
            instead of meeting a permission error at the end.
          */}
          <section className="card p-6">
            <h3 className="text-lg font-semibold text-content">
              Before you can book an inspection
            </h3>
            <div className="mt-4 space-y-3">
              {[
                {
                  done: profile?.verificationStatus === 'verified',
                  pending: profile?.verificationStatus === 'pending',
                  label: 'Identity verified',
                  hint: 'NIN and proof of address, reviewed by an admin.',
                  href: '/dashboard/verification',
                  cta: 'Get verified',
                },
                {
                  done: profile?.hasBankDetails === true,
                  pending: false,
                  label: 'Payout account on file',
                  hint: 'So a refund has somewhere to go if an inspection is disputed.',
                  href: '/dashboard/bank',
                  cta: 'Add account',
                },
              ].map((step) => (
                <div
                  key={step.label}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-divider pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-content">
                      {step.done ? '✓ ' : ''}
                      {step.label}
                    </p>
                    <p className="text-sm text-content-secondary">{step.hint}</p>
                  </div>
                  {step.done ? (
                    <span className="verified-badge shrink-0">Done</span>
                  ) : step.pending ? (
                    <span className="chip chip-pending shrink-0">Under review</span>
                  ) : (
                    <Link
                      href={step.href}
                      className="btn-ghost shrink-0 px-4 py-2 text-sm no-underline"
                    >
                      {step.cta}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="card p-6">
            <h3 className="text-lg font-semibold text-content">Find a place</h3>
            <p className="mt-1 text-sm text-content-secondary">
              Browse verified listings and book an inspection.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/properties" className="btn-primary px-5 py-2.5 text-sm no-underline">
                Browse properties
              </Link>
              <Link
                href="/dashboard/inspections"
                className="btn-ghost px-5 py-2.5 text-sm no-underline"
              >
                My inspections
              </Link>
            </div>
          </section>

          <section className="card p-6">
            <h3 className="text-lg font-semibold text-content">Your tenancy</h3>
            <p className="mt-1 text-sm text-content-secondary">
              Agreement, rent and move-out all live under Tenancy.
            </p>
            {/*
              Tenancy was missing here, which made it unreachable: it is not in
              the tenant's bottom nav either, so the agreement, the pay-rent
              button and move-out could only be found by typing the URL.
            */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { href: '/dashboard/tenancy', label: 'Tenancy, agreement & rent' },
                { href: '/dashboard/rentals', label: 'My rentals' },
                { href: '/dashboard/documents', label: 'Documents' },
                { href: '/dashboard/issues', label: 'Report an issue' },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="btn-ghost px-4 py-3 text-center text-sm no-underline"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      {accountType === 'agent' && <AgentHome verified={profile?.verificationStatus === 'verified'} />}
    </div>
  )
}
