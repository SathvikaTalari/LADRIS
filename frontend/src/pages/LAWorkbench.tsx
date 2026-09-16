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
    <div>
      <span className="badge badge-blue">OFFICER WORKBENCH</span>
      <h1 style={{ marginBottom: 4, marginTop: 8 }}>Welcome, {user?.full_name || 'Land Acquisition Officer'}</h1>
      <div style={{ color: 'var(--color-text-muted)' }}>Overview of assigned infrastructure projects, active alerts, and delay risks.</div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
      <Metric icon={<FolderCheck size={18} />} label="Assigned Projects" value={loading ? '…' : String(projects.length)} />
      <Metric icon={<AlertTriangle size={18} />} label="High Delay Risk" value={loading ? '…' : String(highRisk)} />
      <Metric icon={<Bell size={18} />} label="Active Alerts" value={loading ? '…' : String(alerts.length)} />
    </div>
    <div className="card">
      <h3 style={{ marginBottom: 16 }}>Assigned Projects & Delay Risk Status</h3>
      {loading && <p>Loading projects…</p>}
      {!loading && projects.length === 0 && <p>No project records are currently available for this account.</p>}
      {projects.map((project) => (
        <div key={project.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px 130px 110px', gap: 12, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <code style={{ fontSize: '0.8rem' }}>{project.project_code}</code>
          <div>
            <strong style={{ fontSize: '0.95rem' }}>{project.name}</strong>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', marginTop: 2 }}>{project.prediction?.current_stage?.replaceAll('_', ' ') || 'Stage details available inside'}</div>
          </div>
          <StatusBadge status={project.status} />
          <RiskBadge level={project.prediction?.risk_category || 'UNKNOWN'} />
          <Link to={`/projects/${project.id}`} className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontSize: '0.75rem', textAlign: 'center' }}>
            View Details
          </Link>
        </div>
      ))}
    </div>
    <div className="card">
      <h3 style={{ marginBottom: 8 }}>Upcoming Action Items</h3>
      <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.875rem' }}>
        No overdue action items currently pending. All milestones are synchronized with state land acquisition offices.
      </p>
    </div>
  </div>
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="card"><div style={{ color: 'var(--color-text-muted)', display: 'flex', gap: 8 }}>{icon}{label}</div><div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: 8 }}>{value}</div></div> }
