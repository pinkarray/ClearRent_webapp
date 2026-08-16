import Link from 'next/link'
import { CloudinaryImage } from './CloudinaryImage'
import {
  formatNaira,
  isSingleSpace,
  rentPeriod,
  sharedFacilities,
  unitContext,
} from '../lib/format'
import type { PublicProperty } from '../lib/property'

export function PropertyCard({ property }: { property: PublicProperty }) {
  const cover = property.images[0]
  const unit = unitContext(property)
  const singleSpace = isSingleSpace(property.propertyType)
  const shared = sharedFacilities(property)

  return (
    <Link href={`/properties/${property.id}`} className="card block overflow-hidden no-underline">
      <div className="relative aspect-[4/3] w-full bg-surface-secondary">
        {cover ? (
          <CloudinaryImage
            src={cover}
            alt={property.title}
            fill
            sizes="(max-width: 768px) 100vw, 380px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-content-hint">
            No photo
          </div>
        )}
        <span className="verified-badge absolute left-3 top-3 bg-surface">
          Verified
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold text-primary">
            {formatNaira(property.rent)}
          </span>
          <span className="text-sm text-content-secondary">
            {rentPeriod(property.rentFrequency)}
          </span>
        </div>

        <h3 className="mt-1 line-clamp-1 text-base font-semibold text-content">
          {property.title}
        </h3>

        {/* Which unit, when it's one of several in a building — two identical
            flats in one compound are otherwise the same card twice. */}
        {unit && (
          <p className="mt-0.5 line-clamp-1 text-xs text-content-hint">{unit}</p>
        )}

        <p className="mt-1 line-clamp-1 text-sm text-content-secondary">
          {property.approximateAddress}
        </p>

        {/* A single space has no meaningful room count — "1 bed · 1 bath" made
            a shared room identical to a self-contained one-bedroom flat. What
            it comes with is the real spec. A multi-room unit keeps its counts
            but still says what it shares: counts alone would read as fully
            self-contained when the toilet is outside. */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-content-secondary">
          {property.grouped && singleSpace ? (
            <span>{shared || 'Private bathroom & kitchen'}</span>
          ) : (
            <>
              <span>{property.bedrooms} bed</span>
              <span>{property.bathrooms} bath</span>
              <span>{property.toilets} toilet</span>
              {shared && <span>· {shared}</span>}
            </>
          )}
        </div>
      </div>
    </Link>
  )
}
