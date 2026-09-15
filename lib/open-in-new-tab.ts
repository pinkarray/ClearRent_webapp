'use client'

/**
 * Opens a signed link in a new tab without the browser blocking it.
 *
 * Every private file (agreements, proof of transfer) needs a short-lived URL
 * from a callable first. Calling window.open AFTER that await is no longer
 * counted as the user's tap, so popup blockers drop it silently: the button
 * did nothing, with no error. iPhone Safari always does this.
 *
 * So the tab is opened synchronously, inside the tap, and pointed at the URL
 * once it arrives. It is closed again if the link cannot be made.
 *
 * Returns the error to show, or null.
 */
export async function openInNewTab(
  load: () => Promise<{ url: string } | { error: string }>,
): Promise<string | null> {
  const tab = window.open('', '_blank')
  const res = await load()
  if ('error' in res) {
    tab?.close()
    return res.error
  }
  if (tab) {
    // What 'noopener' would have done; passing it makes window.open return null.
    tab.opener = null
    tab.location.href = res.url
  } else {
    window.location.href = res.url
  }
  return null
}
