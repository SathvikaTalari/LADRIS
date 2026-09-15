/**
 * LADRIS — Data Sources & Provenance Registry Page
 * Registry of official, verified public datasets with lineage, retrieval metadata, and classification status.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Database, ExternalLink, RefreshCw } from 'lucide-react'
import { dataSourcesAPI } from '@/api/client'
import type { DataSourceItem } from '@/types'
import { PageHeader, EmptyState } from '@/components/common'

export default function DataSources() {
  const [sources, setSources] = useState<DataSourceItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSources = () => {
    setIsLoading(true)
    setError(null)
    dataSourcesAPI.list()
      .then((res) => setSources(res.data_sources))
      .catch(() => setError('Could not load data sources.'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    fetchSources()
  }, [])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <PageHeader
        title="DATA TRUST & PROVENANCE"
        subtitle="Manage official government data and check its source."
        actions={
          <button className="btn btn-secondary btn-sm" onClick={fetchSources}>
            <RefreshCw size={14} /> Refresh Registry
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
          title="Error Loading Registry"
          description={error}
        />
      ) : sources.length === 0 ? (
        <EmptyState
          icon={<Database size={28} />}
          title="No Data Sources Registered"
          description="Add data sources to view them here."
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Dataset Name</th>
                <th>Organization</th>
                <th>Classification</th>
                <th>Format</th>
                <th>Records</th>
                <th>Fields Obtained</th>
                <th>Retrieval Date</th>
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
    </motion.div>
  )
}
