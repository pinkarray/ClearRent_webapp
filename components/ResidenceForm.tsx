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
      area: !abroad && state === 'Lagos' ? area.trim() || null : null,
      country: abroad ? country.trim() || null : null,
      homeBuildingId: kind === 'own' ? existing?.homeBuildingId ?? null : null,
      homeBuildingName: kind === 'own' ? existing?.homeBuildingName ?? null : null,
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
            className={`card block w-full p-4 text-left ${kind === value ? 'border-primary' : ''}`}
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
            onChange={(e) => setState(e.target.value)}
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
      {kind && kind !== 'abroad' && state === 'Lagos' && (
        <label className="block text-sm text-content-secondary">
          Area (optional)
          <input
            className="input-field mt-1 px-3 py-2.5"
            placeholder="e.g. Allen"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
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
