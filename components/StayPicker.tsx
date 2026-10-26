'use client'

import { useCallback, useRef, useState } from 'react'
import { formatNairaFull } from '../lib/format'
import type { Stay } from '../lib/stay'

export type StayPick = { months: number; startDay: string }

type Options = { title: string; monthlyRent: number; stay: Stay }

/** Today in Lagos, "yyyy-mm-dd". The server checks against the same day. */
function lagosToday(): string {
  return new Date(Date.now() + 3600_000).toISOString().slice(0, 10)
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Asks a tenant how many months of a furnished stay and from which day, before
 * the interest is sent. Same dialog styling as useAskText. The server re-checks
 * both and prices the stay itself; the total shown is the rent part only.
 *
 *   const [pickStay, stayDialog] = useStayPicker()
 *   const pick = await pickStay({ title, monthlyRent, stay })  // null when cancelled
 */
export function useStayPicker(): [(options: Options) => Promise<StayPick | null>, React.ReactNode] {
  const [options, setOptions] = useState<Options | null>(null)
  const [months, setMonths] = useState(1)
  const [startDay, setStartDay] = useState('')
  const resolver = useRef<((value: StayPick | null) => void) | null>(null)

  const pick = useCallback((next: Options) => {
    resolver.current?.(null)
    setMonths(next.stay.minStayMonths)
    setStartDay('')
    setOptions(next)
    return new Promise<StayPick | null>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  function finish(value: StayPick | null) {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }

  if (!options) return [pick, null]

  const { minStayMonths: min, maxStayMonths: max, availableFrom } = options.stay
  const today = lagosToday()
  const earliest = availableFrom && availableFrom > today ? availableFrom : today
  const latest = addDays(earliest, 90)

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={options.title}
      onClick={() => finish(null)}
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold text-content">{options.title}</p>
        <p className="mt-1 text-sm text-content-secondary">
          Choose how long and when you move in. You pay for the whole stay once the landlord
          accepts and the agreement is signed.
        </p>
        <label className="mt-4 block text-sm text-content-secondary">
          How many months ({min} to {max})
          <select
            className="input-field mt-1 px-3 py-2.5"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          >
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((m) => (
              <option key={m} value={m}>
                {m} month{m === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm text-content-secondary">
          Move-in day
          <input
            type="date"
            className="input-field mt-1 px-3 py-2.5"
            min={earliest}
            max={latest}
            value={startDay}
            onChange={(e) => setStartDay(e.target.value)}
          />
        </label>
        <p className="mt-4 rounded-md bg-primary-tint px-3 py-2 text-sm text-content">
          Rent: {formatNairaFull(options.monthlyRent * months)} (
          {formatNairaFull(options.monthlyRent)} x {months}). The deal fee and any agent fee are
          added at payment.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button className="btn-ghost px-5 py-2.5 text-sm" onClick={() => finish(null)}>
            Cancel
          </button>
          <button
            className="btn-primary px-5 py-2.5 text-sm"
            disabled={!startDay || startDay < earliest || startDay > latest}
            onClick={() => finish({ months, startDay })}
          >
            Send interest
          </button>
        </div>
      </div>
    </div>
  )

  return [pick, dialog]
}
