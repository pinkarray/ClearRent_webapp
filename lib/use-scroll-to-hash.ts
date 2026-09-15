'use client'

import { useEffect } from 'react'

/**
 * Scrolls to the element named by the URL's #hash once the page's data is in.
 *
 * The next-step banner links to one card (a rental, an interest, an
 * inspection), but those cards are rendered from a live query that arrives
 * after navigation, so the browser's own jump to the hash finds nothing. People
 * then landed at the top of a long list and took the tap for the action itself.
 */
export function useScrollToHash(ready: boolean) {
  useEffect(() => {
    if (!ready) return
    const target = window.location.hash.slice(1)
    if (target) document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' })
  }, [ready])
}
