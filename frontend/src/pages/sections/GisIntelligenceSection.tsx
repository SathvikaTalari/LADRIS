/**
 * GisIntelligenceSection — LADRIS Landing Page
 * Animation: MAP PIN DROP — markers drop one-by-one, each activates matching card.
 * Map: react-leaflet v5 + leaflet v1.9 (already installed)
 */
import { useEffect, useRef, useState, useCallback, memo } from "react"
import { motion, useInView, useReducedMotion } from "framer-motion"
import {
  MapPin, ChevronRight, Building2, Landmark, Factory,
  TreePine, HardHat, AlertTriangle,
} from "lucide-react"
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

const ACCENT = "#4a6fa5"
const EASE: [number,number,number,number] = [0.22, 1, 0.36, 1]
const RISK_COLOR = { High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e" } as const
type RiskLevel = keyof typeof RISK_COLOR

// India geographic bounds — restricts map panning to India only
const INDIA_BOUNDS: [[number,number],[number,number]] = [
  [6.0, 67.5],   // SW corner
  [37.5, 98.5],  // NE corner
]
const INDIA_CENTER: [number,number] = [20.5937, 78.9629]

// Tile layers — 100% free, reliable, no API key or watermark required
const TILE_LAYERS = {
  osm: {
    name: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18,
  },
  topo: {
    name: 'Terrain',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18,
  },
}

interface Project {
  id: number; name: string; state: string; risk: RiskLevel
  riskScore: number; delayProb: string; mainRisk: string; stage: string
  coords: [number, number]; Icon: React.ElementType
}

const PROJECTS: Project[] = [
  { id:1, name:"Highway Project A",        state:"Telangana",       risk:"High",   riskScore:84, delayProb:"High",     mainRisk:"Pending Approval",     stage:"Land Acquisition",    coords:[17.385,78.4867], Icon:Building2 },
  { id:2, name:"Infrastructure Project B", state:"Andhra Pradesh",  risk:"Medium", riskScore:56, delayProb:"Moderate", mainRisk:"Compensation Delay",   stage:"Section 11 Notice",   coords:[15.9129,79.74],  Icon:Landmark  },
  { id:3, name:"Industrial Corridor C",    state:"Maharashtra",     risk:"High",   riskScore:78, delayProb:"High",     mainRisk:"Legal Dispute",        stage:"Award Declaration",   coords:[19.7515,75.7139],Icon:Factory   },
  { id:4, name:"Project D",                state:"Karnataka",       risk:"Low",    riskScore:22, delayProb:"Low",      mainRisk:"Minor Documentation",  stage:"Possession",          coords:[15.3173,75.7139],Icon:TreePine  },
  { id:5, name:"Project E",                state:"Odisha",          risk:"Medium", riskScore:51, delayProb:"Moderate", mainRisk:"Rehabilitation Issue", stage:"Compensation Payment",coords:[20.9517,85.0985],Icon:HardHat  },
]

/* MapController — flyTo on selection, respects India bounds */
function MapController({ activeId }: { activeId: number|null }) {
  const map = useMap()
  useEffect(() => {
    if (activeId === null) return
    const proj = PROJECTS.find(p => p.id === activeId)
    if (!proj) return
    map.flyTo(proj.coords, 7, { duration: 1.1 })
  }, [activeId, map])
  return null
}

/* Map Legend — absolute positioned */
function MapLegend({ hi }: { hi: boolean }) {
  return (
    <div style={{
      position:"absolute", bottom:28, left:14, zIndex:800,
      background:"rgba(255,255,255,0.94)", border:"1px solid rgba(0,0,0,0.08)",
      borderRadius:10, padding:"8px 12px",
      boxShadow:"0 4px 16px rgba(0,0,0,0.12)", backdropFilter:"blur(6px)",
    }}>
      <div style={{ fontSize:"0.56rem", fontWeight:800, letterSpacing:"0.1em", color:"#475569", marginBottom:6, textTransform:"uppercase" }}>{hi ? 'जोखिम स्तर' : 'Risk Level'}</div>
      {(Object.entries(RISK_COLOR) as [RiskLevel,string][]).map(([label, color]) => (
        <div key={label} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
          <div style={{ width:9, height:9, borderRadius:"50%", background:color, flexShrink:0 }} />
          <span style={{ fontSize:"0.67rem", fontWeight:600, color:"#334155" }}>{hi ? (label === 'High' ? 'उच्च जोखिम' : label === 'Medium' ? 'मध्यम जोखिम' : 'निम्न जोखिम') : `${label} Risk`}</span>
        </div>
      ))}
    </div>
  )
}

/* Project Card */
const ProjectCard = memo(function ProjectCard({
  proj, isActive, isVisible, onSelect, isDark,
}: { proj:Project; isActive:boolean; isVisible:boolean; onSelect:(id:number)=>void; isDark:boolean }) {
  const color = RISK_COLOR[proj.risk]
  const { Icon } = proj
  return (
    <motion.div
      initial={{ opacity:0, x:-16 }}
      animate={isVisible ? { opacity:1, x:0, y:isActive ? -3 : 0 } : { opacity:0, x:-16 }}
      transition={{ duration:0.42, ease:EASE }}
      onClick={() => onSelect(proj.id)}
      style={{
        display:"flex", alignItems:"center", gap:11,
        padding:"12px 14px",
        background: isDark ? (isActive ? "rgba(74,111,165,0.12)" : "rgba(10,22,44,0.97)") : (isActive ? "rgba(74,111,165,0.06)" : "#ffffff"),
        border:`1px solid ${isActive ? color+"55" : isDark ? "rgba(74,111,165,0.14)" : "rgba(74,111,165,0.11)"}`,
        borderRadius:13,
        boxShadow: isActive ? `0 6px 20px ${color}22, 0 0 0 1px ${color}33` : isDark ? "0 2px 10px rgba(0,0,0,0.28)" : "0 1px 6px rgba(74,111,165,0.06)",
        cursor:"pointer", transition:"border-color 0.22s ease, box-shadow 0.22s ease, background 0.22s ease",
        position:"relative", overflow:"hidden",
      }}
    >
      {isActive && (
        <div style={{ position:"absolute", top:0, left:0, bottom:0, width:3,
          background:`linear-gradient(to bottom, ${color}, transparent)`, borderRadius:"13px 0 0 13px" }} />
      )}
      <div style={{ width:36, height:36, borderRadius:9, flexShrink:0,
        background:`${color}18`, border:`1px solid ${color}30`,
        display:"flex", alignItems:"center", justifyContent:"center", color }}>
        <Icon size={17} strokeWidth={1.8} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:"0.84rem", fontWeight:700,
          color: isDark ? "#eaf0ff" : "#0a1d37",
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginBottom:2 }}>
          {proj.name}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <MapPin size={9} color={ACCENT} />
          <span style={{ fontSize:"0.7rem", color: isDark ? "#94a9c9" : "#4a6280" }}>{proj.state}</span>
        </div>
      </div>
      <div style={{ fontSize:"0.56rem", fontWeight:800, letterSpacing:"0.1em",
        color:"#fff", background:color, borderRadius:5, padding:"2px 7px", flexShrink:0,
        boxShadow: isActive ? `0 2px 8px ${color}44` : "none", transition:"box-shadow 0.22s ease" }}>
        {proj.risk.toUpperCase()}
      </div>
      <motion.div animate={{ x: isActive ? 3 : 0 }} transition={{ duration:0.25, ease:EASE }}
        style={{ flexShrink:0, color:ACCENT, opacity:0.6 }}>
        <ChevronRight size={15} />
      </motion.div>
    </motion.div>
  )
})

/* Detail Panel */
function DetailPanel({ proj, isDark, hi }: { proj:Project|null; isDark:boolean; hi:boolean }) {
  if (!proj) return null
  const color = RISK_COLOR[proj.risk]
  const fields = [
    [hi ? 'जोखिम स्कोर' : 'Risk Score', `${proj.riskScore}%`],
    [hi ? 'विलंब संभावना' : 'Delay Probability', proj.delayProb],
    [hi ? 'मुख्य जोखिम' : 'Main Risk', proj.mainRisk],
    [hi ? 'वर्तमान चरण' : 'Current Stage', proj.stage],
  ] as const
  return (
    <motion.div key={proj.id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.32, ease:EASE }}
      style={{ background: isDark ? "rgba(10,22,44,0.97)" : "#fff",
        border:`1px solid ${color}40`, borderRadius:12, padding:"14px 16px", marginTop:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <AlertTriangle size={13} color={color} />
        <span style={{ fontSize:"0.7rem", fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase",
          color: isDark ? "#eaf0ff" : "#0a1d37" }}>
          {proj.name}
        </span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"9px 14px" }}>
        {fields.map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize:"0.57rem", fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase",
              color: isDark ? "#64748b" : "#94a3b8", marginBottom:2 }}>{k}</div>
            <div style={{ fontSize:"0.8rem", fontWeight:700,
              color: (k==="Risk Score"||k==="Delay Probability") ? color : isDark ? "#eaf0ff" : "#0a1d37" }}>
              {v}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

/* Main Export */
export default function GisIntelligenceSection({ isDark, language }: { isDark: boolean; language: 'en' | 'hi' }) {
  const hi = language === 'hi'

  const PROJECTS: Project[] = [
    { id:1, name: hi ? 'राजमार्ग प्रोजेक्ट A'        : 'Highway Project A',        state: hi ? 'तेलंगाना'       : 'Telangana',       risk:'High'   as const, riskScore:84, delayProb: hi ? 'उच्च'     : 'High',     mainRisk: hi ? 'लंबित अनुमोदन'     : 'Pending Approval',     stage: hi ? 'भूमि अधिग्रहण'    : 'Land Acquisition',    coords:[17.385,78.4867] as [number,number], Icon:Building2 },
    { id:2, name: hi ? 'अवसंरचना प्रोजेक्ट B'      : 'Infrastructure Project B', state: hi ? 'आंध्र प्रदेश'  : 'Andhra Pradesh',  risk:'Medium' as const, riskScore:56, delayProb: hi ? 'मध्यम'   : 'Moderate', mainRisk: hi ? 'मुआवज़ा विलंब'   : 'Compensation Delay',   stage: hi ? 'धारा 11 नोटिस'   : 'Section 11 Notice',   coords:[15.9129,79.74]  as [number,number], Icon:Landmark  },
    { id:3, name: hi ? 'औद्योगिक गलियारा C'    : 'Industrial Corridor C',    state: hi ? 'महाराष्ट्र'     : 'Maharashtra',     risk:'High'   as const, riskScore:78, delayProb: hi ? 'उच्च'     : 'High',     mainRisk: hi ? 'कानूनी विवाद'        : 'Legal Dispute',        stage: hi ? 'पुरस्कार घोषणा'   : 'Award Declaration',   coords:[19.7515,75.7139] as [number,number], Icon:Factory   },
    { id:4, name: hi ? 'प्रोजेक्ट D'                : 'Project D',                state: hi ? 'कर्नाटक'       : 'Karnataka',       risk:'Low'    as const, riskScore:22, delayProb: hi ? 'निम्न'     : 'Low',      mainRisk: hi ? 'आंशिक दस्तावेज़'  : 'Minor Documentation',  stage: hi ? 'कब्जा'            : 'Possession',          coords:[15.3173,75.7139] as [number,number], Icon:TreePine  },
    { id:5, name: hi ? 'प्रोजेक्ट E'                : 'Project E',                state: hi ? 'ओड़िशा'          : 'Odisha',          risk:'Medium' as const, riskScore:51, delayProb: hi ? 'मध्यम'   : 'Moderate', mainRisk: hi ? 'पुनर्वास समस्या' : 'Rehabilitation Issue', stage: hi ? 'मुआवज़ा भुगतान' : 'Compensation Payment', coords:[20.9517,85.0985] as [number,number], Icon:HardHat  },
  ]

  const sectionRef = useRef<HTMLElement>(null)
  const isInView   = useInView(sectionRef, { once:true, margin:"-8% 0px" })
  const reduced    = useReducedMotion() ?? false
  // suppress unused L warning — needed for leaflet icon fix
  void L

  const [headingVisible, setHeadingVisible] = useState(false)
  const [mapVisible,     setMapVisible]     = useState(false)
  const [visibleMarkers, setVisibleMarkers] = useState<number[]>([])
  const [activeId,       setActiveId]       = useState<number|null>(null)
  const [tagVisible,     setTagVisible]     = useState(false)
  const [tileType,       setTileType]       = useState<'osm' | 'satellite' | 'topo'>('osm')

  const selectProject = useCallback((id: number) => setActiveId(id), [])

  useEffect(() => {
    if (!isInView) return
    const ts: ReturnType<typeof setTimeout>[] = []
    const t = (fn: ()=>void, ms: number) => { const id = setTimeout(fn, ms); ts.push(id) }

    t(() => setHeadingVisible(true), 100)
    t(() => setMapVisible(true), 480)

    let cursor = 900
    PROJECTS.forEach(proj => {
      t(() => setVisibleMarkers(prev => [...prev, proj.id]), cursor)
      if (!reduced) t(() => setActiveId(proj.id), cursor + 320)
      cursor += reduced ? 100 : 800
    })
    if (!reduced) t(() => setActiveId(null), cursor + 200)
    t(() => setTagVisible(true), cursor + (reduced ? 200 : 600))

    return () => ts.forEach(clearTimeout)
  }, [isInView, reduced])

  const activeProject = PROJECTS.find(p => p.id === activeId) ?? null

  return (
    <section ref={sectionRef} id="gis-section" style={{
      background: isDark ? "#070d1a" : "#f0f4f9",
      padding:"88px 40px 80px", overflow:"hidden", position:"relative",
    }}>
      <style>{`
        @media(prefers-reduced-motion:reduce){*{animation-duration:0.001ms!important;transition-duration:0.001ms!important}}
        .gis-layout{display:grid;grid-template-columns:2fr 3fr;gap:28px;align-items:start}
        .gis-map-wrap{border-radius:18px;overflow:hidden;height:480px;position:relative;box-shadow:0 8px 40px rgba(0,0,0,0.18)}
        .gis-map-wrap .leaflet-container{background:#e8f4f0!important}
        @media(max-width:900px){.gis-layout{grid-template-columns:1fr!important}.gis-map-wrap{height:340px!important}}
        @media(max-width:600px){.gis-map-wrap{height:260px!important}}
      `}</style>

      <div style={{ maxWidth:1140, margin:"0 auto" }}>

        {/* Heading */}
        <motion.div initial={{ opacity:0, y: reduced?0:15 }} animate={headingVisible?{opacity:1,y:0}:{}}
          transition={{ duration:0.6, ease:EASE }} style={{ textAlign:"center", marginBottom:44 }}>
          <h2 style={{ fontSize:"clamp(1.6rem,3vw,2.2rem)", fontWeight:900, letterSpacing:"-0.03em",
            color: isDark?"#f0f6fc":"#0a1d37", marginBottom:10, lineHeight:1.2 }}>
            LADRIS GIS Intelligence
          </h2>
          <motion.p initial={{ opacity:0, y: reduced?0:10 }} animate={headingVisible?{opacity:1,y:0}:{}}
            transition={{ duration:0.5, delay:0.14, ease:EASE }}
            style={{ fontSize:"1rem", fontWeight:500, color:ACCENT, maxWidth:420, margin:"0 auto", lineHeight:1.6 }}>
            {hi ? 'जोखिम देखें। समस्या खोजें। जल्दी कार्रवाई करें।' : 'See the risk. Find the problem. Act early.'}
          </motion.p>
        </motion.div>

        {/* 2-col layout */}
        <div className="gis-layout">

          {/* LEFT: project list */}
          <div>
            <div style={{ fontSize:"0.63rem", fontWeight:800, letterSpacing:"0.14em",
              textTransform:"uppercase", color:ACCENT, marginBottom:13 }}>
              Featured Projects
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {PROJECTS.map(proj => (
                <ProjectCard key={proj.id} proj={proj}
                  isActive={activeId===proj.id}
                  isVisible={visibleMarkers.includes(proj.id)}
                  onSelect={selectProject} isDark={isDark} />
              ))}
            </div>
            <DetailPanel proj={activeProject} isDark={isDark} hi={hi} />
            <div style={{ marginTop:12, fontSize:"0.6rem", color: isDark?"#475569":"#94a3b8", lineHeight:1.5 }}>
              * Prototype values for UI demonstration only.
            </div>
          </div>

          {/* RIGHT: map */}
          <motion.div className="gis-map-wrap"
            initial={{ opacity:0, scale: reduced?1:0.98 }}
            animate={mapVisible?{opacity:1,scale:1}:{}}
            transition={{ duration:0.65, ease:EASE }}>
                      {mapVisible && (
              <MapContainer
                center={INDIA_CENTER}
                zoom={5}
                minZoom={4}
                maxZoom={14}
                maxBounds={INDIA_BOUNDS}
                maxBoundsViscosity={1.0}
                style={{ width:"100%", height:"100%" }}
                zoomControl={true}
                scrollWheelZoom={false}
              >
                {/* Clean, watermark-free map tiles with optional satellite and terrain view */}
                <TileLayer
                  key={tileType}
                  url={TILE_LAYERS[tileType].url}
                  attribution={TILE_LAYERS[tileType].attribution}
                  maxZoom={TILE_LAYERS[tileType].maxZoom}
                />

                {/* Interactive Map Layer Switcher (Street, Satellite, Terrain) */}
                <div style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  zIndex: 800,
                  display: "flex",
                  background: isDark ? "rgba(10,22,44,0.92)" : "rgba(255,255,255,0.95)",
                  padding: 3,
                  borderRadius: 8,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
                  gap: 3,
                  backdropFilter: "blur(8px)",
                }}>
                  <button
                    type="button"
                    onClick={() => setTileType('osm')}
                    style={{
                      padding: "5px 11px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: tileType === 'osm' ? "#003366" : "transparent",
                      color: tileType === 'osm' ? "#ffffff" : (isDark ? "#cbd5e1" : "#334155"),
                      transition: "all 0.15s ease",
                    }}
                  >
                    {hi ? 'सड़क (Street)' : 'Street'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTileType('satellite')}
                    style={{
                      padding: "5px 11px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: tileType === 'satellite' ? "#003366" : "transparent",
                      color: tileType === 'satellite' ? "#ffffff" : (isDark ? "#cbd5e1" : "#334155"),
                      transition: "all 0.15s ease",
                    }}
                  >
                    {hi ? 'उपग्रह (Satellite)' : 'Satellite'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTileType('topo')}
                    style={{
                      padding: "5px 11px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: tileType === 'topo' ? "#003366" : "transparent",
                      color: tileType === 'topo' ? "#ffffff" : (isDark ? "#cbd5e1" : "#334155"),
                      transition: "all 0.15s ease",
                    }}
                  >
                    {hi ? 'स्थलाकृति (Terrain)' : 'Terrain'}
                  </button>
                </div>

                <MapController activeId={activeId} />

                {PROJECTS.map(proj => {
                  const visible = visibleMarkers.includes(proj.id)
                  if (!visible) return null
                  const isActive = activeId === proj.id
                  const color = RISK_COLOR[proj.risk]
                  return (
                    <CircleMarker key={proj.id} center={proj.coords}
                      radius={isActive ? 14 : 10}
                      pathOptions={{ color:"#ffffff", weight:2.5, fillColor:color, fillOpacity:0.95 }}
                      eventHandlers={{ click: () => selectProject(proj.id) }}>
                      {/* Outer pulse ring */}
                      <CircleMarker center={proj.coords}
                        radius={isActive ? 24 : 17}
                        pathOptions={{ color, weight:2, fillOpacity:0, opacity: isActive ? 0.6 : 0.28 }}
                        interactive={false} />
                      <Popup>
                        <div style={{ minWidth:160 }}>
                          <div style={{ display:"inline-block", fontSize:"0.58rem", fontWeight:800,
                            color:"#fff", background:color, borderRadius:4, padding:"2px 7px", marginBottom:6 }}>
                            {proj.risk.toUpperCase()} RISK
                          </div>
                          <div style={{ fontSize:"0.87rem", fontWeight:700, color:"#0a1d37", marginBottom:2 }}>
                            {proj.name}
                          </div>
                          <div style={{ fontSize:"0.72rem", color:"#4a6280", marginBottom:8 }}>{proj.state}</div>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 10px" }}>
                            {[["Risk Score",`${proj.riskScore}%`],["Delay Prob.",proj.delayProb],
                              ["Main Risk",proj.mainRisk],["Stage",proj.stage]].map(([k,v])=>(
                              <div key={k}>
                                <div style={{ fontSize:"0.58rem", color:"#94a3b8", letterSpacing:"0.07em" }}>{k}</div>
                                <div style={{ fontSize:"0.73rem", fontWeight:700, color:"#0a1d37" }}>{v}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  )
                })}

                <MapLegend hi={hi} />
              </MapContainer>
            )}
          </motion.div>
        </div>

        {/* Final tagline */}
        <motion.div initial={{ opacity:0 }} animate={tagVisible?{opacity:1}:{}}
          transition={{ duration:0.52, ease:EASE }} style={{ textAlign:"center", marginTop:44 }}>
          <div style={{ width:1, height:26,
            background:"linear-gradient(to bottom, rgba(74,111,165,0.42), transparent)",
            margin:"0 auto 12px" }} />
          <span style={{ fontSize:"0.68rem", fontWeight:800, letterSpacing:"0.18em",
            textTransform:"uppercase", color:ACCENT }}>
            From location to risk — everything in one view.
          </span>
        </motion.div>
      </div>
    </section>
  )
}
