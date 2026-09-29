'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
import {
  NIGERIAN_STATES,
  getResidence,
  saveResidence,
  type Residence,
  type ResidenceKind,
} from '../lib/residence'
import { areaDisplayName, areaGroups } from '../lib/lagos-areas'

const CHOICES: Array<[ResidenceKind, string, string]> = [
  ['own', 'In a property I own', 'If it is a building you list, you can mark it "I live here" in the app.'],
  ['rent', 'In a place I rent', 'You live somewhere you do not own.'],
  ['abroad', 'Outside Nigeria', 'An agent or a caretaker will need to show your properties to tenants.'],
]

/*
  "Where do you live?" - asked once, for all listings. Mirrors the app's
  LandlordResidenceScreen. Used by the residence page and, inline, by the
  listing form, which keeps no draft and so cannot send the landlord away.
*/
export default function ResidenceForm({ onSaved }: { onSaved: (r: Residence) => void }) {
  const { user } = useAuth()
  const [existing, setExisting] = useState<Residence | null>(null)
  const [kind, setKind] = useState<ResidenceKind | null>(null)
  const [state, setState] = useState('')
  const [area, setArea] = useState('')
  const [country, setCountry] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [groups, setGroups] = useState<Array<{ lga: string; label: string; areas: string[] }>>([])

  // Areas for whatever state was chosen, grouped by LGA as in the app. Empty
  // for a state we carry no areas for, which hides the field.
  useEffect(() => {
    if (state) void areaGroups(state).then(setGroups)
    else setGroups([])
  }, [state])

  useEffect(() => {
    if (!user) return
    void getResidence(user.uid).then((r) => {
      setExisting(r)
      setKind(r?.kind ?? null)
      setState(r?.state ?? '')
      setArea(r?.area ?? '')
      setCountry(r?.country ?? '')
      setLoaded(true)
    })
  }, [user])

  async function save() {
    if (!user || !kind) return
    setError(null)
    setBusy(true)
    const abroad = kind === 'abroad'
    const residence: Residence = {
      kind,
      state: abroad ? null : state || null,
      // Cleared whenever the state changes, so it belongs to the state above.
      area: abroad ? null : area.trim() || null,
      country: abroad ? country.trim() || null : null,
      homeBuildingId: kind === 'own' ? existing?.homeBuildingId ?? null : null,
      homeBuildingName: kind === 'own' ? existing?.homeBuildingName ?? null : null,
      // Carried or cleared by saveResidence, which reads the stored record.
      homeProofPath: null,
      homeProofStatus: null,
      homeProofRejectionReason: null,
    }
    const err = await saveResidence(user.uid, residence)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setSaved(true)
    onSaved(residence)
  }

  if (!loaded) return <p className="text-sm text-content-secondary">Loading…</p>

  return (
    <div className="max-w-xl space-y-5">
      <p className="text-sm text-content-secondary">
        Tenants are told whether their landlord lives on the premises, elsewhere, or outside
        Nigeria. They never see your address.
      </p>

      <div className="space-y-3">
        {CHOICES.map(([value, label, hint]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setKind(value)
              setSaved(false)
            }}
            className="card block w-full p-4 text-left"
            // Inline: the .card rule's own border would override a utility class.
            style={kind === value ? { borderColor: 'var(--primary)', borderWidth: 2 } : undefined}
          >
            <p className={`font-medium ${kind === value ? 'text-primary' : 'text-content'}`}>{label}</p>
            <p className="mt-1 text-sm text-content-secondary">{hint}</p>
          </button>
        ))}
      </div>

      {kind && kind !== 'abroad' && (
        <label className="block text-sm text-content-secondary">
          State
          <select
            className="input-field mt-1 px-3 py-2.5"
            value={state}
            onChange={(e) => {
              if (e.target.value !== state) setArea('')
              setState(e.target.value)
            }}
          >
            <option value="">Choose your state</option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind && kind !== 'abroad' && groups.length > 0 && (
        <label className="block text-sm text-content-secondary">
          Area (optional)
          <select
            className="input-field mt-1 px-3 py-2.5"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          >
            <option value="">Choose your area</option>
            {groups.map((g) => (
              <optgroup key={g.lga} label={g.label}>
                {g.areas.map((a) => (
                  <option key={a} value={areaDisplayName(a)}>
                    {areaDisplayName(a)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      {kind === 'abroad' && (
        <label className="block text-sm text-content-secondary">
          Country
          <input
            className="input-field mt-1 px-3 py-2.5"
            placeholder="e.g. United Kingdom"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </label>
      )}

      {error && <p className="text-sm text-error">{error}</p>}
      {saved && <p className="text-sm text-success">Saved. Your listings now say where you live.</p>}

      <button
        className="btn-primary px-6 py-3 text-sm"
        disabled={busy || !kind || (kind === 'abroad' ? !country.trim() : !state)}
        onClick={() => void save()}
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
