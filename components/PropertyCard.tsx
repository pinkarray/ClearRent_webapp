import Link from 'next/link'
import { CloudinaryImage } from './CloudinaryImage'
import { formatNaira, rentPeriod, type PublicProperty } from '../lib/property'

export function PropertyCard({ property }: { property: PublicProperty }) {
  const cover = property.images[0]

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

        <p className="mt-1 line-clamp-1 text-sm text-content-secondary">
          {property.approximateAddress}
        </p>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-content-secondary">
          <span>{property.bedrooms} bed</span>
          <span>{property.bathrooms} bath</span>
          <span>{property.toilets} toilet</span>
        </div>
      </div>
    </Link>
  )
}
