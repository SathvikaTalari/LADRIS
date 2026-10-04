/**
 * LADRIS — Interactive Box-Highlight Guided Tour
 * Highlights actual buttons, cards, and sections across all dashboard pages
 * with a red bounding box, pointing arrow, and contextual instructions.
 * Automatically runs on fresh login and can be replayed anytime via TopNav button.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ArrowLeft,
  X,
  Volume2,
  Sparkles,
  FolderPlus,
  MapPinned,
  Target,
  Brain,
  BarChart3,
  Bell,
  Database,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'

export interface TourStep {
  id: string
  page: string
  selector: string
  title: string
  badge: string
  description: string
  tip?: string
  icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>
  iconColor: string
  preferredPlacement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'voice-btn',
    page: '/dashboard',
    selector: '#tour-voice-btn',
    title: 'Voice Briefing',
    badge: 'Dashboard',
    description: 'Listen to instant AI voice briefings and daily executive summaries with one click.',
    icon: Volume2,
    iconColor: '#38bdf8',
    preferredPlacement: 'bottom',
  },
  {
    id: 'saarthi-copilot',
    page: '/dashboard',
    selector: '#tour-saarthi-btn',
    title: 'Saarthi AI Copilot',
    badge: 'AI Copilot',
    description: 'Ask any question in plain English about land laws, delay causes, or court stay orders.',
    icon: Sparkles,
    iconColor: '#38bdf8',
    preferredPlacement: 'top',
  },
  {
    id: 'new-project',
    page: '/projects',
    selector: '#tour-new-project-btn',
    title: 'Projects & Onboarding',
    badge: 'Projects',
    description: 'Manage all 12 NHAI corridors or click "+ New Project" to upload fresh parcel data.',
    icon: FolderPlus,
    iconColor: '#10b981',
    preferredPlacement: 'bottom',
  },
  {
    id: 'gis-map',
    page: '/gis',
    selector: '#tour-gis-tabs',
    title: 'Interactive GIS Map',
    badge: 'GIS Map',
    description: 'View high-resolution corridor maps colour-coded by acquired, pending, and disputed parcels.',
    icon: MapPinned,
    iconColor: '#38bdf8',
    preferredPlacement: 'bottom',
  },
  {
    id: 'priority-watchlist',
    page: '/priority-intelligence',
    selector: '#tour-priority-filters',
    title: 'Priority Watchlist',
    badge: 'Watchlist',
    description: 'Filter high-risk parcels requiring urgent intervention to avoid costly contractor claims.',
    icon: Target,
    iconColor: '#f59e0b',
    preferredPlacement: 'bottom',
  },
  {
    id: 'decision-intelligence',
    page: '/intelligence',
    selector: '#tour-decision-tabs',
    title: 'Decision Intelligence',
    badge: 'Prescriptions',
    description: 'Simulate What-If scenarios and get AI-recommended interventions to unblock bottlenecks.',
    icon: Brain,
    iconColor: '#a855f7',
    preferredPlacement: 'bottom',
  },
  {
    id: 'analytics-trends',
    page: '/analytics',
    selector: '#tour-analytics-tabs',
    title: 'Analytics & Trends',
    badge: 'Analytics',
    description: 'Track acquisition speed trends, court litigation velocity, and budget burn across states.',
    icon: BarChart3,
    iconColor: '#06b6d4',
    preferredPlacement: 'bottom',
  },
  {
    id: 'alerts-warnings',
    page: '/alerts',
    selector: '#tour-alerts-filter',
    title: 'Alerts & Warnings',
    badge: 'Alerts',
    description: 'Monitor early warnings for statutory deadline breaches, court filings, and contractor claims.',
    icon: Bell,
    iconColor: '#ef4444',
    preferredPlacement: 'bottom',
  },
  {
    id: 'data-sources',
    page: '/data-sources',
    selector: '#tour-datasources-overview',
    title: 'Data Sources & Feeds',
    badge: 'Connectors',
    description: 'Verify live sync pipelines for BhoomiRashi, e-Courts, PM GatiShakti, and satellite feeds.',
    icon: Database,
    iconColor: '#10b981',
    preferredPlacement: 'bottom',
  },
  {
    id: 'data-quality',
    page: '/data-quality',
    selector: '#tour-dataquality-kpis',
    title: 'Data Health & Quality',
    badge: 'Data Health',
    description: 'Audit data completeness, duplicate records, and schema health before generating reports.',
    icon: ShieldCheck,
    iconColor: '#8b5cf6',
    preferredPlacement: 'bottom',
  },
  {
    id: 'tour-finish',
    page: '/dashboard',
    selector: '#tour-voice-btn',
    title: 'Ready to Explore!',
    badge: 'All Done',
    description: 'You are all set! Replay this tour anytime using the red 🧭 compass button in the top bar.',
    icon: CheckCircle2,
    iconColor: '#10b981',
    preferredPlacement: 'bottom',
  },
]

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
  right: number
  bottom: number
}

export function GuidedInteractiveTour() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const [isActive, setIsActive] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)

  const step = TOUR_STEPS[currentStepIndex]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1

  // Start tour handler
  const startTour = useCallback((startIndex = 0) => {
    setCurrentStepIndex(startIndex)
    setIsActive(true)
  }, [])

  // Close tour handler
  const stopTour = useCallback((recordSeen = true) => {
    setIsActive(false)
    setTargetRect(null)
    sessionStorage.removeItem('ladris_fresh_login_tour')
    if (recordSeen) {
      sessionStorage.setItem('ladris_session_tour_seen', 'true')
    }
  }, [])

  // Listen for global custom trigger event (e.g. from TopNav button)
  useEffect(() => {
    const handleStartEvent = () => {
      startTour(0)
    }
    window.addEventListener('ladris-start-tour', handleStartEvent)
    return () => window.removeEventListener('ladris-start-tour', handleStartEvent)
  }, [startTour])

  // Check on mount if fresh login tour was requested
  useEffect(() => {
    const isFreshLogin = sessionStorage.getItem('ladris_fresh_login_tour') === 'true'
    const alreadySeen = sessionStorage.getItem('ladris_session_tour_seen') === 'true'

    if (isFreshLogin && !alreadySeen) {
      // Delay slightly for initial page elements to mount
      const t = setTimeout(() => {
        startTour(0)
      }, 700)
      return () => clearTimeout(t)
    }
  }, [startTour])

  // Locate and measure target element whenever step changes or route changes
  const updateTargetRect = useCallback(() => {
    if (!isActive || !step) return

    const el = document.querySelector(step.selector) as HTMLElement | null
    if (el) {
      const r = el.getBoundingClientRect()
      // Only set rect if element has dimensions
      if (r.width > 0 && r.height > 0) {
        setTargetRect({
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
          right: r.right,
          bottom: r.bottom,
        })
        return true
      }
    }
    return false
  }, [isActive, step])

  // Step execution: ensure we are on the right page, then find element
  useEffect(() => {
    if (!isActive || !step) return

    let cancelled = false

    // Check if we need to navigate
    if (location.pathname !== step.page) {
      navigate(step.page)
    }

    // Poll until element is in DOM
    let attempts = 0
    const interval = setInterval(() => {
      if (cancelled) {
        clearInterval(interval)
        return
      }
      attempts++
      const found = updateTargetRect()
      if (found) {
        clearInterval(interval)
        // Scroll element into view smoothly if not visible
        const el = document.querySelector(step.selector) as HTMLElement | null
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
          // Re-measure after scroll
          setTimeout(() => {
            if (!cancelled) updateTargetRect()
          }, 250)
        }
      } else if (attempts > 30) {
        // Fallback after 3s if element not found: show centered
        clearInterval(interval)
        setTargetRect({
          top: window.innerHeight / 2 - 40,
          left: window.innerWidth / 2 - 100,
          width: 200,
          height: 80,
          right: window.innerWidth / 2 + 100,
          bottom: window.innerHeight / 2 + 40,
        })
      }
    }, 100)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isActive, currentStepIndex, step, location.pathname, navigate, updateTargetRect])

  // Recalculate rect on scroll and resize
  useEffect(() => {
    if (!isActive) return

    const handleUpdate = () => {
      updateTargetRect()
    }

    window.addEventListener('resize', handleUpdate, { passive: true })
    window.addEventListener('scroll', handleUpdate, { passive: true })
    return () => {
      window.removeEventListener('resize', handleUpdate)
      window.removeEventListener('scroll', handleUpdate)
    }
  }, [isActive, updateTargetRect])

  // Keyboard navigation: Escape = exit, ArrowRight/Enter = next, ArrowLeft = back
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopTour(true)
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (!isLastStep) {
          setCurrentStepIndex((prev) => prev + 1)
        } else {
          stopTour(true)
        }
      } else if (e.key === 'ArrowLeft' && !isFirstStep) {
        setCurrentStepIndex((prev) => prev - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, isFirstStep, isLastStep, stopTour])

  if (!isActive || !step) return null

  // Compute smart tooltip card positioning relative to targetRect
  const tooltipWidth = 330
  const boxPadding = 6

  let cardStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10002,
    width: tooltipWidth,
  }

  let arrowStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10003,
    pointerEvents: 'none',
  }

  let arrowDirection: 'up' | 'down' | 'left' | 'right' = 'up'

  if (targetRect) {
    const spaceBelow = window.innerHeight - targetRect.bottom
    const spaceAbove = targetRect.top
    const spaceRight = window.innerWidth - targetRect.right
    const spaceLeft = targetRect.left

    const placement = step.preferredPlacement || 'bottom'

    if (placement === 'bottom' && spaceBelow > 220) {
      // Place below target
      const top = targetRect.bottom + 16
      const left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetRect.left - 10))
      cardStyle.top = top
      cardStyle.left = left

      arrowDirection = 'up'
      arrowStyle.top = targetRect.bottom + 4
      arrowStyle.left = Math.min(targetRect.left + targetRect.width / 2 - 12, window.innerWidth - 30)
    } else if (placement === 'top' && spaceAbove > 220) {
      // Place above target
      const bottom = window.innerHeight - targetRect.top + 16
      const left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetRect.left - 10))
      cardStyle.bottom = bottom
      cardStyle.left = left

      arrowDirection = 'down'
      arrowStyle.bottom = window.innerHeight - targetRect.top + 4
      arrowStyle.left = Math.min(targetRect.left + targetRect.width / 2 - 12, window.innerWidth - 30)
    } else if (placement === 'left' && spaceLeft > tooltipWidth + 24) {
      // Place to left of target
      const right = window.innerWidth - targetRect.left + 16
      const top = Math.max(16, Math.min(window.innerHeight - 240, targetRect.top))
      cardStyle.top = top
      cardStyle.right = right

      arrowDirection = 'right'
      arrowStyle.top = Math.min(targetRect.top + Math.min(targetRect.height / 2, 40) - 12, window.innerHeight - 30)
      arrowStyle.right = window.innerWidth - targetRect.left + 4
    } else if (placement === 'right' && spaceRight > tooltipWidth + 24) {
      // Place to right of target
      const left = targetRect.right + 16
      const top = Math.max(16, Math.min(window.innerHeight - 240, targetRect.top))
      cardStyle.top = top
      cardStyle.left = left

      arrowDirection = 'left'
      arrowStyle.top = Math.min(targetRect.top + Math.min(targetRect.height / 2, 40) - 12, window.innerHeight - 30)
      arrowStyle.left = targetRect.right + 4
    } else {
      // Fallback
      if (spaceBelow >= spaceAbove && spaceBelow > 180) {
        cardStyle.top = targetRect.bottom + 16
        cardStyle.left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetRect.left - 10))
        arrowDirection = 'up'
        arrowStyle.top = targetRect.bottom + 4
        arrowStyle.left = Math.min(targetRect.left + targetRect.width / 2 - 12, window.innerWidth - 30)
      } else if (spaceAbove > 180) {
        cardStyle.bottom = window.innerHeight - targetRect.top + 16
        cardStyle.left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetRect.left - 10))
        arrowDirection = 'down'
        arrowStyle.bottom = window.innerHeight - targetRect.top + 4
        arrowStyle.left = Math.min(targetRect.left + targetRect.width / 2 - 12, window.innerWidth - 30)
      } else {
        cardStyle.top = '50%'
        cardStyle.left = '50%'
        cardStyle.transform = 'translate(-50%, -50%)'
      }
    }
  }

  const StepIcon = step.icon

  return (
    <AnimatePresence>
      <div style={{ position: 'fixed', inset: 0, zIndex: 99998, pointerEvents: 'auto' }}>
        {/* Fullscreen Dimming Overlay with transparent cutout */}
        {targetRect && (
          <motion.div
            key="highlight-frame"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              top: targetRect.top - boxPadding,
              left: targetRect.left - boxPadding,
              width: targetRect.width + boxPadding * 2,
              height: targetRect.height + boxPadding * 2,
              border: '2.5px solid #ef4444',
              borderRadius: 8,
              boxShadow: isDark
                ? '0 0 0 9999px rgba(3, 7, 18, 0.68), 0 0 18px rgba(239, 68, 68, 0.5)'
                : '0 0 0 9999px rgba(0, 15, 35, 0.50), 0 0 18px rgba(239, 68, 68, 0.5)',
              pointerEvents: 'none',
              zIndex: 10001,
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        )}

        {/* Clean Red Arrow pointing to Target */}
        {targetRect && (
          <motion.div
            key={`arrow-${currentStepIndex}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={arrowStyle}
          >
            {arrowDirection === 'up' && (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L4 14H9V22H15V14H20L12 2Z"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
                />
              </svg>
            )}
            {arrowDirection === 'down' && (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 22L20 10H15V2H9V10H4L12 22Z"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
                />
              </svg>
            )}
            {arrowDirection === 'left' && (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M2 12L14 4V9H22V15H14V20L2 12Z"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
                />
              </svg>
            )}
            {arrowDirection === 'right' && (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22 12L10 20V15H2V9H10V4L22 12Z"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
                />
              </svg>
            )}
          </motion.div>
        )}

        {/* Clean, Simple Guided Instruction Tooltip Card */}
        <motion.div
          key={`tour-card-${currentStepIndex}`}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            ...cardStyle,
            background: isDark ? '#0f172a' : '#ffffff',
            borderRadius: 14,
            border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: isDark
              ? '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)'
              : '0 16px 40px rgba(0, 30, 80, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            pointerEvents: 'auto',
            padding: '16px 18px',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StepIcon size={16} color="#ef4444" />
              <h3
                style={{
                  margin: 0,
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: isDark ? '#f8fafc' : '#0f172a',
                  letterSpacing: '-0.01em',
                }}
              >
                {step.title}
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: isDark ? '#94a3b8' : '#64748b',
                  background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                  padding: '2px 7px',
                  borderRadius: 6,
                }}
              >
                {currentStepIndex + 1}/{TOUR_STEPS.length}
              </span>
              <button
                onClick={() => stopTour(true)}
                title="Close tour"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  border: 'none',
                  background: 'transparent',
                  color: isDark ? '#94a3b8' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = isDark ? '#94a3b8' : '#64748b')
                }
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Description */}
          <p
            style={{
              margin: '0 0 14px 0',
              fontSize: '0.82rem',
              lineHeight: 1.55,
              color: isDark ? '#cbd5e1' : '#475569',
            }}
          >
            {step.description}
          </p>

          {/* Footer Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 10,
              borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
            }}
          >
            <button
              onClick={() => stopTour(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: isDark ? '#64748b' : '#94a3b8',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 500,
                padding: '4px 0',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = isDark ? '#64748b' : '#94a3b8')
              }
            >
              Skip
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {!isFirstStep && (
                <button
                  onClick={() => setCurrentStepIndex((i) => i - 1)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '5px 12px',
                    borderRadius: 7,
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.12)',
                    background: 'transparent',
                    color: isDark ? '#cbd5e1' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#ef4444')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = isDark
                      ? 'rgba(255, 255, 255, 0.15)'
                      : 'rgba(0, 0, 0, 0.12)')
                  }
                >
                  <ArrowLeft size={12} />
                  Back
                </button>
              )}

              <button
                onClick={() => {
                  if (isLastStep) {
                    stopTour(true)
                  } else {
                    setCurrentStepIndex((i) => i + 1)
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 14px',
                  borderRadius: 7,
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.35)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.5)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.35)'
                }}
              >
                {isLastStep ? (
                  <>
                    <CheckCircle2 size={13} />
                    Done
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

