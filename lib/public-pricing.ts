import { adminDb } from './firebase-admin'

/**
 * The live price list for the signed-out home page, read from config/pricing
 * on the server (the rules let only signed-in users read config).
 *
 * The page used to type its amounts in by hand, and they drifted: agent
 * verification read "one-time ₦7,000" while the real fee was ₦10,000 then
 * ₦7,000 a year. Reading the schedule keeps the page honest when an admin
 * changes a price. Defaults are today's schedule, for a failed read.
 */
export type PublicPricing = {
  verification: Record<'tenant' | 'landlord' | 'agent', { initial: number; renewal: number }>
  dealFee: number
  listing: number
  viewing: number
  /** Lowest and highest landlord service fee across the bands. */
  landlordFee: { min: number; max: number }
}

const DEFAULTS: PublicPricing = {
  verification: {
    tenant: { initial: 5000, renewal: 3000 },
    landlord: { initial: 15000, renewal: 12000 },
    agent: { initial: 10000, renewal: 7000 },
  },
  dealFee: 5000,
  listing: 10000,
  viewing: 10000,
  landlordFee: { min: 7500, max: 75000 },
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && v > 0 ? v : fallback)

export async function getPublicPricing(): Promise<PublicPricing> {
  try {
    const d = (await adminDb().doc('config/pricing').get()).data() ?? {}
    const v = (d.verification ?? {}) as Record<string, Record<string, unknown> | undefined>
    const role = (r: 'tenant' | 'landlord' | 'agent') => ({
      initial: num(v[r]?.initial, DEFAULTS.verification[r].initial),
      renewal: num(v[r]?.renewal, DEFAULTS.verification[r].renewal),
    })
    const fees = (Array.isArray(d.serviceFeeBands) ? d.serviceFeeBands : [])
      .map((b: Record<string, unknown>) => b?.landlord)
      .filter((n: unknown): n is number => typeof n === 'number' && n > 0)
    return {
      verification: { tenant: role('tenant'), landlord: role('landlord'), agent: role('agent') },
      dealFee: num(d.dealFee, DEFAULTS.dealFee),
      listing: num(d.listing, DEFAULTS.listing),
      viewing: num((d.inspection as Record<string, unknown> | undefined)?.total, DEFAULTS.viewing),
      landlordFee:
        fees.length > 0 ? { min: Math.min(...fees), max: Math.max(...fees) } : DEFAULTS.landlordFee,
    }
  } catch {
    return DEFAULTS
  }
}
