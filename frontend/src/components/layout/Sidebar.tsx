/**
 * LADRIS — Premium Sidebar Navigation
 */
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Folder,
  MapPinned,
  BarChart3,
  Bell,
  Database,
  Settings,
  ChevronLeft,
  ChevronRight,
  Target,
  ShieldCheck,
  Briefcase,
  Building2,
  createLucideIcon,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { roleLabel } from '@/utils'

// Universally recognizable Decision / Recommendation icon: Target / Bullseye with Checkmark
const TargetCheck = createLucideIcon('TargetCheck', [
  ['circle', { cx: '12', cy: '12', r: '10', key: 'outer' }],
  ['circle', { cx: '12', cy: '12', r: '6', key: 'inner' }],
  ['path', { d: 'm9 12 2 2 4-4', key: 'check' }],
])

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

interface NavItem {
  to: string
  icon: any
  label: string
  tooltip?: string
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'CENTRAL_ADMIN' || user?.role === 'STATE_ADMIN'
  const [hoveredTooltip, setHoveredTooltip] = useState<{ text: string; top: number } | null>(null)

  const navItems: NavItem[] = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', tooltip: 'Project Overview' },
  ]

  if (user?.role === 'LA_OFFICER' || user?.role === 'PROJECT_OFFICER') {
    navItems.push({ to: '/la-workbench', icon: Briefcase, label: 'Officer Workbench' })
  }
  if (user?.role === 'PROJECT_AGENCY') {
    navItems.push({ to: '/agency-portal', icon: Building2, label: 'Agency Portal' })
  }

  navItems.push(
    { to: '/projects', icon: Folder, label: 'Projects Directory', tooltip: 'Browse All Projects & Details' },
    { to: '/gis', icon: MapPinned, label: 'Interactive Map', tooltip: 'Geographic Risk & Route Mapping' },
    { to: '/priority-intelligence', icon: Target, label: 'Priority Watchlist', tooltip: 'High Risk Projects & Urgency' },
    { to: '/intelligence', icon: TargetCheck, label: 'Decision Intelligence', tooltip: 'Land Blockers, What-If, Gaps & Interventions' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics & Trends', tooltip: 'Performance & Delay Trends' },
    { to: '/alerts', icon: Bell, label: 'Alerts & Warnings', tooltip: 'Real-Time Delay Notifications' },
    { to: '/data-sources', icon: Database, label: 'Data Sources', tooltip: 'CSV & Connected Data Feeds' },
    { to: '/data-quality', icon: ShieldCheck, label: 'Data Health', tooltip: 'Completeness & Reliability Scores' },
  )

  const adminItems = [{ to: '/admin', icon: Settings, label: 'Admin & AI Settings', tooltip: 'AI Configuration & Users' }]


  return (
    <>
      <motion.aside
      animate={{ width: collapsed ? 68 : 252 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: 'fixed',
        left: 0, top: 0, bottom: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Brand / Logo Area */}
      <div style={{
        height: 'var(--topnav-height)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 11,
        flexShrink: 0,
        borderBottom: '1px solid rgba(64,128,255,0.08)',
      }}>
        {/* Logo mark */}
        <div style={{
          width: 38, height: 38,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
          background: 'rgba(14,22,40,0.85)',
          border: '1px solid rgba(64,128,255,0.25)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          padding: 2,
        }}>
          <img
            src="/logo.png"
            alt="LADRIS Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.15 }}
            >
              <div style={{
                fontSize: '0.9375rem',
                fontWeight: 800,
                color: 'var(--color-text-primary)',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}>
                LADRIS
              </div>
              <div style={{
                fontSize: '0.5rem',
                color: 'var(--color-accent-primary)',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                lineHeight: 1.25,
                marginTop: 2,
              }}>
                <div>LAND ACQUISITION DELAY RISK</div>
                <div>INTELLIGENCE SYSTEM</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav
        onScroll={() => setHoveredTooltip(null)}
        style={{
          flex: 1,
          padding: '10px 8px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(({ to, icon: Icon, label, tooltip }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={tooltip ?? label}
              style={{ textDecoration: 'none' }}
              onMouseEnter={(e) => {
                if (tooltip) {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setHoveredTooltip({
                    text: tooltip,
                    top: rect.top + rect.height / 2,
                  })
                }
              }}
              onMouseLeave={() => setHoveredTooltip(null)}
            >
              {({ isActive }) => (
                <motion.div
                  whileHover={{ x: collapsed ? 0 : 3 }}
                  transition={{ duration: 0.12 }}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  style={{
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '10px' : undefined,
                  }}
                >
                  <Icon
                    size={17}
                    className="nav-item-icon"
                    style={{
                      flexShrink: 0,
                      opacity: isActive ? 1 : 0.7,
                    }}
                  />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </NavLink>
          ))}
        </div>

        {/* Admin Section */}
        {isAdmin && (
          <>
            <div style={{
              height: 1,
              background: 'rgba(64,128,255,0.08)',
              margin: '10px 4px',
            }} />
            {!collapsed && (
              <div style={{
                fontSize: '0.6rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'rgba(64,128,255,0.5)',
                padding: '4px 12px',
                marginBottom: 4,
              }}>
                Administration
              </div>
            )}
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                state={{ fromNav: true }}
                onClick={() => sessionStorage.setItem('visited_admin_explicitly', 'true')}
                style={{ textDecoration: 'none' }}
              >

                {({ isActive }) => (
                  <motion.div
                    whileHover={{ x: collapsed ? 0 : 3 }}
                    transition={{ duration: 0.12 }}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    style={{
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      padding: collapsed ? '10px' : undefined,
                    }}
                  >
                    <Icon size={17} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          {label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User Profile Footer */}
      {user && (
        <div style={{
          padding: '10px 8px',
          borderTop: '1px solid rgba(64,128,255,0.08)',
          flexShrink: 0,
        }}>
          <div
            className="nav-item"
            style={{
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '10px' : undefined,
              cursor: 'default',
              background: 'rgba(64,128,255,0.05)',
              border: '1px solid rgba(64,128,255,0.1)',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 32, height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(64,128,255,0.3) 0%, rgba(124,92,252,0.3) 100%)',
              border: '1.5px solid rgba(64,128,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 800,
              color: '#7daaff',
              flexShrink: 0,
              boxShadow: '0 0 10px rgba(64,128,255,0.15)',
            }}>
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ overflow: 'hidden', minWidth: 0 }}
                >
                  <div style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {user.full_name}
                  </div>
                  <div style={{
                    fontSize: '0.65rem',
                    color: 'var(--color-accent-primary)',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                  }}>
                    {roleLabel(user.role)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        style={{
          position: 'absolute',
          bottom: 88,
          right: -13,
          width: 26, height: 26,
          borderRadius: '50%',
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--color-text-muted)',
          zIndex: 10,
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border-strong)'
          e.currentTarget.style.color = 'var(--color-accent-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border-default)'
          e.currentTarget.style.color = 'var(--color-text-muted)'
        }}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>
    </motion.aside>

    {/* Small Hover Tooltip (appears only when hovering directly over heading/icon area) */}
    <AnimatePresence>
      {hoveredTooltip && (
        <motion.div
          role="tooltip"
          initial={{ opacity: 0, x: -4, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -4, scale: 0.96 }}
          transition={{ duration: 0.1 }}
          style={{
            position: 'fixed',
            left: (collapsed ? 68 : 252) + 10,
            top: hoveredTooltip.top,
            transform: 'translateY(-50%)',
            zIndex: 9999,
            background: 'rgba(11, 19, 36, 0.96)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(64, 128, 255, 0.3)',
            borderRadius: 6,
            padding: '5px 10px',
            color: '#f8fafc',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.55), 0 0 10px rgba(64, 128, 255, 0.15)',
            lineHeight: 1.2,
          }}
        >
          {/* Arrow */}
          <div
            style={{
              position: 'absolute',
              left: -5,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '5px solid transparent',
              borderBottom: '5px solid transparent',
              borderRight: '5px solid rgba(64, 128, 255, 0.3)',
            }}
          />
          {hoveredTooltip.text}
        </motion.div>
      )}
    </AnimatePresence>
  </>
  )
}
