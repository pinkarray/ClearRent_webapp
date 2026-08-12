'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '../../../../components/AuthProvider'
import {
  DAYS,
  READINESS_CHECKLIST,
  TIME_SLOTS,
  confirmReadiness,
  handledProperties,
  saveInspectionSchedule,
  unassignFromProperty,
  type HandledProperty,
} from '../../../../lib/agent'
import { formatNaira } from '../../../../lib/format'
import { sortedFingerprint } from '../../../../lib/form-state'

/*
  One property this agent handles: vet it, set when it can be shown, or step
  back from it.

  Everything an agent may change here is field-scoped by
  `firestore.rules:326`/`:336`. There is deliberately no edit form for rent,
  address or availability - those stay the landlord's, and an attempt would be
  rejected wholesale rather than partially applied.
*/
export default function HandledPropertyPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams<{ id: string }>()

  const [property, setProperty] = useState<HandledProperty | null | 'missing'>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [days, setDays] = useState<string[]>([])
  const [slots, setSlots] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  /** The schedule as stored, so Save can show whether it is committed. */
  const [savedSchedule, setSavedSchedule] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    // Rules scope property list access, so the agent's own handled set is the
    // way to fetch one by id.
    const mine = await handledProperties(user.uid)
    const p = mine.find((x) => x.id === params.id)
    setProperty(p ?? 'missing')
    if (p) {
      setDays(p.inspectionDays)
      setSlots(p.inspectionTimeSlots)
      setSavedSchedule(sortedFingerprint(p.inspectionDays, p.inspectionTimeSlots))
    }
  }, [user, params.id])

  useEffect(() => {
    ;(async () => {
      await load()
    })()
  }, [load])

  async function vet() {
    if (!user) return
    setError(null)
    setBusy(true)
    const err = await confirmReadiness(params.id, user.uid, checked)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setMessage('Marked ready. Tenants can book this property now.')
    await load()
  }

  async function saveSchedule() {
    setError(null)
    setBusy(true)
    const err = await saveInspectionSchedule(params.id, days, slots)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setMessage('Schedule saved.')
    setSavedSchedule(sortedFingerprint(days, slots))
  }

  async function stepBack() {
    const reason = window.prompt(
      'Why are you stepping back? The landlord sees this.',
    )
    if (reason === null) return
    if (!reason.trim()) {
      setError('A reason is required.')
      return
    }
    setError(null)
    setBusy(true)
    const err = await unassignFromProperty(params.id, reason.trim())
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    router.push('/dashboard/handling')
  }

  function toggle(list: string[], v: string, set: (n: string[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  }

  if (!user) return null
  if (property === null) return <p className="text-sm text-content-secondary">Loading…</p>

  if (property === 'missing') {
    return (
      <div className="card p-8 text-center">
        <p className="text-content-secondary">You are not handling that property.</p>
        <Link
          href="/dashboard/handling"
          className="btn-ghost mt-5 inline-block px-6 py-3 no-underline"
        >
          Back to your properties
        </Link>
      </div>
    )
  }

  const scheduleDirty =
    savedSchedule !== null && sortedFingerprint(days, slots) !== savedSchedule
  const blocked = property.ownershipDocStatus !== 'verified'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-content">{property.title}</h2>
        <p className="mt-0.5 text-sm text-content-secondary">{property.approximateAddress}</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-content-secondary">
          <span>Rent {formatNaira(property.rent)}</span>
          {property.agentFee > 0 && <span>Your fee {formatNaira(property.agentFee)}</span>}
          <span>Landlord {property.landlordName}</span>
        </div>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}
      {message && <p className="text-sm text-success">{message}</p>}

      {blocked ? (
        <div className="card border-l-4 border-l-secondary p-5">
          <p className="font-semibold text-content">Waiting on the landlord</p>
          <p className="mt-1 text-sm text-content-secondary">
            This property&apos;s ownership document is <code>{property.ownershipDocStatus}</code>.
            It cannot go live until an admin verifies it, so there is nothing to vet yet.
          </p>
        </div>
      ) : property.readyForInspections ? (
        <div className="card border-l-4 border-l-primary p-5">
          <p className="font-semibold text-content">Vetted and bookable</p>
          <p className="mt-1 text-sm text-content-secondary">
            You have confirmed the readiness checklist for this property.
          </p>
        </div>
      ) : (
        <section className="card p-6">
          <h3 className="font-semibold text-content">Vet this property</h3>
          <p className="mt-1 text-sm text-content-secondary">
            Tenants cannot book it, and you earn nothing from it, until you confirm all four.
          </p>
          <div className="mt-4 space-y-3">
            {Object.entries(READINESS_CHECKLIST).map(([key, label]) => (
              <label key={key} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked[key] === true}
                  onChange={(e) =>
                    setChecked((c) => ({ ...c, [key]: e.target.checked }))
                  }
                />
                <span className="text-sm text-content">{label}</span>
              </label>
            ))}
          </div>
          <button className="btn-primary mt-5 px-5 py-2.5 text-sm" disabled={busy} onClick={vet}>
            {busy ? 'Saving…' : 'Confirm readiness'}
          </button>
        </section>
      )}

      <section className="card p-6">
        <h3 className="font-semibold text-content">When this property can be shown</h3>
        <p className="mt-1 text-sm text-content-secondary">
          Narrower than your own availability if this particular property has constraints.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggle(days, d, setDays)}
              className={`rounded-sm border px-3 py-1.5 text-sm ${
                days.includes(d)
                  ? 'border-primary bg-primary-tint text-primary'
                  : 'border-border text-content-secondary'
              }`}
            >
              {d.slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {TIME_SLOTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => toggle(slots, s.value, setSlots)}
              className={`rounded-sm border px-4 py-3 text-left text-sm ${
                slots.includes(s.value)
                  ? 'border-primary bg-primary-tint text-primary'
                  : 'border-border'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          className="btn-ghost mt-4 px-5 py-2.5 text-sm"
          disabled={busy || !scheduleDirty}
          onClick={saveSchedule}
        >
          {busy ? 'Saving…' : scheduleDirty ? 'Save schedule' : 'Schedule saved'}
        </button>
      </section>

      <section className="card p-6">
        <h3 className="font-semibold text-content">Step back from this property</h3>
        <p className="mt-1 text-sm text-content-secondary">
          The landlord is told, your assignment is cleared, and the agent fee is preserved so
          they do not have to re-enter it. Bookings stop until they find a new handler.
        </p>
        <button
          className="mt-4 rounded-sm border border-border px-5 py-2.5 text-sm font-medium text-error"
          disabled={busy}
          onClick={stepBack}
        >
          Step back
        </button>
      </section>
    </div>
  )
}
