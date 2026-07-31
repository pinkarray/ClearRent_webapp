'use client'

import { useState, useEffect } from 'react'
import { useTheme } from './ThemeProvider'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Close menu on resize to desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth > 768) setMenuOpen(false) }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const cycleTheme = () => {
    const order: Array<typeof theme> = ['light', 'dark', 'system']
    const next = order[(order.indexOf(theme) + 1) % order.length]
    setTheme(next)
  }

  const themeIcon = theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '⚙️'

  // 'Browse' is a real route; the rest are anchors on this page. The navbar is
  // only rendered on the homepage, so the anchors always have a target.
  const navLinks = [
    { label: 'Browse', href: '/properties' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'For Agents', href: '#agents' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Join Waitlist', href: '#waitlist' },
  ]

  return (
    <nav style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 100,
      transition: 'all 0.3s ease',
      background: scrolled ? 'var(--surface)' : 'transparent',
      borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
      boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>

        {/* Logo */}
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <img
            src="/logos/clearrent_mark_color.svg"
            alt="ClearRent"
            style={{ width: 34, height: 34, objectFit: 'contain', flexShrink: 0 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--secondary)', fontFamily: 'Outfit' }}>
              Clear<span style={{ color: 'var(--primary)' }}>Rent</span>
            </span>
            <span style={{ fontSize: 9, color: 'var(--text-hint)', fontWeight: 500, letterSpacing: '0.02em' }}>
              by Verealty Technologies
            </span>
          </div>
        </a>

        {/* Desktop nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }} className="desktop-nav">
          {navLinks.slice(0, 4).map(link => (
            <a key={link.href} href={link.href} style={{
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              transition: 'color 0.2s',
              whiteSpace: 'nowrap',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={cycleTheme} title={`Theme: ${theme}`} style={{
            background: 'var(--surface-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            width: 34, height: 34,
            cursor: 'pointer',
            fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}>
            {themeIcon}
          </button>

          <a href="/login" className="desktop-cta" style={{
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            transition: 'color 0.2s',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            Log in
          </a>

          <a href="#waitlist" className="btn-primary desktop-cta" style={{
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-block',
            whiteSpace: 'nowrap',
          }}>
            Get Early Access
          </a>

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="mobile-menu-btn"
            style={{
              background: 'var(--surface-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              width: 34, height: 34,
              cursor: 'pointer',
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: 'var(--text-primary)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: menuOpen ? 0 : 4, alignItems: 'center', justifyContent: 'center', width: 18, height: 18 }}>
              <span style={{
                display: 'block', width: 16, height: 2,
                background: 'var(--text-primary)', borderRadius: 2,
                transition: 'all 0.25s',
                transform: menuOpen ? 'rotate(45deg) translate(0, 0)' : 'none',
                transformOrigin: 'center',
              }} />
              <span style={{
                display: 'block', width: 16, height: 2,
                background: 'var(--text-primary)', borderRadius: 2,
                transition: 'all 0.25s',
                opacity: menuOpen ? 0 : 1,
              }} />
              <span style={{
                display: 'block', width: 16, height: 2,
                background: 'var(--text-primary)', borderRadius: 2,
                transition: 'all 0.25s',
                transform: menuOpen ? 'rotate(-45deg) translate(0, 0)' : 'none',
                transformOrigin: 'center',
              }} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        padding: menuOpen ? '20px 24px 24px' : '0 24px',
        maxHeight: menuOpen ? 400 : 0,
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        {navLinks.map(link => (
          <a key={link.href} href={link.href}
            onClick={() => setMenuOpen(false)}
            style={{
              color: 'var(--text-primary)',
              textDecoration: 'none',
              fontSize: 16,
              fontWeight: 500,
              padding: '10px 0',
              borderBottom: '1px solid var(--divider)',
              display: 'block',
            }}>
            {link.label}
          </a>
        ))}
        <a href="/login" onClick={() => setMenuOpen(false)} style={{
          color: 'var(--text-primary)',
          textDecoration: 'none',
          fontSize: 16,
          fontWeight: 500,
          padding: '10px 0',
          borderBottom: '1px solid var(--divider)',
          display: 'block',
        }}>
          Log in
        </a>

        <a href="#waitlist" onClick={() => setMenuOpen(false)} className="btn-amber" style={{
          marginTop: 16,
          padding: '13px 24px',
          fontSize: 15,
          textDecoration: 'none',
          display: 'block',
          textAlign: 'center',
        }}>
          Get Early Access →
        </a>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .desktop-cta { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </nav>
  )
}