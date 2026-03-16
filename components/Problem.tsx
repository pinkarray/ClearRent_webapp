'use client'

'use client'

export default function Problem() {
  const problems = [
    {
      icon: '🎭',
      title: 'Fake Agents & Ghost Listings',
      description: 'You pay inspection fees to agents who disappear. Properties that "exist" only in WhatsApp forwards.',
    },
    {
      icon: '💸',
      title: 'Inflated Prices & Hidden Fees',
      description: 'Agents add commissions on top of commissions. The actual rent is never the first number you hear.',
    },
    {
      icon: '🔒',
      title: 'No Way to Verify Anyone',
      description: 'Is this actually the landlord\'s property? Is this tenant trustworthy? Nobody knows until it\'s too late.',
    },
  ]

  return (
    <section className="section" id="problem">
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <span className="verified-badge" style={{ marginBottom: 16, display: 'inline-flex' }}>
            The Problem
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
            Renting in Lagos is{' '}
            <span style={{ color: '#EF4444' }}>broken</span>
          </h2>
          <p style={{
            fontSize: 17,
            color: 'var(--text-secondary)',
            maxWidth: 520,
            margin: '0 auto',
            lineHeight: 1.7,
          }}>
            The Nigerian rental market costs tenants and landlords millions every year
            to fraud, bad agents, and zero accountability.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
          gap: 24,
          marginBottom: 64,
        }}>
          {problems.map((p) => (
            <div key={p.title} className="card" style={{ padding: 32 }}>
              <div style={{
                width: 56, height: 56,
                background: 'rgba(239,68,68,0.1)',
                borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28,
                marginBottom: 20,
              }}>
                {p.icon}
              </div>
              <h3 style={{
                fontWeight: 700, fontSize: 18,
                color: 'var(--text-primary)',
                marginBottom: 10,
              }}>
                {p.title}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>
                {p.description}
              </p>
            </div>
          ))}
        </div>

        {/* The shift */}
        <div style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
          borderRadius: 24,
          padding: 'clamp(32px, 5vw, 56px)',
          textAlign: 'center',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 70% 50%, rgba(255,255,255,0.05) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />
          <p style={{ fontSize: 13, opacity: 0.75, fontWeight: 600, letterSpacing: '0.1em', marginBottom: 12 }}>
            THE CLEARRENT DIFFERENCE
          </p>
          <h3 style={{
            fontFamily: 'Outfit',
            fontWeight: 800,
            fontSize: 'clamp(22px, 4vw, 36px)',
            lineHeight: 1.2,
            marginBottom: 16,
          }}>
            We verify first. Then we connect.
          </h3>
          <p style={{ opacity: 0.85, fontSize: 16, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            Every landlord, tenant, and agent on ClearRent is NIN-verified and document-screened
            before they can interact with anyone.
          </p>
        </div>
      </div>
    </section>
  )
}