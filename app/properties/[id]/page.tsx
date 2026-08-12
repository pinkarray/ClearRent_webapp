import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookInspection } from '../../../components/BookInspection'
import { CloudinaryImage } from '../../../components/CloudinaryImage'
import SaveButton from '../../../components/SaveButton'
import {
  formatNairaFull,
  getPublishedProperty,
  rentPeriod,
  totalPackage,
  type PublicProperty,
} from '../../../lib/property'

export const revalidate = 300

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const property = await getPublishedProperty(id)
  if (!property) return { title: 'Property not found - ClearRent' }

  return {
    title: `${property.title} - ${property.approximateAddress} | ClearRent`,
    description: property.description.slice(0, 155),
    openGraph: {
      title: property.title,
      description: property.description.slice(0, 155),
      images: property.images.slice(0, 1),
      type: 'website',
    },
  }
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-divider py-3 last:border-0">
      <div>
        <span className="text-sm text-content-secondary">{label}</span>
        {hint && <p className="mt-0.5 text-xs text-content-hint">{hint}</p>}
      </div>
      <span className="shrink-0 text-sm font-semibold text-content">{value}</span>
    </div>
  )
}

function Pricing({ property }: { property: PublicProperty }) {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-content">The full package</h2>
      <div className="mt-3">
        <Row
          label="Rent"
          value={`${formatNairaFull(property.rent)}${rentPeriod(property.rentFrequency)}`}
        />
        {property.agentFee > 0 && (
          <Row label="Agent fee" value={formatNairaFull(property.agentFee)} />
        )}
        {property.cautionDeposit > 0 && (
          <Row
            label="Caution deposit"
            hint={
              property.cautionDepositRefundable
                ? 'Refunded at move-out if the unit is left in good condition.'
                : 'Non-refundable.'
            }
            value={formatNairaFull(property.cautionDeposit)}
          />
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
        <span className="font-semibold text-content">Total to move in</span>
        <span className="text-xl font-bold text-primary">
          {formatNairaFull(totalPackage(property))}
        </span>
      </div>

      {property.recurringDues.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-content">Recurring dues</h3>
          <div className="mt-1">
            {property.recurringDues.map((due, i) => (
              <Row
                key={i}
                label={due.name ?? 'Due'}
                value={`${formatNairaFull(due.amount ?? 0)} / ${due.frequency ?? 'yearly'}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default async function PropertyDetailPage({ params }: Props) {
  const { id } = await params
  const property = await getPublishedProperty(id)
  if (!property) notFound()

  return (
    <main>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/properties"
          className="text-sm font-medium text-primary no-underline hover:underline"
        >
          ← All properties
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="verified-badge">Ownership verified</span>
          <span className="text-sm capitalize text-content-secondary">
            {property.propertyType.replace(/_/g, ' ')}
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-bold text-content sm:text-4xl">
          {property.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-content-secondary">{property.approximateAddress}</p>
          <SaveButton propertyId={property.id} />
        </div>

        {property.images.length > 0 && (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {property.images.slice(0, 6).map((src, i) => (
              <div
                key={src}
                className={`relative overflow-hidden rounded-lg bg-surface-secondary ${
                  i === 0 ? 'aspect-[16/10] sm:col-span-2' : 'aspect-[4/3]'
                }`}
              >
                <CloudinaryImage
                  src={src}
                  alt={`${property.title} - photo ${i + 1}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-cover"
                  priority={i === 0}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div>
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-content">The space</h2>
              <div className="mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
                <Row label="Bedrooms" value={String(property.bedrooms)} />
                <Row label="Bathrooms" value={String(property.bathrooms)} />
                <Row label="Toilets" value={String(property.toilets)} />
                <Row label="Living rooms" value={String(property.livingRooms)} />
                <Row label="Kitchens" value={String(property.kitchens)} />
                {property.ceilingTypes.length > 0 && (
                  <Row
                    label="Ceiling"
                    value={property.ceilingTypes.map((c) => c.replace(/_/g, ' ')).join(', ')}
                  />
                )}
              </div>
            </div>

            {property.description && (
              <div className="card mt-6 p-6">
                <h2 className="text-lg font-semibold text-content">About</h2>
                <p className="mt-2 whitespace-pre-line text-content-secondary">
                  {property.description}
                </p>
              </div>
            )}

            {property.amenities.length > 0 && (
              <div className="card mt-6 p-6">
                <h2 className="text-lg font-semibold text-content">Amenities</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {property.amenities.map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-surface-secondary px-3 py-1.5 text-sm capitalize text-content-secondary"
                    >
                      {a.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {property.rules.length > 0 && (
              <div className="card mt-6 p-6">
                <h2 className="text-lg font-semibold text-content">House rules</h2>
                <ul className="mt-3 list-inside list-disc space-y-1 text-content-secondary">
                  {property.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {property.videoUrl && (
              <div className="card mt-6 overflow-hidden">
                <video controls className="w-full" src={property.videoUrl} />
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-8 lg:self-start">
            <Pricing property={property} />

            <div className="mt-6">
              <BookInspection propertyId={property.id} />
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
