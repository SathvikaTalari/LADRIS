import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bell, FolderCheck } from 'lucide-react'
import { alertsAPI, predictionsAPI, projectsAPI } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { RiskBadge, StatusBadge } from '@/components/common'

export default function LAWorkbench() {
  const { user } = useAuthStore()
  const [projects, setProjects] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    Promise.all([projectsAPI.list({ page_size: 100 }), alertsAPI.list({ status: 'ACTIVE' })])
      .then(async ([projectResponse, alertResponse]) => {
        setProjects(await Promise.all((projectResponse.items || []).map(async (project: any) => ({ ...project, prediction: await predictionsAPI.get(project.id).catch(() => null) }))))
        setAlerts(Array.isArray(alertResponse) ? alertResponse : [])
      }).finally(() => setLoading(false))
  }, [])
  const highRisk = projects.filter((project) => project.prediction?.risk_category === 'HIGH').length
  return <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
    <div><span className="badge badge-blue">OPERATIONAL WORKBENCH</span><h1 style={{ marginBottom: 4 }}>Welcome, {user?.full_name || 'Land Acquisition Officer'}</h1><div style={{ color: 'var(--color-text-muted)' }}>Only records visible to your authenticated role are shown.</div></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}><Metric icon={<FolderCheck size={18} />} label="Visible projects" value={loading ? '…' : String(projects.length)} /><Metric icon={<AlertTriangle size={18} />} label="High ML risk" value={loading ? '…' : String(highRisk)} /><Metric icon={<Bell size={18} />} label="Active alerts" value={loading ? '…' : String(alerts.length)} /></div>
    <div className="card"><h3>Assigned project intelligence</h3>{loading && <p>Loading…</p>}{!loading && projects.length === 0 && <p>No project records are available for this account.</p>}{projects.map((project) => <div key={project.id} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 120px 130px 90px', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--color-border-subtle)' }}><code>{project.project_code}</code><div><strong>{project.name}</strong><div style={{ color: 'var(--color-text-muted)', fontSize: '.75rem' }}>{project.prediction?.current_stage?.replaceAll('_', ' ') || 'Stage unavailable'}</div></div><StatusBadge status={project.status} /><RiskBadge level={project.prediction?.risk_category || 'UNKNOWN'} /><Link to={`/projects/${project.id}`}>Review</Link></div>)}</div>
    <div className="card"><h3>Actions due</h3><p style={{ color: 'var(--color-text-muted)' }}>No task/deadline records are stored in the current database schema. Operational deadlines are not fabricated from prediction data.</p></div>
  </div>
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="card"><div style={{ color: 'var(--color-text-muted)', display: 'flex', gap: 8 }}>{icon}{label}</div><div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: 8 }}>{value}</div></div> }
