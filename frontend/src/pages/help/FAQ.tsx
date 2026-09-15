/**
 * LADRIS — FAQ page
 * Route: /help/faq
 */
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { useEffect, useState } from 'react'

const FAQS = [
  {
    q: 'What is LADRIS?',
    a: 'LADRIS is an AI-powered system that helps identify land acquisition projects that may face delays. It provides predictive risk scores, identifies delay drivers, and supports administrators in taking early action.',
  },
  {
    q: 'Why is LADRIS needed?',
    a: 'Land acquisition can be delayed by approvals, compensation, legal disputes, documentation, rehabilitation and coordination issues. LADRIS helps identify these risks early, before they cause serious disruption to infrastructure projects.',
  },
  {
    q: 'How does LADRIS predict delays?',
    a: 'LADRIS analyzes historical and current project data to find patterns that may indicate a future delay. Machine learning models score each project based on multiple risk factors and identify which factors are contributing most.',
  },
  {
    q: 'What factors does LADRIS consider?',
    a: 'It considers factors such as project type, land area, affected families, compensation status, approval timelines, legal disputes, possession status, rehabilitation progress, stakeholder responsiveness and historical performance.',
  },
  {
    q: 'What is a project risk score?',
    a: 'A risk score shows how likely a project is to face delays. It helps administrators prioritize projects that need immediate attention. Scores are categorised as low, medium or high risk.',
  },
  {
    q: 'Can LADRIS explain why a project is at risk?',
    a: 'Yes. LADRIS identifies the key factors contributing to predicted delay risk, making the reason for the risk easier to understand. This supports more informed and accountable decision-making.',
  },
  {
    q: 'How does GIS help LADRIS?',
    a: 'GIS helps display high-risk projects on digital maps and makes it easier to view risk patterns across districts and states. Administrators can identify geographic clusters of delay risk for better spatial planning.',
  },
  {
    q: 'Who can use LADRIS?',
    a: 'LADRIS is designed to support land authorities, district and state administrations, ministries, implementing agencies and policy makers. Access is role-based, so each user sees information relevant to their level and jurisdiction.',
  },
  {
    q: 'Can LADRIS help prevent delays?',
    a: 'Yes. LADRIS provides predictive insights and recommendations that can help administrators take preventive action before delays become serious. Early identification allows teams to address issues proactively.',
  },
  {
    q: 'Does LADRIS improve over time?',
    a: 'Yes. The proposed system can use newly available project data to continuously improve prediction accuracy. As more project outcomes are recorded, the models can learn from real-world results.',
  },
  {
    q: 'Can LADRIS send alerts?',
    a: 'Yes. The proposed system includes automated alerts for high-risk projects so administrators can respond early. Alerts are triggered when a project crosses a risk threshold or when stage timelines are exceeded.',
  },
  {
    q: 'What is the main goal of LADRIS?',
    a: 'The goal is to move land acquisition monitoring from reactive reporting to predictive decision-making. By identifying risk early, LADRIS supports faster, better-informed administrative action.',
  },
]

export default function FAQ() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const toggle = (i: number) => {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const c = {
    bg: isDark ? '#060f1e' : '#f0f4f9',
    heading: isDark ? '#f0f6fc' : '#0a1d37',
    body: isDark ? '#94a9c9' : '#4a6280',
    label: isDark ? '#5a7194' : '#94a3b8',
    divider: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    navBg: isDark ? '#070c1b' : '#ffffff',
    navBorder: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    rowHover: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,51,102,0.02)',
  }

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

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px 80px' }}>

        {/* Heading */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: c.label, marginBottom: 10,
          }}>
            Help & Feedback
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: c.heading, margin: '0 0 10px', lineHeight: 1.25 }}>
            Frequently Asked Questions
          </h1>
          <p style={{ fontSize: '0.93rem', color: c.body, lineHeight: 1.7, margin: 0 }}>
            Clear answers. No guesswork.
          </p>
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${c.divider}`, margin: '0 0 8px' }} />

        {/* Accordion */}
        <div>
          {FAQS.map((item, i) => {
            const isOpen = openItems.has(i)
            return (
              <div key={i} style={{ borderBottom: `1px solid ${c.divider}` }}>
                <button
                  onClick={() => toggle(i)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(i) } }}
                  aria-expanded={isOpen}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 16,
                    padding: '18px 4px',
                    background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = c.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{
                    fontSize: '0.9rem', fontWeight: isOpen ? 600 : 500,
                    color: isOpen ? (isDark ? '#f0f6fc' : '#003366') : c.heading,
                    lineHeight: 1.5, flex: 1,
                    transition: 'color 0.15s',
                  }}>
                    {item.q}
                  </span>
                  {/* Chevron icon */}
                  <span style={{
                    flexShrink: 0,
                    display: 'flex', alignItems: 'center',
                    color: c.label,
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </button>

                {/* Answer — CSS height transition via max-height trick */}
                <div style={{
                  overflow: 'hidden',
                  maxHeight: isOpen ? '500px' : '0',
                  transition: 'max-height 0.28s ease',
                }}>
                  <div style={{
                    padding: '0 4px 20px',
                    fontSize: '0.875rem', color: c.body,
                    lineHeight: 1.75,
                  }}>
                    {item.a}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

      </main>
    </div>
  )
}
