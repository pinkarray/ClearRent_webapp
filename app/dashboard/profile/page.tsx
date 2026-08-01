'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../components/AuthProvider'

/*
  The app's Profile tab (`landlord_home_screen.dart:1371`,
  `tenant_home_screen.dart:2301`) is a menu hub. Web had the same destinations —
  verification, bank details, inspections — as loose /dashboard/* routes that
  nothing linked to, reachable only by typing the URL. This gives them the home
  they have in the app.
*/

type Item = { href: string; title: string; subtitle: string; badge?: string }

function verificationSubtitle(status: string | undefined): string {
  if (status === 'verified') return 'Your identity is verified'
  if (status === 'pending') return 'Submitted — under review'
  if (status === 'rejected') return 'Rejected — submit again'
  return 'Verify your identity to unlock booking'
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, profile, signOut } = useAuth()

  const accountType = profile?.accountType
  const status = profile?.verificationStatus

  const items: Item[] = [
    {
      href: '/dashboard/verification',
      title: 'Verification',
      subtitle: verificationSubtitle(status),
      badge: status === 'verified' ? 'Verified' : undefined,
    },
    {
      href: '/dashboard/bank',
      title: 'Bank details',
      subtitle:
        profile?.hasBankDetails === true
          ? 'Payout account on file'
          : 'Add the account refunds and payouts go to',
    },
    {
      href: '/dashboard/inspections',
      title: accountType === 'landlord' ? 'Inspections' : 'My inspections',
      subtitle: 'Track inspection requests and outcomes',
    },
    {
      href: '/dashboard/tenancy',
      title: 'Tenancy',
      subtitle: accountType === 'landlord' ? 'Your tenants and rentals' : 'Your current rental',
    },
  ]

  // Tenant-only destinations, matching the app's Profile menu.
  if (accountType === 'tenant') {
    items.push(
      {
        href: '/dashboard/saved',
        title: 'Saved properties',
        subtitle: 'Listings you kept for later',
      },
      {
        href: '/dashboard/rentals',
        title: 'My rentals',
        subtitle: 'Every tenancy you have had, and its lease terms',
      },
      {
        href: '/dashboard/documents',
        title: 'Documents',
        subtitle: 'Tenancy agreements and payment receipts',
      },
      {
        href: '/dashboard/issues',
        title: 'My issues',
        subtitle: 'Report a problem and track what you have reported',
      },
    )
  }

  // Landlord-only destinations, matching the app's Profile menu.
  if (accountType === 'landlord') {
    items.push(
      {
        href: '/dashboard/rentals',
        title: 'Rentals and agreements',
        subtitle: 'Your tenants, their leases and the agreement workflow',
      },
      {
        href: '/dashboard/earnings',
        title: 'Earnings and transactions',
        subtitle: 'What you have been paid, and what is still pending',
      },
      {
        href: '/dashboard/issues',
        title: 'Issues',
        subtitle: 'Maintenance your tenants have reported',
      },
      {
        href: '/dashboard/activity',
        title: 'Recent activity',
        subtitle: 'Views, inquiries and events across your listings',
      },
    )
  }

  // Agent-only destinations, matching the app's Profile menu.
  if (accountType === 'agent') {
    items.push(
      {
        href: '/dashboard/handling',
        title: 'Properties you handle',
        subtitle: 'Vet them, set showing times, or step back',
      },
      {
        href: '/dashboard/coverage',
        title: 'Coverage and availability',
        subtitle: 'Where you work and when you are free',
      },
      {
        href: '/dashboard/leads',
        title: 'Leads',
        subtitle: 'Unassigned listings you could pitch for',
      },
    )
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <p className="text-lg font-semibold text-content">
          {profile?.fullName ?? 'Your account'}
        </p>
        <p className="mt-0.5 text-sm text-content-secondary">
          {user?.phoneNumber ?? user?.email}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {accountType && (
            <span className="chip capitalize">{accountType}</span>
          )}
          <span className={`chip ${status === 'verified' ? 'chip-live' : 'chip-pending'}`}>
            {status === 'verified' ? 'Verified' : verificationSubtitle(status)}
          </span>
        </div>
      </section>

      <section className="card divide-y divide-divider">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between gap-4 px-5 py-4 no-underline"
          >
            <div className="min-w-0">
              <p className="font-medium text-content">{item.title}</p>
              <p className="truncate text-sm text-content-secondary">{item.subtitle}</p>
            </div>
            {item.badge ? (
              <span className="verified-badge shrink-0">{item.badge}</span>
            ) : (
              <span aria-hidden className="shrink-0 text-content-hint">
                ›
              </span>
            )}
          </Link>
        ))}
      </section>

      <section className="card divide-y divide-divider">
        <Link href="/terms" className="block px-5 py-4 text-content no-underline">
          Terms of service
        </Link>
        <Link href="/privacy" className="block px-5 py-4 text-content no-underline">
          Privacy policy
        </Link>
      </section>

      <button
        className="w-full rounded-sm border border-border px-5 py-3 text-sm font-medium text-error"
        onClick={async () => {
          await signOut()
          router.push('/')
        }}
      >
        Sign out
      </button>
    </div>
  )
}
