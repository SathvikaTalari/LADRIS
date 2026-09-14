/**
 * LADRIS — Site Map Page
 */
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import {
  LayoutDashboard, FolderOpen, AlertTriangle, BarChart2,
  Map, Bell, FileText, Settings, ShieldCheck, Layers,
  Home, LogIn, Info, ChevronRight, ArrowLeft,
} from 'lucide-react'

const SECTIONS = [
  {
    heading: 'Public',
    color: '#4080ff',
    items: [
      { label: 'Landing Page', desc: 'Platform overview, features and ministry details', icon: Home, path: '/landing' },
      { label: 'Login', desc: 'Role-based access for government officers', icon: LogIn, path: '/login' },
      { label: 'Site Map', desc: 'This page — full platform structure', icon: Layers, path: '/sitemap' },
    ],
  },
  {
    heading: 'Dashboard & Overview',
    color: '#00b894',
    items: [
      { label: 'Main Dashboard', desc: 'Real-time risk summary, KPIs, and delay heatmaps across all projects', icon: LayoutDashboard, path: '/dashboard' },
      { label: 'Priority Intelligence', desc: 'High-priority projects requiring immediate attention and escalation', icon: ShieldCheck, path: '/priority-intelligence' },
    ],
  },
  {
    heading: 'Projects & Acquisition',
    color: '#f47721',
    items: [
      { label: 'Project List', desc: 'All land acquisition projects across states, districts and ministries', icon: FolderOpen, path: '/projects' },
      { label: 'Project Detail', desc: 'Per-project acquisition status, delay factors, timeline and documents', icon: FileText, path: '/projects/:id' },
      { label: 'LA Workbench', desc: 'Land Acquiring Authority workbench — notifications, consents and awards', icon: Layers, path: '/la-workbench' },
      { label: 'Agency Portal', desc: 'Project implementing agency view — track acquisition progress per project', icon: FolderOpen, path: '/agency-portal' },
    ],
  },
  {
    heading: 'Risk Assessment & Intelligence',
    color: '#e74c3c',
    items: [
      { label: 'Intelligence', desc: 'AI-driven risk scoring, bottleneck detection and delay predictions', icon: AlertTriangle, path: '/intelligence' },
      { label: 'Alerts', desc: 'Real-time alerts for escalating delays, deadline breaches and compliance gaps', icon: Bell, path: '/alerts' },
    ],
  },
  {
    heading: 'Analytics & GIS',
    color: '#7c5cfc',
    items: [
      { label: 'Analytics', desc: 'District-wise delay trends, compensation analytics and performance metrics', icon: BarChart2, path: '/analytics' },
      { label: 'GIS Map', desc: 'Geospatial view of project locations, high-risk zones and district patterns', icon: Map, path: '/gis' },
    ],
  },
  {
    heading: 'Data & Administration',
    color: '#64748b',
    items: [
      { label: 'Data Sources', desc: 'Connected government data feeds — revenue records, court orders, SIA reports', icon: FileText, path: '/data-sources' },
      { label: 'Data Quality', desc: 'Monitor data completeness, accuracy and freshness across all inputs', icon: Settings, path: '/data-quality' },
      { label: 'Admin Panel', desc: 'User management, role assignments and platform configuration', icon: ShieldCheck, path: '/admin' },
    ],
  },
  {
    heading: 'About & Documentation',
    color: '#0891b2',
    items: [
      { label: 'About LADRIS', desc: 'Platform overview, problem statement, and policy alignment with RFCTLARR Act 2013', icon: Info, path: '/landing' },
      { label: 'How Risk Is Calculated', desc: 'Methodology, AI model inputs, and risk scoring criteria', icon: Info, path: '/landing' },
      { label: 'Delay Factors Explained', desc: 'Legal, compensation, SIA, notification and award stage delays', icon: AlertTriangle, path: '/landing' },
    ],
  },
]

export default function SiteMap() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const bg = isDark ? '#060f1e' : '#f0f4f9'
  const cardBg = isDark ? 'rgba(12,26,48,0.95)' : '#ffffff'
  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,51,102,0.1)'
  const textPrimary = isDark ? '#e2eaf8' : '#0a1d37'
  const textSecondary = isDark ? '#5a7194' : '#64748b'
  const headingColor = isDark ? '#c9d8f0' : '#1a2e4a'

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      fontFamily: 'Inter, system-ui, sans-serif',
      color: textPrimary,
      paddingBottom: 60,
    }}>
      {/* Header */}
      <div style={{
        background: isDark ? '#070c1b' : '#ffffff',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
        padding: '20px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,51,102,0.08)',
      }}>
        <button
          onClick={() => navigate('/landing')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0'}`,
            borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
            color: textSecondary, fontSize: '0.8rem', fontWeight: 500,
            transition: 'all 0.15s', fontFamily: 'inherit',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#c9d8f0' : '#003366'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.25)' : '#003366' }}
          onMouseLeave={e => { e.currentTarget.style.color = textSecondary; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0' }}
        >
          <ArrowLeft size={13} /> Back to Landing
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: textPrimary, letterSpacing: '-0.02em' }}>
            LADRIS — Site Map
          </div>
          <div style={{ fontSize: '0.72rem', color: textSecondary, marginTop: 2 }}>
            Land Acquisition Delay Risk Intelligence Platform · All Sections
          </div>
        </div>
      </div>

      {/* Grid */}
      <div style={{ maxWidth: 1100, margin: '40px auto', padding: '0 32px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 24,
        }}>
          {SECTIONS.map(section => (
            <div key={section.heading} style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.25)' : '0 2px 12px rgba(0,51,102,0.06)',
            }}>
              <div style={{
                padding: '14px 18px',
                borderBottom: `1px solid ${cardBorder}`,
                background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,51,102,0.025)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{ width: 4, height: 18, borderRadius: 2, background: section.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: headingColor }}>
                  {section.heading}
                </span>
              </div>
              <div style={{ padding: '8px 0' }}>
                {section.items.map(item => {
                  const Icon = item.icon
                  const isCurrent = item.path === '/sitemap'
                  return (
                    <button
                      key={item.label}
                      onClick={() => { if (!isCurrent) navigate(item.path) }}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        width: '100%', padding: '10px 18px',
                        background: 'none', border: 'none',
                        cursor: isCurrent ? 'default' : 'pointer',
                        textAlign: 'left', transition: 'background 0.15s',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => {
                        if (!isCurrent)
                          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,51,102,0.04)'
                      }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: 7, flexShrink: 0, marginTop: 1,
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,51,102,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: section.color,
                      }}>
                        <Icon size={14} strokeWidth={2} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: '0.825rem', fontWeight: 600, color: textPrimary }}>
                            {item.label}
                          </span>
                          {!isCurrent && <ChevronRight size={11} color={textSecondary} />}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: textSecondary, marginTop: 2, lineHeight: 1.45 }}>
                          {item.desc}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 40, textAlign: 'center',
          fontSize: '0.72rem', color: textSecondary, lineHeight: 1.6,
        }}>
          LADRIS · Ministry of Rural Development · Government of India
          <br />Protected dashboard routes require role-based authentication.
        </div>
      </div>
    </div>
  )
}
