'use client'

import { useState } from 'react'
import LegalModal from './LegalModal'
import { PrivacyPolicyContent, TermsContent, CookiePolicyContent } from './LegalContent'

type ModalType = 'privacy' | 'terms' | 'cookies' | null

export default function Footer() {
  const year = new Date().getFullYear()
  const [openModal, setOpenModal] = useState<ModalType>(null)

  const legalLinks: { label: string; modal: ModalType; href: string }[] = [
    { label: 'Privacy Policy', modal: 'privacy', href: '/privacy' },
    { label: 'Terms of Service', modal: 'terms', href: '/terms' },
    { label: 'Cookie Policy', modal: 'cookies', href: '/cookies' },
  ]

  // Open modal on click (nice UX on homepage), but the href
  // still works if someone right-clicks → Open in New Tab,
  // or if a crawler/Google Play reviewer pastes the URL directly.
  const handleLegalClick = (e: React.MouseEvent, modal: ModalType) => {
    e.preventDefault()
    setOpenModal(modal)
  }

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
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 36,
            marginBottom: 40,
          }}>
            {/* Brand */}
            <div style={{ gridColumn: 'span 1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <img
                  src="/logos/clearrent_mark_color.svg"
                  alt="ClearRent"
                  style={{ width: 34, height: 34, objectFit: 'contain', flexShrink: 0 }}
                />
                <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--secondary)' }}>
                  Clear<span style={{ color: 'var(--primary)' }}>Rent</span>
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 220 }}>
                Nigeria's verification-first rental platform. Rent without regret.
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 8 }}>
                A product of Verealty Technologies Ltd. 🇳🇬
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2 }}>
                Lagos, Nigeria
              </p>
            </div>

            {/* Platform */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', marginBottom: 14, letterSpacing: '0.06em' }}>
                PLATFORM
              </div>
              {[
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'For Tenants', href: '#how-it-works' },
                { label: 'For Landlords', href: '#how-it-works' },
                { label: 'For Agents', href: '#agents' },
                { label: 'Pricing', href: '#pricing' },
              ].map(item => (
                <div key={item.label} style={{ marginBottom: 9 }}>
                  <a href={item.href} style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                    {item.label}
                  </a>
                </div>
              ))}
            </div>

            {/* Legal */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', marginBottom: 14, letterSpacing: '0.06em' }}>
                LEGAL
              </div>
              {legalLinks.map(link => (
                <div key={link.label} style={{ marginBottom: 9 }}>
                  <a
                    href={link.href}
                    onClick={(e) => handleLegalClick(e, link.modal)}
                    style={{
                      fontSize: 13, color: 'var(--text-secondary)',
                      fontFamily: 'Outfit', transition: 'color 0.2s',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  >
                    {link.label}
                  </a>
                </div>
              ))}
            </div>

            {/* Contact */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', marginBottom: 14, letterSpacing: '0.06em' }}>
                CONTACT
              </div>
              <a href="mailto:info@verealtytech.com" style={{
                fontSize: 13,
                color: 'var(--primary)',
                textDecoration: 'none',
                fontWeight: 600,
                display: 'block',
                marginBottom: 6,
                wordBreak: 'break-all',
              }}>
                info@verealtytech.com
              </a>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Mon – Fri<br />9am – 6pm WAT
              </p>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{
            borderTop: '1px solid var(--divider)',
            paddingTop: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <p style={{ fontSize: 12, color: 'var(--text-hint)' }}>
              © {year} ClearRent · Verealty Technologies Ltd. All rights reserved.
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {legalLinks.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleLegalClick(e, link.modal)}
                  style={{
                    fontSize: 12, color: 'var(--text-hint)',
                    fontFamily: 'Outfit', transition: 'color 0.2s',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-hint)')}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <LegalModal isOpen={openModal === 'privacy'} onClose={() => setOpenModal(null)} title="Privacy Policy">
        <PrivacyPolicyContent />
      </LegalModal>
      <LegalModal isOpen={openModal === 'terms'} onClose={() => setOpenModal(null)} title="Terms & Conditions">
        <TermsContent />
      </LegalModal>
      <LegalModal isOpen={openModal === 'cookies'} onClose={() => setOpenModal(null)} title="Cookie Policy">
        <CookiePolicyContent />
      </LegalModal>
    </>
  )
}