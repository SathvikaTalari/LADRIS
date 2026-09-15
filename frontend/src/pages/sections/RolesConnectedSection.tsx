/**
 * RolesConnectedSection — LADRIS
 * "Built for Every Role in Land Acquisition"
 * Animation: CONNECTED ROLE PATH
 * Library: Framer Motion (already installed)
 */
import { useEffect, useRef, useState, useCallback } from "react"
import { motion, useInView, useReducedMotion } from "framer-motion"
import { Building2, Landmark, MapPin, Flag, HardHat, Briefcase } from "lucide-react"

/* ─── Types ────────────────────────────────────────────────────────────────── */
type CardState = "idle" | "active" | "done"

/* ─── Data ─────────────────────────────────────────────────────────────────── */
const ROLES = [
  {
    num: "01",
    Icon: Building2,
    title: "Land Requiring Body",
    desc: "Plan with confidence. Track land progress and possible risks before they affect the project.",
  },
  {
    num: "02",
    Icon: Landmark,
    title: "Land Acquiring Authority",
    desc: "Acquire without surprises. Monitor risks, approvals, compensation and issues that may slow acquisition.",
  },
  {
    num: "03",
    Icon: MapPin,
    title: "District Administration",
    desc: "See your district clearly. Find risky projects and focus on cases that need action.",
  },
  {
    num: "04",
    Icon: Flag,
    title: "State Government",
    desc: "See the bigger picture. Compare projects and districts and identify where attention is needed.",
  },
  {
    num: "05",
    Icon: HardHat,
    title: "Project Implementing Agency",
    desc: "Keep projects moving. Track land-related issues that may affect timelines and act early.",
  },
  {
    num: "06",
    Icon: Briefcase,
    title: "Policy Maker",
    desc: "Decide with better insight. Use project trends and risk information for better planning.",
  },
]

/*
 * Desktop 3×2 grid connection path:
 *  [0] → [1] → [2]
 *                ↓
 *  [5] ← [4] ← [3]
 *
 * Each entry = index of card that activates next, after current card.
 * Line direction keys: "right" | "left" | "down"
 */
const PATH_ORDER = [0, 1, 2, 3, 4, 5]
// After card i in PATH_ORDER, which connector direction comes next?
// connector[i] = direction from PATH_ORDER[i] to PATH_ORDER[i+1]
const CONNECTORS = ["right", "right", "down", "left", "left"] as const
type ConnDir = typeof CONNECTORS[number]

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const ACCENT = "#4a6fa5"

/* ─── Animated Connector line ───────────────────────────────────────────────── */
function Connector({ dir, active }: { dir: ConnDir; active: boolean }) {
  const isHoriz = dir === "right" || dir === "left"

  const lineStyle: React.CSSProperties = {
    position: "absolute",
    background: `linear-gradient(${isHoriz ? "90deg" : "180deg"}, ${ACCENT}, rgba(74,111,165,0.3))`,
    transformOrigin: dir === "right" ? "left center"
      : dir === "left" ? "right center"
      : dir === "down" ? "top center"
      : "bottom center",
    borderRadius: 2,
    ...(isHoriz
      ? { height: 2, width: "100%", top: "50%", transform: "translateY(-50%)" }
      : { width: 2, height: "100%", left: "50%", transform: "translateX(-50%)" }),
  }

  return (
    <div style={{
      position: "relative",
      ...(isHoriz
        ? { width: "100%", height: "100%", display: "flex", alignItems: "center" }
        : { width: "100%", height: "100%", display: "flex", justifyContent: "center" }),
    }}>
      <motion.div
        style={lineStyle}
        initial={{ scaleX: isHoriz ? 0 : 1, scaleY: isHoriz ? 1 : 0 }}
        animate={active
          ? { scaleX: 1, scaleY: 1 }
          : { scaleX: isHoriz ? 0 : 1, scaleY: isHoriz ? 1 : 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      />
      {/* Travelling dot */}
      {active && (
        <motion.div
          style={{
            position: "absolute",
            width: 8, height: 8, borderRadius: "50%",
            background: ACCENT,
            boxShadow: `0 0 10px ${ACCENT}`,
            ...(isHoriz
              ? { top: "50%", marginTop: -4 }
              : { left: "50%", marginLeft: -4 }),
          }}
          initial={isHoriz
            ? { x: dir === "right" ? "-120%" : "220%" }
            : { y: "-120%" }}
          animate={isHoriz
            ? { x: dir === "right" ? "220%" : "-120%" }
            : { y: "220%" }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
        />
      )}
    </div>
  )
}

/* ─── Role Card ─────────────────────────────────────────────────────────────── */
function RoleCard({
  role, state, isDark, reduced,
}: {
  role: typeof ROLES[number]
  state: CardState
  isDark: boolean
  reduced: boolean
}) {
  const { Icon } = role
  const isActive = state === "active"
  const isVisible = state !== "idle"

  return (
    <motion.div
      initial={{ opacity: 0, scale: reduced ? 1 : 0.95, y: reduced ? 0 : 12 }}
      animate={isVisible
        ? { opacity: 1, scale: 1, y: 0 }
        : { opacity: 0, scale: reduced ? 1 : 0.95, y: reduced ? 0 : 12 }}
      transition={{ duration: 0.48, ease: EASE }}
      whileHover={isVisible ? { y: -3, scale: 1.012 } : undefined}
      onMouseEnter={isVisible ? (e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = "rgba(74,111,165,0.45)"
        el.style.boxShadow = isDark
          ? "0 10px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(74,111,165,0.2)"
          : "0 8px 26px rgba(74,111,165,0.15), 0 0 0 1px rgba(74,111,165,0.2)"
      } : undefined}
      onMouseLeave={isVisible ? (e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = isActive
          ? "rgba(74,111,165,0.45)"
          : isDark ? "rgba(74,111,165,0.14)" : "rgba(74,111,165,0.11)"
        el.style.boxShadow = isDark ? "0 4px 18px rgba(0,0,0,0.32)" : "0 2px 10px rgba(74,111,165,0.06)"
      } : undefined}
      style={{
        position: "relative",
        background: isDark ? "rgba(10,22,44,0.97)" : "#ffffff",
        border: `1px solid ${isActive
          ? "rgba(74,111,165,0.45)"
          : isDark ? "rgba(74,111,165,0.14)" : "rgba(74,111,165,0.11)"}`,
        borderRadius: 16,
        padding: "24px 22px",
        boxShadow: isDark ? "0 4px 18px rgba(0,0,0,0.32)" : "0 2px 10px rgba(74,111,165,0.06)",
        transition: "border-color 0.22s ease, box-shadow 0.22s ease",
        cursor: "default",
        overflow: "hidden",
      }}
    >
      {/* Top accent bar */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={isVisible ? { scaleX: 1 } : { scaleX: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${ACCENT}, transparent 70%)`,
          transformOrigin: "left",
        }}
      />

      {/* "ACTIVE" status chip */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.22, ease: EASE }}
        style={{
          position: "absolute", top: 14, right: 14,
          fontSize: "0.55rem", fontWeight: 800, letterSpacing: "0.14em",
          color: ACCENT, background: "rgba(74,111,165,0.1)",
          border: "1px solid rgba(74,111,165,0.25)",
          borderRadius: 4, padding: "2px 6px",
          textTransform: "uppercase",
        }}
      >
        ACTIVE
      </motion.div>

      {/* Icon */}
      <motion.div
        initial={{ opacity: 0, scale: reduced ? 1 : 0.8 }}
        animate={isVisible ? { opacity: 1, scale: isActive && !reduced ? 1.05 : 1 } : { opacity: 0, scale: reduced ? 1 : 0.8 }}
        transition={{ duration: 0.38, ease: EASE, delay: 0.06 }}
        style={{
          width: 46, height: 46, borderRadius: 12,
          background: isDark ? "rgba(74,111,165,0.12)" : "rgba(74,111,165,0.08)",
          border: `1px solid ${isActive ? "rgba(74,111,165,0.32)" : "rgba(74,111,165,0.18)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: ACCENT, marginBottom: 16,
          boxShadow: isActive ? `0 0 18px rgba(74,111,165,0.22)` : "none",
          transition: "box-shadow 0.3s ease, border-color 0.3s ease",
        }}
      >
        <Icon size={22} strokeWidth={1.8} />
      </motion.div>

      {/* Num */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.28, delay: 0.04 }}
        style={{
          fontSize: "0.58rem", fontWeight: 800, letterSpacing: "0.12em",
          color: "rgba(74,111,165,0.38)", marginBottom: 5,
        }}
      >
        {role.num}
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: reduced ? 0 : 6 }}
        animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: reduced ? 0 : 6 }}
        transition={{ duration: 0.35, ease: EASE, delay: 0.12 }}
        style={{
          fontSize: "0.93rem", fontWeight: 800,
          color: isDark ? "#eaf0ff" : "#0a1d37",
          marginBottom: 9, lineHeight: 1.3,
        }}
      >
        {role.title}
      </motion.div>

      {/* Desc */}
      <motion.p
        initial={{ opacity: 0, y: reduced ? 0 : 6 }}
        animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: reduced ? 0 : 6 }}
        transition={{ duration: 0.35, ease: EASE, delay: 0.2 }}
        style={{
          fontSize: "0.82rem", lineHeight: 1.65, margin: 0,
          color: isDark ? "#94a9c9" : "#4a6280",
        }}
      >
        {role.desc}
      </motion.p>
    </motion.div>
  )
}

/* ─── Main Section ──────────────────────────────────────────────────────────── */
export default function RolesConnectedSection({ isDark }: { isDark: boolean }) {
  const sectionRef = useRef<HTMLElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: "-8% 0px" })
  const reduced = useReducedMotion() ?? false

  const [headingVisible, setHeadingVisible] = useState(false)
  const [cardStates, setCardStates] = useState<CardState[]>(Array(6).fill("idle"))
  const [connectors, setConnectors] = useState<boolean[]>(Array(5).fill(false))
  const [tagVisible, setTagVisible] = useState(false)

  const setCard = useCallback((i: number, s: CardState) => {
    setCardStates(p => { const n = [...p] as CardState[]; n[i] = s; return n })
  }, [])

  const setConn = useCallback((i: number, v: boolean) => {
    setConnectors(p => { const n = [...p]; n[i] = v; return n })
  }, [])

  useEffect(() => {
    if (!isInView) return

    const timers: ReturnType<typeof setTimeout>[] = []
    const t = (fn: () => void, ms: number) => { const id = setTimeout(fn, ms); timers.push(id); return id }

    if (reduced) {
      setHeadingVisible(true)
      PATH_ORDER.forEach((cardIdx, step) => {
        t(() => setCard(cardIdx, "done"), 300 + step * 100)
      })
      t(() => setTagVisible(true), 300 + 6 * 100 + 150)
      return () => timers.forEach(clearTimeout)
    }

    // heading
    t(() => setHeadingVisible(true), 100)

    // walk the path
    let cursor = 600 // ms from start
    PATH_ORDER.forEach((cardIdx, step) => {
      const isLast = step === PATH_ORDER.length - 1
      const prevStep = step - 1

      // card becomes active
      t(() => setCard(cardIdx, "active"), cursor)

      // after 200ms, show connector to next card (if not last)
      if (!isLast) {
        t(() => setConn(step, true), cursor + 200)
      }

      // previous card goes to "done" once next card activates
      if (prevStep >= 0) {
        t(() => setCard(PATH_ORDER[prevStep], "done"), cursor + 50)
      }

      cursor += 500 // gap between each card
    })

    // all briefly re-highlight
    const allAt = cursor + 100
    t(() => PATH_ORDER.forEach((ci) => setCard(ci, "done")), allAt)
    t(() => setTagVisible(true), allAt + 400)

    return () => timers.forEach(clearTimeout)
  }, [isInView, reduced, setCard, setConn])

  return (
    <section
      ref={sectionRef}
      id="roles-section"
      style={{
        background: isDark ? "#060f1e" : "#f5f7f9",
        padding: "88px 40px 80px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>{`
        @media(prefers-reduced-motion:reduce){*{animation-duration:0.001ms!important;transition-duration:0.001ms!important}}
        @media(max-width:768px){
          .crp-grid{grid-template-columns:1fr!important}
          .crp-hconn{display:none!important}
          .crp-vconn{display:flex!important}
        }
        @media(min-width:769px) and (max-width:1060px){
          .crp-grid{grid-template-columns:repeat(2,1fr)!important}
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* ── Heading ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : 20 }}
          animate={headingVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.62, ease: EASE }}
          style={{ textAlign: "center", marginBottom: 56 }}
        >
          <h2 style={{
            fontSize: "clamp(1.6rem,3vw,2.2rem)", fontWeight: 900,
            letterSpacing: "-0.03em",
            color: isDark ? "#f0f6fc" : "#0a1d37",
            marginBottom: 12, lineHeight: 1.2,
          }}>
            Built for Every Role in Land Acquisition
          </h2>
          <motion.p
            initial={{ opacity: 0, y: reduced ? 0 : 10 }}
            animate={headingVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.52, delay: 0.15, ease: EASE }}
            style={{
              fontSize: "1rem", color: ACCENT,
              maxWidth: 520, margin: "0 auto",
              lineHeight: 1.65, fontWeight: 500,
            }}
          >
            One platform. Every team. One clear view of land-acquisition progress.
          </motion.p>
        </motion.div>

        {/* ── Desktop grid with connectors ─────────────────────────────── */}
        {/*
         * Layout:
         *  [card0] [h-conn0] [card1] [h-conn1] [card2]
         *                                      [v-conn2]   <- down connector
         *  [card5] [h-conn4] [card4] [h-conn3] [card3]
         *
         * We build a CSS-grid with connector columns/rows interleaved.
         * Desktop: 5 cols [1fr 40px 1fr 40px 1fr], 3 rows [auto 40px auto]
         */}
        <div
          className="crp-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 48px 1fr 48px 1fr",
            gridTemplateRows: "auto 48px auto",
            gap: "0",
          }}
        >
          {/* Row 0: cards 0,1,2 + h-connectors 0,1 */}
          {/* Card 0 */}
          <div style={{ gridColumn: 1, gridRow: 1 }}>
            <RoleCard role={ROLES[0]} state={cardStates[0]} isDark={isDark} reduced={reduced} />
          </div>
          {/* H-connector 0→1 */}
          <div className="crp-hconn" style={{ gridColumn: 2, gridRow: 1, display: "flex", alignItems: "center" }}>
            <Connector dir="right" active={connectors[0]} />
          </div>
          {/* Card 1 */}
          <div style={{ gridColumn: 3, gridRow: 1 }}>
            <RoleCard role={ROLES[1]} state={cardStates[1]} isDark={isDark} reduced={reduced} />
          </div>
          {/* H-connector 1→2 */}
          <div className="crp-hconn" style={{ gridColumn: 4, gridRow: 1, display: "flex", alignItems: "center" }}>
            <Connector dir="right" active={connectors[1]} />
          </div>
          {/* Card 2 */}
          <div style={{ gridColumn: 5, gridRow: 1 }}>
            <RoleCard role={ROLES[2]} state={cardStates[2]} isDark={isDark} reduced={reduced} />
          </div>

          {/* Row 1 (vertical connector row): only column 5 has connector (2→3 down) */}
          <div className="crp-hconn" style={{ gridColumn: 5, gridRow: 2, display: "flex", justifyContent: "center" }}>
            <Connector dir="down" active={connectors[2]} />
          </div>

          {/* Row 2: cards 5,4,3 + h-connectors (reversed) */}
          {/* Card 5 */}
          <div style={{ gridColumn: 1, gridRow: 3 }}>
            <RoleCard role={ROLES[5]} state={cardStates[5]} isDark={isDark} reduced={reduced} />
          </div>
          {/* H-connector 4→5 (left direction) */}
          <div className="crp-hconn" style={{ gridColumn: 2, gridRow: 3, display: "flex", alignItems: "center" }}>
            <Connector dir="left" active={connectors[4]} />
          </div>
          {/* Card 4 */}
          <div style={{ gridColumn: 3, gridRow: 3 }}>
            <RoleCard role={ROLES[4]} state={cardStates[4]} isDark={isDark} reduced={reduced} />
          </div>
          {/* H-connector 3→4 (left direction) */}
          <div className="crp-hconn" style={{ gridColumn: 4, gridRow: 3, display: "flex", alignItems: "center" }}>
            <Connector dir="left" active={connectors[3]} />
          </div>
          {/* Card 3 */}
          <div style={{ gridColumn: 5, gridRow: 3 }}>
            <RoleCard role={ROLES[3]} state={cardStates[3]} isDark={isDark} reduced={reduced} />
          </div>
        </div>

        {/* ── Final tagline ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
          animate={tagVisible ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.48, ease: EASE }}
          style={{ textAlign: "center", marginTop: 52 }}
        >
          <motion.div
            initial={{ scaleY: 0, opacity: 0 }}
            animate={tagVisible ? { scaleY: 1, opacity: 1 } : {}}
            transition={{ duration: 0.35, ease: EASE }}
            style={{
              width: 1, height: 32,
              background: `linear-gradient(to bottom, rgba(74,111,165,0.42), transparent)`,
              margin: "0 auto 14px", transformOrigin: "top",
            }}
          />
          <span style={{
            display: "inline-block",
            fontSize: "0.72rem", fontWeight: 800,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: ACCENT,
          }}>
            Connected Teams.&nbsp;&nbsp;Faster Action.
          </span>
        </motion.div>

      </div>
    </section>
  )
}
