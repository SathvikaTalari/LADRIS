/**
 * LADRIS — Executive Command Dashboard Page
 * High-Executive Decision Intelligence Dashboard built according to MORTH & National Monitoring Standards.
 * Features Row 1 Executive KPIs, 3-Column Mid Row (Portfolio Risk Distribution, Stage Bottlenecks, Priority Queue),
 * Risk Trend & Velocity Engine, Compact GIS Map, State/District Comparison, Active Alerts, and AI Reliability Data Health.
 */
import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  PieChart,
} from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { analyticsAPI, alertsAPI } from '@/api/client'
import { MetricCard, DataNotice } from '@/components/common'
import { Link, useNavigate } from 'react-router-dom'

function createRiskMarkerIcon(riskLevel: string) {
  let color = '#138808' // Green
  if (riskLevel === 'CRITICAL') color = '#ff4757'
  else if (riskLevel === 'HIGH') color = '#f47721'
  else if (riskLevel === 'MEDIUM') color = '#d97706'

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
  const distributionView = 'verified_delay_risk'

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
  const geoQueue = priorityQueue.filter((project: any) =>
    Number.isFinite(project.latitude) && Number.isFinite(project.longitude)
  )
  const topStates = executiveData?.state_district_comparison?.top_states || []
  const topDistricts = executiveData?.state_district_comparison?.top_districts || []
  const dataHealth = executiveData?.data_health
  const reliability = executiveData?.ai_reliability_distinction?.prediction_status

  // ECharts Risk Distribution Donut / Bar Chart
  const distributionChartOption = useMemo(() => {
    if (!distributions) return {}
    const currentDist = distributions[distributionView] || {}

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
          value={isLoading ? null : (kpis?.total_active_projects ?? 0)}
          accent="var(--color-accent-navy)"
          description="Total projects"
          isLoading={isLoading}
        />
        <MetricCard
          label="Total Land Required"
          value={isLoading ? null : `${(kpis?.total_land_required_ha ?? 0).toLocaleString()} ha`}
          accent="var(--color-accent-primary)"
          description="Land needed"
          isLoading={isLoading}
        />
        <MetricCard
          label="Financial Outlay"
          value={isLoading ? null : `₹${(kpis?.financial_outlay_cr ?? 0).toLocaleString()} Cr`}
          accent="var(--color-accent-tertiary)"
          description="Expected compensation"
          isLoading={isLoading}
        />
        <MetricCard
          label="High/Critical Risk"
          value={isLoading ? null : (kpis?.high_critical_projects ?? 0)}
          accent="var(--color-risk-critical)"
          description="Projects needing urgent intervention"
          isLoading={isLoading}
        />
        <MetricCard
          label="Projects Delayed"
          value={isLoading ? null : (kpis?.projects_delayed ?? 0)}
          accent="var(--color-risk-high)"
          description="Already behind original deadline"
          isLoading={isLoading}
        />
        <MetricCard
          label="Active Alerts"
          value={isLoading ? null : (kpis?.active_alerts ?? 0)}
          accent="var(--color-accent-primary)"
          description="Urgent early warnings"
          isLoading={isLoading}
        />
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
                  Project Delay Risk Breakdown
                </h3>
              </div>
            </div>

            {/* Simple Subtitle / Indicator */}
            <div style={{
              fontSize: '0.74rem',
              color: 'var(--color-text-muted)',
              fontWeight: 600,
              letterSpacing: '0.02em',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'var(--color-accent-primary)',
              }}></span>
              All Projects Delay Risk
            </div>
          </div>

          <ReactECharts
            option={distributionChartOption}
            style={{ height: 230, width: '100%' }}
          />

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 4,
            borderTop: '1px solid var(--color-border-subtle)',
            paddingTop: 8,
            textAlign: 'center',
          }}>
            <div><span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>LOW</span><br /><strong style={{ color: '#138808', fontSize: '0.88rem' }}>{distributions?.verified_delay_risk?.LOW ?? 0}</strong></div>
            <div><span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>MEDIUM</span><br /><strong style={{ color: '#d97706', fontSize: '0.88rem' }}>{distributions?.verified_delay_risk?.MEDIUM ?? 0}</strong></div>
            <div><span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>HIGH</span><br /><strong style={{ color: '#f47721', fontSize: '0.88rem' }}>{distributions?.verified_delay_risk?.HIGH ?? 0}</strong></div>
            <div><span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>CRITICAL</span><br /><strong style={{ color: '#ff4757', fontSize: '0.88rem' }}>{distributions?.verified_delay_risk?.CRITICAL ?? 0}</strong></div>
            <div><span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>UNAVAILABLE</span><br /><strong style={{ color: '#7daaff', fontSize: '0.88rem' }}>{Math.max(0, (kpis?.total_active_projects ?? 0) - ((distributions?.verified_delay_risk?.LOW ?? 0) + (distributions?.verified_delay_risk?.MEDIUM ?? 0) + (distributions?.verified_delay_risk?.HIGH ?? 0) + (distributions?.verified_delay_risk?.CRITICAL ?? 0)))}</strong></div>
          </div>
        </div>

        {/* 2. Stage-wise Acquisition Bottleneck Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 430 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <h3 style={{ fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Most Delayed Stage
                </h3>
              </div>
              <span className="badge badge-yellow" style={{ fontSize: '0.62rem' }}>6 Acquisition Stages</span>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
              Shows which stages of land acquisition face the highest risk of slowdown across projects.
            </p>
          </div>

          {/* Stage Progress Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { name: 'Notification (Section 3A)', pct: 41, color: '#138808' },
              { name: 'Objections Hearing (Section 3C)', pct: 37, color: '#138808' },
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
              Biggest Delay Factor: Compensation Disbursement
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
              Next Stage: Possession
            </span>
          </div>
        </div>

        {/* 3. Compact Priority Intervention Queue ("Needs Attention Today") */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 430 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <h3 style={{ fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Priority Projects
                </h3>
              </div>
              <Link to="/priority-intelligence" style={{ fontSize: '0.7rem', color: 'var(--color-accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
                Full Watchlist →
              </Link>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 10 }}>
              Urgent projects ranked by likelihood of delay and key bottleneck.
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
              Open Priority Watchlist →
            </Link>
          </div>
        </div>

      </div>

      {/* ─── ROW 2 — COMPACT GIS MAP ──────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        {/* Compact GIS Risk Map */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg-card)' }}>
            <div>
              <h3 style={{ fontSize: '0.9rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                National Project Map
              </h3>
            </div>
            <Link to="/gis" className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>
              Open Interactive Map →
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
              {geoQueue.map((p: any) => (
                <Marker
                  key={p.id}
                  position={[p.latitude, p.longitude]}
                  icon={createRiskMarkerIcon(p.risk_level)}
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
              ))}
            </MapContainer>
            {geoQueue.length === 0 && (
              <div style={{ position: 'absolute', zIndex: 500, inset: 'auto 16px 16px 16px', padding: 10, borderRadius: 6, background: 'rgba(6,15,30,.9)', color: 'var(--color-text-muted)', fontSize: '0.76rem' }}>
                Project markers are unavailable because the source records do not contain exact latitude/longitude.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── ROW 3 — STATE COMPARISON, ALERTS & DATA QUALITY ────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 20 }}>

        {/* State / District Comparison */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: '0.88rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                States with Highest Delay Risk
              </h3>
            </div>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.68rem' }}>Ranked by average risk score</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topStates.slice(0, 4).map((state: any) => {
              const district = topDistricts.find((item: any) => item.state === state.code)
              return <div key={state.code} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
              }}>
                <div>
                  <strong style={{ fontSize: '0.82rem', color: 'var(--color-text-primary)' }}>{state.state} ({state.code})</strong>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Highest Risk District: {district ? `${district.district} (${district.score}/100)` : 'Unavailable'}</div>
                </div>
                <strong style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)', color: state.score >= 70 ? 'var(--color-risk-critical)' : 'var(--color-risk-high)' }}>
                  {state.score}
                </strong>
              </div>
            })}
            {topStates.length === 0 && <div style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>No state predictions available.</div>}
          </div>
        </div>

        {/* Top Automated Alerts Panel */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: '0.88rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Top Active Alerts
              </h3>
            </div>
            <Link to="/alerts" style={{ fontSize: '0.72rem', color: 'var(--color-accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
              All Alerts →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeAlerts.map((a: any) => (
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
            {activeAlerts.length === 0 && <div style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>No active alerts returned by the API.</div>}
          </div>
        </div>

        {/* Data Quality / AI Reliability Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: '0.88rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Data Health & Completeness
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Projects with Full Predictions:</span>
                <strong style={{ color: '#138808' }}>{dataHealth?.prediction_available ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Projects Awaiting Assessment:</span>
                <strong style={{ color: '#d97706' }}>{dataHealth?.prediction_unavailable ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Monitored Projects:</span>
                <strong style={{ color: '#7daaff' }}>{dataHealth?.total_projects ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--color-border-subtle)', paddingTop: 6 }}>
                <span>Average Data Completeness:</span>
                <strong style={{ color: 'var(--color-accent-tertiary)', fontFamily: 'var(--font-mono)' }}>{dataHealth?.average_trust_score ?? 0}/100</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Incomplete Data Warnings:</span>
                <strong style={{ color: 'var(--color-risk-critical)' }}>{reliability?.low_reliability ?? 0}</strong>
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
