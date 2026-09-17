'use client'

import { useCallback, useRef, useState } from 'react'

export type AskTextOptions = {
  title: string
  /** Shown above the text box. */
  label: string
  /** Confirm button text. */
  cta: string
  /** A one-line context under the title, e.g. the property. */
  subtitle?: string
  /** When true (the default) confirm stays disabled until something is typed. */
  required?: boolean
}

/**
 * An in-page question with a text answer, in place of window.prompt.
 *
 * window.prompt showed the site's domain as its heading, looked like a browser
 * error, and on a phone opened a system dialog far from the button that asked.
 * Same styling as the tenancy page's own question dialog.
 *
 *   const [askText, askDialog] = useAskText()
 *   const reason = await askText({ title, label, cta })  // null when cancelled
 *   ...
 *   return <>{page}{askDialog}</>
 */
export function useAskText(): [
  (options: AskTextOptions) => Promise<string | null>,
  React.ReactNode,
] {
  const [options, setOptions] = useState<AskTextOptions | null>(null)
  const [text, setText] = useState('')
  const resolver = useRef<((value: string | null) => void) | null>(null)

  const ask = useCallback((next: AskTextOptions) => {
    // A second question while one is open answers the first as cancelled.
    resolver.current?.(null)
    setText('')
    setOptions(next)
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  function finish(value: string | null) {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }

  const required = options?.required ?? true

  const dialog = options && (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={options.title}
      onClick={() => finish(null)}
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold text-content">{options.title}</p>
        {options.subtitle && (
          <p className="mt-1 text-sm text-content-secondary">{options.subtitle}</p>
        )}
        <label className="mt-4 block text-sm text-content-secondary">
          {options.label}
          <textarea
            className="input-field mt-1 px-3 py-2.5"
            rows={3}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="mt-5 flex justify-end gap-3">
          <button className="btn-ghost px-5 py-2.5 text-sm" onClick={() => finish(null)}>
            Cancel
          </button>
          <button
            className="btn-primary px-5 py-2.5 text-sm"
            disabled={required && !text.trim()}
            onClick={() => finish(text.trim())}
          >
            {options.cta}
          </button>
        </div>
      </div>
    </div>
  )

  return [ask, dialog]
}
