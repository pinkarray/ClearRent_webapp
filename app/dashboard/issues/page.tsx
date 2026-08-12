'use client'

import { useAuth } from '../../../components/AuthProvider'
import LandlordIssueQueue from '../../../components/LandlordIssueQueue'
import TenantIssueCentre from '../../../components/TenantIssueCentre'

/*
  One route, two sides of the same collection - a landlord works the queue, a
  tenant reports and tracks. Branching here rather than on separate URLs keeps
  it consistent with /dashboard/tenancy and /dashboard/inspections, and means a
  notification linking to /dashboard/issues lands correctly for either role.
*/
export default function IssuesPage() {
  const { profile } = useAuth()
  return profile?.accountType === 'landlord' ? <LandlordIssueQueue /> : <TenantIssueCentre />
}
