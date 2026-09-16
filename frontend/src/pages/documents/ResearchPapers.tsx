/**
 * LADRIS — Research Papers
 * Route: /documents/research-papers
 */
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { useEffect, useState } from 'react'

/*
 * Metadata policy:
 * Only fields confirmed from the actual source are included.
 * Title/author fields marked with a note where access was restricted.
 */
interface Paper {
  title: string | null
  titleNote?: string
  context: string
  meta: string
  url: string
}

const PAPERS: Paper[] = [
  {
    // Source URL: https://www.sciencedirect.com/science/article/pii/S0926580525006284
    // Journal: Automation in Construction (ISSN 0926-5805), Elsevier, 2025
    // Full title not publicly indexable — article accessible at original URL
    title: null,
    titleNote: 'Article available at source — full title accessible via the link below.',
    context:
      'Published in Automation in Construction (Elsevier, 2025). The journal covers AI, monitoring, and risk management in construction projects, including land acquisition-related factors that affect project schedules.',
    meta: 'Automation in Construction · Elsevier · 2025',
    url: 'https://www.sciencedirect.com/science/article/pii/S0926580525006284?via%3Dihub',
  },
  {
    // Source URL: https://link.springer.com/article/10.1007/s40030-025-00899-5
    // Verified from source metadata
    title: 'Delay Analysis of Infrastructure Construction Projects in India',
    context:
      'Investigates causes and mitigation strategies for delays in Indian infrastructure construction, with a focus on roads and bridges. Identifies land acquisition as a critical delay factor for road projects (RII = 0.68), alongside material shortages and contractor inefficiencies. Relevant to LADRIS as it documents the types of delay drivers the platform is designed to monitor early.',
    meta: 'Journal of The Institution of Engineers (India): Series A · Springer · 2025',
    url: 'https://link.springer.com/article/10.1007/s40030-025-00899-5',
  },
  {
    // Source URL: https://www.sciencedirect.com/science/article/abs/pii/S1474034625011127
    // Journal: Advanced Engineering Informatics (ISSN 1474-0346), Elsevier, 2025
    // Full title not publicly indexable — article accessible at original URL
    title: null,
    titleNote: 'Article available at source — full title accessible via the link below.',
    context:
      'Published in Advanced Engineering Informatics (Elsevier, 2025). The journal publishes research on AI and data-driven systems for engineering decision-making, including delay prediction and risk assessment in infrastructure projects.',
    meta: 'Advanced Engineering Informatics · Elsevier · 2025',
    url: 'https://www.sciencedirect.com/science/article/abs/pii/S1474034625011127?via%3Dihub',
  },
  {
    // Source URL: https://www.sciencedirect.com/science/article/pii/S2666827021000839
    // Verified from multiple sources
    title: 'Applied Artificial Intelligence for Predicting Construction Projects Delay',
    context:
      'Develops an ensemble machine learning model to forecast construction project delays using bagging, boosting, and Naïve Bayes techniques. Demonstrates how AI can reliably predict delays from project characteristics before they escalate — a core capability that LADRIS applies to land acquisition projects.',
    meta: 'Machine Learning with Applications · Elsevier · Vol. 6, 2021',
    url: 'https://www.sciencedirect.com/science/article/pii/S2666827021000839',
  },
]

export default function ResearchPapers() {
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
            Research Papers
          </h1>
          <p style={{ fontSize: '0.93rem', color: c.body, lineHeight: 1.7, maxWidth: 580, margin: 0 }}>
            Research behind project delays, risk analysis and infrastructure planning.
          </p>
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${c.divider}`, margin: '0 0 8px' }} />

        {/* Paper list */}
        <section aria-label="Research papers">
          {PAPERS.map((paper, i) => (
            <PaperRow
              key={paper.url}
              paper={paper}
              isLast={i === PAPERS.length - 1}
              c={c}
              isDark={isDark}
            />
          ))}
        </section>

        {/* Disclaimer */}
        <div style={{
          marginTop: 48,
          padding: '14px 18px',
          border: `1px solid ${c.border}`,
          borderLeft: `3px solid ${isDark ? '#4a6280' : '#003366'}`,
          borderRadius: '0 6px 6px 0',
          background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
          fontSize: '0.83rem', color: c.body, lineHeight: 1.65,
        }}>
          Links open the original source paper or journal page in a new tab.
          Access to some papers may require institutional login or subscription.
          Only metadata verified from the actual source is shown.
        </div>

      </main>
    </div>
  )
}

function PaperRow({ paper, isLast, c, isDark }: {
  paper: Paper
  isLast: boolean
  c: Record<string, string>
  isDark: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        padding: '26px 0',
        borderBottom: isLast ? 'none' : `1px solid ${c.divider}`,
        background: hovered ? (isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,51,102,0.015)') : 'transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {paper.title ? (
        <div style={{ fontSize: '0.975rem', fontWeight: 600, color: c.heading, marginBottom: 5, lineHeight: 1.4 }}>
          {paper.title}
        </div>
      ) : (
        <div style={{ fontSize: '0.875rem', fontStyle: 'italic', color: c.label, marginBottom: 5, lineHeight: 1.4 }}>
          {paper.titleNote}
        </div>
      )}
      <div style={{ fontSize: '0.78rem', color: c.label, fontWeight: 500, marginBottom: 8 }}>
        {paper.meta}
      </div>
      <div style={{ fontSize: '0.875rem', color: c.body, lineHeight: 1.7, marginBottom: 12 }}>
        {paper.context}
      </div>
      <a
        href={paper.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: '0.8rem', fontWeight: 600,
          color: c.linkColor,
          textDecoration: 'none',
          transition: 'text-decoration 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
      >
        View Paper
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  )
}
