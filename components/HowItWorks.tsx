'use client'

import { useState } from 'react'

type UserType = 'landlord' | 'tenant' | 'agent'

const steps: Record<UserType, { icon: string; title: string; desc: string }[]> = {
  landlord: [
    { icon: '✅', title: 'Get Verified', desc: 'Submit your NIN and property documents. We confirm you\'re the legitimate owner.' },
    { icon: '🏠', title: 'List Your Property', desc: 'Add your property with real photos, transparent pricing, and the total package breakdown tenants need.' },
    { icon: '👥', title: 'Meet Vetted Tenants', desc: 'Only verified tenants can request inspections. Chat directly, no middlemen blocking you.' },
    { icon: '🤝', title: 'Close with Confidence', desc: 'Approve the tenant you trust. All documentation stays on the platform.' },
  ],
  tenant: [
    { icon: '✅', title: 'Verify Your Identity', desc: 'Submit your NIN and income proof. Your profile becomes a trust signal to landlords.' },
    { icon: '🔍', title: 'Browse Real Listings', desc: 'Every property is owner-verified. No fake listings, no bait-and-switch.' },
    { icon: '📅', title: 'Book an Inspection', desc: 'Pay a transparent inspection fee. Get a verified agent or go direct with the landlord.' },
    { icon: '🏡', title: 'Move In, Stress-Free', desc: 'Know exactly who you\'re renting from. Full pricing transparency before you sign.' },
  ],
  agent: [
    { icon: '✅', title: 'Get Agent-Verified', desc: 'Submit your ID, guarantor info, and experience proof. Earn a verified badge.' },
    { icon: '🏘️', title: 'Browse Open Properties', desc: 'Discover landlords who need agent support and pitch your services directly.' },
    { icon: '👀', title: 'Conduct Inspections', desc: 'Get assigned inspections and earn your cut of the inspection fee — paid through the platform.' },
    { icon: '💰', title: 'Build Your Reputation', desc: 'Ratings and review history make you the go-to agent in your areas.' },
  ],
}

export default function HowItWorks() {
  const [active, setActive] = useState<UserType>('tenant')

  return (
    <section className="section" id="how-it-works" style={{ background: 'var(--bg-secondary)' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span className="verified-badge" style={{ marginBottom: 16, display: 'inline-flex' }}>
            How It Works
          </span>
          <h2 style={{
            fontFamily: 'Outfit',
            fontWeight: 800,
            fontSize: 'clamp(28px, 5vw, 48px)',
            color: 'var(--text-primary)',
            lineHeight: 1.15,
            marginBottom: 16,
            letterSpacing: '-0.02em',
          }}>
            Built for everyone in the deal
          </h2>
          <p style={{ fontSize: 17, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            Whether you're renting out, moving in, or earning commission — ClearRent works for you.
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 48,
          background: 'var(--surface-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 6,
          width: 'fit-content',
          margin: '0 auto 48px',
          flexWrap: 'wrap',
          gap: 4,
        }}>
          {(['tenant', 'landlord', 'agent'] as UserType[]).map(type => (
            <button
              key={type}
              onClick={() => setActive(type)}
              style={{
                padding: '10px 24px',
                borderRadius: 12,
                border: 'none',
                fontFamily: 'Outfit',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: active === type ? 'var(--primary)' : 'transparent',
                color: active === type ? 'white' : 'var(--text-secondary)',
                boxShadow: active === type ? 'var(--shadow-primary)' : 'none',
                textTransform: 'capitalize',
              }}
            >
              {type === 'tenant' ? '🏡 Tenant' : type === 'landlord' ? '🏠 Landlord' : '👔 Agent'}
            </button>
          ))}
        </div>

        {/* Steps */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20,
        }}>
          {steps[active].map((step, i) => (
            <div key={step.title} className="card" style={{ padding: 28, position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: 20, right: 20,
                width: 28, height: 28,
                background: 'var(--surface-secondary)',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 13,
                color: 'var(--primary)',
                border: '1px solid var(--border)',
              }}>
                {i + 1}
              </div>
              <div style={{ fontSize: 32, marginBottom: 16 }}>{step.icon}</div>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 8 }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}