import type { Metadata } from 'next'
import Link from 'next/link'
import { PropertyCard } from '../../components/PropertyCard'
import { getPublishedProperties, type PropertyFilters } from '../../lib/property'

export const metadata: Metadata = {
  title: 'Verified properties for rent in Nigeria — ClearRent',
  description:
    'Browse verified rental listings on ClearRent. Every property shown here has passed ownership-document verification and is ready for inspection.',
}

// Server-rendered from Firestore via the Admin SDK, then cached. Reading
// Firestore on every request would be slow and costly for pages that change
// only when a landlord edits a listing.
export const revalidate = 300

function parseNumber(v: string | undefined): number | undefined {
  if (!v) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const one = (k: string) => {
    const v = sp[k]
    return typeof v === 'string' && v.length > 0 ? v : undefined
  }

  const filters: PropertyFilters = {
    state: one('state'),
    city: one('city'),
    lga: one('lga'),
    propertyType: one('type'),
    bedrooms: parseNumber(one('bedrooms')),
    minRent: parseNumber(one('minRent')),
    maxRent: parseNumber(one('maxRent')),
  }

  const properties = await getPublishedProperties(filters)
  const hasFilters = Object.values(filters).some((v) => v !== undefined)

  return (
    <main>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-content sm:text-3xl">
          Verified properties
        </h1>
        <p className="mt-2 max-w-2xl text-content-secondary">
          Every listing here has passed ownership-document verification and is ready for
          inspection. Exact addresses are shared once your inspection is approved.
        </p>

        <form className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
          <input
            className="input-field px-4 py-3"
            name="state"
            placeholder="State"
            defaultValue={filters.state ?? ''}
          />
          <input
            className="input-field px-4 py-3"
            name="city"
            placeholder="City"
            defaultValue={filters.city ?? ''}
          />
          <input
            className="input-field px-4 py-3"
            name="lga"
            placeholder="LGA"
            defaultValue={filters.lga ?? ''}
          />
          <input
            className="input-field px-4 py-3"
            name="bedrooms"
            type="number"
            min={0}
            placeholder="Bedrooms"
            defaultValue={filters.bedrooms ?? ''}
          />
          <button className="btn-primary px-6 py-3" type="submit">
            Search
          </button>
        </form>

        {properties.length === 0 ? (
          <div className="card mt-10 p-10 text-center">
            <p className="text-lg font-semibold text-content">
              {hasFilters ? 'No properties match those filters' : 'No verified listings yet'}
            </p>
            <p className="mt-2 text-sm text-content-secondary">
              {hasFilters
                ? 'Try widening your search.'
                : 'Listings appear here once a landlord’s ownership document is verified and the property is marked ready for inspections.'}
            </p>
            {hasFilters && (
              <Link
                href="/properties"
                className="btn-ghost mt-6 inline-block px-6 py-3 no-underline"
              >
                Clear filters
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="mt-8 text-sm text-content-secondary">
              {properties.length} {properties.length === 1 ? 'property' : 'properties'}
            </p>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
