/**
 * LADRIS — Data Sources & Provenance Registry Page
 * 
 * Simplified, officer-friendly registry:
 * 1. Data Source Overview: 6 cards for Project Records, Compensation, Legal & Ownership, R&R, GIS, and Administrative Data.
 *    Shows only Available / Partial / Missing, Record Count, and Last Updated.
 * 2. Project Data Coverage: Category completeness for any selected project.
 * 3. Recent Ingestion Jobs & Provenance: Undisturbed ingestion run history with source type, status, tallies, and error reports.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Download } from 'lucide-react'
import { dataSourcesAPI, ingestionAPI } from '@/api/client'
import type { IngestionJobItem, DataSourceOverviewCard, ProjectCoverageItem } from '@/api/client'
import { PageHeader, EmptyState } from '@/components/common'

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    IMPORTED: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', label: 'Imported' },
    VALIDATING: { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', label: 'Validating' },
    NEEDS_REVIEW: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', label: 'Needs Review' },
    UPLOADED: { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7', label: 'Uploaded' },
    FAILED: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', label: 'Failed' },
  }
  const s = map[status] || { bg: 'rgba(255,255,255,0.1)', text: 'inherit', label: status }
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 600, background: s.bg, color: s.text, padding: '3px 8px', borderRadius: 4 }}>
      {s.label}
    </span>
  )
}

function CoverageStatusBadge({ status }: { status: 'Available' | 'Partial' | 'Missing' }) {
  const cfg = {
    Available: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' },
    Partial: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', text: '#f59e0b' },
    Missing: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444' },
  }[status] || { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)', text: 'var(--color-text-secondary)' }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: '0.72rem',
        fontWeight: 700,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.text,
        padding: '2px 8px',
        borderRadius: 12,
        letterSpacing: '0.02em',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.text }} />
      {status}
    </span>
  )
}

export default function DataSources() {
  const [overviewCards, setOverviewCards] = useState<DataSourceOverviewCard[]>([])
  const [projectsCoverage, setProjectsCoverage] = useState<ProjectCoverageItem[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)

  const [history, setHistory] = useState<IngestionJobItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const loadOverview = () => {
    setOverviewLoading(true)
    setOverviewError(null)
    dataSourcesAPI.overview()
      .then((res) => {
        setOverviewCards(res.overview_cards || [])
        const projs = res.projects || []
        setProjectsCoverage(projs)
        if (projs.length > 0 && !selectedProjectId) {
          setSelectedProjectId(projs[0].id)
        }
      })
      .catch((err) => {
        console.error('Failed to load data sources overview:', err)
        setOverviewError('Could not load data source overview.')
      })
      .finally(() => setOverviewLoading(false))
  }

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await ingestionAPI.history({ limit: 15 })
      setHistory(res.jobs || [])
    } catch (e) {
      console.error('Failed to load history', e)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    loadOverview()
    loadHistory()
  }, [])

  const currentProjectCoverage = projectsCoverage.find((p) => p.id === selectedProjectId) || projectsCoverage[0]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ paddingBottom: 60, width: '100%' }}>
      <PageHeader
        title="Data Sources & Provenance"
        subtitle="Overview of verified data categories, project coverage completeness, and recent ingestion history."
        actions={
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              loadOverview()
              loadHistory()
            }}
          >
            <RefreshCw size={14} className={overviewLoading || historyLoading ? 'spin' : ''} /> Refresh
          </button>
        }
      />

      {/* ─── 1. Simple Data Source Overview (6 Cards) ─── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Data Source Overview
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
            Current availability, verified record tallies, and latest updates across core acquisition data categories.
          </p>
        </div>

        {overviewLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />
            ))}
          </div>
        ) : overviewError ? (
          <EmptyState
            title="Error Loading Data Source Overview"
            description={overviewError}
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 14,
            }}
          >
            {overviewCards.map((card) => (
              <div
                key={card.id}
                className="card"
                style={{
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 110,
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {card.name}
                  </span>
                  <CoverageStatusBadge status={card.status} />
                </div>

                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
                    {card.record_count}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Last Updated: {card.last_updated}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── 2. Project Data Coverage View ─── */}
      <div
        className="card"
        style={{
          padding: '20px 22px',
          marginBottom: 28,
          background: 'var(--color-bg-card)',
          borderRadius: 12,
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            marginBottom: 18,
            borderBottom: '1px solid var(--color-border-subtle)',
            paddingBottom: 14,
          }}
        >
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              Project Data Coverage
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
              Inspect data category availability and completeness for any monitored project.
            </p>
          </div>

          {/* Project Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label htmlFor="coverage-project-select" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
              PROJECT:
            </label>
            <select
              id="coverage-project-select"
              className="input"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{
                minWidth: 260,
                maxWidth: 420,
                height: 36,
                fontSize: '0.8rem',
                fontWeight: 600,
                background: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border-strong)',
              }}
            >
              {projectsCoverage.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_code} — {p.name} ({p.risk_level})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 6 Category Items for Selected Project */}
        {currentProjectCoverage ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            {currentProjectCoverage.categories.map((cat) => (
              <div
                key={cat.id}
                style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <strong style={{ fontSize: '0.82rem', color: 'var(--color-text-primary)' }}>
                    {cat.name}
                  </strong>
                  <CoverageStatusBadge status={cat.status} />
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {cat.detail}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px 0' }}>
            No project data available.
          </div>
        )}
      </div>

      {/* ─── 3. Recent Ingestion Jobs & Provenance Table (Undisturbed) ─── */}
      <div className="card" style={{ padding: '22px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              Recent Ingestion Jobs &amp; Provenance
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              Trace source metadata, record tallies, validation outcomes, and error reports from ingestion runs.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 6 }}>
              {history.length} Ingestion Runs
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={loadHistory}
              title="Refresh Ingestion Jobs"
              style={{ padding: '4px 8px' }}
            >
              <RefreshCw size={13} className={historyLoading ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {history.length === 0 ? (
          <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            No ingestion jobs recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '10px 12px' }}>Source / File</th>
                  <th style={{ padding: '10px 12px' }}>Type</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Total</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Imported</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Duplicates</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Rejected</th>
                  <th style={{ padding: '10px 12px' }}>Time</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((job) => (
                  <tr key={job.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {job.source_name || job.source_file_name || 'Ingestion Job'}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '3px 8px', borderRadius: 4 }}>
                        {job.job_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <StatusPill status={job.status} />
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'center' }}>{job.total_records}</td>
                    <td style={{ padding: '12px 12px', textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{job.imported_records}</td>
                    <td style={{ padding: '12px 12px', textAlign: 'center', color: '#f59e0b' }}>{job.duplicate_records}</td>
                    <td style={{ padding: '12px 12px', textAlign: 'center', color: job.invalid_records > 0 ? '#ef4444' : 'inherit' }}>{job.invalid_records}</td>
                    <td style={{ padding: '12px 12px', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
                      {new Date(job.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                      {job.invalid_records > 0 || (job.error_summary && job.error_summary.length > 0) ? (
                        <a
                          href={ingestionAPI.errorReportUrl(job.id)}
                          download
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#f87171' }}
                        >
                          <Download size={12} />
                          Errors CSV
                        </a>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  )
}
