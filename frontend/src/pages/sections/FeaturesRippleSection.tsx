/**
 * FeaturesRippleSection — LADRIS
 * "Everything You Need for Land Acquisition"
 * Animation: RIPPLE REVEAL — one central signal activates all 6 cards.
 * Library: Framer Motion (already installed)
 */
import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, useInView, useReducedMotion } from "framer-motion"
import { Zap, Brain, MapPin, AlertTriangle, BarChart2, ShieldCheck } from "lucide-react"

const EASE_SMOOTH: [number, number, number, number] = [0.22, 1, 0.36, 1]

/*
 * Ripple delay per card: centre-out wave pattern in a 3x2 grid
 * Index:  0   1   2
 *         3   4   5
 */
const RIPPLE_DELAYS = [0.22, 0.08, 0.30, 0.30, 0.08, 0.44]

/* --- Ripple Pulse ----------------------------------------------------------- */
function RipplePulse({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="rp"
          style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            zIndex: 10, pointerEvents: "none",
          }}
        >
          {/* Core dot */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.6, times: [0, 0.12, 0.7, 1], ease: "easeInOut" }}
            style={{
              width: 10, height: 10, borderRadius: "50%",
              background: "#4a6fa5",
              boxShadow: "0 0 14px rgba(74,111,165,0.8)",
            }}
          />
          {/* Ring 1 */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0.6 }}
            animate={{ scale: 20, opacity: 0 }}
            transition={{ duration: 1.4, ease: [0.1, 0.6, 0.4, 1], delay: 0.15 }}
            style={{
              position: "absolute", top: "50%", left: "50%",
              width: 10, height: 10, borderRadius: "50%",
              border: "1.5px solid rgba(74,111,165,0.55)",
              transform: "translate(-50%,-50%)",
            }}
          />
          {/* Ring 2 */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0.35 }}
            animate={{ scale: 32, opacity: 0 }}
            transition={{ duration: 1.85, ease: [0.1, 0.6, 0.4, 1], delay: 0.3 }}
            style={{
              position: "absolute", top: "50%", left: "50%",
              width: 10, height: 10, borderRadius: "50%",
              border: "1px solid rgba(74,111,165,0.28)",
              transform: "translate(-50%,-50%)",
            }}
          />
          {/* Glow */}
          <motion.div
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: [0, 0.2, 0], scale: [1, 5, 8] }}
            transition={{ duration: 1.6, ease: "easeOut", delay: 0.1 }}
            style={{
              position: "absolute", top: "50%", left: "50%",
              width: 40, height: 40, borderRadius: "50%",
              background: "radial-gradient(circle,rgba(74,111,165,0.4) 0%,transparent 70%)",
              transform: "translate(-50%,-50%)",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* --- Feature Card ----------------------------------------------------------- */
function FeatureCard({
  card, active, isDark, reduced,
}: {
  card: typeof CARDS[number]
  active: boolean
  isDark: boolean
  reduced: boolean
}) {
  const { Icon } = card

  return (
    <motion.div
      initial={{ opacity: 0, scale: reduced ? 1 : 0.96, filter: reduced ? "none" : "blur(4px)" }}
      animate={active
        ? { opacity: 1, scale: 1, filter: "blur(0px)" }
        : { opacity: 0, scale: reduced ? 1 : 0.96, filter: reduced ? "none" : "blur(4px)" }}
      transition={{ duration: 0.55, ease: EASE_SMOOTH }}
      whileHover={active ? { y: -4, scale: 1.015 } : undefined}
      onMouseEnter={active ? (e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = "rgba(74,111,165,0.45)"
        el.style.boxShadow = isDark
          ? "0 12px 40px rgba(0,0,0,0.5),0 0 0 1px rgba(74,111,165,0.22)"
          : "0 8px 28px rgba(74,111,165,0.14),0 0 0 1px rgba(74,111,165,0.18)"
      } : undefined}
      onMouseLeave={active ? (e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = isDark ? "rgba(74,111,165,0.14)" : "rgba(74,111,165,0.11)"
        el.style.boxShadow = isDark ? "0 4px 20px rgba(0,0,0,0.35)" : "0 2px 12px rgba(74,111,165,0.06)"
      } : undefined}
      style={{
        position: "relative",
        background: isDark ? "rgba(10,22,44,0.97)" : "#ffffff",
        border: `1px solid ${isDark ? "rgba(74,111,165,0.14)" : "rgba(74,111,165,0.11)"}`,
        borderRadius: 18,
        padding: "28px 24px",
        boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.35)" : "0 2px 12px rgba(74,111,165,0.06)",
        overflow: "hidden",
        transition: "border-color 0.22s ease, box-shadow 0.22s ease",
        cursor: "default",
        minHeight: 220,
      }}
    >
      {/* SVG border draw */}
      <svg
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          pointerEvents: "none", overflow: "visible",
        }}
        fill="none"
      >
        <motion.rect
          x="1" y="1"
          width="calc(100% - 2px)" height="calc(100% - 2px)"
          rx="17"
          stroke="rgba(74,111,165,0.6)"
          strokeWidth="1.5"
          strokeDasharray="1000"
          initial={{ strokeDashoffset: 1000, opacity: 0 }}
          animate={active ? { strokeDashoffset: 0, opacity: 1 } : { strokeDashoffset: 1000, opacity: 0 }}
          transition={{ duration: 0.65, ease: EASE_SMOOTH }}
        />
      </svg>

      {/* Top accent bar */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={active ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
        transition={{ duration: 0.5, ease: EASE_SMOOTH }}
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg,#4a6fa5,transparent 70%)",
          transformOrigin: "left",
        }}
      />

      {/* Number badge */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.3, delay: 0.04 }}
        style={{
          position: "absolute", top: 16, right: 18,
          fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.1em",
          color: "rgba(74,111,165,0.35)",
        }}
      >
        {card.num}
      </motion.div>

      {/* Icon */}
      <motion.div
        initial={{ opacity: 0, scale: reduced ? 1 : 0.8 }}
        animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: reduced ? 1 : 0.8 }}
        transition={{ duration: 0.42, ease: EASE_SMOOTH, delay: 0.08 }}
        style={{
          width: 50, height: 50, borderRadius: 13,
          background: isDark ? "rgba(74,111,165,0.12)" : "rgba(74,111,165,0.08)",
          border: "1px solid rgba(74,111,165,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#4a6fa5", marginBottom: 18,
        }}
      >
        <Icon size={24} strokeWidth={1.8} />
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: reduced ? 0 : 8 }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: reduced ? 0 : 8 }}
        transition={{ duration: 0.38, ease: EASE_SMOOTH, delay: 0.16 }}
        style={{
          fontSize: "0.97rem", fontWeight: 700,
          color: isDark ? "#eaf0ff" : "#0a1d37",
          marginBottom: 10, lineHeight: 1.35,
        }}
      >
        {card.title}
      </motion.div>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0, y: reduced ? 0 : 8 }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: reduced ? 0 : 8 }}
        transition={{ duration: 0.38, ease: EASE_SMOOTH, delay: 0.24 }}
        style={{
          fontSize: "0.845rem", lineHeight: 1.7,
          margin: 0,
          color: isDark ? "#94a9c9" : "#4a6280",
        }}
      >
        {card.desc}
      </motion.p>
    </motion.div>
  )
}

/* --- Main Export ------------------------------------------------------------ */
export default function FeaturesRippleSection({ isDark, language }: { isDark: boolean; language: 'en' | 'hi' }) {
  const hi = language === 'hi'

  const CARDS = [
    { num: '01', Icon: Zap,           title: hi ? 'रियल-टाइम जोखिम स्कोरिंग'          : 'Real-time Risk Scoring',             desc: hi ? 'जोखिम जल्दी जानें। LADRIS प्रोजेक्ट डेटा जांचता है और बताता है कि प्रोजेक्ट निम्न, मध्यम या उच्च जोखिम में है।' : 'Know the risk early. LADRIS checks project data and shows whether the project has Low, Medium, or High risk.' },
    { num: '02', Icon: Brain,         title: hi ? 'AI निर्णय बुद्धिमत्ता'            : 'AI Decision Intelligence',           desc: hi ? 'AI से बेहतर निर्णय लें। AI प्रोजेक्ट डेटा का अध्ययन करता है और ऐसे पैटर्न खोजता है जो भविष्य विलंब का कारण बन सकते हैं।' : 'Make better decisions with AI. AI studies project data and finds patterns that may cause future delays.' },
    { num: '03', Icon: MapPin,        title: hi ? 'GIS स्थानिक विश्लेषण'              : 'GIS Spatial Analytics',              desc: hi ? 'मानचित्र पर प्रोजेक्ट जोखिम देखें। विभिन्न जिलों और राज्यों में उच्च-जोखिम प्रोजेक्ट और विलंब प्रवृत्तियां देखें।' : 'See project risks on the map. View high-risk projects and delay trends across different districts and states.' },
    { num: '04', Icon: AlertTriangle, title: hi ? 'पूर्वानुमानित बाधा पहचान'         : 'Predictive Bottleneck Detection',     desc: hi ? 'समस्याएं बढ़़ने से पहले खोजें। अनुमोदन, कानूनी, मुआवज़ा, दस्तावेज़ और पुनर्वास से जुड़े जोखिमों का पता लगाएं।' : 'Find problems before they grow. Detect risks from approvals, legal issues, compensation, documents, rehabilitation and other delays.' },
    { num: '05', Icon: BarChart2,     title: hi ? 'स्मार्ट डैशबोर्ड और विश्लेषण'    : 'Smart Dashboards & Analytics',       desc: hi ? 'सब कुछ एक जगह देखें। इंटरैक्टिव डैशबोर्ड से प्रोजेक्ट जोखिम, विलंब प्रवृत्ति, समयसीमा और प्रदर्शन ट्रैक करें।' : 'See everything in one place. Track project risk, delay trends, timelines and performance through interactive dashboards.' },
    { num: '06', Icon: ShieldCheck,   title: hi ? 'सुरक्षित सरकारी पहुंच'            : 'Secure Government Access',           desc: hi ? 'हर टीम को सही पहुंच दें। भूमिका-आधारित एक्सेस विभिन्न हितधारकों को सुरक्षित रूप से आवश्यक जानकारी देखने देता है।' : 'Give every team the right access. Role-based access lets different stakeholders securely view the information they need.' },
  ]

  const sectionRef = useRef<HTMLElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: "-8% 0px" })
  const reduced = useReducedMotion() ?? false

  const [headingVisible, setHeadingVisible] = useState(false)
  const [rippleFired, setRippleFired] = useState(false)
  const [activeCards, setActiveCards] = useState<boolean[]>(Array(6).fill(false))
  const [tagVisible, setTagVisible] = useState(false)

  useEffect(() => {
    if (!isInView) return

    if (reduced) {
      setHeadingVisible(true)
      CARDS.forEach((_, i) => {
        setTimeout(() => setActiveCards(p => { const n = [...p]; n[i] = true; return n }), 200 + i * 80)
      })
      setTimeout(() => setTagVisible(true), 200 + CARDS.length * 80 + 200)
      return
    }

    const t1 = setTimeout(() => setHeadingVisible(true), 100)
    const t2 = setTimeout(() => setRippleFired(true), 900)

    const cardTimers = RIPPLE_DELAYS.map((d, i) =>
      setTimeout(() =>
        setActiveCards(p => { const n = [...p]; n[i] = true; return n }),
        900 + d * 1000 + 380
      )
    )

    const lastDelay = Math.max(...RIPPLE_DELAYS)
    const t3 = setTimeout(() => setTagVisible(true), 900 + lastDelay * 1000 + 380 + 650)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); cardTimers.forEach(clearTimeout) }
  }, [isInView, reduced])

  return (
    <section
      ref={sectionRef}
      id="features-section"
      style={{
        background: isDark ? "#0a182e" : "#eaf0f8",
        padding: "88px 40px 80px",
        borderTop: `1px solid ${isDark ? "rgba(244,119,33,0.1)" : "rgba(0,51,102,0.08)"}`,
        borderBottom: `1px solid ${isDark ? "rgba(244,119,33,0.1)" : "rgba(0,51,102,0.08)"}`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>{`
        @media(prefers-reduced-motion:reduce){*{animation-duration:0.001ms!important;transition-duration:0.001ms!important}}
        @media(max-width:768px){.frs-grid{grid-template-columns:1fr!important}}
        @media(min-width:769px) and (max-width:1060px){.frs-grid{grid-template-columns:repeat(2,1fr)!important}}
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : 20, filter: reduced ? "none" : "blur(4px)" }}
          animate={headingVisible ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
          transition={{ duration: 0.65, ease: EASE_SMOOTH }}
          style={{ textAlign: "center", marginBottom: 52 }}
        >
          <h2 style={{
            fontSize: "clamp(1.6rem,3vw,2.2rem)", fontWeight: 900,
            letterSpacing: "-0.03em",
            color: isDark ? "#f0f6fc" : "#0a1d37",
            marginBottom: 12, lineHeight: 1.2,
          }}>
            {hi ? 'LADRIS के मुख्य घटक' : 'Key Components of LADRIS'}
          </h2>

          <motion.p
            initial={{ opacity: 0, y: reduced ? 0 : 10 }}
            animate={headingVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.18, ease: EASE_SMOOTH }}
            style={{
              fontSize: "1rem", color: "#4a6fa5",
              maxWidth: 500, margin: "0 auto",
              lineHeight: 1.65, fontWeight: 500,
            }}
          >
            {hi ? 'एक प्लेटफ़ॉर्म। हर विलंब की भविष्यवाणी, जोखिम देखें, और शीघ्र कार्रवाई करें।' : 'One platform to predict delays, see risks, and act early.'}
          </motion.p>
        </motion.div>

        {/* Grid with ripple origin */}
        <div style={{ position: "relative" }}>
          {!reduced && <RipplePulse visible={rippleFired} />}

          <div
            className="frs-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 22,
            }}
          >
            {CARDS.map((card, i) => (
              <FeatureCard
                key={card.num}
                card={card}
                active={activeCards[i]}
                isDark={isDark}
                reduced={reduced}
              />
            ))}
          </div>
        </div>

        {/* Final tagline */}
        <motion.div
          initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
          animate={tagVisible ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, ease: EASE_SMOOTH }}
          style={{ textAlign: "center", marginTop: 52 }}
        >
          <motion.div
            initial={{ scaleY: 0, opacity: 0 }}
            animate={tagVisible ? { scaleY: 1, opacity: 1 } : {}}
            transition={{ duration: 0.38, ease: EASE_SMOOTH }}
            style={{
              width: 1, height: 36,
              background: "linear-gradient(to bottom,rgba(74,111,165,0.42),transparent)",
              margin: "0 auto 16px", transformOrigin: "top",
            }}
          />
          <span style={{
            display: "inline-block",
            fontSize: "0.72rem", fontWeight: 800,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: "#4a6fa5",
          }}>
            {hi ? 'एक प्रणाली।\u00a0\u00a0हर भूमि-अधिग्रहण आवश्यकता।' : 'One System.\u00a0\u00a0Every Land-Acquisition Need.'}
          </span>
        </motion.div>

      </div>
    </section>
  )
}
