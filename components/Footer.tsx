'use client'

import { useState } from 'react'
import LegalModal from './LegalModal'
import { PrivacyPolicyContent, TermsContent, CookiePolicyContent } from './LegalContent'

type ModalType = 'privacy' | 'terms' | 'cookies' | null

export default function Footer() {
  const year = new Date().getFullYear()
  const [openModal, setOpenModal] = useState<ModalType>(null)

  const legalLinks = [
    { label: 'Privacy Policy', modal: 'privacy' as ModalType },
    { label: 'Terms of Service', modal: 'terms' as ModalType },
    { label: 'Cookie Policy', modal: 'cookies' as ModalType },
  ]

  return (
    <>
      <footer style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        padding: '48px 0 32px',
      }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 40,
            marginBottom: 48,
          }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 36, height: 36,
                  background: 'var(--primary)',
                  borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>C</span>
                </div>
                <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>
                  Clear<span style={{ color: 'var(--primary)' }}>Rent</span>
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 240 }}>
                Nigeria's verification-first rental platform. Rent without regret.
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 8 }}>
                A product of Verealty Technologies Ltd. 🇳🇬
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 4 }}>
                Lagos, Nigeria
              </p>
            </div>

            {/* Platform */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 16, letterSpacing: '0.05em' }}>
                PLATFORM
              </div>
              {['How It Works', 'For Tenants', 'For Landlords', 'For Agents', 'Pricing'].map(item => (
                <div key={item} style={{ marginBottom: 10 }}>
                  <a href="#" style={{ fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                    {item}
                  </a>
                </div>
              ))}
            </div>

            {/* Company */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 16, letterSpacing: '0.05em' }}>
                COMPANY
              </div>
              {['About Us', 'Blog', 'Careers', 'Press'].map(item => (
                <div key={item} style={{ marginBottom: 10 }}>
                  <a href="#" style={{ fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                    {item}
                  </a>
                </div>
              ))}
            </div>

            {/* Contact */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 16, letterSpacing: '0.05em' }}>
                CONTACT
              </div>
              <a href="mailto:info@verealtytech.com" style={{
                fontSize: 14,
                color: 'var(--primary)',
                textDecoration: 'none',
                fontWeight: 500,
                display: 'block',
                marginBottom: 10,
              }}>
                info@verealtytech.com
              </a>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Mon – Fri, 9am – 6pm WAT
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                {['𝕏', 'in', 'ig'].map(s => (
                  <div key={s} style={{
                    width: 36, height: 36,
                    background: 'var(--surface-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}>
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{
            borderTop: '1px solid var(--divider)',
            paddingTop: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <p style={{ fontSize: 13, color: 'var(--text-hint)' }}>
              © {year} ClearRent · Verealty Technologies Ltd. All rights reserved.
            </p>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {legalLinks.map(link => (
                <button
                  key={link.label}
                  onClick={() => setOpenModal(link.modal)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: 'var(--text-hint)',
                    padding: 0,
                    fontFamily: 'Outfit',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-hint)')}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Legal Modals */}
      <LegalModal
        isOpen={openModal === 'privacy'}
        onClose={() => setOpenModal(null)}
        title="Privacy Policy"
      >
        <PrivacyPolicyContent />
      </LegalModal>

      <LegalModal
        isOpen={openModal === 'terms'}
        onClose={() => setOpenModal(null)}
        title="Terms & Conditions"
      >
        <TermsContent />
      </LegalModal>

      <LegalModal
        isOpen={openModal === 'cookies'}
        onClose={() => setOpenModal(null)}
        title="Cookie Policy"
      >
        <CookiePolicyContent />
      </LegalModal>
    </>
  )
}