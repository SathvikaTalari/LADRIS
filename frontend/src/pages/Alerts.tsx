import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Bell,
  AlertTriangle,
  Info,
  Check,
  Filter,
  ChevronRight,
  CheckCircle2,
  Clock,
  Scale,
  Calendar,
  TrendingUp,
  Users,
  Coins,
  ShieldAlert,
  Building2,
  Mail,
  MessageSquare,
} from 'lucide-react'
import { alertsAPI, projectsAPI } from '@/api/client'
import { PageHeader, EmptyState } from '@/components/common'
import type { Alert } from '@/types'
import { Link } from 'react-router-dom'

const SPECIFIC_REASONS = [
  'High Delay Risk',
  'Compensation Pending',
  'Legal Dispute',
  'R&R Delay',
  'Stage Overdue',
  'Risk Increased',
] as const

export type AlertReasonType = typeof SPECIFIC_REASONS[number]

function getReasonBadgeStyle(reason: AlertReasonType | string) {
  switch (reason) {
    case 'Legal Dispute':
      return { bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.3)', icon: Scale }
    case 'Compensation Pending':
      return { bg: 'rgba(234, 179, 8, 0.15)', color: '#facc15', border: 'rgba(234, 179, 8, 0.3)', icon: Coins }
    case 'R&R Delay':
      return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)', icon: Users }
    case 'Stage Overdue':
      return { bg: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', border: 'rgba(249, 115, 22, 0.3)', icon: Calendar }
    case 'Risk Increased':
      return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)', icon: TrendingUp }
    case 'High Delay Risk':
    default:
      return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)', icon: AlertTriangle }
  }
}

function cleanAlertMessage(msg: string): string {
  if (!msg) return ''
  let text = msg.trim()

  text = text.replace(/Speed up R&R activities;\s*progress is currently only\s*([\d.]+%?)\.?/gi, 'Expedite rehabilitation and resettlement; progress is currently at $1.')
  text = text.replace(/Speed up R&R activities/gi, 'Expedite rehabilitation and resettlement')
  text = text.replace(/Accelerate compensation disbursement;\s*currently only\s*([\d.]+%?)\s*disbursed to landowners\.?/gi, 'Expedite compensation payments; only $1 has been disbursed to landowners.')
  text = text.replace(/Accelerate compensation disbursement/gi, 'Expedite compensation payments')
  text = text.replace(/\bmonth\(s\)/gi, 'months')
  text = text.replace(/\bdispute\(s\)/gi, 'disputes')
  text = text.replace(/\bupdate\(s\)/gi, 'updates')
  text = text.replace(/\bproject\(s\)/gi, 'projects')
  text = text.replace(/lagging behind statutory schedule/gi, 'behind schedule')
  text = text.replace(/behind statutory schedule/gi, 'behind schedule')

  return text
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [projectsMap, setProjectsMap] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [reasonFilter, setReasonFilter] = useState('ALL')

  const fetchAlertsAndProjects = async () => {
    setIsLoading(true)
    try {
      const [alertsData, projectsData] = await Promise.all([
        alertsAPI.list(),
        projectsAPI.list({ page_size: 100 }).catch(() => ({ items: [] })),
      ])

      const alertList = Array.isArray(alertsData) ? alertsData : (alertsData as any)?.alerts || []
      setAlerts(alertList)

      const map: Record<string, any> = {}
      if (projectsData && Array.isArray(projectsData.items)) {
        for (const p of projectsData.items) {
          map[p.id] = p
        }
      }
      setProjectsMap(map)
    } catch (e) {
      console.error('Failed to load alerts or projects:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAlertsAndProjects()
  }, [])

  const handleUpdateStatus = async (alertId: string, status: 'ACKNOWLEDGED' | 'RESOLVED') => {
    try {
      await alertsAPI.update(alertId, { status })
      // Refresh to keep server data consistent
      fetchAlertsAndProjects()
    } catch (e) {
      console.error('Failed to update alert:', e)
    }
  }

  // Derive cleaned details for each alert
  const resolvedAlerts = useMemo(() => {
    return alerts.map((alert) => {
      const project = alert.project_id ? projectsMap[alert.project_id] : null
      const projectName =
        alert.project_name ||
        project?.name ||
        alert.alert_metadata?.project_name ||
        (alert.alert_metadata?.project_code ? `Project ${alert.alert_metadata.project_code}` : 'Infrastructure Project')

      let reason: string = alert.alert_reason || ''
      if (!reason || reason.startsWith('ML ') || reason.includes('ML HIGH-RISK')) {
        const t = alert.title || ''
        if (SPECIFIC_REASONS.includes(t as any)) {
          reason = t
        } else {
          const meta = alert.alert_metadata || {}
          const drivers = meta.top_drivers || []
          const compDriver = drivers.find(
            (d: any) => d.feature === 'compensation_disbursement_pct' && d.direction === 'increases_risk'
          )
          const disputeDriver = drivers.find((d: any) => d.feature === 'legal_dispute_count')
          const rrDriver = drivers.find(
            (d: any) => d.feature === 'rehabilitation_progress_pct' && d.direction === 'increases_risk'
          )

          if (compDriver) reason = 'Compensation Pending'
          else if (disputeDriver || (project && project.legal_case_count > 0)) reason = 'Legal Dispute'
          else if (rrDriver) reason = 'R&R Delay'
          else if (meta.velocity_status === 'Rapidly Rising' || meta.velocity_status === 'Rising') reason = 'Risk Increased'
          else if (meta.critical_stage || (project && project.delay_months > 0)) reason = 'Stage Overdue'
          else reason = 'High Delay Risk'
        }
      }

      let explanation: string = alert.explanation || alert.message || ''
      if (
        !alert.explanation &&
        (explanation.startsWith('ML ') || explanation.includes('has ML delay risk') || explanation.includes('has production-model'))
      ) {
        const meta = alert.alert_metadata || {}
        if (reason === 'Compensation Pending') {
          explanation = 'Compensation payments are behind schedule; immediate officer review required.'
        } else if (reason === 'Legal Dispute') {
          explanation = 'Active court disputes require mediation to avoid stay orders on land possession.'
        } else if (reason === 'R&R Delay') {
          explanation = 'Rehabilitation and resettlement activities are behind schedule.'
        } else if (reason === 'Stage Overdue') {
          explanation = 'Statutory clearances are overdue beyond the baseline schedule.'
        } else if (reason === 'Risk Increased') {
          explanation = 'Project delay risk has increased significantly in recent evaluations.'
        } else {
          const score = meta.risk_score ? Math.round(meta.risk_score) : 88
          explanation = `Delay risk model indicates elevated timeline risk (${score}/100).`
        }
      }

      return {
        ...alert,
        displayName: projectName,
        displayReason: reason,
        displayExplanation: cleanAlertMessage(explanation),
      }
    })
  }, [alerts, projectsMap])

  const activeCount = useMemo(() => resolvedAlerts.filter((a) => a.status === 'ACTIVE').length, [resolvedAlerts])
  const criticalCount = useMemo(() => resolvedAlerts.filter((a) => a.severity === 'CRITICAL').length, [resolvedAlerts])
  const ackCount = useMemo(() => resolvedAlerts.filter((a) => a.status === 'ACKNOWLEDGED').length, [resolvedAlerts])
  const resolvedCount = useMemo(() => resolvedAlerts.filter((a) => a.status === 'RESOLVED').length, [resolvedAlerts])

  const filteredAlerts = useMemo(() => {
    let result = [...resolvedAlerts]
    if (statusFilter !== 'ALL') {
      result = result.filter((a) => a.status === statusFilter)
    }
    if (severityFilter !== 'ALL') {
      result = result.filter((a) => a.severity === severityFilter)
    }
    if (reasonFilter !== 'ALL') {
      result = result.filter((a) => a.displayReason === reasonFilter)
    }
    return result
  }, [resolvedAlerts, statusFilter, severityFilter, reasonFilter])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <PageHeader
        title="Project Alerts & Notifications"
        subtitle="Real-time alerts for project delay risks, pending compensation, court disputes, and milestone delays"
      />

      {/* KPI Cards */}
      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        <div className="metric-card">
          <div className="metric-label flex items-center gap-1.5">
            <Bell size={14} className="text-amber-400" /> Active Alerts
          </div>
          <div className="metric-value text-amber-400">{activeCount}</div>
          <div className="text-xs text-slate-400">Action required</div>
        </div>

        <div className="metric-card">
          <div className="metric-label flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-rose-400" /> Critical Severity
          </div>
          <div className="metric-value text-rose-400">{criticalCount}</div>
          <div className="text-xs text-slate-400">Immediate attention required</div>
        </div>

        <div className="metric-card">
          <div className="metric-label flex items-center gap-1.5">
            <Info size={14} className="text-blue-400" /> Acknowledged
          </div>
          <div className="metric-value text-blue-400">{ackCount}</div>
          <div className="text-xs text-slate-400">Under review</div>
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
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
              <option value="ACTIVE">Active ({activeCount})</option>
              <option value="ACKNOWLEDGED">Acknowledged ({ackCount})</option>
              <option value="RESOLVED">Resolved ({resolvedCount})</option>
            </select>
          </div>

          <div>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Alert Reason</label>
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="input"
              style={{ height: 36, fontSize: '0.8125rem' }}
            >
              <option value="ALL">All Alert Reasons</option>
              {SPECIFIC_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
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
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="card">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            Loading alerts...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <EmptyState
            icon={<Bell size={32} />}
            title="No Matching Alerts"
            description="No alerts match the selected filters."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredAlerts.map((alert) => {
              const isCritical = alert.severity === 'CRITICAL'
              const isHigh = alert.severity === 'HIGH'
              const isActive = alert.status === 'ACTIVE'
              const isAck = alert.status === 'ACKNOWLEDGED'
              const isResolved = alert.status === 'RESOLVED'

              const reasonStyle = getReasonBadgeStyle(alert.displayReason)
              const ReasonIcon = reasonStyle.icon

              let borderColor = 'var(--color-border-subtle)'
              let bgGlow = 'var(--color-bg-secondary)'

              if (isCritical) {
                borderColor = 'rgba(239,68,68,0.35)'
                bgGlow = 'rgba(239,68,68,0.04)'
              } else if (isHigh) {
                borderColor = 'rgba(249,115,22,0.35)'
                bgGlow = 'rgba(249,115,22,0.04)'
              } else if (isResolved) {
                borderColor = 'rgba(16,185,129,0.2)'
                bgGlow = 'rgba(16,185,129,0.02)'
              }

              const formattedTriggeredTime = alert.triggered_at
                ? new Date(alert.triggered_at).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recent'

              return (
                <div
                  key={alert.id}
                  style={{
                    padding: '16px 20px',
                    borderRadius: 10,
                    background: bgGlow,
                    border: `1px solid ${borderColor}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Top Header Row: Project Name + Badges + Actions */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 280 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: reasonStyle.bg,
                          border: `1px solid ${reasonStyle.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          color: reasonStyle.color,
                        }}
                      >
                        <ReasonIcon size={20} />
                      </div>

                      <div style={{ flex: 1 }}>
                        {/* Project Name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '1rem',
                              fontWeight: 700,
                              color: 'var(--color-text-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <Building2 size={15} style={{ opacity: 0.7 }} />
                            {alert.displayName}
                          </span>

                          {alert.alert_metadata?.project_code && (
                            <code
                              style={{
                                fontSize: '0.72rem',
                                padding: '2px 6px',
                                background: 'var(--color-bg-card)',
                                borderRadius: 4,
                                border: '1px solid var(--color-border-subtle)',
                                color: 'var(--color-accent-primary)',
                              }}
                            >
                              {alert.alert_metadata.project_code}
                            </code>
                          )}
                        </div>

                        {/* Badges: Alert Reason, Severity, Status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {/* Alert Reason */}
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: reasonStyle.bg,
                              color: reasonStyle.color,
                              border: `1px solid ${reasonStyle.border}`,
                            }}
                          >
                            <ReasonIcon size={12} />
                            {alert.displayReason}
                          </span>

                          {/* Severity */}
                          <span className={`badge ${isCritical ? 'badge-red' : isHigh ? 'badge-yellow' : 'badge-blue'}`}>
                            {alert.severity}
                          </span>

                          {/* Status */}
                          <span
                            className={`badge ${
                              isResolved ? 'badge-green' : isAck ? 'badge-blue' : 'badge-red'
                            }`}
                          >
                            {isResolved ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <CheckCircle2 size={11} /> Resolved
                              </span>
                            ) : isAck ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Info size={11} /> Acknowledged
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <ShieldAlert size={11} /> Active
                              </span>
                            )}
                          </span>

                          {/* Email Sent Status Badge */}
                          {(alert.email_sent || alert.alert_metadata?.email_sent) && (
                            <span
                              className="badge"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: '0.72rem',
                                background: 'rgba(59, 130, 246, 0.12)',
                                color: '#60a5fa',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                padding: '2px 8px',
                                borderRadius: 6,
                              }}
                              title={
                                alert.email_recipient || alert.alert_metadata?.email_recipient
                                  ? `Email sent to ${alert.email_recipient || alert.alert_metadata?.email_recipient}`
                                  : 'Email notification sent to responsible officer'
                              }
                            >
                              <Mail size={11} /> Email Sent
                            </span>
                          )}

                          {/* SMS Sent Status Badge */}
                          {(alert.sms_sent || alert.alert_metadata?.sms_sent) && (
                            <span
                              className="badge"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: '0.72rem',
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                padding: '2px 8px',
                                borderRadius: 6,
                              }}
                              title={
                                alert.sms_recipient || alert.alert_metadata?.sms_recipient
                                  ? `SMS sent to ${alert.sms_recipient || alert.alert_metadata?.sms_recipient}`
                                  : 'SMS notification sent to responsible officer'
                              }
                            >
                              <MessageSquare size={11} /> SMS Sent
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions: View Project, Acknowledge (Active only), Resolve (Active/Acknowledged). Resolved is read-only except View Project. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {alert.project_id && (
                        <Link
                          to={`/projects/${alert.project_id}`}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          View Project <ChevronRight size={13} />
                        </Link>
                      )}

                      {isActive && (
                        <button
                          onClick={() => handleUpdateStatus(alert.id, 'ACKNOWLEDGED')}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          title="Acknowledge this alert"
                        >
                          <Info size={13} /> Acknowledge
                        </button>
                      )}

                      {!isResolved && (
                        <button
                          onClick={() => handleUpdateStatus(alert.id, 'RESOLVED')}
                          className="btn btn-secondary btn-sm"
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-success)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="Resolve this alert"
                        >
                          <Check size={13} /> Resolve
                        </button>
                      )}

                      {isResolved && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--color-text-muted)',
                            padding: '4px 8px',
                            background: 'var(--color-bg-card)',
                            borderRadius: 4,
                            border: '1px solid var(--color-border-subtle)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <CheckCircle2 size={12} className="text-emerald-400" /> Read-Only
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Short Explanation */}
                  <p
                    style={{
                      fontSize: '0.84rem',
                      color: 'var(--color-text-secondary)',
                      margin: 0,
                      lineHeight: 1.5,
                      paddingLeft: 52,
                    }}
                  >
                    {alert.displayExplanation}
                  </p>

                  {/* Metadata & Triggered Time Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.72rem',
                      color: 'var(--color-text-muted)',
                      borderTop: '1px dashed var(--color-border-subtle)',
                      paddingTop: 8,
                      paddingLeft: 52,
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> Triggered: {formattedTriggeredTime}
                      </span>

                      {alert.resolved_at && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-success)' }}>
                          <CheckCircle2 size={12} /> Resolved:{' '}
                          {new Date(alert.resolved_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}

                      {alert.acknowledged_at && !alert.resolved_at && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-accent-tertiary)' }}>
                          <Info size={12} /> Acknowledged:{' '}
                          {new Date(alert.acknowledged_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>

                    {alert.alert_metadata?.risk_score && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span>Delay Risk Score:</span>
                        <strong
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: alert.alert_metadata.risk_score >= 85 ? 'var(--color-risk-critical)' : 'var(--color-risk-high)',
                          }}
                        >
                          {Math.round(alert.alert_metadata.risk_score)}/100
                        </strong>
                      </div>
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
