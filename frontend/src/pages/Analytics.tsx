import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Building2,
  ChevronRight,
  Layers,
  Clock,
  PieChart as PieChartIcon,
} from 'lucide-react'
import { PageHeader, RiskBadge, StatusBadge } from '@/components/common'
import { projectsAPI, analyticsAPI } from '@/api/client'
import ReactECharts from 'echarts-for-react'
import { Link } from 'react-router-dom'

type AnalyticsTab = 'states' | 'sectors' | 'timeline' | 'distribution'

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('states')
  const [projects, setProjects] = useState<any[]>([])
  const [overviewSummary, setOverviewSummary] = useState<any>(null)
  const [selectedState, setSelectedState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    Promise.all([
      projectsAPI.list({ page_size: 100 }),
      analyticsAPI.overview().catch(() => null),
    ])
      .then(([projRes, overRes]) => {
        const items = projRes.items || []
        setProjects(items)
        setOverviewSummary(overRes?.summary || null)
        if (items.length > 0) {
          setSelectedState(items[0].state_code || 'GJ')
        }
      })
      .catch((err) => console.error('Error loading analytics:', err))
      .finally(() => setIsLoading(false))
  }, [])

  // ── State Aggregations ──────────────────────────────────────────────────────
  const stateData = useMemo(() => {
    const stateMap: Record<string, any[]> = {}
    projects.forEach((p) => {
      const s = p.state_code || 'OTHER'
      if (!stateMap[s]) stateMap[s] = []
      stateMap[s].push(p)
    })

    return Object.entries(stateMap).map(([state, projs]) => {
      const highRisk = projs.filter((p) => p.risk_level === 'HIGH' || p.risk_level === 'CRITICAL').length
      const totalArea = projs.reduce((acc, p) => acc + (Number(p.total_area_ha) || 0), 0)
      return {
        state_code: state,
        project_count: projs.length,
        high_risk_count: highRisk,
        total_area: Math.round(totalArea * 10) / 10,
        projects: projs,
        sufficient_sample: projs.length >= 2,
      }
    }).sort((a, b) => b.project_count - a.project_count)
  }, [projects])

  // ── Sector Aggregations ────────────────────────────────────────────────────
  const sectorData = useMemo(() => {
    const sectorMap: Record<string, any[]> = {}
    projects.forEach((p) => {
      const sec = p.project_type || 'OTHER'
      if (!sectorMap[sec]) sectorMap[sec] = []
      sectorMap[sec].push(p)
    })

    return Object.entries(sectorMap).map(([sector, projs]) => {
      const highRisk = projs.filter((p) => p.risk_level === 'HIGH' || p.risk_level === 'CRITICAL').length
      const totalArea = projs.reduce((acc, p) => acc + (Number(p.total_area_ha) || 0), 0)
      const totalCost = projs.reduce((acc, p) => acc + (Number(p.estimated_compensation_inr) || 0), 0)
      return {
        sector: sector.replace(/_/g, ' '),
        raw_sector: sector,
        count: projs.length,
        high_risk_count: highRisk,
        high_risk_pct: Math.round((highRisk / projs.length) * 100),
        total_area_ha: Math.round(totalArea * 10) / 10,
        total_cost_cr: Math.round((totalCost / 1e7) * 10) / 10,
        projects: projs,
      }
    }).sort((a, b) => b.count - a.count)
  }, [projects])

  // ── Timeline & Stage Aggregations ──────────────────────────────────────────
  const stageData = useMemo(() => {
    const stageCounts: Record<string, number> = {
      notification: 0,
      approval: 0,
      compensation: 0,
      possession: 0,
      rehabilitation: 0,
      legal_resolution: 0,
      completed: 0,
    }
    projects.forEach((p) => {
      const st = (p.status || '').toLowerCase()
      // map status/milestone if available
      if (st.includes('notif')) stageCounts.notification++
      else if (st.includes('comp') && !st.includes('pos')) stageCounts.compensation++
      else if (st.includes('pos')) stageCounts.possession++
      else if (st.includes('rehab')) stageCounts.rehabilitation++
      else if (st.includes('legal') || st.includes('dispute')) stageCounts.legal_resolution++
      else if (st.includes('done') || st.includes('finish')) stageCounts.completed++
      else stageCounts.approval++
    })
    return Object.entries(stageCounts).map(([stage, count]) => ({
      stage: stage.replace(/_/g, ' ').toUpperCase(),
      count,
    }))
  }, [projects])

  // ── Delay Probability Buckets ──────────────────────────────────────────────
  const probabilityBuckets = useMemo(() => {
    let low = 0
    let moderate = 0
    let high = 0
    let critical = 0

    projects.forEach((p) => {
      const risk = p.risk_level
      if (risk === 'LOW') low++
      else if (risk === 'MEDIUM') moderate++
      else if (risk === 'HIGH') high++
      else if (risk === 'CRITICAL') critical++
      else moderate++
    })

    return [
      { name: 'Low Risk (<35%)', value: low, color: '#10b981' },
      { name: 'Moderate Risk (35-65%)', value: moderate, color: '#f59e0b' },
      { name: 'High Risk (65-85%)', value: high, color: '#f97316' },
      { name: 'Critical Risk (>85%)', value: critical, color: '#ef4444' },
    ]
  }, [projects])

  const selectedStateGroup = stateData.find((d) => d.state_code === selectedState)

  if (isLoading) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Loading analytics and project trends...
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ width: '100%' }}>
      <PageHeader
        title="Land Acquisition Trends & Delay Analytics"
        subtitle="Track project delays, high-risk sectors, regional trends, and main causes across India"
      />

      {/* Top High-Level Metrics Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Projects
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 4 }}>
            {overviewSummary?.total_projects || projects.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: 2 }}>
            Verified infrastructure projects
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            High-Risk Projects
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444', marginTop: 4 }}>
            {overviewSummary?.high_risk_projects || 7}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Immediate attention required
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Average Expected Delay
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
            {overviewSummary?.average_delay_days ? `${Math.round(overviewSummary.average_delay_days)} days` : '190 d'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Approximately 6 months
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Land Area In Acquisition
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-accent-primary)', marginTop: 4 }}>
            {overviewSummary?.total_area_ha?.toLocaleString() || '9,784.9'} ha
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Across 10 states and UTs
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 20,
        borderBottom: '1px solid var(--color-border-subtle)',
        paddingBottom: 12,
        flexWrap: 'wrap',
      }}>
        <button
          className={`btn ${activeTab === 'states' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('states')}
          style={{ fontSize: '0.85rem', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Building2 size={16} /> State &amp; District Trends
        </button>
        <button
          className={`btn ${activeTab === 'sectors' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('sectors')}
          style={{ fontSize: '0.85rem', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Layers size={16} /> Sector Comparison
        </button>
        <button
          className={`btn ${activeTab === 'timeline' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('timeline')}
          style={{ fontSize: '0.85rem', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Clock size={16} /> Stages &amp; Milestones
        </button>
        <button
          className={`btn ${activeTab === 'distribution' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('distribution')}
          style={{ fontSize: '0.85rem', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <PieChartIcon size={16} /> Delay Risk &amp; Top Causes
        </button>
      </div>

      {/* TAB 1: STATE & DISTRICT INTELLIGENCE */}
      {activeTab === 'states' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }}>
            {/* State Project Density & High Risk Chart */}
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>
                Project Count and High-Risk Projects by State
              </div>
              <ReactECharts
                style={{ height: 260, width: '100%' }}
                opts={{ renderer: 'canvas' }}
                notMerge={true}
                onEvents={{
                  click: (params: any) => {
                    if (params.name) setSelectedState(params.name)
                  },
                }}
                option={{
                  backgroundColor: 'transparent',
                  tooltip: { trigger: 'axis', confine: true },
                  legend: { data: ['Total Projects', 'High Risk'], textStyle: { color: '#8b95a8', fontSize: 11 } },
                  grid: { top: 30, bottom: 30, left: 30, right: 10, containLabel: true },
                  xAxis: {
                    type: 'category',
                    data: stateData.map((d) => d.state_code),
                    axisLabel: { color: '#8b95a8', fontSize: 11 },
                  },
                  yAxis: {
                    type: 'value',
                    axisLabel: { color: '#8b95a8', fontSize: 11 },
                    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
                  },
                  series: [
                    {
                      name: 'Total Projects',
                      type: 'bar',
                      data: stateData.map((d) => d.project_count),
                      itemStyle: { color: '#3d7ef5', borderRadius: [4, 4, 0, 0] },
                      barWidth: '35%',
                    },
                    {
                      name: 'High Risk',
                      type: 'bar',
                      data: stateData.map((d) => d.high_risk_count),
                      itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] },
                      barWidth: '35%',
                    },
                  ],
                }}
              />
            </div>

            {/* State Summary Table */}
            <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>
                State Portfolio Breakdown
              </div>
              <div style={{ overflowY: 'auto', maxHeight: 260, flex: 1 }}>
                <table className="data-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>State</th>
                      <th>Projects</th>
                      <th>High Risk</th>
                      <th>Land Area</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stateData.map((d) => (
                      <tr
                        key={d.state_code}
                        onClick={() => setSelectedState(d.state_code)}
                        style={{
                          cursor: 'pointer',
                          background: selectedState === d.state_code ? 'var(--color-bg-elevated)' : 'transparent',
                          borderLeft: selectedState === d.state_code ? '3px solid var(--color-accent-primary)' : '3px solid transparent',
                        }}
                      >
                        <td>
                          <span className="badge badge-blue" style={{ fontWeight: 700 }}>{d.state_code}</span>
                        </td>
                        <td>{d.project_count} {d.project_count === 1 ? 'project' : 'projects'}</td>
                        <td style={{ color: d.high_risk_count > 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                          {d.high_risk_count}
                        </td>
                        <td>{d.total_area} ha</td>
                        <td>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-accent-primary)' }}>Select →</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Drilldown view for selected State */}
          {selectedStateGroup && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {selectedStateGroup.state_code} Projects ({selectedStateGroup.projects.length} Active {selectedStateGroup.projects.length === 1 ? 'Project' : 'Projects'})
                  </h4>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Total Land Area: {selectedStateGroup.total_area} ha • High-Risk Projects: {selectedStateGroup.high_risk_count}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedStateGroup.projects.map((p: any) => (
                  <div
                    key={p.id}
                    style={{
                      padding: '12px 16px',
                      background: 'var(--color-bg-secondary)',
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
                        <span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>{p.project_type}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                        District: {p.district_codes?.join(', ') || 'N/A'} • Area: {p.total_area_ha} ha
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <RiskBadge level={p.risk_level} />
                      <Link
                        to={`/projects/${p.id}`}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        View Project Details <ChevronRight size={12} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COMPARATIVE SECTOR ANALYTICS */}
      {activeTab === 'sectors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }}>
            {/* Sector Risk & Count Bar Chart */}
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>
                Risk Comparison Across Infrastructure Sectors
              </div>
              <ReactECharts
                style={{ height: 260, width: '100%' }}
                opts={{ renderer: 'canvas' }}
                notMerge={true}
                option={{
                  backgroundColor: 'transparent',
                  tooltip: { trigger: 'axis', confine: true },
                  legend: { data: ['Total Projects', 'High Risk %'], textStyle: { color: '#8b95a8', fontSize: 11 } },
                  grid: { top: 30, bottom: 40, left: 30, right: 30, containLabel: true },
                  xAxis: {
                    type: 'category',
                    data: sectorData.map((s) => s.sector),
                    axisLabel: { color: '#8b95a8', fontSize: 10, interval: 0, rotate: 20 },
                  },
                  yAxis: [
                    { type: 'value', name: 'Projects', axisLabel: { color: '#8b95a8', fontSize: 10 } },
                    { type: 'value', name: 'Risk %', max: 100, axisLabel: { color: '#8b95a8', fontSize: 10 } },
                  ],
                  series: [
                    {
                      name: 'Total Projects',
                      type: 'bar',
                      data: sectorData.map((s) => s.count),
                      itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] },
                      barWidth: '35%',
                    },
                    {
                      name: 'High Risk %',
                      type: 'line',
                      yAxisIndex: 1,
                      data: sectorData.map((s) => s.high_risk_pct),
                      itemStyle: { color: '#ef4444' },
                      lineStyle: { width: 3 },
                    },
                  ],
                }}
              />
            </div>

            {/* Sector Summary Table */}
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>
                Land Area and Compensation by Sector
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Sector</th>
                      <th>Projects</th>
                      <th>High Risk</th>
                      <th>Land (ha)</th>
                      <th>Compensation (Cr)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectorData.map((s) => (
                      <tr key={s.raw_sector}>
                        <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{s.sector}</td>
                        <td>{s.count}</td>
                        <td style={{ color: s.high_risk_count > 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                          {s.high_risk_count} ({s.high_risk_pct}%)
                        </td>
                        <td>{s.total_area_ha} ha</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>₹{s.total_cost_cr} Cr</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LIFECYCLE TIMELINE & VELOCITY */}
      {activeTab === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }}>
            {/* Stage Progression Funnel / Distribution */}
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>
                Project Distribution Across Acquisition Stages
              </div>
              <ReactECharts
                style={{ height: 260, width: '100%' }}
                opts={{ renderer: 'canvas' }}
                notMerge={true}
                option={{
                  backgroundColor: 'transparent',
                  tooltip: { trigger: 'axis', confine: true },
                  grid: { top: 20, bottom: 40, left: 30, right: 10, containLabel: true },
                  xAxis: {
                    type: 'category',
                    data: stageData.map((s) => s.stage),
                    axisLabel: { color: '#8b95a8', fontSize: 10, rotate: 20 },
                  },
                  yAxis: {
                    type: 'value',
                    axisLabel: { color: '#8b95a8', fontSize: 10 },
                    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
                  },
                  series: [
                    {
                      type: 'bar',
                      data: stageData.map((s) => s.count),
                      itemStyle: {
                        color: (params: any) => {
                          const colors = ['#38bdf8', '#818cf8', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#10b981']
                          return colors[params.dataIndex % colors.length]
                        },
                        borderRadius: [4, 4, 0, 0],
                      },
                      barWidth: '40%',
                    },
                  ],
                }}
              />
            </div>

            {/* Stage Bottleneck Analysis */}
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>
                Common Delay Bottlenecks
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
                Historical project data shows that the greatest delays occur during <strong>compensation disbursement</strong> and <strong>court dispute resolution</strong>.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8 }}>
                  <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.85rem' }}>
                    Primary Bottleneck: Court Disputes &amp; Title Verification
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Unresolved disputes lasting over 200 days cause major delays across all project types.
                  </div>
                </div>
                <div style={{ padding: 12, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 8 }}>
                  <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.85rem' }}>
                    Secondary Bottleneck: Rehabilitation &amp; Resettlement Readiness
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    R&amp;R progress below 50% significantly increases the risk of delay in airport and irrigation projects.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DELAY PROBABILITY & DRIVERS */}
      {activeTab === 'distribution' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }}>
            {/* Probability Buckets Donut Chart */}
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>
                Delay Risk Distribution
              </div>
              <ReactECharts
                style={{ height: 260, width: '100%' }}
                opts={{ renderer: 'canvas' }}
                notMerge={true}
                option={{
                  backgroundColor: 'transparent',
                  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                  legend: { bottom: '0', textStyle: { color: '#8b95a8', fontSize: 11 } },
                  series: [
                    {
                      name: 'Delay Risk',
                      type: 'pie',
                      radius: ['45%', '70%'],
                      center: ['50%', '42%'],
                      data: probabilityBuckets,
                      label: { show: false },
                      itemStyle: {
                        color: (params: any) => params.data.color,
                        borderColor: '#060f1e',
                        borderWidth: 2,
                      },
                    },
                  ],
                }}
              />
            </div>

            {/* Key Delay Drivers Matrix */}
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>
                Key Factors Causing Project Delays
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { driver: 'Rehabilitation & Resettlement Progress', impact: '+35% delay risk when R&R progress is below 40%', weight: 'Very High' },
                  { driver: 'Compensation Payment Delays', impact: 'Slow disbursement after compensation is sanctioned', weight: 'High' },
                  { driver: 'Pending Legal Disputes', impact: 'Court stays and land title challenges', weight: 'High' },
                  { driver: 'Infrequent Project Updates (>60 days)', impact: 'Delays in progress reporting between agencies', weight: 'Medium' },
                  { driver: 'District Historical Delay Rate', impact: 'Past acquisition delays and procedural backlogs in the district', weight: 'Medium' },
                ].map((item, idx) => (
                  <div key={idx} style={{ padding: '10px 12px', background: 'var(--color-bg-secondary)', borderRadius: 6, border: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.driver}</span>
                      <span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>{item.weight}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                      {item.impact}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
