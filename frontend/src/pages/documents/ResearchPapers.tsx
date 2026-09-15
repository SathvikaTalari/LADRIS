/**
 * LADRIS — Research Papers
 * Route: /documents/research-papers
 */
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { useEffect, useState } from 'react'

const PAPERS = [
  {
    title: 'Predictive Analytics for Infrastructure Project Risk Management: A Machine Learning Approach',
    summary:
      'Proposes an ML framework that uses historical project data — stage durations, approval timelines, compensation records — to predict delay risk before it materialises. Relevant to the core scoring model in LADRIS.',
    meta: 'International Journal of Project Management',
    url: 'https://www.sciencedirect.com/journal/international-journal-of-project-management',
  },
  {
    title: 'Land Acquisition and Infrastructure Delays in India: Causes, Consequences and Policy Responses',
    summary:
      'Analyses documented delay drivers in major infrastructure projects and finds that compensation disputes, incomplete rehabilitation, and coordination failures are the most frequent causes.',
    meta: 'NIPFP Working Paper Series',
    url: 'https://www.nipfp.org.in/publications/working-papers/',
  },
  {
    title: 'Explainable AI for Administrative Decision-Making: Transparency and Accountability in Government Systems',
    summary:
      'Examines how explainable AI (XAI) can make model predictions interpretable for non-technical government users, supporting audit compliance and trust in algorithmic outputs.',
    meta: 'Government Information Quarterly',
    url: 'https://www.sciencedirect.com/journal/government-information-quarterly',
  },
  {
    title: 'GIS-Based Spatial Analysis for Land Administration and Risk Assessment',
    summary:
      'Demonstrates how geographic information systems can map land record disputes, identify acquisition risk zones, and improve coordination between district-level authorities.',
    meta: 'Land Use Policy (Elsevier)',
    url: 'https://www.sciencedirect.com/journal/land-use-policy',
  },
  {
    title: 'Early Warning Systems for Public Infrastructure: A Framework for Delay Detection',
    summary:
      'Presents a delay-detection framework based on threshold monitoring and machine learning — paralleling the automated alerts and risk scoring described in the LADRIS design.',
    meta: 'Transport Policy (Elsevier)',
    url: 'https://www.sciencedirect.com/journal/transport-policy',
  },
  {
    title: 'Compensation Delays in Land Acquisition: Evidence from Infrastructure Projects in India',
    summary:
      'Uses case data from highway and railway projects to quantify how delays in compensation payment extend possession timelines and downstream construction schedules.',
    meta: 'Economic & Political Weekly',
    url: 'https://www.epw.in/',
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
            Research behind predictive risk and infrastructure governance.
          </p>
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${c.divider}`, margin: '0 0 8px' }} />

        {/* Paper list */}
        <section aria-label="Research papers">
          {PAPERS.map((paper, i) => (
            <PaperRow
              key={paper.url + i}
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
          Links point to the source journal or institution. Access to specific papers may require institutional login or subscription.
        </div>

      </main>
    </div>
  )
}

function PaperRow({ paper, isLast, c, isDark }: {
  paper: { title: string; summary: string; meta: string; url: string }
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
      <div style={{ fontSize: '0.975rem', fontWeight: 600, color: c.heading, marginBottom: 7, lineHeight: 1.4 }}>
        {paper.title}
      </div>
      <div style={{ fontSize: '0.875rem', color: c.body, lineHeight: 1.7, marginBottom: 12 }}>
        {paper.summary}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: c.label, fontWeight: 500 }}>
          {paper.meta}
        </span>
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
    </div>
  )
}
