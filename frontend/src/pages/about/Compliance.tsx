/**
 * LADRIS — Government Guidelines Compliance page
 * Route: /about/compliance
 */
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { useEffect } from 'react'

export default function Compliance() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const c = {
    bg: isDark ? '#060f1e' : '#f0f4f9',
    heading: isDark ? '#f0f6fc' : '#0a1d37',
    body: isDark ? '#94a9c9' : '#4a6280',
    label: isDark ? '#5a7194' : '#94a3b8',
    border: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    divider: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    navBg: isDark ? '#070c1b' : '#ffffff',
    navBorder: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
  }

  const capabilities = [
    {
      title: 'Transparent Risk Assessment',
      desc: 'Supports project-wise risk assessment using multiple project factors, providing a clear basis for administrative review.',
    },
    {
      title: 'Explainable Predictions',
      desc: 'Helps identify the factors contributing to predicted delay risk, supporting informed and accountable decision-making.',
    },
    {
      title: 'Role-Based Access',
      desc: 'Supports secure, role-based access for different stakeholders — central, state, district and LA officers — aligned to ministry hierarchy.',
    },
    {
      title: 'Audit Trails',
      desc: 'Supports comprehensive audit trails for system activity, supporting accountability and oversight across the platform.',
    },
    {
      title: 'Government Integration',
      desc: 'Provides APIs for integration with existing land acquisition systems and government databases, enabling data-driven governance.',
    },
    {
      title: 'GIS Monitoring',
      desc: 'Supports geographic visualization of high-risk projects across districts and states for spatial monitoring and reporting.',
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: c.bg, fontFamily: 'Inter, system-ui, sans-serif', color: c.heading }}>

      {/* Minimal page header */}
      <div style={{
        background: c.navBg,
        borderBottom: `1px solid ${c.navBorder}`,
        padding: '0 32px',
        height: 56,
        display: 'flex', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate('/landing')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.855rem', fontWeight: 500,
              color: isDark ? '#94a9c9' : '#334155',
              fontFamily: 'inherit', padding: '4px 0',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = isDark ? '#f0f6fc' : '#003366')}
            onMouseLeave={e => (e.currentTarget.style.color = isDark ? '#94a9c9' : '#334155')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back
          </button>
          <span style={{ color: c.divider }}>|</span>
          <span style={{ fontSize: '0.8rem', color: c.label }}>LADRIS</span>
        </div>
      </div>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '56px 24px 80px' }}>

        {/* Eyebrow + Heading */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: c.label, marginBottom: 10,
          }}>
            About LADRIS
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: c.heading, margin: '0 0 12px', lineHeight: 1.25 }}>
            Government Guidelines Compliance
          </h1>
          <p style={{ fontSize: '0.93rem', color: c.body, lineHeight: 1.7, maxWidth: 600, margin: 0 }}>
            Designed for accountable infrastructure governance.
          </p>
        </div>

        {/* Notice */}
        <div style={{
          padding: '14px 18px',
          border: `1px solid ${c.border}`,
          borderLeft: `3px solid ${isDark ? '#4a6280' : '#003366'}`,
          borderRadius: '0 6px 6px 0',
          background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
          marginBottom: 40,
          fontSize: '0.83rem',
          color: c.body,
          lineHeight: 1.65,
        }}>
          The capabilities described below are based on the proposed LADRIS system design.
          This page describes system capabilities and does not constitute official government certification or statutory compliance.
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${c.divider}`, margin: '0 0 40px' }} />

        {/* Capability list */}
        <section>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {capabilities.map((cap, i) => (
              <div key={cap.title} style={{
                padding: '22px 0',
                borderBottom: i < capabilities.length - 1 ? `1px solid ${c.divider}` : 'none',
                display: 'flex', gap: 20, alignItems: 'flex-start',
              }}>
                {/* Check mark */}
                <div style={{
                  width: 22, height: 22, flexShrink: 0,
                  border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1'}`,
                  borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 2,
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#5a7194' : '#64748b'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m20 6-11 11-5-5" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.93rem', fontWeight: 600, color: c.heading, marginBottom: 5 }}>
                    {cap.title}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: c.body, lineHeight: 1.7 }}>
                    {cap.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}
