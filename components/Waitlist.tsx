'use client'

import { useState } from 'react'

type UserType = 'tenant' | 'landlord' | 'agent' | ''

export default function Waitlist() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [userType, setUserType] = useState<UserType>('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name || !email || !userType) {
      setError('Please fill in your name, email, and account type.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Store in Firebase via API route
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, userType, joinedAt: new Date().toISOString() }),
      })

      if (res.ok) {
        setSuccess(true)
        setName(''); setEmail(''); setPhone(''); setUserType('')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="section mesh-bg" id="waitlist">
      <div className="container">
        <div style={{
          maxWidth: 600,
          margin: '0 auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 28,
          padding: 'clamp(32px, 5vw, 56px)',
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'center',
        }}>
          {success ? (
            <div style={{ padding: '20px 0' }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
              <h3 style={{
                fontFamily: 'Outfit', fontWeight: 800, fontSize: 28,
                color: 'var(--text-primary)', marginBottom: 12,
              }}>
                You&apos;re on the list!
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.7 }}>
                We&apos;ll notify you as soon as ClearRent opens in your area. Tell a friend - the more verified
                users, the better the platform for everyone.
              </p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 32 }}>
                <span className="verified-badge" style={{ marginBottom: 16, display: 'inline-flex' }}>
                  🚀 Early Access
                </span>
                <h2 style={{
                  fontFamily: 'Outfit',
                  fontWeight: 800,
                  fontSize: 'clamp(24px, 4vw, 36px)',
                  color: 'var(--text-primary)',
                  lineHeight: 1.2,
                  marginBottom: 12,
                  letterSpacing: '-0.02em',
                }}>
                  Be first when we launch
                </h2>
                <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  ClearRent is launching in Lagos soon. Join the waitlist and get priority access.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
                {/* User type */}
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                    I am a *
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['tenant', 'landlord', 'agent'] as UserType[]).map(type => (
                      <button
                        key={type}
                        onClick={() => setUserType(type)}
                        style={{
                          padding: '8px 20px',
                          borderRadius: 10,
                          border: `1.5px solid ${userType === type ? 'var(--primary)' : 'var(--border)'}`,
                          background: userType === type ? 'rgba(10,123,108,0.1)' : 'var(--surface)',
                          color: userType === type ? 'var(--primary)' : 'var(--text-secondary)',
                          fontFamily: 'Outfit',
                          fontWeight: 600,
                          fontSize: 14,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textTransform: 'capitalize',
                        }}
                      >
                        {type === 'tenant' ? '🏡' : type === 'landlord' ? '🏠' : '👔'} {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                    Full Name *
                  </label>
                  <input
                    className="input-field"
                    placeholder="John Doe"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{ padding: '12px 16px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                    Email Address *
                  </label>
                  <input
                    className="input-field"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{ padding: '12px 16px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                    Phone Number <span style={{ fontWeight: 400, color: 'var(--text-hint)' }}>(optional)</span>
                  </label>
                  <input
                    className="input-field"
                    placeholder="0801 234 5678"
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={{ padding: '12px 16px' }}
                  />
                </div>

                {error && (
                  <div style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontSize: 13,
                    color: '#EF4444',
                  }}>
                    {error}
                  </div>
                )}

                <button
                  className="btn-amber"
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    padding: '14px 32px',
                    fontSize: 16,
                    marginTop: 4,
                    opacity: loading ? 0.7 : 1,
                    width: '100%',
                  }}
                >
                  {loading ? 'Joining...' : 'Join the Waitlist →'}
                </button>

                <p style={{ fontSize: 12, color: 'var(--text-hint)', textAlign: 'center' }}>
                  No spam. Just a heads-up when we launch. 🔒
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}