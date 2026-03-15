'use client'

const plans = [
  {
    type: 'tenant',
    label: 'Tenant',
    icon: '🏡',
    price: '₦5,000',
    period: 'one-time',
    description: 'Everything you need to find and secure a verified property.',
    features: [
      'NIN identity verification',
      'Access to all verified listings',
      'Direct landlord messaging',
      'Inspection booking system',
      'Tenancy agreement access',
      'Issue reporting & tracking',
    ],
    cta: 'Get Verified as Tenant',
    highlight: false,
  },
  {
    type: 'landlord',
    label: 'Landlord',
    icon: '🏠',
    price: '₦15,000',
    period: 'one-time verification',
    description: 'List your property and connect with serious, verified tenants.',
    features: [
      'NIN + property document verification',
      'Property listing (first free)',
      'Additional listings at flat fee',
      'Verified tenant pool access',
      'Inspection management',
      'Direct tenant communication',
    ],
    cta: 'List Your Property',
    highlight: true,
  },
  {
    type: 'agent',
    label: 'Agent',
    icon: '👔',
    price: '₦10,000',
    period: 'one-time',
    description: 'Earn commission on inspections with full platform support.',
    features: [
      'Full identity + guarantor verification',
      'Property discovery dashboard',
      'Inspection assignment system',
      'Commission paid via platform',
      'Tenant discovery & matching',
      'Verified agent badge',
    ],
    cta: 'Join as Agent',
    highlight: false,
  },
]

export default function Pricing() {
  return (
    <section className="section" id="pricing" style={{ background: 'var(--bg-secondary)' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <span className="verified-badge" style={{ marginBottom: 16, display: 'inline-flex' }}>
            Simple Pricing
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
            Pay once. Access everything.
          </h2>
          <p style={{ fontSize: 17, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            Verification is a one-time fee. No subscriptions, no hidden charges, no commissions on your rent.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
          alignItems: 'start',
        }}>
          {plans.map(plan => (
            <div
              key={plan.type}
              style={{
                background: plan.highlight ? 'var(--primary)' : 'var(--surface)',
                border: plan.highlight ? 'none' : '1px solid var(--border)',
                borderRadius: 24,
                padding: 32,
                boxShadow: plan.highlight ? 'var(--shadow-primary)' : 'var(--shadow-sm)',
                color: plan.highlight ? 'white' : 'var(--text-primary)',
                position: 'relative',
                transform: plan.highlight ? 'scale(1.03)' : 'scale(1)',
                transition: 'transform 0.2s ease',
              }}
            >
              {plan.highlight && (
                <div style={{
                  position: 'absolute',
                  top: -12, left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--secondary)',
                  color: '#1A1A2E',
                  borderRadius: 100,
                  padding: '4px 16px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                }}>
                  MOST POPULAR
                </div>
              )}

              <div style={{ fontSize: 32, marginBottom: 16 }}>{plan.icon}</div>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                opacity: plan.highlight ? 0.8 : undefined,
                color: plan.highlight ? 'white' : 'var(--text-secondary)',
                marginBottom: 8,
                letterSpacing: '0.05em',
              }}>
                {plan.label.toUpperCase()}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 36 }}>{plan.price}</span>
                <span style={{ fontSize: 13, opacity: 0.7 }}>{plan.period}</span>
              </div>
              <p style={{
                fontSize: 14,
                opacity: plan.highlight ? 0.85 : undefined,
                color: plan.highlight ? 'white' : 'var(--text-secondary)',
                marginBottom: 24,
                lineHeight: 1.6,
              }}>
                {plan.description}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      background: plan.highlight ? 'rgba(255,255,255,0.2)' : 'rgba(10,123,108,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11,
                      color: plan.highlight ? 'white' : 'var(--primary)',
                      fontWeight: 700,
                    }}>
                      ✓
                    </div>
                    <span style={{ opacity: plan.highlight ? 0.9 : undefined, color: plan.highlight ? 'white' : 'var(--text-primary)' }}>
                      {f}
                    </span>
                  </div>
                ))}
              </div>

              <a
                href="#waitlist"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '12px 24px',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: 'none',
                  background: plan.highlight ? 'white' : 'transparent',
                  color: plan.highlight ? 'var(--primary)' : 'var(--primary)',
                  border: plan.highlight ? 'none' : '1.5px solid var(--primary)',
                  transition: 'all 0.2s',
                }}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: 'var(--text-hint)' }}>
          Inspection fees are separate and transparent — you see exactly what you pay before booking.
        </p>
      </div>
    </section>
  )
}