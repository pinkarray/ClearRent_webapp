'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../components/AuthProvider'
import { createListing, uploadImage, type ListingInput } from '../../lib/create-listing'

const PROPERTY_TYPES = ['flat', 'bungalow', 'duplex', 'self_contain', 'single_room', 'shop']
// Matches the app's current vocabulary. 'pop' replaced the legacy
// 'false_ceiling'; a property can carry more than one.
const CEILING_TYPES = ['pop', 'pvc', 'concrete', 'asbestos', 'slate', 'none']

type Draft = {
  title: string
  description: string
  propertyType: string
  bedrooms: string
  bathrooms: string
  toilets: string
  livingRooms: string
  guestRooms: string
  kitchens: string
  address: string
  city: string
  state: string
  lga: string
  rent: string
  rentFrequency: string
  agentFee: string
  cautionDeposit: string
  cautionDepositRefundable: boolean
  amenities: string
  rules: string
  maxTenants: string
  landlordLivesInProperty: boolean
  landlordLivesOnPremises: boolean
  currentTenantsCount: string
  hasCaretaker: boolean
  caretakerLivesOnPremises: boolean
  ceilingTypes: string[]
  videoUrl: string
}

const EMPTY: Draft = {
  title: '',
  description: '',
  propertyType: 'flat',
  bedrooms: '1',
  bathrooms: '1',
  toilets: '1',
  livingRooms: '1',
  guestRooms: '0',
  kitchens: '1',
  address: '',
  city: '',
  state: '',
  lga: '',
  rent: '',
  rentFrequency: 'yearly',
  agentFee: '0',
  cautionDeposit: '0',
  cautionDepositRefundable: true,
  amenities: '',
  rules: '',
  maxTenants: '1',
  landlordLivesInProperty: false,
  landlordLivesOnPremises: false,
  currentTenantsCount: '0',
  hasCaretaker: false,
  caretakerLivesOnPremises: false,
  ceilingTypes: [],
  videoUrl: '',
}

function toInt(v: string, fallback = 0): number {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

function toFloat(v: string, fallback = 0): number {
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

function csv(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-content">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-content-hint">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

export default function ListPropertyPage() {
  const router = useRouter()
  const { user, profile, ready } = useAuth()
  const verificationStatus = profile?.verificationStatus ?? null

  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  // Listing is a landlord action behind auth. Unauthenticated visitors go to
  // /login, which owns sign-in for the whole site.
  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setCreatedId(null)
    setBusy(true)

    try {
      const images: string[] = []
      for (const [i, file] of files.entries()) {
        setStatus(`Uploading photo ${i + 1} of ${files.length}…`)
        images.push(await uploadImage(file, user.uid))
      }

      setStatus('Creating listing…')
      const input: ListingInput = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        propertyType: draft.propertyType,
        bedrooms: toInt(draft.bedrooms),
        bathrooms: toInt(draft.bathrooms),
        toilets: toInt(draft.toilets),
        livingRooms: toInt(draft.livingRooms, 1),
        guestRooms: toInt(draft.guestRooms),
        kitchens: toInt(draft.kitchens, 1),
        images,
        address: draft.address.trim(),
        city: draft.city.trim(),
        state: draft.state.trim(),
        lga: draft.lga.trim(),
        rent: toFloat(draft.rent),
        rentFrequency: draft.rentFrequency,
        agentFee: toFloat(draft.agentFee),
        cautionDeposit: toFloat(draft.cautionDeposit),
        cautionDepositRefundable: draft.cautionDepositRefundable,
        amenities: csv(draft.amenities),
        rules: csv(draft.rules),
        maxTenants: toInt(draft.maxTenants, 1),
        landlordLivesInProperty: draft.landlordLivesInProperty,
        landlordLivesOnPremises: draft.landlordLivesOnPremises,
        currentTenantsCount: toInt(draft.currentTenantsCount),
        hasCaretaker: draft.hasCaretaker,
        caretakerLivesOnPremises: draft.caretakerLivesOnPremises,
        ceilingTypes: draft.ceilingTypes,
        videoUrl: draft.videoUrl.trim() || null,
      }

      const id = await createListing(user.uid, input)
      setCreatedId(id)
      setDraft(EMPTY)
      setFiles([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create listing')
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  if (!ready || !user) {
    return (
      <main className="mesh-bg min-h-screen">
        <div className="container py-16 text-content-secondary">Loading…</div>
      </main>
    )
  }

  return (
    <main className="mesh-bg min-h-screen">
      <div className="container max-w-3xl py-12">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-primary no-underline hover:underline"
          >
            ← Dashboard
          </Link>
          <span className="text-sm text-content-secondary">
            {user.phoneNumber ?? user.email}
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-bold text-content">List a property</h1>

        {verificationStatus !== null && verificationStatus !== 'verified' && (
          <div className="card mt-6 border-l-4 border-l-secondary p-5">
            <p className="font-semibold text-content">
              This account is not a verified landlord
            </p>
            <p className="mt-1 text-sm text-content-secondary">
              Firestore rules require <code>verificationStatus == &apos;verified&apos;</code> to
              create a listing. Current value: <code>{verificationStatus}</code>. Complete
              verification in the ClearRent app first.
            </p>
          </div>
        )}

        {createdId && (
          <div className="card mt-6 border-l-4 border-l-primary p-5">
            <p className="font-semibold text-content">Listing created</p>
            <p className="mt-1 text-sm text-content-secondary">
              Property ID <code>{createdId}</code>. It is now visible in the ClearRent app under
              your listings. It will <strong>not</strong> appear on public browse until an admin
              verifies the ownership document and the property is marked ready for inspections.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <section className="card space-y-4 p-6">
            <h2 className="font-semibold text-content">The basics</h2>
            <Field label="Title">
              <input
                className="input-field px-4 py-3"
                required
                value={draft.title}
                onChange={(e) => set('title', e.target.value)}
              />
            </Field>
            <Field label="Description">
              <textarea
                className="input-field px-4 py-3"
                rows={4}
                required
                value={draft.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Property type">
                <select
                  className="input-field px-4 py-3"
                  value={draft.propertyType}
                  onChange={(e) => set('propertyType', e.target.value)}
                >
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ceiling types" hint="Pick every type that applies.">
                <div className="flex flex-wrap gap-2">
                  {CEILING_TYPES.map((t) => {
                    const on = draft.ceilingTypes.includes(t)
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          set(
                            'ceilingTypes',
                            on
                              ? draft.ceilingTypes.filter((c) => c !== t)
                              : [...draft.ceilingTypes, t],
                          )
                        }
                        className="rounded-full px-3 py-1.5 text-sm capitalize"
                        style={{
                          background: on ? 'var(--primary)' : 'var(--surface-secondary)',
                          color: on ? '#fff' : 'var(--text-secondary)',
                          border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
                        }}
                      >
                        {t}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </div>
          </section>

          <section className="card space-y-4 p-6">
            <h2 className="font-semibold text-content">The space</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ['bedrooms', 'Bedrooms'],
                  ['bathrooms', 'Bathrooms'],
                  ['toilets', 'Toilets'],
                  ['livingRooms', 'Living rooms'],
                  ['guestRooms', 'Guest rooms'],
                  ['kitchens', 'Kitchens'],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    className="input-field px-4 py-3"
                    type="number"
                    min={0}
                    value={draft[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </section>

          <section className="card space-y-4 p-6">
            <h2 className="font-semibold text-content">Location</h2>
            <Field
              label="Street address"
              hint="Stored in the gated private/location subdoc — never shown publicly, released only after an inspection is approved."
            >
              <input
                className="input-field px-4 py-3"
                required
                value={draft.address}
                onChange={(e) => set('address', e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="LGA">
                <input
                  className="input-field px-4 py-3"
                  value={draft.lga}
                  onChange={(e) => set('lga', e.target.value)}
                />
              </Field>
              <Field label="City">
                <input
                  className="input-field px-4 py-3"
                  required
                  value={draft.city}
                  onChange={(e) => set('city', e.target.value)}
                />
              </Field>
              <Field label="State">
                <input
                  className="input-field px-4 py-3"
                  required
                  value={draft.state}
                  onChange={(e) => set('state', e.target.value)}
                />
              </Field>
            </div>
          </section>

          <section className="card space-y-4 p-6">
            <h2 className="font-semibold text-content">Money</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rent (₦)">
                <input
                  className="input-field px-4 py-3"
                  type="number"
                  min={0}
                  required
                  value={draft.rent}
                  onChange={(e) => set('rent', e.target.value)}
                />
              </Field>
              <Field label="Rent frequency">
                <select
                  className="input-field px-4 py-3"
                  value={draft.rentFrequency}
                  onChange={(e) => set('rentFrequency', e.target.value)}
                >
                  <option value="yearly">yearly</option>
                  <option value="monthly">monthly</option>
                </select>
              </Field>
              <Field label="Agent fee (₦)" hint="Flat amount, not a percentage.">
                <input
                  className="input-field px-4 py-3"
                  type="number"
                  min={0}
                  value={draft.agentFee}
                  onChange={(e) => set('agentFee', e.target.value)}
                />
              </Field>
              <Field label="Caution deposit (₦)">
                <input
                  className="input-field px-4 py-3"
                  type="number"
                  min={0}
                  value={draft.cautionDeposit}
                  onChange={(e) => set('cautionDeposit', e.target.value)}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-content">
              <input
                type="checkbox"
                checked={draft.cautionDepositRefundable}
                onChange={(e) => set('cautionDepositRefundable', e.target.checked)}
              />
              Caution deposit is refundable at move-out
            </label>
          </section>

          <section className="card space-y-4 p-6">
            <h2 className="font-semibold text-content">Photos & video</h2>
            <Field label="Photos" hint="Uploaded to the same Cloudinary cloud as the app.">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                className="text-sm text-content-secondary"
              />
            </Field>
            {files.length > 0 && (
              <p className="text-sm text-content-secondary">
                {files.length} photo{files.length === 1 ? '' : 's'} selected
              </p>
            )}
            <Field label="Video URL (optional)">
              <input
                className="input-field px-4 py-3"
                value={draft.videoUrl}
                onChange={(e) => set('videoUrl', e.target.value)}
              />
            </Field>
          </section>

          <section className="card space-y-4 p-6">
            <h2 className="font-semibold text-content">Details & occupancy</h2>
            <Field label="Amenities" hint="Comma separated, e.g. borehole, prepaid meter, parking">
              <input
                className="input-field px-4 py-3"
                value={draft.amenities}
                onChange={(e) => set('amenities', e.target.value)}
              />
            </Field>
            <Field label="House rules" hint="Comma separated.">
              <input
                className="input-field px-4 py-3"
                value={draft.rules}
                onChange={(e) => set('rules', e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Max tenants">
                <input
                  className="input-field px-4 py-3"
                  type="number"
                  min={1}
                  value={draft.maxTenants}
                  onChange={(e) => set('maxTenants', e.target.value)}
                />
              </Field>
              <Field label="Current tenants">
                <input
                  className="input-field px-4 py-3"
                  type="number"
                  min={0}
                  value={draft.currentTenantsCount}
                  onChange={(e) => set('currentTenantsCount', e.target.value)}
                />
              </Field>
            </div>
            <div className="space-y-2 text-sm text-content">
              {(
                [
                  ['landlordLivesInProperty', 'Landlord lives in this property'],
                  ['landlordLivesOnPremises', 'Landlord lives on the premises'],
                  ['hasCaretaker', 'There is a caretaker'],
                  ['caretakerLivesOnPremises', 'Caretaker lives on the premises'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft[key]}
                    onChange={(e) => set(key, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {status && <p className="text-sm text-content-secondary">{status}</p>}

          <button
            className="btn-primary w-full px-6 py-4"
            type="submit"
            disabled={busy || verificationStatus !== 'verified'}
          >
            {busy ? 'Working…' : 'Create listing'}
          </button>

          <p className="text-center text-xs text-content-hint">
            The listing is created unverified. An admin must approve its ownership document and
            it must be marked ready for inspections before it appears on public browse.
          </p>
        </form>
      </div>
    </main>
  )
}
