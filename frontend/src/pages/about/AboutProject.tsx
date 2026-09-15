/**
 * LADRIS — About the Project page
 * Route: /about/project
 */
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { useEffect } from 'react'

export default function AboutProject() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const c = {
    bg: isDark ? '#060f1e' : '#f0f4f9',
    surface: isDark ? '#0d1a2e' : '#ffffff',
    border: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    heading: isDark ? '#f0f6fc' : '#0a1d37',
    body: isDark ? '#94a9c9' : '#4a6280',
    label: isDark ? '#5a7194' : '#94a3b8',
    accent: '#003366',
    divider: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    navBg: isDark ? '#070c1b' : '#ffffff',
    navBorder: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
  }

  const steps = [
    { n: '01', title: 'Project Data', desc: 'Historical and current land acquisition project data is collected.' },
    { n: '02', title: 'AI / ML Analysis', desc: 'Machine learning models analyse patterns across project factors.' },
    { n: '03', title: 'Risk Assessment', desc: 'A project-wise risk score is generated for each project.' },
    { n: '04', title: 'Delay Drivers', desc: 'Key factors contributing to predicted delay risk are identified.' },
    { n: '05', title: 'Preventive Action', desc: 'Recommendations support administrators in taking early action.' },
  ]

  const whyFactors = [
    'Approvals', 'Compensation', 'Legal Disputes',
    'Documentation', 'Rehabilitation', 'Coordination',
  ]

  const provides = [
    { verb: 'Predict', desc: 'Forecast potential delays before they occur.' },
    { verb: 'Assess', desc: 'Generate project-wise risk levels for prioritisation.' },
    { verb: 'Explain', desc: 'Identify key delay drivers behind predicted risk.' },
    { verb: 'Act', desc: 'Support preventive intervention with actionable recommendations.' },
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

      {/* Page content */}
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '56px 24px 80px' }}>

        {/* Eyebrow + Heading */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: c.label, marginBottom: 10,
          }}>
            About LADRIS
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: c.heading, margin: '0 0 8px', lineHeight: 1.25 }}>
            About the Project
          </h1>
          <p style={{ fontSize: '1.05rem', fontWeight: 500, color: isDark ? '#c9d8f0' : '#003366', margin: '0 0 16px', lineHeight: 1.5 }}>
            Predict Before Delay.
          </p>
          <p style={{ fontSize: '0.93rem', color: c.body, lineHeight: 1.7, maxWidth: 640, margin: 0 }}>
            LADRIS is an AI-powered predictive analytics system designed to identify land acquisition projects
            that may be at risk of delay. It supports administrators in taking preventive action early, before
            delays become serious.
          </p>
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${c.divider}`, margin: '0 0 48px' }} />

        {/* Project Flow */}
        <section style={{ marginBottom: 52 }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: c.heading, margin: '0 0 28px' }}>
            How It Works
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {steps.map((step, i) => (
              <div key={step.n} style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
                {/* Step number + connector */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 48, flexShrink: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.18)' : '#cbd5e1'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700, color: isDark ? '#5a7194' : '#94a3b8',
                    flexShrink: 0, background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                  }}>
                    {step.n}
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{ width: 1, flex: 1, minHeight: 24, background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0', margin: '4px 0' }} />
                  )}
                </div>
                {/* Content */}
                <div style={{ paddingLeft: 16, paddingBottom: i < steps.length - 1 ? 20 : 0, paddingTop: 4 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: c.heading, marginBottom: 3 }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: '0.83rem', color: c.body, lineHeight: 1.6 }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <hr style={{ border: 'none', borderTop: `1px solid ${c.divider}`, margin: '0 0 48px' }} />

        {/* Why LADRIS */}
        <section style={{ marginBottom: 52 }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: c.heading, margin: '0 0 14px' }}>
            Why LADRIS?
          </h2>
          <p style={{ fontSize: '0.9rem', color: c.body, lineHeight: 1.7, margin: '0 0 24px', maxWidth: 620 }}>
            Land acquisition delays can affect infrastructure projects and may arise from approvals, compensation,
            legal disputes, documentation, rehabilitation and coordination challenges. LADRIS helps identify
            these risks early, before they cause serious disruption.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px 16px' }}>
            {whyFactors.map(f => (
              <div key={f} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px',
                border: `1px solid ${c.border}`,
                borderRadius: 6,
                background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#003366', flexShrink: 0 }} />
                <span style={{ fontSize: '0.84rem', fontWeight: 500, color: c.heading }}>{f}</span>
              </div>
            ))}
          </div>
        </section>

        <hr style={{ border: 'none', borderTop: `1px solid ${c.divider}`, margin: '0 0 48px' }} />

        {/* What LADRIS Provides */}
        <section style={{ marginBottom: 52 }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: c.heading, margin: '0 0 24px' }}>
            What LADRIS Provides
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {provides.map((p, i) => (
              <div key={p.verb} style={{
                display: 'flex', gap: 20, alignItems: 'flex-start',
                padding: '16px 0',
                borderBottom: i < provides.length - 1 ? `1px solid ${c.divider}` : 'none',
              }}>
                <div style={{
                  width: 80, flexShrink: 0,
                  fontSize: '0.78rem', fontWeight: 700,
                  color: isDark ? '#c9d8f0' : '#003366',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  paddingTop: 2,
                }}>
                  {p.verb}
                </div>
                <div style={{ fontSize: '0.88rem', color: c.body, lineHeight: 1.65 }}>
                  {p.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        <hr style={{ border: 'none', borderTop: `1px solid ${c.divider}`, margin: '0 0 48px' }} />

        {/* Closing statement */}
        <section style={{ textAlign: 'center', padding: '8px 0 16px' }}>
          <div style={{
            fontSize: '0.8rem', fontWeight: 600, color: c.label,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16,
          }}>
            The Goal
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 600, color: c.heading, lineHeight: 1.5, marginBottom: 6 }}>
            From Reactive Monitoring
          </div>
          <div style={{ fontSize: '0.9rem', color: c.body, marginBottom: 6 }}>to</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 600, color: c.heading, lineHeight: 1.5, marginBottom: 24 }}>
            Predictive Decision-Making
          </div>
          <div style={{
            display: 'inline-block',
            padding: '10px 28px',
            border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1'}`,
            borderRadius: 6,
            fontSize: '0.88rem', fontWeight: 600,
            color: isDark ? '#c9d8f0' : '#003366',
            letterSpacing: '0.04em',
          }}>
            See Risk. Act Early.
          </div>
        </section>

      </main>
    </div>
  )
}
