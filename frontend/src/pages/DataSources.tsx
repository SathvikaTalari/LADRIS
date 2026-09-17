/**
 * LADRIS — Data Sources & Provenance Registry Page
 * Registry of official, verified public datasets with lineage, retrieval metadata, and classification status.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Database, ExternalLink, RefreshCw, Download } from 'lucide-react'
import { dataSourcesAPI, ingestionAPI } from '@/api/client'
import type { IngestionJobItem } from '@/api/client'
import type { DataSourceItem } from '@/types'
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

export default function DataSources() {
  const [sources, setSources] = useState<DataSourceItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<IngestionJobItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const fetchSources = () => {
    setIsLoading(true)
    setError(null)
    dataSourcesAPI.list()
      .then((res) => setSources(res.data_sources))
      .catch(() => setError('Could not load data sources.'))
      .finally(() => setIsLoading(false))
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
    fetchSources()
    loadHistory()
  }, [])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ paddingBottom: 60 }}>
      <PageHeader
        title="Official Data Sources"
        subtitle="Browse verified government project records and data feeds used for delay predictions."
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => { fetchSources(); loadHistory(); }}>
            <RefreshCw size={14} className={isLoading || historyLoading ? 'spin' : ''} /> Refresh Sources
          </button>
        }
      />

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 80 }} />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<Database size={28} />}
          title="Error Loading Data Sources"
          description={error}
        />
      ) : sources.length === 0 ? (
        <EmptyState
          icon={<Database size={28} />}
          title="No Data Sources Found"
          description="No active project data sources were detected in the database."
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 32 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Dataset Name</th>
                <th>Source Agency / Department</th>
                <th>Status</th>
                <th>File Type</th>
                <th>Projects Count</th>
                <th>Information Included</th>
                <th>Last Synced</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((ds) => (
                <tr key={ds.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Database size={16} color="var(--color-accent-primary)" />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{ds.dataset_name}</div>
                        {ds.source_url && (
                          <a
                            href={ds.source_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: '0.75rem', color: 'var(--color-accent-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            Source Link <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{ds.source_organization}</td>
                  <td>
                    <span className="badge badge-green">
                      {ds.data_status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{ds.file_format || 'CSV'}</td>
                  <td style={{ fontWeight: 600 }}>{ds.record_count?.toLocaleString('en-IN') ?? 0}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 260 }}>
                      {(ds.fields_obtained || []).slice(0, 4).map((f) => (
                        <span key={f} className="badge badge-gray" style={{ fontSize: '0.65rem' }}>
                          {f}
                        </span>
                      ))}
                      {(ds.fields_obtained || []).length > 4 && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                          +{(ds.fields_obtained || []).length - 4} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {ds.retrieval_date ? new Date(ds.retrieval_date).toLocaleDateString('en-IN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Ingestion Jobs & Provenance Table moved to Data Sources */}
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
