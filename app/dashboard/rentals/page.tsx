'use client'

import { useAuth } from '../../../components/AuthProvider'
import LandlordRentals from '../../../components/LandlordRentals'
import TenantRentals from '../../../components/TenantRentals'

/*
  Both sides read `active_rentals`, but they do opposite things with it: a
  landlord manages the agreement and files rent changes, a tenant reads the
  lease terms and renews. Branching here rather than on separate URLs keeps the
  route stable for links from notifications and the Profile hub.
*/
export default function RentalsPage() {
  const { profile } = useAuth()
  return profile?.accountType === 'landlord' ? <LandlordRentals /> : <TenantRentals />
}
