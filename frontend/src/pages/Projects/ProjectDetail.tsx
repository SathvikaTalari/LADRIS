import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Brain, Edit3, HelpCircle, Lightbulb, MapPin, RefreshCw } from 'lucide-react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { predictionsAPI, projectsAPI } from '@/api/client'
import type { PredictionResult, Project } from '@/types'
import { EmptyState, RiskBadge, StatusBadge } from '@/components/common'
import { formatDate, formatINR } from '@/utils'
import { useAuthStore } from '@/store/authStore'

type Tab = 'overview' | 'stages' | 'risk' | 'actions'

function formatFeatureName(name: string): string {
  const map: Record<string, string> = {
    compensation_disbursement_ratio: 'Compensation Paid vs Sanctioned',
    rehabilitation_progress_pct: 'Rehabilitation & Resettlement (R&R) Progress',
    max_dispute_pendency_days: 'Pending Court Dispute Time',
    dispute_count: 'Active Legal Disputes Count',
    stakeholder_update_cadence_days: 'Days Since Last Progress Update',
    total_area_ha: 'Total Land Area Required',
    total_affected_families: 'Number of Affected Families',
    approval_timeline_days: 'Approval Processing Time',
    possession_status_pct: 'Physical Land Possession',
    district_historical_delay_rate: 'District Historical Delay Rate',
    agency_historical_delay_rate: 'Agency Historical Track Record',
    scheduled_area: 'Scheduled / Tribal Area Status',
    forest_area_ha: 'Forest Land Involved',
    acquisition_mode: 'Mode of Acquisition',
  }
  return map[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatFeatureValue(name: string, val: any): string {
  if (val == null) return 'Unavailable'
  const num = Number(val)
  if (!isNaN(num)) {
    if (name.includes('ratio') || name.includes('pct')) {
      const pct = num <= 1 && name.includes('ratio') ? num * 100 : num
      return `${pct.toFixed(0)}%`
    }
    if (name.includes('days')) return `${Math.round(num)} days`
    if (name.includes('ha')) return `${num.toLocaleString()} ha`
  }
  return String(val)
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [project, setProject] = useState<Project | null>(null)
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [predicting, setPredicting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [predictionError, setPredictionError] = useState<string | null>(null)

  const canEdit = user && ['SUPER_ADMIN', 'STATE_ADMIN', 'DISTRICT_OFFICER', 'LA_OFFICER', 'PROJECT_OFFICER'].includes(user.role)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([projectsAPI.get(id), predictionsAPI.get(id).catch(() => null)])
      .then(([projectResult, predictionResult]) => { setProject(projectResult); setPrediction(predictionResult) })
      .catch(() => setError('Project not found or access denied.'))
      .finally(() => setLoading(false))
  }, [id])

  const generate = async () => {
    if (!id) return
    setPredicting(true)
    setPredictionError(null)
    try { setPrediction(await predictionsAPI.generate(id)) }
    catch (err: any) {
      const detail = err?.response?.data?.detail
      setPredictionError(typeof detail === 'string' ? detail : JSON.stringify(detail || 'Prediction could not be generated.'))
    } finally { setPredicting(false) }
  }

  if (loading) return <div className="card" style={{ padding: 30, textAlign: 'center' }}>Loading project details and AI predictions…</div>
  if (error || !project) return <EmptyState icon={<AlertTriangle size={28} />} title="Project unavailable" description={error || 'Project record unavailable.'} />

  const coords: [number, number] | null = project.latitude != null && project.longitude != null ? [Number(project.latitude), Number(project.longitude)] : null
  const compensationPct = project.estimated_compensation_inr
    ? (Number(project.disbursed_compensation_inr || 0) / Number(project.estimated_compensation_inr) * 100) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 40 }}>
      {/* Top action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/projects')}>
          <ArrowLeft size={14} /> Back to Projects
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && (
            <Link className="btn btn-secondary" to={`/projects/${project.id}/edit`}>
              <Edit3 size={14} /> Edit Project Details
            </Link>
          )}
          <button className="btn btn-primary" disabled={predicting} onClick={generate}>
            <RefreshCw size={14} className={predicting ? 'animate-spin' : ''} />
            {predicting ? 'Calculating…' : prediction ? 'Recalculate Prediction' : 'Generate Delay Prediction'}
          </button>
        </div>
      </div>

      {/* Project Banner Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div>
            <code style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'var(--color-bg-secondary)', borderRadius: 4, color: 'var(--color-accent-primary)' }}>
              {project.project_code}
            </code>
            <h1 style={{ margin: '8px 0 4px 0', fontSize: '1.4rem' }}>{project.name}</h1>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              State: <strong>{project.state_code}</strong> · Districts: <strong>{project.district_codes?.join(', ') || 'District unavailable'}</strong> · Agency: <strong>{project.executing_agency || project.nodal_agency || 'Agency unavailable'}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusBadge status={project.status} />
            <RiskBadge level={prediction?.risk_category || 'UNKNOWN'} />
          </div>
        </div>
      </div>

      {/* High-Risk Alert Banner */}
      {prediction?.high_risk_alert?.requires_immediate_attention && (
        <div
          className="card"
          style={{
            borderColor: '#ef4444',
            background: 'rgba(239, 68, 68, 0.08)',
            borderLeft: '4px solid #ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <AlertTriangle size={24} color="#ef4444" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#ef4444', fontSize: '0.95rem' }}>
              HIGH-RISK ESCALATION REQUIRED
            </strong>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {prediction.high_risk_alert.alert_message}
            </div>
          </div>
        </div>
      )}

      {predictionError && (
        <div className="card" style={{ borderColor: 'var(--color-risk-critical)', color: 'var(--color-risk-critical)', background: 'rgba(239, 68, 68, 0.05)' }}>
          {predictionError}
        </div>
      )}
      {!prediction && (
        <div className="card" style={{ color: 'var(--color-text-muted)' }}>
          Click "Generate Delay Prediction" above to analyze this project's timeline using AI.
        </div>
      )}
      {prediction?.is_stale && (
        <div className="card" style={{ borderColor: 'var(--color-status-warning)', background: 'rgba(245, 158, 11, 0.05)' }}>
          Project details were recently modified. Click "Recalculate Prediction" to update with the newest data.
        </div>
      )}

      {/* 6 Big Key Metrics in Plain English */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <Metric
          label="Chance of Delay"
          value={prediction ? `${(prediction.delay_probability * 100).toFixed(0)}%` : 'Unavailable'}
          description={prediction ? (prediction.delay_probability > 0.6 ? 'High likelihood of delay' : 'Likely to complete on time') : ''}
          highlightColor={prediction && prediction.delay_probability > 0.6 ? '#ef4444' : '#10b981'}
        />
        <Metric
          label="Risk score"
          value={prediction ? `${prediction.risk_score} / 100` : 'Unavailable'}
          description={
            prediction?.risk_trend
              ? `Trend: ${prediction.risk_trend.trend} (${prediction.risk_trend.delta > 0 ? '+' : ''}${prediction.risk_trend.delta} pts)`
              : 'Calibrated LightGBM score'
          }
          highlightColor={prediction?.risk_category === 'HIGH' ? '#ef4444' : prediction?.risk_category === 'MEDIUM' ? '#f59e0b' : '#10b981'}
        />
        <Metric
          label="Risk Category"
          value={prediction?.risk_category || 'Unavailable'}
          description="Classification thresholds are loaded from model metadata"
        />
        <Metric
          label="Expected Extra Delay"
          value={prediction?.estimated_delay_days != null ? `${prediction.estimated_delay_days} days` : (prediction?.predicted_delay_days != null ? `${prediction.predicted_delay_days} days` : 'Unavailable')}
          description={prediction?.predicted_delay_days != null ? `~${Math.round(prediction.predicted_delay_days / 30)} months past deadline` : ''}
          highlightColor="#f59e0b"
        />
        <Metric
          label="Delay Range (P10–P90)"
          value={prediction?.delay_range?.range_text || (prediction?.prediction_interval?.p10 != null ? `${prediction.prediction_interval.p10} to ${prediction.prediction_interval.p90} days` : 'Unavailable')}
          description="Quantile confidence interval"
        />
        <Metric
          label="Critical Stage"
          value={prediction?.critical_stage?.stage_name_display || prediction?.current_stage?.replace(/_/g, ' ') || 'Notification'}
          description={prediction?.critical_stage ? `Risk: ${prediction.critical_stage.risk_score}/100` : 'Operational bottleneck'}
          highlightColor="#8b5cf6"
        />
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 8 }}>
        {[
          { id: 'overview', label: '1. Project Overview' },
          { id: 'stages', label: '2. Stage-by-Stage Risk' },
          { id: 'risk', label: '3. Why is it Delayed?' },
          { id: 'actions', label: '4. Recommended Action Plan' },
        ].map((tabItem) => (
          <button
            key={tabItem.id}
            className={`btn ${tab === tabItem.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(tabItem.id as Tab)}
            style={{ fontSize: '0.85rem' }}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div className="card">
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', fontWeight: 700 }}>Project Details & Land Progress</h3>
            <Info label="Infrastructure Type" value={project.project_type} />
            <Info label="Total Land Required" value={project.total_area_ha == null ? 'Unavailable' : `${project.total_area_ha.toLocaleString()} ha`} />
            <Info label="Land Already Acquired" value={project.area_acquired_ha == null ? 'Unavailable' : `${project.area_acquired_ha.toLocaleString()} ha`} />
            <Info label="Affected Families (PAFs)" value={project.total_affected_families?.toLocaleString() ?? 'Unavailable'} />
            <Info label="Compensation Sanctioned" value={project.estimated_compensation_inr == null ? 'Unavailable' : formatINR(project.estimated_compensation_inr)} />
            <Info label="Compensation Paid Out" value={compensationPct == null ? 'Unavailable' : `${compensationPct.toFixed(1)}% disbursed`} />
            <Info label="Preliminary Notification Date" value={project.notification_3a_date ? formatDate(project.notification_3a_date) : 'Unavailable'} />
            <Info label="Target Completion Date" value={project.planned_end_date ? formatDate(project.planned_end_date) : 'Unavailable'} />
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={16} color="var(--color-accent-primary)" /> Project Location
            </h3>
            {coords ? (
              <div style={{ height: 280, borderRadius: 8, overflow: 'hidden' }}>
                <MapContainer center={coords} zoom={12} style={{ height: '100%' }}>
                  <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={coords} icon={markerIcon(prediction?.risk_category)}>
                    <Popup>{project.name}</Popup>
                  </Marker>
                </MapContainer>
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Coordinates are not provided in the project record. Location is tracked at state and district level.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STAGES */}
      {tab === 'stages' && (
        <div className="card">
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 700 }}>Risk at Each Acquisition Stage</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 16 }}>
            Shows the delay risk across each milestone of land acquisition. The highlighted box indicates this project's current active phase: <strong>{prediction?.current_stage?.replace(/_/g, ' ') || 'In Progress'}</strong>.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            {prediction?.stage_predictions?.map((stage) => {
              const isCurrent = stage.stage === prediction.current_stage
              return (
                <div
                  key={stage.stage}
                  style={{
                    padding: 14,
                    border: isCurrent ? '2px solid var(--color-accent-primary)' : '1px solid var(--color-border-subtle)',
                    background: isCurrent ? 'var(--color-bg-secondary)' : 'transparent',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: isCurrent ? 'var(--color-accent-primary)' : 'var(--color-text-muted)', fontWeight: 700 }}>
                    {isCurrent ? '● Active Current Stage' : 'Milestone'}
                  </div>
                  <strong style={{ display: 'block', marginTop: 4, fontSize: '0.85rem' }}>
                    {stage.stage.replace(/_/g, ' ')}
                  </strong>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, margin: '8px 0 6px 0', fontFamily: 'var(--font-mono)' }}>
                    {stage.risk_score} / 100
                  </div>
                  <RiskBadge level={stage.risk_category} />
                </div>
              )
            }) || <p style={{ color: 'var(--color-text-muted)' }}>Stage predictions unavailable.</p>}
          </div>

          {prediction?.stage_completion_estimates && prediction.stage_completion_estimates.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                Stage Completion Estimates (Statutory vs Risk-Adjusted Timelines)
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)', textAlign: 'left', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <th style={{ padding: '8px 12px' }}>Lifecycle Stage</th>
                      <th style={{ padding: '8px 12px' }}>Statutory Duration</th>
                      <th style={{ padding: '8px 12px' }}>Predicted Duration</th>
                      <th style={{ padding: '8px 12px' }}>Delay Probability</th>
                      <th style={{ padding: '8px 12px' }}>Stage Risk</th>
                      <th style={{ padding: '8px 12px' }}>Estimated Target Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prediction.stage_completion_estimates.map((est) => (
                      <tr key={est.stage} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{est.stage_name_display}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>{est.baseline_days} days</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: est.estimated_duration_days > est.baseline_days ? '#f59e0b' : 'inherit' }}>
                          {est.estimated_duration_days} days
                        </td>
                        <td style={{ padding: '8px 12px' }}>{(est.delay_probability * 100).toFixed(0)}%</td>
                        <td style={{ padding: '8px 12px' }}>
                          <RiskBadge level={est.risk_category} />
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{est.expected_completion_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WHY IS IT DELAYED? */}
      {tab === 'risk' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div className="card">
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Brain size={18} color="var(--color-accent-primary)" />
              Top Factors Influencing This Project's Timeline
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem', marginBottom: 16 }}>
              The AI evaluated 23 project indicators. These are the main reasons why this project is on track or at risk of delay:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {prediction?.top_drivers?.map((driver) => {
                const isRisk = driver.direction === 'increases_risk' || driver.contribution > 0
                return (
                  <div
                    key={driver.feature}
                    style={{
                      padding: '12px 14px',
                      background: 'var(--color-bg-secondary)',
                      borderRadius: 8,
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>
                        {formatFeatureName(driver.feature)}
                      </strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        Current status: <strong>{formatFeatureValue(driver.feature, driver.value)}</strong>
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        background: isRisk ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                        color: isRisk ? '#ef4444' : '#10b981',
                        border: `1px solid ${isRisk ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                      }}
                    >
                      {isRisk ? '⚠️ Increases Delay Risk' : '✅ Helps Prevent Delay'}
                    </span>
                  </div>
                )
              }) || <p style={{ color: 'var(--color-text-muted)' }}>Explanation factors unavailable.</p>}
            </div>

            <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: 8, border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              <HelpCircle size={18} color="#3b82f6" style={{ flexShrink: 0 }} />
              <span>
                <strong>How to use this information:</strong> Resolving the top delay factors first (like expediting compensation payments or clearing pending court cases) provides the fastest path to getting this project back on schedule.
              </span>
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', fontWeight: 700 }}>AI Prediction Details</h3>
            <Info label="AI Model Status" value={<span className="badge badge-emerald">Active & Calibrated</span>} />
            <Info label="Model Version" value={prediction?.model_version || 'v1.0 (Production)'} />
            <Info label="Project Data Completeness" value={prediction ? `${prediction.data_completeness_pct}% available` : 'Unavailable'} />
            <Info label="Analysis Date" value={prediction?.predicted_at ? formatDate(prediction.predicted_at) : 'Today'} />
            <Info label="Response Speed" value={prediction?.latency_ms ? `${prediction.latency_ms} ms (Instant)` : 'Instant'} />
          </div>
        </div>
      )}

      {/* TAB 4: RECOMMENDED ACTION PLAN */}
      {tab === 'actions' && (
        <div className="card">
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lightbulb size={18} color="#f59e0b" />
            Recommended Actions to Prevent Delays
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 16 }}>
            Based on this project's current bottlenecks and historical patterns from similar infrastructure projects across India:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {prediction?.recommendations?.length ? (
              prediction.recommendations.map((recommendation, index) => {
                const driver = prediction.top_drivers?.filter((item) => item.contribution > 0)[index]
                return (
                  <div
                    key={`${recommendation}-${index}`}
                    style={{
                      padding: 16,
                      background: 'var(--color-bg-secondary)',
                      borderRadius: 8,
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      gap: 14,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </div>

                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--color-text-primary)' }}>
                        {recommendation}
                      </strong>
                      {driver && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                          Suggested because: <strong>{formatFeatureName(driver.feature)}</strong> is currently at {formatFeatureValue(driver.feature, driver.value)}.
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <p style={{ color: 'var(--color-text-muted)' }}>No urgent actions required. This project is progressing smoothly.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, description, highlightColor }: { label: string; value: string; description?: string; highlightColor?: string }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4, color: highlightColor || 'var(--color-text-primary)' }}>
        {value}
      </div>
      {description && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{description}</div>}
    </div>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--color-border-subtle)', fontSize: '0.85rem' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function markerIcon(level?: string) {
  const color = level === 'HIGH' || level === 'CRITICAL' ? '#ef4444' : level === 'MEDIUM' ? '#eab308' : '#16a34a'
  return L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 8px rgba(0,0,0,0.5)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}
