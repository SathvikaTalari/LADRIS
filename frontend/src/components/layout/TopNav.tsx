/**
 * LADRIS — Premium Top Navigation Bar
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, LogOut, User, ChevronDown, Shield, Sun, Moon, Volume2, Pause, Play, Square } from 'lucide-react'
import { voiceEngine } from '@/components/voice/voiceEngine'
import { collectPageContent } from '@/components/voice/pageContentCollector'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { roleLabel } from '@/utils'
import { GlobalSearch } from '@/components/GlobalSearch'

interface TopNavProps {
  sidebarCollapsed: boolean
  pageTitle?: string
}

const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Land Acquisition Overview',
  '/la-workbench': 'Officer Workbench',
  '/agency-portal': 'Agency Portal',
  '/priority-intelligence': 'Priority Watchlist',
  '/intelligence': 'Decision Simulator',
  '/projects': 'Projects Directory',
  '/gis': 'Interactive Map',
  '/analytics': 'Analytics & Trends',
  '/alerts': 'Alerts & Warnings',
  '/data-sources': 'Official Data Sources',
  '/data-quality': 'Data Health & Quality',
  '/admin': 'Administration & AI Settings',
}

export function TopNav({ sidebarCollapsed, pageTitle }: TopNavProps) {
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [voiceState, setVoiceState] = useState({
    isSpeaking: false,
    isPaused: false,
  })
  const lastVoiceClickRef = useRef<number>(0)

  useEffect(() => {
    return voiceEngine.subscribe((state) => {
      setVoiceState({
        isSpeaking: state.isSpeaking,
        isPaused: state.isPaused,
      })
    })
  }, [])

  const handleSpeak = () => {
    const now = Date.now()
    if (now - lastVoiceClickRef.current < 400) {
      return // Prevent duplicate speech when clicked repeatedly
    }
    lastVoiceClickRef.current = now

    if (voiceEngine.isSpeaking()) {
      return
    }

    const content = collectPageContent()
    const textToSpeak = content && content.trim().length > 0
      ? content
      : 'LADRIS voice guidance is ready.'

    voiceEngine.speak(textToSpeak)
  }

  const handlePause = () => {
    voiceEngine.pause()
  }

  const handleResume = () => {
    voiceEngine.resume()
  }

  const handleStop = () => {
    voiceEngine.stop()
  }

  const sidebarWidth = sidebarCollapsed ? 68 : 252

  const currentTitle = pageTitle ?? PAGE_LABELS[location.pathname] ?? 'LADRIS'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

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
      {/* Left: Title + Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
        {currentTitle && (
          <motion.div
            key={currentTitle}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <h1 style={{
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0,
              whiteSpace: 'nowrap',
              letterSpacing: '-0.015em',
            }}>
              {currentTitle}
            </h1>
          </motion.div>
        )}
        <div style={{ flex: 1, maxWidth: 380 }}>
          <GlobalSearch />
        </div>
      </div>

      {/* Right: Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

        {/* Speaker / Voice Playback Controls */}
        {!voiceState.isSpeaking ? (
          <NavIconButton
            icon={<Volume2 size={20} strokeWidth={1.8} />}
            onClick={handleSpeak}
            title="Start Voice Guidance"
            ariaLabel="Start Voice Guidance"
            ariaPressed={false}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {voiceState.isPaused ? (
              <NavIconButton
                icon={<Play size={18} strokeWidth={1.8} color="var(--color-primary-400, #4080ff)" />}
                onClick={handleResume}
                title="Resume Voice Guidance"
                ariaLabel="Resume Voice Guidance"
                ariaPressed={false}
              />
            ) : (
              <NavIconButton
                icon={<Pause size={18} strokeWidth={1.8} color="var(--color-primary-400, #4080ff)" />}
                onClick={handlePause}
                title="Pause Voice Guidance"
                ariaLabel="Pause Voice Guidance"
                ariaPressed={true}
              />
            )}
            <NavIconButton
              icon={<Square size={14} strokeWidth={1.8} fill="currentColor" color="var(--color-risk-critical, #ef4444)" />}
              onClick={handleStop}
              title="Stop Voice Guidance"
              ariaLabel="Stop Voice Guidance"
            />
          </div>
        )}

        {/* Alerts / Notifications Button */}
        <NavIconButton
          icon={<Bell size={20} strokeWidth={1.8} />}
          onClick={() => navigate('/alerts')}
          badge={3}
          title="Notifications"
        />

        {/* Theme Toggle Button (Moon / Sun) */}
        <NavIconButton
          icon={theme === 'dark' ? <Sun size={20} strokeWidth={1.8} /> : <Moon size={20} strokeWidth={1.8} />}
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        />

        {/* Subtle Vertical Divider */}
        <div
          style={{
            width: 1,
            height: 20,
            backgroundColor: 'var(--color-border-subtle)',
            opacity: 0.8,
            margin: '0 2px',
          }}
        />

        {/* Profile Control */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '4px 6px',
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--color-text-primary)',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--color-bg-card-hover)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {/* Small circular avatar */}
            <div style={{
              width: 28, height: 28,
              borderRadius: '50%',
              background: 'var(--color-accent-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#ffffff',
              flexShrink: 0,
            }}>
              {user?.full_name?.charAt(0)?.toUpperCase() ?? 'S'}
            </div>

            {/* Profile Information: Name & Role */}
            <div style={{ textAlign: 'left', lineHeight: 1.25 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
                {user?.full_name ?? 'System Administrator'}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 400, whiteSpace: 'nowrap' }}>
                {roleLabel(user?.role ?? 'SUPER_ADMIN')}
              </div>
            </div>

            {/* Small chevron */}
            <ChevronDown
              size={13}
              color="var(--color-text-muted)"
              style={{ transition: 'transform 0.15s', transform: dropdownOpen ? 'rotate(180deg)' : 'none', marginLeft: 2 }}
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
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: 210,
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 8,
                    padding: 6,
                    zIndex: 100,
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  {/* User Info Header */}
                  <div style={{
                    padding: '8px 10px 10px',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    marginBottom: 4,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{
                        width: 32, height: 32,
                        borderRadius: '50%',
                        background: 'var(--color-accent-secondary)',
                        border: '1px solid var(--color-border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        color: '#ffffff',
                        flexShrink: 0,
                      }}>
                        {user?.full_name?.charAt(0)?.toUpperCase() ?? 'S'}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {user?.full_name ?? 'System Administrator'}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 1 }}>
                          {user?.email ?? 'admin@ladris.gov.in'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <DropdownItem icon={User}   label="My Profile"  onClick={() => setDropdownOpen(false)} />
                  {(user?.role === 'SUPER_ADMIN' || user?.role === 'STATE_ADMIN') && (
                    <DropdownItem icon={Shield} label="Admin Panel" onClick={() => { navigate('/admin'); setDropdownOpen(false) }} />
                  )}
                  <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '4px' }} />
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
  ariaLabel,
  ariaPressed,
}: {
  icon: React.ReactNode
  onClick: () => void
  badge?: number
  title?: string
  ariaLabel?: string
  ariaPressed?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      aria-pressed={ariaPressed}
      style={{
        position: 'relative',
        width: 36, height: 36,
        borderRadius: 6,
        background: 'transparent',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--color-text-secondary)',
        transition: 'background 0.15s ease, color 0.15s ease',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = 'var(--color-text-primary)'
        e.currentTarget.style.background = 'var(--color-bg-card-hover)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'var(--color-text-secondary)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {icon}
      {badge ? (
        <span style={{
          position: 'absolute',
          top: 6, right: 6,
          width: 6, height: 6,
          borderRadius: '50%',
          backgroundColor: '#ff4757',
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
