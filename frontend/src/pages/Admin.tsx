import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, FileText, KeyRound, Cpu, Sliders } from 'lucide-react'
import { PageHeader } from '@/components/common'
import { useAuthStore } from '@/store/authStore'
import { roleLabel } from '@/utils'
import { modelsAPI } from '@/api/client'

export default function Admin() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'users' | 'alerts' | 'models'>('users')
  const [modelInfo, setModelInfo] = useState<any>(null)

  useEffect(() => {
    if (activeTab === 'models') {
      modelsAPI.current().catch(() => null).then(setModelInfo)
    }
  }, [activeTab])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ width: '100%' }}>
      <PageHeader
        title="Administration & Governance Center"
        subtitle="Manage users, alerts, and models."
      />

      {/* Styled Admin Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 24,
        borderBottom: '1px solid var(--color-border-subtle)',
        paddingBottom: 12,
        flexWrap: 'wrap',
      }}>
        <button
          className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('users')}
          style={{ fontSize: '0.85rem', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Shield size={16} /> User Management
        </button>
        <button
          className={`btn ${activeTab === 'alerts' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('alerts')}
          style={{ fontSize: '0.85rem', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Sliders size={16} /> Alert Threshold Configuration
        </button>
        <button
          className={`btn ${activeTab === 'models' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('models')}
          style={{ fontSize: '0.85rem', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Cpu size={16} /> Model Governance & Registry
        </button>
      </div>

      {activeTab === 'users' && (
        <>
          <div className="grid-3" style={{ marginBottom: 24 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Shield size={20} color="var(--color-accent-primary)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Active User Profile</span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                Logged in as <strong style={{ color: 'var(--color-text-primary)' }}>{user?.full_name}</strong> ({user?.email})
              </p>
              <div style={{ marginTop: 12 }}>
                <span className="badge badge-blue">{roleLabel(user?.role || 'VIEWER')}</span>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <KeyRound size={20} color="var(--color-success)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Role Matrix</span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                6 System Roles: SUPER_ADMIN, STATE_ADMIN, DISTRICT_OFFICER, PROJECT_OFFICER, ANALYST, VIEWER
              </p>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <FileText size={20} color="var(--color-warning)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Audit Compliance</span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                Logs user actions, IP address, and requests.
              </p>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>System Users</h3>
            </div>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Jurisdiction</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{user?.full_name}</td>
                  <td>{user?.email}</td>
                  <td><span className="badge badge-blue">{roleLabel(user?.role || '')}</span></td>
                  <td>{user?.state_code || 'National (All)'}</td>
                  <td><span className="status-dot status-dot-active" /> Active</td>
                  <td style={{ color: 'var(--color-text-muted)' }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN') : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'alerts' && (
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sliders color="var(--color-accent-primary)" size={20} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
              Configurable Early-Warning Signal Thresholds
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Anomaly Risk Threshold (0.0 to 1.0)
              </label>
              <input
                type="number"
                step="0.05"
                defaultValue="0.75"
                className="input"
                style={{ height: 38, fontSize: '0.875rem' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Alerts when the anomaly score is above this value.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Intervention Priority Threshold (0 to 100)
              </label>
              <input
                type="number"
                defaultValue="70"
                className="input"
                style={{ height: 38, fontSize: '0.875rem' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Alerts when the priority score is above this value.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Data Completeness Floor (%)
              </label>
              <input
                type="number"
                defaultValue="60"
                className="input"
                style={{ height: 38, fontSize: '0.875rem' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Alerts when data completeness falls below this level.
              </span>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <button className="btn btn-primary btn-sm">
              Save Threshold Configuration
            </button>
          </div>
        </div>
      )}

      {activeTab === 'models' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Cpu color="#818cf8" size={24} />
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                  Active Model: IsolationForest Anomaly Scorer
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#818cf8', fontFamily: 'var(--font-mono)' }}>
                  v1.0-anomaly
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, paddingTop: 16, borderTop: '1px solid var(--color-border-subtle)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Model Status</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981', marginTop: 4 }}>PRODUCTION_ACTIVE</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Model Type</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 4 }}>{modelInfo?.model_type || 'IsolationForest'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Supervised Delay Model</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>DEFERRED</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Training Records</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 4 }}>{modelInfo?.record_count_used || 56}</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--color-text-primary)' }}>
              Supervised Delay Prediction Status & Limitations
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>
              Delay model training is <strong>DEFERRED</strong> until 200 project records are available. Anomaly detection is currently active.
            </p>
          </div>
        </div>
      )}
    </motion.div>
  )
}
