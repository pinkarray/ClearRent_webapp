'use client'

import { useEffect } from 'react'

interface LegalModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function LegalModal({ isOpen, onClose, title, children }: LegalModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: '24px 24px 0 0',
          width: '100%',
          maxWidth: 760,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
          animation: 'slideUp 0.3s ease',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 28px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{
              fontFamily: 'Outfit',
              fontWeight: 800,
              fontSize: 20,
              color: 'var(--text-primary)',
              margin: 0,
            }}>
              {title}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-hint)', margin: '4px 0 0' }}>
              Verealty Technologies Ltd. · Last updated March 2026
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--surface-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              width: 36, height: 36,
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{
          overflowY: 'auto',
          padding: '28px',
          flex: 1,
        }}>
          {children}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            className="btn-primary"
            style={{ padding: '10px 28px', fontSize: 14 }}
          >
            I Understand
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}