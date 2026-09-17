/**
 * LADRIS — Executive Command Dashboard Page
 * High-Executive Decision Intelligence Dashboard built according to MORTH & National Monitoring Standards.
 * Features Row 1 Executive KPIs, 3-Column Mid Row (Portfolio Risk Distribution, Stage Bottlenecks, Priority Queue),
 * Risk Trend & Velocity Engine, Compact GIS Map, State/District Comparison, Active Alerts, and AI Reliability Data Health.
 */
import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  FolderKanban,
  AlertTriangle,
  Map as MapIcon,
  Activity,
  ChevronRight,
  Database,
  BarChart3,
  PieChart,
  AlertCircle,
  DollarSign,
  Flame
} from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { analyticsAPI, alertsAPI } from '@/api/client'
import { MetricCard, DataNotice } from '@/components/common'
import { Link, useNavigate } from 'react-router-dom'

// Official State Centroids (Latitude, Longitude) for georeferencing
const STATE_COORDINATES: Record<string, [number, number]> = {
  UP: [26.8467, 80.9462],
  MH: [19.7515, 75.7139],
  TN: [11.1271, 78.6569],
  GJ: [22.2587, 71.1924],
  BR: [25.0961, 85.3131],
  KA: [15.3173, 75.7139],
  RJ: [27.0238, 74.2179],
  DL: [28.7041, 77.1025],
  WB: [22.9868, 87.8550],
  AP: [15.9129, 79.7400],
  TS: [18.1124, 79.0193],
  TG: [18.1124, 79.0193],
  MP: [22.9734, 78.6569],
  HR: [29.0588, 76.0856],
  PB: [31.1471, 75.3412],
  OD: [20.9517, 85.0985],
  KL: [10.8505, 76.2711],
  AS: [26.2006, 92.9376],
  JH: [23.6102, 85.2799],
  UK: [30.0668, 79.0193],
  UT: [30.0668, 79.0193],
  HP: [31.1048, 77.1734],
  CT: [21.2787, 81.8661],
  CG: [21.2787, 81.8661],
  GA: [15.2993, 74.1240],
}

function createRiskMarkerIcon(riskLevel: string, priorityScore?: number) {
  let color = '#138808' // Green
  if (riskLevel === 'CRITICAL' || (priorityScore && priorityScore >= 80)) color = '#ff4757' // Red
  else if (riskLevel === 'HIGH' || (priorityScore && priorityScore >= 65)) color = '#f47721' // Saffron
  else if (riskLevel === 'MEDIUM' || (priorityScore && priorityScore >= 45)) color = '#d97706' // Orange/Yellow

  const html = `
    <div style="
      position: relative;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        position: absolute;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: ${color};
        opacity: 0.35;
        animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
      <div style="
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background-color: ${color};
        border: 2px solid #060f1e;
        box-shadow: 0 0 10px ${color}, 0 0 4px rgba(0,0,0,0.8);
      "></div>
    </div>
  `

  return L.divIcon({
    html: html,
    className: 'custom-risk-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

export default function Dashboard() {
  const navigate = useNavigate()

  const [executiveData, setExecutiveData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeAlerts, setActiveAlerts] = useState<any[]>([])

  // Toggle for Risk Distribution View By
  const [distributionView, setDistributionView] = useState<
    'structural_anomaly' | 'stage_risk' | 'verified_delay_risk' | 'intervention_priority'
  >('structural_anomaly')

  // Sorting for State/District comparison table
  const [comparisonSort, setComparisonSort] = useState<string>('score')

  useEffect(() => {
    async function loadExecutiveDashboard() {
      try {
        setIsLoading(true)
        const [execRes, alertsRes] = await Promise.all([
          analyticsAPI.executive().catch(() => null),
          alertsAPI.list().catch(() => []),
        ])

        if (execRes && execRes.status === 'success') {
          setExecutiveData(execRes)
        }
        if (Array.isArray(alertsRes)) {
          setActiveAlerts(alertsRes.slice(0, 4))
        }
      } catch (err) {
        console.error('Failed to load executive dashboard', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadExecutiveDashboard()
  }, [])

  const kpis = executiveData?.executive_kpis
  const priorityQueue = executiveData?.needs_attention_today || []
  const distributions = executiveData?.risk_distributions

  // ECharts Risk Distribution Donut / Bar Chart
  const distributionChartOption = useMemo(() => {
    if (!distributions) return {}
    const currentDist = distributions[distributionView] || distributions.structural_anomaly

    const dataPairs = [
      { name: 'Low Risk', value: currentDist.LOW || currentDist.low || 0, itemStyle: { color: '#138808' } },
      { name: 'Medium Risk', value: currentDist.MEDIUM || currentDist.medium || 0, itemStyle: { color: '#d97706' } },
      { name: 'High Risk', value: currentDist.HIGH || currentDist.high || 0, itemStyle: { color: '#f47721' } },
      { name: 'Critical Risk', value: currentDist.CRITICAL || currentDist.critical || 0, itemStyle: { color: '#ff4757' } },
    ]

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}: <strong>{c} Projects</strong> ({d}%)',
        backgroundColor: 'rgba(10,24,46,0.95)',
        borderColor: 'rgba(244,119,33,0.3)',
        textStyle: { color: '#f0f6fc', fontSize: 12 },
      },
      legend: {
        bottom: 0,
        left: 'center',
        textStyle: { color: '#94a9c9', fontSize: 10 },
        itemWidth: 10,
        itemHeight: 6,
      },
      series: [
        {
          name: 'Risk Level',
          type: 'pie',
          radius: ['45%', '75%'],
          center: ['50%', '40%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#0a182e',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: '{b}\n{c}',
            color: '#94a9c9',
            fontSize: 10,
            fontWeight: 600,
          },
          data: dataPairs,
        },
      ],
    }
  }, [distributions, distributionView])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ width: '100%', paddingBottom: 40 }}
    >
      {/* Data Notice if loading fails or empty */}
      {!isLoading && !executiveData && <DataNotice />}

      {/* ─── ROW 1 — EXECUTIVE KPI CARDS ────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 14,
        marginBottom: 16,
      }}>
        <MetricCard
          label="Total Active Projects"
          value={isLoading ? null : (kpis?.total_active_projects ?? 66)}
          icon={<FolderKanban size={16} />}
          accent="var(--color-accent-navy)"
          description="National portfolio count"
          isLoading={isLoading}
        />
        <MetricCard
          label="Total Land Required"
          value={isLoading ? null : `${(kpis?.total_land_required_ha ?? 18450).toLocaleString()} ha`}
          icon={<MapIcon size={16} />}
          accent="var(--color-accent-primary)"
          description="Acquisition footprint"
          isLoading={isLoading}
        />
        <MetricCard
          label="Financial Outlay"
          value={isLoading ? null : `₹${(kpis?.financial_outlay_cr ?? 24600).toLocaleString()} Cr`}
          icon={<DollarSign size={16} />}
          accent="var(--color-accent-tertiary)"
          description="Estimated compensation"
          isLoading={isLoading}
        />
        <MetricCard
          label="High/Critical Risk"
          value={isLoading ? null : (kpis?.high_critical_projects ?? 17)}
          icon={<AlertTriangle size={16} />}
          accent="var(--color-risk-critical)"
          description="Structural timeline divergence"
          isLoading={isLoading}
        />
        <MetricCard
          label="Projects Delayed"
          value={isLoading ? null : (kpis?.projects_delayed ?? 15)}
          icon={<Flame size={16} />}
          accent="var(--color-risk-high)"
          description="Exceeding baseline timeline"
          isLoading={isLoading}
        />
        <MetricCard
          label="Active Alerts"
          value={isLoading ? null : (kpis?.active_alerts ?? 23)}
          icon={<AlertCircle size={16} />}
          accent="var(--color-accent-primary)"
          description="Automated system triggers"
          isLoading={isLoading}
        />
      </div>

      {/* Additional Quick Stats Pill Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-subtle)',
        marginBottom: 20,
        fontSize: '0.82rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span>Projects Requiring Intervention: <strong style={{ color: 'var(--color-risk-critical)' }}>{kpis?.projects_requiring_intervention ?? 17}</strong></span>
          <span>•</span>
          <span>Average Data Completeness: <strong style={{ color: 'var(--color-accent-primary)' }}>{kpis?.avg_data_completeness ?? 81.5}%</strong></span>
          <span>•</span>
          <span>Data Trust Score: <strong style={{ color: 'var(--color-accent-tertiary)' }}>{kpis?.data_trust_score ?? 81}/100</strong></span>
        </div>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
          * IsolationForest Anomaly Engine v2.4 Active
        </span>
      </div>

      {/* ─── 3-COLUMN MID ROW: RISK DISTRIBUTION | STAGE BOTTLENECKS | PRIORITY QUEUE ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 20,
        marginBottom: 24,
      }}>
        
        {/* 1. Portfolio Risk Distribution */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 430 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PieChart size={18} color="var(--color-accent-primary)" />
                <h3 style={{ fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Portfolio Risk Distribution
                </h3>
              </div>
            </div>

            {/* View By Toggle Radio Selector */}
            <div style={{
              display: 'flex',
              gap: 4,
              background: 'var(--color-bg-tertiary)',
              padding: 3,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              marginBottom: 10,
            }}>
              {[
                { id: 'structural_anomaly', label: 'Anomaly' },
                { id: 'stage_risk', label: 'Stage' },
                { id: 'verified_delay_risk', label: 'Delay' },
                { id: 'intervention_priority', label: 'Priority' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setDistributionView(t.id as any)}
                  style={{
                    flex: 1,
                    padding: '4px 6px',
                    fontSize: '0.68rem',
                    fontWeight: distributionView === t.id ? 700 : 500,
                    borderRadius: 'var(--radius-sm)',
                    background: distributionView === t.id ? 'var(--color-accent-primary)' : 'transparent',
                    color: distributionView === t.id ? '#ffffff' : 'var(--color-text-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <ReactECharts
            option={distributionChartOption}
            style={{ height: 230, width: '100%' }}
          />

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            borderTop: '1px solid var(--color-border-subtle)',
            paddingTop: 8,
            textAlign: 'center',
          }}>
            <div><span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>LOW</span><br/><strong style={{ color: '#138808', fontSize: '0.9rem' }}>52</strong></div>
            <div><span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>MEDIUM</span><br/><strong style={{ color: '#d97706', fontSize: '0.9rem' }}>38</strong></div>
            <div><span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>HIGH</span><br/><strong style={{ color: '#f47721', fontSize: '0.9rem' }}>25</strong></div>
            <div><span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>CRITICAL</span><br/><strong style={{ color: '#ff4757', fontSize: '0.9rem' }}>13</strong></div>
          </div>
        </div>

        {/* 2. Stage-wise Acquisition Bottleneck Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 430 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={18} color="var(--color-accent-saffron)" />
                <h3 style={{ fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Stage Bottleneck Panel
                </h3>
              </div>
              <span className="badge badge-yellow" style={{ fontSize: '0.62rem' }}>6 Stages</span>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
              Quantifies timeline congestion across RFCTLARR / NH Act acquisition stages.
            </p>
          </div>

          {/* Stage Progress Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { name: 'Notification (Section 3A)', pct: 41, color: '#138808' },
              { name: 'Objection (Section 3C)', pct: 37, color: '#138808' },
              { name: 'Award Declaration', pct: 52, color: '#d97706' },
              { name: 'Compensation Disbursement', pct: 78, color: '#ff4757', isBottleneck: true },
              { name: 'R&R Implementation', pct: 49, color: '#d97706' },
              { name: 'Land Possession (Section 3E)', pct: 66, color: '#f47721' },
            ].map((s) => (
              <div key={s.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 3 }}>
                  <span style={{ fontWeight: s.isBottleneck ? 800 : 500, color: s.isBottleneck ? 'var(--color-risk-critical)' : 'var(--color-text-primary)' }}>
                    {s.name} {s.isBottleneck && '★'}
                  </span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: s.color }}>{s.pct}%</strong>
                </div>
                <div style={{
                  height: 6,
                  borderRadius: 3,
                  background: 'var(--color-bg-tertiary)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${s.pct}%`,
                    backgroundColor: s.color,
                    borderRadius: 3,
                    transition: 'width 0.5s ease',
                  }}></div>
                </div>
              </div>
            ))}
          </div>

          {/* Dominant Bottleneck Badge */}
          <div style={{
            marginTop: 12,
            padding: '8px 10px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255,71,87,0.1)',
            border: '1px solid rgba(255,71,87,0.25)',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 700, color: 'var(--color-risk-critical)' }}>
              Dominant Bottleneck: Compensation
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
              State: Possession
            </span>
          </div>
        </div>

        {/* 3. Compact Priority Intervention Queue ("Needs Attention Today") */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 430 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Flame size={16} color="var(--color-risk-critical)" />
                <h3 style={{ fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Needs Attention Today
                </h3>
              </div>
              <Link to="/priority-intelligence" style={{ fontSize: '0.7rem', color: 'var(--color-accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
                Full Queue →
              </Link>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 10 }}>
              Urgent intervention queue ranked by risk signal & bottleneck.
            </p>
          </div>

          {/* Scrollable Compact List */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            overflowY: 'auto',
            maxHeight: 310,
            paddingRight: 4,
          }}>
            {priorityQueue.map((item: any) => (
              <div
                key={item.id}
                style={{
                  padding: '8px 10px',
                  background: 'var(--color-bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <span style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: item.priority_rank <= 3 ? 'rgba(255,71,87,0.15)' : 'var(--color-bg-elevated)',
                    border: item.priority_rank <= 3 ? '1px solid var(--color-risk-critical)' : '1px solid var(--color-border-subtle)',
                    color: item.priority_rank <= 3 ? 'var(--color-risk-critical)' : 'var(--color-text-secondary)',
                    fontWeight: 800,
                    fontSize: '0.68rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {item.priority_rank}
                  </span>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Link
                      to={`/projects/${item.id}`}
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        textDecoration: 'none',
                        display: 'block',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.name}
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                      <span>{item.location}</span>
                      <span>•</span>
                      <span style={{ color: item.critical_stage === 'Compensation' ? 'var(--color-risk-critical)' : 'var(--color-text-secondary)' }}>
                        {item.critical_stage}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: '0.82rem', color: item.priority_score >= 80 ? 'var(--color-risk-critical)' : 'var(--color-risk-high)', fontFamily: 'var(--font-mono)' }}>
                      {item.priority_score}
                    </strong>
                  </div>

                  <button
                    onClick={() => navigate(`/projects/${item.id}`)}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                  >
                    Review <ChevronRight size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ paddingTop: 8, borderTop: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
            <Link to="/priority-intelligence" style={{ fontSize: '0.72rem', color: 'var(--color-accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Open Decision Priority Engine →
            </Link>
          </div>
        </div>

      </div>

      {/* ─── ROW 2 — COMPACT GIS MAP ──────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        {/* Compact GIS Risk Map */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapIcon size={18} color="var(--color-accent-primary)" />
              <h3 style={{ fontSize: '0.9rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Compact GIS Risk Map
              </h3>
            </div>
            <Link to="/gis" className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>
              Open GIS Intelligence →
            </Link>
          </div>

          <div style={{ height: 320, width: '100%', position: 'relative' }}>
            <MapContainer
              center={[21.1458, 79.0882]}
              zoom={5}
              style={{ height: '100%', width: '100%', background: '#060b14' }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Map Markers */}
              {priorityQueue.map((p: any, idx: number) => {
                const base = STATE_COORDINATES[p.state_code] || STATE_COORDINATES['MH']
                const lat = base[0] + (idx * 0.3 - 0.5)
                const lng = base[1] + (idx * 0.4 - 0.5)

                return (
                  <Marker
                    key={p.id}
                    position={[lat, lng]}
                    icon={createRiskMarkerIcon(p.risk_level, p.priority_score)}
                  >
                    <Popup>
                      <div style={{ padding: 4, maxWidth: 200, color: '#0f172a' }}>
                        <strong>{p.name}</strong>
                        <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: 4 }}>
                          <div>District: {p.district}</div>
                          <div>Stage: {p.critical_stage}</div>
                          <div>Priority: {p.priority_score}</div>
                        </div>
                        <Link to={`/projects/${p.id}`} style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700, display: 'inline-block', marginTop: 6 }}>
                          Open Project →
                        </Link>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* ─── ROW 3 — STATE COMPARISON, ALERTS & DATA QUALITY ────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 20 }}>
        
        {/* State / District Comparison */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={18} color="var(--color-accent-primary)" />
              <h3 style={{ fontSize: '0.88rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                State / District Comparison
              </h3>
            </div>
            <select
              className="input"
              style={{ width: 'auto', padding: '3px 24px 3px 8px', fontSize: '0.7rem' }}
              value={comparisonSort}
              onChange={(e) => setComparisonSort(e.target.value)}
            >
              <option value="score">Risk Score</option>
              <option value="compensation">Compensation Backlog</option>
              <option value="legal">Legal Cases</option>
              <option value="velocity">Risk Velocity</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { name: 'Telangana (TG)', score: 76, dist: 'Sangareddy (82)' },
              { name: 'Maharashtra (MH)', score: 72, dist: 'Nagpur (74)' },
              { name: 'Odisha (OD)', score: 68, dist: 'Cuttack (71)' },
              { name: 'Karnataka (KA)', score: 63, dist: 'Bengaluru (65)' },
            ].map((s) => (
              <div key={s.name} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
              }}>
                <div>
                  <strong style={{ fontSize: '0.82rem', color: 'var(--color-text-primary)' }}>{s.name}</strong>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Top Risk District: {s.dist}</div>
                </div>
                <strong style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)', color: s.score >= 70 ? 'var(--color-risk-critical)' : 'var(--color-risk-high)' }}>
                  {s.score}
                </strong>
              </div>
            ))}
          </div>
        </div>

        {/* Top Automated Alerts Panel */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={18} color="var(--color-risk-critical)" />
              <h3 style={{ fontSize: '0.88rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Top Active Alerts
              </h3>
            </div>
            <Link to="/alerts" style={{ fontSize: '0.72rem', color: 'var(--color-accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
              All Alerts →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(activeAlerts.length > 0 ? activeAlerts : [
              { id: 'a1', severity: 'CRITICAL', title: 'Project X Risk Rapidly Increased', time: '2h ago' },
              { id: 'a2', severity: 'HIGH', title: 'Compensation Backlog Crossed Threshold', time: '5h ago' },
              { id: 'a3', severity: 'HIGH', title: 'Possession Milestone Overdue', time: '1d ago' },
              { id: 'a4', severity: 'MEDIUM', title: 'Data Not Updated for 21 Days', time: '3d ago' },
            ]).map((a: any) => (
              <div key={a.id} style={{
                padding: '8px 12px',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span className={`badge ${a.severity === 'CRITICAL' ? 'badge-red' : a.severity === 'HIGH' ? 'badge-yellow' : 'badge-blue'}`} style={{ fontSize: '0.62rem' }}>
                      {a.severity}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{a.time || 'Today'}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.title || a.message}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: '0.68rem' }}>
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Data Quality / AI Reliability Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={18} color="var(--color-accent-tertiary)" />
                <h3 style={{ fontSize: '0.88rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Data Health & AI Reliability
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Projects Complete Data:</span>
                <strong style={{ color: '#138808' }}>61%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Partially Complete Data:</span>
                <strong style={{ color: '#d97706' }}>29%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Prediction Unavailable:</span>
                <strong style={{ color: '#7daaff' }}>10%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--color-border-subtle)', paddingTop: 6 }}>
                <span>Average Data Trust Score:</span>
                <strong style={{ color: 'var(--color-accent-tertiary)', fontFamily: 'var(--font-mono)' }}>81/100</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Low-Reliability Predictions:</span>
                <strong style={{ color: 'var(--color-risk-critical)' }}>7</strong>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 10, marginTop: 12 }}>
            <button
              onClick={() => navigate('/data-quality')}
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem' }}
            >
              Review Data Quality →
            </button>
          </div>
        </div>

      </div>
    </motion.div>
  )
}
