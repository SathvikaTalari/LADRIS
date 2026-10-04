import { useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, AlertTriangle, ShieldCheck, Clock, FileText, Scale, CheckCircle2 } from 'lucide-react'

interface SmartAnalyticsSectionProps {
  isDark?: boolean
  language?: string
}

interface CorridorData {
  id: string
  nameEn: string
  nameHi: string
  avgDelay: string
  riskProjects: number
  accuracy: string
  pts: { stageEn: string; stageHi: string; days: number; risk: 'LOW' | 'MEDIUM' | 'HIGH'; milestone: string }[]
}

const CORRIDOR_DATASETS: CorridorData[] = [
  {
    id: 'all',
    nameEn: 'All Infrastructure Packages',
    nameHi: 'सभी बुनियादी ढांचा पैकेज',
    avgDelay: '26 Days Avg Delay',
    riskProjects: 5,
    accuracy: '94.2%',
    pts: [
      { stageEn: 'Sec 3A Gazette', stageHi: 'धारा 3A राजपत्र', days: 12, risk: 'LOW', milestone: 'Preliminary Notification' },
      { stageEn: 'Joint Survey (JMS)', stageHi: 'संयुक्त सर्वेक्षण (JMS)', days: 28, risk: 'LOW', milestone: 'Boundary Verification' },
      { stageEn: 'Sec 3D Declaration', stageHi: 'धारा 3D घोषणा', days: 74, risk: 'HIGH', milestone: 'Vesting Declaration' },
      { stageEn: 'Asset Valuation', stageHi: 'संपत्ति मूल्यांकन', days: 48, risk: 'MEDIUM', milestone: 'Tree/Structure Survey' },
      { stageEn: 'Award Determination', stageHi: 'मुआवजा निर्णय (CALA)', days: 22, risk: 'LOW', milestone: 'Section 3G Award' },
      { stageEn: 'Possession Handover', stageHi: 'भौतिक कब्जा एवं हैंडओवर', days: 14, risk: 'LOW', milestone: 'Civil Work Clearance' },
    ],
  },
  {
    id: 'highways',
    nameEn: 'National Highways (NHAI)',
    nameHi: 'राष्ट्रीय राजमार्ग (NHAI)',
    avgDelay: '34 Days Avg Delay',
    riskProjects: 3,
    accuracy: '95.6%',
    pts: [
      { stageEn: 'Sec 3A Gazette', stageHi: 'धारा 3A राजपत्र', days: 10, risk: 'LOW', milestone: 'Route Alignment' },
      { stageEn: 'Joint Survey (JMS)', stageHi: 'संयुक्त सर्वेक्षण (JMS)', days: 32, risk: 'MEDIUM', milestone: 'Field Cadastral Ties' },
      { stageEn: 'Sec 3D Declaration', stageHi: 'धारा 3D घोषणा', days: 86, risk: 'HIGH', milestone: 'Statutory 1-Yr Deadline' },
      { stageEn: 'Asset Valuation', stageHi: 'संपत्ति मूल्यांकन', days: 54, risk: 'HIGH', milestone: 'Revenue & Forest Review' },
      { stageEn: 'Award Determination', stageHi: 'मुआवजा निर्णय (CALA)', days: 26, risk: 'MEDIUM', milestone: 'Treasury Deposit' },
      { stageEn: 'Possession Handover', stageHi: 'भौतिक कब्जा एवं हैंडओवर', days: 16, risk: 'LOW', milestone: 'RoW Handover' },
    ],
  },
  {
    id: 'rail',
    nameEn: 'Freight & Metro Rail (DFCCIL/BMRCL)',
    nameHi: 'माल एवं मेट्रो रेल',
    avgDelay: '22 Days Avg Delay',
    riskProjects: 2,
    accuracy: '93.8%',
    pts: [
      { stageEn: 'Sec 3A Gazette', stageHi: 'धारा 3A राजपत्र', days: 14, risk: 'LOW', milestone: 'Station / Yard Boundary' },
      { stageEn: 'Joint Survey (JMS)', stageHi: 'संयुक्त सर्वेक्षण (JMS)', days: 24, risk: 'LOW', milestone: 'Urban Parcel Demarcation' },
      { stageEn: 'Sec 3D Declaration', stageHi: 'धारा 3D घोषणा', days: 62, risk: 'MEDIUM', milestone: 'Special Railway Act' },
      { stageEn: 'Asset Valuation', stageHi: 'संपत्ति मूल्यांकन', days: 38, risk: 'MEDIUM', milestone: 'Commercial Land Valuation' },
      { stageEn: 'Award Determination', stageHi: 'मुआवजा निर्णय (CALA)', days: 18, risk: 'LOW', milestone: 'Direct Transfer' },
      { stageEn: 'Possession Handover', stageHi: 'भौतिक कब्जा एवं हैंडओवर', days: 10, risk: 'LOW', milestone: 'Track Access' },
    ],
  },
]

export default function SmartAnalyticsSection({ isDark = false, language = 'en' }: SmartAnalyticsSectionProps) {
  const isHindi = language === 'hi'
  const [selectedCorridor, setSelectedCorridor] = useState<string>('all')
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)

  const activeDataset = CORRIDOR_DATASETS.find((d) => d.id === selectedCorridor) || CORRIDOR_DATASETS[0]
  const pts = activeDataset.pts

  // SVG Chart Dimensions
  const chartW = 540
  const chartH = 220
  const padLeft = 46
  const padRight = 36
  const padTop = 32
  const padBottom = 42

  const maxDays = 100
  const plotW = chartW - padLeft - padRight
  const plotH = chartH - padTop - padBottom

  // Coordinates calculation
  const coords = pts.map((p, i) => {
    const x = padLeft + (i / (pts.length - 1)) * plotW
    const y = padTop + plotH - (p.days / maxDays) * plotH
    return { ...p, x, y }
  })

  // Build smooth curve path
  const curvePath = coords.reduce((acc, curr, idx, arr) => {
    if (idx === 0) return `M ${curr.x} ${curr.y}`
    const prev = arr[idx - 1]
    const cx1 = prev.x + (curr.x - prev.x) / 2
    const cy1 = prev.y
    const cx2 = prev.x + (curr.x - prev.x) / 2
    const cy2 = curr.y
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${curr.x} ${curr.y}`
  }, '')

  const areaPath = `${curvePath} L ${coords[coords.length - 1].x} ${padTop + plotH} L ${coords[0].x} ${padTop + plotH} Z`

  return (
    <section
      id="analytics"
      style={{
        padding: '88px 32px 80px',
        background: isDark
          ? 'linear-gradient(180deg, #060e1d 0%, #081326 50%, #060e1d 100%)'
          : 'linear-gradient(180deg, #f7f9fc 0%, #f0f4f9 50%, #f7f9fc 100%)',
        position: 'relative',
        overflow: 'hidden',
        borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,51,102,0.06)',
      }}
    >
      <div style={{ maxWidth: 1160, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* ── Section Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{
              fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
              fontWeight: 900,
              letterSpacing: '-0.03em',
              color: isDark ? '#f0f6fc' : '#0a1d37',
              margin: '0 0 12px',
              lineHeight: 1.2,
            }}
          >
            {isHindi ? 'स्मार्ट विश्लेषण एवं पूर्वानुमान' : 'Smart Analytics & Delay Intelligence'}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            style={{
              fontSize: '1rem',
              fontWeight: 500,
              color: isDark ? '#94a9c9' : '#4a6280',
              maxWidth: 640,
              margin: '0 auto',
              lineHeight: 1.65,
            }}
          >
            {isHindi
              ? 'भूमि अधिग्रहण डेटा को स्पष्ट, पूर्वानुमानात्मक अंतर्दृष्टि में बदलें ताकि समय रहते सही कदम उठाए जा सकें।'
              : 'Transform raw revenue and gazette milestones into predictive delay trajectories before statutory deadlines lapse.'}
          </motion.p>
        </div>

        {/* ── Executive Metric KPI Badges ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 32,
          }}
        >
          {[
            {
              label: isHindi ? 'पूर्वानुमान सटीकता' : 'ML Forecast Accuracy',
              val: '94.2%',
              desc: isHindi ? 'ग्रेडिएंट बूस्टेड रिग्रेशन मॉडल' : 'Gradient Boosted Delay Model',
              icon: <TrendingUp size={20} color="#38bdf8" />,
            },
            {
              label: isHindi ? 'शुरुआती चेतावनी विंडो' : 'Early Warning Horizon',
              val: '45 Days',
              desc: isHindi ? 'धारा 3D समाप्ति से पहले अलर्ट' : 'Advance Alert Before Sec 3D Lapse',
              icon: <Clock size={20} color="#f47721" />,
            },
            {
              label: isHindi ? 'लागत जोखिम निवारण' : 'Cost Escalation Averted',
              val: '₹320+ Cr',
              desc: isHindi ? 'निष्क्रियता दावों की रोकथाम' : 'EPC Contractor Idling Avoidance',
              icon: <ShieldCheck size={20} color="#10b981" />,
            },
            {
              label: isHindi ? 'सक्रिय ट्रैक किए गए पैकेज' : 'Active Projects Tracked',
              val: '12 Packages',
              desc: isHindi ? '100% पोस्ट-जीआईएस लिंक्ड' : 'PostGIS Cadastral Linked',
              icon: <FileText size={20} color="#818cf8" />,
            },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              style={{
                background: isDark ? '#0c1a30' : '#ffffff',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e8eef5',
                borderRadius: 14,
                padding: '16px 20px',
                boxShadow: isDark ? '0 4px 18px rgba(0,0,0,0.3)' : '0 2px 10px rgba(0,51,102,0.04)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,51,102,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: isDark ? '#f0f6fc' : '#0a1d37', lineHeight: 1.1 }}>
                  {item.val}
                </div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: isDark ? '#8da2c0' : '#475569', marginTop: 2 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '0.68rem', color: isDark ? '#64748b' : '#94a3b8', marginTop: 1 }}>
                  {item.desc}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Main Analytics Interactive Dashboard Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          style={{
            background: isDark ? '#0b1628' : '#ffffff',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e8eef5',
            borderRadius: 20,
            boxShadow: isDark
              ? '0 20px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)'
              : '0 16px 45px rgba(0, 51, 102, 0.07), 0 2px 6px rgba(0,0,0,0.03)',
            padding: '28px 32px 30px',
            marginBottom: 28,
          }}
        >
          {/* Top Control Bar: Corridor Selector Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
              borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #eef2f6',
              paddingBottom: 18,
              marginBottom: 24,
            }}
          >
            <div>
              <div style={{ fontSize: '0.98rem', fontWeight: 800, color: isDark ? '#f0f6fc' : '#0a1d37' }}>
                {isHindi ? 'चरण-वार विलंब एवं जोखिम प्रक्षेपवक्र' : 'Stage-wise Delay Duration & Risk Trajectory'}
              </div>
              <div style={{ fontSize: '0.78rem', color: isDark ? '#8da2c0' : '#64748b', marginTop: 2 }}>
                {isHindi
                  ? 'अधिग्रहण चरणों के दौरान औसत विलंब अवधि और संभावित रुकावटें'
                  : 'Average pending days per statutory milestone based on cross-agency analysis'}
              </div>
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CORRIDOR_DATASETS.map((d) => {
                const isActive = selectedCorridor === d.id
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setSelectedCorridor(d.id)
                      setHoveredPoint(null)
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      fontSize: '0.78rem',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      border: isActive
                        ? '1px solid #f47721'
                        : isDark
                        ? '1px solid rgba(255,255,255,0.09)'
                        : '1px solid #e2e8f0',
                      background: isActive
                        ? isDark
                          ? 'rgba(244,119,33,0.18)'
                          : 'rgba(244,119,33,0.1)'
                        : isDark
                        ? 'rgba(255,255,255,0.03)'
                        : 'transparent',
                      color: isActive ? '#f47721' : isDark ? '#94a9c9' : '#475569',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    {isHindi ? d.nameHi : d.nameEn}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Grid Layout: Left Chart, Right Risk Diagnostics */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.45fr 1fr',
              gap: 28,
              alignItems: 'start',
            }}
            className="sa-dashboard-grid"
          >
            {/* ── LEFT: High Fidelity Curve Chart ── */}
            <div
              style={{
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,51,102,0.015)',
                border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #eef2f8',
                borderRadius: 14,
                padding: '20px 18px 14px',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: isDark ? '#c8daf4' : '#0a1d37', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {isHindi ? 'विलंब का रुझान (दिनों में)' : 'Timeline Bottleneck Curve'}
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: isDark ? 'rgba(244,119,33,0.15)' : '#fff3eb',
                    color: '#f47721',
                    border: '1px solid rgba(244,119,33,0.25)',
                  }}
                >
                  {activeDataset.avgDelay}
                </span>
              </div>

              {/* SVG Area & Curve */}
              <div style={{ position: 'relative', width: '100%', height: 'auto' }}>
                <svg
                  viewBox={`0 0 ${chartW} ${chartH}`}
                  style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
                >
                  <defs>
                    <linearGradient id="saGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f47721" stopOpacity={isDark ? 0.35 : 0.22} />
                      <stop offset="60%" stopColor="#003366" stopOpacity={isDark ? 0.15 : 0.08} />
                      <stop offset="100%" stopColor="#003366" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid guide lines */}
                  {[0, 25, 50, 75, 100].map((val) => {
                    const y = padTop + plotH - (val / maxDays) * plotH
                    return (
                      <g key={val}>
                        <line
                          x1={padLeft}
                          y1={y}
                          x2={chartW - padRight}
                          y2={y}
                          stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,51,102,0.07)'}
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />
                        <text
                          x={padLeft - 8}
                          y={y + 3.5}
                          textAnchor="end"
                          fontSize="9.5"
                          fontWeight="600"
                          fill={isDark ? '#64748b' : '#94a3b8'}
                        >
                          {val}d
                        </text>
                      </g>
                    )
                  })}

                  {/* Area fill */}
                  <path d={areaPath} fill="url(#saGrad)" />

                  {/* Solid smooth line */}
                  <path
                    d={curvePath}
                    fill="none"
                    stroke="#003366"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={curvePath}
                    fill="none"
                    stroke="#f47721"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="6 3"
                  />

                  {/* Interactive Points on curve */}
                  {coords.map((pt, i) => {
                    const isHovered = hoveredPoint === i
                    const isRiskHigh = pt.risk === 'HIGH'
                    return (
                      <g
                        key={pt.stageEn}
                        onMouseEnter={() => setHoveredPoint(i)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Glow halo */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 11 : isRiskHigh ? 8 : 6}
                          fill={isRiskHigh ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 51, 102, 0.15)'}
                        />
                        {/* Center core */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 5.5 : 4}
                          fill={isRiskHigh ? '#ef4444' : pt.risk === 'MEDIUM' ? '#f59e0b' : '#10b981'}
                          stroke={isDark ? '#0b1628' : '#ffffff'}
                          strokeWidth="2"
                        />

                        {/* X-axis milestone label */}
                        <text
                          x={pt.x}
                          y={padTop + plotH + 18}
                          textAnchor="middle"
                          fontSize="8.5"
                          fontWeight={isHovered ? '800' : '600'}
                          fill={isHovered ? '#f47721' : isDark ? '#94a9c9' : '#64748b'}
                        >
                          {isHindi ? pt.stageHi.split(' ')[0] : pt.stageEn.split(' ')[0]}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>

              {/* Hover Tooltip / Stage Insight Box */}
              <div
                style={{
                  marginTop: 10,
                  padding: '10px 14px',
                  background: isDark ? '#081120' : '#f0f5fc',
                  borderRadius: 8,
                  border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: 40,
                }}
              >
                {hoveredPoint !== null ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background:
                            coords[hoveredPoint].risk === 'HIGH'
                              ? '#ef4444'
                              : coords[hoveredPoint].risk === 'MEDIUM'
                              ? '#f59e0b'
                              : '#10b981',
                        }}
                      />
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: isDark ? '#f0f6fc' : '#0a1d37' }}>
                        {isHindi ? coords[hoveredPoint].stageHi : coords[hoveredPoint].stageEn}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: isDark ? '#8da2c0' : '#64748b' }}>
                        ({coords[hoveredPoint].milestone})
                      </span>
                    </div>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#f47721' }}>
                      {coords[hoveredPoint].days} {isHindi ? 'दिन विलंब' : 'days avg delay'}
                    </span>
                  </>
                ) : (
                  <div style={{ fontSize: '0.76rem', color: isDark ? '#64748b' : '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} />
                    <span>{isHindi ? 'चरण विवरण देखने के लिए किसी भी बिंदु पर होवर करें।' : 'Hover over any data point to inspect stage bottlenecks.'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT: Root Cause Diagnostics & Breakdown ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Risk Distribution Breakdown */}
              <div
                style={{
                  background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,51,102,0.015)',
                  border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #eef2f8',
                  borderRadius: 14,
                  padding: '16px 18px',
                }}
              >
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: isDark ? '#c8daf4' : '#0a1d37', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                  {isHindi ? 'सक्रिय परियोजना जोखिम वर्गीकरण' : 'Project Risk Distribution'}
                </div>

                {[
                  { label: isHindi ? 'निम्न जोखिम (समय पर)' : 'Low Risk (On Track)', pct: 58, count: '7 Pkgs', color: '#10b981' },
                  { label: isHindi ? 'मध्यम जोखिम (ध्यान दें)' : 'Medium Risk (Approvals)', pct: 25, count: '3 Pkgs', color: '#f59e0b' },
                  { label: isHindi ? 'उच्च जोखिम (कार्रवाई आवश्यक)' : 'Critical (Court Stay/Dispute)', pct: 17, count: '2 Pkgs', color: '#ef4444' },
                ].map((item) => (
                  <div key={item.label} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: isDark ? '#c0d4f0' : '#334155' }}>{item.label}</span>
                      <span style={{ fontWeight: 800, color: item.color }}>{item.count} ({item.pct}%)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 6, background: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0', overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${item.pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        style={{ height: '100%', borderRadius: 6, background: item.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Primary Delay Drivers */}
              <div
                style={{
                  background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,51,102,0.015)',
                  border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #eef2f8',
                  borderRadius: 14,
                  padding: '16px 18px',
                }}
              >
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: isDark ? '#c8daf4' : '#0a1d37', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                  {isHindi ? 'शीर्ष मूल कारण विश्लेषण' : 'Top Root Causes of Corridor Delays'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { reason: isHindi ? 'अदालती स्थगन व स्वामित्व विवाद' : 'Court Injunctions & Title Claims', share: '42%' },
                    { reason: isHindi ? 'वृक्ष/संरचना परिसंपत्ति मूल्यांकन' : 'Asset & Orchard Valuation Disputes', share: '28%' },
                    { reason: isHindi ? 'धारा 3D राजपत्र अधिसूचना अंतराल' : 'Section 3D Gazette Publishing Lag', share: '19%' },
                    { reason: isHindi ? 'वन एवं पर्यावरण एनओसी मंजूरी' : 'Forest & Wildlife NOC Clearance', share: '11%' },
                  ].map((rc) => (
                    <div
                      key={rc.reason}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.75rem',
                        color: isDark ? '#8da2c0' : '#475569',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f47721' }} />
                        <span>{rc.reason}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: isDark ? '#f0f6fc' : '#0a1d37' }}>{rc.share}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actionable AI Recommendation Card */}
              <div
                style={{
                  background: isDark ? 'rgba(244,119,33,0.08)' : '#fff8f3',
                  border: '1px solid rgba(244,119,33,0.3)',
                  borderRadius: 12,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <AlertTriangle size={18} color="#f47721" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f47721' }}>
                    {isHindi ? 'AI प्रारंभिक चेतावनी अंतर्दृष्टि' : 'Actionable Intelligence Recommendation'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: isDark ? '#cbd5e1' : '#475569', marginTop: 2, lineHeight: 1.4 }}>
                    {isHindi
                      ? 'मोहनलालगंज में 2 लंबित अदालती मामलों के शीघ्र समाधान से परियोजना के 65 दिनों के ठहराव को बचाया जा सकता है।'
                      : 'Resolving 2 title succession disputes early in Mohanlalganj prevents 65 compounding days of linear corridor idling.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── 3 Simple Core Pillars Below (Clean & Intuitive) ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}
        >
          {[
            {
              title: isHindi ? 'भविष्यवाणी जोखिम स्कोरिंग' : 'Predictive Risk Scoring',
              desc: isHindi
                ? 'परियोजना के वैधानिक या वित्तीय मील के पत्थर चूकने से पहले विलंब की संभावना का सटीक अनुमान लगाएं।'
                : 'Forecast delay probabilities months ahead using historical milestone durations and local dispute patterns.',
              icon: <Scale size={20} color="#003366" />,
            },
            {
              title: isHindi ? 'कैडस्ट्रल हीटमैप दृश्य' : 'Cadastral GIS Mapping',
              desc: isHindi
                ? 'राजस्व ग्राम खसरा मानचित्रों पर उच्च जोखिम वाले मुकदमों और अनसुलझी भूमि के समूहों को सीधे देखें।'
                : 'Identify localized litigation hotspots directly overlaid on revenue village survey numbers and corridor paths.',
              icon: <FileText size={20} color="#f47721" />,
            },
            {
              title: isHindi ? 'स्वचालित निवारक सिफारिशें' : 'Preventive Action Playbooks',
              desc: isHindi
                ? 'सीएएलए और परियोजना निदेशकों को समय पर कानूनी और वित्तीय हस्तक्षेप के लिए स्वचालित सुझाव।'
                : 'Empower CALA officers and Project Directors with automated statutory playbooks to avert idling claims.',
              icon: <CheckCircle2 size={20} color="#10b981" />,
            },
          ].map((pillar, idx) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: idx * 0.1 }}
              style={{
                background: isDark ? '#0c1a30' : '#ffffff',
                border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #eef2f8',
                borderRadius: 14,
                padding: '22px 24px',
                boxShadow: isDark ? '0 4px 18px rgba(0,0,0,0.25)' : '0 2px 10px rgba(0,51,102,0.03)',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: isDark ? 'rgba(255,255,255,0.05)' : '#eef4fb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                {pillar.icon}
              </div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: isDark ? '#f0f6fc' : '#0a1d37', margin: '0 0 6px' }}>
                {pillar.title}
              </h3>
              <p style={{ fontSize: '0.82rem', color: isDark ? '#8da2c0' : '#64748b', lineHeight: 1.55, margin: 0 }}>
                {pillar.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .sa-dashboard-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}
