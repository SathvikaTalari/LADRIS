/**
 * LADRIS — Premium Common Components v3.0
 */
import { motion } from 'framer-motion'
import type { RiskLevel, ProjectStatus } from '@/types'
import { riskLevelClass, statusBadgeClass } from '@/utils'

// ─── EmptyState ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="empty-state"
    >
      {icon && (
        <div className="empty-state-icon">
          {icon}
        </div>
      )}
      <p className="empty-state-title">{title}</p>
      <p className="empty-state-description">{description}</p>
      {action && <div>{action}</div>}
    </motion.div>
  )
}

// ─── LoadingState ──────────────────────────────────────────────────────────────

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 52, opacity: 1 - i * 0.18, borderRadius: 10 }}
        />
      ))}
    </div>
  )
}

// ─── RiskBadge ─────────────────────────────────────────────────────────────────

export function RiskBadge({ level }: { level: RiskLevel }) {
  const labels: Record<RiskLevel, string> = {
    CRITICAL: 'Critical',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
    UNKNOWN: 'Unknown',
  }
  return (
    <span className={`risk-badge risk-badge-${riskLevelClass(level)}`}>
      <span style={{
        width: 5, height: 5,
        borderRadius: '50%',
        background: 'currentColor',
        display: 'inline-block',
        flexShrink: 0,
      }} />
      {labels[level]}
    </span>
  )
}

// ─── StatusBadge ───────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const labels: Record<ProjectStatus, string> = {
    DRAFT: 'Draft',
    UNDER_REVIEW: 'Under Review',
    APPROVED: 'Approved',
    ACTIVE: 'Active',
    DELAYED: 'Delayed',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    ON_HOLD: 'On Hold',
  }
  return (
    <span className={`badge ${statusBadgeClass(status)}`}>
      {labels[status]}
    </span>
  )
}

// ─── DataNotice ────────────────────────────────────────────────────────────────

export function DataNotice() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 18px',
        background: 'rgba(64,128,255,0.05)',
        border: '1px solid rgba(64,128,255,0.15)',
        borderRadius: 'var(--radius-xl)',
        marginBottom: 24,
        fontSize: '0.875rem',
      }}
    >
      <div style={{
        width: 32, height: 32,
        borderRadius: 8,
        background: 'rgba(64,128,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: '1rem',
      }}>
        📡
      </div>
      <div>
        <strong style={{ color: '#eef2ff', fontWeight: 700, display: 'block', marginBottom: 4 }}>
          Waiting for Data
        </strong>
        <p style={{ margin: 0, color: '#4a5880', lineHeight: 1.6, fontSize: '0.85rem' }}>
          Add a data source to start. Results will appear when data is ready.
        </p>
      </div>
    </motion.div>
  )
}

// ─── MetricCard ────────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: string | number | null
  icon?: React.ReactNode
  accent?: string
  description?: string
  isLoading?: boolean
}

export function MetricCard({ label, value, icon, accent, description, isLoading }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="metric-card"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
    >
      {/* Top accent bar */}
      {accent && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 2,
          background: accent,
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
          opacity: 0.8,
        }} />
      )}

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 8,
      }}>
        <span className="metric-label" style={{ lineHeight: 1.4, flex: 1, minWidth: 0 }}>
          {label}
        </span>
        {icon && (
          <div style={{
            width: 34, height: 34,
            borderRadius: 10,
            background: accent ? `${accent}14` : 'rgba(64,128,255,0.08)',
            border: `1px solid ${accent ? `${accent}22` : 'rgba(64,128,255,0.12)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accent ?? 'rgba(64,128,255,0.7)',
            flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="skeleton" style={{ height: 38, width: 90, marginBottom: 6, borderRadius: 8 }} />
      ) : (
        <div className="metric-value" style={{ color: accent ?? '#eef2ff' }}>
          {value === null || value === undefined ? '—' : value}
        </div>
      )}

      {description && (
        <p style={{
          fontSize: '0.72rem',
          color: '#4a5880',
          margin: 0,
          marginTop: 5,
          lineHeight: 1.5,
        }}>
          {description}
        </p>
      )}
    </motion.div>
  )
}

// ─── PageHeader ────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-header-title">{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  )
}
