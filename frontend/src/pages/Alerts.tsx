import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bell, AlertTriangle, Info, Check, Filter, ChevronRight, CheckCircle2 } from 'lucide-react'
import { alertsAPI } from '@/api/client'
import { PageHeader, EmptyState } from '@/components/common'
import type { Alert } from '@/types'
import { Link } from 'react-router-dom'

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [severityFilter, setSeverityFilter] = useState('ALL')

  const fetchAlerts = () => {
    setIsLoading(true)
    alertsAPI.list()
      .then((data) => setAlerts(Array.isArray(data) ? data : data.alerts || []))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    fetchAlerts()
  }, [])

  const handleUpdateStatus = async (alertId: string, status: 'ACKNOWLEDGED' | 'RESOLVED') => {
    try {
      await alertsAPI.update(alertId, { status })
      fetchAlerts()
    } catch (e) {
      console.error('Failed to update alert:', e)
    }
  }

  const activeCount = useMemo(() => alerts.filter(a => a.status === 'ACTIVE').length, [alerts])
  const criticalCount = useMemo(() => alerts.filter(a => a.severity === 'CRITICAL').length, [alerts])
  const ackCount = useMemo(() => alerts.filter(a => a.status === 'ACKNOWLEDGED').length, [alerts])
  const resolvedCount = useMemo(() => alerts.filter(a => a.status === 'RESOLVED').length, [alerts])

  const filteredAlerts = useMemo(() => {
    let result = [...alerts]
    if (statusFilter !== 'ALL') {
      result = result.filter(a => a.status === statusFilter)
    }
    if (severityFilter !== 'ALL') {
      result = result.filter(a => a.severity === severityFilter)
    }
    return result
  }, [alerts, statusFilter, severityFilter])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <PageHeader
        title="Project Alerts & Notifications"
        subtitle="Real-time alerts for project timeline delays, pending court disputes, and compensation roadblocks"
      />

      {/* KPI Cards */}
      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        <div className="metric-card">
          <div className="metric-label flex items-center gap-1.5">
            <Bell size={14} className="text-amber-400" /> Active Alerts
          </div>
          <div className="metric-value text-amber-400">{activeCount}</div>
          <div className="text-xs text-slate-400">Needs officer review</div>
        </div>

        <div className="metric-card">
          <div className="metric-label flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-rose-400" /> Critical Severity
          </div>
          <div className="metric-value text-rose-400">{criticalCount}</div>
          <div className="text-xs text-slate-400">Severe delay risk</div>
        </div>

        <div className="metric-card">
          <div className="metric-label flex items-center gap-1.5">
            <Info size={14} className="text-blue-400" /> In Review
          </div>
          <div className="metric-value text-blue-400">{ackCount}</div>
          <div className="text-xs text-slate-400">Under officer review</div>
        </div>

        <div className="metric-card">
          <div className="metric-label flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-400" /> Resolved
          </div>
          <div className="metric-value text-emerald-400">{resolvedCount}</div>
          <div className="text-xs text-slate-400">Action completed</div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          <Filter size={14} color="var(--color-accent-primary)" /> Alert Filters
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Alert Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
              style={{ height: 36, fontSize: '0.8125rem' }}
            >
              <option value="ALL">All Statuses ({alerts.length})</option>
              <option value="ACTIVE">ACTIVE ({activeCount})</option>
              <option value="ACKNOWLEDGED">ACKNOWLEDGED ({ackCount})</option>
              <option value="RESOLVED">RESOLVED ({resolvedCount})</option>
            </select>
          </div>

          <div>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Severity Level</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="input"
              style={{ height: 36, fontSize: '0.8125rem' }}
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="card">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            Checking for new alerts...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <EmptyState
            icon={<Bell size={32} />}
            title="No Matching Alerts"
            description="No alerts match the selected filters."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredAlerts.map((alert: any) => {
              const isCritical = alert.severity === 'CRITICAL'
              const isHigh = alert.severity === 'HIGH'
              const isAck = alert.status === 'ACKNOWLEDGED'
              const isResolved = alert.status === 'RESOLVED'

              let borderColor = 'var(--color-border-subtle)'
              let bgGlow = 'var(--color-bg-secondary)'

              if (isCritical) { borderColor = 'rgba(239,68,68,0.4)'; bgGlow = 'rgba(239,68,68,0.06)' }
              else if (isHigh) { borderColor = 'rgba(249,115,22,0.4)'; bgGlow = 'rgba(249,115,22,0.06)' }

              return (
                <div
                  key={alert.id}
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    background: bgGlow,
                    border: `1px solid ${borderColor}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: isCritical ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <AlertTriangle size={18} color={isCritical ? '#ef4444' : '#f97316'} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {alert.title}
                        </span>
                        <span className={`badge ${isCritical ? 'badge-red' : 'badge-yellow'}`}>
                          {alert.severity}
                        </span>
                        <span className={`badge ${isResolved ? 'badge-green' : isAck ? 'badge-blue' : 'badge-red'}`}>
                          {alert.status}
                        </span>
                      </div>

                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '4px 0 8px', lineHeight: 1.5 }}>
                        {alert.message}
                      </p>

                      {/* Location 4: Risk Velocity Early Warning Metadata */}
                      {alert.alert_metadata?.velocity_status && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 16,
                          marginBottom: 8,
                          padding: '8px 12px',
                          background: 'var(--color-bg-card)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border-subtle)',
                          fontSize: '0.75rem',
                          flexWrap: 'wrap',
                        }}>
                          <div>Risk: <strong style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round(alert.alert_metadata.previous_score ?? 57)} → {Math.round(alert.alert_metadata.current_score ?? 79)}</strong></div>
                          <div>7d Change: <strong style={{ color: 'var(--color-risk-critical)', fontFamily: 'var(--font-mono)' }}>{alert.alert_metadata.change_7d == null ? 'Unavailable' : `${alert.alert_metadata.change_7d > 0 ? '+' : ''}${Math.round(alert.alert_metadata.change_7d)} pts`}</strong></div>
                          <div>Velocity: <span className="badge badge-red">↑↑ {alert.alert_metadata.velocity_label || 'Rapidly Rising'}</span></div>
                          {alert.alert_metadata.critical_stage && (
                            <div>Critical Stage: <strong style={{ color: 'var(--color-risk-critical)' }}>{alert.alert_metadata.critical_stage}</strong></div>
                          )}
                        </div>
                      )}

                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span>Triggered: {new Date(alert.triggered_at).toLocaleString()}</span>
                        <span>Type: Early warning</span>
                        {alert.alert_metadata?.project_code && (
                          <code style={{ color: 'var(--color-accent-primary)', fontFamily: 'var(--font-mono)' }}>
                            {alert.alert_metadata.project_code}
                          </code>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {alert.project_id && (
                      <Link
                        to={`/projects/${alert.project_id}`}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.75rem' }}
                      >
                        View Project <ChevronRight size={12} />
                      </Link>
                    )}

                    {alert.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleUpdateStatus(alert.id, 'ACKNOWLEDGED')}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem' }}
                      >
                        <Info size={12} /> Acknowledge
                      </button>
                    )}

                    {alert.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleUpdateStatus(alert.id, 'RESOLVED')}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}
                      >
                        <Check size={12} /> Resolve
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
