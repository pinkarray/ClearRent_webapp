'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../components/AuthProvider'
import { CloudinaryImage } from '../../../components/CloudinaryImage'
import { formatNaira, rentPeriod } from '../../../lib/format'
import {
  loadSavedProperties,
  savedPropertyIds,
  toggleSaved,
  type SavedProperty,
} from '../../../lib/saved'

export default function SavedPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<SavedProperty[] | null>(null)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const ids = await savedPropertyIds(user.uid)
      setRows(await loadSavedProperties(ids))
    })()
  }, [user])

  async function remove(id: string) {
    if (!user) return
    // Optimistic: the list is the only thing showing this state, so waiting on
    // the round trip just makes the tap feel broken.
    setRows((r) => r?.filter((p) => p.id !== id) ?? null)
    await toggleSaved(user.uid, id)
  }

  if (!user) return null

  return (
    <div>
      {rows === null ? (
        <p className="text-sm text-content-secondary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-content-secondary">Nothing saved yet.</p>
          <p className="mt-1 text-sm text-content-hint">
            Tap the heart on any listing to keep it here.
          </p>
          <Link href="/properties" className="btn-primary mt-5 inline-block px-6 py-3 no-underline">
            Browse properties
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((p) => (
            <div key={p.id} className="card overflow-hidden">
              <Link href={`/properties/${p.id}`} className="block no-underline">
                <div className="relative aspect-[4/3] w-full bg-surface-secondary">
                  {p.image ? (
                    <CloudinaryImage
                      src={p.image}
                      alt={p.title}
                      fill
                      sizes="(max-width: 640px) 100vw, 380px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-content-hint">
                      No photo
                    </div>
                  )}
                  {!p.isAvailable && (
                    <span className="chip chip-pending absolute left-3 top-3">
                      No longer available
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-primary">{formatNaira(p.rent)}</span>
                    <span className="text-sm text-content-secondary">
                      {rentPeriod(p.rentFrequency)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 font-semibold text-content">{p.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-sm text-content-secondary">
                    {p.approximateAddress}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 text-sm text-content-secondary">
                    <span>{p.bedrooms} bed</span>
                    <span>{p.bathrooms} bath</span>
                    <span>{p.toilets} toilet</span>
                  </div>
                </div>
              </Link>
              <button
                className="w-full border-t border-divider px-4 py-3 text-sm font-medium text-error"
                onClick={() => remove(p.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
