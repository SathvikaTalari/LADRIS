/**
 * LADRIS — Privacy Policy page
 * Route: /help/privacy
 */
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { useEffect } from 'react'

export default function Privacy() {
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
    divider: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    navBg: isDark ? '#070c1b' : '#ffffff',
    navBorder: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
  }

  const sections = [
    {
      title: 'Information We Handle',
      body: 'Information provided while using the platform may be used to support platform functionality. This includes user interaction data, project-related inputs, and system usage patterns relevant to platform operation.',
    },
    {
      title: 'Purpose',
      body: 'Information is used to provide platform features, support user interaction, and improve system operation. Data is not used for purposes outside the scope of the LADRIS platform.',
    },
    {
      title: 'Security',
      body: 'Access to the platform should be protected through appropriate security controls and role-based access. Users are responsible for maintaining the confidentiality of their credentials.',
    },
    {
      title: 'Responsible Access',
      body: 'Users should access only the information and functions relevant to their assigned role. Attempting to access information or functions outside your role is not permitted.',
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
              fontFamily: 'inherit', padding: '4px 0', transition: 'color 0.15s',
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

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '56px 24px 80px' }}>

        {/* Heading */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: c.label, marginBottom: 10,
          }}>
            Help & Feedback
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: c.heading, margin: '0 0 12px', lineHeight: 1.25 }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: '0.875rem', color: c.label, margin: 0 }}>
            Last reviewed: September 2026
          </p>
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${c.divider}`, margin: '0 0 44px' }} />

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {sections.map((s, i) => (
            <div key={s.title} style={{
              padding: '24px 0',
              borderBottom: i < sections.length - 1 ? `1px solid ${c.divider}` : 'none',
            }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: c.heading, margin: '0 0 10px' }}>
                {s.title}
              </h2>
              <p style={{ fontSize: '0.885rem', color: c.body, lineHeight: 1.75, margin: 0 }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, padding: '16px 20px', background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', border: `1px solid ${c.divider}`, borderRadius: 6, fontSize: '0.8rem', color: c.label, lineHeight: 1.6 }}>
          This privacy policy applies to the LADRIS platform as a proposed system. For questions, use the Contact & Feedback page.
        </div>

      </main>
    </div>
  )
}
