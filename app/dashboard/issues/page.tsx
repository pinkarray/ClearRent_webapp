'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '../../../components/AuthProvider'
import LandlordIssueQueue from '../../../components/LandlordIssueQueue'
import TenantIssueCentre from '../../../components/TenantIssueCentre'

/*
  One route, three readings of the same collection - a landlord works the
  queue, a tenant reports and tracks, and a caretaker works the queue for the
  one unit they manage. Branching here rather than on separate URLs keeps it
  consistent with /dashboard/tenancy and /dashboard/inspections, and means a
  notification linking to /dashboard/issues lands correctly for either role.

  The caretaker case CANNOT be inferred from accountType: a caretaker keeps
  whatever role they signed up with, and the live one in prod is a tenant. So
  the property health screen passes `?asCaretaker=1&propertyId=...` and we take
  it from there - without it a caretaker fell through to TenantIssueCentre and
  was shown the report-an-issue form instead of the triage they came for.
  Mirrors the `asCaretaker` extra in `property_health_screen.dart`.
*/
function IssuesRouter() {
  const { profile } = useAuth()
  const params = useSearchParams()

  const propertyId = params.get('propertyId')
  if (params.get('asCaretaker') === '1' && propertyId) {
    return <LandlordIssueQueue propertyId={propertyId} />
  }

  return profile?.accountType === 'landlord' ? <LandlordIssueQueue /> : <TenantIssueCentre />
}

export default function IssuesPage() {
  // useSearchParams needs a Suspense boundary or the whole route opts out of
  // static rendering at build time.
  return (
    <Suspense fallback={null}>
      <IssuesRouter />
    </Suspense>
  )
}
