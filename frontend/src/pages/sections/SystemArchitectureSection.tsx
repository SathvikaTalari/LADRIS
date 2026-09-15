/**
 * SystemArchitectureSection — LADRIS Landing Page
 * Animation: HORIZONTAL BUILD FLOW
 * Blocks activate sequentially left→right with SVG connector lines
 * and a traveling glowing dot between them.
 * Uses Framer Motion (already installed). Zero new dependencies.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

/* ─── Design tokens ─────────────────────────────────────────────────────── */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

// Single unified accent — all blocks share this colour
const UNIFIED_COLOR      = '#003d6b'       // deep navy
const UNIFIED_COLOR_DARK = '#4a7fd4'       // blue for dark mode
const UNIFIED_GLOW       = 'rgba(0,61,107,0.14)'
const UNIFIED_GLOW_DARK  = 'rgba(74,127,212,0.18)'

/* ─── Block definitions ─────────────────────────────────────────────────── */
const BLOCKS = [
  {
    num: '01',
    title: 'DATA + GIS',
    items: ['Land Records', 'Legal', 'Compensation', 'GIS'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
    ),
  },
  {
    num: '02',
    title: 'AI RISK ENGINE',
    items: ['Predict', 'Score', 'Explain', 'Recommend'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>
    ),
  },
  {
    num: '03',
    title: 'API + SECURITY',
    items: ['APIs', 'Role Access', 'Audit'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    num: '04',
    title: 'ACTION DASHBOARD',
    items: ['GIS Map', 'Alerts', 'Reports', 'Insights'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8m-4-4v4"/>
      </svg>
    ),
  },
] as const

type BlockState = 'ghost' | 'building' | 'active' | 'dimmed'

/* ─── Animated SVG connector ─────────────────────────────────────────────── */
function Connector({
  idx,
  lineDrawn,
  dotActive,
  isDark,
  blockColor,
}: {
  idx: number
  lineDrawn: boolean
  dotActive: boolean
  isDark: boolean
  blockColor: string
}) {
  const ghostStroke = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,51,102,0.1)'

  return (
    <div style={{
      width: 48, flexShrink: 0, height: '100%',
      display: 'flex', alignItems: 'center', position: 'relative',
    }}>
      <svg
        viewBox="0 0 48 2"
        preserveAspectRatio="none"
        style={{ width: '100%', height: 2, overflow: 'visible' }}
        aria-hidden="true"
      >
        <defs>
          <filter id={`glow-${idx}`} x="-60%" y="-600%" width="220%" height="1400%">
            <feGaussianBlur stdDeviation="1.8" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Ghost/background line */}
        <line x1="0" y1="1" x2="48" y2="1"
          stroke={ghostStroke} strokeWidth="1" strokeDasharray="3 3"/>

        {/* Drawn line using clip trick: animated from left */}
        {lineDrawn && (
          <motion.line
            x1="0" y1="1" x2="48" y2="1"
            stroke={blockColor}
            strokeWidth="1.3"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.42, ease: EASE }}
          />
        )}

        {/* Arrowhead */}
        {lineDrawn && (
          <motion.polygon
            points="44,−1.5 48,1 44,3.5"
            fill={blockColor}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.38, duration: 0.15 }}
          />
        )}

        {/* Traveling dot */}
        {dotActive && (
          <motion.circle
            cy="1" r="3.2"
            fill={blockColor}
            filter={`url(#glow-${idx})`}
            initial={{ cx: 2, opacity: 0.9 }}
            animate={{ cx: 46, opacity: [0.9, 0.9, 0.3] }}
            transition={{ duration: 0.52, ease: 'easeInOut' }}
          />
        )}
      </svg>
    </div>
  )
}

/* ─── Architecture block card ────────────────────────────────────────────── */
function ArchBlock({
  block,
  state,
  isDark,
  onMouseEnter,
  onMouseLeave,
  isHovered,
}: {
  block: typeof BLOCKS[number]
  state: BlockState
  isDark: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  isHovered: boolean
}) {
  const isVisible  = state !== 'ghost'
  const isActive   = state === 'active'
  const isBuilding = state === 'building'

  // Unified accent — same for all blocks
  const accent     = isDark ? UNIFIED_COLOR_DARK : UNIFIED_COLOR
  const glowColor  = isDark ? UNIFIED_GLOW_DARK  : UNIFIED_GLOW

  const baseOpacity = state === 'ghost' ? 0.07 : state === 'dimmed' ? 0.55 : 1
  const hoverLift   = isVisible ? (isHovered ? -3 : 0) : 0

  const cardBg = isDark
    ? (isActive ? 'rgba(14,26,52,0.98)' : isBuilding ? 'rgba(10,20,42,0.94)' : 'rgba(8,16,34,0.55)')
    : (isActive ? '#ffffff' : isBuilding ? '#fafcff' : '#f4f7fc')

  // Single neutral border — no per-card colour
  const borderCol = isActive
    ? isDark ? 'rgba(74,127,212,0.38)' : 'rgba(0,61,107,0.28)'
    : isBuilding
      ? isDark ? 'rgba(74,127,212,0.18)' : 'rgba(0,61,107,0.14)'
      : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,51,102,0.09)'

  const boxShadow = isActive
    ? `0 6px 28px ${glowColor}`
    : isHovered && isVisible
      ? isDark ? '0 8px 24px rgba(0,0,0,0.38)' : '0 5px 18px rgba(0,61,107,0.1)'
      : isDark ? '0 2px 8px rgba(0,0,0,0.28)' : '0 1px 4px rgba(0,51,102,0.05)'

  return (
    <motion.div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      animate={{
        opacity: baseOpacity,
        y: hoverLift,
        scale: isBuilding ? [0.94, 1] : 1,
      }}
      transition={{ duration: 0.55, ease: EASE }}
      style={{
        flex: 1,
        background: cardBg,
        border: `1px solid ${borderCol}`,
        borderRadius: 15,
        padding: '26px 20px 22px',
        boxShadow,
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.28s ease, box-shadow 0.28s ease, background 0.28s ease',
      }}
    >
      {/* Thin top accent line when active — unified colour */}
      {isActive && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, ${accent}, transparent)`,
            transformOrigin: 'left',
          }}
        />
      )}

      {/* Block number watermark */}
      <div style={{
        position: 'absolute', top: 14, right: 16,
        fontSize: '1.9rem', fontWeight: 900, lineHeight: 1,
        color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,51,102,0.05)',
        letterSpacing: '-0.04em', userSelect: 'none',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {block.num}
      </div>

      {/* Icon — unified colour */}
      <div style={{
        color: isActive ? accent : isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,61,107,0.38)',
        marginBottom: 13,
        width: 36, height: 36, borderRadius: 9,
        background: isActive
          ? (isDark ? 'rgba(74,127,212,0.12)' : 'rgba(0,61,107,0.07)')
          : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,61,107,0.04)',
        border: `1px solid ${isActive ? (isDark ? 'rgba(74,127,212,0.22)' : 'rgba(0,61,107,0.16)') : 'transparent'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.3s ease, border-color 0.3s ease, color 0.3s ease',
      }}>
        {block.icon}
      </div>

      {/* Title */}
      <div style={{
        fontSize: '0.78rem', fontWeight: 800,
        letterSpacing: '0.06em',
        color: isActive
          ? (isDark ? '#f0f6fc' : '#0a1d37')
          : isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,27,55,0.38)',
        marginBottom: 12, lineHeight: 1.2,
        transition: 'color 0.3s ease',
      }}>
        {block.title}
      </div>

      {/* Items list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {block.items.map((item) => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
              background: isActive ? accent : isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,61,107,0.2)',
              transition: 'background 0.3s ease',
            }}/>
            <span style={{
              fontSize: '0.72rem', lineHeight: 1.4,
              color: isActive
                ? (isDark ? '#94a9c9' : '#4a6280')
                : isDark ? 'rgba(255,255,255,0.26)' : 'rgba(0,51,102,0.3)',
              transition: 'color 0.3s ease',
            }}>
              {item}
            </span>
          </div>
        ))}
      </div>

      {/* Active bottom glow strip — unified colour */}
      {isActive && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.55, delay: 0.1, ease: EASE }}
          style={{
            position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 1,
            background: `linear-gradient(90deg, transparent, ${accent}50, transparent)`,
            transformOrigin: 'center',
          }}
        />
      )}
    </motion.div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function SystemArchitectureSection({ isDark }: { isDark: boolean }) {
  const sectionRef  = useRef<HTMLElement>(null)
  const isInView    = useInView(sectionRef, { once: true, margin: '-8% 0px' })
  const reduced     = useReducedMotion() ?? false

  const [headingReady,    setHeadingReady]    = useState(false)
  const [blockStates,     setBlockStates]     = useState<BlockState[]>(['ghost','ghost','ghost','ghost'])
  const [linesDrawn,      setLinesDrawn]      = useState([false, false, false])
  const [dotsActive,      setDotsActive]      = useState([false, false, false])
  const [taglineVisible,  setTaglineVisible]  = useState(false)
  const [subtitleVisible, setSubtitleVisible] = useState(false)
  const [hoveredIdx,      setHoveredIdx]      = useState<number | null>(null)

  const setBlock = useCallback((idx: number, st: BlockState) => {
    setBlockStates(prev => { const n = [...prev] as BlockState[]; n[idx] = st; return n })
  }, [])

  const fireConnector = useCallback((idx: number) => {
    setLinesDrawn(prev => { const n = [...prev]; n[idx] = true; return n })
    if (!reduced) {
      const t1 = setTimeout(() => {
        setDotsActive(prev => { const n = [...prev]; n[idx] = true; return n })
        const t2 = setTimeout(() => {
          setDotsActive(prev => { const n = [...prev]; n[idx] = false; return n })
        }, 700)
        return () => clearTimeout(t2)
      }, 60)
      return () => clearTimeout(t1)
    }
  }, [reduced])

  useEffect(() => {
    if (!isInView) return
    const ts: ReturnType<typeof setTimeout>[] = []
    const t = (fn: () => void, ms: number) => { const id = setTimeout(fn, ms); ts.push(id) }

    t(() => setHeadingReady(true), 100)

    if (reduced) {
      // Reduced motion: simple sequential fade, no movement
      t(() => setBlock(0, 'active'), 400)
      t(() => { setLinesDrawn([true,false,false]); setBlock(1,'active') }, 600)
      t(() => { setLinesDrawn([true,true,false]);  setBlock(2,'active') }, 800)
      t(() => { setLinesDrawn([true,true,true]);   setBlock(3,'active') }, 1000)
      t(() => setTaglineVisible(true), 1200)
      t(() => setSubtitleVisible(true), 1400)
    } else {
      // Step 1 — Block 01 builds in
      t(() => setBlock(0, 'building'), 450)
      t(() => setBlock(0, 'active'), 1050)

      // Step 2 — Connector 0→1, then Block 02
      t(() => fireConnector(0), 1520)
      t(() => { setBlock(0, 'dimmed'); setBlock(1, 'building') }, 2020)
      t(() => setBlock(1, 'active'), 2580)

      // Step 3 — Connector 1→2, then Block 03
      t(() => fireConnector(1), 3020)
      t(() => { setBlock(1, 'dimmed'); setBlock(2, 'building') }, 3520)
      t(() => setBlock(2, 'active'), 4050)

      // Step 4 — Connector 2→3, then Block 04
      t(() => fireConnector(2), 4500)
      t(() => { setBlock(2, 'dimmed'); setBlock(3, 'building') }, 5000)
      t(() => setBlock(3, 'active'), 5520)

      // Final sweep — all highlight, then reveal taglines
      t(() => setBlockStates(['active','active','active','active']), 6000)
      t(() => setTaglineVisible(true), 6500)
      t(() => setSubtitleVisible(true), 6900)
    }

    return () => ts.forEach(clearTimeout)
  }, [isInView, reduced, setBlock, fireConnector])

  const accentColor = isDark ? '#4a7fd4' : '#003366'

  return (
    <section
      ref={sectionRef}
      id="system-architecture"
      aria-label="System Architecture"
      style={{
        background: isDark
          ? 'linear-gradient(160deg, #07111f 0%, #0a1a30 60%, #060f1e 100%)'
          : 'linear-gradient(160deg, #eef3fb 0%, #f5f8fd 55%, #e8eef8 100%)',
        padding: '96px 40px 88px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle dot-grid background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: isDark
          ? 'radial-gradient(rgba(74,127,212,0.12) 1px, transparent 1px)'
          : 'radial-gradient(rgba(0,51,102,0.09) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        opacity: 0.65,
      }}/>

      <div style={{ maxWidth: 1160, margin: '0 auto', position: 'relative' }}>

        {/* ── Section heading ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : 18 }}
          animate={headingReady ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE }}
          style={{ textAlign: 'center', marginBottom: 64 }}
        >
          <h2 style={{
            fontSize: 'clamp(1.7rem, 3.2vw, 2.4rem)',
            fontWeight: 900, letterSpacing: '-0.035em',
            color: isDark ? '#f0f6fc' : '#0a1d37',
            lineHeight: 1.15, margin: '0 0 20px',
          }}>
            SYSTEM ARCHITECTURE
          </h2>

          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 10 }}
            animate={headingReady ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.18, ease: EASE }}
            style={{ maxWidth: 560, margin: '0 auto' }}
          >
            <p style={{
              fontSize: '1.05rem', fontWeight: 600,
              color: isDark ? '#c8daf4' : '#0a1d37',
              margin: '0 0 10px', lineHeight: 1.4,
            }}>
              Where land data becomes intelligence.
            </p>
            <p style={{
              fontSize: '0.88rem', fontWeight: 400,
              color: isDark ? '#7da0cc' : '#4a6280',
              margin: '0 0 6px', lineHeight: 1.7,
            }}>
              LADRIS connects data, prediction, security, and action in one seamless flow.
            </p>
            <p style={{
              fontSize: '0.85rem', fontWeight: 400,
              color: isDark ? '#6a90bb' : '#5a7194',
              margin: 0, lineHeight: 1.7,
            }}>
              Every layer works together to turn early risks into smarter decisions.
            </p>
          </motion.div>
        </motion.div>

        {/* ── Pipeline row ─────────────────────────────────────────── */}
        <div className="sas-pipeline">
          {BLOCKS.map((block, i) => (
            <div key={block.num} className="sas-block-wrap">
              <ArchBlock
                block={block}
                state={blockStates[i]}
                isDark={isDark}
                isHovered={hoveredIdx === i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />

              {i < BLOCKS.length - 1 && (
                <div className="sas-connector">
                  <Connector
                    idx={i}
                    lineDrawn={linesDrawn[i]}
                    dotActive={dotsActive[i]}
                    isDark={isDark}
                    blockColor={isDark ? UNIFIED_COLOR_DARK : UNIFIED_COLOR}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Final tagline ─────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginTop: 52 }}>
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={taglineVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease: EASE }}
            style={{ marginBottom: 12 }}
          >
            {/* DATA → AI → SECURITY → ACTION pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 0,
              padding: '7px 18px',
              background: isDark ? 'rgba(74,127,212,0.07)' : 'rgba(0,51,102,0.05)',
              border: `1px solid ${isDark ? 'rgba(74,127,212,0.18)' : 'rgba(0,51,102,0.12)'}`,
              borderRadius: 100,
            }}>
              {(['DATA', 'AI', 'SECURITY', 'ACTION'] as const).map((label, idx) => (
                <span key={label} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={taglineVisible ? { opacity: 1 } : {}}
                    transition={{ duration: 0.3, delay: idx * 0.1 }}
                    style={{
                      fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.13em',
                      color: isDark ? '#c0d4f0' : '#0a1d37',
                    }}
                  >
                    {label}
                  </motion.span>
                  {idx < 3 && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={taglineVisible ? { opacity: 1 } : {}}
                      transition={{ duration: 0.2, delay: idx * 0.1 + 0.08 }}
                      style={{
                        fontSize: '0.6rem', color: accentColor,
                        margin: '0 6px', fontWeight: 700, opacity: 0.7,
                      }}
                    >
                      →
                    </motion.span>
                  )}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={subtitleVisible ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, ease: EASE }}
            style={{
              fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em',
              color: isDark ? '#546e96' : '#94a3b8',
            }}
          >
            From land data to early action.
          </motion.div>
        </div>
      </div>

      {/* ── Scoped responsive styles ──────────────────────────────── */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          #system-architecture * {
            animation-duration: 0.001ms !important;
            transition-duration: 0.001ms !important;
          }
        }

        /* Desktop — horizontal 4-block flow */
        .sas-pipeline {
          display: flex;
          align-items: stretch;
          gap: 0;
        }
        .sas-block-wrap {
          display: flex;
          align-items: center;
          flex: 1;
          min-width: 0;
        }
        .sas-block-wrap > div:first-child {
          flex: 1;
          min-width: 0;
        }
        .sas-connector {
          width: 48px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }

        /* Tablet — 2-column grid */
        @media (max-width: 860px) {
          #system-architecture {
            padding: 72px 24px 64px;
          }
          .sas-pipeline {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
          }
          .sas-block-wrap {
            flex-direction: column;
          }
          .sas-connector {
            display: none;
          }
        }

        /* Mobile — single column with vertical connectors */
        @media (max-width: 520px) {
          #system-architecture {
            padding: 56px 18px 56px;
          }
          .sas-pipeline {
            grid-template-columns: 1fr;
            gap: 0;
          }
          .sas-block-wrap {
            position: relative;
          }
          .sas-block-wrap:not(:last-child)::after {
            content: '';
            display: block;
            width: 1px;
            height: 18px;
            background: linear-gradient(to bottom, rgba(0,51,102,0.28), transparent);
            margin: 0 auto;
          }
        }
      `}</style>
    </section>
  )
}
