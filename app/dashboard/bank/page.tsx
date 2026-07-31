'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../components/AuthProvider'
import { BANKS, resolveAccount, saveBankDetails } from '../../../lib/bank'

export default function BankDetailsPage() {
  const router = useRouter()
  const { user, profile, ready, refreshProfile } = useAuth()

  const [accountNumber, setAccountNumber] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountName, setAccountName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  // A changed number or bank invalidates the resolved name — saving a stale one
  // would put the wrong payout destination on file. Done in the handlers rather
  // than an effect so there is no render where a stale name is still showing.
  function changeAccountNumber(v: string) {
    setAccountNumber(v.replace(/\D/g, ''))
    setAccountName(null)
    setSaved(false)
  }

  function changeBank(v: string) {
    setBankCode(v)
    setAccountName(null)
    setSaved(false)
  }

  async function handleResolve() {
    setError(null)
    setBusy(true)
    const res = await resolveAccount(accountNumber, bankCode)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setAccountName(res.accountName ?? null)
  }

  async function handleSave() {
    if (!user || !accountName) return
    setError(null)
    setBusy(true)
    const err = await saveBankDetails(user.uid, {
      accountNumber: accountNumber.trim(),
      bankCode,
      bankName: BANKS.find((b) => b.code === bankCode)?.name ?? '',
      accountName,
    })
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setSaved(true)
    await refreshProfile()
  }

  if (!ready || !user) {
    return (
      <main className="mesh-bg min-h-screen">
        <div className="container py-16 text-[var(--text-secondary)]">Loading…</div>
      </main>
    )
  }

  return (
    <main className="mesh-bg min-h-screen">
      <div className="container max-w-2xl py-12">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-[var(--primary)] no-underline hover:underline"
        >
          ← Dashboard
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-[var(--text-primary)]">Payout account</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Required before you can book an inspection, so any refund has somewhere to go. Your
          account details are stored privately — only you and an admin can read them.
        </p>

        {profile?.hasBankDetails && !saved && (
          <div className="card mt-6 border-l-4 border-l-[var(--primary)] p-5">
            <p className="font-semibold text-[var(--text-primary)]">
              You already have an account on file
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Submitting below will replace it.
            </p>
          </div>
        )}

        {saved && (
          <div className="card mt-6 border-l-4 border-l-[var(--primary)] p-5">
            <p className="font-semibold text-[var(--text-primary)]">Saved</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {accountName} · {BANKS.find((b) => b.code === bankCode)?.name}
            </p>
          </div>
        )}

        <div className="card mt-6 space-y-5 p-6">
          <label className="block">
            <span className="text-sm font-medium text-[var(--text-primary)]">Bank</span>
            <select
              className="input-field mt-1.5 px-4 py-3"
              value={bankCode}
              onChange={(e) => changeBank(e.target.value)}
            >
              <option value="">Select a bank</option>
              {BANKS.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Account number
            </span>
            <input
              className="input-field mt-1.5 px-4 py-3 tracking-[0.15em]"
              inputMode="numeric"
              maxLength={10}
              value={accountNumber}
              onChange={(e) => changeAccountNumber(e.target.value)}
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {accountName ? (
            <>
              <div className="rounded-[var(--radius-md)] bg-[var(--surface-secondary)] p-4">
                <p className="text-xs text-[var(--text-secondary)]">Account name</p>
                <p className="mt-0.5 font-semibold text-[var(--text-primary)]">{accountName}</p>
              </div>
              <button
                className="btn-primary w-full px-6 py-3"
                onClick={handleSave}
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Confirm and save'}
              </button>
            </>
          ) : (
            <button
              className="btn-ghost w-full px-6 py-3"
              onClick={handleResolve}
              disabled={busy || accountNumber.length !== 10 || !bankCode}
            >
              {busy ? 'Checking…' : 'Verify account'}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
