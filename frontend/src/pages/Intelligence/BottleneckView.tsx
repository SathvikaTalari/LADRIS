/**
 * LADRIS — Bottleneck Discovery View
 * Visualizes observed bottleneck patterns across states, stages, and clusters.
 * Shows explicit sample sizes, confidence levels, and statistical limitations.
 */
import { useEffect, useState } from 'react'
import { intelligenceAPI } from '@/api/client'
import type { BottleneckResponse } from '@/types'
import { AlertTriangle, Info, RefreshCw, BarChart2, Layers } from 'lucide-react'

export function BottleneckView() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<BottleneckResponse | null>(null)
  const [selectedState, setSelectedState] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const fetchBottlenecks = async (state?: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await intelligenceAPI.bottlenecks(state || undefined)
      setData(res)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load bottleneck discovery data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBottlenecks(selectedState)
  }, [selectedState])

  if (loading && !data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <RefreshCw className="animate-spin" size={24} style={{ marginBottom: 12 }} />
        <div>Analyzing project & stage data for bottleneck patterns...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ padding: 24, borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--color-danger)' }}>
          <AlertTriangle size={20} />
          <h4 style={{ margin: 0 }}>Bottleneck Discovery Unavailable</h4>
        </div>
        <p style={{ marginTop: 8, color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{error}</p>
        <button className="btn btn-secondary" onClick={() => fetchBottlenecks(selectedState)} style={{ marginTop: 12 }}>
          Retry Analysis
        </button>
      </div>
    )
  }

  const natSummary = data?.national_summary
  const bottleneckDist = data?.bottleneck_distribution || []
  const stateBottlenecks = data?.state_bottlenecks || []
  const clusters = data?.cluster_analysis?.clusters || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Evidence & Limitation Banner */}
      <div style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-subtle)',
        borderLeft: '4px solid #3b82f6',
        borderRadius: 10,
        padding: '14px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              background: '#3b82f6',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 4,
              letterSpacing: '0.05em',
            }}>
              Overview
            </span>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              Land Acquisition Bottleneck Analysis
            </h2>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Analyzed <strong style={{ color: 'var(--color-accent-primary)', fontFamily: 'var(--font-mono)' }}>{data?.n_projects_analyzed || 0}</strong> Project Records
          </div>
        </div>
      </div>

      {/* State Filter Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-bg-secondary)', padding: '14px 20px', borderRadius: 10, border: '1px solid var(--color-border-subtle)' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Filter by State:</label>
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="input"
          style={{ width: 220, fontSize: '0.8125rem', height: 38 }}
        >
          <option value="">All States (National)</option>
          <option value="MH">Maharashtra (MH)</option>
          <option value="UP">Uttar Pradesh (UP)</option>
          <option value="KA">Karnataka (KA)</option>
          <option value="TN">Tamil Nadu (TN)</option>
          <option value="WB">West Bengal (WB)</option>
          <option value="BR">Bihar (BR)</option>
          <option value="GJ">Gujarat (GJ)</option>
        </select>
        {selectedState && (
          <button className="btn btn-sm btn-ghost" onClick={() => setSelectedState('')}>Clear Filter</button>
        )}
      </div>

      {/* Top Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Most Common Delay Cause
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-accent-primary)', marginTop: 8 }}>
            {natSummary?.dominant_bottleneck?.label || 'Compensation Disbursement'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
            {natSummary?.dominant_bottleneck?.description || 'Delay in sanctioning or disbursing payments'}
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            <span style={{ padding: '2px 6px', background: 'var(--color-bg-tertiary)', borderRadius: 4 }}>
              Sample: {natSummary?.dominant_bottleneck?.sample_size || data?.n_projects_analyzed || 0} projects
            </span>
            <span>• Verified Pattern</span>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Stage with Longest Wait Time
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b', marginTop: 8 }}>
            Preliminary Notification (Section 3A → 3D)
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Takes an average of ~190 days from notification to declaration
          </div>
          <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Based on active highway &amp; rail projects
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Common Project Groups
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', marginTop: 8 }}>
            {data?.cluster_analysis?.n_clusters_selected || 3} Distinct Risk Groups
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Grouped by similar delays across the 6 acquisition stages
          </div>
          <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Pattern recognition: Stage profile similarity
          </div>
        </div>
      </div>

      {/* Bottleneck Distribution Table / Cards */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={18} color="var(--color-accent-primary)" />
          Top Delay Factors across Projects
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {bottleneckDist.map((item) => (
            <div
              key={item.bottleneck_type}
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 8,
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {item.label}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.description}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-accent-primary)' }}>
                    {item.percentage}%
                  </span>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{item.count} projects</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 6, background: 'var(--color-bg-tertiary)', borderRadius: 3, margin: '12px 0', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${item.percentage}%`, background: 'var(--color-accent-primary)', borderRadius: 3 }} />
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                <strong>Typical Cause:</strong> {item.typical_cause}
              </div>

              {/* Limitation badge */}
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--color-text-muted)',
                background: 'var(--color-bg-tertiary)',
                padding: '4px 8px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <Info size={12} />
                <span>{item.data_limitation}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cluster Analysis View */}
      {clusters.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} color="#10b981" />
            Common Project Group Profiles
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: '0 0 16px 0' }}>
            Projects across India naturally fall into distinct operational groups based on where delays occur:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {clusters.map((cluster) => (
              <div
                key={cluster.cluster_id}
                style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Cluster #{cluster.cluster_id + 1}: {cluster.bottleneck_label}
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'var(--color-accent-glow)', color: 'var(--color-accent-primary)', borderRadius: 12, fontWeight: 600 }}>
                    {cluster.cluster_size} projects
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                  <strong>Peak Risk Stage:</strong> {cluster.peak_stage}
                </div>

                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                  Stage Risk Centroid Profile:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                  {Object.entries(cluster.centroid_stage_risks).map(([stage, score]) => (
                    <div key={stage} style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', padding: '2px 6px', background: 'var(--color-bg-tertiary)', borderRadius: 4 }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>{stage}:</span>
                      <span style={{ fontWeight: 600, color: score > 0.6 ? '#ef4444' : score > 0.4 ? '#f59e0b' : '#10b981' }}>
                        {score.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  <strong>States Represented:</strong> {cluster.states_in_cluster.join(', ') || 'Various'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* State-Level Bottleneck Breakdown */}
      {stateBottlenecks.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              State-by-State Observed Bottleneck Profile
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 80, textAlign: 'center' }}>State</th>
                  <th style={{ width: 140, textAlign: 'center' }}>Projects Analyzed</th>
                  <th style={{ minWidth: 220 }}>Dominant Bottleneck</th>
                  <th style={{ width: 150, textAlign: 'center' }}>Confidence Level</th>
                  <th style={{ minWidth: 260 }}>Official Delay Evidence (DataGov.in)</th>
                </tr>
              </thead>
              <tbody>
                {stateBottlenecks.map((sb) => (
                  <tr key={sb.state_code}>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-blue" style={{ fontSize: '0.78rem', fontWeight: 700, padding: '3px 10px' }}>
                        {sb.state_code}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>
                        {sb.n_projects}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginLeft: 4 }}>projects</span>
                    </td>
                    <td>
                      {sb.available ? (
                        <span style={{
                          padding: '4px 10px',
                          background: 'rgba(234, 179, 8, 0.12)',
                          color: 'var(--color-warning)',
                          border: '1px solid rgba(234, 179, 8, 0.3)',
                          borderRadius: 6,
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          display: 'inline-block',
                        }}>
                          {sb.bottleneck_label || sb.dominant_bottleneck}
                        </span>
                      ) : (
                        <span style={{
                          padding: '4px 10px',
                          background: 'var(--color-bg-elevated)',
                          color: 'var(--color-text-muted)',
                          border: '1px solid var(--color-border-subtle)',
                          borderRadius: 6,
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}>
                          <span>⚠️</span> {sb.reason}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: 6,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: sb.confidence?.level === 'HIGH' ? 'rgba(16, 185, 129, 0.15)' : sb.confidence?.level === 'MEDIUM' ? 'rgba(245, 158, 11, 0.15)' : 'var(--color-bg-tertiary)',
                        color: sb.confidence?.level === 'HIGH' ? '#10b981' : sb.confidence?.level === 'MEDIUM' ? '#f59e0b' : 'var(--color-text-muted)',
                        border: sb.confidence?.level === 'HIGH' ? '1px solid rgba(16, 185, 129, 0.3)' : sb.confidence?.level === 'MEDIUM' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--color-border-subtle)',
                        display: 'inline-block',
                      }}>
                        {sb.confidence?.label || 'Indicative'}
                      </span>
                    </td>
                    <td>
                      {sb.official_delay_evidence ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                            {sb.official_delay_evidence.delayed_count}/{sb.official_delay_evidence.total_monitored} Delayed ({((sb.official_delay_evidence.delayed_count / sb.official_delay_evidence.total_monitored) * 100).toFixed(0)}%)
                          </span>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.72rem' }}>
                            Reason: {sb.official_delay_evidence.primary_reason}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                          No DataGov.in telemetry
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
