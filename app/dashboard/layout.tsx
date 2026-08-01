'use client'

import { usePathname } from 'next/navigation'
import AppShell from '../../components/AppShell'

/*
  Titles live here rather than in each page so the mobile top bar, which is part
  of the shell, always has one.
*/
const titles: Record<string, string> = {
  '/dashboard': 'Home',
  '/dashboard/activity': 'Activity',
  '/dashboard/bank': 'Bank details',
  '/dashboard/coverage': 'Coverage & availability',
  '/dashboard/documents': 'Documents',
  '/dashboard/earnings': 'Earnings',
  '/dashboard/handling': 'Properties you handle',
  '/dashboard/inspections': 'Inspections',
  '/dashboard/leads': 'Leads',
  '/dashboard/issues': 'Issues',
  '/dashboard/listings': 'Listing',
  '/dashboard/messages': 'Messages',
  '/dashboard/notifications': 'Notifications',
  '/dashboard/profile': 'Profile',
  '/dashboard/rentals': 'Rentals',
  '/dashboard/requests': 'Inspection requests',
  '/dashboard/saved': 'Saved',
  '/dashboard/tenancy': 'Tenancy',
  '/dashboard/verification': 'Verification',
}

/**
 * Titles for deeper routes, where the nearest parent's title would be wrong —
 * `/rentals/{id}/renew` is "Renew tenancy", not "Rentals". `*` stands in for a
 * dynamic segment.
 */
const deepTitles: Record<string, string> = {
  '/dashboard/handling/*': 'Property you handle',
  '/dashboard/listings/*/agent': 'Assign an agent',
  '/dashboard/listings/*/health': 'Property health',
  '/dashboard/messages/*': 'Conversation',
  '/dashboard/rentals/*/renew': 'Renew tenancy',
  '/dashboard/rentals/*/rent-change': 'Request a rent change',
  '/dashboard/rentals/*': 'Lease details',
}

/**
 * Every way this path could be read with one dynamic segment, e.g.
 * `/dashboard/rentals/abc/renew` yields `/dashboard/rentals/-/renew`
 * (with `-` written as `*` in the table above).
 */
function patterns(pathname: string): string[] {
  const parts = pathname.split('/')
  const out: string[] = []
  // Segment 0 is empty, 1 is 'dashboard', 2 is the section — the first
  // candidate for a dynamic segment is 3.
  for (let i = 3; i < parts.length; i++) {
    out.push([...parts.slice(0, i), '*', ...parts.slice(i + 1)].join('/'))
  }
  return out
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  let title: string | undefined = titles[pathname]

  if (!title) {
    title = patterns(pathname)
      .map((p) => deepTitles[p])
      .find(Boolean)
  }

  if (!title) {
    const parent = Object.keys(titles).find(
      (k) => k !== '/dashboard' && pathname.startsWith(k + '/'),
    )
    title = parent ? titles[parent] : undefined
  }

  return <AppShell title={title}>{children}</AppShell>
}
