'use client'

import Image, { type ImageProps } from 'next/image'
import { cloudinaryLoader } from '../lib/cloudinary-loader'

/**
 * <Image> wired to the Cloudinary loader.
 *
 * This wrapper exists purely because of the server/client boundary: `loader` is
 * a function, and functions cannot be passed as props from a Server Component
 * to a Client Component. The property pages are server-rendered, so they cannot
 * hand `cloudinaryLoader` to next/image directly — it has to be attached here,
 * inside the client bundle.
 */
// `alt` is destructured rather than spread so the a11y lint rule can see it.
export function CloudinaryImage({ alt, ...props }: Omit<ImageProps, 'loader'>) {
  return <Image {...props} alt={alt} loader={cloudinaryLoader} />
}
