import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { clientDb } from './firebase-client'

/*
  Agent discovery and assignment, mirroring `agent_service.dart:97` and
  `property_service.dart:945`.

  Only verified agents are listed - the same `accountType == 'agent'` +
  `isVerified == true` pair the app queries. `/users` is readable by any signed
  in user (`firestore.rules:65`), so this needs no server route.
*/

export type Agent = {
  id: string
  fullName: string
  phone: string
  baseLocation: string
  serviceAreas: string[]
  rating: number
  totalInspections: number
  totalRatings: number
}

export async function verifiedAgents(): Promise<Agent[]> {
  const snap = await getDocs(
    query(
      collection(clientDb(), 'users'),
      where('accountType', '==', 'agent'),
      where('isVerified', '==', true),
    ),
  )
  return snap.docs.map((d) => {
    const x = d.data()
    return {
      id: d.id,
      fullName: (x.fullName as string) ?? 'Agent',
      phone: (x.phone as string) ?? '',
      baseLocation: (x.baseLocation as string) ?? '',
      serviceAreas: Array.isArray(x.serviceAreas)
        ? x.serviceAreas.filter((a): a is string => typeof a === 'string')
        : [],
      rating: (x.rating as number) ?? 0,
      totalInspections: (x.totalInspections as number) ?? 0,
      totalRatings: (x.totalRatings as number) ?? 0,
    }
  })
}

/** True when the agent covers this area, matching `AgentModel.servesArea`. */
export function servesArea(agent: Agent, area: string): boolean {
  if (!area) return true
  const needle = area.toLowerCase()
  return agent.serviceAreas.some(
    (a) => a.toLowerCase().includes(needle) || needle.includes(a.toLowerCase()),
  )
}

/**
 * Assigns an agent to a property.
 *
 * Two consequences that are easy to miss and are deliberate:
 * - `readyForInspections` is reset to false. The handler changed, so the new
 *   agent must re-vet before the property is bookable again — assignment
 *   un-publishes the listing until they do.
 * - `savedAgentFee` is restored if a previous agent stepped away, so the
 *   landlord does not have to re-enter the fee.
 */
export async function assignAgent(
  propertyId: string,
  agent: { id: string; fullName: string; phone: string },
): Promise<string | null> {
  try {
    const ref = doc(clientDb(), 'properties', propertyId)
    const snap = await getDoc(ref)
    const savedFee = (snap.data()?.savedAgentFee as number | undefined) ?? 0

    await updateDoc(ref, {
      assignedAgentId: agent.id,
      assignedAgentName: agent.fullName,
      assignedAgentPhone: agent.phone,
      // Keep the handler consistent, or it reads back as 'self'.
      inspectionHandler: 'agent',
      readyForInspections: false,
      readinessCheckedAt: deleteField(),
      readinessCheckedBy: deleteField(),
      ...(savedFee > 0 ? { agentFee: savedFee, savedAgentFee: deleteField() } : {}),
      updatedAt: serverTimestamp(),
    })
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not assign that agent.'
  }
}
