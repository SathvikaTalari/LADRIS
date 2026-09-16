/**
 * LADRIS — Government Decision Intelligence Command Center (Phase 7)
 * High-value decision intelligence platform view combining:
 * 1. Cross-Project Priority Queue & Resource Allocation Simulator
 * 2. Statistical Bottleneck Discovery Engine
 * 3. Project Risk DNA, Temporal Observation Timeline, & Comparable Projects Benchmarking
 */
import { useEffect, useState } from 'react'
import { intelligenceAPI, projectsAPI } from '@/api/client'
import type {
  PriorityQueueResponse,
  ResourceScenarioResponse,
  RiskDNAResponse,
  ComparableProjectsResponse,
  ProjectListItem,
} from '@/types'
import { BottleneckView } from './Intelligence/BottleneckView'
import {
  Brain,
  Layers,
  Activity,
  GitBranch,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

export default function Intelligence() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'priority'
  const targetProjectId = searchParams.get('projectId') || ''

  const setTab = (tab: string) => {
    setSearchParams({ tab, ...(targetProjectId ? { projectId: targetProjectId } : {}) })
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'linear-gradient(135deg, var(--color-accent-primary), #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Brain size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
                Government Decision Support Center
              </h1>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                Priority Watchlist • Bottleneck Discovery • Staff Simulator • Project Comparisons
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            fontSize: '0.75rem', padding: '6px 12px', background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-subtle)', borderRadius: 6, color: 'var(--color-text-secondary)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <CheckCircle2 size={14} color="#10b981" />
            <span>Real-time project delay forecasts</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex', gap: 8, borderBottom: '1px solid var(--color-border-subtle)', marginBottom: 24,
      }}>
        <button
          className={`btn ${activeTab === 'priority' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('priority')}
          style={{ borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Activity size={16} />
          Priority Watchlist
        </button>
        <button
          className={`btn ${activeTab === 'bottleneck' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('bottleneck')}
          style={{ borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Layers size={16} />
          Bottleneck Discovery
        </button>
        <button
          className={`btn ${activeTab === 'dna' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('dna')}
          style={{ borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <GitBranch size={16} />
          Project Risk Profile &amp; Comparison
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'priority' && <PriorityQueueTab />}
      {activeTab === 'bottleneck' && <BottleneckView />}
      {activeTab === 'dna' && <ProjectDNATab initialProjectId={targetProjectId} />}
    </div>
  )
}

// ─── TAB 1: Priority Queue & Constrained Resource Simulation ─────────────────

function PriorityQueueTab() {
  const [loading, setLoading] = useState(true)
  const [queueData, setQueueData] = useState<PriorityQueueResponse | null>(null)
  const [filterState, setFilterState] = useState('')
  const [filterAgency, setFilterAgency] = useState('')
  const [filterTier, setFilterTier] = useState('')

  // Scenario Simulator State
  const [showScenario, setShowScenario] = useState(false)
  const [legalCap, setLegalCap] = useState(3)
  const [compCap, setCompCap] = useState(2)
  const [rrCap, setRrCap] = useState(1)
  const [simLoading, setSimLoading] = useState(false)
  const [scenarioData, setScenarioData] = useState<ResourceScenarioResponse | null>(null)

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const res = await intelligenceAPI.priorityQueue({
        filter_state: filterState || undefined,
        filter_agency: filterAgency || undefined,
        filter_tier: filterTier || undefined,
      })
      setQueueData(res)
    } catch (err) {
      console.error('Failed to load priority queue', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQueue()
  }, [filterState, filterAgency, filterTier])

  const runSimulation = async () => {
    setSimLoading(true)
    try {
      const res = await intelligenceAPI.resourceScenario({
        capacity_constraints: {
          LEGAL: legalCap,
          COMPENSATION: compCap,
          RR: rrCap,
        },
        filter_state: filterState || undefined,
        filter_agency: filterAgency || undefined,
      })
      setScenarioData(res)
    } catch (err) {
      console.error('Simulation failed', err)
    } finally {
      setSimLoading(false)
    }
  }

  const queue = queueData?.queue || []
  const summary = queueData?.tier_summary || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Evidence & Decision Support Banner */}
      <div style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-subtle)',
        borderLeft: '4px solid #8b5cf6',
        borderRadius: 10,
        padding: '14px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: '#8b5cf6', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.05em' }}>
              Action Hub
            </span>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              Priority Watchlist &amp; Intervention Ranking
            </h2>
          </div>
          <button
            className={`btn btn-sm ${showScenario ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setShowScenario(!showScenario); if (!scenarioData) runSimulation(); }}
          >
            <Sliders size={14} style={{ marginRight: 6 }} />
            {showScenario ? 'Hide Staff Simulator' : 'Simulate Team Availability'}
          </button>
        </div>
      </div>

      {/* Resource Allocation Simulator (Collapsible) */}
      {showScenario && (
        <div className="card" style={{ padding: 20, borderColor: '#8b5cf6', background: 'rgba(139, 92, 246, 0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: '#ec4899', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
                What-If Tool
              </span>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Officer &amp; Team Allocation Simulator
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Test how allocating available staff across projects affects timelines
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                Available Legal Officers / Land Collectors:
              </label>
              <input
                type="number" min={0} max={20} className="input"
                value={legalCap} onChange={(e) => setLegalCap(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                Available Compensation Teams:
              </label>
              <input
                type="number" min={0} max={20} className="input"
                value={compCap} onChange={(e) => setCompCap(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                Available Rehabilitation (R&amp;R) Officers:
              </label>
              <input
                type="number" min={0} max={20} className="input"
                value={rrCap} onChange={(e) => setRrCap(parseInt(e.target.value) || 0)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-primary" onClick={runSimulation} disabled={simLoading} style={{ width: '100%' }}>
                {simLoading ? 'Simulating...' : 'Run Simulation'}
              </button>
            </div>
          </div>

          {scenarioData && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16, borderTop: '1px solid var(--color-border-subtle)', paddingTop: 16 }}>
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} />
                  Assigned Projects ({scenarioData.assigned_count})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {scenarioData.assigned_projects.map((proj) => (
                    <div key={proj.project_id} style={{ background: 'var(--color-bg-secondary)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--color-border-subtle)', fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{proj.project_code} — {proj.project_name}</div>
                      <div style={{ color: 'var(--color-accent-primary)', fontSize: '0.75rem', marginTop: 2 }}>
                        Assigned: {proj.assigned_resource_label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} />
                  Deferred / Queued Projects ({scenarioData.deferred_count})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {scenarioData.deferred_projects.map((proj) => (
                    <div key={proj.project_id} style={{ background: 'var(--color-bg-secondary)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--color-border-subtle)', fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{proj.project_code} — {proj.project_name}</div>
                      <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 2 }}>
                        {proj.deferral_reason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter & Summary Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        background: 'var(--color-bg-secondary)',
        padding: '14px 20px',
        borderRadius: 10,
        border: '1px solid var(--color-border-subtle)',
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="input"
            style={{ width: 140, fontSize: '0.8125rem', height: 38 }}
          >
            <option value="">All States</option>
            <option value="MH">MH</option>
            <option value="UP">UP</option>
            <option value="KA">KA</option>
            <option value="TN">TN</option>
            <option value="WB">WB</option>
            <option value="BR">BR</option>
          </select>

          <select
            value={filterAgency}
            onChange={(e) => setFilterAgency(e.target.value)}
            className="input"
            style={{ width: 140, fontSize: '0.8125rem', height: 38 }}
          >
            <option value="">All Agencies</option>
            <option value="NHAI">NHAI</option>
            <option value="NHIDCL">NHIDCL</option>
            <option value="STATE_PWD">State PWD</option>
          </select>

          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="input"
            style={{ width: 140, fontSize: '0.8125rem', height: 38 }}
          >
            <option value="">All Tiers</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, fontSize: '0.78rem' }}>
          <span style={{ padding: '4px 12px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontWeight: 700 }}>
            CRITICAL: {summary.CRITICAL || 0}
          </span>
          <span style={{ padding: '4px 12px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, fontWeight: 700 }}>
            HIGH: {summary.HIGH || 0}
          </span>
          <span style={{ padding: '4px 12px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, fontWeight: 700 }}>
            MEDIUM: {summary.MEDIUM || 0}
          </span>
          <span style={{ padding: '4px 12px', background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-subtle)', borderRadius: 6, fontWeight: 700 }}>
            LOW: {summary.LOW || 0}
          </span>
        </div>
      </div>

      {/* Priority Queue Data Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading Priority Queue...</div>
        ) : queue.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>No projects match current queue filters.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 60, textAlign: 'center' }}>Rank</th>
                  <th style={{ minWidth: 260 }}>Project</th>
                  <th style={{ width: 70, textAlign: 'center' }}>State</th>
                  <th style={{ width: 90, textAlign: 'center' }}>Agency</th>
                  <th style={{ width: 140 }}>Priority Score</th>
                  <th style={{ width: 120 }}>Risk Severity</th>
                  <th style={{ width: 160 }}>Dominant Bottleneck</th>
                  <th style={{ width: 180 }}>Recommended Resource</th>
                  <th style={{ width: 130, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr key={item.project_id}>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: item.rank <= 3 ? 'linear-gradient(135deg, var(--color-accent-primary), #6366f1)' : 'var(--color-bg-elevated)',
                        color: item.rank <= 3 ? '#ffffff' : 'var(--color-text-secondary)',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        boxShadow: item.rank <= 3 ? '0 2px 8px rgba(61,126,245,0.4)' : 'none',
                        border: '1px solid var(--color-border-subtle)',
                      }}>
                        {item.rank}
                      </span>
                    </td>
                    <td>
                      <code style={{
                        fontSize: '0.72rem',
                        color: 'var(--color-accent-primary)',
                        background: 'var(--color-accent-glow)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontFamily: 'var(--font-mono)',
                        display: 'inline-block',
                        marginBottom: 4,
                      }}>
                        {item.project_code}
                      </code>
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        lineHeight: 1.3,
                      }}>
                        {item.project_name}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-gray" style={{ fontSize: '0.7rem', fontWeight: 600 }}>
                        {item.state_code}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        background: 'var(--color-bg-tertiary)',
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: '1px solid var(--color-border-subtle)',
                      }}>
                        {item.executing_agency || 'NHAI'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: '1.05rem',
                          fontWeight: 800,
                          color: item.queue_tier === 'CRITICAL' ? '#ef4444' : item.queue_tier === 'HIGH' ? '#f59e0b' : '#3b82f6',
                          fontFamily: 'var(--font-mono)',
                        }}>
                          {item.composite_priority_score}
                        </span>
                        <span className={`risk-badge risk-badge-${item.queue_tier?.toLowerCase() || 'medium'}`} style={{ fontSize: '0.65rem' }}>
                          {item.queue_tier}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: item.risk_signals.effective_risk_severity > 0.6 ? '#ef4444' : '#f59e0b',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        {(item.risk_signals.effective_risk_severity * 100).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        Peak: {item.risk_signals.peak_risk_stage || 'N/A'}
                      </div>
                    </td>
                    <td>
                      {item.bottleneck_type ? (
                        <span style={{
                          padding: '3px 8px',
                          background: 'rgba(234, 179, 8, 0.12)',
                          color: 'var(--color-warning)',
                          border: '1px solid rgba(234, 179, 8, 0.3)',
                          borderRadius: 4,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}>
                          {item.bottleneck_type}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>General</span>
                      )}
                    </td>
                    <td>
                      {item.recommended_resource ? (
                        <span style={{
                          color: 'var(--color-accent-primary)',
                          background: 'var(--color-accent-glow)',
                          border: '1px solid rgba(61,126,245,0.2)',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}>
                          {item.recommended_resource.label}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Standard Team</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        to={`/intelligence?tab=dna&projectId=${item.project_id}`}
                        className="btn btn-sm btn-ghost"
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                      >
                        Inspect Risk DNA
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TAB 3: Project Risk DNA & Benchmarking ──────────────────────────────────

function ProjectDNATab({ initialProjectId }: { initialProjectId: string }) {
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId)
  const [loading, setLoading] = useState(false)
  const [dnaData, setDnaData] = useState<RiskDNAResponse | null>(null)
  const [comparablesData, setComparablesData] = useState<ComparableProjectsResponse | null>(null)

  useEffect(() => {
    projectsAPI.list({ page_size: 100 }).then((res) => {
      setProjects(res.items || [])
      if (!selectedProjectId && res.items?.length > 0) {
        setSelectedProjectId(res.items[0].id)
      }
    })
  }, [])

  const fetchDna = async (pid: string) => {
    if (!pid) return
    setLoading(true)
    try {
      const [dnaRes, compRes] = await Promise.all([
        intelligenceAPI.riskDna(pid),
        intelligenceAPI.comparableProjects(pid, 5),
      ])
      setDnaData(dnaRes)
      setComparablesData(compRes)
    } catch (err) {
      console.error('Failed to load project DNA', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      fetchDna(selectedProjectId)
    }
  }, [selectedProjectId])

  const dims = dnaData?.dimensions
  const temp = dnaData?.temporal

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Project Selector */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--color-bg-secondary)',
        padding: '14px 20px',
        borderRadius: 10,
        border: '1px solid var(--color-border-subtle)',
      }}>
        <Search size={18} color="var(--color-text-muted)" />
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)', flexShrink: 0 }}>Select Target Project:</label>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="input"
          style={{ width: 380, fontSize: '0.8125rem', height: 38 }}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_code} — {p.name} ({p.state_code})
            </option>
          ))}
        </select>
        {selectedProjectId && (
          <Link to={`/projects/${selectedProjectId}`} className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }}>
            <ExternalLink size={14} style={{ marginRight: 6 }} />
            Open Full Project Detail
          </Link>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading Risk DNA & Benchmarks...</div>
      ) : !dnaData ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Select a project to inspect its Risk DNA profile.</div>
      ) : (
        <>
          {/* Risk DNA Overview Header Card */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ background: 'var(--color-accent-primary)', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.05em' }}>
                    Profile
                  </span>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    Project Risk Profile
                  </h2>
                </div>
              </div>

              <div style={{ textAlign: 'right', background: 'var(--color-bg-secondary)', padding: '12px 20px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Overall Delay Risk Score
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: dnaData.dna_tier === 'CRITICAL' ? '#ef4444' : dnaData.dna_tier === 'HIGH' ? '#f59e0b' : '#3b82f6', fontFamily: 'var(--font-mono)' }}>
                  {(dnaData.dna_composite_score * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: dnaData.dna_tier === 'CRITICAL' ? '#ef4444' : '#f59e0b' }}>
                  Tier: {dnaData.dna_tier}
                </div>
              </div>
            </div>

            {/* 5 Key Project Dimensions Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 24 }}>
              {/* Dimension 1: Unusual Risk Indicators */}
              <div style={{ background: 'var(--color-bg-secondary)', padding: 16, borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6' }}>INDICATOR 1</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, margin: '4px 0', color: 'var(--color-text-primary)' }}>
                  Unusual Delay Risks
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
                  {((dims?.anomaly_signal?.score || 0) * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Level: <strong style={{ color: 'var(--color-warning)' }}>{dims?.anomaly_signal?.risk_level || 'Normal'}</strong>
                </div>
              </div>

              {/* Dimension 2: Stage Impact */}
              <div style={{ background: 'var(--color-bg-secondary)', padding: 16, borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8b5cf6' }}>INDICATOR 2</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, margin: '4px 0', color: 'var(--color-text-primary)' }}>
                  Stage Delay Risk
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
                  {((dims?.stage_fingerprint?.score || 0) * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Highest at: <strong style={{ color: 'var(--color-text-primary)' }}>{dims?.stage_fingerprint?.peak_stage?.replace(/_/g, ' ') || 'In Progress'}</strong>
                </div>
              </div>

              {/* Dimension 3: Data Completeness */}
              <div style={{ background: 'var(--color-bg-secondary)', padding: 16, borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981' }}>INDICATOR 3</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, margin: '4px 0', color: 'var(--color-text-primary)' }}>
                  Data Completeness
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
                  {dims?.data_completeness?.completeness_pct || 100}%
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Required Fields Filled
                </div>
              </div>

              {/* Dimension 4: Primary Delay Cause */}
              <div style={{ background: 'var(--color-bg-secondary)', padding: 16, borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b' }}>INDICATOR 4</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, margin: '4px 0', color: 'var(--color-text-primary)' }}>
                  Primary Delay Cause
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: '4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dims?.shap_driver_severity?.top_driver_name ? dims.shap_driver_severity.top_driver_name.replace(/_/g, ' ') : 'None'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Impact: <strong style={{ color: 'var(--color-accent-primary)', fontFamily: 'var(--font-mono)' }}>+{((dims?.shap_driver_severity?.top_driver_contribution || 0) * 100).toFixed(1)}%</strong>
                </div>
              </div>

              {/* Dimension 5: Prediction Confidence */}
              <div style={{ background: 'var(--color-bg-secondary)', padding: 16, borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ec4899' }}>INDICATOR 5</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, margin: '4px 0', color: 'var(--color-text-primary)' }}>
                  Prediction Confidence
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: dims?.reliability?.confidence_assessment === 'HIGH' ? '#10b981' : '#f59e0b', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
                  {dims?.reliability?.confidence_assessment === 'HIGH' ? 'High Confidence' : 'Moderate'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Status: <strong style={{ color: 'var(--color-text-primary)' }}>{dims?.reliability?.is_out_of_distribution ? 'Needs Review' : 'Reliable'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Temporal Observation Timeline */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} color="var(--color-accent-primary)" />
              Real Temporal Risk Observation History
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: '0 0 16px 0' }}>
              {temp?.temporal_disclaimer}
            </p>

            {!temp?.observations_available ? (
              <div style={{ padding: 24, background: 'var(--color-bg-secondary)', borderRadius: 8, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                No temporal observation history available for this project yet. Logging begins on first assessment.
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Risk Trend:</span>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700,
                    background: temp.risk_trend_label === 'ESCALATING' ? 'rgba(239, 68, 68, 0.15)' : temp.risk_trend_label === 'DE_ESCALATING' ? 'rgba(16, 185, 129, 0.15)' : 'var(--color-bg-tertiary)',
                    color: temp.risk_trend_label === 'ESCALATING' ? '#ef4444' : temp.risk_trend_label === 'DE_ESCALATING' ? '#10b981' : 'var(--color-text-secondary)'
                  }}>
                    {temp.risk_trend_label === 'ESCALATING' && <TrendingUp size={14} />}
                    {temp.risk_trend_label === 'DE_ESCALATING' && <TrendingDown size={14} />}
                    {temp.risk_trend_label === 'STABLE' && <Minus size={14} />}
                    {temp.risk_trend_label} ({(temp.risk_trend! * 100).toFixed(1)}% delta)
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    ({temp.observation_count} real observations logged)
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {temp.observations.map((obs, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--color-bg-secondary)', borderRadius: 6, border: '1px solid var(--color-border-subtle)', fontSize: '0.85rem' }}>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Assessment #{idx + 1}</span>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginLeft: 8 }}>Logged: {new Date(obs.timestamp).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Completeness: {obs.data_completeness_pct}%</span>
                        <span style={{ fontWeight: 700, color: 'var(--color-accent-primary)' }}>Anomaly Score: {(obs.anomaly_score * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Comparable Projects Panel */}
          {comparablesData && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <GitBranch size={18} color="#8b5cf6" />
                Structurally Comparable Projects (Cosine Similarity Benchmarking)
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: '0 0 16px 0' }}>
                {comparablesData.disclaimer}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                {comparablesData.comparable_projects.map((comp) => (
                  <div key={comp.project_id} style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>RANK #{comp.rank}</span>
                        <h4 style={{ margin: '2px 0 0 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {comp.project_code} — {comp.project_name}
                        </h4>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                          State: {comp.state_code} | Agency: {comp.executing_agency || 'NHAI'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#8b5cf6' }}>
                          {(comp.similarity_score * 100).toFixed(1)}%
                        </span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Similarity</div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 8, background: 'var(--color-bg-tertiary)', padding: 8, borderRadius: 4 }}>
                      <strong>Shared Characteristics:</strong> {comp.top_shared_features.join(', ')}
                    </div>

                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                      {comp.comparability_note}
                    </div>

                    <div style={{ marginTop: 12, textAlign: 'right' }}>
                      <Link to={`/projects/${comp.project_id}`} className="btn btn-sm btn-ghost" style={{ fontSize: '0.75rem' }}>
                        View Project
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
