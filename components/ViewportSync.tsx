'use client'

import { useEffect } from 'react'

/**
 * Publishes the real visible height, and whether the keyboard is up, to CSS.
 *
 * `interactiveWidget: 'resizes-content'` handles this on Chrome/Android, but
 * iOS Safari overlays the keyboard without resizing the layout viewport — dvh
 * does not move there. VisualViewport does, on both, so it is the reliable
 * signal.
 *
 * Sets:
 *   --app-vh          the visible height in px
 *   data-keyboard     "open" while the keyboard covers a meaningful slice
 *
 * Anything wanting to fill the screen reads --app-vh instead of 100dvh, and
 * chrome that is pointless while typing (the bottom tab bar) hides itself off
 * the data attribute.
 */
export function ViewportSync() {
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.documentElement

    function sync() {
      const visible = vv?.height ?? window.innerHeight
      root.style.setProperty('--app-vh', `${visible}px`)

      // A keyboard eats a large chunk; browser chrome appearing does not.
      // 120px is comfortably above address-bar movement and below any keyboard.
      const hidden = window.innerHeight - visible
      root.dataset.keyboard = hidden > 120 ? 'open' : 'closed'
    }

    sync()
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    window.addEventListener('orientationchange', sync)

    return () => {
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
      window.removeEventListener('orientationchange', sync)
      delete root.dataset.keyboard
      root.style.removeProperty('--app-vh')
    }
  }, [])

  return null
}
