'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../components/AuthProvider'
import { createListing, uploadImage, type ListingInput } from '../../lib/create-listing'
import {
  NIGERIAN_STATES,
  getResidence,
  residenceSummary,
  saveResidence,
  type Residence,
} from '../../lib/residence'
import { areaDisplayName, areaGroups, lgaName } from '../../lib/lagos-areas'
import ResidenceForm from '../../components/ResidenceForm'
import { getPricing, listingFeeOwed, payListingFee } from '../../lib/listing-fee'
import { formatNairaFull } from '../../lib/format'

// ClearRent operates in Lagos today, so the State field is defaulted rather
// than fixed. Nothing rejects another state outright: admin review is the gate,
// and it is the only one that can say yes on the day we expand.
const LAGOS = 'Lagos'

// The app's actual vocabulary (PropertyModel.selectableTypes). This list used
// to read 'self_contain' / 'single_room' / 'shop' - values nothing else in the
// system understands, so a web-created listing rendered with a raw type string
// in the app and matched no tenant filter. 'shop' is out until the commercial
// branch exists, same as the app.
// Web lists WHOLE properties only, so this mirrors
// PropertyModel.wholePropertyTypes - 'room' is absent because a lone room is a
// unit inside a building, which is the app's grouped flow.
const PROPERTY_TYPES: Array<[value: string, label: string]> = [
  ['flat', 'Flat'],
  ['duplex', 'Duplex'],
  ['semiDetachedDuplex', 'Semi-Detached Duplex'],
  ['bungalow', 'Bungalow'],
  ['selfContain', 'Self Contain'],
  ['roomAndParlour', 'Room & Parlour'],
]
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
  state: LAGOS,
  lga: '',
  rent: '',
  rentFrequency: 'yearly',
  agentFee: '0',
  cautionDeposit: '0',
  cautionDepositRefundable: true,
  amenities: '',
  rules: '',
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
  const [ownershipDoc, setOwnershipDoc] = useState<File | null>(null)
  const [ownershipDocType, setOwnershipDocType] =
    useState<'c_of_o' | 'deed' | 'other'>('c_of_o')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  /** The first listing is free; null while checking. */
  const [feeOwed, setFeeOwed] = useState<boolean | null>(null)
  const [createdOwesFee, setCreatedOwesFee] = useState(false)
  const [listingPrice, setListingPrice] = useState(10000)
  const [paying, setPaying] = useState(false)
  /** Areas for the chosen state, grouped by LGA. Empty outside Lagos/Ogun. */
  const [groups, setGroups] = useState<Array<{ lga: string; label: string; areas: string[] }>>([])
  /** The picked area as 'lga|area', '__other' when it is not listed, or ''. */
  const [areaKey, setAreaKey] = useState('')
  /** undefined while loading; null until the landlord says where they live. */
  const [residence, setResidence] = useState<Residence | null | undefined>(undefined)

  // Listing is a landlord action behind auth. Unauthenticated visitors go to
  // /login, which owns sign-in for the whole site.
  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  useEffect(() => {
    if (user) void getResidence(user.uid).then(setResidence)
  }, [user])

  useEffect(() => {
    if (!user) return
    void listingFeeOwed(user.uid).then(setFeeOwed).catch(() => setFeeOwed(null))
    void getPricing().then((p) => setListingPrice(p.listing))
  }, [user, createdId])

  // City and LGA used to be free text, which is how a listing was saved as
  // 'Ikorodu, Ogun'. Lagos and Ogun now pick from the app's own area list.
  useEffect(() => {
    const st = draft.state
    if (st === 'Lagos' || st === 'Ogun') void areaGroups(st).then(setGroups)
    else setGroups([])
  }, [draft.state])

  async function handlePayFee() {
    if (!createdId) return
    setPaying(true)
    setError(null)
    try {
      await payListingFee(createdId, listingPrice)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the payment.')
      setPaying(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setCreatedId(null)

    // Required, as the app requires it. Without a document the listing is born
    // 'none', which admin cannot verify OR reject - it just sits there.
    if (!ownershipDoc) {
      setError('Attach proof of ownership - a C of O, deed, or other document.')
      return
    }
    if (!residence) {
      setError('Tell tenants where you live first. It is asked once, for all your listings.')
      return
    }

    setBusy(true)

    try {
      const images: string[] = []
      for (const [i, file] of files.entries()) {
        setStatus(`Uploading photo ${i + 1} of ${files.length}…`)
        images.push(await uploadImage(file, user.uid))
      }

      setStatus('Uploading your ownership document…')
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
        // Web lists whole properties only, and a property one tenant gets in
        // full cannot also be the landlord's home. saveResidence below stamps
        // the tenant-facing line.
        landlordLivesInProperty: false,
        landlordLivesOnPremises: false,
        currentTenantsCount: toInt(draft.currentTenantsCount),
        hasCaretaker: draft.hasCaretaker,
        caretakerLivesOnPremises: draft.caretakerLivesOnPremises,
        ceilingTypes: draft.ceilingTypes,
        videoUrl: draft.videoUrl.trim() || null,
        ownershipDocFile: ownershipDoc,
        ownershipDocType,
      }

      const owes = feeOwed === true
      const id = await createListing(user.uid, input)
      await saveResidence(user.uid, residence)
      setCreatedOwesFee(owes)
      setCreatedId(id)
      setDraft(EMPTY)
      setAreaKey('')
      setFiles([])
      setOwnershipDoc(null)
      setOwnershipDocType('c_of_o')
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
            {createdOwesFee && (
              <div className="mt-4">
                <p className="text-sm text-content-secondary">
                  This is not your first listing, so it has a {formatNairaFull(listingPrice)}{' '}
                  listing fee. An admin can only publish it once the fee is paid.
                </p>
                <button
                  type="button"
                  className="btn-primary mt-3 px-5 py-2.5 text-sm"
                  onClick={handlePayFee}
                  disabled={paying}
                >
                  {paying
                    ? 'Opening Paystack…'
                    : `Pay the ${formatNairaFull(listingPrice)} listing fee`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Web lists whole properties only. Grouping units under one building
            (a room in your duplex, two flats in one compound) lives in the app,
            where the building picker and its shared ownership document are. */}
        <div className="card mt-6 border-l-4 border-l-primary p-5">
          <p className="font-semibold text-content">This lists a whole property</p>
          <p className="mt-1 text-sm text-content-secondary">
            One tenant gets the entire place. Letting rooms or flats separately -
            each at its own rent, under one ownership document - is done in the
            ClearRent app.
          </p>
        </div>

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
                  {PROPERTY_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
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
                        {t === 'pop' || t === 'pvc' ? t.toUpperCase() : t}
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
              hint="Tenants browsing see only the area. A tenant gets the street address once they pay for a viewing."
            >
              <input
                className="input-field px-4 py-3"
                required
                value={draft.address}
                onChange={(e) => set('address', e.target.value)}
              />
            </Field>
            <Field
              label="State"
              hint={
                draft.state === LAGOS
                  ? undefined
                  : 'ClearRent is expanding beyond Lagos. Every listing is reviewed before it goes live.'
              }
            >
              <select
                className="input-field px-4 py-3"
                required
                value={draft.state}
                onChange={(e) => {
                  set('state', e.target.value)
                  set('city', '')
                  set('lga', '')
                  setAreaKey('')
                }}
              >
                {NIGERIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </Field>
            {groups.length > 0 && (
              <Field label="Area">
                <select
                  className="input-field px-4 py-3"
                  required
                  value={areaKey}
                  onChange={(e) => {
                    const v = e.target.value
                    setAreaKey(v)
                    if (v === '__other' || v === '') {
                      set('city', '')
                      set('lga', '')
                      return
                    }
                    const [lga, area] = v.split('|')
                    set('city', areaDisplayName(area))
                    set('lga', lgaName(lga))
                  }}
                >
                  <option value="">Choose the area</option>
                  {groups.map((g) => (
                    <optgroup key={g.lga} label={g.label}>
                      {g.areas.map((a) => (
                        <option key={a} value={`${g.lga}|${a}`}>
                          {areaDisplayName(a)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="__other">My area is not listed</option>
                </select>
              </Field>
            )}
            {(groups.length === 0 || areaKey === '__other') && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="City or area">
                  <input
                    className="input-field px-4 py-3"
                    required
                    value={draft.city}
                    onChange={(e) => set('city', e.target.value)}
                  />
                </Field>
                <Field label="LGA">
                  <input
                    className="input-field px-4 py-3"
                    value={draft.lga}
                    onChange={(e) => set('lga', e.target.value)}
                  />
                </Field>
              </div>
            )}
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
            <Field label="Photos" hint="Clear, well-lit photos of every room get more interest.">
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
            {/* "Max tenants" used to be a free number here. One listing = one
                tenancy: the rent, caution deposit, agent fee, agreement and
                Paystack split on this doc are all singular, and the accept-time
                slot guard keys off whatever is stored - so a value above 1 let
                a second tenant in against the first one's terms. Two lettable
                units are two listings sharing a building. firestore.rules now
                pins maxTenants to 1; createListing sends it. */}
            <Field label="Current tenants">
              <input
                className="input-field px-4 py-3"
                type="number"
                min={0}
                value={draft.currentTenantsCount}
                onChange={(e) => set('currentTenantsCount', e.target.value)}
              />
            </Field>
            <div className="space-y-2 text-sm text-content">
              {(
                [
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

          <section className="card space-y-4 p-6">
            <h2 className="font-semibold text-content">Where you live</h2>
            {residence === undefined ? (
              <p className="text-sm text-content-secondary">Loading…</p>
            ) : residence ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-content">{residenceSummary(residence)}</p>
                <Link href="/dashboard/residence" className="text-sm text-primary">
                  Change
                </Link>
              </div>
            ) : (
              <ResidenceForm onSaved={setResidence} />
            )}
            {residence?.kind === 'abroad' && (
              <p className="text-sm text-warning">
                You live outside Nigeria, so tenants can only book viewings through an agent or a
                caretaker. Add one from the listing once it is published.
              </p>
            )}
          </section>

          <section className="card space-y-4 p-6">
            <h2 className="font-semibold text-content">Proof of ownership</h2>
            <p className="text-sm text-content-secondary">
              An admin checks this before your listing goes on public browse. A C of O
              or deed runs to several pages - upload it as one PDF.
            </p>

            <Field label="Document type">
              <select
                className="input-field px-4 py-3"
                value={ownershipDocType}
                onChange={(e) =>
                  setOwnershipDocType(e.target.value as 'c_of_o' | 'deed' | 'other')
                }
              >
                <option value="c_of_o">Certificate of Occupancy</option>
                <option value="deed">Deed of Assignment</option>
                <option value="other">Other property document</option>
              </select>
            </Field>

            <Field label="Document">
              <input
                className="input-field px-4 py-3"
                type="file"
                accept="application/pdf,image/*"
                required
                onChange={(e) => setOwnershipDoc(e.target.files?.[0] ?? null)}
              />
            </Field>

            {ownershipDoc && (
              <p className="text-sm text-content-secondary">
                Attached: {ownershipDoc.name}
              </p>
            )}
          </section>

          {feeOwed && (
            <p className="text-sm text-content-secondary">
              Your first listing was free. This one has a {formatNairaFull(listingPrice)} listing
              fee, which you pay right after creating it.
            </p>
          )}
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
