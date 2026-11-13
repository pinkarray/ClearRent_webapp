import { Timestamp } from 'firebase/firestore'

/** One thing that comes with a furnished stay. Mirrors the app's InventoryItem. */
export type InventoryItem = { name: string; qty: number; photoUrl?: string }

/**
 * How a listing is let. 'yearly' is the ordinary lease; 'furnished' is 1 to 11
 * months paid up front, at a monthly rent, fully furnished with an item list;
 * 'short' is the same months for an unfurnished or partly furnished home, no
 * item list. One per listing, as in the app.
 */
export type Stay = {
  stayType: 'yearly' | 'furnished' | 'short'
  minStayMonths: number
  maxStayMonths: number
  /** yyyy-mm-dd from a date input, or '' for "available now". */
  availableFrom: string
  inventory: InventoryItem[]
}

export const EMPTY_STAY: Stay = {
  stayType: 'yearly',
  minStayMonths: 1,
  maxStayMonths: 6,
  availableFrom: '',
  inventory: [],
}

/** Booked by the month and paid in full up front: furnished stay or short lease. */
export function isMonthStay(stayType: unknown): boolean {
  return stayType === 'furnished' || stayType === 'short'
}

export function stayFromDoc(d: Record<string, unknown>): Stay {
  const from = d.availableFrom
  // Duck-typed: the public pages read through the admin SDK, whose Timestamp
  // is not the client SDK's class.
  const date =
    from && typeof (from as Timestamp).toDate === 'function'
      ? (from as Timestamp).toDate()
      : typeof from === 'string'
        ? new Date(from)
        : null
  return {
    stayType: d.stayType === 'furnished' || d.stayType === 'short' ? d.stayType : 'yearly',
    minStayMonths: typeof d.minStayMonths === 'number' ? d.minStayMonths : 1,
    maxStayMonths: typeof d.maxStayMonths === 'number' ? d.maxStayMonths : 6,
    availableFrom: date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : '',
    inventory: Array.isArray(d.inventory)
      ? (d.inventory as Record<string, unknown>[])
          .filter((i) => typeof i?.name === 'string' && i.name)
          .map((i) => ({
            name: i.name as string,
            qty: typeof i.qty === 'number' ? i.qty : 1,
            ...(typeof i.photoUrl === 'string' && i.photoUrl ? { photoUrl: i.photoUrl } : {}),
          }))
      : [],
  }
}

/** Why firestore.rules stayValid() would refuse this, or null. */
export function stayError(stay: Stay, furnishing: string | null): string | null {
  if (stay.stayType === 'short') {
    if (furnishing !== 'unfurnished' && furnishing !== 'partly')
      return 'A short lease is for an unfurnished or partly furnished home. A fully furnished one is let as a furnished stay.'
    if (stay.minStayMonths > stay.maxStayMonths)
      return 'The shortest lease cannot be longer than the longest.'
    return null
  }
  if (stay.stayType !== 'furnished') return null
  if (furnishing !== 'fully') return 'A furnished stay must be fully furnished.'
  if (stay.minStayMonths > stay.maxStayMonths)
    return 'The shortest stay cannot be longer than the longest.'
  if (stay.inventory.length === 0) return 'List at least one item that comes with the place.'
  return null
}

/** The fields written to the property doc. Same shape as PropertyModel.stayFields. */
export function stayPayload(stay: Stay): Record<string, unknown> {
  if (!isMonthStay(stay.stayType)) return { stayType: 'yearly' }
  return {
    stayType: stay.stayType,
    rentFrequency: 'monthly',
    minStayMonths: stay.minStayMonths,
    maxStayMonths: stay.maxStayMonths,
    ...(stay.availableFrom
      ? { availableFrom: Timestamp.fromDate(new Date(`${stay.availableFrom}T00:00:00`)) }
      : {}),
    ...(stay.stayType === 'furnished' ? { inventory: stay.inventory } : {}),
  }
}
