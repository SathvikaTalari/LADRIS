import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, AlertTriangle, ChevronRight } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/common'
import { projectsAPI } from '@/api/client'
import ReactECharts from 'echarts-for-react'
import { Link } from 'react-router-dom'
import { RiskBadge, StatusBadge } from '@/components/common'

export default function Analytics() {
  const [districtData, setDistrictData] = useState<any[] | null>(null)
  const [selectedState, setSelectedState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    projectsAPI.list({ page_size: 100 })
      .then(res => {
        const items = res.items || []
        
        // Group by state
        const stateMap: Record<string, any[]> = {}
        items.forEach(p => {
          const s = p.state_code || 'OTHER'
          if (!stateMap[s]) stateMap[s] = []
          stateMap[s].push(p)
        })

        const rows = Object.entries(stateMap).map(([state, projs]) => {
          const highRiskCount = projs.filter(p => p.risk_level === 'HIGH' || p.risk_level === 'CRITICAL').length
          return {
            state_code: state,
            project_count: projs.length,
            high_risk_count: highRiskCount,
            projects: projs,
            sample_size_note: projs.length < 5 ? `Sample: ${projs.length} project(s) (small sample)` : `Sample: ${projs.length} project(s)`,
            sufficient_sample: projs.length >= 3,
          }
        })
        setDistrictData(rows)
        if (rows.length > 0) setSelectedState(rows[0].state_code)
      })
      .catch(() => setDistrictData([]))
      .finally(() => setIsLoading(false))
  }, [])

  const selectedGroup = districtData?.find(d => d.state_code === selectedState)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ width: '100%' }}>
      <PageHeader
        title="Land Acquisition & District Intelligence Analytics"
        subtitle="Compare project performance across districts and states."
      />

      {/* ── PHASE 4 DISTRICT INTELLIGENCE SECTION ──────────────────────── */}
      <div className="card" style={{ marginBottom: 20, border: '1px solid rgba(61,126,245,0.3)', background: 'var(--color-bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Building2 size={20} color="var(--color-accent-primary)" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>District & State Intelligence</h3>
          <span className="badge badge-blue" style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>Sample-Size Verified</span>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          This section shows project data for each district. Sample sizes are shown to help you understand the data.
        </p>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-text-muted)' }}>Loading district signals...</div>
        ) : districtData && districtData.length > 0 ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20, marginBottom: 20, width: '100%' }}>
              {/* State project density chart */}
              <div style={{ background: 'var(--color-bg-secondary)', padding: 14, borderRadius: 8, border: '1px solid var(--color-border-subtle)', minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Project Density by State
                </div>
                <ReactECharts
                  style={{ height: 240, width: '100%' }}
                  opts={{ renderer: 'canvas' }}
                  notMerge={true}
                  onEvents={{
                    click: (params: any) => {
                      if (params.name) setSelectedState(params.name)
                    }
                  }}
                  option={{
                    backgroundColor: 'transparent',
                    tooltip: { trigger: 'axis', confine: true },
                    grid: { top: 20, bottom: 30, left: 30, right: 10, containLabel: true },
                    xAxis: {
                      type: 'category',
                      data: districtData.map(d => d.state_code),
                      axisLabel: { color: '#8b95a8', fontSize: 11 },
                      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
                    },
                    yAxis: {
                      type: 'value',
                      axisLabel: { color: '#8b95a8', fontSize: 11 },
                      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
                    },
                    series: [{
                      type: 'bar',
                      data: districtData.map(d => d.project_count),
                      itemStyle: { color: '#3d7ef5', borderRadius: [4, 4, 0, 0] },
                      barWidth: '40%',
                    }],
                  }}
                />
              </div>

              {/* District Sample Table */}
              <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 8, border: '1px solid var(--color-border-subtle)', overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border-subtle)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  State Sample Size Summary
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 230, flex: 1 }}>
                  <table className="data-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'center', width: 70 }}>State</th>
                        <th style={{ textAlign: 'center' }}>Sample Size</th>
                        <th style={{ textAlign: 'center' }}>High Anomaly</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {districtData.map((d, i) => (
                        <tr 
                          key={i} 
                          onClick={() => setSelectedState(d.state_code)}
                          style={{
                            cursor: 'pointer',
                            background: selectedState === d.state_code ? 'var(--color-bg-elevated)' : 'transparent',
                            borderLeft: selectedState === d.state_code ? '3px solid var(--color-accent-primary)' : '3px solid transparent',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-blue" style={{ fontSize: '0.72rem', fontWeight: 700 }}>{d.state_code}</span>
                          </td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{d.project_count} project(s)</td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: d.high_risk_count > 0 ? '#ef4444' : 'var(--color-text-muted)', fontWeight: 700 }}>{d.high_risk_count}</td>
                          <td style={{ textAlign: 'center' }}>
                            {d.sufficient_sample
                              ? <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>Sample Sufficient</span>
                              : <span className="badge badge-yellow" style={{ fontSize: '0.65rem' }}>Small Sample (&lt;3)</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Drilldown view for selected State */}
            {selectedGroup && (
              <div style={{
                background: 'var(--color-bg-secondary)',
                padding: 18,
                borderRadius: 10,
                border: '1px solid var(--color-border-subtle)',
                marginTop: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="badge badge-blue" style={{ fontSize: '0.8rem', fontWeight: 800 }}>
                      {selectedGroup.state_code}
                    </span>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      Projects Drilldown ({selectedGroup.projects.length} Projects)
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-bg-tertiary)', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--color-border-subtle)' }}>
                    {selectedGroup.sample_size_note}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedGroup.projects.map((p: any) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '12px 16px',
                        background: 'var(--color-bg-elevated)',
                        borderRadius: 8,
                        border: '1px solid var(--color-border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <code style={{ fontSize: '0.72rem', color: 'var(--color-accent-primary)', background: 'var(--color-accent-glow)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>
                            {p.project_code}
                          </code>
                          <StatusBadge status={p.status} />
                        </div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <RiskBadge level={p.risk_level} />
                        <Link
                          to={`/projects/${p.id}`}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          Inspect Project <ChevronRight size={12} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} color="#eab308" style={{ flexShrink: 0 }} />
              <span>
                <strong>Note on Sample Size:</strong> Small sample sizes may be limited. Risk scores reflect available verified project data.
              </span>
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Building2 size={28} />}
            title="No District Records Found"
            description="District data will appear here as projects are added."
          />
        )}
      </div>
    </motion.div>
  )
}
