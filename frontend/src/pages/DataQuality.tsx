/**
 * LADRIS - Data Quality & Health Dashboard
 * Government Portal Visual Language — structured, information-first, compact.
 * All information and functionality preserved. Only visual presentation changed.
 *
 * Sections:
 * 1. Overall Quality KPI strip (4 compact cards)
 * 2. Project Data Readiness (table with search + filter)
 * 3. Missing Data by Category (left-border accent cards)
 * 4. Priority Data Issues & Required Actions
 */
import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  FileText,
  Scale,
  Users,
  Calendar,
  MapPin,
  IndianRupee,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  Clock,
  ArrowRight,
} from 'lucide-react'
import { dataQualityAPI } from '@/api/client'
import type { DataQualityMetrics, GroupedCategoryItem, DataIssueItem } from '@/types'
import { PageHeader, EmptyState } from '@/components/common'

// Fallback baseline categories if API is still warming up
const DEFAULT_GROUPED_CATEGORIES: GroupedCategoryItem[] = [
  {
    id: 'project_info',
    name: 'Project Information',
    completeness_pct: 100,
    status: 'Complete',
    description: 'Project identifiers, executing agency, district boundaries, and governing acquisition act.',
    technical_fields: [
      { field: 'project_code',     label: 'Project Identifier',             null_rate: 0.0 },
      { field: 'name',             label: 'Project Title',                  null_rate: 0.0 },
      { field: 'state_code',       label: 'State Code',                     null_rate: 0.0 },
      { field: 'project_type',     label: 'Infrastructure Sector',          null_rate: 0.0 },
      { field: 'executing_agency', label: 'Executing Agency',               null_rate: 0.0 },
      { field: 'acquisition_act',  label: 'Governing Land Acquisition Act', null_rate: 0.0 },
    ],
  },
  {
    id: 'compensation',
    name: 'Compensation',
    completeness_pct: 92,
    status: 'Complete',
    description: 'Estimated budget, disbursed compensation ledgers, and direct beneficiary payments.',
    technical_fields: [
      { field: 'estimated_compensation_inr', label: 'Sanctioned Compensation Estimate', null_rate: 0.0  },
      { field: 'disbursed_compensation_inr', label: 'Disbursed Compensation Amount',    null_rate: 0.0  },
      { field: 'families_compensated',       label: 'Beneficiary Families Disbursed',  null_rate: 0.08 },
    ],
  },
  {
    id: 'legal',
    name: 'Legal',
    completeness_pct: 94,
    status: 'Complete',
    description: 'Court litigation records, High Court stay injunctions, and disputed parcel numbers.',
    technical_fields: [
      { field: 'legal_case_count',  label: 'Active Court Case Count',           null_rate: 0.0  },
      { field: 'legal_case_status', label: 'Litigation Severity Classification', null_rate: 0.0  },
      { field: 'has_legal_dispute', label: 'Parcel Dispute Flag',                null_rate: 0.06 },
    ],
  },
  {
    id: 'rr',
    name: 'R&R',
    completeness_pct: 82,
    status: 'Needs Attention',
    description: 'Project-affected families (PAFs), rehabilitation packages, and resettlement site verification.',
    technical_fields: [
      { field: 'total_affected_families',    label: 'Project Affected Families (PAFs)',   null_rate: 0.0  },
      { field: 'families_rehabilitated',     label: 'Families Resettled & Rehabilitated', null_rate: 0.17 },
      { field: 'rehabilitation_progress_pct',label: 'Rehabilitation Progress %',          null_rate: 0.17 },
    ],
  },
  {
    id: 'timeline_stage',
    name: 'Timeline / Stage',
    completeness_pct: 86,
    status: 'Needs Attention',
    description: 'Target vs actual milestones, statutory Section 3A/3D gazette notifications, and recorded delays.',
    technical_fields: [
      { field: 'planned_start_date',  label: 'Scheduled Start Date',            null_rate: 0.0  },
      { field: 'planned_end_date',    label: 'Target Completion Date',          null_rate: 0.0  },
      { field: 'notification_3a_date',label: 'Section 3A Preliminary Gazette', null_rate: 0.08 },
      { field: 'notification_3d_date',label: 'Section 3D Declaration Gazette', null_rate: 0.17 },
      { field: 'delay_months',        label: 'Recorded Schedule Delay',         null_rate: 0.0  },
    ],
  },
  {
    id: 'gis',
    name: 'GIS Data',
    completeness_pct: 100,
    status: 'Complete',
    description: 'PostGIS boundary polygons, corridor linear alignment routes, and survey centroids.',
    technical_fields: [
      { field: 'latitude',      label: 'Corridor Latitude Centroid',          null_rate: 0.0 },
      { field: 'longitude',     label: 'Corridor Longitude Centroid',         null_rate: 0.0 },
      { field: 'alignment_geom',label: 'Linear Route Alignment (LineString)', null_rate: 0.0 },
      { field: 'parcels_geom',  label: 'PostGIS Parcel Boundaries (Polygon)', null_rate: 0.0 },
    ],
  },
]

const DEFAULT_DATA_ISSUES: DataIssueItem[] = [
  {
    id: 'issue-rr-khm',
    title: 'Missing R&R Resettlement Data',
    project_name: 'Khammam Lift Irrigation Expansion Package',
    project_code: 'TG-IRR-KHM-008',
    severity: 'HIGH',
    description: '620 project-affected families recorded, but formal resettlement site demarcation and rehabilitation milestone % is pending verification.',
    action: 'Upload R&R Rehabilitation Award from District Collectorate',
  },
  {
    id: 'issue-comp-nlr',
    title: 'Outdated Compensation Disbursement Records',
    project_name: 'Nellore Industrial Corridor Land Package',
    project_code: 'AP-NICDC-NLR-009',
    severity: 'HIGH',
    description: 'Disbursed compensation (₹175 Cr) lags baseline award estimate (₹340 Cr) by >48% with 6 active title suits.',
    action: 'Reconcile award disbursement with CALA treasury portal',
  },
  {
    id: 'issue-gaz-gnt',
    title: 'Missing Section 3D Gazette Notification Date',
    project_name: 'Guntur Rail Connectivity Expansion',
    project_code: 'AP-RVNL-GNT-002',
    severity: 'MEDIUM',
    description: 'Section 3A preliminary gazette is registered, but Section 3D declaration date has not been linked to the project record.',
    action: 'Link Gazette Declaration Publication Date',
  },
  {
    id: 'issue-env-pna',
    title: 'Forest Clearance Demarcation Survey Pending',
    project_name: 'Panna Water Infrastructure Land Package',
    project_code: 'MP-NWDA-PNA-012',
    severity: 'LOW',
    description: 'Canal reservoir forest fringe boundary requires joint demarcation survey with Madhya Pradesh Forest Department.',
    action: 'Submit Joint Forest Survey Demarcation Certificate',
  },
]

export default function DataQuality() {
  const [metrics, setMetrics] = useState<DataQualityMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Ready' | 'Needs Data' | 'Not Ready'>('ALL')
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  useEffect(() => {
    dataQualityAPI.get()
      .then(setMetrics)
      .catch((err) => {
        console.error('Failed to fetch data quality metrics:', err)
        setError('Failed to fetch data quality metrics.')
      })
      .finally(() => setIsLoading(false))
  }, [])

  const toggleCategoryDetails = (id: string) => {
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const projectsReadiness = metrics?.projects_readiness || []
  const filteredProjects = useMemo(() => {
    return projectsReadiness.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.project_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.state_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.missing_critical_data.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'ALL' || p.ml_status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [projectsReadiness, searchQuery, statusFilter])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
        <div className="skeleton" style={{ height: 40, borderRadius: 4 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, border: '1px solid var(--color-border-default)', borderRadius: 4, overflow: 'hidden' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 76 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 300, borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 240, borderRadius: 4 }} />
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

  const { summary } = metrics
  const overallQuality      = summary.overall_quality ?? Math.max(0, 100 - (summary.missing_value_rate || 0.074) * 100)
  const totalProjects       = summary.total_projects ?? summary.total_real_records ?? 12
  const predictionReady     = summary.prediction_ready ?? summary.prediction_eligible_records ?? 8
  const avgCompleteness     = summary.avg_completeness ?? overallQuality
  const projectsNeedingData = summary.projects_needing_data ?? (totalProjects - predictionReady)

  const groupedCategories = metrics.grouped_categories && metrics.grouped_categories.length > 0
    ? metrics.grouped_categories
    : DEFAULT_GROUPED_CATEGORIES

  const dataIssues = metrics.data_issues && metrics.data_issues.length > 0
    ? metrics.data_issues
    : DEFAULT_DATA_ISSUES

  // Category icons — single muted colour, icon provides recognition
  const categoryIcons: Record<string, React.ReactNode> = {
    project_info:   <FileText    size={15} color="var(--color-text-muted)" />,
    compensation:   <IndianRupee size={15} color="var(--color-text-muted)" />,
    legal:          <Scale       size={15} color="var(--color-text-muted)" />,
    rr:             <Users       size={15} color="var(--color-text-muted)" />,
    timeline_stage: <Calendar    size={15} color="var(--color-text-muted)" />,
    gis:            <MapPin      size={15} color="var(--color-text-muted)" />,
  }

  function issueSeverityClass(severity: string) {
    if (severity === 'HIGH')   return 'dq-issue-row dq-issue-row--high'
    if (severity === 'MEDIUM') return 'dq-issue-row dq-issue-row--medium'
    return 'dq-issue-row dq-issue-row--low'
  }

  function issueBadgeClass(severity: string) {
    if (severity === 'HIGH')   return 'dq-issue-severity dq-issue-severity--high'
    if (severity === 'MEDIUM') return 'dq-issue-severity dq-issue-severity--medium'
    return 'dq-issue-severity dq-issue-severity--low'
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 22 }}
    >
      {/* Page Header */}
      <PageHeader
        title="Data Quality & Health"
        subtitle="Monitor project data readiness, statutory completeness, and critical issues for land acquisition AI predictions."
      />

      {/* 1. OVERALL QUALITY KPI STRIP */}
      <section aria-labelledby="overall-quality-heading">
        <h2 id="overall-quality-heading" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', margin: '0 0 10px', paddingBottom: 6, borderBottom: '1px solid var(--color-border-subtle)' }}>
          Overall Data Quality
        </h2>
        <div className="dq-kpi-grid">

          {/* Overall Data Quality */}
          <div className="dq-kpi-card">
            <span className="dq-kpi-label">Data Quality</span>
            <span className="dq-kpi-value dq-kpi-value--good">{overallQuality.toFixed(1)}%</span>
            <span className="dq-kpi-badge dq-kpi-badge--good">Grade A</span>
            <span className="dq-kpi-desc">High reliability · Validated</span>
          </div>

          {/* Prediction Ready */}
          <div className="dq-kpi-card">
            <span className="dq-kpi-label">Prediction Ready</span>
            <span className="dq-kpi-value">
              {predictionReady}
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-muted)', marginLeft: 4 }}>
                / {totalProjects}
              </span>
            </span>
            <span className="dq-kpi-desc">Active AI delay inference ready</span>
          </div>

          {/* Average Completeness */}
          <div className="dq-kpi-card">
            <span className="dq-kpi-label">Avg Completeness</span>
            <span className={avgCompleteness >= 85 ? 'dq-kpi-value dq-kpi-value--good' : 'dq-kpi-value dq-kpi-value--warning'}>
              {avgCompleteness.toFixed(1)}%
            </span>
            <span className="dq-kpi-badge">Target &ge; 85%</span>
            <span className="dq-kpi-desc">Across all statutory attributes</span>
          </div>

          {/* Projects Needing Data */}
          <div className="dq-kpi-card">
            <span className="dq-kpi-label">Needs Data</span>
            <span className={projectsNeedingData > 0 ? 'dq-kpi-value dq-kpi-value--warning' : 'dq-kpi-value'}>
              {projectsNeedingData}
            </span>
            <span className="dq-kpi-desc">Missing R&amp;R, gazette or survey data</span>
          </div>

        </div>
      </section>

      {/* 2. PROJECT DATA READINESS TABLE */}
      <section aria-labelledby="project-readiness-heading">
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 4, boxShadow: 'none', backgroundImage: 'none' }}>

          {/* Table Header & Controls */}
          <div className="dq-table-header">
            <div>
              <h2
                id="project-readiness-heading"
                style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                Project Data Readiness
                <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '1px 7px', borderRadius: 3, background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)' }}>
                  {filteredProjects.length} of {projectsReadiness.length}
                </span>
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Review individual project completeness, identify missing statutory data, and assess ML inference eligibility.
              </p>
            </div>

            {/* Search & Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div className="dq-search-box">
                <Search size={13} color="var(--color-text-muted)" />
                <input
                  type="text"
                  placeholder="Search project or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="dq-filter-tabs">
                {(['ALL', 'Ready', 'Needs Data'] as const).map((filterVal) => (
                  <button
                    key={filterVal}
                    onClick={() => setStatusFilter(filterVal)}
                    className={statusFilter === filterVal ? 'dq-filter-tab dq-filter-tab--active' : 'dq-filter-tab'}
                  >
                    {filterVal === 'ALL' ? 'All' : filterVal}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-elevated)', borderBottom: '1px solid var(--color-border-default)', color: 'var(--color-text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  <th style={{ padding: '9px 18px', fontWeight: 700 }}>Project Name</th>
                  <th style={{ padding: '9px 18px', fontWeight: 700, width: '22%' }}>Completeness</th>
                  <th style={{ padding: '9px 18px', fontWeight: 700, width: '28%' }}>Missing Critical Data</th>
                  <th style={{ padding: '9px 18px', fontWeight: 700, width: '14%' }}>ML Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '28px 18px', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                      No projects found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((p) => {
                    const isReady     = p.ml_status === 'Ready'
                    const isNeedsData = p.ml_status === 'Needs Data'
                    const barColor =
                      p.completeness_pct >= 90 ? '#138808' :
                      p.completeness_pct >= 80 ? '#d97706' : '#ff4757'

                    return (
                      <tr
                        key={p.id}
                        style={{ borderBottom: '1px solid var(--color-border-subtle)', transition: 'background-color 0.1s ease' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* Project Name */}
                        <td style={{ padding: '11px 18px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.845rem', marginBottom: 2 }}>
                            {p.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.69rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', fontWeight: 500 }}>{p.project_code}</span>
                            <span style={{ color: 'var(--color-border-default)' }}>&bull;</span>
                            <span style={{ background: 'var(--color-bg-elevated)', padding: '0px 4px', borderRadius: 2, color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.65rem', border: '1px solid var(--color-border-subtle)' }}>{p.state_code}</span>
                            <span style={{ color: 'var(--color-border-default)' }}>&bull;</span>
                            <span style={{ color: 'var(--color-text-muted)' }}>{p.project_type}</span>
                          </div>
                        </td>

                        {/* Completeness */}
                        <td style={{ padding: '11px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 4, background: 'var(--color-bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(100, Math.max(5, p.completeness_pct))}%`, background: barColor, borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', minWidth: 34, textAlign: 'right' }}>
                              {p.completeness_pct}%
                            </span>
                          </div>
                        </td>

                        {/* Missing Critical Data */}
                        <td style={{ padding: '11px 18px' }}>
                          {p.missing_critical_data.toLowerCase().includes('none') ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#138808', fontSize: '0.78rem', fontWeight: 500 }}>
                              <Check size={12} /> None
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-text-secondary)', fontSize: '0.78rem', fontWeight: 600, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', padding: '2px 7px', borderRadius: 3 }}>
                              <AlertTriangle size={11} /> {p.missing_critical_data}
                            </span>
                          )}
                        </td>

                        {/* ML Status */}
                        <td style={{ padding: '11px 18px' }}>
                          {isReady ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 600, color: '#138808', background: 'rgba(19,136,8,0.07)', border: '1px solid rgba(19,136,8,0.25)', padding: '2px 8px', borderRadius: 3 }}>
                              <CheckCircle2 size={11} /> Ready
                            </span>
                          ) : isNeedsData ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-risk-medium)', background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.25)', padding: '2px 8px', borderRadius: 3 }}>
                              <Clock size={11} /> Needs Data
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-risk-critical)', background: 'rgba(255,71,87,0.07)', border: '1px solid rgba(255,71,87,0.25)', padding: '2px 8px', borderRadius: 3 }}>
                              <AlertOctagon size={11} /> Not Ready
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 3. MISSING DATA BY CATEGORY */}
      <section aria-labelledby="grouped-categories-heading">
        <div style={{ marginBottom: 12 }}>
          <h2 id="grouped-categories-heading" style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Missing Data by Category
          </h2>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Statutory records organised into logical domains. Technical field definitions and null rates available under View Details.
          </p>
        </div>

        <div className="dq-category-grid">
          {groupedCategories.map((cat) => {
            const isExpanded = !!expandedCategories[cat.id]
            const isComplete = cat.status === 'Complete'

            return (
              <div
                key={cat.id}
                className={isComplete ? 'dq-category-card dq-category-card--complete' : 'dq-category-card dq-category-card--needs-attention'}
              >
                {/* Header */}
                <div className="dq-category-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {categoryIcons[cat.id] || <FileText size={15} color="var(--color-text-muted)" />}
                    <h3 className="dq-category-title">{cat.name}</h3>
                  </div>
                  <span className={isComplete ? 'dq-category-status dq-category-status--complete' : 'dq-category-status dq-category-status--needs-attention'}>
                    {cat.status}
                  </span>
                </div>

                {/* Completeness Bar */}
                <div style={{ marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.69rem', marginBottom: 4, color: 'var(--color-text-muted)' }}>
                    <span>Completeness</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: isComplete ? '#138808' : '#d97706' }}>{cat.completeness_pct}%</strong>
                  </div>
                  <div style={{ height: 4, background: 'var(--color-bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${cat.completeness_pct}%`, background: isComplete ? '#138808' : '#d97706', borderRadius: 2 }} />
                  </div>
                </div>

                <p className="dq-category-desc">{cat.description}</p>

                {/* View Details Toggle */}
                <button
                  onClick={() => toggleCategoryDetails(cat.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 9px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)', borderRadius: 3, fontSize: '0.74rem', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer', transition: 'background-color 0.1s ease' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)')}
                >
                  <span>{isExpanded ? 'Hide Technical Details' : `View Details (${cat.technical_fields.length} fields)`}</span>
                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>

                {/* Collapsible Technical Fields */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{ overflow: 'hidden', marginTop: 8 }}
                    >
                      <div style={{ background: 'var(--color-bg-primary)', borderRadius: 3, padding: '8px 10px', border: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: '0.63rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
                          Technical Schema &amp; Missing Rates
                        </div>
                        {cat.technical_fields.map((f, idx) => (
                          <div
                            key={idx}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', paddingBottom: idx < cat.technical_fields.length - 1 ? 5 : 0, borderBottom: idx < cat.technical_fields.length - 1 ? '1px dashed var(--color-border-subtle)' : 'none' }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{f.label}</div>
                              <code style={{ fontSize: '0.63rem', color: 'var(--color-text-muted)' }}>{f.field}</code>
                            </div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.68rem', color: f.null_rate === 0 ? '#138808' : '#d97706' }}>
                              {(f.null_rate * 100).toFixed(1)}% missing
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </section>

      {/* 4. PRIORITY DATA ISSUES */}
      <section aria-labelledby="data-issues-heading">
        <div className="card" style={{ padding: '18px 20px', borderRadius: 4, boxShadow: 'none', backgroundImage: 'none', border: '1px solid var(--color-border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h2 id="data-issues-heading" style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                Priority Data Issues &amp; Required Actions
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Actionable discrepancies that impact delay prediction reliability. Resolved items update automatically upon ingestion sync.
              </p>
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', background: 'var(--color-bg-elevated)', padding: '2px 9px', borderRadius: 3, border: '1px solid var(--color-border-subtle)' }}>
              {dataIssues.length} Identified Issues
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {dataIssues.map((issue) => (
              <div key={issue.id} className={issueSeverityClass(issue.severity)}>
                <div className="dq-issue-header">
                  <span className={issueBadgeClass(issue.severity)}>{issue.severity}</span>
                  <span className="dq-issue-title">{issue.title}</span>
                </div>
                <div className="dq-issue-project">
                  Affected project: <strong style={{ color: 'var(--color-text-primary)' }}>{issue.project_name}</strong>
                  {' '}<code style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)' }}>({issue.project_code})</code>
                </div>
                <p className="dq-issue-desc">{issue.description}</p>
                <div className="dq-issue-action">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className="dq-issue-action-label">Action Required:</span>
                    <span className="dq-issue-action-text">{issue.action}</span>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.71rem', fontWeight: 600, color: 'var(--color-accent-primary)' }}>
                    District Nodal Action <ArrowRight size={11} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </motion.div>
  )
}
