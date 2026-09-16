/**
 * LADRIS — User Guide page
 * Route: /about/user-guide
 */
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { useEffect } from 'react'

export default function UserGuide() {
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
    stepBg: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
  }

  const steps = [
    {
      n: '01',
      title: 'Select a Project',
      desc: 'Choose a project from the project list to review its current risk information.',
    },
    {
      n: '02',
      title: 'Review Risk',
      desc: 'Check the project\'s predicted delay risk score and risk category — low, medium or high.',
    },
    {
      n: '03',
      title: 'Understand the Cause',
      desc: 'Review the factors contributing to the predicted risk, such as approval delays, legal disputes or compensation issues.',
    },
    {
      n: '04',
      title: 'View Location',
      desc: 'Use GIS insights to understand where high-risk projects are located geographically across districts and states.',
    },
    {
      n: '05',
      title: 'Take Action',
      desc: 'Use predictive recommendations to support preventive action before delays become serious.',
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
            User Guide
          </h1>
          <p style={{ fontSize: '0.93rem', color: c.body, lineHeight: 1.7, maxWidth: 580, margin: 0 }}>
            Understand the risk. Follow the signal. Act early.
          </p>
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${c.divider}`, margin: '0 0 44px' }} />

        {/* Numbered workflow */}
        <section style={{ marginBottom: 52 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {steps.map((step, i) => (
              <div key={step.n} style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
                {/* Number + connector */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 56, flexShrink: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: `1.5px solid ${isDark ? 'rgba(0,51,102,0.6)' : '#003366'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.72rem', fontWeight: 700,
                    color: isDark ? '#94a9c9' : '#003366',
                    background: isDark ? 'rgba(0,51,102,0.12)' : 'rgba(0,51,102,0.06)',
                    flexShrink: 0,
                  }}>
                    {step.n}
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{
                      width: 1, flex: 1, minHeight: 20,
                      background: isDark ? 'rgba(0,51,102,0.3)' : 'rgba(0,51,102,0.15)',
                      margin: '6px 0',
                    }} />
                  )}
                </div>
                {/* Content */}
                <div style={{
                  flex: 1,
                  paddingLeft: 20,
                  paddingBottom: i < steps.length - 1 ? 28 : 0,
                  paddingTop: 6,
                }}>
                  <div style={{
                    fontSize: '0.93rem', fontWeight: 600, color: c.heading,
                    marginBottom: 6,
                  }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: c.body, lineHeight: 1.7 }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <hr style={{ border: 'none', borderTop: `1px solid ${c.divider}`, margin: '0 0 44px' }} />

        {/* Tips box */}
        <section style={{ marginBottom: 52 }}>
          <h2 style={{ fontSize: '1.0rem', fontWeight: 700, color: c.heading, margin: '0 0 16px' }}>
            Tips for Using LADRIS
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Review high-risk projects first — they need the most immediate attention.',
              'Use GIS views to spot risk clusters across districts.',
              'Check delay driver details to understand which specific factor is contributing most.',
              'Alerts will notify you when a project crosses a risk threshold — respond early.',
            ].map((tip, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '12px 16px',
                background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                border: `1px solid ${c.border}`,
                borderRadius: 6,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  background: isDark ? 'rgba(0,51,102,0.3)' : 'rgba(0,51,102,0.08)',
                  border: `1px solid ${isDark ? 'rgba(0,51,102,0.5)' : 'rgba(0,51,102,0.2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.65rem', fontWeight: 700,
                  color: isDark ? '#94a9c9' : '#003366',
                }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: '0.875rem', color: c.body, lineHeight: 1.65 }}>{tip}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Back to LADRIS button */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => navigate('/landing')}
            style={{
              padding: '10px 28px',
              background: '#003366',
              border: 'none', borderRadius: 6,
              color: '#ffffff', fontWeight: 700,
              fontSize: '0.875rem', cursor: 'pointer',
              fontFamily: 'inherit', letterSpacing: '0.02em',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#002244')}
            onMouseLeave={e => (e.currentTarget.style.background = '#003366')}
          >
            Back to LADRIS
          </button>
        </div>

      </main>
    </div>
  )
}
