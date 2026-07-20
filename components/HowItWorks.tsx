'use client'

import { useState } from 'react'

type UserType = 'landlord' | 'tenant' | 'agent'

const steps: Record<UserType, { icon: string; title: string; desc: string }[]> = {
  landlord: [
    { icon: '✅', title: 'Get Verified', desc: 'Submit your NIN and property documents. We confirm you\'re the legitimate owner before your listing goes live.' },
    { icon: '🏠', title: 'List Your Property', desc: 'Add real photos, transparent pricing, and a full cost breakdown — rent, agent fee, and caution deposit — so tenants know exactly what they\'re paying.' },
    { icon: '👔', title: 'Assign an Agent (Optional)', desc: 'Choose a verified agent to represent your property, or go direct. You\'re always in control of who manages your listing.' },
    { icon: '🤝', title: 'Close with Confidence', desc: 'Review tenant profiles, approve who you trust, and manage the tenancy — all on one platform.' },
  ],
  tenant: [
    { icon: '✅', title: 'Verify Your Identity', desc: 'Submit your NIN and income proof. Your verified profile becomes a trust signal that gets you faster approvals from landlords.' },
    { icon: '🔍', title: 'Browse Real Listings', desc: 'Every property is owner-verified with confirmed documents. No fake listings, no bait-and-switch, no ghost properties.' },
    { icon: '📅', title: 'Book a Transparent Inspection', desc: 'See the full inspection fee upfront. Get a verified agent or go direct with the landlord — your choice.' },
    { icon: '🏡', title: 'Move In, Stress-Free', desc: 'Know exactly who you\'re renting from, what you\'re paying, and have it all documented before you sign anything.' },
  ],
  agent: [
    { icon: '✅', title: 'Get Verified as an Agent', desc: 'Submit your NIN, guarantor details, and experience proof. Earn a verified badge that makes landlords trust you immediately.' },
    { icon: '🏘️', title: 'Discover Unassigned Properties', desc: 'Browse a live feed of landlord listings that don\'t yet have an agent. These are warm opportunities — landlords who need exactly what you offer.' },
    { icon: '💬', title: 'Pitch & Get Assigned', desc: 'Send a pitch directly to the landlord through the platform. Once they assign you, the property is yours to represent.' },
    { icon: '🎯', title: 'Find Matching Tenants', desc: 'Use our tenant discovery engine to identify tenants who match the property — by budget, income range, preferred area, and workplace proximity.' },
    { icon: '🤝', title: 'Facilitate the Deal', desc: 'Bring the right tenant to the right property. Conduct the inspection, close the deal, and earn your commission — all tracked on-platform.' },
    { icon: '⭐', title: 'Build Your Pipeline', desc: 'Every successful deal builds your rating and reputation. The better your track record, the more landlords come to you first.' },
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
          <p style={{ fontSize: 17, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
            Whether you're renting out, moving in, or building a real estate business —
            ClearRent gives you the tools to do it right.
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
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
              }}
            >
              {type === 'tenant' ? '🏡 Tenant' : type === 'landlord' ? '🏠 Landlord' : '👔 Agent'}
            </button>
          ))}
        </div>

        {/* Agent callout banner */}
        {active === 'agent' && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(10,123,108,0.08) 0%, rgba(244,168,54,0.08) 100%)',
            border: '1px solid rgba(10,123,108,0.2)',
            borderRadius: 16,
            padding: '16px 24px',
            marginBottom: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>💡</span>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
              <strong>ClearRent gives agents a structured pipeline.</strong> Instead of cold-hustling
              for clients, you discover warm landlord opportunities, pitch directly, get assigned,
              then use our matching engine to find the right tenant. Every step tracked. Every commission earned on-platform.
            </p>
          </div>
        )}

        {/* Steps */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: active === 'agent'
            ? 'repeat(auto-fit, minmax(280px, 1fr))'
            : 'repeat(auto-fit, minmax(220px, 1fr))',
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

        {/* Agent CTA */}
        {active === 'agent' && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <a href="#waitlist" className="btn-primary" style={{
              padding: '14px 36px',
              fontSize: 15,
              display: 'inline-block',
              textDecoration: 'none',
            }}>
              Join as a Verified Agent →
            </a>
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-hint)' }}>
              One-time ₦7,000 verification fee. Start earning immediately after approval.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}