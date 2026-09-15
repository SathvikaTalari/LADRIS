/**
 * SmartAnalyticsSection — LADRIS Landing Page
 * Animation: LIVE ANALYTICS DRAW
 * Sequence: DATA → PATTERN → INSIGHT
 * Uses Framer Motion (already installed). Zero new deps.
 */
import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

/* ─── Tokens ─────────────────────────────────────────────────────────────── */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const ACCENT   = '#003d6b'
const ACCENT_D = '#4a7fd4'

/* ─── Chart data: delay trend (prototype values) ─────────────────────────── */
// SVG viewBox "0 0 280 200" — taller chart fills container, ascending delay trend
const PTS: [number, number][] = [
  [18, 172], [58, 148], [98, 158], [148, 118], [188, 130], [235, 90], [268, 68]
]


/** Build smooth cubic-bezier SVG path from control points */
function buildSmoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1]
    const [cx, cy] = pts[i]
    const cpx = (px + cx) / 2
    d += ` C ${cpx},${py} ${cpx},${cy} ${cx},${cy}`
  }
  return d
}

const SMOOTH_PATH = buildSmoothPath(PTS)

/* ─── Approx path length for dasharray trick ─────────────────────────────── */
// Calculated manually for this path (~340px). We use Framer's pathLength instead.

/* ─── Analytics area cards ─────────────────────────────────────────────── */
/* ─── Hoverable area card ─────────────────────────────────────────────────── */
function AreaCard({ area, visible, delay, isDark }: {
  area: typeof AREAS[number]; visible: boolean; delay: number; isDark: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const accent = isDark ? ACCENT_D : ACCENT

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={visible ? { opacity: 1, y: hovered ? -3 : 0 } : { opacity: 0, y: 12 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isDark ? 'rgba(14,26,52,0.96)' : '#ffffff',
        border: `1px solid ${hovered
          ? (isDark ? 'rgba(74,127,212,0.4)' : 'rgba(0,61,107,0.28)')
          : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,51,102,0.1)')}`,
        borderRadius: 14,
        padding: '18px 20px',
        cursor: 'default',
        boxShadow: hovered
          ? isDark ? '0 8px 28px rgba(0,0,0,0.4)' : '0 6px 22px rgba(0,61,107,0.12)'
          : isDark ? '0 2px 8px rgba(0,0,0,0.25)' : '0 1px 5px rgba(0,51,102,0.06)',
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top accent on hover */}
      {hovered && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${accent}, transparent)`,
        }}/>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Icon */}
        <motion.div
          animate={{ scale: hovered ? 1.08 : 1 }}
          transition={{ duration: 0.2 }}
          style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: isDark ? 'rgba(74,127,212,0.1)' : 'rgba(0,61,107,0.06)',
            border: `1px solid ${isDark ? 'rgba(74,127,212,0.18)' : 'rgba(0,61,107,0.1)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: accent,
            transition: 'background 0.2s ease',
          }}>
          {area.icon}
        </motion.div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Number */}
          <div style={{
            fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.14em',
            color: isDark ? 'rgba(74,127,212,0.6)' : 'rgba(0,61,107,0.4)',
            marginBottom: 3,
          }}>{area.num}</div>

          {/* Title */}
          <div style={{
            fontSize: '0.8rem', fontWeight: 800,
            color: isDark ? '#f0f6fc' : '#0a1d37',
            marginBottom: 5, lineHeight: 1.2,
          }}>{area.title}</div>

          {/* Desc */}
          <div style={{
            fontSize: '0.71rem', lineHeight: 1.5,
            color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,51,102,0.55)',
          }}>{area.desc}</div>
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Main Section ───────────────────────────────────────────────────────── */
export default function SmartAnalyticsSection({ isDark, language }: { isDark: boolean; language: 'en' | 'hi' }) {
  const hi = language === 'hi'

  const AREAS = [
    {
      num: '01', title: hi ? 'जोखिम प्रवृत्तियां' : 'Risk Trends',
      desc: hi ? 'उच्च, मध्यम और निम्न जोखिम वाले प्रोजेक्ट देखें।' : 'See High, Medium and Low risk projects.',
      icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>),
    },
    {
      num: '02', title: hi ? 'विलंब प्रवृत्तियां' : 'Delay Trends',
      desc: hi ? 'प्रोजेक्टों में विलंब किस तरह बदलता है यह देखें।' : 'Track how delays change across projects.',
      icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>),
    },
    {
      num: '03', title: hi ? 'प्रोजेक्ट प्रदर्शन' : 'Project Performance',
      desc: hi ? 'समयसीमा और प्रोजेक्ट प्रगति की तुलना करें।' : 'Compare timelines and project progress.',
      icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>),
    },
    {
      num: '04', title: hi ? 'जिला और राज्य दृश्य' : 'District & State View',
      desc: hi ? 'क्षेत्रों में विलंब पैटर्न देखें।' : 'Spot delay patterns across regions.',
      icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>),
    },
  ]

  const sectionRef = useRef<HTMLElement>(null)
  const isInView   = useInView(sectionRef, { once: true, margin: '-8% 0px' })
  const reduced    = useReducedMotion() ?? false

  // Animation phase flags
  const [panelVisible,   setPanelVisible]   = useState(false)
  const [gridVisible,    setGridVisible]    = useState(false)
  const [axesVisible,    setAxesVisible]    = useState(false)
  const [lineProgress,   setLineProgress]   = useState(0)    // 0 → 1
  const [dotsVisible,    setDotsVisible]    = useState<boolean[]>(PTS.map(() => false))
  const [riskVisible,    setRiskVisible]    = useState([false, false, false])
  const [perfFill,       setPerfFill]       = useState(0)    // 0 → 72 (%)
  const [regionVisible,  setRegionVisible]  = useState([false, false])
  const [headingVisible, setHeadingVisible] = useState(false)
  const [taglineVisible, setTaglineVisible] = useState(false)
  const [areasVisible,   setAreasVisible]   = useState(false)

  const accent = isDark ? ACCENT_D : ACCENT

  useEffect(() => {
    if (!isInView) return
    const ts: ReturnType<typeof setTimeout>[] = []
    const t = (fn: () => void, ms: number) => { const id = setTimeout(fn, ms); ts.push(id) }

    if (reduced) {
      // Reduced motion: instant fade-in of everything
      t(() => { setPanelVisible(true); setGridVisible(true); setAxesVisible(true) }, 100)
      t(() => { setLineProgress(1) }, 200)
      t(() => setDotsVisible(PTS.map(() => true)), 250)
      t(() => setRiskVisible([true, true, true]), 300)
      t(() => setPerfFill(72), 350)
      t(() => setRegionVisible([true, true]), 400)
      t(() => { setHeadingVisible(true); setTaglineVisible(true); setAreasVisible(true) }, 450)
    } else {
      // STEP 1: Panel fades in
      t(() => setPanelVisible(true), 200)
      // STEP 2: Grid appears
      t(() => setGridVisible(true), 520)
      // STEP 3: Axes draw
      t(() => setAxesVisible(true), 780)
      // STEP 4: Line draws (controlled via lineProgress animated separately)
      t(() => setLineProgress(1), 1050)
      // STEP 5: Dots appear one by one
      PTS.forEach((_, i) => {
        t(() => setDotsVisible(prev => { const n = [...prev]; n[i] = true; return n }), 1900 + i * 130)
      })
      // STEP 6: Risk labels HIGH → MEDIUM → LOW
      t(() => setRiskVisible(prev => [true, prev[1], prev[2]]), 2800)
      t(() => setRiskVisible(prev => [prev[0], true, prev[2]]), 3100)
      t(() => setRiskVisible(prev => [prev[0], prev[1], true]), 3400)
      // STEP 7: Performance fills
      t(() => setPerfFill(72), 3700)
      // STEP 8: Region labels
      t(() => setRegionVisible(prev => [true, prev[1]]), 4100)
      t(() => setRegionVisible(prev => [prev[0], true]), 4350)
      // STEP 9: Heading
      t(() => setHeadingVisible(true), 4650)
      // STEP 10: Tagline + area cards
      t(() => setTaglineVisible(true), 5000)
      t(() => setAreasVisible(true), 5200)
    }

    return () => ts.forEach(clearTimeout)
  }, [isInView, reduced])

  /* ── Inline styles helpers ── */
  const sectionBg = isDark
    ? 'linear-gradient(160deg, #060f1e 0%, #0a1a30 55%, #07111f 100%)'
    : 'linear-gradient(160deg, #f0f4fb 0%, #f7f9fd 55%, #eaeff8 100%)'

  const cardBg    = isDark ? 'rgba(12,22,46,0.97)' : '#ffffff'
  const cardBorder = isDark ? 'rgba(74,127,212,0.14)' : 'rgba(0,51,102,0.1)'
  const textPrimary = isDark ? '#f0f6fc' : '#0a1d37'
  const textSec    = isDark ? '#7da0cc' : '#4a6280'
  const gridStroke = isDark ? 'rgba(74,127,212,0.07)' : 'rgba(0,51,102,0.06)'
  const axisStroke = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,51,102,0.22)'

  return (
    <section
      ref={sectionRef}
      id="smart-analytics"
      aria-label="Smart Analytics"
      style={{
        background: sectionBg,
        padding: '92px 40px 84px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Dot-grid bg */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: isDark
          ? 'radial-gradient(rgba(74,127,212,0.1) 1px, transparent 1px)'
          : 'radial-gradient(rgba(0,51,102,0.08) 1px, transparent 1px)',
        backgroundSize: '28px 28px', opacity: 0.6,
      }}/>

      <div style={{ maxWidth: 1160, margin: '0 auto', position: 'relative' }}>

        {/* ── Section header (animates in at step 9) ─────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 14 }}
            animate={headingVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <h2 style={{
              fontSize: 'clamp(1.7rem, 3vw, 2.35rem)',
              fontWeight: 900, letterSpacing: '-0.035em',
              color: textPrimary, margin: '0 0 12px', lineHeight: 1.15,
            }}>
              {hi ? 'स्मार्ट विश्लेषण' : 'Smart Analytics'}
            </h2>
            <p style={{
              fontSize: '0.97rem', fontWeight: 500,
              color: textSec, margin: 0,
            }}>
              {hi ? 'प्रोजेक्ट डेटा को स्पष्ट जानकारी में बदलें।' : 'Turn project data into clear insights.'}
            </p>
          </motion.div>
        </div>

        {/* ── Main analytics panel ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: reduced ? 1 : 0.985 }}
          animate={panelVisible ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7, ease: EASE }}
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: 22,
            padding: '32px 32px 28px',
            boxShadow: isDark
              ? '0 12px 48px rgba(0,0,0,0.45)'
              : '0 8px 40px rgba(0,51,102,0.1)',
            marginBottom: 28,
          }}
        >

          {/* ── Dashboard grid ── */}
          <div className="sas-dash-grid" style={{ alignItems: 'stretch' }}>

            {/* LEFT: Delay Trend chart — stretches to match right column height */}
            <div style={{
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,51,102,0.025)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,51,102,0.08)'}`,
              borderRadius: 14, padding: '16px 18px 12px',
              display: 'flex', flexDirection: 'column',
              alignSelf: 'stretch',
            }}>
              <div style={{
                fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
                color: textSec, marginBottom: 14, textTransform: 'uppercase',
                flexShrink: 0,
              }}>
                {hi ? 'विलंब प्रवृत्ति' : 'Delay Trend'}
              </div>

              {/* SVG Chart — flex:1 so it fills the remaining height */}
              <svg
                viewBox="0 0 280 200"
                preserveAspectRatio="xMidYMid meet"
                style={{ width: '100%', flex: 1, display: 'block', overflow: 'visible', minHeight: 160 }}
                aria-label="Delay trend chart"
              >
                {/* Subtle grid lines */}
                {[40, 80, 120, 160, 195].map(y => (
                  <motion.line key={y}
                    x1="18" y1={y} x2="272" y2={y}
                    stroke={gridStroke} strokeWidth="0.8"
                    initial={{ opacity: 0 }}
                    animate={gridVisible ? { opacity: 1 } : {}}
                    transition={{ duration: 0.4, delay: 0.06 * (y / 40) }}
                  />
                ))}

                {/* Y axis */}
                <motion.line
                  x1="18" y1="10" x2="18" y2="193"
                  stroke={axisStroke} strokeWidth="1.2"
                  initial={{ pathLength: 0 }}
                  animate={axesVisible ? { pathLength: 1 } : {}}
                  transition={{ duration: 0.38, ease: EASE }}
                />
                {/* X axis */}
                <motion.line
                  x1="18" y1="193" x2="275" y2="193"
                  stroke={axisStroke} strokeWidth="1.2"
                  initial={{ pathLength: 0 }}
                  animate={axesVisible ? { pathLength: 1 } : {}}
                  transition={{ duration: 0.38, delay: 0.12, ease: EASE }}
                />

                {/* Quarter labels */}
                {axesVisible && (
                  <>
                    {['Q1','Q2','Q3','Q4','Q5','Q6','Q7'].map((q, i) => (
                      <motion.text key={q}
                        x={PTS[i][0]} y={202}
                        textAnchor="middle"
                        fontSize="9" fill={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,51,102,0.35)'}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ duration: 0.25, delay: 0.06 * i }}
                      >{q}</motion.text>
                    ))}
                  </>
                )}

                {/* Gradient area fill */}
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity={isDark ? 0.18 : 0.1}/>
                    <stop offset="100%" stopColor={accent} stopOpacity={0}/>
                  </linearGradient>
                  <clipPath id="lineClip">
                    <motion.rect
                      x="0" y="0" height="210"
                      initial={{ width: 0 }}
                      animate={lineProgress === 1 ? { width: 290 } : {}}
                      transition={{ duration: 0.85, ease: EASE }}
                    />
                  </clipPath>
                </defs>

                {/* Area fill */}
                <motion.path
                  d={`${SMOOTH_PATH} L 268,193 L 18,193 Z`}
                  fill="url(#areaGrad)"
                  clipPath="url(#lineClip)"
                  initial={{ opacity: 0 }}
                  animate={lineProgress === 1 ? { opacity: 1 } : {}}
                  transition={{ duration: 0.5, delay: 0.2 }}
                />

                {/* Trend line */}
                <motion.path
                  d={SMOOTH_PATH}
                  fill="none"
                  stroke={accent}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={lineProgress === 1 ? { pathLength: 1, opacity: 1 } : {}}
                  transition={{ duration: 0.85, ease: EASE }}
                />

                {/* Data points */}
                {PTS.map(([x, y], i) => (
                  <motion.circle key={i}
                    cx={x} cy={y} r={5}
                    fill={isDark ? '#0a1a30' : '#ffffff'}
                    stroke={accent} strokeWidth="2.2"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={dotsVisible[i] ? { opacity: 1, scale: 1 } : {}}
                    transition={{ duration: 0.28, ease: EASE }}
                    style={{ transformOrigin: `${x}px ${y}px` }}
                  />
                ))}
              </svg>
            </div>

            {/* RIGHT column: Risk + Performance + Region */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* RISK DISTRIBUTION (step 6) */}
              <div style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,51,102,0.025)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,51,102,0.08)'}`,
                borderRadius: 14, padding: '14px 18px',
              }}>
                <div style={{
                  fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
                  color: textSec, marginBottom: 12, textTransform: 'uppercase',
                }}>
                  {hi ? 'जोखिम वितरण' : 'Risk Distribution'}
                </div>

                {([
                  { label: hi ? 'उच्च' : 'HIGH',   pct: 28, opacity: 1,    idx: 0 },
                  { label: hi ? 'मध्यम' : 'MEDIUM', pct: 45, opacity: 0.65, idx: 1 },
                  { label: hi ? 'निम्न' : 'LOW',    pct: 27, opacity: 0.38, idx: 2 },
                ] as const).map(({ label, pct, opacity, idx }) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={riskVisible[idx] ? { opacity: 1, scale: 1 } : {}}
                    transition={{ duration: 0.38, ease: EASE }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}
                  >
                    <div style={{
                      fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.09em',
                      color: accent, width: 52, flexShrink: 0, opacity,
                    }}>{label}</div>
                    <div style={{
                      flex: 1, height: 5, borderRadius: 6,
                      background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,51,102,0.08)',
                      overflow: 'hidden',
                    }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={riskVisible[idx] ? { width: `${pct}%` } : {}}
                        transition={{ duration: 0.55, delay: 0.12, ease: EASE }}
                        style={{ height: '100%', background: accent, borderRadius: 6, opacity }}
                      />
                    </div>
                    <div style={{
                      fontSize: '0.62rem', fontWeight: 700,
                      color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,51,102,0.5)',
                      width: 28, textAlign: 'right', flexShrink: 0,
                    }}>{pct}%</div>
                  </motion.div>
                ))}
              </div>

              {/* PROJECT PERFORMANCE (step 7) */}
              <div style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,51,102,0.025)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,51,102,0.08)'}`,
                borderRadius: 14, padding: '14px 18px',
              }}>
                <div style={{
                  fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
                  color: textSec, marginBottom: 12, textTransform: 'uppercase',
                }}>
                  {hi ? 'प्रोजेक्ट प्रदर्शन' : 'Project Performance'}
                </div>

                {([
                  { label: hi ? 'निर्धारित समय पर' : 'On Schedule', pct: 72, opacity: 1    },
                  { label: hi ? 'जोखिम में'     : 'At Risk',     pct: 19, opacity: 0.62 },
                  { label: hi ? 'विलंबित'     : 'Delayed',     pct: 9,  opacity: 0.38 },
                ] as const).map(({ label, pct, opacity }, i) => (
                  <div key={label} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.65rem', color: textSec, fontWeight: 500 }}>{label}</span>
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={perfFill > 0 ? { opacity: 1 } : {}}
                        transition={{ duration: 0.3, delay: 0.3 + i * 0.1 }}
                        style={{ fontSize: '0.65rem', fontWeight: 700, color: isDark ? '#c0d4f0' : '#0a1d37' }}
                      >
                        {pct}%
                      </motion.span>
                    </div>
                    <div style={{
                      height: 5, borderRadius: 6,
                      background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,51,102,0.08)',
                      overflow: 'hidden',
                    }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={perfFill > 0 ? { width: `${pct}%` } : {}}
                        transition={{ duration: 0.65, delay: 0.15 * i, ease: EASE }}
                        style={{ height: '100%', background: accent, borderRadius: 6, opacity }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* DISTRICT & STATE VIEW (step 8) */}
              <div style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,51,102,0.025)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,51,102,0.08)'}`,
                borderRadius: 14, padding: '14px 18px',
              }}>
                <div style={{
                  fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
                  color: textSec, marginBottom: 12, textTransform: 'uppercase',
                }}>
                  {hi ? 'जिला और राज्य दृश्य' : 'District & State View'}
                </div>

                {([
                  { label: hi ? 'जिले का औसत विलंब' : 'DISTRICT avg delay', val: hi ? '14 दिन' : '14 days', pct: 58, idx: 0 },
                  { label: hi ? 'राज्य का औसत विलंब' : 'STATE avg delay',    val: hi ? '21 दिन' : '21 days', pct: 84, idx: 1 },
                ] as const).map(({ label, val, pct, idx }) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 6 }}
                    animate={regionVisible[idx] ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.4, ease: EASE }}
                    style={{ marginBottom: 9 }}
                  >
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      marginBottom: 4,
                    }}>
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.07em',
                        color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,51,102,0.5)',
                      }}>{label}</span>
                      <span style={{
                        fontSize: '0.62rem', fontWeight: 700,
                        color: isDark ? '#c0d4f0' : '#0a1d37',
                      }}>{val}</span>
                    </div>
                    <div style={{
                      height: 5, borderRadius: 6,
                      background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,51,102,0.08)',
                      overflow: 'hidden',
                    }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={regionVisible[idx] ? { width: `${pct}%` } : {}}
                        transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
                        style={{
                          height: '100%', borderRadius: 6,
                          background: accent,
                          opacity: idx === 0 ? 0.75 : 1,
                        }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>

            </div>{/* end right col */}
          </div>{/* end dashboard grid */}

          {/* Prototype disclaimer */}
          <div style={{
            marginTop: 18,
            fontSize: '0.58rem', fontWeight: 500, letterSpacing: '0.06em',
            color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,51,102,0.28)',
            textAlign: 'right',
          }}>
            {hi ? 'मूल्य केवल प्रदर्शन के लिए प्रोटोटाइप संकेतक हैं।' : 'Values shown are prototype indicators for demonstration.'}
          </div>
        </motion.div>

        {/* ── 4 analytics area cards ─────────────────────────────────────── */}
        <div className="sas-areas-grid" style={{ marginBottom: 44 }}>
          {AREAS.map((area, i) => (
            <AreaCard
              key={area.num}
              area={area}
              visible={areasVisible}
              delay={i * 0.1}
              isDark={isDark}
            />
          ))}
        </div>

        {/* ── Final tagline (step 10) ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={taglineVisible ? { opacity: 1 } : {}}
          transition={{ duration: 0.55, ease: EASE }}
          style={{ textAlign: 'center' }}
        >
          <div style={{ width: 1, height: 28, background: isDark
            ? 'linear-gradient(to bottom, rgba(74,127,212,0.38), transparent)'
            : 'linear-gradient(to bottom, rgba(0,61,107,0.3), transparent)',
            margin: '0 auto 14px' }}/>
          <span style={{
            fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: isDark ? ACCENT_D : ACCENT,
          }}>
            {hi ? 'प्रवृत्ति देखें। जोखिम पहचानें। कार्रवाई करें।' : 'See the trend. Spot the risk. Make the move.'}
          </span>
        </motion.div>

      </div>

      {/* ── Scoped responsive CSS ──────────────────────────────────────────── */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          #smart-analytics * {
            animation-duration: 0.001ms !important;
            transition-duration: 0.001ms !important;
          }
        }

        /* Desktop — chart left, right panels right */
        .sas-dash-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 18px;
          align-items: start;
        }

        /* 4 analytics area cards — 2×2 grid on desktop */
        .sas-areas-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        /* Tablet */
        @media (max-width: 900px) {
          #smart-analytics { padding: 72px 24px 64px; }
          .sas-dash-grid {
            grid-template-columns: 1fr;
          }
          .sas-areas-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        /* Mobile */
        @media (max-width: 540px) {
          #smart-analytics { padding: 56px 18px 52px; }
          .sas-areas-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }
      `}</style>
    </section>
  )
}
