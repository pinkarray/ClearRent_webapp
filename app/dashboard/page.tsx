'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useAuth } from '../../components/AuthProvider'
import { clientDb } from '../../lib/firebase-client'
import { saveAccountType, type AccountType } from '../../lib/user-profile'

type OwnListing = {
  id: string
  title: string
  city: string
  state: string
  isAvailable: boolean
  readyForInspections: boolean
  ownershipDocStatus: string
}

/**
 * Explains, in the landlord's terms, why a listing is or is not on public
 * browse. The three conditions are the same gate `lib/property.ts` applies
 * server-side — stated once here so the answer never diverges from the truth.
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
  const router = useRouter()
  const { user, profile, ready, refreshProfile, signOut } = useAuth()
  const [listings, setListings] = useState<OwnListing[] | null>(null)
  const [savingType, setSavingType] = useState(false)

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  useEffect(() => {
    if (!user || profile?.accountType !== 'landlord') return
    ;(async () => {
      const snap = await getDocs(
        query(collection(clientDb(), 'properties'), where('landlordId', '==', user.uid)),
      )
      setListings(
        snap.docs.map((d) => {
          const x = d.data()
          return {
            id: d.id,
            title: (x.title as string) ?? '(untitled)',
            city: (x.city as string) ?? '',
            state: (x.state as string) ?? '',
            isAvailable: x.isAvailable === true,
            readyForInspections: x.readyForInspections === true,
            ownershipDocStatus: (x.ownershipDocStatus as string) ?? 'none',
          }
        }),
      )
    })()
  }, [user, profile])

  if (!ready || !user) {
    return (
      <main className="mesh-bg min-h-screen">
        <div className="container py-16 text-[var(--text-secondary)]">Loading…</div>
      </main>
    )
  }

  const accountType = profile?.accountType

  return (
    <main className="mesh-bg min-h-screen">
      <div className="container max-w-4xl py-12">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-medium text-[var(--primary)] no-underline hover:underline"
          >
            ← ClearRent
          </Link>
          <button
            className="text-sm text-[var(--text-secondary)] underline"
            onClick={async () => {
              await signOut()
              router.push('/')
            }}
          >
            Sign out
          </button>
        </div>

        <h1 className="mt-4 text-3xl font-bold text-[var(--text-primary)]">
          {profile?.fullName ? `Hello, ${profile.fullName.split(' ')[0]}` : 'Your dashboard'}
        </h1>
        <p className="mt-1 text-[var(--text-secondary)]">
          {accountType ? `Signed in as ${accountType}` : 'Signed in'} · {user.phoneNumber ?? user.email}
        </p>

        {/*
          Accounts predating web onboarding (and the two staff accounts) have no
          accountType, and every section below keys off it. Without this they
          would land on an empty dashboard with no way forward.
        */}
        {!accountType && (
          <div className="card mt-6 p-6">
            <h2 className="font-semibold text-[var(--text-primary)]">
              How do you use ClearRent?
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
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
          </div>
        )}

        {accountType && !profile?.profileCompleted && (
          <div className="card mt-6 border-l-4 border-l-[var(--secondary)] p-5">
            <p className="font-semibold text-[var(--text-primary)]">Finish setting up</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Your profile is incomplete.{' '}
              <Link href="/signup" className="text-[var(--primary)] no-underline">
                Complete it
              </Link>
              .
            </p>
          </div>
        )}

        {accountType === 'landlord' && (
          <>
            {profile?.verificationStatus !== 'verified' && (
              <div className="card mt-6 border-l-4 border-l-[var(--secondary)] p-5">
                <p className="font-semibold text-[var(--text-primary)]">
                  Verify your identity to list
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Listing requires a verified account. NIN verification runs through a Cloud
                  Function that enforces App Check, which is not yet wired for web — complete
                  verification in the ClearRent app for now. Current status:{' '}
                  <code>{profile?.verificationStatus ?? 'not started'}</code>.
                </p>
              </div>
            )}

            <div className="card mt-8 p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Inspection requests
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Approve or decline tenants who want to view your properties. You earn{' '}
                ₦7,000 per completed inspection.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/dashboard/requests" className="btn-primary px-6 py-3 no-underline">
                  View requests
                </Link>
                <Link href="/dashboard/tenancy" className="btn-ghost px-6 py-3 no-underline">
                  Tenancy
                </Link>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">Your listings</h2>
              <Link href="/list" className="btn-primary px-5 py-2.5 text-sm no-underline">
                Add property
              </Link>
            </div>

            {listings === null ? (
              <p className="mt-4 text-sm text-[var(--text-secondary)]">Loading listings…</p>
            ) : listings.length === 0 ? (
              <div className="card mt-4 p-8 text-center">
                <p className="text-[var(--text-secondary)]">No listings yet.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {listings.map((l) => {
                  const state = listingState(l)
                  return (
                    <Link
                      key={l.id}
                      href={`/dashboard/listings/${l.id}`}
                      className="card flex items-center justify-between gap-4 p-5 no-underline"
                    >
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">{l.title}</p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {[l.city, l.state].filter(Boolean).join(', ')}
                        </p>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
                        style={{
                          background:
                            state.tone === 'live'
                              ? 'rgba(10,123,108,0.1)'
                              : 'rgba(244,168,54,0.15)',
                          color:
                            state.tone === 'live' ? 'var(--primary)' : 'var(--secondary-dark)',
                        }}
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
              inspection_requests create — verificationStatus via the client
              gate, hasBankDetails via actorHasBankDetails(). Showing them as a
              checklist means the tenant knows why booking is unavailable
              instead of meeting a permission error at the end.
            */}
            <div className="card mt-8 p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Before you can book an inspection
              </h2>
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
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--divider)] pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text-primary)]">
                        {step.done ? '✓ ' : ''}
                        {step.label}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">{step.hint}</p>
                    </div>
                    {step.done ? (
                      <span className="verified-badge shrink-0">Done</span>
                    ) : step.pending ? (
                      <span className="shrink-0 text-sm text-[var(--text-secondary)]">
                        Under review
                      </span>
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
            </div>

            <div className="card mt-6 p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Find a place</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Browse verified listings and book an inspection.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/properties" className="btn-primary px-6 py-3 no-underline">
                  Browse properties
                </Link>
                <Link href="/dashboard/inspections" className="btn-ghost px-6 py-3 no-underline">
                  My inspections
                </Link>
                <Link href="/dashboard/tenancy" className="btn-ghost px-6 py-3 no-underline">
                  Tenancy
                </Link>
              </div>
            </div>
          </>
        )}

        {accountType === 'agent' && (
          <div className="card mt-8 p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Agent tools</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Assignment and inspection handling are still app-only. They are next after the
              landlord surface.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
