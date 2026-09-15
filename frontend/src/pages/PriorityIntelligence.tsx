import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Filter, ChevronRight, Zap, Search } from 'lucide-react'
import { projectsAPI, predictionsAPI } from '@/api/client'
import { useNavigate } from 'react-router-dom'
import { RiskBadge, StatusBadge } from '@/components/common'

export default function PriorityIntelligence() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Filters
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [stateFilter, setStateFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState<'PRIORITY' | 'RISK' | 'NAME'>('PRIORITY')

  useEffect(() => {
    async function loadProjects() {
      setIsLoading(true)
      try {
        const res = await projectsAPI.list({ page_size: 50 })
        const items = res.items || []

        const predictions = await Promise.all(items.map((project: any) =>
          predictionsAPI.get(project.id).catch(() => null)
        ))
        const enriched = items.map((project: any, index: number) => {
          const prediction = predictions[index]
          return {
            ...project,
            risk_level: prediction?.risk_category || 'UNKNOWN',
            priorityScore: prediction?.risk_score ?? null,
            priorityLabel: prediction ? `${prediction.risk_category} ML RISK` : 'PREDICTION UNAVAILABLE',
            topIntervention: prediction ? {
              display_name: prediction.recommendations?.[0] || 'Manual review recommended',
              category: 'MODEL_RECOMMENDATION',
              action_description: prediction.recommendations?.[0] || 'No recommendation returned by the production model.',
              score_components: {},
            } : null,
          }
        })
        enriched.sort((a: any, b: any) => (b.priorityScore ?? -1) - (a.priorityScore ?? -1))
        setProjects(enriched)
        setIsLoading(false)

      } catch (err) {
        console.error('Failed to load priority projects', err)
        setIsLoading(false)
      }
    }

    loadProjects()
  }, [])

  const states = useMemo(() => Array.from(new Set(projects.map(p => p.state_code))).filter(Boolean), [projects])

  const filteredProjects = useMemo(() => {
    let result = [...projects]

    if (riskFilter !== 'ALL') {
      result = result.filter(p => p.risk_level === riskFilter)
    }

    if (stateFilter !== 'ALL') {
      result = result.filter(p => p.state_code === stateFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.project_code.toLowerCase().includes(q)
      )
    }

    if (sortBy === 'PRIORITY') {
      result.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
    } else if (sortBy === 'NAME') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    }

    return result
  }, [projects, riskFilter, stateFilter, search, sortBy])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ width: '100%' }}>
      {/* Page Header Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <AlertTriangle size={22} color="#f59e0b" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
              Global Priority Intelligence Center
            </h1>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="card" style={{ marginBottom: 24, background: 'var(--color-bg-card)', padding: 18, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          <Filter size={14} color="var(--color-accent-primary)" />
          FILTER & RANK CRITERIA
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, width: '100%' }}>
          {/* Search */}
          <div>
            <label className="input-label" style={{ fontSize: '0.75rem', marginBottom: 6 }}>Search Project</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input"
                style={{ paddingLeft: 34, height: 38, fontSize: '0.8125rem', boxSizing: 'border-box' }}
              />
              <Search size={14} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--color-text-muted)' }} />
            </div>
          </div>

          {/* Risk Level Filter */}
          <div>
            <label className="input-label" style={{ fontSize: '0.75rem', marginBottom: 6 }}>Risk Level</label>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="input"
              style={{ height: 38, fontSize: '0.8125rem', padding: '0 32px 0 12px', lineHeight: '38px', boxSizing: 'border-box' }}
            >
              <option value="ALL">All Risk Levels</option>
              <option value="CRITICAL">Critical Anomaly Risk</option>
              <option value="HIGH">High Anomaly Risk</option>
              <option value="MEDIUM">Medium Anomaly Risk</option>
              <option value="LOW">Low Anomaly Risk</option>
            </select>
          </div>

          {/* State Filter */}
          <div>
            <label className="input-label" style={{ fontSize: '0.75rem', marginBottom: 6 }}>State</label>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="input"
              style={{ height: 38, fontSize: '0.8125rem', padding: '0 32px 0 12px', lineHeight: '38px', boxSizing: 'border-box' }}
            >
              <option value="ALL">All States ({states.length})</option>
              {states.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="input-label" style={{ fontSize: '0.75rem', marginBottom: 6 }}>Sort Order</label>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="input"
              style={{ height: 38, fontSize: '0.8125rem', padding: '0 32px 0 12px', lineHeight: '38px', boxSizing: 'border-box' }}
            >
              <option value="PRIORITY">Priority Score (High → Low)</option>
              <option value="NAME">Project Name (A → Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects List */}
      {isLoading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Calculating national priority scores across public project registry...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
          No projects match the selected filter criteria.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
          {filteredProjects.map((p, idx) => {
            const topInt = p.topIntervention
            const components = topInt?.score_components || {}

            return (
              <div key={p.id} className="card" style={{ padding: 20, transition: 'all 0.15s', width: '100%' }}>
                {/* Item Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingBottom: 16, borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-accent-primary)',
                      flexShrink: 0,
                    }}>
                      #{idx + 1}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <code style={{
                          fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
                          color: 'var(--color-accent-primary)',
                          background: 'var(--color-accent-glow)',
                          padding: '2px 8px', borderRadius: 4,
                        }}>
                          {p.project_code}
                        </code>
                        <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>{p.state_code}</span>
                        <StatusBadge status={p.status} />
                        <RiskBadge level={p.risk_level} />
                      </div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                        {p.name}
                      </h3>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Priority Score
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-warning)', lineHeight: 1.2 }}>
                        {p.priorityScore ? p.priorityScore.toFixed(1) : 'N/A'}{' '}
                        <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>/ 100</span>
                      </div>
                      <div style={{ width: 90, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', margin: '4px 0 0 auto' }}>
                        <div style={{ height: '100%', width: `${p.priorityScore || 0}%`, background: (p.priorityScore || 0) > 80 ? 'var(--color-risk-critical)' : 'var(--color-risk-high)' }} />
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                    >
                      Workspace <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Why Prioritized & Component Breakdown */}
                <div style={{ marginTop: 14, padding: 16, background: 'var(--color-bg-secondary)', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Zap size={14} color="var(--color-accent-primary)" />
                    WHY THIS PROJECT IS PRIORITIZED:
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)', margin: 0, marginBottom: 14, lineHeight: 1.5 }}>
                    {topInt ? topInt.action_description : 'Prediction unavailable. Generate a production ML prediction after completing required source data.'}
                  </p>

                  {/* Component Formula Breakdown Grid */}
                  {Object.keys(components).length > 0 && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(6, 1fr)',
                      width: '100%',
                      gap: 10,
                      paddingTop: 12,
                      borderTop: '1px solid var(--color-border-subtle)',
                    }}>
                      {Object.entries(components).map(([key, comp]: [string, any]) => (
                        <div key={key} style={{ padding: '8px 12px', background: 'var(--color-bg-elevated)', borderRadius: 6, textAlign: 'center', border: '1px solid var(--color-border-subtle)' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                            {comp.label}
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 3 }}>
                            {comp.value !== undefined ? (comp.value * 100).toFixed(0) : 0}%
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                            Weight: {(comp.weight * 100).toFixed(0)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
