'use client'

import { TermsContent } from '@/components/LegalContent'

export default function TermsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      fontFamily: 'Outfit, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{
          maxWidth: 720,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <a
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              color: 'var(--primary)',
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            <span style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 800,
            }}>
              C
            </span>
            ClearRent
          </a>
          <span style={{
            fontSize: 11,
            color: 'var(--text-hint)',
          }}>
            by Verealty Technologies Ltd.
          </span>
        </div>
      </header>

      {/* Content */}
      <main style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '40px 24px 80px',
      }}>
        <h1 style={{
          fontFamily: 'Outfit',
          fontWeight: 800,
          fontSize: 28,
          color: 'var(--text-primary)',
          margin: '0 0 8px',
        }}>
          Terms of Service
        </h1>
        <p style={{
          fontSize: 13,
          color: 'var(--text-hint)',
          margin: '0 0 32px',
        }}>
          Verealty Technologies Ltd. · Last updated May 2026
        </p>

        <TermsContent />
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '24px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 12, color: 'var(--text-hint)', margin: 0 }}>
          © {new Date().getFullYear()} ClearRent · Verealty Technologies Ltd. All rights reserved.
        </p>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 16 }}>
          <a href="/privacy" style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/terms" style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}>Terms of Service</a>
          <a href="/" style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}>Home</a>
        </div>
      </footer>
    </div>
  )
}