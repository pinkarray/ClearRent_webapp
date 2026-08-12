'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { useAuth } from '../../../../../components/AuthProvider'
import { clientDb } from '../../../../../lib/firebase-client'
import { formatDate, timeAgo } from '../../../../../lib/format'
import { ISSUE_CATEGORIES } from '../../../../../lib/issues'
import { landlordIssues, type LandlordIssue } from '../../../../../lib/landlord'

type MaintenanceLog = {
  id: string
  category: string
  note: string
  loggedAt: Date | null
}

/*
  Property health: what has gone wrong on one listing, and what has been done
  about it proactively.

  Both queries carry `landlordId == uid` as well as `propertyId` - the rules
  scope list access on both collections to the owning landlord
  (`firestore.rules:1121`, `:1148`), so filtering on propertyId alone is
  rejected. Issues are fetched for the landlord and narrowed here, which also
  avoids a composite index the project does not have.
*/
export default function PropertyHealthPage() {
  const { user } = useAuth()
  const params = useParams<{ id: string }>()
  const propertyId = params.id
  const [issues, setIssues] = useState<LandlordIssue[] | null>(null)
  const [logs, setLogs] = useState<MaintenanceLog[] | null>(null)
  const [category, setCategory] = useState<string>(ISSUE_CATEGORIES[0].value)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user || !propertyId) return
    const all = await landlordIssues(user.uid)
    setIssues(all.filter((i) => i.propertyId === propertyId))

    const snap = await getDocs(
      query(
        collection(clientDb(), 'maintenance_logs'),
        where('landlordId', '==', user.uid),
        where('propertyId', '==', propertyId),
      ),
    )
    setLogs(
      snap.docs
        .map((d) => {
          const x = d.data()
          return {
            id: d.id,
            category: (x.category as string) ?? 'other',
            note: (x.note as string) ?? '',
            loggedAt: x.loggedAt?.toDate?.() ?? null,
          }
        })
        .sort((a, b) => (b.loggedAt?.getTime() ?? 0) - (a.loggedAt?.getTime() ?? 0)),
    )
  }, [user, propertyId])

  useEffect(() => {
    ;(async () => {
      await load()
    })()
  }, [load])

  async function addLog(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !propertyId || !note.trim()) return
    setError(null)
    setBusy(true)
    try {
      await addDoc(collection(clientDb(), 'maintenance_logs'), {
        propertyId,
        landlordId: user.uid,
        category,
        note: note.trim(),
        loggedAt: serverTimestamp(),
      })
      setNote('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that log.')
    } finally {
      setBusy(false)
    }
  }

  if (!user || !propertyId) return null

  const open = issues?.filter((i) => i.status !== 'resolved') ?? []
  const resolved = issues?.filter((i) => i.status === 'resolved') ?? []

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Open issues', value: open.length, accent: open.length > 0 ? 'text-error' : 'text-content' },
          { label: 'Resolved', value: resolved.length, accent: 'text-success' },
          { label: 'Maintenance logs', value: logs?.length ?? 0, accent: 'text-content' },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-sm text-content-secondary">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.accent}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
          Issues on this property
        </h2>
        {issues === null ? (
          <p className="mt-3 text-sm text-content-secondary">Loading…</p>
        ) : issues.length === 0 ? (
          <div className="card mt-3 p-6 text-center text-sm text-content-secondary">
            Nothing reported. That is a good sign.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {issues.map((i) => (
              <div key={i.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-content">{i.title}</p>
                    <p className="truncate text-sm text-content-secondary">
                      {i.category} · {i.tenantName} · {formatDate(i.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`chip shrink-0 ${
                      i.status === 'resolved' ? 'chip-success' : 'chip-pending'
                    }`}
                  >
                    {i.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            ))}
            <Link
              href="/dashboard/issues"
              className="btn-ghost inline-block px-4 py-2 text-sm no-underline"
            >
              Work the issue queue
            </Link>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-hint">
          Maintenance log
        </h2>
        <p className="mt-1 text-sm text-content-secondary">
          Record proactive work - servicing, repainting, replacements. Only you and an admin
          can read these.
        </p>

        <form onSubmit={addLog} className="card mt-3 space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <label className="block">
              <span className="text-sm font-medium text-content">Category</span>
              <select
                className="input-field mt-1.5 px-3 py-2.5"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {ISSUE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-content">What was done</span>
              <input
                className="input-field mt-1.5 px-3 py-2.5"
                placeholder="Serviced the generator"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <button
            className="btn-primary px-5 py-2.5 text-sm"
            type="submit"
            disabled={busy || !note.trim()}
          >
            {busy ? 'Saving…' : 'Add log'}
          </button>
        </form>

        {logs && logs.length > 0 && (
          <div className="mt-3 space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="card flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-content">{l.note}</p>
                  <p className="mt-0.5 text-sm capitalize text-content-secondary">
                    {l.category}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-content-hint">
                  {timeAgo(l.loggedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
