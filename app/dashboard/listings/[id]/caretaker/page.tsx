'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { useAuth } from '../../../../../components/AuthProvider'
import { clientDb } from '../../../../../lib/firebase-client'
import {
  inviteCaretaker,
  invitesForLandlord,
  lookupCaretakerCandidate,
  revokeCaretaker,
  type CaretakerInvite,
} from '../../../../../lib/caretaker'

/*
  Appoint or remove the caretaker for one listing.

  Mirrors the `agent` sub-page next door rather than crowding the edit form,
  because an arrangement can span a whole building and so is not a
  property-shaped field.

  Nothing here writes `caretakerId`: it is admin-SDK-only, and the owner-update
  rule lets a landlord CLEAR it but never set it. An appointment always needs
  the invitee to accept.
*/
export default function ListingCaretakerPage() {
  const { user } = useAuth()
  const params = useParams<{ id: string }>()
  const propertyId = params.id

  const [caretakerName, setCaretakerName] = useState<string | null>(null)
  const [buildingId, setBuildingId] = useState<string | null>(null)
  const [grant, setGrant] = useState<CaretakerInvite | null>(null)
  const [pending, setPending] = useState<CaretakerInvite | null>(null)
  const [phone, setPhone] = useState('')
  const [applyToBuilding, setApplyToBuilding] = useState(false)
  const [confirming, setConfirming] = useState<{ name: string; ids: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user || !propertyId) return
    const snap = await getDoc(doc(clientDb(), 'properties', propertyId))
    setCaretakerName((snap.data()?.caretakerName as string | undefined) ?? null)
    setBuildingId((snap.data()?.buildingId as string | undefined) ?? null)

    const invites = await invitesForLandlord(user.uid)
    setGrant(
      invites.find((i) => i.status === 'accepted' && i.propertyIds.includes(propertyId)) ??
        null,
    )
    setPending(
      invites.find((i) => i.status === 'pending' && i.propertyIds.includes(propertyId)) ??
        null,
    )
  }, [user, propertyId])

  useEffect(() => {
    void load()
  }, [load])

  /** Which units this invitation would cover. */
  async function targetIds(): Promise<string[]> {
    if (!applyToBuilding || !buildingId || !user) return [propertyId]
    const { collection, getDocs, query, where } = await import('firebase/firestore')
    const snap = await getDocs(
      query(
        collection(clientDb(), 'properties'),
        where('landlordId', '==', user.uid),
        where('buildingId', '==', buildingId),
      ),
    )
    // The invite is refused outright if ANY unit already has a caretaker, so
    // drop those here rather than making the landlord hunt for the blocker.
    const ids = snap.docs.filter((d) => !d.data().caretakerId).map((d) => d.id)
    return ids.length > 0 ? ids : [propertyId]
  }

  /* Step 1 - resolve the number to a NAME. One mistyped digit would otherwise
     appoint a real stranger to a tenant's issues and messages. */
  async function check() {
    setError(null)
    setNotice(null)
    if (!phone.trim()) {
      setError('Enter their phone number.')
      return
    }
    setBusy(true)
    const ids = await targetIds()
    const res = await lookupCaretakerCandidate(phone, ids)
    setBusy(false)
    if (res.error || !res.caretakerName) {
      setError(res.error ?? 'Could not find that number.')
      return
    }
    setConfirming({ name: res.caretakerName, ids })
  }

  /* Step 2 - the landlord confirms the name, not the digits. */
  async function send() {
    if (!confirming) return
    setBusy(true)
    const err = await inviteCaretaker(
      phone,
      confirming.ids,
      applyToBuilding ? buildingId : null,
    )
    setBusy(false)
    setConfirming(null)
    if (err) {
      setError(err)
      return
    }
    setPhone('')
    setNotice('Invitation sent. They appear here once they accept.')
    await load()
  }

  async function remove(invite: CaretakerInvite) {
    setBusy(true)
    setError(null)
    const err = await revokeCaretaker(invite.id)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setNotice(invite.status === 'pending' ? 'Invitation withdrawn.' : 'Caretaker removed.')
    await load()
  }

  const live = grant ?? pending

  return (
    <div className="space-y-6">
      {error ? (
        <div className="card border-error/40 p-4 text-sm text-error">{error}</div>
      ) : null}
      {notice ? (
        <div className="card border-primary/40 p-4 text-sm text-content-secondary">
          {notice}
        </div>
      ) : null}

      <section className="card p-6">
        <p className="font-semibold text-content">Caretaker</p>
        <p className="mt-1 text-sm text-content-secondary">
          Someone who handles issues, maintenance and tenant messages for you. They
          can never change rent, deposits, payouts or agreement terms.
        </p>

        {live ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-divider p-4">
            <div className="min-w-0">
              <p className="font-medium text-content">
                {caretakerName ?? live.caretakerName}
              </p>
              <p className="text-sm text-content-secondary">
                {live.status === 'pending'
                  ? 'Invitation sent - waiting for their answer'
                  : live.propertyIds.length > 1
                    ? `Manages ${live.propertyIds.length} of your units`
                    : 'Manages this property'}
              </p>
            </div>
            <button
              className="btn-ghost px-4 py-2 text-sm text-error"
              disabled={busy}
              onClick={() => remove(live)}
            >
              {live.status === 'pending' ? 'Withdraw' : 'Remove'}
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm text-content-secondary">Their phone number</span>
              <input
                className="input mt-1 w-full"
                inputMode="tel"
                placeholder="0803 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <p className="text-sm text-content-secondary">
              They must already have a ClearRent account with a verified identity.
            </p>
            {buildingId ? (
              <label className="flex items-start gap-3 text-sm text-content">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={applyToBuilding}
                  onChange={(e) => setApplyToBuilding(e.target.checked)}
                />
                <span>
                  Every unit in this building
                  <span className="block text-content-secondary">
                    One invitation covering all your units here
                  </span>
                </span>
              </label>
            ) : null}
            <button className="btn-primary px-5 py-2.5 text-sm" disabled={busy} onClick={check}>
              {busy ? 'Checking…' : 'Continue'}
            </button>
          </div>
        )}
      </section>

      {confirming ? (
        <div className="card border-primary/40 p-6">
          <p className="font-semibold text-content">Invite {confirming.name}?</p>
          <p className="mt-1 text-sm text-content-secondary">
            {confirming.ids.length > 1
              ? `${confirming.name} will be asked to manage ${confirming.ids.length} of your units.`
              : `${confirming.name} will be asked to manage this property.`}{' '}
            They will handle issues, maintenance and messages with your tenant.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              className="btn-ghost px-5 py-2.5 text-sm"
              disabled={busy}
              onClick={() => setConfirming(null)}
            >
              Not them
            </button>
            <button className="btn-primary px-5 py-2.5 text-sm" disabled={busy} onClick={send}>
              {busy ? 'Sending…' : 'Send invitation'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
