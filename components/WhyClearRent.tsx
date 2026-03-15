'use client'

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

export default function WhyClearRent() {
  return (
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
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
  )
}