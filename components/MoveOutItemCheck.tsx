'use client'

import { useState } from 'react'
import type { InventoryItem } from '../lib/stay'
import type { ItemCheck } from '../lib/tenancy'

const STATES: Array<[ItemCheck['state'], string]> = [
  ['ok', 'Fine'],
  ['damaged', 'Damaged'],
  ['missing', 'Missing'],
]
const label = (s: string) => STATES.find(([k]) => k === s)?.[1] ?? s

/**
 * Furnished stay, move-out: the landlord marks each item the tenant moved in
 * with, mirroring the app's item check. A damaged or missing item must say what
 * is wrong: it is what a caution deduction, and a contest of it, is judged on.
 */
export function MoveOutItemForm({
  items,
  busy,
  onSubmit,
}: {
  items: InventoryItem[]
  busy: boolean
  onSubmit: (checks: ItemCheck[]) => void
}) {
  const [states, setStates] = useState<ItemCheck['state'][]>(() => items.map(() => 'ok'))
  const [notes, setNotes] = useState<string[]>(() => items.map(() => ''))
  const [error, setError] = useState<string | null>(null)

  function submit() {
    const bad = items.findIndex((_, i) => states[i] !== 'ok' && !notes[i].trim())
    if (bad >= 0) {
      setError(`Say what is wrong with ${items[bad].name}.`)
      return
    }
    setError(null)
    onSubmit(
      items.map((it, i) => ({
        name: it.name,
        qty: it.qty,
        state: states[i],
        ...(states[i] !== 'ok' ? { note: notes[i].trim() } : {}),
      })),
    )
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm text-content-secondary">
        Check each item the tenant moved in with. The tenant sees what you mark and can contest it.
      </p>
      {items.map((it, i) => (
        <div key={it.name} className="rounded-md p-3" style={{ border: '1px solid var(--border)' }}>
          <p className="text-sm font-medium text-content">
            {it.name} × {it.qty}
          </p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={it.name}>
            {STATES.map(([key, text]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={states[i] === key}
                className="rounded-full px-3 py-1 text-xs"
                style={{
                  border: '1px solid ' + (states[i] === key ? 'var(--primary)' : 'var(--border)'),
                  color: states[i] === key ? 'var(--primary)' : 'var(--text-primary)',
                }}
                onClick={() => setStates((s) => s.map((v, n) => (n === i ? key : v)))}
              >
                {text}
              </button>
            ))}
          </div>
          {states[i] !== 'ok' && (
            <input
              className="input-field mt-2 px-3 py-2 text-sm"
              maxLength={300}
              placeholder="What is wrong with it"
              value={notes[i]}
              onChange={(e) => setNotes((s) => s.map((v, n) => (n === i ? e.target.value : v)))}
            />
          )}
        </div>
      ))}
      {error && <p className="text-sm text-error">{error}</p>}
      <button className="btn-primary px-5 py-2.5 text-sm" disabled={busy} onClick={submit}>
        {busy ? 'Saving…' : 'I have checked the unit'}
      </button>
    </div>
  )
}

/** The landlord's move-out item check, read-only, for both sides. */
export function MoveOutItemSummary({ checks }: { checks: ItemCheck[] }) {
  const problems = checks.filter((c) => c.state !== 'ok')
  return (
    <div className="mt-3 rounded-md bg-surface-secondary p-3 text-sm">
      <p className="font-medium text-content">Item check at move-out</p>
      <p className="mt-0.5 text-content-secondary">
        {problems.length === 0
          ? `The landlord marked all ${checks.length} items fine.`
          : `${problems.length} of ${checks.length} items marked as a problem:`}
      </p>
      {problems.length > 0 && (
        <ul className="mt-2 space-y-1">
          {problems.map((p) => (
            <li key={p.name}>
              <span className="font-medium text-content">
                {p.name}: {label(p.state)}
              </span>
              {p.note && <span className="text-content-secondary"> - {p.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
