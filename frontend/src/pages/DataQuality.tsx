/**
 * LADRIS — Data Quality Dashboard
 * Displays real-time data quality metrics, null rates, duplicate rates, and prediction eligibility
 * calculated strictly from actual ingested datasets.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, CheckCircle2, AlertOctagon, Layers, FileSpreadsheet, ShieldCheck } from 'lucide-react'
import { dataQualityAPI } from '@/api/client'
import type { DataQualityMetrics } from '@/types'
import { PageHeader, EmptyState } from '@/components/common'

export default function DataQuality() {
  const [metrics, setMetrics] = useState<DataQualityMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dataQualityAPI.get()
      .then(setMetrics)
      .catch(() => setError('Failed to fetch data quality metrics.'))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 100 }} />
        ))}
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <EmptyState
        icon={<Activity size={28} />}
        title="Data Quality Dashboard Unavailable"
        description={error ?? 'Could not load data quality metrics.'}
      />
    )
  }

  const { summary, field_null_rates, sources } = metrics
  const completeness = Math.max(0, 100 - summary.missing_value_rate * 100)
  const consistency = summary.total_real_records
    ? (summary.valid_records / summary.total_real_records) * 100
    : null
  const generatedAt = summary.generated_at
    ? new Date(summary.generated_at).toLocaleString('en-IN')
    : 'Unavailable'

  const friendlyFieldNames: Record<string, string> = {
    project_code: 'Project Code',
    name: 'Project Name',
    state_code: 'State',
    district: 'District',
    project_type: 'Project Sector / Type',
    land_area_ha: 'Land Area (Hectares)',
    total_cost_cr: 'Total Budget (₹ Cr)',
    stage: 'Current Stage',
    status: 'Project Status',
    compensation_disbursement_ratio: 'Compensation Paid Ratio',
    rehabilitation_progress_pct: 'Rehabilitation & Resettlement Progress (%)',
    pending_court_cases: 'Pending Court Cases',
    forest_clearance_status: 'Forest Clearance Status',
    possession_status_pct: 'Physical Possession Progress (%)',
    section_4_date: 'Section 4 Notification Date',
    section_11_date: 'Section 11 Preliminary Date',
    section_19_date: 'Section 19 Declaration Date',
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <PageHeader
        title="Data Quality & Health"
        subtitle="Monitor information completeness, data accuracy, and project readiness for AI delay predictions."
      />

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24, width: '100%' }}>
        <KpiCard
          icon={<FileSpreadsheet size={18} color="var(--color-accent-primary)" />}
          label="Total Projects Recorded"
          value={summary.total_real_records.toLocaleString('en-IN')}
          subtitle="Verified in Database"
        />
        <KpiCard
          icon={<CheckCircle2 size={18} color="var(--color-status-success)" />}
          label="Complete Profiles"
          value={summary.valid_records.toLocaleString('en-IN')}
          subtitle={`${((summary.valid_records / Math.max(1, summary.total_real_records)) * 100).toFixed(1)}% Ready for Analysis`}
        />
        <KpiCard
          icon={<AlertOctagon size={18} color="var(--color-status-warning)" />}
          label="Missing Details Rate"
          value={`${(summary.missing_value_rate * 100).toFixed(1)}%`}
          subtitle="Across all project fields"
        />
        <KpiCard
          icon={<Layers size={18} color="var(--color-status-info)" />}
          label="Ready for AI Predictions"
          value={summary.prediction_eligible_records.toLocaleString('en-IN')}
          subtitle="Meets required criteria"
        />
      </div>

      <div className="grid-3" style={{ gap: 20 }}>
        {/* Data Trust & Provenance */}
        <div className="card" style={{ border: '1px solid rgba(46, 213, 115, 0.4)', background: 'rgba(46, 213, 115, 0.03)' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <ShieldCheck size={18} /> Data Reliability Score
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid rgba(46, 213, 115, 0.2)', paddingBottom: 14 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Overall Quality Score</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16a34a', fontFamily: 'var(--font-mono)' }}>{completeness.toFixed(0)}<span style={{ fontSize: '1rem', color: 'rgba(22, 163, 74, 0.6)' }}>/100</span></span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.8rem', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Field Completeness</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{completeness.toFixed(1)}%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Data Freshness</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>Active Sync</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Record Validity</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{consistency === null ? 'Unavailable' : `${consistency.toFixed(1)}%`}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Source Status</span>
              <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>{sources.length ? 'Verified & Active' : 'Unavailable'}</span>
            </div>
          </div>
          
          <div style={{ paddingTop: 14, borderTop: '1px solid rgba(46, 213, 115, 0.2)', display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Primary Dataset:</span>
              <strong style={{ color: 'var(--color-text-primary)', textAlign: 'right' }}>{sources.map((source) => source.name).join(', ') || 'Projects Registry'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Last Synced:</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{generatedAt}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Total Records:</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{summary.total_real_records.toLocaleString('en-IN')}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Average Missing Data:</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{(summary.missing_value_rate * 100).toFixed(1)}%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Ready for Prediction:</span>
              <strong style={{ color: '#2563eb' }}>{summary.prediction_eligible_records.toLocaleString('en-IN')}</strong>
            </div>
          </div>
        </div>
        {/* Field Null Rates */}
        <div className="card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 16 }}>
            Missing Information by Field
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(field_null_rates).map(([field, rate]) => (
              <div key={field}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 4 }}>
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    {friendlyFieldNames[field] || field.replace(/_/g, ' ')}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{(rate * 100).toFixed(1)}% missing</span>
                </div>
                <div style={{ height: 6, background: 'var(--color-bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.max(2, rate * 100)}%`,
                    background: rate > 0.1 ? 'var(--color-status-warning)' : 'var(--color-accent-primary)',
                    borderRadius: 3,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Source Coverage */}
        <div className="card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 16 }}>
            Data Sources & Records Tracked
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sources.map((src, i) => (
              <div key={i} style={{
                padding: '12px 14px',
                background: 'var(--color-bg-elevated)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
                    {src.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Official Public Source
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{src.records}</div>
                  <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>{src.quality || 'Ingested'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function KpiCard({ icon, label, value, subtitle }: { icon: React.ReactNode; label: string; value: string; subtitle: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
        {subtitle}
      </div>
    </div>
  )
}
