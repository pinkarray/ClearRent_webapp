/**
 * Pure display helpers, split out of `lib/property.ts` so client components can
 * import them. `lib/property.ts` pulls in `firebase-admin` at module scope, and
 * importing anything from it on the client drags the Admin SDK into the browser
 * bundle.
 */

export function formatNaira(amount: number): string {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1000) return `₦${(amount / 1000).toFixed(0)}K`
  return `₦${amount.toFixed(0)}`
}

export function formatNairaFull(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`
}

export function rentPeriod(frequency: string): string {
  return frequency === 'yearly' ? '/year' : '/month'
}

export function formatDate(d: Date | null): string {
  if (!d) return '-'
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "3 hours ago" / "2 days ago", for feeds where an exact stamp is noise. */
export function timeAgo(d: Date | null): string {
  if (!d) return ''
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(d)
}
