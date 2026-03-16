'use client'

import { useState, useEffect } from 'react'
import { useTheme } from './ThemeProvider'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const cycleTheme = () => {
    const order: Array<typeof theme> = ['light', 'dark', 'system']
    const next = order[(order.indexOf(theme) + 1) % order.length]
    setTheme(next)
  }

  const themeIcon = theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '⚙️'

  const navLinks = [
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'For Landlords', href: '#landlords' },
    { label: 'For Tenants', href: '#tenants' },
    { label: 'For Agents', href: '#agents' },
    { label: 'Pricing', href: '#pricing' },
  ]

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        transition: 'all 0.3s ease',
        background: scrolled ? 'var(--surface)' : 'transparent',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
      }}
    >
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
        {/* Logo */}
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--primary)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-primary)',
          }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: 16, fontFamily: 'Outfit' }}>C</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
            Clear<span style={{ color: 'var(--primary)' }}>Rent</span>
          </span>
        </a>

        {/* Desktop nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="desktop-nav">
          {navLinks.map(link => (
            <a key={link.href} href={link.href} style={{
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              transition: 'color 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={cycleTheme} title={`Theme: ${theme}`} style={{
            background: 'var(--surface-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            width: 36, height: 36,
            cursor: 'pointer',
            fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}>
            {themeIcon}
          </button>

          <a href="#waitlist" className="btn-primary" style={{
            padding: '8px 20px',
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-block',
          }}>
            Get Early Access
          </a>

          {/* Mobile menu toggle */}
          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-primary)', fontSize: 20,
            display: 'none',
          }} className="mobile-menu-btn">
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {navLinks.map(link => (
            <a key={link.href} href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: 16, fontWeight: 500 }}>
              {link.label}
            </a>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </nav>
  )
}