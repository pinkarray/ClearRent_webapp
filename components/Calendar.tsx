'use client'

import { useState } from 'react'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** 'YYYY-MM-DD' → parts, without going through Date and its timezone shifts. */
function parseISO(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month: month - 1, day }
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** Weekday index (0 = Sunday) of the 1st of the month. */
function firstWeekday(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

/**
 * Inline month calendar for picking an inspection date.
 *
 * Deliberately hand-rolled rather than a date-picker dependency: the only
 * unusual requirement is showing which weekdays the handler actually offers,
 * and a library would still need that logic layered on top.
 *
 * [minISO] is required and supplied by the caller rather than read from the
 * clock here — reading the clock during render is impure, and the caller
 * already resolves "tomorrow" on mount.
 */
export function Calendar({
  value,
  onChange,
  minISO,
  allowedDayNames,
}: {
  /** Selected date as 'YYYY-MM-DD', or '' for none. */
  value: string
  onChange: (iso: string) => void
  /** Earliest selectable date, 'YYYY-MM-DD'. */
  minISO: string
  /** Full weekday names the handler shows on. Empty means every day. */
  allowedDayNames: string[]
}) {
  const min = parseISO(minISO)
  // Opens on the month containing the first selectable day. Derived from props,
  // so this stays a pure initializer.
  const [view, setView] = useState(() => {
    const start = value ? parseISO(value) : min
    return { year: start.year, month: start.month }
  })

  const total = daysInMonth(view.year, view.month)
  const offset = firstWeekday(view.year, view.month)
  const selected = value ? parseISO(value) : null

  // Never page back before the month holding the earliest selectable date.
  const atFloor = view.year === min.year && view.month === min.month

  function shiftMonth(delta: number) {
    setView((v) => {
      const next = new Date(v.year, v.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  function dayState(day: number): { selectable: boolean; reason: 'past' | 'closed' | null } {
    const iso = toISO(view.year, view.month, day)
    if (iso < minISO) return { selectable: false, reason: 'past' }
    if (allowedDayNames.length > 0) {
      const weekday = DAY_NAMES[new Date(view.year, view.month, day).getDay()]
      if (!allowedDayNames.includes(weekday)) return { selectable: false, reason: 'closed' }
    }
    return { selectable: true, reason: null }
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={atFloor}
          aria-label="Previous month"
          className="rounded-sm px-3 py-1.5 text-lg leading-none text-content-secondary disabled:opacity-30"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-content">
          {MONTH_NAMES[view.month]} {view.year}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="rounded-sm px-3 py-1.5 text-lg leading-none text-content-secondary"
        >
          ›
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {DAY_INITIALS.map((d, i) => (
          <span
            key={i}
            className="py-1 text-center text-xs font-medium text-content-hint"
            aria-hidden="true"
          >
            {d}
          </span>
        ))}

        {Array.from({ length: offset }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}

        {Array.from({ length: total }, (_, i) => {
          const day = i + 1
          const iso = toISO(view.year, view.month, day)
          const { selectable, reason } = dayState(day)
          const isSelected =
            selected?.year === view.year &&
            selected?.month === view.month &&
            selected?.day === day

          return (
            <button
              key={day}
              type="button"
              disabled={!selectable}
              aria-pressed={isSelected}
              aria-label={`${day} ${MONTH_NAMES[view.month]} ${view.year}${
                reason === 'closed' ? ' — not available' : ''
              }`}
              onClick={() => onChange(iso)}
              className="aspect-square rounded-sm text-sm transition-colors disabled:cursor-not-allowed"
              style={{
                background: isSelected ? 'var(--primary)' : 'transparent',
                color: isSelected
                  ? '#fff'
                  : selectable
                    ? 'var(--text-primary)'
                    : 'var(--text-hint)',
                opacity: selectable ? 1 : 0.35,
                // A closed day is struck through so it reads as "the handler
                // doesn't show on this day", not "already gone".
                textDecoration: reason === 'closed' ? 'line-through' : 'none',
                border: isSelected ? 'none' : '1px solid transparent',
              }}
            >
              {day}
            </button>
          )
        })}
      </div>

      {allowedDayNames.length > 0 && allowedDayNames.length < 7 && (
        <p className="mt-3 text-xs text-content-hint">
          Struck-through days are not offered for this property.
        </p>
      )}
    </div>
  )
}
