/**
 * LADRIS — Case Studies
 * Route: /documents/case-studies
 */
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { useEffect, useState } from 'react'

// Label constants
const ILLUSTRATIVE = 'ILLUSTRATIVE LADRIS SCENARIO'

const CASES = [
  {
    tag: ILLUSTRATIVE,
    sector: 'Highway Land Acquisition',
    situation:
      'A national highway expansion project requires land from multiple districts. Ownership disputes and incomplete records in two districts create uncertainty about affected parcels.',
    riskSignal:
      'SIA stage duration exceeds expected threshold. Legal dispute count rises. Compensation award pending for a high number of plots.',
    response:
      'LADRIS flags the project as High Risk. The district officer receives an automated alert. The dashboard surfaces the specific delay drivers — pending legal clearances and unpaid awards — supporting targeted administrative action.',
  },
  {
    tag: ILLUSTRATIVE,
    sector: 'Railway Corridor Expansion',
    situation:
      'A new railway line requires land acquisition across six districts. Rehabilitation of displaced families is progressing slower than planned in two districts, holding up possession.',
    riskSignal:
      'Rehabilitation completion percentage is below expected rate. Possession stage has not started within projected timelines.',
    response:
      'LADRIS identifies rehabilitation delay as the primary bottleneck. State-level users see the risk signal on the GIS map. The system recommends escalation to the rehabilitation agency.',
  },
  {
    tag: ILLUSTRATIVE,
    sector: 'Metro Development',
    situation:
      'An urban metro project is acquiring land in a dense municipal area. Approval from multiple agencies — municipal corporation, state authority, central ministry — creates a coordination gap.',
    riskSignal:
      'Notification stage has been pending for longer than the historical average for similar urban projects. Multiple approvals are listed as outstanding.',
    response:
      'LADRIS scores the project Medium-to-High risk based on notification age and approval count. An alert is sent to the state coordinator. The dashboard shows which approvals remain pending.',
  },
  {
    tag: ILLUSTRATIVE,
    sector: 'Power Transmission Infrastructure',
    situation:
      'A high-voltage transmission line project crosses land with unresolved ownership records in a tribal area. Legal challenges are expected due to documentation gaps.',
    riskSignal:
      'Historical performance data for similar projects shows high delay probability when tribal land and documentation gaps co-occur. Legal dispute risk is elevated.',
    response:
      'LADRIS uses pattern recognition from historical projects to assign a pre-emptive risk score. The central dashboard recommends early legal documentation review before the stage escalates.',
  },
]

export default function CaseStudies() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    setMounted(true)
  }, [])

  const c = {
    bg:         isDark ? '#060f1e' : '#f0f4f9',
    heading:    isDark ? '#f0f6fc' : '#0a1d37',
    body:       isDark ? '#94a9c9' : '#4a6280',
    label:      isDark ? '#5a7194' : '#94a3b8',
    border:     isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    divider:    isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    navBg:      isDark ? '#070c1b' : '#ffffff',
    navBorder:  isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    tagBg:      isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,51,102,0.05)',
    tagColor:   isDark ? '#7a9abf' : '#4a6280',
    fieldLabel: isDark ? '#5a7194' : '#94a3b8',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: c.bg,
        fontFamily: 'Inter, system-ui, sans-serif',
        color: c.heading,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
      }}
    >
      {/* Sticky page header */}
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
            aria-label="Back to landing page"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back
          </button>
          <span style={{ color: c.divider }}>|</span>
          <span style={{ fontSize: '0.8rem', color: c.label }}>LADRIS · Documents</span>
        </div>
      </div>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '56px 24px 80px' }}>

        {/* Eyebrow + Heading */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: c.label, marginBottom: 10,
          }}>
            Documents
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: c.heading, margin: '0 0 12px', lineHeight: 1.25 }}>
            Case Studies
          </h1>
          <p style={{ fontSize: '0.93rem', color: c.body, lineHeight: 1.7, maxWidth: 580, margin: 0 }}>
            How early risk signals can support earlier action.
          </p>
        </div>

        {/* Labelling notice */}
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
          Scenarios below are labelled <strong style={{ color: c.heading }}>ILLUSTRATIVE LADRIS SCENARIO</strong> where they describe
          how LADRIS could apply to a general situation rather than a verified deployment. No fabricated outcomes or statistics are presented.
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${c.divider}`, margin: '0 0 8px' }} />

        {/* Case list */}
        <section aria-label="Case studies">
          {CASES.map((cs, i) => (
            <CaseRow
              key={i}
              cs={cs}
              isLast={i === CASES.length - 1}
              c={c}
              isDark={isDark}
            />
          ))}
        </section>

      </main>
    </div>
  )
}

function CaseRow({ cs, isLast, c, isDark }: {
  cs: { tag: string; sector: string; situation: string; riskSignal: string; response: string }
  isLast: boolean
  c: Record<string, string>
  isDark: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        padding: '28px 0',
        borderBottom: isLast ? 'none' : `1px solid ${c.divider}`,
        background: hovered ? (isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,51,102,0.015)') : 'transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >

      {/* Sector */}
      <div style={{ fontSize: '0.975rem', fontWeight: 600, color: c.heading, marginBottom: 16, lineHeight: 1.35 }}>
        {cs.sector}
      </div>

      {/* Three-field layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Situation" text={cs.situation} c={c} />
        <Field label="Risk Signal" text={cs.riskSignal} c={c} />
        <Field label="LADRIS Response" text={cs.response} c={c} />
      </div>
    </div>
  )
}

function Field({ label, text, c }: { label: string; text: string; c: Record<string, string> }) {
  return (
    <div>
      <div style={{
        fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: c.fieldLabel, marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{ fontSize: '0.875rem', color: c.body, lineHeight: 1.7 }}>
        {text}
      </div>
    </div>
  )
}
