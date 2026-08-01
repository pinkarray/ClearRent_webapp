import type { MetadataRoute } from 'next'

/*
 * Makes ClearRent installable.
 *
 * This is load-bearing for the iOS strategy, not decoration. There is no Apple
 * build, so iPhone users get the product through the browser — and iOS only
 * exposes the Web Push API to a site added to the Home Screen (iOS 16.4+). In a
 * normal Safari tab the permission prompt is not even offered, so without this
 * manifest an iPhone user can never be notified of anything.
 *
 * `display: standalone` is what makes iOS treat it as installable.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ClearRent — verified rentals in Nigeria',
    short_name: 'ClearRent',
    description:
      'Browse verified rental listings, book inspections and manage your tenancy.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F8F9FA',
    theme_color: '#0A7B6C',
    icons: [
      {
        src: '/logos/clearrent_mark_color.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
