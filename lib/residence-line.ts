/**
 * The tenant-facing residence line for a listing (`landlordResidence`,
 * `landlordResidenceRegion`), or null when the landlord has not answered yet,
 * so nothing wrong is shown. Coarse on purpose: never an address.
 *
 * A plain module so both the server-rendered public page and client code can
 * use it. Mirrors ListingResidence.shortLine in the app.
 */
export function residenceShortLine(value?: string | null, region?: string | null): string | null {
  if (value === 'on_premises') return 'Lives on the premises'
  if (value === 'elsewhere') return region ? `Lives elsewhere (${region})` : 'Lives elsewhere'
  if (value === 'abroad') return 'Lives outside Nigeria'
  return null
}
