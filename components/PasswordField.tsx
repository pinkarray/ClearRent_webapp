'use client'

import { useId, useState } from 'react'

/**
 * Password input with a reveal toggle.
 *
 * Typing a password blind on a phone keyboard is where most sign-in failures
 * come from, so every password field on the site uses this rather than a bare
 * type="password".
 */
export function PasswordField({
  label,
  hint,
  value,
  onChange,
  autoComplete = 'current-password',
  minLength,
  required = true,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  minLength?: number
  required?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const id = useId()

  return (
    <div className="block">
      <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)]">
        {label}
      </label>
      {hint && <span className="mt-0.5 block text-xs text-[var(--text-hint)]">{hint}</span>}

      <div className="relative mt-1.5">
        <input
          id={id}
          className="input-field py-3 pl-4 pr-12"
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-[var(--radius-sm)] px-3 py-2 text-[var(--text-secondary)] hover:text-[var(--primary)]"
        >
          {visible ? (
            // Eye with a slash — currently visible, click to hide.
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7 0 1-.7 2.3-1.8 3.5M6.3 6.9C4.1 8.3 3 10.3 3 12c0 2.5 4 7 9 7 1.4 0 2.7-.35 3.8-.9"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 12s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7z"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
