/**
 * KeyComponentsSection — LADRIS
 * Animation: DATA STREAMS → AI CORE → CARD CYCLE → FINAL GRID
 * Library: Framer Motion (already installed, no new deps)
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'

/* ─── Static data (translated at runtime) ────────────────────────────────── */
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]
type Phase = 0 | 1 | 2 | 3 | 4

interface ComponentData {
  num: string
  title: string
  process: string
  desc: string
}

/* ─── DataStream ────────────────────────────────────────────────────────── */
function DataStream({
  label, dir, index, visible, isDark,
}: { label: string; dir: 'left' | 'right'; index: number; visible: boolean; isDark: boolean }) {
  const fromX = dir === 'left' ? '-110%' : '110%'
  return (
    <motion.div
      initial={{ opacity: 0, x: fromX }}
      animate={visible ? { opacity: 1, x: 0 } : { opacity: 0, x: fromX }}
      transition={{ duration: 0.6, delay: index * 0.09, ease: EASE }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11,
        flexDirection: dir === 'right' ? 'row-reverse' : 'row',
      }}
    >
      <span style={{
        fontSize: '0.63rem', fontWeight: 700, letterSpacing: '0.11em',
        color: isDark ? 'rgba(74,111,165,0.85)' : 'rgba(74,111,165,0.8)',
        whiteSpace: 'nowrap', minWidth: 118,
        textAlign: dir === 'right' ? 'right' : 'left',
      }}>{label}</span>

      <div style={{
        flex: 1, height: 1, position: 'relative', overflow: 'hidden',
        background: `linear-gradient(${dir === 'left' ? '90deg' : '270deg'}, rgba(74,111,165,0.6), transparent)`,
      }}>
        <motion.div
          animate={{ x: dir === 'left' ? ['-100%', '110%'] : ['110%', '-100%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: index * 0.2 }}
          style={{
            position: 'absolute', top: -1, width: 36, height: 3,
            background: `linear-gradient(${dir === 'left' ? '90deg' : '270deg'}, transparent, #4a6fa5, transparent)`,
            borderRadius: 2,
          }}
        />
      </div>

      <span style={{ fontSize: '0.65rem', color: '#4a6fa5', opacity: 0.75, lineHeight: 1 }}>
        {dir === 'left' ? '›' : '‹'}
      </span>
    </motion.div>
  )
}

/* ─── AICore ────────────────────────────────────────────────────────────── */
function AICore({ visible, isDark, hi }: { visible: boolean; isDark: boolean; hi: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="aicore"
          initial={{ opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.88 }}
          transition={{ duration: 0.6, ease: EASE }}
          style={{
            textAlign: 'center', padding: '18px 36px', borderRadius: 18,
            background: isDark ? 'rgba(10,22,44,0.97)' : '#ffffff',
            border: `1px solid ${isDark ? 'rgba(74,111,165,0.22)' : 'rgba(74,111,165,0.18)'}`,
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.35)' : '0 2px 10px rgba(74,111,165,0.07)',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {/* Top accent line — matches FeatureCard style */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: 'linear-gradient(90deg, #4a6fa5, transparent 65%)',
          }} />

          <div style={{
            fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: 'rgba(74,111,165,0.65)', marginBottom: 5,
          }}>
            {hi ? 'बुद्धिमत्ता इंजन' : 'Intelligence Engine'}
          </div>
          <div style={{
            fontSize: '1.35rem', fontWeight: 900, letterSpacing: '-0.03em',
            color: isDark ? '#ddeaff' : '#0a1d37', lineHeight: 1.1,
          }}>
            LADRIS
          </div>

          {/* Static waveform bars */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 10 }}>
            {[6, 10, 8, 10, 6].map((h, i) => (
              <div
                key={i}
                style={{
                  width: 3, height: h, borderRadius: 2,
                  background: isDark ? 'rgba(74,111,165,0.45)' : 'rgba(74,111,165,0.3)',
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ─── FeatureCard ───────────────────────────────────────────────────────── */
function FeatureCard({
  comp, isActive, isDark, gridMode, gridIndex,
}: {
  comp: ComponentData; isActive: boolean;
  isDark: boolean; gridMode: boolean; gridIndex: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 22, filter: 'blur(6px)' }}
      animate={{
        opacity:  gridMode ? 1    : isActive ? 1    : 0.15,
        scale:    gridMode ? 1    : isActive ? 1    : 0.92,
        y:        gridMode ? 0    : isActive ? 0    : -20,
        filter:   gridMode ? 'blur(0px)' : isActive ? 'blur(0px)' : 'blur(3px)',
      }}
      exit={{ opacity: 0, scale: 0.91, y: -22, filter: 'blur(5px)' }}
      transition={{ duration: 0.52, ease: EASE, delay: gridMode ? gridIndex * 0.055 : 0 }}
      whileHover={gridMode ? { scale: 1.02, y: -3 } : undefined}
      onMouseEnter={gridMode ? e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'rgba(74,111,165,0.42)'
        el.style.boxShadow = isDark
          ? '0 10px 36px rgba(0,0,0,0.48), 0 0 0 1px rgba(74,111,165,0.22)'
          : '0 8px 28px rgba(74,111,165,0.13), 0 0 0 1px rgba(74,111,165,0.22)'
      } : undefined}
      onMouseLeave={gridMode ? e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = isDark ? 'rgba(74,111,165,0.16)' : 'rgba(74,111,165,0.11)'
        el.style.boxShadow = isDark ? '0 4px 20px rgba(0,0,0,0.38)' : '0 2px 10px rgba(74,111,165,0.06)'
      } : undefined}
      style={{
        background: isDark ? 'rgba(10,22,44,0.96)' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(74,111,165,0.16)' : 'rgba(74,111,165,0.11)'}`,
        borderRadius: 15, padding: gridMode ? '20px 18px' : '26px 24px',
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.38)' : '0 2px 10px rgba(74,111,165,0.06)',
        position: 'relative', overflow: 'hidden',
        transition: 'border-color 0.22s ease, box-shadow 0.22s ease',
        cursor: 'default',
      }}
    >
      {/* Accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, #4a6fa5, transparent 65%)',
      }} />

      {/* Number + process label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
        <span style={{
          fontSize: '0.6rem', fontWeight: 800, color: '#4a6fa5',
          background: isDark ? 'rgba(74,111,165,0.11)' : 'rgba(74,111,165,0.07)',
          border: `1px solid ${isDark ? 'rgba(74,111,165,0.22)' : 'rgba(74,111,165,0.16)'}`,
          borderRadius: 5, padding: '2px 6px', letterSpacing: '0.07em',
        }}>
          {comp.num}
        </span>

        {!gridMode && isActive && (
          <motion.span
            key={comp.process}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.38, delay: 0.28 }}
            style={{
              fontSize: '0.6rem', fontStyle: 'italic', fontWeight: 500,
              color: isDark ? 'rgba(74,111,165,0.65)' : 'rgba(74,111,165,0.6)',
            }}
          >
            {comp.process}
          </motion.span>
        )}
      </div>

      {/* Title */}
      <div style={{
        fontSize: gridMode ? '0.88rem' : '1rem', fontWeight: 700,
        color: isDark ? '#eaf0ff' : '#0a1d37',
        marginBottom: 7, lineHeight: 1.3,
      }}>
        {comp.title}
      </div>

      {/* Description */}
      <p style={{
        fontSize: '0.79rem', lineHeight: 1.68, margin: 0,
        color: isDark ? '#94a9c9' : '#4a6280',
      }}>
        {comp.desc}
      </p>
    </motion.div>
  )
}

/* ─── Main Section ──────────────────────────────────────────────────────── */
export default function KeyComponentsSection({ isDark, language }: { isDark: boolean; language: 'en' | 'hi' }) {
  const hi = language === 'hi'

  /* ── Translated data (computed per render) ── */
  const STREAMS = [
    { label: hi ? 'प्रोजेक्ट डेटा'    : 'PROJECT DATA',    dir: 'left'  as const },
    { label: hi ? 'अनुमोदन'       : 'APPROVALS',       dir: 'right' as const },
    { label: hi ? 'कानूनी रिकॉर्ड'  : 'LEGAL RECORDS',   dir: 'left'  as const },
    { label: hi ? 'मुआवज़ा'      : 'COMPENSATION',    dir: 'right' as const },
    { label: hi ? 'GIS डेटा'        : 'GIS DATA',        dir: 'left'  as const },
    { label: hi ? 'दस्तावेज़'      : 'DOCUMENTS',       dir: 'right' as const },
    { label: hi ? 'पुनर्वास'     : 'REHABILITATION',  dir: 'left'  as const },
    { label: hi ? 'ऐतिहासिक डेटा' : 'HISTORICAL DATA', dir: 'right' as const },
  ]

  const COMPONENTS = [
    { num: '01', title: hi ? 'AI विलंब भविष्यवाणी'    : 'AI Delay Prediction',   process: hi ? 'प्रोजेक्ट पैटर्न विश्लेषण…'  : 'Analyzing project patterns…',  desc: hi ? 'भूमि अधिग्रहण के विभिन्न चरणों में संभावित विलंबों की भविष्यवाणी के लिए प्रोजेक्ट डेटा और ML का उपयोग करता है।' : 'Uses project data and machine learning to predict possible delays at different stages of land acquisition.' },
    { num: '02', title: hi ? 'प्रोजेक्ट जोखिम स्कोर'    : 'Project Risk Score',     process: hi ? 'प्रोजेक्ट जोखिम गणना…'    : 'Calculating project risk…',    desc: hi ? 'प्रत्येक प्रोजेक्ट को जोखिम स्कोर देता है और उच्च, मध्यम या निम्न जोखिम में वर्गीकृत करता है।' : 'Gives every project a risk score and classifies it as High, Medium or Low Risk.' },
    { num: '03', title: hi ? 'विलंब कारण पहचान'  : 'Delay Cause Detection',  process: hi ? 'मुख्य विलंब कारण खोजना…'    : 'Finding key delay causes…',    desc: hi ? 'लंबित अनुमोदन, मुआवज़ा विलंब, कानूनी विवाद, अधूरे दस्तावेज़, पुनर्वास समस्याएं और प्रशासनिक बाधाओं जैसे कारणों की पहचान करता है।' : 'Identifies causes such as pending approvals, compensation delays, legal disputes, incomplete documents, rehabilitation issues and administrative bottlenecks.' },
    { num: '04', title: hi ? 'GIS जोखिम मानचित्र'           : 'GIS Risk Map',           process: hi ? 'प्रोजेक्ट जोखिम मैपिंग…'        : 'Mapping project risk…',        desc: hi ? 'डिजिटल मानचित्रों पर उच्च-जोखिम प्रोजेक्ट दिखाता है और जिलों व राज्यों में विलंब प्रवृत्तियां दर्शाता है।' : 'Shows high-risk projects on digital maps and helps visualize delay trends across districts and states.' },
    { num: '05', title: hi ? 'शीघ्र अलर्ट'           : 'Early Alerts',           process: hi ? 'जोखिम सीमा जांच…'     : 'Checking risk threshold…',     desc: hi ? 'जब किसी प्रोजेक्ट में विलंब की अधिक संभावना हो तो प्रोजेक्ट प्रबंधकों को स्वचालित अलर्ट भेजता है।' : 'Automatically alerts project managers and administrators when a project has a high chance of delay.' },
    { num: '06', title: hi ? 'स्मार्ट सिफ़ारिशें'  : 'Smart Recommendations',  process: hi ? 'निवारक कार्रवाई तैयार…' : 'Preparing preventive action…', desc: hi ? 'भविष्यवाणी जोखिमों के आधार पर निवारक कार्रवाई सुझाता है ताकि विलंब से पहले टीमें कार्रवाई कर सकें।' : 'Suggests preventive actions based on predicted risks to help teams act before delays affect the project.' },
    { num: '07', title: hi ? 'स्पष्टीकरणीय AI'         : 'Explainable AI',         process: hi ? 'जोखिम कारक पहचान…'    : 'Identifying risk factors…',    desc: hi ? 'भविष्यवाणी के पीछे के महत्वपूर्ण कारक दिखाता है ताकि उपयोगकर्ता समझ सकें कि कोई प्रोजेक्ट जोखिमभरा क्यों माना जाता है।' : 'Shows the important factors behind a prediction so users can understand why a project is considered risky.' },
    { num: '08', title: hi ? 'निरंतर सीखना'    : 'Continuous Learning',    process: hi ? 'भविष्यवाणी मॉडल अपडेट…'   : 'Updating prediction model…',   desc: hi ? 'नए उपलब्ध प्रोजेक्ट डेटा का उपयोग करके समय के साथ भविष्यवाणी सटीकता में सुधार करता है।' : 'Uses newly available project data to improve prediction accuracy over time.' },
  ]

  const sectionRef = useRef<HTMLElement>(null)
  const isInView   = useInView(sectionRef, { once: true, margin: '-8% 0px' })

  const [phase, setPhase]           = useState<Phase>(0)
  const [activeCard, setActiveCard] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const advance = useCallback((to: Phase) => setPhase(to), [])
  const clear   = () => { if (timer.current) clearTimeout(timer.current) }

  /* Phase progression on scroll into view */
  useEffect(() => {
    if (!isInView) return
    timer.current = setTimeout(() => advance(1), 850)
    return clear
  }, [isInView, advance])

  useEffect(() => {
    if (phase === 1) { timer.current = setTimeout(() => advance(2), 1700); return clear }
    if (phase === 2) { timer.current = setTimeout(() => advance(3), 1100); return clear }
  }, [phase, advance])

  useEffect(() => {
    if (phase !== 3) return
    if (activeCard < COMPONENTS.length - 1) {
      timer.current = setTimeout(() => setActiveCard(c => c + 1), 1900)
    } else {
      timer.current = setTimeout(() => advance(4), 2100)
    }
    return clear
  }, [phase, activeCard, advance])

  const showStreams = phase === 1 || phase === 2
  const showCore   = phase === 2 || phase === 3
  const showCycle  = phase === 3
  const showGrid   = phase === 4

  const leftStreams  = STREAMS.filter(s => s.dir === 'left')
  const rightStreams = STREAMS.filter(s => s.dir === 'right')

  return (
    <section
      ref={sectionRef}
      style={{
        background: isDark ? '#060f1e' : '#f0f4f9',
        padding: '88px 40px 80px',
        borderTop:    `1px solid ${isDark ? 'rgba(74,111,165,0.1)' : 'rgba(74,111,165,0.08)'}`,
        borderBottom: `1px solid ${isDark ? 'rgba(74,111,165,0.1)' : 'rgba(74,111,165,0.08)'}`,
        overflow: 'hidden',
      }}
    >
      {/* Reduced-motion override */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* ── Section header ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
          animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.72, ease: EASE }}
          style={{ textAlign: 'center', marginBottom: 52 }}
        >


          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.68, delay: 0.14, ease: EASE }}
            style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 900,
              color: isDark ? '#f0f6fc' : '#0a1d37',
              letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 12,
            }}
          >
            {hi ? 'LADRIS जो कुछ भी देखता है' : 'Everything LADRIS sees'}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.62, delay: 0.27, ease: EASE }}
            style={{
              fontSize: '0.91rem', color: isDark ? '#94a9c9' : '#4a6280',
              maxWidth: 480, margin: '0 auto', lineHeight: 1.75,
            }}
          >
            {hi ? 'प्रोजेक्ट डेटा से कार्रवाई योग्य बुद्धिमत्ता तक।' : 'From project data to actionable intelligence.'}
          </motion.p>
        </motion.div>

        {/* ── Animated stage (streams → core → card cycle) ─────────────── */}
        <AnimatePresence mode="wait">
          {!showGrid && (
            <motion.div
              key="stream-stage"
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              {/* 3-column: left streams | centre | right streams */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) 250px minmax(0,1fr)',
                gap: 20,
                alignItems: 'center',
                minHeight: 300,
              }}>
                {/* Left */}
                <div style={{ overflow: 'hidden' }}>
                  {leftStreams.map((s, i) => (
                    <DataStream key={s.label} label={s.label} dir="left"
                      index={i} visible={showStreams} isDark={isDark} />
                  ))}
                </div>

                {/* Centre: AI core + cycling card */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                  <AICore visible={showCore} isDark={isDark} hi={hi} />

                  <AnimatePresence mode="wait">
                    {showCycle && (
                      <motion.div key={`c-${activeCard}`} style={{ width: '100%' }}>
                        <FeatureCard
                          comp={COMPONENTS[activeCard]}
                          isActive={true}
                          isDark={isDark}
                          gridMode={false}
                          gridIndex={0}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Progress dots */}
                  {showCycle && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ display: 'flex', gap: 5 }}
                    >
                      {COMPONENTS.map((_, i) => (
                        <div key={i} style={{
                          width: i === activeCard ? 20 : 5,
                          height: 5, borderRadius: 3,
                          background: i === activeCard
                            ? '#4a6fa5'
                            : isDark ? 'rgba(74,111,165,0.22)' : 'rgba(74,111,165,0.18)',
                          transition: 'width 0.32s ease, background 0.32s ease',
                        }} />
                      ))}
                    </motion.div>
                  )}
                </div>

                {/* Right */}
                <div style={{ overflow: 'hidden' }}>
                  {rightStreams.map((s, i) => (
                    <DataStream key={s.label} label={s.label} dir="right"
                      index={i} visible={showStreams} isDark={isDark} />
                  ))}
                </div>
              </div>

              {/* Skip button */}
              {(showCore || showCycle) && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  style={{ textAlign: 'center', marginTop: 26 }}
                >
                  <button
                    onClick={() => { setActiveCard(COMPONENTS.length - 1); advance(4) }}
                    style={{
                      background: 'none',
                      border: `1px solid ${isDark ? 'rgba(74,111,165,0.28)' : 'rgba(74,111,165,0.22)'}`,
                      borderRadius: 20, padding: '5px 16px',
                      fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em',
                      color: isDark ? 'rgba(74,111,165,0.75)' : 'rgba(74,111,165,0.7)',
                      cursor: 'pointer',
                    }}
                  >
                    View all capabilities ↓
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Grid stage ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {showGrid && (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.48, ease: EASE }}
            >
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: 18, marginBottom: 44,
              }}>
                {COMPONENTS.map((comp, i) => (
                  <FeatureCard
                    key={comp.num} comp={comp}
                    isActive={false} isDark={isDark}
                    gridMode={true} gridIndex={i}
                  />
                ))}
              </div>

              {/* Final tagline */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.58, delay: 0.52, ease: EASE }}
                style={{ textAlign: 'center' }}
              >

              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </section>
  )
}
