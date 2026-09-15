/**
 * LADRIS — Blogs
 * Route: /documents/blogs
 */
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { useEffect, useState } from 'react'

const BLOGS = [
  {
    title: 'Why Land Acquisition Delays Are India\'s Biggest Infrastructure Bottleneck',
    summary:
      'Examines how unresolved ownership disputes, slow compensation disbursement, and coordination gaps between state and central agencies have stalled highway and railway projects across India.',
    source: 'The Hindu BusinessLine',
    url: 'https://www.thehindubusinessline.com/',
  },
  {
    title: 'India\'s Land Acquisition Act: Progress and Persistent Gaps',
    summary:
      'Reviews the RFCTLARR Act 2013 — what improved in administration, where delays continue, and how predictive tools could help authorities act earlier in the acquisition process.',
    source: 'Economic & Political Weekly',
    url: 'https://www.epw.in/',
  },
  {
    title: 'AI in Governance: Predicting and Preventing Infrastructure Project Delays',
    summary:
      'Covers how machine learning models trained on historical project data can forecast land acquisition bottlenecks in advance, enabling preventive administrative action before delays escalate.',
    source: 'NITI Aayog — Blog',
    url: 'https://www.niti.gov.in/blog',
  },
  {
    title: 'GIS and Land Administration: Mapping Risk Before It Escalates',
    summary:
      'Discusses how geographic information systems help visualise land record inconsistencies and high-risk acquisition zones, supporting earlier intervention by district officers.',
    source: 'Geospatial World',
    url: 'https://www.geospatialworld.net/',
  },
  {
    title: 'The Cost of Delay: How Slow Land Acquisition Inflates Infrastructure Budgets',
    summary:
      'Analyses the financial impact of extended land acquisition timelines on highway, metro, and railway projects, drawing on publicly available CAG and ministry data.',
    source: 'Infrastructure Today',
    url: 'https://www.infrastructuretoday.co.in/',
  },
  {
    title: 'Explainable AI in Public Administration: Accountability Without the Black Box',
    summary:
      'Explores how explainable AI models can surface the key factors behind a risk prediction — making decisions auditable and acceptable to government decision-makers.',
    source: 'Centre for Internet & Society',
    url: 'https://cis-india.org/',
  },
]

export default function Blogs() {
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
    rowBg:      isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,51,102,0.02)',
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
            Blogs
          </h1>
          <p style={{ fontSize: '0.93rem', color: c.body, lineHeight: 1.7, maxWidth: 580, margin: 0 }}>
            Insights on land acquisition, delay risks and predictive governance.
          </p>
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${c.divider}`, margin: '0 0 8px' }} />

        {/* Blog list */}
        <section aria-label="Blog articles">
          {BLOGS.map((blog, i) => (
            <BlogRow
              key={blog.url}
              blog={blog}
              isLast={i === BLOGS.length - 1}
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
          Links open the publisher's homepage or index. LADRIS does not host or endorse third-party content.
          Specific articles may require site search or subscription to access.
        </div>

      </main>
    </div>
  )
}

function BlogRow({ blog, isLast, c, isDark }: {
  blog: { title: string; summary: string; source: string; url: string }
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
        {blog.title}
      </div>
      <div style={{ fontSize: '0.875rem', color: c.body, lineHeight: 1.7, marginBottom: 12 }}>
        {blog.summary}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: c.label, fontWeight: 500 }}>
          Source: {blog.source}
        </span>
        <a
          href={blog.url}
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
          Read Article
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  )
}
