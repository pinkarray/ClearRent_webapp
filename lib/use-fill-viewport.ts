'use client'

import { useEffect, useRef } from 'react'

/**
 * Sizes an element to fill whatever is left of the visible viewport below it.
 *
 * Replaces subtracting AppShell's chrome by hand in CSS. That approach broke
 * the first time the chrome moved: the bottom padding went from pb-20 to pb-28
 * for the floating capsule nav, and a NextStep banner of variable height
 * appeared above the page content — neither of which a fixed rem figure can
 * track.
 *
 * Measuring the element's own top instead means header height, banner
 * presence, padding and future chrome are all accounted for automatically.
 *
 * Reads visualViewport rather than innerHeight so the on-screen keyboard is
 * included; on iOS the layout viewport does not react to it at all.
 */
export function useFillViewport<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    function fit() {
      const el = ref.current
      if (!el) return

      const visible = window.visualViewport?.height ?? window.innerHeight
      const top = el.getBoundingClientRect().top

      // Clearance below: the floating nav plus its gap when it is showing,
      // and only a small breathing space once the keyboard has hidden it.
      const keyboardOpen = document.documentElement.dataset.keyboard === 'open'
      const bottomGap = keyboardOpen ? 8 : 84

      el.style.height = `${Math.max(220, visible - top - bottomGap)}px`
    }

    fit()

    const vv = window.visualViewport
    vv?.addEventListener('resize', fit)
    vv?.addEventListener('scroll', fit)
    window.addEventListener('resize', fit)
    window.addEventListener('orientationchange', fit)

    // ViewportSync flips data-keyboard on <html>; that changes the clearance.
    const observer = new MutationObserver(fit)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-keyboard'],
    })

    return () => {
      vv?.removeEventListener('resize', fit)
      vv?.removeEventListener('scroll', fit)
      window.removeEventListener('resize', fit)
      window.removeEventListener('orientationchange', fit)
      observer.disconnect()
    }
  }, [])

  return ref
}
