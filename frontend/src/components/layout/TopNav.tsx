/**
 * LADRIS — Premium Top Navigation Bar
 */
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, LogOut, User, ChevronDown, Shield, Sun, Moon } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { roleLabel } from '@/utils'
import { GlobalSearch } from '@/components/GlobalSearch'

interface TopNavProps {
  sidebarCollapsed: boolean
  pageTitle?: string
}

const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/priority-intelligence': 'Priority Intelligence',
  '/intelligence': 'Decision Intelligence',
  '/projects': 'Projects',
  '/gis': 'GIS Command Map',
  '/analytics': 'Analytics',
  '/alerts': 'Alerts',
  '/data-sources': 'Data Sources',
  '/data-quality': 'Data Quality',
  '/admin': 'Administration',
}

export function TopNav({ sidebarCollapsed, pageTitle }: TopNavProps) {
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [time, setTime] = useState(new Date())

  const sidebarWidth = sidebarCollapsed ? 68 : 252

  const currentTitle = pageTitle ?? PAGE_LABELS[location.pathname] ?? 'LADRIS'

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dateStr = time.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <motion.header
      animate={{ paddingLeft: sidebarWidth + 20 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: 'fixed',
        top: 0, right: 0, left: 0,
        height: 'var(--topnav-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingRight: 20,
        zIndex: 40,
      }}
    >
      {/* Left: Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1 }}>
        {currentTitle && (
          <motion.div
            key={currentTitle}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}
          >
            <h1 style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0,
              whiteSpace: 'nowrap',
              letterSpacing: '-0.015em',
            }}>
              {currentTitle}
            </h1>
            {/* Decorative separator */}
            <span style={{
              width: 4, height: 4,
              borderRadius: '50%',
              background: 'rgba(64,128,255,0.4)',
              display: 'inline-block',
              flexShrink: 0,
            }} />
            {/* Date chip */}
            <span style={{
              fontSize: '0.72rem',
              color: '#4a5880',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}>
              {dateStr}
            </span>
          </motion.div>
        )}
        <div style={{ flex: 1, maxWidth: 500 }}>
          <GlobalSearch />
        </div>
      </div>

      {/* Right: Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

        {/* Live Clock */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{timeStr}</span>
        </div>

        {/* System Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '5px 12px',
          background: 'rgba(19, 136, 8, 0.1)',
          border: '1px solid rgba(19, 136, 8, 0.25)',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.72rem',
          fontWeight: 700,
          color: '#138808',
          letterSpacing: '0.03em',
        }}>
          <span style={{
            width: 7, height: 7,
            borderRadius: '50%',
            background: '#138808',
            animation: 'pulse-glow 1.5s ease-in-out infinite',
            flexShrink: 0,
            display: 'inline-block',
          }} />
          Live
        </div>

        {/* Alerts Button */}
        <NavIconButton
          icon={<Bell size={15} strokeWidth={2} />}
          onClick={() => navigate('/alerts')}
          badge={3}
          title="Alerts"
        />

        {/* Theme Toggle Button (Light / Dark) */}
        <NavIconButton
          icon={theme === 'dark' ? <Sun size={16} color="#facc15" strokeWidth={2} /> : <Moon size={16} color="#2563eb" strokeWidth={2} />}
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        />

        {/* User Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '7px 13px 7px 8px',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              color: 'var(--color-text-primary)',
              transition: 'all 0.15s',
              boxShadow: 'var(--shadow-sm)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--color-border-strong)'
              e.currentTarget.style.background = 'var(--color-bg-card-hover)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--color-border-default)'
              e.currentTarget.style.background = 'var(--color-bg-elevated)'
            }}
          >
            {/* Avatar with gradient */}
            <div style={{
              width: 28, height: 28,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(64,128,255,0.4) 0%, rgba(124,92,252,0.4) 100%)',
              border: '1.5px solid rgba(64,128,255,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.6875rem',
              fontWeight: 800,
              color: '#7daaff',
              boxShadow: '0 0 10px rgba(64,128,255,0.2)',
              flexShrink: 0,
            }}>
              {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <div style={{ textAlign: 'left', lineHeight: 1.25 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                {user?.full_name?.split(' ')[0] ?? 'User'}
              </div>
              <div style={{ fontSize: '0.625rem', color: 'rgba(64,128,255,0.8)', fontWeight: 600, letterSpacing: '0.04em' }}>
                {roleLabel(user?.role ?? 'VIEWER')}
                {user?.district_code ? ` · ${user.district_code}` : user?.state_code ? ` · ${user.state_code}` : user?.agency_name ? ` · ${user.agency_name.split(' ')[0]}` : ''}
              </div>
            </div>

            <ChevronDown
              size={13}
              color="rgba(74,88,128,0.8)"
              style={{ transition: 'transform 0.15s', transform: dropdownOpen ? 'rotate(180deg)' : 'none' }}
            />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <>
                {/* Backdrop */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                  onClick={() => setDropdownOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: 220,
                    background: 'linear-gradient(145deg, #0e1a2e 0%, #080f1c 100%)',
                    border: '1px solid rgba(64,128,255,0.15)',
                    borderRadius: 14,
                    padding: 6,
                    zIndex: 100,
                    boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  {/* User Info Header */}
                  <div style={{
                    padding: '10px 12px 12px',
                    borderBottom: '1px solid rgba(64,128,255,0.08)',
                    marginBottom: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(64,128,255,0.3) 0%, rgba(124,92,252,0.3) 100%)',
                        border: '1.5px solid rgba(64,128,255,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.875rem',
                        fontWeight: 800,
                        color: '#7daaff',
                        flexShrink: 0,
                      }}>
                        {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#eef2ff' }}>
                          {user?.full_name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#4a5880', marginTop: 2 }}>
                          {user?.email}
                        </div>
                      </div>
                    </div>
                  </div>

                  <DropdownItem icon={User}   label="My Profile"  onClick={() => setDropdownOpen(false)} />
                  {(user?.role === 'SUPER_ADMIN' || user?.role === 'STATE_ADMIN') && (
                    <DropdownItem icon={Shield} label="Admin Panel" onClick={() => { navigate('/admin'); setDropdownOpen(false) }} />
                  )}
                  <div style={{ height: 1, background: 'rgba(64,128,255,0.08)', margin: '6px 4px' }} />
                  <DropdownItem icon={LogOut} label="Sign Out"    onClick={handleLogout} danger />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.header>
  )
}

/* ── Nav Icon Button ── */
function NavIconButton({
  icon,
  onClick,
  badge,
  title,
}: {
  icon: React.ReactNode
  onClick: () => void
  badge?: number
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        position: 'relative',
        width: 36, height: 36,
        borderRadius: 'var(--radius-lg)',
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--color-text-secondary)',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--color-border-strong)'
        e.currentTarget.style.color = 'var(--color-text-primary)'
        e.currentTarget.style.background = 'var(--color-bg-card-hover)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--color-border-default)'
        e.currentTarget.style.color = 'var(--color-text-secondary)'
        e.currentTarget.style.background = 'var(--color-bg-elevated)'
      }}
    >
      {icon}
      {badge ? (
        <div style={{
          position: 'absolute',
          top: 5, right: 5,
          width: 7, height: 7,
          borderRadius: '50%',
          background: 'var(--color-risk-critical)',
          border: '1.5px solid var(--color-bg-primary)',
          boxShadow: '0 0 6px rgba(255,71,87,0.5)',
        }} />
      ) : null}
    </button>
  )
}

/* ── Dropdown Item ── */
function DropdownItem({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '8px 12px',
        borderRadius: 8,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: danger ? '#ff4757' : '#8898b8',
        fontSize: '0.8375rem',
        fontWeight: 500,
        transition: 'all 0.12s',
        textAlign: 'left',
        letterSpacing: '-0.005em',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? 'rgba(255,71,87,0.06)' : 'rgba(64,128,255,0.06)'
        e.currentTarget.style.color = danger ? '#ff8090' : '#eef2ff'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = danger ? '#ff4757' : '#8898b8'
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}
