'use client'

import { useEffect, useRef } from 'react'

export default function Hero() {
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const items = heroRef.current?.querySelectorAll('[data-animate]')
    items?.forEach((el, i) => {
      (el as HTMLElement).style.animationDelay = `${i * 0.12}s`
      el.classList.add('animate-fade-up')
    })
  }, [])

  return (
    <section className="mesh-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: 68 }}>
      <div className="container" ref={heroRef}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center', padding: '56px 0 48px' }}>

          {/* Badge */}
          <div data-animate style={{ opacity: 0, marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
            <span className="verified-badge" style={{ textAlign: 'center', lineHeight: 1.5 }}>
              <span>🔒</span>
              <span>Verification-First Rental Platform · Lagos</span>
            </span>
          </div>

          {/* Headline */}
          <h1 data-animate style={{
            opacity: 0,
            fontFamily: 'Outfit',
            fontWeight: 800,
            fontSize: 'clamp(32px, 8vw, 72px)',
            lineHeight: 1.1,
            color: 'var(--text-primary)',
            marginBottom: 20,
            letterSpacing: '-0.02em',
          }}>
            Rent in Lagos{' '}
            <span style={{ display: 'block' }}>
              <span className="gradient-text">Without the Regret</span>
            </span>
          </h1>

          {/* Subheadline */}
          <p data-animate style={{
            opacity: 0,
            fontSize: 'clamp(15px, 2.5vw, 19px)',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            maxWidth: 520,
            margin: '0 auto 36px',
          }}>
            No fraudulent agents. No fake listings. No wahala. Connect directly with
            verified landlords and tenants — every identity confirmed before you meet.
          </p>

          {/* CTA buttons */}
          <div data-animate style={{
            opacity: 0,
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: 48,
          }}>
            <a href="#waitlist" className="btn-amber" style={{ padding: '13px 28px', fontSize: 15, display: 'inline-block', textDecoration: 'none' }}>
              Join the Waitlist →
            </a>
            <a href="#how-it-works" className="btn-ghost" style={{ padding: '13px 28px', fontSize: 15, display: 'inline-block', textDecoration: 'none' }}>
              See How It Works
            </a>
          </div>

          {/* Social proof numbers */}
          <div data-animate style={{
            opacity: 0,
            display: 'flex',
            gap: 'clamp(20px, 5vw, 48px)',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            {[
              { number: '100%', label: 'NIN-Verified Users' },
              { number: '₦0', label: 'Hidden Fees' },
              { number: 'Lagos', label: 'Starting Here' },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'Outfit',
                  fontWeight: 800,
                  fontSize: 'clamp(22px, 4vw, 28px)',
                  color: 'var(--primary)',
                  lineHeight: 1,
                  marginBottom: 4,
                }}>
                  {stat.number}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* App preview mockup — hidden on very small screens, shown on sm+ */}
        <div data-animate style={{ opacity: 0, display: 'flex', justifyContent: 'center', paddingBottom: 64 }}>
          <div style={{ width: '100%', maxWidth: 900 }}>
            <div className="card" style={{
              padding: 'clamp(16px, 3vw, 28px)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}>
              {/* Property card */}
              <div style={{
                background: 'var(--surface-secondary)',
                borderRadius: 16,
                overflow: 'hidden',
                border: '1px solid var(--border)',
              }}>
                <div style={{
                  height: 120,
                  background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-light) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  <span style={{ fontSize: 40 }}>🏠</span>
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 6, padding: '3px 8px',
                    color: 'white', fontSize: 10, fontWeight: 700,
                    border: '1px solid rgba(255,255,255,0.3)',
                  }}>
                    ✓ VERIFIED
                  </div>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3, color: 'var(--text-primary)' }}>
                    3-Bedroom Flat
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    📍 Lekki Phase 1, Lagos
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--primary)' }}>
                    ₦2,500,000<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>/yr</span>
                  </div>
                </div>
              </div>

              {/* Verification card */}
              <div style={{
                background: 'var(--surface-secondary)',
                borderRadius: 16, padding: 16,
                border: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                  Verification Status
                </div>
                {[
                  { label: 'NIN Verified', done: true },
                  { label: 'Property Docs', done: true },
                  { label: 'Identity Confirmed', done: true },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, color: 'white',
                    }}>✓</div>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {item.label}
                    </span>
                  </div>
                ))}
                <div style={{
                  background: 'rgba(10,123,108,0.1)',
                  borderRadius: 8, padding: '8px 12px',
                  color: 'var(--primary)', fontSize: 12, fontWeight: 600,
                }}>
                  🎉 Profile fully verified!
                </div>
              </div>

              {/* Inspection card */}
              <div style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                borderRadius: 16, padding: 16,
                color: 'white',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 600, letterSpacing: '0.05em' }}>
                  INSPECTION BOOKED
                </div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Tomorrow, 10:00 AM</div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>3-Bed Flat · Lekki Phase 1</div>
                <div style={{
                  marginTop: 'auto',
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: 8, padding: '7px 10px', fontSize: 12,
                }}>
                  <span>👤</span>
                  <span>Agent: Verified · ⭐ 4.9</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}