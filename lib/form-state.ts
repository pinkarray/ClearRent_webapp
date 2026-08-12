/*
  Change detection for forms whose Save button would otherwise stay live after a
  successful save.

  The problem this solves: a button that reads "Save" and is still clickable
  after saving gives no signal that anything happened, so people click it again
  - and a second identical write is at best wasted and at worst confusing when
  it races the first. Comparing the current values against the last saved ones
  lets the button say "Saved" and go quiet until something actually changes.

  Usage: snapshot on load AND after a successful save; compare on every render.
*/

/**
 * A stable, comparable snapshot of form values. Order-sensitive — use it where
 * reordering IS a change (image order, list position).
 */
export function fingerprint(value: unknown): string {
  return JSON.stringify(value)
}

/**
 * Snapshot of one or more selection lists, ignoring order.
 *
 * For a set of chosen options — service areas, days, time slots — the sequence
 * the user tapped in is not a change worth enabling Save for.
 */
export function sortedFingerprint(...lists: string[][]): string {
  return JSON.stringify(lists.map((l) => [...l].sort()))
}
