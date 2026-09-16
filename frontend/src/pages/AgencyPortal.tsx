import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Building2, MapPin } from 'lucide-react'
import { predictionsAPI, projectsAPI } from '@/api/client'
import { useAuthStore } from '@/store/authStore'

export default function AgencyPortal() {
  const { user } = useAuthStore()
  const [projects, setProjects] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    projectsAPI.list({ page_size: 100, agency: user?.agency_name || undefined })
      .then(async (response) => {
        const enriched = await Promise.all((response.items || []).map(async (project: any) => ({
          ...project, prediction: await predictionsAPI.get(project.id).catch(() => null),
        })))
        setProjects(enriched)
        setSelectedId(enriched[0]?.id || '')
      })
      .catch(() => setError('Agency project data is unavailable.'))
      .finally(() => setLoading(false))
  }, [user?.agency_name])

  const project = projects.find((item) => item.id === selectedId)
  const prediction = project?.prediction
  const acquiredPct = project?.total_area_ha
    ? ((project.area_acquired_ha || 0) / project.total_area_ha * 100).toFixed(1) : null

  return <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
    <div>
      <span className="badge badge-yellow">IMPLEMENTING AGENCY PORTAL</span>
      <h1 style={{ marginBottom: 4, marginTop: 8 }}>Land Acquisition Status & Delay Outlook</h1>
      <div style={{ color: 'var(--color-text-muted)' }}>{user?.agency_name ? `Agency: ${user.agency_name}` : 'Project land handover readiness and delay risk overview'}</div>
    </div>
    {loading && <div className="card">Loading agency projects and delay risks…</div>}
    {error && <div className="card" style={{ color: 'var(--color-risk-critical)' }}>{error}</div>}
    {!loading && !error && projects.length === 0 && <div className="card">No projects are assigned to this agency account.</div>}
    {project && <>
      <div className="card">
        <label className="input-label" style={{ marginBottom: 6 }}>Select Infrastructure Project</label>
        <select className="input" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {projects.map((item) => <option key={item.id} value={item.id}>{item.project_code} — {item.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        <Metric icon={<MapPin size={17} />} label="Total Land Required" value={project.total_area_ha == null ? 'Unavailable' : `${project.total_area_ha} ha`} />
        <Metric icon={<Building2 size={17} />} label="Land Acquired So Far" value={acquiredPct == null ? 'Unavailable' : `${project.area_acquired_ha || 0} ha (${acquiredPct}%)`} />
        <Metric icon={<AlertTriangle size={17} />} label="Delay Risk Level" value={prediction ? `${prediction.risk_category} (${prediction.risk_score}/100)` : 'No Prediction Yet'} />
        <Metric icon={<AlertTriangle size={17} />} label="Expected Extra Delay" value={prediction?.predicted_delay_days == null ? 'Minimal' : `+${prediction.predicted_delay_days} days`} />
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>AI Delay Analysis & Advice</h3>
        <p style={{ margin: '4px 0' }}>Current Stage: <strong>{prediction?.current_stage?.replaceAll('_', ' ') || 'In Progress'}</strong></p>
        <p style={{ margin: '4px 0 12px' }}>Likely Delay Window: <strong>{prediction?.prediction_interval?.p10 == null ? 'Calculating...' : `${prediction.prediction_interval.p10} to ${prediction.prediction_interval.p90} days`}</strong></p>
        <div style={{ padding: 12, background: 'var(--color-bg-elevated)', borderRadius: 6, marginBottom: 16, border: '1px solid var(--color-border-subtle)' }}>
          <strong>Recommended Action:</strong>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            {prediction?.recommendations?.[0] || 'Ensure Section 19 declaration paperwork and compensation disbursement are expedited with district revenue authorities.'}
          </p>
        </div>
        <Link className="btn btn-primary" to={`/projects/${project.id}`}>View Complete Project Report</Link>
      </div>
    </>}
  </div>
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="card"><div style={{ color: 'var(--color-text-muted)', display: 'flex', gap: 8 }}>{icon}{label}</div><div style={{ fontSize: '1.25rem', fontWeight: 750, marginTop: 10 }}>{value}</div></div>
}
