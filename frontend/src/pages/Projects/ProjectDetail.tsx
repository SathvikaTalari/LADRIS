import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Brain, Edit3, MapPin, RefreshCw } from 'lucide-react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { predictionsAPI, projectsAPI } from '@/api/client'
import type { PredictionResult, Project } from '@/types'
import { EmptyState, RiskBadge, StatusBadge } from '@/components/common'
import { formatDate, formatINR } from '@/utils'
import { useAuthStore } from '@/store/authStore'

type Tab = 'overview' | 'stages' | 'risk' | 'actions'

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
    setPredicting(true); setPredictionError(null)
    try { setPrediction(await predictionsAPI.generate(id)) }
    catch (err: any) {
      const detail = err?.response?.data?.detail
      setPredictionError(typeof detail === 'string' ? detail : JSON.stringify(detail || 'Prediction could not be generated.'))
    } finally { setPredicting(false) }
  }

  if (loading) return <div className="card">Loading project and production prediction…</div>
  if (error || !project) return <EmptyState icon={<AlertTriangle size={28} />} title="Project unavailable" description={error || 'Project record unavailable.'} />

  const coords: [number, number] | null = project.latitude != null && project.longitude != null ? [Number(project.latitude), Number(project.longitude)] : null
  const compensationPct = project.estimated_compensation_inr
    ? (Number(project.disbursed_compensation_inr || 0) / Number(project.estimated_compensation_inr) * 100) : null
  const missing = prediction?.unavailable_features || []

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 40 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <button className="btn btn-ghost" onClick={() => navigate('/projects')}><ArrowLeft size={14} /> Back</button>
      <div style={{ display: 'flex', gap: 8 }}>
        {canEdit && <Link className="btn btn-secondary" to={`/projects/${project.id}/edit`}><Edit3 size={14} /> Edit source data</Link>}
        <button className="btn btn-primary" disabled={predicting} onClick={generate}><RefreshCw size={14} /> {predicting ? 'Predicting…' : prediction ? 'Refresh prediction' : 'Generate prediction'}</button>
      </div>
    </div>

    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <div><code>{project.project_code}</code><h1 style={{ margin: '6px 0' }}>{project.name}</h1><div style={{ color: 'var(--color-text-muted)' }}>{project.state_code} · {project.district_codes?.join(', ') || 'District unavailable'} · {project.executing_agency || project.nodal_agency || 'Agency unavailable'}</div></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><StatusBadge status={project.status} /><RiskBadge level={prediction?.risk_category || 'UNKNOWN'} /></div>
      </div>
    </div>

    {predictionError && <div className="card" style={{ borderColor: 'var(--color-risk-critical)', color: 'var(--color-risk-critical)' }}>{predictionError}</div>}
    {!prediction && <div className="card" style={{ color: 'var(--color-text-muted)' }}>No stored prediction is available. Prediction values are not fabricated.</div>}
    {prediction?.is_stale && <div className="card" style={{ borderColor: 'var(--color-status-warning)' }}>This prediction is stale. Refresh it to use the current project snapshot.</div>}

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12 }}>
      <Metric label="Delay probability" value={prediction ? `${(prediction.delay_probability * 100).toFixed(1)}%` : 'Unavailable'} />
      <Metric label="Risk score" value={prediction ? `${prediction.risk_score}/100` : 'Unavailable'} />
      <Metric label="Risk category" value={prediction?.risk_category || 'Unavailable'} />
      <Metric label="Estimated delay" value={prediction?.predicted_delay_days == null ? 'Unavailable' : `${prediction.predicted_delay_days} days`} />
      <Metric label="Prediction interval" value={prediction?.prediction_interval?.p10 == null ? 'Unavailable' : `${prediction.prediction_interval.p10}–${prediction.prediction_interval.p90} days`} />
    </div>

    <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-subtle)' }}>
      {(['overview','stages','risk','actions'] as Tab[]).map((value) => <button key={value} className={`btn ${tab === value ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(value)}>{value === 'risk' ? 'Risk & Intelligence' : value[0].toUpperCase() + value.slice(1)}</button>)}
    </div>

    {tab === 'overview' && <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
      <div className="card"><h3>Source project snapshot</h3><Info label="Project type" value={project.project_type} /><Info label="Land required" value={project.total_area_ha == null ? 'Unavailable' : `${project.total_area_ha} ha`} /><Info label="Land acquired" value={project.area_acquired_ha == null ? 'Unavailable' : `${project.area_acquired_ha} ha`} /><Info label="Affected families" value={project.total_affected_families ?? 'Unavailable'} /><Info label="Compensation sanctioned" value={project.estimated_compensation_inr == null ? 'Unavailable' : formatINR(project.estimated_compensation_inr)} /><Info label="Compensation disbursed" value={compensationPct == null ? 'Unavailable' : `${compensationPct.toFixed(1)}%`} /><Info label="Notification date" value={project.notification_3a_date ? formatDate(project.notification_3a_date) : 'Unavailable'} /><Info label="Expected completion" value={project.planned_end_date ? formatDate(project.planned_end_date) : 'Unavailable'} /></div>
      <div className="card"><h3><MapPin size={16} /> Exact project location</h3>{coords ? <div style={{ height: 300 }}><MapContainer center={coords} zoom={12} style={{ height: '100%' }}><TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Marker position={coords} icon={markerIcon(prediction?.risk_category)}><Popup>{project.name}</Popup></Marker></MapContainer></div> : <p style={{ color: 'var(--color-text-muted)' }}>Latitude/longitude is unavailable in the source record. No approximate marker is shown.</p>}</div>
    </div>}

    {tab === 'stages' && <div className="card"><h3>Lifecycle prediction</h3><p style={{ color: 'var(--color-text-muted)' }}>Observed current stage: <strong>{prediction?.current_stage?.replace(/_/g, ' ') || 'Unavailable'}</strong>. The active bundle has no standalone stage artifacts; these are explicitly labelled overall-model counterfactuals.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>{prediction?.stage_predictions?.map((stage) => <div key={stage.stage} style={{ padding: 12, border: stage.stage === prediction.current_stage ? '2px solid var(--color-accent-primary)' : '1px solid var(--color-border-subtle)', borderRadius: 8 }}><strong>{stage.stage.replace(/_/g, ' ')}</strong><div style={{ fontSize: '1.2rem', marginTop: 7 }}>{stage.risk_score}/100</div><RiskBadge level={stage.risk_category} /></div>) || <p>Stage predictions unavailable.</p>}</div></div>}

    {tab === 'risk' && <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
      <div className="card"><h3><Brain size={16} /> SHAP risk drivers</h3>{prediction?.top_drivers?.map((driver) => <div key={driver.feature} style={{ padding: '10px 0', borderBottom: '1px solid var(--color-border-subtle)' }}><strong>{driver.feature}</strong><div style={{ fontSize: '.78rem', color: 'var(--color-text-muted)' }}>Value: {String(driver.value ?? 'unavailable')} · contribution: {driver.contribution} · {driver.direction}</div></div>) || <p>Explanation unavailable.</p>}<p style={{ fontSize: '.72rem', color: 'var(--color-text-muted)' }}>SHAP explains the model output and does not establish causality. Classification thresholds are loaded from model metadata.</p></div>
      <div className="card"><h3>Prediction metadata</h3><Info label="Model version" value={prediction?.model_version || 'Unavailable'} /><Info label="Snapshot date" value={prediction?.snapshot_date ? formatDate(prediction.snapshot_date) : 'Unavailable'} /><Info label="Predicted at" value={prediction?.predicted_at ? formatDate(prediction.predicted_at) : 'Unavailable'} /><Info label="Latency" value={prediction?.latency_ms == null ? 'Unavailable' : `${prediction.latency_ms} ms`} /><Info label="Feature completeness" value={prediction ? `${prediction.data_completeness_pct}%` : 'Unavailable'} />{missing.length > 0 && <div style={{ marginTop: 12, color: 'var(--color-text-muted)', fontSize: '.75rem' }}>Unavailable source features:<ul>{missing.map((item) => <li key={item}>{item}</li>)}</ul></div>}</div>
    </div>}

    {tab === 'actions' && <div className="card"><h3>Model-supported mitigation actions</h3>{prediction?.recommendations?.length ? prediction.recommendations.map((recommendation, index) => { const driver = prediction.top_drivers?.filter((item) => item.contribution > 0)[index]; return <div key={`${recommendation}-${index}`} style={{ padding: 14, marginTop: 10, background: 'var(--color-bg-tertiary)', borderRadius: 8 }}><strong>{recommendation}</strong>{driver && <div style={{ fontSize: '.75rem', color: 'var(--color-text-muted)', marginTop: 6 }}>Based on SHAP driver {driver.feature}; value {String(driver.value ?? 'unavailable')}; contribution {driver.contribution}</div>}</div> }) : <p style={{ color: 'var(--color-text-muted)' }}>No model recommendation is available.</p>}<p style={{ fontSize: '.72rem', color: 'var(--color-text-muted)' }}>Decision support only; these are not recorded government actions or causal guarantees.</p></div>}
  </div>
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="card"><div style={{ color: 'var(--color-text-muted)', fontSize: '.75rem' }}>{label}</div><div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: 6 }}>{value}</div></div> }
function Info({ label, value }: { label: string; value: React.ReactNode }) { return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--color-border-subtle)' }}><span style={{ color: 'var(--color-text-muted)' }}>{label}</span><strong>{value}</strong></div> }
function markerIcon(level?: string) { const color = level === 'HIGH' ? '#ef4444' : level === 'MEDIUM' ? '#eab308' : '#16a34a'; return L.divIcon({ className: '', html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid white"></div>`, iconSize: [18,18], iconAnchor: [9,9] }) }
