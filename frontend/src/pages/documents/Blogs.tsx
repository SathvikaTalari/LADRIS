/**
 * LADRIS — Blogs
 * Route: /documents/blogs
 */
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { useEffect, useState } from 'react'

const BLOGS: { title: string; context: string; source: string; year: string; url: string }[] = [
  {
    title: 'Slow land acquisition, clearances delay infrastructure plans: centre to states',
    context: 'Shows how slow land acquisition and clearances can hold up infrastructure plans.',
    source: 'Economic Times',
    year: '2023',
    url: 'https://economictimes.indiatimes.com/news/india/slow-land-acquisition-clearances-delay-infrastructure-plans-centre-to-states/articleshow/97038810.cms',
  },
  {
    title: 'Standing committee flags issue of delay in road projects; shortfall in NMP targets',
    context: 'Connects road-project delays with land acquisition and the need for better coordination.',
    source: 'Economic Times',
    year: '2023',
    url: 'https://economictimes.indiatimes.com/news/economy/infrastructure/standing-committee-flags-issue-of-delay-in-road-projects-shortfall-in-nmp-targets/articleshow/105843201.cms',
  },
  {
    title: 'Important infra projects held up in Kerala due to delay in land acquisition',
    context: 'Shows how land acquisition delays can hold up important infrastructure projects.',
    source: 'ThePrint',
    year: '2024',
    url: 'https://theprint.in/india/important-infra-projects-held-up-in-kerala-due-to-delay-in-land-acquisition-vaishnaw/2204778/',
  },
  {
    title: '30 Punjab highway projects paused due to land acquisition delays, farmer protests',
    context: 'Highlights how land acquisition delays, stakeholder resistance and related issues can affect highway projects.',
    source: 'ThePrint',
    year: '2024',
    url: 'https://theprint.in/india/30-punjab-highway-projects-paused-due-to-land-acquisition-delays-farmer-protests-nhai-pulls-plug-on-3/2180055/',
  },
  {
    title: 'Slew of amendments to National Highways Act on cards as Centre looks to acquire land faster, cut costs',
    context: 'Shows efforts to make land acquisition faster and reduce delays and costs.',
    source: 'ThePrint',
    year: '2025',
    url: 'https://theprint.in/india/slew-of-amendments-to-national-highways-act-on-cards-as-centre-looks-to-acquire-land-faster-cut-costs/2552545/',
  },
  {
    title: 'Nearly 700 highway projects delayed, 35% due to land acquisition disputes',
    context: 'Highlights how land acquisition disputes can contribute significantly to highway project delays.',
    source: 'ThePrint',
    year: '2025',
    url: 'https://theprint.in/india/governance/nearly-700-highway-projects-delayed-35-due-to-land-acquisition-disputes-says-parliamentary-panel/2564537/',
  },
  {
    title: 'To cut delays & cost overruns, roads ministry mandates land acquisition, green nod deadlines',
    context: 'Shows how setting early land-acquisition and clearance deadlines can help reduce project delays.',
    source: 'Indian Express',
    year: '2025',
    url: 'https://indianexpress.com/article/business/cut-delays-cost-overruns-roads-ministry-mandates-land-acquisition-green-deadlines-10009890/',
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
            Real-world insights on land acquisition and infrastructure delays.
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
          Links open the original publisher article in a new tab. LADRIS does not host or endorse third-party content.
          Articles are sourced from publicly available news publications.
        </div>

      </main>
    </div>
  )
}

function BlogRow({ blog, isLast, c, isDark }: {
  blog: { title: string; context: string; source: string; year: string; url: string }
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
      <div style={{ fontSize: '0.975rem', fontWeight: 600, color: c.heading, marginBottom: 5, lineHeight: 1.4 }}>
        {blog.title}
      </div>
      <div style={{ fontSize: '0.78rem', color: c.label, fontWeight: 500, marginBottom: 8 }}>
        {blog.source} · {blog.year}
      </div>
      <div style={{ fontSize: '0.875rem', color: c.body, lineHeight: 1.7, marginBottom: 12 }}>
        {blog.context}
      </div>
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
  )
}
