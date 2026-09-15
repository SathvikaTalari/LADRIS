/**
 * LADRIS — Real-World Examples
 * Route: /documents/real-world-examples
 */
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { useEffect, useState } from 'react'

const USE_CASE = 'REAL-WORLD USE CASE'

const EXAMPLES = [
  {
    tag: USE_CASE,
    sector: 'National Highways — India',
    context:
      'Hundreds of national highway projects under MoRTH have faced documented land acquisition delays. CAG reports and parliamentary committee records confirm that slow compensation payment and incomplete land records are the most frequently cited causes.',
    relevance:
      'LADRIS is designed to track exactly these delay drivers — compensation award status, documentation completeness, and stage progression — and flag projects before delays escalate.',
    source: null,
    sourceUrl: null,
  },
  {
    tag: USE_CASE,
    sector: 'Dedicated Freight Corridor (DFC)',
    context:
      'The Eastern and Western Dedicated Freight Corridor projects experienced multi-year land acquisition delays across several states. Official project reports cite ownership disputes and rehabilitation timelines as major factors.',
    relevance:
      'The DFC experience illustrates the kind of multi-district, multi-stage acquisition complexity that LADRIS is built to monitor — tracking simultaneous acquisition progress across jurisdictions.',
    source: 'Dedicated Freight Corridor Corporation of India — Project Reports',
    sourceUrl: 'https://dfccil.com/',
  },
  {
    tag: USE_CASE,
    sector: 'Metro Rail Projects — Urban India',
    context:
      'Metro projects in multiple cities have faced delays specifically in land acquisition for depot sites, maintenance yards, and elevated sections. Urban land involves multi-agency approvals.',
    relevance:
      'Urban acquisition involves municipal, state, and central approvals simultaneously. LADRIS can surface multi-agency bottlenecks and alert coordinators before they cause schedule overruns.',
    source: null,
    sourceUrl: null,
  },
  {
    tag: USE_CASE,
    sector: 'Power Transmission Lines — Rural Corridors',
    context:
      'High-voltage transmission line projects often cross land with unresolved ownership records, especially in areas with tribal land designations or disputed survey maps. These create legal delays.',
    relevance:
      'LADRIS can integrate land record status and legal dispute flags into the risk score, enabling early identification of projects likely to face legal challenges before they are filed.',
    source: null,
    sourceUrl: null,
  },
  {
    tag: USE_CASE,
    sector: 'Airport Expansion — Greenfield Sites',
    context:
      'New airport and expansion projects — such as those at Navi Mumbai and Jewar — have publicly documented land acquisition timelines spanning several years, affected by rehabilitation and compensation disputes.',
    relevance:
      'Large greenfield sites involve thousands of land parcels across multiple villages. LADRIS-style monitoring of parcel-wise status and rehabilitation completion would support earlier identification of high-risk parcels.',
    source: 'Ministry of Civil Aviation — Project Updates',
    sourceUrl: 'https://www.civilaviation.gov.in/',
  },
  {
    tag: USE_CASE,
    sector: 'Industrial Corridors — State-Level Projects',
    context:
      'Industrial corridor development across states including Maharashtra, Gujarat, Rajasthan, and Andhra Pradesh has involved large-scale land acquisition, with delays documented in public domain reports.',
    relevance:
      'Multi-district industrial acquisitions require coordination between state industry bodies, district collectors, and revenue departments. LADRIS is designed for exactly this multi-stakeholder coordination.',
    source: null,
    sourceUrl: null,
  },
]

export default function RealWorldExamples() {
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
    linkColor:  isDark ? '#4a7fd4' : '#003366',
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
            Real-World Examples
          </h1>
          <p style={{ fontSize: '0.93rem', color: c.body, lineHeight: 1.7, maxWidth: 580, margin: 0 }}>
            Where land acquisition can affect infrastructure timelines.
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
          Examples below are based on publicly documented project contexts. LADRIS has not been deployed on any of these projects.
          Each entry describes where LADRIS-style monitoring would apply, not where it has been used.
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${c.divider}`, margin: '0 0 8px' }} />

        {/* Examples list */}
        <section aria-label="Real-world examples">
          {EXAMPLES.map((ex, i) => (
            <ExampleRow
              key={i}
              ex={ex}
              isLast={i === EXAMPLES.length - 1}
              c={c}
              isDark={isDark}
            />
          ))}
        </section>

      </main>
    </div>
  )
}

function ExampleRow({ ex, isLast, c, isDark }: {
  ex: {
    tag: string; sector: string; context: string
    relevance: string; source: string | null; sourceUrl: string | null
  }
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
      {/* Tag */}
      <div style={{
        display: 'inline-block',
        fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: c.tagColor,
        background: c.tagBg,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,51,102,0.1)'}`,
        borderRadius: 4,
        padding: '2px 8px',
        marginBottom: 10,
      }}>
        {ex.tag}
      </div>

      {/* Sector */}
      <div style={{ fontSize: '0.975rem', fontWeight: 600, color: c.heading, marginBottom: 16, lineHeight: 1.35 }}>
        {ex.sector}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ExField label="Context" text={ex.context} c={c} />
        <ExField label="Why It Matters for LADRIS" text={ex.relevance} c={c} />
      </div>

      {/* Source link if available */}
      {ex.source && ex.sourceUrl && (
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.75rem', color: c.label }}>Source: {ex.source}</span>
          <a
            href={ex.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: '0.78rem', fontWeight: 600,
              color: c.linkColor,
              textDecoration: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            View Source
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      )}
    </div>
  )
}

function ExField({ label, text, c }: { label: string; text: string; c: Record<string, string> }) {
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
