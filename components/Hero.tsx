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
    <section className="mesh-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: 80 }}>
      <div className="container" ref={heroRef}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center', padding: '80px 0 64px' }}>

          {/* Badge */}
          <div data-animate style={{ opacity: 0, marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
            <span className="verified-badge">
              <span>🔒</span>
              <span>Verification-First Rental Platform · Lagos, Nigeria</span>
            </span>
          </div>

          {/* Headline */}
          <h1 data-animate style={{
            opacity: 0,
            fontFamily: 'Outfit',
            fontWeight: 800,
            fontSize: 'clamp(40px, 7vw, 72px)',
            lineHeight: 1.1,
            color: 'var(--text-primary)',
            marginBottom: 24,
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
            fontSize: 'clamp(16px, 2.5vw, 20px)',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            marginBottom: 40,
            maxWidth: 560,
            margin: '0 auto 40px',
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
            marginBottom: 56,
          }}>
            <a href="#waitlist" className="btn-amber" style={{ padding: '14px 32px', fontSize: 16 }}>
              Join the Waitlist →
            </a>
            <a href="#how-it-works" className="btn-ghost" style={{ padding: '14px 32px', fontSize: 16 }}>
              See How It Works
            </a>
          </div>

          {/* Social proof numbers */}
          <div data-animate style={{
            opacity: 0,
            display: 'flex',
            gap: 40,
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
                  fontSize: 28,
                  color: 'var(--primary)',
                  lineHeight: 1,
                  marginBottom: 4,
                }}>
                  {stat.number}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* App preview mockup */}
        <div data-animate style={{ opacity: 0, display: 'flex', justifyContent: 'center', paddingBottom: 80 }}>
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: 900,
          }}>
            {/* Main card */}
            <div className="card" style={{
              padding: 28,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
            }}>
              {/* Property card preview */}
              <div style={{
                background: 'var(--surface-secondary)',
                borderRadius: 16,
                overflow: 'hidden',
                border: '1px solid var(--border)',
              }}>
                <div style={{
                  height: 140,
                  background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-light) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}>
                  <span style={{ fontSize: 48 }}>🏠</span>
                  <div style={{
                    position: 'absolute',
                    top: 12, right: 12,
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 8,
                    padding: '4px 10px',
                    color: 'white',
                    fontSize: 11,
                    fontWeight: 700,
                    border: '1px solid rgba(255,255,255,0.3)',
                  }}>
                    ✓ VERIFIED
                  </div>
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: 'var(--text-primary)' }}>
                    3-Bedroom Flat
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    📍 Lekki Phase 1, Lagos
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--primary)' }}>
                    ₦2,500,000<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>/yr</span>
                  </div>
                </div>
              </div>

              {/* Verification status card */}
              <div style={{
                background: 'var(--surface-secondary)',
                borderRadius: 16,
                padding: 20,
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                  Verification Status
                </div>
                {[
                  { label: 'NIN Verified', done: true },
                  { label: 'Property Docs', done: true },
                  { label: 'Identity Confirmed', done: true },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: item.done ? 'var(--primary)' : 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, color: 'white', flexShrink: 0,
                    }}>
                      {item.done ? '✓' : ''}
                    </div>
                    <span style={{ fontSize: 13, color: item.done ? 'var(--text-primary)' : 'var(--text-hint)', fontWeight: item.done ? 500 : 400 }}>
                      {item.label}
                    </span>
                  </div>
                ))}
                <div style={{
                  marginTop: 4,
                  background: 'rgba(10,123,108,0.1)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: 'var(--primary)',
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  🎉 Profile fully verified!
                </div>
              </div>

              {/* Inspection booked card */}
              <div style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                borderRadius: 16,
                padding: 20,
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 600, letterSpacing: '0.05em' }}>
                  INSPECTION BOOKED
                </div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  Tomorrow, 10:00 AM
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  3-Bed Flat · Lekki Phase 1
                </div>
                <div style={{
                  marginTop: 'auto',
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontSize: 12,
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