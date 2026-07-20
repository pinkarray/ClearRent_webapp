'use client'

const features = [
  {
    icon: '🔐',
    title: 'NIN-Based Identity Verification',
    desc: 'Every user — landlord, tenant, or agent — is verified against their National Identification Number before they can interact with anyone.',
  },
  {
    icon: '🧾',
    title: 'Transparent Total Pricing',
    desc: 'See rent + agent fee + caution deposit in one clear breakdown. No surprises when you show up for inspection.',
  },
  {
    icon: '📞',
    title: 'Direct Landlord Communication',
    desc: 'Chat directly with property owners. Agents are optional — you\'re never forced through a middleman who inflates your costs.',
  },
  {
    icon: '📋',
    title: 'Ownership Document Verification',
    desc: 'Landlords must upload and pass property document review before their listings go live. You only see real properties.',
  },
  {
    icon: '🔍',
    title: 'Structured Inspection System',
    desc: 'Inspections are booked, tracked, and receipted on-platform. No more paying cash to strangers who vanish.',
  },
  {
    icon: '🏅',
    title: 'Accountability for Everyone',
    desc: 'Ratings, verified badges, and activity history build a trust layer the Nigerian rental market has never had.',
  },
]

const agentAdvantages = [
  {
    icon: '📡',
    title: 'Live Property Pipeline',
    desc: 'See every unassigned property in real time. No more cold-calling or relying on word of mouth to find landlords who need you.',
  },
  {
    icon: '🎯',
    title: 'Tenant Matching Engine',
    desc: 'Our algorithm scores tenants 0–100 against each property based on budget fit, income range, preferred areas, and workplace proximity. You\'re always pitching the right person.',
  },
  {
    icon: '💬',
    title: 'Direct Landlord Pitching',
    desc: 'Send a pitch to any landlord with an unassigned property. No gatekeepers, no agency politics — just you and the opportunity.',
  },
  {
    icon: '💰',
    title: 'Transparent Commission',
    desc: 'Your fee is agreed upfront and shown to tenants as part of the total package. No awkward negotiations — you get paid on-platform after the deal closes.',
  },
]

export default function WhyClearRent() {
  return (
    <>
      {/* Platform features */}
      <section className="section" id="why" style={{ background: 'var(--bg)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span className="verified-badge" style={{ marginBottom: 16, display: 'inline-flex' }}>
              Why ClearRent
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
              Trust built into every step
            </h2>
            <p style={{ fontSize: 17, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
              We didn't just build an app. We rebuilt the rental process from the ground up
              for the Nigerian market.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
            gap: 24,
          }}>
            {features.map((f, i) => (
              <div key={f.title} className="card" style={{ padding: 32, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{
                  width: 52, height: 52, flexShrink: 0,
                  background: i % 2 === 0 ? 'rgba(10,123,108,0.1)' : 'rgba(244,168,54,0.1)',
                  borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26,
                  border: `1px solid ${i % 2 === 0 ? 'rgba(10,123,108,0.15)' : 'rgba(244,168,54,0.15)'}`,
                }}>
                  {f.icon}
                </div>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 8 }}>
                    {f.title}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dedicated Agent section */}
      <section className="section" id="agents" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(440px, 100%), 1fr))',
            gap: 64,
            alignItems: 'center',
          }}>
            {/* Left — copy */}
            <div>
              <span className="verified-badge" style={{ marginBottom: 20, display: 'inline-flex' }}>
                👔 For Agents
              </span>
              <h2 style={{
                fontFamily: 'Outfit',
                fontWeight: 800,
                fontSize: 'clamp(26px, 4vw, 42px)',
                color: 'var(--text-primary)',
                lineHeight: 1.15,
                marginBottom: 20,
                letterSpacing: '-0.02em',
              }}>
                Stop hustling cold leads.
                <span style={{ display: 'block', color: 'var(--primary)' }}>
                  Start working warm ones.
                </span>
              </h2>
              <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 28 }}>
                ClearRent gives verified agents something the market never had — a structured pipeline.
                Discover properties that need you, pitch landlords directly, then use our matching engine
                to find tenants who fit perfectly. Every deal tracked. Every commission paid on-platform.
              </p>

              {/* Mini flow */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                {[
                  { step: 'Discover', label: 'Browse unassigned properties in your areas' },
                  { step: 'Pitch', label: 'Message the landlord directly on ClearRent' },
                  { step: 'Match', label: 'Find tenants scored against the property' },
                  { step: 'Close', label: 'Facilitate the deal and earn your commission' },
                ].map((item, i) => (
                  <div key={item.step} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      width: 36, height: 36, flexShrink: 0,
                      background: 'var(--primary)',
                      borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white',
                      fontWeight: 800,
                      fontSize: 12,
                    }}>
                      {i + 1}
                    </div>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                        {item.step}
                      </span>
                      <span style={{ fontSize: 14, color: 'var(--text-secondary)', marginLeft: 8 }}>
                        — {item.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <a href="#waitlist" className="btn-primary" style={{
                padding: '14px 32px',
                fontSize: 15,
                display: 'inline-block',
                textDecoration: 'none',
              }}>
                Join as a Verified Agent →
              </a>
              <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-hint)' }}>
                ₦7,000 one-time verification · Start earning after approval
              </p>
            </div>

            {/* Right — advantage cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {agentAdvantages.map((a) => (
                <div key={a.title} className="card" style={{
                  padding: '20px 24px',
                  display: 'flex',
                  gap: 16,
                  alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 44, height: 44, flexShrink: 0,
                    background: 'rgba(10,123,108,0.1)',
                    borderRadius: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22,
                    border: '1px solid rgba(10,123,108,0.15)',
                  }}>
                    {a.icon}
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>
                      {a.title}
                    </h4>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {a.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}