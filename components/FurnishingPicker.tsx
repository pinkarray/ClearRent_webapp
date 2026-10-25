'use client'

import { FURNISHING_HINTS, FURNISHING_LABELS } from '../lib/format'

/**
 * The three furnishing levels with what each means, mirroring the app's
 * FurnishingPicker. `onChange` absent shows the value without letting it
 * change (an occupied listing: the sitting tenant moved in on what it says).
 */
export function FurnishingPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange?: (v: string) => void
}) {
  return (
    <div role="radiogroup" aria-label="Furnishing" className="grid gap-2">
      {Object.entries(FURNISHING_LABELS).map(([key, label]) => {
        const on = value === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={!onChange}
            onClick={() => onChange?.(key)}
            className="rounded-lg px-4 py-3 text-left disabled:cursor-not-allowed"
            style={{
              background: on ? 'var(--primary-tint)' : 'var(--surface)',
              border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
              opacity: !onChange && !on ? 0.6 : 1,
            }}
          >
            <span
              className="block text-sm font-medium"
              style={{ color: on ? 'var(--primary)' : 'var(--text-primary)' }}
            >
              {label}
            </span>
            <span className="mt-0.5 block text-xs text-content-secondary">
              {FURNISHING_HINTS[key]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
