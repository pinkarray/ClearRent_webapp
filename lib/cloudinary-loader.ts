import type { ImageLoaderProps } from 'next/image'

/**
 * Serves property photos straight from Cloudinary instead of proxying them
 * through Next's optimizer at /_next/image.
 *
 * The originals are ~1.4 MB. Routing them through the optimizer meant the dev
 * server downloading the full file before re-encoding it, which exceeded the
 * fetch timeout and produced a 500 per image. Cloudinary is already an image
 * CDN, so the right move is to ask IT for the size we want:
 *
 *   f_auto  → WebP/AVIF when the browser supports it
 *   q_auto  → quality chosen per image
 *   w_<n>   → resized to the layout width Next asks for
 *
 * The browser then fetches a right-sized image directly from the CDN. Applied
 * per <Image> rather than as a global loader, so /public assets (logos, icons)
 * keep using the default pipeline.
 */
export function cloudinaryLoader({ src, width, quality }: ImageLoaderProps): string {
  const marker = '/upload/'
  const at = src.indexOf(marker)

  // Not a Cloudinary upload URL — hand it back untouched rather than building
  // a broken transformation.
  if (at === -1) return src

  const transforms = ['f_auto', `q_auto${quality ? `:${quality}` : ''}`, `w_${width}`].join(',')
  return `${src.slice(0, at + marker.length)}${transforms}/${src.slice(at + marker.length)}`
}
