'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../../components/AuthProvider'
import {
  DAYS,
  TIME_SLOTS,
  agentProfile,
  saveAvailability,
  saveServiceAreas,
  serviceAreaOptions,
} from '../../../lib/agent'

/*
  Coverage: where an agent works and when. The app splits these across Service
  Areas and Availability; both write single fields on the agent's own user doc
  and are read together by the inspection scheduler, so they are one page here.
*/
/**
 * A comparable snapshot of the three selections. Sorted, because the order the
 * agent tapped things in is not a change worth saving.
 */
function fingerprint(areas: string[], days: string[], slots: string[]): string {
  return JSON.stringify([[...areas].sort(), [...days].sort(), [...slots].sort()])
}

export default function CoveragePage() {
  const { user } = useAuth()
  const [options, setOptions] = useState<string[] | null>(null)
  const [areas, setAreas] = useState<string[]>([])
  const [days, setDays] = useState<string[]>([])
  const [slots, setSlots] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /**
   * The selections as they are stored. Save stays disabled until the current
   * selections differ from this — so the agent can tell at a glance whether
   * their work is committed, and cannot fire redundant writes by tapping Save
   * repeatedly.
   */
  const [savedState, setSavedState] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const [opts, profile] = await Promise.all([serviceAreaOptions(), agentProfile(user.uid)])
      setOptions(opts)
      setAreas(profile.serviceAreas)
      setDays(profile.availableDays)
      setSlots(profile.availableTimeSlots)
      setSavedState(
        fingerprint(profile.serviceAreas, profile.availableDays, profile.availableTimeSlots),
      )
    })()
  }, [user])

  function toggle(list: string[], value: string, set: (v: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  async function save() {
    if (!user) return
    if (areas.length === 0) {
      setError('Pick at least one area you cover.')
      return
    }
    if (days.length === 0 || slots.length === 0) {
      setError('Pick at least one day and one time slot.')
      return
    }
    setError(null)
    setBusy(true)
    const err =
      (await saveServiceAreas(user.uid, areas)) ??
      (await saveAvailability(user.uid, days, slots))
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setSavedState(fingerprint(areas, days, slots))
  }

  if (!user) return null
  if (options === null) return <p className="text-sm text-content-secondary">Loading…</p>

  const visible = search
    ? options.filter((a) => a.toLowerCase().includes(search.toLowerCase()))
    : options

  const dirty = savedState !== null && fingerprint(areas, days, slots) !== savedState

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
          Areas you cover
        </h2>
        <p className="mt-1 text-sm text-content-secondary">
          Landlords looking for a handler see agents who cover the property&apos;s area first.
          {areas.length > 0 && ` ${areas.length} selected.`}
        </p>

        <input
          className="input-field mt-3 px-4 py-2.5"
          placeholder="Search areas"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {visible.map((a) => {
            const on = areas.includes(a)
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggle(areas, a, setAreas)}
                className={`rounded-sm border px-3 py-1.5 text-sm ${
                  on
                    ? 'border-primary bg-primary-tint text-primary'
                    : 'border-border text-content-secondary'
                }`}
              >
                {a}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
          When you are free
        </h2>
        <p className="mt-1 text-sm text-content-secondary">
          Tenants can only request inspections in these windows.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {DAYS.map((d) => {
            const on = days.includes(d)
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggle(days, d, setDays)}
                className={`rounded-sm border px-3 py-1.5 text-sm ${
                  on
                    ? 'border-primary bg-primary-tint text-primary'
                    : 'border-border text-content-secondary'
                }`}
              >
                {d.slice(0, 3)}
              </button>
            )
          })}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {TIME_SLOTS.map((s) => {
            const on = slots.includes(s.value)
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => toggle(slots, s.value, setSlots)}
                className={`rounded-sm border px-4 py-3 text-left text-sm ${
                  on ? 'border-primary bg-primary-tint text-primary' : 'border-border'
                }`}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </section>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        className="btn-primary w-full px-6 py-3"
        disabled={busy || !dirty}
        onClick={save}
      >
        {busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
      </button>
    </div>
  )
}
