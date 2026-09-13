/**
 * LADRIS — Premium Landing / Pre-Login Page
 * Inspired by Government Intelligence Platform aesthetics
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  MapPin, ShieldCheck, Zap, Brain,
  ArrowRight, ChevronRight, Sun, Moon, Menu, X,
  AlertTriangle, TrendingUp,
  User, Map, FileText, Briefcase, Building, Settings
} from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'
import KeyComponentsSection from './sections/KeyComponentsSection'
import FeaturesRippleSection from './sections/FeaturesRippleSection'
import RolesConnectedSection from './sections/RolesConnectedSection'

/* ─── Feature cards data ────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: <Zap size={28} strokeWidth={1.8} />,
    title: 'Real-time Risk Scoring',
    desc: 'Know the risk early. LADRIS AI checks project data and shows whether a project has low, medium, or high delay risk.',
    color: '#4a6fa5',
  },
  {
    icon: <Brain size={28} strokeWidth={1.8} />,
    title: 'AI Decision Intelligence',
    desc: 'Get smarter decisions. AI studies past and current data to find risky patterns and help teams choose the right action early.',
    color: '#4a6fa5',
  },
  {
    icon: <MapPin size={28} strokeWidth={1.8} />,
    title: 'GIS Spatial Analytics',
    desc: 'See risk on the map. View project locations, high-risk areas, and district-wise patterns on an interactive GIS map for faster understanding.',
    color: '#4a6fa5',
  },
  {
    icon: <AlertTriangle size={28} strokeWidth={1.8} />,
    title: 'Predictive Bottleneck Detection',
    desc: 'Find problems before they grow. LADRIS AI detects issues like approval, legal, compensation, and documentation delays before they seriously affect the project.',
    color: '#4a6fa5',
  },
  {
    icon: <TrendingUp size={28} strokeWidth={1.8} />,
    title: 'Analytics & Simulation',
    desc: 'Interactive corridor simulator for safe evaluation of policy changes, budget scenarios, and timeline alternatives before implementation.',
    color: '#7c5cfc',
  },
  {
    icon: <ShieldCheck size={28} strokeWidth={1.8} />,
    title: 'Secure Government Access',
    desc: 'Role-based access control aligned to Ministry hierarchy — Central, State, District and LA officers each get a tailored command view.',
    color: '#00b894',
  },
]



/* ─── Hero Slideshow data ───────────────────────────────────────────────── */
const HERO_SLIDES = [
  {
    src: '/slide_highway.jpg',
    ministry: 'Ministry of Road Transport & Highways (MoRTH)',
    caption: 'Keeping Highway Projects Moving',
    tag: 'Land Acquisition & Highways',
  },
  {
    src: '/slide_railway.jpg',
    ministry: 'Ministry of Railways',
    caption: 'Clearing the Way for Railway Projects',
    tag: 'Land Acquisition & Railways',
  },
  {
    src: '/slide_metro.jpg',
    ministry: 'Ministry of Housing & Urban Affairs (MoHUA)',
    caption: 'Supporting Faster Metro Development',
    tag: 'Land Acquisition & Metro ',
  },
  {
    src: '/slide_powergrid.jpg',
    ministry: 'Ministry of Power',
    caption: 'Keeping Power Projects on Track',
    tag: 'Land Acquisition & Power Grids',
  },
  {
    src: '/slide_airport.jpg',
    ministry: 'Ministry of Civil Aviation',
    caption: 'Supporting Timely Airport Development',
    tag: 'Land Acquisition & Airports',
  },
  {
    src: '/slide_urban_const.jpg',
    ministry: 'Ministry of Housing & Urban Affairs (MoHUA)',
    caption: 'Enabling Timely Urban Development',
    tag: 'Land Acquisition & Urban Projects',
  },
  {
    src: '/slide_industrial.jpg',
    ministry: 'Ministry of Commerce & Industry',
    caption: 'Enabling Faster Industrial Development',
    tag: 'Land Acquisition & Industrial Zones',
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])
  const heroY = useTransform(scrollY, [0, 400], [0, 80])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Auto-advance slideshow every 4.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % HERO_SLIDES.length)
    }, 4500)
    return () => clearInterval(timer)
  }, [])

  const goToSlide = (idx: number) => setActiveSlide(idx)
  const prevSlide = () => setActiveSlide(prev => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)
  const nextSlide = () => setActiveSlide(prev => (prev + 1) % HERO_SLIDES.length)

  const handleAccessDashboard = () => navigate('/login')

  /* ── Color tokens based on theme ── */
  const colors = {
    bg: isDark ? '#060f1e' : '#f0f4f9',
    navBg: isDark
      ? scrolled ? 'rgba(6,15,30,0.92)' : 'rgba(6,15,30,0.7)'
      : scrolled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)',
    navBorder: isDark ? 'rgba(244,119,33,0.15)' : 'rgba(0,51,102,0.12)',
    navText: isDark ? '#c9d8f0' : '#2b4263',
    logoText: isDark ? '#f0f6fc' : '#0a1d37',
    cardBg: isDark ? 'rgba(12,26,48,0.95)' : '#ffffff',
    cardBorder: isDark ? 'rgba(244,119,33,0.14)' : 'rgba(0,51,102,0.1)',
    overviewBg: isDark ? '#060f1e' : '#f0f4f9',
    sectionTitle: isDark ? '#f0f6fc' : '#0a1d37',
    sectionText: isDark ? '#94a9c9' : '#4a6280',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.bg,
      fontFamily: 'Inter, system-ui, sans-serif',
      color: colors.sectionTitle,
      overflowX: 'hidden',
      transition: 'background 0.3s ease',
    }}>

      {/* ════════════════════════════════════════════════════
           HEADER — Two-row government portal structure
           Row 1: Govt top bar (flag | ministry | utility icons)
           Row 2: Main navbar (emblem+logo | nav links | actions)
          ════════════════════════════════════════════════════ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 200,
        boxShadow: scrolled
          ? (isDark ? '0 4px 28px rgba(0,0,0,0.6)' : '0 2px 12px rgba(0,51,102,0.14)')
          : 'none',
        transition: 'box-shadow 0.3s ease',
      }}>

        {/* ── ROW 1 · Government Identification Top Bar ── */}
        <div style={{
          background: isDark ? '#070c1b' : '#ffffff',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
          padding: '0 32px',
          height: 65,
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>

          {/* Left: Flag + हिंदी/English govt label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>

            {/* Indian Tricolor Flag — inline SVG, no background padding */}
            <svg width="30" height="48" viewBox="0 0 44 30" style={{ flexShrink: 0, borderRadius: 2, display: 'block' }} xmlns="http://www.w3.org/2000/svg">
              {/* Saffron */}
              <rect x="0" y="0" width="44" height="10" fill="#FF9933" />
              {/* White */}
              <rect x="0" y="10" width="44" height="10" fill="#FFFFFF" />
              {/* Green */}
              <rect x="0" y="20" width="44" height="10" fill="#138808" />
              {/* Ashoka Chakra */}
              <circle cx="22" cy="15" r="4.2" fill="none" stroke="#000080" strokeWidth="0.8" />
              <circle cx="22" cy="15" r="0.7" fill="#000080" />
              {[...Array(24)].map((_, i) => {
                const angle = (i * 15 * Math.PI) / 180
                return (
                  <line
                    key={i}
                    x1={22 + 0.7 * Math.cos(angle)}
                    y1={15 + 0.7 * Math.sin(angle)}
                    x2={22 + 4.2 * Math.cos(angle)}
                    y2={15 + 4.2 * Math.sin(angle)}
                    stroke="#000080"
                    strokeWidth="0.5"
                  />
                )
              })}
            </svg>
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: isDark ? '#c9d8f0' : '#1a2e4a', lineHeight: 1.25 }}>
                भारत सरकार
              </div>
              <div style={{ fontSize: '0.65rem', fontWeight: 500, color: isDark ? '#5a7194' : '#5a7194' }}>
                Government of India
              </div>
            </div>
          </div>

          {/* Center: Ministry name (Hindi + English) */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isDark ? '#c9d8f0' : '#1a2e4a', lineHeight: 1.3 }}>
              ग्रामीण विकास मंत्रालय
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: 500, color: isDark ? '#5a7194' : '#5a7194' }}>
              Ministry of Rural Development
            </div>
          </div>

          {/* Right: Skip link + utility icon buttons + theme toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 200, justifyContent: 'flex-end' }}>
            <a href="#main-content" style={{
              fontSize: '0.68rem', fontWeight: 500, color: isDark ? '#4a6280' : '#64748b',
              textDecoration: 'none', marginRight: 6, whiteSpace: 'nowrap', transition: 'color 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = isDark ? '#7daaff' : '#003366')}
              onMouseLeave={e => (e.currentTarget.style.color = isDark ? '#4a6280' : '#64748b')}
            >
              Skip to main content
            </a>
            {/* Utility icon buttons matching reference */}
            {([
              { title: 'Site Map', path: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z' },
            ] as { title: string; path: string }[]).map(({ title, path }) => (
              <button key={title} title={title} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 5, background: 'none',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                cursor: 'pointer', color: isDark ? '#6b84a8' : '#64748b', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#c9d8f0' : '#003366'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.28)' : '#003366'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,51,102,0.05)' }}
                onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#6b84a8' : '#64748b'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'; e.currentTarget.style.background = 'none' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d={path} /></svg>
              </button>
            ))}
            {/* Globe / Language */}
            <button title="Language" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 5, background: 'none', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, cursor: 'pointer', color: isDark ? '#6b84a8' : '#64748b', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#c9d8f0' : '#003366'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.28)' : '#003366'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,51,102,0.05)' }}
              onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#6b84a8' : '#64748b'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'; e.currentTarget.style.background = 'none' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
            </button>
            {/* Accessibility */}
            <button title="Accessibility" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 5, background: 'none', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, cursor: 'pointer', color: isDark ? '#6b84a8' : '#64748b', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#c9d8f0' : '#003366'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.28)' : '#003366'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,51,102,0.05)' }}
              onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#6b84a8' : '#64748b'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'; e.currentTarget.style.background = 'none' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1.5" /><path d="m9 12 1.5 5.5M15 12l-1.5 5.5M9 12l-2-3.5M15 12l2-3.5M9 12h6" /></svg>
            </button>
            {/* Help */}
            <button title="Help" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 5, background: 'none', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, cursor: 'pointer', color: isDark ? '#6b84a8' : '#64748b', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#c9d8f0' : '#003366'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.28)' : '#003366'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,51,102,0.05)' }}
              onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#6b84a8' : '#64748b'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'; e.currentTarget.style.background = 'none' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><circle cx="12" cy="17" r="0.5" fill="currentColor" /></svg>
            </button>
            {/* Theme toggle */}
            <button title={isDark ? 'Light mode' : 'Dark mode'} onClick={toggleTheme} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 5, background: 'none', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, cursor: 'pointer', color: isDark ? '#6b84a8' : '#64748b', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#facc15' : '#003366'; e.currentTarget.style.borderColor = isDark ? 'rgba(250,204,21,0.4)' : '#003366'; e.currentTarget.style.background = isDark ? 'rgba(250,204,21,0.08)' : 'rgba(0,51,102,0.05)' }}
              onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#6b84a8' : '#64748b'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'; e.currentTarget.style.background = 'none' }}
            >
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
        </div>

        {/* ── ROW 2 · Main Navigation Bar ── */}
        <div style={{
          background: isDark
            ? (scrolled ? 'rgba(5,10,22,0.98)' : 'rgba(5,10,22,0.95)')
            : (scrolled ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.98)'),
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: `1px solid ${isDark ? 'rgba(244,119,33,0.1)' : '#e2e8f0'}`,
          transition: 'background 0.3s ease',
        }}>
          <div style={{
            maxWidth: 1320, margin: '0 auto',
            padding: '0 32px', height: 75,
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 16,
          }}>

            {/* Left: Emblem + Divider + Logo + Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
              {/* MoRTH Ashoka Emblem — pre-cropped: emblem + Hindi only, no English text */}
              <img
                src="/logo_morth_clean.png"
                alt="MoRTH Emblem"
                style={{ height: 40, width: 'auto', display: 'block', flexShrink: 0 }}
              />
              {/* Vertical divider */}
              <div style={{ width: 1, height: 30, background: isDark ? 'rgba(255,255,255,0.14)' : '#cbd5e1', margin: '0 2px', flexShrink: 0 }} />
              {/* logo.png + Brand text */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <img src="/logo.png" alt="LADRIS" style={{ width: 38, height: 38, objectFit: 'contain', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: isDark ? '#f0f6fc' : '#0a1d37', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                    LADRIS<span style={{ color: '#4080ff' }}></span>
                  </div>
                  <div style={{ fontSize: '0.45rem', fontWeight: 600, color: isDark ? '#4a6280' : '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 }}>
                    Land Acquisition Delay Risk<br />
                    Intelligence Platform
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Nav Links with dropdown chevrons */}
            <nav className="landing-nav-links" style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
              {[
                { label: 'Features', dropdown: false },
                { label: 'Architecture', dropdown: false },
                { label: 'Analytics', dropdown: true },
                { label: 'About', dropdown: true },
                { label: 'Help & Feedback', dropdown: true },
                { label: 'Documents', dropdown: true },
              ].map(({ label, dropdown }) => (
                <button
                  key={label}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0 13px', height: 60,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: '0.865rem', fontWeight: 500,
                    color: isDark ? '#94a9c9' : '#334155',
                    fontFamily: 'inherit', whiteSpace: 'nowrap',
                    letterSpacing: '0.005em', transition: 'all 0.15s',
                    borderBottom: '3px solid transparent',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = isDark ? '#f0f6fc' : '#003366'
                    e.currentTarget.style.borderBottomColor = '#f47721'
                    e.currentTarget.style.background = isDark ? 'rgba(244,119,33,0.05)' : 'rgba(0,51,102,0.04)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = isDark ? '#94a9c9' : '#334155'
                    e.currentTarget.style.borderBottomColor = 'transparent'
                    e.currentTarget.style.background = 'none'
                  }}
                >
                  {label}
                  {dropdown && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55, flexShrink: 0 }}>
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  )}
                </button>
              ))}
            </nav>

            {/* Right: GitHub outlined + Login solid */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>

              {/* GitHub — outlined button */}
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '7px 16px',
                  background: 'transparent',
                  border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.22)' : '#cbd5e1'}`,
                  borderRadius: 6, color: isDark ? '#c9d8f0' : '#334155',
                  fontWeight: 600, fontSize: '0.855rem',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.18s', letterSpacing: '0.005em',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.45)' : '#003366'
                  e.currentTarget.style.color = isDark ? '#ffffff' : '#003366'
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,51,102,0.05)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.22)' : '#cbd5e1'
                  e.currentTarget.style.color = isDark ? '#c9d8f0' : '#334155'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {/* GitHub SVG icon */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
                GitHub
              </motion.button>

              {/* Login — solid filled button */}
              <motion.button
                id="nav-login-btn"
                whileHover={{ scale: 1.04, translateY: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleAccessDashboard}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 22px',
                  background: isDark ? 'linear-gradient(135deg,#4080ff,#7c5cfc)' : '#003366',
                  border: 'none', borderRadius: 6,
                  color: '#ffffff', fontWeight: 700,
                  fontSize: '0.875rem', cursor: 'pointer',
                  fontFamily: 'inherit', letterSpacing: '0.02em',
                  boxShadow: isDark ? '0 3px 14px rgba(64,128,255,0.4)' : '0 3px 12px rgba(0,51,102,0.35)',
                }}
              >
                Login
              </motion.button>

              {/* Mobile hamburger (hidden on desktop) */}
              <button
                className="landing-mobile-menu-btn"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94a9c9' : '#334155', padding: 4 }}
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>

          {/* Mobile dropdown */}
          {mobileMenuOpen && (
            <div style={{
              background: isDark ? 'rgba(5,10,22,0.98)' : '#ffffff',
              borderTop: `1px solid ${isDark ? 'rgba(244,119,33,0.1)' : '#e2e8f0'}`,
              padding: '12px 24px 20px',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              {['Features', 'Architecture', 'Analytics', 'About', 'Help & Feedback', 'Documents'].map(link => (
                <button key={link} style={{
                  textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '10px 12px', borderRadius: 8,
                  fontSize: '0.9rem', fontWeight: 500,
                  color: isDark ? '#94a9c9' : '#334155', fontFamily: 'inherit',
                }}>{link}</button>
              ))}
              <div style={{ marginTop: 8, paddingTop: 12, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`, display: 'flex', gap: 10 }}>
                <button style={{ flex: 1, padding: '9px 0', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1'}`, color: isDark ? '#c9d8f0' : '#334155', fontWeight: 600, fontSize: '0.875rem' }}>GitHub</button>
                <button onClick={handleAccessDashboard} style={{ flex: 1, padding: '9px 0', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', background: '#003366', border: 'none', color: '#ffffff', fontWeight: 700, fontSize: '0.875rem' }}>Login</button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ════ HERO SECTION ════ */}
      <div ref={heroRef} style={{ position: 'relative', overflow: 'hidden' }}>

        {/* ── Slideshow background images (crossfade) ── */}
        {HERO_SLIDES.map((slide, i) => (
          <div
            key={slide.src}
            style={{
              position: 'absolute', inset: 0, zIndex: 0,
              backgroundImage: `url(${slide.src})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center 40%',
              opacity: i === activeSlide ? 1 : 0,
              transition: 'opacity 1.2s cubic-bezier(0.4,0,0.2,1)',
              // Ken-Burns zoom on the active slide
              transform: i === activeSlide ? 'scale(1.05)' : 'scale(1)',
              transformOrigin: 'center center',
            }}
          />
        ))}

        {/* Gradient overlays */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(180deg, rgba(6,15,30,0.52) 0%, rgba(6,15,30,0.22) 45%, rgba(6,15,30,0.78) 100%)',
        }} />
        {/* Left text fade */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(90deg, rgba(6,15,30,0.55) 0%, transparent 50%)',
        }} />

        {/* Subtle grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }} />

        <motion.div
          style={{ opacity: heroOpacity, y: heroY, position: 'relative', zIndex: 2 }}
        >
          <div style={{
            maxWidth: 1280, margin: '0 auto', padding: '48px 40px 52px',
          }}>
            <div style={{ maxWidth: 680 }}>
              {/* Main headline */}
              <motion.h1
                initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, delay: 0.1 }}
                style={{
                  fontSize: 'clamp(2rem, 4vw, 3rem)',
                  fontWeight: 900,
                  lineHeight: 1.07,
                  letterSpacing: '-0.04em',
                  color: '#ffffff',
                  marginBottom: 16,
                  textShadow: '0 2px 20px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.9)',
                }}
              >
                National Land Acquisition&nbsp;
                <span style={{
                  background: 'linear-gradient(135deg, #f47721 0%, #facc15 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>Intelligence</span>
                <br />Command Center
              </motion.h1>

              {/* Sub-headline */}
              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                style={{
                  fontSize: '1.1rem',
                  color: 'rgba(255,255,255,0.88)',
                  lineHeight: 1.75,
                  maxWidth: 560,
                  marginBottom: 28,
                  fontWeight: 400,
                  textShadow: '0 1px 8px rgba(0,0,0,0.7)',
                }}
              >
                LADRIS integrates real-time risk analytics, GIS spatial intelligence,
                machine-learning models, and role-based governance into a single unified
                platform for national infrastructure decision makers.
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.3 }}
                style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}
              >
                <motion.button
                  id="hero-access-dashboard-btn"
                  whileHover={{ scale: 1.04, translateY: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAccessDashboard}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    padding: '14px 32px',
                    background: 'linear-gradient(135deg, #f47721 0%, #d97706 100%)',
                    border: 'none', borderRadius: 12,
                    color: '#ffffff', fontWeight: 800,
                    fontSize: '1rem', cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: '0 6px 28px rgba(244,119,33,0.55), inset 0 1px 0 rgba(255,255,255,0.2)',
                    letterSpacing: '-0.01em',
                    transition: 'all 0.2s',
                  }}
                >
                  Access Dashboard
                  <ArrowRight size={18} strokeWidth={2.5} />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03, translateY: -1 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    padding: '13px 28px',
                    background: 'rgba(6,15,30,0.65)',
                    border: '1.5px solid rgba(255,255,255,0.35)',
                    borderRadius: 12,
                    color: '#ffffff', fontWeight: 600,
                    fontSize: '1rem', cursor: 'pointer',
                    fontFamily: 'inherit',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                    letterSpacing: '-0.01em',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(6,15,30,0.85)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(6,15,30,0.65)')}
                >
                  Read More
                  <ChevronRight size={17} strokeWidth={2.5} />
                </motion.button>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* ── Slide caption (bottom-right) ── */}
        <div style={{
          position: 'absolute', bottom: 56, right: 40, zIndex: 10,
          textAlign: 'right',
          opacity: 0.92,
          pointerEvents: 'none',
          maxWidth: 360,
        }}>
          <div style={{
            fontSize: '0.72rem', fontWeight: 700,
            color: 'rgba(255,255,255,0.6)', letterSpacing: '0.02em',
            marginBottom: 3,
          }}>
            {HERO_SLIDES[activeSlide].ministry}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.88)', fontWeight: 600, lineHeight: 1.3 }}>
            {HERO_SLIDES[activeSlide].caption}
          </div>
        </div>

        {/* ── Prev / Next arrows ── */}
        <button
          onClick={prevSlide}
          style={{
            position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, background: 'rgba(6,15,30,0.55)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%', width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff', backdropFilter: 'blur(8px)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(244,119,33,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(6,15,30,0.55)')}
          aria-label="Previous slide"
        >
          <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <button
          onClick={nextSlide}
          style={{
            position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, background: 'rgba(6,15,30,0.55)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%', width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff', backdropFilter: 'blur(8px)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(244,119,33,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(6,15,30,0.55)')}
          aria-label="Next slide"
        >
          <ChevronRight size={18} />
        </button>

        {/* ── Navigation dots ── */}
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', gap: 10, alignItems: 'center',
        }}>
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                width: i === activeSlide ? 28 : 8,
                height: 8,
                borderRadius: 4,
                background: i === activeSlide ? '#f47721' : 'rgba(255,255,255,0.4)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: i === activeSlide ? '0 0 8px rgba(244,119,33,0.7)' : 'none',
              }}
            />
          ))}
        </div>
      </div>



      {/* ════ OVERVIEW SECTION ════ */}
      <section style={{
        background: colors.overviewBg,
        padding: '80px 40px',
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 80, alignItems: 'start',
        }}
          className="landing-overview-grid"
        >
          {/* Left: Overview text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.65 }}
          >

            <h2 style={{
              fontSize: 'clamp(1.8rem, 3vw, 2.6rem)',
              fontWeight: 900, letterSpacing: '-0.035em',
              color: colors.sectionTitle, lineHeight: 1.15,
              marginBottom: 20,
            }}>
              Overview
            </h2>

            <p style={{
              fontSize: '0.95rem', lineHeight: 1.8,
              color: colors.sectionText, marginBottom: 36,
            }}>
              LADRIS AI is an AI-powered decision-support platform for land acquisition. It studies historical and live project data, predicts delay probability, finds the main risk factors, shows risky projects on GIS maps, sends alerts and recommends preventive actions.
            </p>

            {/* CTA pair */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <motion.button
                id="overview-access-dashboard-btn"
                whileHover={{ scale: 1.04, translateY: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleAccessDashboard}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '12px 28px',
                  background: isDark
                    ? 'linear-gradient(135deg, #4080ff 0%, #7c5cfc 100%)'
                    : 'linear-gradient(135deg, #003366 0%, #004a99 100%)',
                  border: 'none', borderRadius: 10,
                  color: '#ffffff', fontWeight: 800,
                  fontSize: '0.9375rem', cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: isDark
                    ? '0 4px 20px rgba(64,128,255,0.4)'
                    : '0 4px 18px rgba(0,51,102,0.3)',
                  letterSpacing: '-0.01em',
                }}
              >
                Access Dashboard
                <ArrowRight size={17} strokeWidth={2.5} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '11px 24px',
                  background: 'transparent',
                  border: `1.5px solid ${isDark ? 'rgba(64,128,255,0.35)' : 'rgba(0,51,102,0.3)'}`,
                  borderRadius: 10,
                  color: isDark ? '#7daaff' : '#003366',
                  fontWeight: 600, fontSize: '0.9375rem',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isDark ? 'rgba(64,128,255,0.08)' : 'rgba(0,51,102,0.06)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                Read More
                <ChevronRight size={16} />
              </motion.button>
            </div>
          </motion.div>

          {/* Right: Feature mini cards (2×2 grid) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.65, delay: 0.1 }}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
            }}
          >
            {FEATURES.slice(0, 4).map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.05 * i }}
                whileHover={{ translateY: -3 }}
                style={{
                  background: colors.cardBg,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: 16,
                  padding: '24px 20px',
                  boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.45)' : '0 2px 12px rgba(0,51,102,0.08)',
                  transition: 'all 0.22s ease',
                  cursor: 'default',
                  position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = `${feat.color}55`
                  e.currentTarget.style.boxShadow = isDark
                    ? `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${feat.color}22`
                    : `0 6px 24px rgba(0,51,102,0.14), 0 0 0 1px ${feat.color}22`
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = colors.cardBorder
                  e.currentTarget.style.boxShadow = isDark ? '0 4px 24px rgba(0,0,0,0.45)' : '0 2px 12px rgba(0,51,102,0.08)'
                }}
              >
                {/* Top accent line */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                  background: `linear-gradient(90deg, ${feat.color}, transparent)`,
                  opacity: 0.6,
                }} />

                <div style={{
                  color: feat.color, marginBottom: 14,
                  display: 'flex', alignItems: 'center',
                }}>
                  {feat.icon}
                </div>
                <div style={{
                  fontSize: '0.9rem', fontWeight: 700,
                  color: colors.sectionTitle,
                  marginBottom: 8, lineHeight: 1.3,
                }}>
                  {feat.title}
                </div>
                <p style={{
                  fontSize: '0.8rem', lineHeight: 1.65,
                  color: colors.sectionText, margin: 0,
                }}>
                  {feat.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════ CHALLENGES SECTION ════ */}
      <section style={{
        background: isDark ? '#07111f' : '#f5f8fc',
        padding: '80px 40px 60px',
        borderTop: `1px solid ${isDark ? 'rgba(74,111,165,0.12)' : 'rgba(74,111,165,0.1)'}`,
        borderBottom: `1px solid ${isDark ? 'rgba(74,111,165,0.12)' : 'rgba(74,111,165,0.1)'}`,
        overflow: 'hidden',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            style={{ textAlign: 'center', marginBottom: 52 }}
          >
            <h2 style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800,
              color: colors.sectionTitle, letterSpacing: '-0.03em',
              lineHeight: 1.2, marginBottom: 14,
            }}>
              Challenges in Land Acquisition
            </h2>
            <p style={{
              fontSize: '0.92rem', color: colors.sectionText,
              maxWidth: 560, margin: '0 auto', lineHeight: 1.75,
            }}>
              Land acquisition for infrastructure projects faces deep-rooted challenges across administration, law, and coordination.
            </p>
          </motion.div>

          {/* 6 Challenge cards — 3×2 grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20,
          }}>
            {[
              { title: 'Approval Delays', desc: 'Too many approvals and slow government processes can hold up land acquisition and delay the overall infrastructure project.' },
              { title: 'Legal & Ownership Issues', desc: 'Land disputes and ownership conflicts can stop acquisition, create uncertainty, and delay project progress for a long time.' },
              { title: 'Compensation Delays', desc: 'Late compensation can slow land possession and create difficulties for landowners, authorities, and project teams during acquisition.' },
              { title: 'Incomplete Documents', desc: 'Missing documents and pending notifications can slow verification, approvals, and other important steps in the land acquisition process.' },
              { title: 'Rehabilitation Challenges', desc: 'Slow rehabilitation and resettlement can affect families and delay land acquisition, creating further impact on overall project implementation.' },
              { title: 'Coordination Gaps', desc: 'Different departments and agencies must work together, but slow communication and responses can create bottlenecks and delay project progress.' },
            ].map((challenge, i) => (
              <motion.div
                key={challenge.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.07 }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(74,111,165,0.4)'
                    ; (e.currentTarget as HTMLDivElement).style.boxShadow = isDark
                      ? '0 8px 28px rgba(0,0,0,0.4), 0 0 0 1px rgba(74,111,165,0.2)'
                      : '0 6px 22px rgba(74,111,165,0.12), 0 0 0 1px rgba(74,111,165,0.15)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = isDark ? 'rgba(74,111,165,0.14)' : 'rgba(74,111,165,0.1)'
                    ; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                }}
                style={{
                  background: colors.cardBg,
                  border: `1px solid ${isDark ? 'rgba(74,111,165,0.14)' : 'rgba(74,111,165,0.1)'}`,
                  borderRadius: 14, padding: '24px 22px',
                  cursor: 'default',
                  transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {/* Top accent bar */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: 'linear-gradient(90deg, #4a6fa5, transparent)',
                  borderRadius: '14px 14px 0 0',
                }} />

                {/* Number */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: isDark ? 'rgba(74,111,165,0.15)' : 'rgba(74,111,165,0.1)',
                  border: `1px solid ${isDark ? 'rgba(74,111,165,0.3)' : 'rgba(74,111,165,0.25)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: 800, color: '#4a6fa5',
                  marginBottom: 14, flexShrink: 0,
                }}>
                  {String(i + 1).padStart(2, '0')}
                </div>

                {/* Title */}
                <h3 style={{
                  fontSize: '0.95rem', fontWeight: 700,
                  color: colors.sectionTitle, marginBottom: 8,
                  lineHeight: 1.3,
                }}>
                  {challenge.title}
                </h3>

                {/* Description */}
                <p style={{
                  fontSize: '0.83rem', color: colors.sectionText,
                  lineHeight: 1.7, margin: 0,
                }}>
                  {challenge.desc}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Bridge connector */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: 'easeOut', delay: 0.45 }}
            style={{ textAlign: 'center', marginTop: 52 }}
          >
            {/* Vertical line */}
            <div style={{
              width: 1, height: 40, background: `linear-gradient(to bottom, rgba(74,111,165,0.35), transparent)`,
              margin: '0 auto 20px',
            }} />

          </motion.div>

        </div>
      </section>

      {/* ════ KEY COMPONENTS SECTION ════ */}
      <KeyComponentsSection isDark={isDark} />

      {/* ════ ALL FEATURES SECTION ════ */}
      <FeaturesRippleSection isDark={isDark} />

      {/* ════ ROLES SECTION ════ */}
      <RolesConnectedSection isDark={isDark} />

      {/* ════ 4-TIER ARCHITECTURE SECTION ════ */}
      <section style={{
        background: isDark
          ? 'linear-gradient(160deg, #07111f 0%, #0a1a30 60%, #060f1e 100%)'
          : 'linear-gradient(160deg, #eef3fb 0%, #f5f8fd 60%, #e8eef8 100%)',
        padding: '96px 40px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background decorative grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: isDark
            ? 'linear-gradient(rgba(64,128,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(64,128,255,0.04) 1px, transparent 1px)'
            : 'linear-gradient(rgba(0,51,102,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,51,102,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>

          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6 }}
            style={{ textAlign: 'center', marginBottom: 72 }}
          >
            <p style={{
              fontSize: '1rem', color: colors.sectionText,
              maxWidth: 620, margin: '0 auto', lineHeight: 1.75,
            }}>
              LADRIS is built on a robust four-layer architecture engineered for high-throughput
              government operations — from raw data ingestion to AI-powered insights on the dashboard.
            </p>
          </motion.div>

          {/* Tier cards — horizontal flow on desktop, vertical on mobile */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 0,
            position: 'relative',
          }}
            className="arch-tier-grid"
          >
            {[
              {
                tier: '01',
                label: 'Data Layer',
                subtitle: 'Ingestion & Storage',
                color: '#f47721',
                glowColor: 'rgba(244,119,33,0.18)',
                borderColor: 'rgba(244,119,33,0.35)',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                ),
                items: ['PostgreSQL + PostGIS', 'GIS / Census 2011', 'BhoomiRashi Portal', 'data.gov.in API'],
              },
              {
                tier: '02',
                label: 'Processing Layer',
                subtitle: 'ETL & Computation',
                color: '#4080ff',
                glowColor: 'rgba(64,128,255,0.18)',
                borderColor: 'rgba(64,128,255,0.35)',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
                  </svg>
                ),
                items: ['ETL Pipeline (3 Phases)', 'Risk Score Engine', 'Spatial Computations', 'Data Validation'],
              },
              {
                tier: '03',
                label: 'Intelligence Layer',
                subtitle: 'AI / ML & APIs',
                color: '#7c5cfc',
                glowColor: 'rgba(124,92,252,0.18)',
                borderColor: 'rgba(124,92,252,0.35)',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a5 5 0 0 1 5 5v4a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
                    <path d="M8 21v-2a4 4 0 0 1 8 0v2" />
                    <path d="M2 14h2m16 0h2" />
                  </svg>
                ),
                items: ['FastAPI Backend', 'ML Risk Predictor', 'WebSocket Alerts', 'REST / GraphQL'],
              },
              {
                tier: '04',
                label: 'Presentation Layer',
                subtitle: 'UI & Visualisation',
                color: '#00b894',
                glowColor: 'rgba(0,184,148,0.18)',
                borderColor: 'rgba(0,184,148,0.35)',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8m-4-4v4" />
                  </svg>
                ),
                items: ['React + Vite SPA', 'MapLibre GL Maps', 'Recharts Analytics', 'RBAC Role Views'],
              },
            ].map((tier, i) => (
              <motion.div
                key={tier.tier}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.12 }}
                style={{ position: 'relative', display: 'flex' }}
              >
                {/* Connector arrow between tiers (except last) */}
                {i < 3 && (
                  <div style={{
                    position: 'absolute', right: -1, top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10, display: 'flex', alignItems: 'center',
                  }}>
                    <div style={{
                      width: 22, height: 2,
                      background: `linear-gradient(90deg, ${tier.color}, ${[
                        '#4080ff', '#7c5cfc', '#00b894', '#4080ff'
                      ][i]})`,
                      opacity: 0.6,
                    }} />
                    <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
                      <path d="M1 5h8M6 2l3 3-3 3" stroke={tier.color} strokeWidth="1.6"
                        strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8" />
                    </svg>
                  </div>
                )}

                {/* Tier Card */}
                <motion.div
                  whileHover={{ translateY: -5, boxShadow: `0 16px 48px ${tier.glowColor}` }}
                  transition={{ duration: 0.22 }}
                  style={{
                    flex: 1,
                    margin: '0 10px',
                    background: isDark
                      ? `linear-gradient(145deg, rgba(10,24,42,0.98) 0%, rgba(8,18,36,0.95) 100%)`
                      : 'rgba(255,255,255,0.92)',
                    border: `1px solid ${tier.borderColor}`,
                    borderRadius: 16,
                    padding: '32px 24px',
                    boxShadow: isDark
                      ? `0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`
                      : `0 4px 20px rgba(0,51,102,0.07)`,
                    display: 'flex', flexDirection: 'column',
                    cursor: 'default',
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.22s ease',
                  }}
                >
                  {/* Tier number + icon */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 12,
                      background: isDark ? `${tier.glowColor}` : `${tier.glowColor}`,
                      border: `1px solid ${tier.borderColor}`,
                      color: tier.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {tier.icon}
                    </div>
                    <div style={{
                      fontSize: '2.2rem', fontWeight: 900, lineHeight: 1,
                      color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                      letterSpacing: '-0.04em',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {tier.tier}
                    </div>
                  </div>

                  {/* Title block */}
                  <div style={{
                    fontSize: '1rem', fontWeight: 800,
                    color: colors.sectionTitle, marginBottom: 4,
                    letterSpacing: '-0.02em',
                  }}>
                    {tier.label}
                  </div>
                  <div style={{
                    fontSize: '0.75rem', fontWeight: 600,
                    color: tier.color, marginBottom: 20,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {tier.subtitle}
                  </div>

                  {/* Tech items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
                    {tier.items.map(item => (
                      <div key={item} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: tier.color, flexShrink: 0, opacity: 0.85,
                        }} />
                        <span style={{
                          fontSize: '0.8rem', color: colors.sectionText,
                          lineHeight: 1.4,
                        }}>{item}</span>
                      </div>
                    ))}
                  </div>

                  {/* Bottom accent bar */}
                  <div style={{
                    marginTop: 24, height: 3, borderRadius: 2,
                    background: `linear-gradient(90deg, ${tier.color}, transparent)`,
                    opacity: 0.5,
                  }} />
                </motion.div>
              </motion.div>
            ))}
          </div>

          {/* Data flow caption */}
          <motion.div
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.5 }}
            style={{
              textAlign: 'center', marginTop: 48,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            <div style={{ height: 1, width: 60, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
            <span style={{ fontSize: '0.78rem', color: colors.sectionText, letterSpacing: '0.04em' }}>
              Bidirectional data flow — from ground truth to intelligence, in real time
            </span>
            <div style={{ height: 1, width: 60, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
          </motion.div>
        </div>

        {/* Responsive style for mobile grid */}
        <style>{`
          @media (max-width: 900px) {
            .arch-tier-grid {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }
          @media (max-width: 540px) {
            .arch-tier-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </section>

      {/* ════ FOOTER ════ */}
      <footer style={{
        background: '#0d1526',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        fontFamily: 'inherit',
      }}>
        {/* ── Main footer body ── */}
        <div style={{
          maxWidth: 1320, margin: '0 auto',
          padding: '56px 40px 40px',
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr 1.4fr',
          gap: 64,
        }}
          className="landing-footer-grid"
        >

          {/* ── Column 1: Brand + Contact ── */}
          <div>
            {/* Logo + Brand name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10, overflow: 'hidden',
                background: 'rgba(64,128,255,0.12)',
                border: '1px solid rgba(64,128,255,0.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 4, flexShrink: 0,
              }}>
                <img src="/logo.png" alt="LADRIS" style={{ width: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <div style={{
                  fontSize: '1.05rem', fontWeight: 800,
                  color: '#f0f6fc', letterSpacing: '-0.03em', lineHeight: 1.1,
                }}>
                  LADRIS<span style={{ color: '#4080ff' }}>·</span>AI
                </div>
                <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#546e96', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
                  Intelligence Platform
                </div>
              </div>
            </div>

            {/* Tagline in saffron orange */}
            <div style={{
              fontSize: '0.8rem', fontWeight: 600,
              color: '#f47721',
              marginBottom: 12, lineHeight: 1.4,
            }}>
              AI-Powered Land Acquisition Intelligence — Real-time Risk, Faster Decisions
            </div>

            <div style={{
              fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)',
              marginBottom: 20, lineHeight: 1.6,
            }}>
              Built for Ministry of Rural Development, Government of India.
            </div>

            {/* Contact lines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Email */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                  support@ladris.gov.in
                </span>
              </div>
              {/* Location */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                  New Delhi, India
                </span>
              </div>
              {/* Phone */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.61 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                  +91-11-2338-XXXX (Ministry Helpline)
                </span>
              </div>
            </div>
          </div>

          {/* ── Column 2: Platform Links ── */}
          <div>
            <div style={{
              fontSize: '0.88rem', fontWeight: 700,
              color: '#f0f6fc', letterSpacing: '0.02em',
              marginBottom: 20,
            }}>
              Platform
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Features',
                'Architecture',
                'Analytics',
                'GIS Intelligence',
                'Documentation',
                'Help & Feedback',
                'Release Notes',
              ].map(link => (
                <a
                  key={link}
                  href="#"
                  style={{
                    fontSize: '0.84rem', color: 'rgba(255,255,255,0.5)',
                    textDecoration: 'none', transition: 'color 0.15s',
                    display: 'block',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f47721')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                >
                  {link}
                </a>
              ))}
            </div>
          </div>

          {/* ── Column 3: Official Partners ── */}
          <div>
            <div style={{
              fontSize: '0.88rem', fontWeight: 700,
              color: '#f0f6fc', letterSpacing: '0.02em',
              marginBottom: 20,
            }}>
              Official Partners
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                {
                  logo: '/logo_railways.png',
                  name: 'Ministry of Railways',
                  sub: 'Government of India',
                },
                {
                  logo: '/logo_morth.png',
                  name: 'Ministry of Road Transport',
                  sub: 'and Highways (MoRTH)',
                },
                {
                  logo: '/logo_nhai.png',
                  name: 'National Highways Authority',
                  sub: 'of India (NHAI)',
                },
                {
                  logo: '/logo_heavy_industries.png',
                  name: 'Ministry of Heavy Industries',
                  sub: 'Government of India',
                },
              ].map(partner => (
                <div
                  key={partner.name}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 14px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    transition: 'all 0.18s',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  }}
                >
                  {/* Partner logo */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                    background: '#ffffff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '4px',
                  }}>
                    <img src={partner.logo} alt={partner.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c9d8f0', lineHeight: 1.3 }}>
                      {partner.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                      {partner.sub}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom Copyright Bar ── */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '16px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
            © 2026{' '}
            <strong style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>LADRIS</strong>
            {'. '}All rights reserved. | Built for{' '}
            <strong style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>Ministry of Rural Development, GoI</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {['Privacy', 'Terms', 'Accessibility', 'Cookies'].map((item, i, arr) => (
              <span key={item} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <a href="#" style={{
                  fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)',
                  textDecoration: 'none', transition: 'color 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
                >
                  {item}
                </a>
                {i < arr.length - 1 && (
                  <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.78rem' }}>|</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </footer>


      {/* ════ Global Keyframes for landing page ════ */}
      <style>{`
        @keyframes lp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
        @media (max-width: 900px) {
          .landing-overview-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
          .landing-nav-links {
            display: none !important;
          }
          .landing-mobile-menu-btn {
            display: flex !important;
          }
          .landing-footer-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
        }
        @media (max-width: 1100px) {
          .landing-footer-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 40px !important;
          }
        }
      `}</style>
    </div>
  )
}
