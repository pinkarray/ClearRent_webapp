'use client'

import { useState } from 'react'
import { uploadImage } from '../lib/create-listing'
import type { InventoryItem, Stay } from '../lib/stay'

const SUGGESTIONS = [
  'Bed', 'Mattress', 'Wardrobe', 'Sofa', 'Dining table', 'Chairs',
  'TV', 'Fridge', 'Cooker', 'Microwave', 'Air conditioner', 'Fan',
  'Curtains', 'Washing machine', 'Water heater', 'Pots and plates',
]
const MONTHS = Array.from({ length: 11 }, (_, i) => i + 1)

/**
 * How the place is let, and for a furnished stay its lengths, start date and
 * item list. Mirrors the app's stay choice + InventoryEditor. `onChange`
 * absent shows it without letting it change (rules freeze it while a tenant
 * is in: the item list is what move-out is checked against).
 */
export function StayFields({
  uid,
  value,
  onChange,
}: {
  uid: string
  value: Stay
  onChange?: (v: Stay) => void
}) {
  const [uploading, setUploading] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
  const [error, setError] = useState<string | null>(null)
  const locked = !onChange
  const set = (patch: Partial<Stay>) => onChange?.({ ...value, ...patch })
  const setItems = (inventory: InventoryItem[]) => set({ inventory })

  function add(name: string) {
    const clean = name.trim()
    if (!clean) return
    const at = value.inventory.findIndex((i) => i.name.toLowerCase() === clean.toLowerCase())
    if (at >= 0) return setQty(at, value.inventory[at].qty + 1)
    if (value.inventory.length >= 60) return
    setItems([...value.inventory, { name: clean, qty: 1 }])
  }

  function setQty(index: number, qty: number) {
    setItems(
      value.inventory.map((i, n) => (n === index ? { ...i, qty: Math.min(99, Math.max(1, qty)) } : i)),
    )
  }

  async function photo(index: number, file: File | undefined) {
    if (!file) return
    setError(null)
    setUploading(index)
    try {
      const url = await uploadImage(file, uid)
      setItems(value.inventory.map((i, n) => (n === index ? { ...i, photoUrl: url } : i)))
    } catch {
      setError('That photo did not upload. Try again.')
    } finally {
      setUploading(null)
    }
  }

  const choice = (key: Stay['stayType'], title: string, hint: string) => {
    const on = value.stayType === key
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        disabled={locked}
        onClick={() => set({ stayType: key })}
        className="rounded-lg px-4 py-3 text-left disabled:cursor-not-allowed"
        style={{
          background: on ? 'var(--primary-tint)' : 'var(--surface)',
          border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
          opacity: locked && !on ? 0.6 : 1,
        }}
      >
        <span
          className="block text-sm font-medium"
          style={{ color: on ? 'var(--primary)' : 'var(--text-primary)' }}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-content-secondary">{hint}</span>
      </button>
    )
  }

  const have = new Set(value.inventory.map((i) => i.name.toLowerCase()))

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="How it is let" className="grid gap-2 sm:grid-cols-2">
        {choice('yearly', 'Yearly lease', 'A year at a time, renewed each year.')}
        {choice(
          'furnished',
          'Furnished stay',
          '1 to 11 months, paid up front. Must be fully furnished.',
        )}
      </div>

      {value.stayType === 'furnished' && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ['minStayMonths', 'Shortest stay'],
                ['maxStayMonths', 'Longest stay'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-sm font-medium text-content">{label}</span>
                <select
                  className="input-field mt-1.5 px-4 py-3"
                  disabled={locked}
                  value={value[key]}
                  onChange={(e) => set({ [key]: Number(e.target.value) })}
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m} month{m === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="block">
              <span className="text-sm font-medium text-content">Available from</span>
              <input
                type="date"
                className="input-field mt-1.5 px-4 py-3"
                disabled={locked}
                min={new Date().toISOString().slice(0, 10)}
                value={value.availableFrom}
                onChange={(e) => set({ availableFrom: e.target.value })}
              />
              <span className="mt-0.5 block text-xs text-content-hint">Leave empty for now.</span>
            </label>
          </div>

          <div>
            <span className="text-sm font-medium text-content">What&rsquo;s included</span>
            <span className="mt-0.5 block text-xs text-content-hint">
              {locked
                ? 'Locked while a tenant is living here.'
                : 'Both you and the tenant check this list at move-in and move-out. A photo of each item helps settle any question later.'}
            </span>
            <ul className="mt-2 space-y-2">
              {value.inventory.map((item, n) => (
                <li
                  key={item.name}
                  className="flex items-center gap-3 rounded-lg p-2"
                  style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
                >
                  <label
                    className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md text-xs text-content-hint"
                    style={{ background: 'var(--background)' }}
                  >
                    {uploading === n ? (
                      '…'
                    ) : item.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.photoUrl} alt={item.name} className="h-full w-full object-cover" />
                    ) : locked ? (
                      'No photo'
                    ) : (
                      '+ Photo'
                    )}
                    {!locked && (
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => photo(n, e.target.files?.[0])}
                      />
                    )}
                  </label>
                  <span className="flex-1 text-sm font-medium text-content">{item.name}</span>
                  {locked ? (
                    <span className="text-sm text-content">× {item.qty}</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="px-2 text-content"
                        disabled={item.qty <= 1}
                        onClick={() => setQty(n, item.qty - 1)}
                        aria-label={`One fewer ${item.name}`}
                      >
                        −
                      </button>
                      <span className="text-sm text-content">{item.qty}</span>
                      <button
                        type="button"
                        className="px-2 text-content"
                        onClick={() => setQty(n, item.qty + 1)}
                        aria-label={`One more ${item.name}`}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="px-2"
                        style={{ color: 'var(--error)' }}
                        onClick={() => setItems(value.inventory.filter((_, i) => i !== n))}
                        aria-label={`Remove ${item.name}`}
                      >
                        ×
                      </button>
                    </>
                  )}
                </li>
              ))}
              {value.inventory.length === 0 && (
                <li className="text-xs text-content-hint">No items yet.</li>
              )}
            </ul>
            {error && (
              <p className="mt-2 text-sm" style={{ color: 'var(--error)' }}>
                {error}
              </p>
            )}
            {!locked && (
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTIONS.filter((s) => !have.has(s.toLowerCase())).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => add(s)}
                    className="rounded-full px-3 py-1 text-xs text-content"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    + {s}
                  </button>
                ))}
                <span className="flex gap-1">
                  <input
                    className="input-field px-3 py-1 text-xs"
                    placeholder="Something else"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        add(custom)
                        setCustom('')
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-full px-3 py-1 text-xs"
                    style={{ border: '1px solid var(--primary)', color: 'var(--primary)' }}
                    onClick={() => {
                      add(custom)
                      setCustom('')
                    }}
                  >
                    Add
                  </button>
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
