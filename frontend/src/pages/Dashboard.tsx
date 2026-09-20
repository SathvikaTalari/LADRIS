/**
 * LADRIS - Executive Command Dashboard Page
 * Government Portal Visual Language — structured, information-first, compact.
 * All data and functionality preserved. Only visual presentation changed.
 */
import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { analyticsAPI, alertsAPI } from '@/api/client'
import { DataNotice } from '@/components/common'
import { Link, useNavigate } from 'react-router-dom'

function createRiskMarkerIcon(riskLevel: string) {
  let color = '#138808'
  if (riskLevel === 'CRITICAL') color = '#ff4757'
  else if (riskLevel === 'HIGH') color = '#f47721'
  else if (riskLevel === 'MEDIUM') color = '#d97706'

  const html = `
    <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:24px;height:24px;border-radius:50%;background-color:${color};opacity:0.35;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="width:14px;height:14px;border-radius:50%;background-color:${color};border:2px solid #060f1e;box-shadow:0 0 10px ${color};"></div>
    </div>
  `
  return L.divIcon({ html, className: 'custom-risk-marker', iconSize: [24, 24], iconAnchor: [12, 12] })
}

function getAlertRowClass(severity: string) {
  if (severity === 'CRITICAL') return 'db-alert-row db-alert-row--critical'
  if (severity === 'HIGH') return 'db-alert-row db-alert-row--high'
  if (severity === 'MEDIUM') return 'db-alert-row db-alert-row--medium'
  return 'db-alert-row db-alert-row--low'
}

function getAlertSeverityClass(severity: string) {
  if (severity === 'CRITICAL') return 'db-alert-severity db-alert-severity--critical'
  if (severity === 'HIGH') return 'db-alert-severity db-alert-severity--high'
  return 'db-alert-severity db-alert-severity--medium'
}

export default function Dashboard() {
  const navigate = useNavigate()

  const [executiveData, setExecutiveData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeAlerts, setActiveAlerts] = useState<any[]>([])

  const distributionView = 'verified_delay_risk'

  useEffect(() => {
    async function loadExecutiveDashboard() {
      try {
        setIsLoading(true)
        const [execRes, alertsRes] = await Promise.all([
          analyticsAPI.executive().catch(() => null),
          alertsAPI.list().catch(() => []),
        ])
        if (execRes && execRes.status === 'success') setExecutiveData(execRes)
        if (Array.isArray(alertsRes)) setActiveAlerts(alertsRes.slice(0, 4))
      } catch (err) {
        console.error('Failed to load executive dashboard', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadExecutiveDashboard()
  }, [])

  const handleUpdateAlertStatus = async (alertId: string, status: 'ACKNOWLEDGED' | 'RESOLVED') => {
    try {
      await alertsAPI.update(alertId, { status })
      const res = await alertsAPI.list().catch(() => [])
      if (Array.isArray(res)) setActiveAlerts(res.slice(0, 4))
    } catch (e) {
      console.error('Failed to update alert:', e)
    }
  }

  const kpis = executiveData?.executive_kpis
  const priorityQueue = executiveData?.needs_attention_today || []
  const distributions = executiveData?.risk_distributions
  const geoQueue = priorityQueue.filter((p: any) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
  const topStates = executiveData?.state_district_comparison?.top_states || []
  const topDistricts = executiveData?.state_district_comparison?.top_districts || []
  const dataHealth = executiveData?.data_health
  const reliability = executiveData?.ai_reliability_distinction?.prediction_status

  const distributionChartOption = useMemo(() => {
    if (!distributions) return {}
    const currentDist = distributions[distributionView] || {}
    const dataPairs = [
      { name: 'Low Risk',      value: currentDist.LOW      || currentDist.low      || 0, itemStyle: { color: '#138808' } },
      { name: 'Medium Risk',   value: currentDist.MEDIUM   || currentDist.medium   || 0, itemStyle: { color: '#d97706' } },
      { name: 'High Risk',     value: currentDist.HIGH     || currentDist.high     || 0, itemStyle: { color: '#f47721' } },
      { name: 'Critical Risk', value: currentDist.CRITICAL || currentDist.critical || 0, itemStyle: { color: '#ff4757' } },
    ]
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}: <strong>{c} Projects</strong> ({d}%)',
        backgroundColor: 'rgba(10,24,46,0.95)',
        borderColor: 'rgba(100,116,139,0.3)',
        textStyle: { color: '#f0f6fc', fontSize: 12 },
      },
      legend: {
        bottom: 0,
        left: 'center',
        textStyle: { color: 'var(--color-text-muted)', fontSize: 10 },
        itemWidth: 10,
        itemHeight: 6,
      },
      series: [{
        name: 'Risk Level',
        type: 'pie',
        radius: ['40%', '68%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 2, borderColor: 'transparent', borderWidth: 1 },
        label: {
          show: true,
          formatter: '{c}',
          color: 'var(--color-text-muted)',
          fontSize: 11,
          fontWeight: 700,
          fontFamily: 'JetBrains Mono, monospace',
        },
        emphasis: { label: { show: true, fontSize: 13 } },
        data: dataPairs,
      }],
    }
  }, [distributions, distributionView])

  const stages = [
    { name: 'Notification (Section 3A)',       pct: 41, color: '#138808', isBottleneck: false },
    { name: 'Objections Hearing (Section 3C)', pct: 37, color: '#138808', isBottleneck: false },
    { name: 'Award Declaration',               pct: 52, color: '#d97706', isBottleneck: false },
    { name: 'Compensation Disbursement',       pct: 78, color: '#ff4757', isBottleneck: true  },
    { name: 'R&R Implementation',              pct: 49, color: '#d97706', isBottleneck: false },
    { name: 'Land Possession (Section 3E)',    pct: 66, color: '#f47721', isBottleneck: false },
  ]

  const distLOW      = distributions?.verified_delay_risk?.LOW      ?? 0
  const distMEDIUM   = distributions?.verified_delay_risk?.MEDIUM   ?? 0
  const distHIGH     = distributions?.verified_delay_risk?.HIGH     ?? 0
  const distCRITICAL = distributions?.verified_delay_risk?.CRITICAL ?? 0
  const distUNAVAIL  = Math.max(0, (kpis?.total_active_projects ?? 0) - (distLOW + distMEDIUM + distHIGH + distCRITICAL))

  const skeleton = (h: number) => (
    <div className="skeleton" style={{ height: h, width: '100%', borderRadius: 3 }} />
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      style={{ width: '100%', paddingBottom: 40 }}
    >
      {!isLoading && !executiveData && <DataNotice />}

      {/* PAGE HEADER */}
      <div className="db-page-header">
        <h1>Dashboard</h1>
        <p>Land Acquisition Delay Risk Intelligence System &mdash; Executive Overview</p>
      </div>

      {/* SECTION 1: OVERVIEW — KPI STRIP */}
      <div className="db-section-block">
        <span className="db-section-label">Overview</span>
        <div className="db-kpi-grid">
          <div className="db-kpi-card">
            <span className="db-kpi-label">Active Projects</span>
            {isLoading ? skeleton(28) : <span className="db-kpi-value">{kpis?.total_active_projects ?? 0}</span>}
            <span className="db-kpi-desc">All monitored projects</span>
          </div>

          <div className="db-kpi-card">
            <span className="db-kpi-label">Land Required</span>
            {isLoading ? skeleton(28) : (
              <span className="db-kpi-value">
                {(kpis?.total_land_required_ha ?? 0).toLocaleString()}
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', marginLeft: 3 }}>ha</span>
              </span>
            )}
            <span className="db-kpi-desc">Total area needed</span>
          </div>

          <div className="db-kpi-card">
            <span className="db-kpi-label">Financial Outlay</span>
            {isLoading ? skeleton(28) : (
              <span className="db-kpi-value">
                {'₹'}{(kpis?.financial_outlay_cr ?? 0).toLocaleString()}
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', marginLeft: 3 }}>Cr</span>
              </span>
            )}
            <span className="db-kpi-desc">Expected compensation</span>
          </div>

          <div className="db-kpi-card">
            <span className="db-kpi-label">High / Critical Risk</span>
            {isLoading ? skeleton(28) : <span className="db-kpi-value db-kpi-value--risk-critical">{kpis?.high_critical_projects ?? 0}</span>}
            <span className="db-kpi-desc">Needs urgent intervention</span>
          </div>

          <div className="db-kpi-card">
            <span className="db-kpi-label">Projects Delayed</span>
            {isLoading ? skeleton(28) : <span className="db-kpi-value db-kpi-value--risk-high">{kpis?.projects_delayed ?? 0}</span>}
            <span className="db-kpi-desc">Behind original deadline</span>
          </div>

          <div className="db-kpi-card">
            <span className="db-kpi-label">Active Alerts</span>
            {isLoading ? skeleton(28) : <span className="db-kpi-value db-kpi-value--alert">{kpis?.active_alerts ?? 0}</span>}
            <span className="db-kpi-desc">Early-warning flags</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: RISK & DELAY ANALYSIS */}
      <div className="db-section-block">
        <span className="db-section-label">Risk &amp; Delay Analysis</span>
        <div className="db-mid-grid">

          {/* Risk Distribution Chart */}
          <div className="card">
            <div className="db-card-header">
              <h3 className="db-section-title">Project Delay Risk Breakdown</h3>
              <span style={{ fontSize: '0.67rem', color: 'var(--color-text-muted)' }}>All projects</span>
            </div>
            <div className="db-chart-wrap">
              <ReactECharts option={distributionChartOption} style={{ height: 220, width: '100%' }} />
            </div>
            {/* Risk summary row */}
            <div className="db-risk-summary">
              <div className="db-risk-summary-cell">
                <span className="db-risk-summary-label">Low</span>
                <span className="db-risk-summary-value" style={{ color: '#138808' }}>{distLOW}</span>
              </div>
              <div className="db-risk-summary-cell">
                <span className="db-risk-summary-label">Medium</span>
                <span className="db-risk-summary-value" style={{ color: '#d97706' }}>{distMEDIUM}</span>
              </div>
              <div className="db-risk-summary-cell">
                <span className="db-risk-summary-label">High</span>
                <span className="db-risk-summary-value" style={{ color: '#f47721' }}>{distHIGH}</span>
              </div>
              <div className="db-risk-summary-cell">
                <span className="db-risk-summary-label">Critical</span>
                <span className="db-risk-summary-value" style={{ color: '#ff4757' }}>{distCRITICAL}</span>
              </div>
              <div className="db-risk-summary-cell">
                <span className="db-risk-summary-label">No Data</span>
                <span className="db-risk-summary-value" style={{ color: 'var(--color-text-muted)' }}>{distUNAVAIL}</span>
              </div>
            </div>
          </div>

          {/* Stage Bottlenecks */}
          <div className="card">
            <div className="db-card-header">
              <h3 className="db-section-title">Most Delayed Stage</h3>
              <span style={{ fontSize: '0.67rem', color: 'var(--color-text-muted)' }}>6 acquisition stages</span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 12, lineHeight: 1.45 }}>
              Stages with highest risk of slowdown across active projects.
            </p>
            <div className="db-stage-row">
              {stages.map((s) => (
                <div key={s.name}>
                  <div className="db-stage-item">
                    <span className={s.isBottleneck ? 'db-stage-name db-stage-name--critical' : 'db-stage-name'}>
                      {s.name}{s.isBottleneck ? ' ★' : ''}
                    </span>
                    <span className="db-stage-pct" style={{ color: s.color }}>{s.pct}%</span>
                  </div>
                  <div className="db-progress-track">
                    <div className="db-progress-fill" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="db-bottleneck-note" style={{ marginTop: 14 }}>
              <span className="db-bottleneck-label">Biggest Delay: Compensation Disbursement</span>
              <span className="db-bottleneck-next">Next: Land Possession</span>
            </div>
          </div>

          {/* Priority Projects — compact table */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="db-card-header">
              <h3 className="db-section-title">Priority Projects</h3>
              <Link to="/priority-intelligence" className="db-link-muted">Full Watchlist</Link>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 10, lineHeight: 1.4 }}>
              Ranked by likelihood of delay and critical bottleneck.
            </p>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {priorityQueue.length === 0 ? (
                <div style={{ padding: '12px 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  No priority projects returned by the API.
                </div>
              ) : (
                <table className="db-projects-table">
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}>#</th>
                      <th>Project</th>
                      <th>Location</th>
                      <th style={{ width: 42, textAlign: 'right' }}>Score</th>
                      <th style={{ width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {priorityQueue.map((item: any) => (
                      <tr key={item.id}>
                        <td>
                          <span className={item.priority_rank <= 3 ? 'db-project-rank db-project-rank--top' : 'db-project-rank'}>
                            {item.priority_rank}
                          </span>
                        </td>
                        <td>
                          <Link to={`/projects/${item.id}`} className="db-project-name" style={{ maxWidth: 160 }}>
                            {item.name}
                          </Link>
                          {item.critical_stage && (
                            <div className="db-project-meta">
                              <span style={{ color: item.critical_stage === 'Compensation' ? 'var(--color-risk-critical)' : 'inherit' }}>
                                {item.critical_stage}
                              </span>
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                          {item.location}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={item.priority_score >= 80 ? 'db-project-score db-project-score--critical' : 'db-project-score db-project-score--high'}>
                            {item.priority_score}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => navigate(`/projects/${item.id}`)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 5px', fontSize: '0.65rem' }}
                            title="Review project"
                          >
                            <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ paddingTop: 10, borderTop: '1px solid var(--color-border-subtle)', textAlign: 'center', marginTop: 10 }}>
              <Link to="/priority-intelligence" className="db-link-muted">Open Priority Watchlist &rarr;</Link>
            </div>
          </div>

        </div>
      </div>

      {/* SECTION 3: NATIONAL PROJECT MAP */}
      <div className="db-section-block db-map-wrapper" style={{ marginBottom: 22 }}>
        <span className="db-section-label">National Project Map</span>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Project Locations — Risk Heat Map
            </span>
            <Link to="/gis" className="btn btn-secondary btn-sm" style={{ padding: '3px 10px', fontSize: '0.72rem' }}>
              Open Interactive Map &rarr;
            </Link>
          </div>
          <div style={{ height: 280, width: '100%', position: 'relative' }}>
            <MapContainer
              center={[21.1458, 79.0882]}
              zoom={5}
              style={{ height: '100%', width: '100%', background: '#060b14' }}
            >
              <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {geoQueue.map((p: any) => (
                <Marker key={p.id} position={[p.latitude, p.longitude]} icon={createRiskMarkerIcon(p.risk_level)}>
                  <Popup>
                    <div style={{ padding: 4, maxWidth: 200, color: '#0f172a' }}>
                      <strong>{p.name}</strong>
                      <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: 4 }}>
                        <div>District: {p.district}</div>
                        <div>Stage: {p.critical_stage}</div>
                        <div>Priority Score: {p.priority_score}</div>
                      </div>
                      <Link to={`/projects/${p.id}`} style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700, display: 'inline-block', marginTop: 6 }}>
                        Open Project &rarr;
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
            {geoQueue.length === 0 && (
              <div style={{ position: 'absolute', zIndex: 500, inset: 'auto 16px 16px 16px', padding: '8px 12px', borderRadius: 4, background: 'rgba(6,15,30,.9)', color: 'var(--color-text-muted)', fontSize: '0.74rem' }}>
                Project markers unavailable — source records lack exact coordinates.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: STATE RISK, ALERTS & DATA HEALTH */}
      <div className="db-section-block">
        <span className="db-section-label">Status &amp; Alerts</span>
        <div className="db-bottom-grid">

          {/* States with Highest Delay Risk */}
          <div className="card">
            <div className="db-card-header">
              <h3 className="db-section-title">States with Highest Delay Risk</h3>
              <span style={{ fontSize: '0.67rem', color: 'var(--color-text-muted)' }}>Avg risk score</span>
            </div>
            <div className="db-state-list">
              {topStates.slice(0, 4).map((state: any) => {
                const district = topDistricts.find((d: any) => d.state === state.code)
                return (
                  <div key={state.code} className="db-state-row">
                    <div>
                      <div className="db-state-name">{state.state} ({state.code})</div>
                      <div className="db-state-meta">
                        Highest risk district: {district ? `${district.district} (${district.score}/100)` : 'Unavailable'}
                      </div>
                    </div>
                    <span className={state.score >= 70 ? 'db-state-score db-state-score--critical' : 'db-state-score db-state-score--high'}>
                      {state.score}
                    </span>
                  </div>
                )
              })}
              {topStates.length === 0 && (
                <div style={{ padding: '12px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>No state predictions available.</div>
              )}
            </div>
          </div>

          {/* Top Active Alerts */}
          <div className="card">
            <div className="db-card-header">
              <h3 className="db-section-title">Top Active Alerts</h3>
              <Link to="/alerts" className="db-link-muted">All Alerts &rarr;</Link>
            </div>
            <div className="db-alert-list">
              {activeAlerts.map((a: any) => {
                const projectName = a.project_name || a.alert_metadata?.project_name || 'Project'
                const reason = a.alert_reason || (a.title && !a.title.startsWith('ML') ? a.title : 'High Delay Risk')
                const explanation = a.explanation || a.message || ''
                const sev = (a.severity || '').toUpperCase()
                return (
                  <div key={a.id} className={getAlertRowClass(sev)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ marginBottom: 2 }}>
                        <span className={getAlertSeverityClass(sev)}>{sev}</span>
                      </div>
                      <div className="db-alert-title">{projectName}</div>
                      <div className="db-alert-reason">{reason}</div>
                      {explanation && (
                        <div style={{ fontSize: '0.71rem', color: 'var(--color-text-secondary)', lineHeight: 1.4, marginBottom: 2 }}>
                          {explanation}
                        </div>
                      )}
                      <div className="db-alert-time">
                        {a.triggered_at
                          ? new Date(a.triggered_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : 'Recent'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                      {a.project_id && (
                        <Link to={`/projects/${a.project_id}`} className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: '0.68rem' }}>
                          View
                        </Link>
                      )}
                      {a.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleUpdateAlertStatus(a.id, 'ACKNOWLEDGED')}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '2px 8px', fontSize: '0.68rem' }}
                        >
                          Acknowledge
                        </button>
                      )}
                      {a.status !== 'RESOLVED' && (
                        <button
                          onClick={() => handleUpdateAlertStatus(a.id, 'RESOLVED')}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '2px 8px', fontSize: '0.68rem', color: 'var(--color-success)' }}
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {activeAlerts.length === 0 && (
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>No active alerts returned by the API.</div>
              )}
            </div>
          </div>

          {/* Data Health Summary */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="db-card-header">
              <h3 className="db-section-title">Data Health &amp; Completeness</h3>
            </div>
            <div style={{ flex: 1 }}>
              <div className="db-health-row">
                <span className="db-health-label">Projects with Full Predictions</span>
                <span className="db-health-value" style={{ color: '#138808' }}>{dataHealth?.prediction_available ?? 0}</span>
              </div>
              <div className="db-health-row">
                <span className="db-health-label">Awaiting Assessment</span>
                <span className="db-health-value" style={{ color: '#d97706' }}>{dataHealth?.prediction_unavailable ?? 0}</span>
              </div>
              <div className="db-health-row">
                <span className="db-health-label">Total Monitored Projects</span>
                <span className="db-health-value">{dataHealth?.total_projects ?? 0}</span>
              </div>
              <div className="db-health-row">
                <span className="db-health-label">Avg. Data Completeness</span>
                <span className="db-health-value">{dataHealth?.average_trust_score ?? 0}/100</span>
              </div>
              <div className="db-health-row">
                <span className="db-health-label">Incomplete Data Warnings</span>
                <span className="db-health-value" style={{ color: 'var(--color-risk-critical)' }}>{reliability?.low_reliability ?? 0}</span>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 10, marginTop: 10 }}>
              <button
                onClick={() => navigate('/data-quality')}
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem' }}
              >
                Review Data Quality &rarr;
              </button>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  )
}
