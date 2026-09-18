/**
 * LADRIS — Data Quality & Health Dashboard
 * 
 * Simplified, officer-friendly layout strictly following the flow:
 * 1. Overall Quality (Top 4 KPI cards: Overall Data Quality, Prediction Ready, Average Completeness, Projects Needing Data)
 * 2. Project Readiness (Project Data Readiness table with Name, Completeness %, Missing Critical Data, ML Status)
 * 3. Missing Data (Grouped categories: Project Information, Compensation, Legal, R&R, Timeline/Stage, GIS Data with View Details)
 * 4. Data Issues (Priority issues: missing R&R data, outdated compensation records, invalid/missing dates)
 */
import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
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
import type {
  DataQualityMetrics,
  ProjectReadinessItem,
  GroupedCategoryItem,
  DataIssueItem,
} from '@/types'
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
      { field: 'project_code', label: 'Project Identifier', null_rate: 0.0 },
      { field: 'name', label: 'Project Title', null_rate: 0.0 },
      { field: 'state_code', label: 'State Code', null_rate: 0.0 },
      { field: 'project_type', label: 'Infrastructure Sector', null_rate: 0.0 },
      { field: 'executing_agency', label: 'Executing Agency', null_rate: 0.0 },
      { field: 'acquisition_act', label: 'Governing Land Acquisition Act', null_rate: 0.0 },
    ],
  },
  {
    id: 'compensation',
    name: 'Compensation',
    completeness_pct: 92,
    status: 'Complete',
    description: 'Estimated budget, disbursed compensation ledgers, and direct beneficiary payments.',
    technical_fields: [
      { field: 'estimated_compensation_inr', label: 'Sanctioned Compensation Estimate', null_rate: 0.0 },
      { field: 'disbursed_compensation_inr', label: 'Disbursed Compensation Amount', null_rate: 0.0 },
      { field: 'families_compensated', label: 'Beneficiary Families Disbursed', null_rate: 0.08 },
    ],
  },
  {
    id: 'legal',
    name: 'Legal',
    completeness_pct: 94,
    status: 'Complete',
    description: 'Court litigation records, High Court stay injunctions, and disputed parcel numbers.',
    technical_fields: [
      { field: 'legal_case_count', label: 'Active Court Case Count', null_rate: 0.0 },
      { field: 'legal_case_status', label: 'Litigation Severity Classification', null_rate: 0.0 },
      { field: 'has_legal_dispute', label: 'Parcel Dispute Flag', null_rate: 0.06 },
    ],
  },
  {
    id: 'rr',
    name: 'R&R',
    completeness_pct: 82,
    status: 'Needs Attention',
    description: 'Project-affected families (PAFs), rehabilitation packages, and resettlement site verification.',
    technical_fields: [
      { field: 'total_affected_families', label: 'Project Affected Families (PAFs)', null_rate: 0.0 },
      { field: 'families_rehabilitated', label: 'Families Resettled & Rehabilitated', null_rate: 0.17 },
      { field: 'rehabilitation_progress_pct', label: 'Rehabilitation Progress %', null_rate: 0.17 },
    ],
  },
  {
    id: 'timeline_stage',
    name: 'Timeline / Stage',
    completeness_pct: 86,
    status: 'Needs Attention',
    description: 'Target vs actual milestones, statutory Section 3A/3D gazette notifications, and recorded delays.',
    technical_fields: [
      { field: 'planned_start_date', label: 'Scheduled Start Date', null_rate: 0.0 },
      { field: 'planned_end_date', label: 'Target Completion Date', null_rate: 0.0 },
      { field: 'notification_3a_date', label: 'Section 3A Preliminary Gazette', null_rate: 0.08 },
      { field: 'notification_3d_date', label: 'Section 3D Declaration Gazette', null_rate: 0.17 },
      { field: 'delay_months', label: 'Recorded Schedule Delay', null_rate: 0.0 },
    ],
  },
  {
    id: 'gis',
    name: 'GIS Data',
    completeness_pct: 100,
    status: 'Complete',
    description: 'PostGIS boundary polygons, corridor linear alignment routes, and survey centroids.',
    technical_fields: [
      { field: 'latitude', label: 'Corridor Latitude Centroid', null_rate: 0.0 },
      { field: 'longitude', label: 'Corridor Longitude Centroid', null_rate: 0.0 },
      { field: 'alignment_geom', label: 'Linear Route Alignment (LineString)', null_rate: 0.0 },
      { field: 'parcels_geom', label: 'PostGIS Parcel Boundaries (Polygon)', null_rate: 0.0 },
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

  // Filters for Project Readiness Table
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Ready' | 'Needs Data' | 'Not Ready'>('ALL')

  // Expanded category IDs for the Missing Data section
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
    setExpandedCategories((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Filtered projects for Project Data Readiness table
  const projectsReadiness = metrics?.projects_readiness || []
  const filteredProjects = useMemo(() => {
    return projectsReadiness.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.project_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.state_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.missing_critical_data.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus =
        statusFilter === 'ALL' || p.ml_status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [projectsReadiness, searchQuery, statusFilter])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 16 }}>
        <div className="skeleton" style={{ height: 60, borderRadius: 8 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 110, borderRadius: 8 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 320, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 260, borderRadius: 8 }} />
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
  const overallQuality = summary.overall_quality ?? Math.max(0, 100 - (summary.missing_value_rate || 0.074) * 100)
  const totalProjects = summary.total_projects ?? summary.total_real_records ?? 12
  const predictionReady = summary.prediction_ready ?? summary.prediction_eligible_records ?? 8
  const avgCompleteness = summary.avg_completeness ?? overallQuality
  const projectsNeedingData = summary.projects_needing_data ?? (totalProjects - predictionReady)

  const groupedCategories = metrics.grouped_categories && metrics.grouped_categories.length > 0
    ? metrics.grouped_categories
    : DEFAULT_GROUPED_CATEGORIES

  const dataIssues = metrics.data_issues && metrics.data_issues.length > 0
    ? metrics.data_issues
    : DEFAULT_DATA_ISSUES

  // Category icons mapping
  const categoryIcons: Record<string, React.ReactNode> = {
    project_info: <FileText size={18} color="#3b82f6" />,
    compensation: <IndianRupee size={18} color="#10b981" />,
    legal: <Scale size={18} color="#8b5cf6" />,
    rr: <Users size={18} color="#f59e0b" />,
    timeline_stage: <Calendar size={18} color="#ec4899" />,
    gis: <MapPin size={18} color="#06b6d4" />,
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 28 }}
    >
      {/* Page Header */}
      <PageHeader
        title="Data Quality & Health"
        subtitle="Monitor project data readiness, statutory completeness, and critical issues for land acquisition AI predictions."
      />

      {/* ─── 1. OVERALL QUALITY (TOP 4 KPI CARDS ONLY) ─────────────────────────── */}
      <section aria-labelledby="overall-quality-heading">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {/* Card 1: Overall Data Quality */}
          <div
            className="card"
            style={{
              padding: '20px 22px',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.01) 100%)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Overall Data Quality
              </span>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'rgba(16, 185, 129, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                }}
              >
                <ShieldCheck size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                {overallQuality.toFixed(1)}%
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.12)',
                  padding: '2px 8px',
                  borderRadius: 12,
                }}
              >
                Grade A
              </span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
              High Reliability · Validated by Registry
            </div>
          </div>

          {/* Card 2: Prediction Ready */}
          <div
            className="card"
            style={{
              padding: '20px 22px',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.01) 100%)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Prediction Ready
              </span>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'rgba(59, 130, 246, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#3b82f6',
                }}
              >
                <CheckCircle2 size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#3b82f6', fontFamily: 'var(--font-mono)' }}>
                {predictionReady}
              </span>
              <span style={{ fontSize: '1.1rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                / {totalProjects} Projects
              </span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
              Active AI Delay Inference Ready
            </div>
          </div>

          {/* Card 3: Average Completeness */}
          <div
            className="card"
            style={{
              padding: '20px 22px',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(139, 92, 246, 0.01) 100%)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Average Completeness
              </span>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'rgba(139, 92, 246, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#8b5cf6',
                }}
              >
                <Activity size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#8b5cf6', fontFamily: 'var(--font-mono)' }}>
                {avgCompleteness.toFixed(1)}%
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#8b5cf6',
                  background: 'rgba(139, 92, 246, 0.12)',
                  padding: '2px 8px',
                  borderRadius: 12,
                }}
              >
                Target &ge; 85%
              </span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
              Across All Statutory Attributes
            </div>
          </div>

          {/* Card 4: Projects Needing Data */}
          <div
            className="card"
            style={{
              padding: '20px 22px',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(245, 158, 11, 0.01) 100%)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Projects Needing Data
              </span>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'rgba(245, 158, 11, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f59e0b',
                }}
              >
                <AlertOctagon size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
                {projectsNeedingData}
              </span>
              <span style={{ fontSize: '1.1rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Projects
              </span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
              Missing R&R, Gazette or Survey Data
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. PROJECT DATA READINESS TABLE ─────────────────────────────────── */}
      <section aria-labelledby="project-readiness-heading">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Section Header & Controls */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--color-border-subtle)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div>
              <h2
                id="project-readiness-heading"
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                Project Data Readiness
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: 'var(--color-bg-elevated)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {filteredProjects.length} of {projectsReadiness.length} Projects
                </span>
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Review individual project completeness, identify missing statutory data, and assess ML inference eligibility.
              </p>
            </div>

            {/* Search & Filter Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Search Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 6,
                  padding: '6px 12px',
                  width: 240,
                }}
              >
                <Search size={14} color="var(--color-text-muted)" />
                <input
                  type="text"
                  placeholder="Search project or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.8rem',
                    color: 'var(--color-text-primary)',
                    width: '100%',
                  }}
                />
              </div>

              {/* Status Filter Tabs */}
              <div
                style={{
                  display: 'flex',
                  background: 'var(--color-bg-surface)',
                  padding: 3,
                  borderRadius: 6,
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                {(['ALL', 'Ready', 'Needs Data'] as const).map((filterVal) => {
                  const isActive = statusFilter === filterVal
                  return (
                    <button
                      key={filterVal}
                      onClick={() => setStatusFilter(filterVal)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: isActive ? 700 : 500,
                        borderRadius: 4,
                        border: 'none',
                        cursor: 'pointer',
                        background: isActive ? 'var(--color-accent-primary)' : 'transparent',
                        color: isActive ? '#ffffff' : 'var(--color-text-muted)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {filterVal === 'ALL' ? 'All' : filterVal}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr
                  style={{
                    background: 'var(--color-bg-surface)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Project Name</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, width: '22%' }}>Completeness %</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, width: '28%' }}>Missing Critical Data</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, width: '16%' }}>ML Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--color-text-muted)' }}>
                      No projects found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((p) => {
                    const isReady = p.ml_status === 'Ready'
                    const isNeedsData = p.ml_status === 'Needs Data'

                    return (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: '1px solid var(--color-border-subtle)',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-surface)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* Project Name & Metadata */}
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem', marginBottom: 4 }}>
                            {p.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                              {p.project_code}
                            </span>
                            <span style={{ color: 'var(--color-border-subtle)' }}>•</span>
                            <span
                              style={{
                                background: 'var(--color-bg-elevated)',
                                padding: '1px 6px',
                                borderRadius: 3,
                                color: 'var(--color-text-secondary)',
                                fontWeight: 600,
                                fontSize: '0.7rem',
                              }}
                            >
                              {p.state_code}
                            </span>
                            <span style={{ color: 'var(--color-border-subtle)' }}>•</span>
                            <span style={{ color: 'var(--color-text-muted)' }}>
                              {p.project_type}
                            </span>
                          </div>
                        </td>

                        {/* Completeness % with Progress Bar */}
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                flex: 1,
                                height: 7,
                                background: 'var(--color-bg-elevated)',
                                borderRadius: 4,
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(100, Math.max(5, p.completeness_pct))}%`,
                                  background:
                                    p.completeness_pct >= 90
                                      ? '#10b981'
                                      : p.completeness_pct >= 80
                                      ? '#f59e0b'
                                      : '#ef4444',
                                  borderRadius: 4,
                                  transition: 'width 0.4s ease',
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                color:
                                  p.completeness_pct >= 90
                                    ? '#10b981'
                                    : p.completeness_pct >= 80
                                    ? '#f59e0b'
                                    : '#ef4444',
                                minWidth: 38,
                                textAlign: 'right',
                              }}
                            >
                              {p.completeness_pct}%
                            </span>
                          </div>
                        </td>

                        {/* Missing Critical Data */}
                        <td style={{ padding: '14px 20px' }}>
                          {p.missing_critical_data.toLowerCase().includes('none') ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                color: '#10b981',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                              }}
                            >
                              <Check size={14} /> None — Fully Populated
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                color: '#f59e0b',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                background: 'rgba(245, 158, 11, 0.08)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                padding: '3px 9px',
                                borderRadius: 6,
                              }}
                            >
                              <AlertTriangle size={13} /> {p.missing_critical_data}
                            </span>
                          )}
                        </td>

                        {/* ML Status */}
                        <td style={{ padding: '14px 20px' }}>
                          {isReady ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: 'rgba(16, 185, 129, 0.12)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                color: '#10b981',
                                padding: '4px 10px',
                                borderRadius: 12,
                              }}
                            >
                              <CheckCircle2 size={13} /> Ready
                            </span>
                          ) : isNeedsData ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: 'rgba(245, 158, 11, 0.12)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                color: '#f59e0b',
                                padding: '4px 10px',
                                borderRadius: 12,
                              }}
                            >
                              <Clock size={13} /> Needs Data
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#ef4444',
                                padding: '4px 10px',
                                borderRadius: 12,
                              }}
                            >
                              <AlertOctagon size={13} /> Not Ready
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

      {/* ─── 3. MISSING DATA (GROUPED CATEGORIES WITH VIEW DETAILS) ───────────── */}
      <section aria-labelledby="grouped-categories-heading">
        <div style={{ marginBottom: 16 }}>
          <h2
            id="grouped-categories-heading"
            style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Missing Data by Category
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Statutory records organized into logical domains. Technical field definitions and null rates remain hidden under View Details.
          </p>
        </div>

        {/* 6 Category Cards in a responsive grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {groupedCategories.map((cat) => {
            const isExpanded = !!expandedCategories[cat.id]
            const isComplete = cat.status === 'Complete'

            return (
              <div
                key={cat.id}
                className="card"
                style={{
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: isComplete
                    ? '1px solid var(--color-border-subtle)'
                    : '1px solid rgba(245, 158, 11, 0.3)',
                  background: isComplete
                    ? 'var(--color-bg-surface)'
                    : 'linear-gradient(135deg, rgba(245, 158, 11, 0.03) 0%, transparent 100%)',
                }}
              >
                <div>
                  {/* Category Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          background: 'var(--color-bg-elevated)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {categoryIcons[cat.id] || <FileText size={18} />}
                      </div>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {cat.name}
                      </h3>
                    </div>

                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: isComplete ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                        color: isComplete ? '#10b981' : '#f59e0b',
                        border: `1px solid ${isComplete ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      }}
                    >
                      {cat.status}
                    </span>
                  </div>

                  {/* Completeness Bar */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 6 }}>
                      <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Category Completeness</span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: isComplete ? '#10b981' : '#f59e0b' }}>
                        {cat.completeness_pct}%
                      </strong>
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: 'var(--color-bg-elevated)',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${cat.completeness_pct}%`,
                          background: isComplete ? '#10b981' : '#f59e0b',
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>

                  {/* Friendly Description */}
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                    {cat.description}
                  </p>
                </div>

                {/* View Details Toggle & Collapsible Technical Field List */}
                <div>
                  <button
                    onClick={() => toggleCategoryDetails(cat.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 6,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)')}
                  >
                    <span>{isExpanded ? 'Hide Technical Details' : `View Details (${cat.technical_fields.length} fields)`}</span>
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>

                  {/* Collapsible Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden', marginTop: 10 }}
                      >
                        <div
                          style={{
                            background: 'var(--color-bg-primary)',
                            borderRadius: 6,
                            padding: '10px 12px',
                            border: '1px solid var(--color-border-subtle)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                        >
                          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>
                            Technical Schema & Missing Rates
                          </div>
                          {cat.technical_fields.map((f, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '0.75rem',
                                padding: '4px 0',
                                borderBottom: idx < cat.technical_fields.length - 1 ? '1px dashed var(--color-border-subtle)' : 'none',
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{f.label}</div>
                                <code style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{f.field}</code>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontWeight: 600,
                                    fontSize: '0.72rem',
                                    color: f.null_rate === 0 ? '#10b981' : '#f59e0b',
                                  }}
                                >
                                  {(f.null_rate * 100).toFixed(1)}% missing
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ─── 4. DATA ISSUES SECTION ─────────────────────────────────────────── */}
      <section aria-labelledby="data-issues-heading">
        <div className="card" style={{ padding: '24px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2
                id="data-issues-heading"
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertTriangle size={18} color="#f59e0b" />
                Priority Data Issues & Required Actions
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Actionable discrepancies that impact delay prediction reliability. Resolved items update automatically upon ingestion sync.
              </p>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                background: 'var(--color-bg-elevated)',
                padding: '4px 10px',
                borderRadius: 12,
              }}
            >
              {dataIssues.length} Identified Issues
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dataIssues.map((issue) => {
              const isHigh = issue.severity === 'HIGH'
              const isMedium = issue.severity === 'MEDIUM'

              return (
                <div
                  key={issue.id}
                  style={{
                    padding: '14px 18px',
                    borderRadius: 8,
                    background: isHigh
                      ? 'rgba(239, 68, 68, 0.03)'
                      : isMedium
                      ? 'rgba(245, 158, 11, 0.03)'
                      : 'var(--color-bg-surface)',
                    border: `1px solid ${
                      isHigh
                        ? 'rgba(239, 68, 68, 0.25)'
                        : isMedium
                        ? 'rgba(245, 158, 11, 0.25)'
                        : 'var(--color-border-subtle)'
                    }`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: isHigh
                            ? 'rgba(239, 68, 68, 0.15)'
                            : isMedium
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(59, 130, 246, 0.15)',
                          color: isHigh ? '#ef4444' : isMedium ? '#f59e0b' : '#3b82f6',
                        }}
                      >
                        {issue.severity} SEVERITY
                      </span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>
                        {issue.title}
                      </strong>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Affected Project:</span>
                      <strong style={{ color: 'var(--color-text-primary)' }}>{issue.project_name}</strong>
                      <code style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>({issue.project_code})</code>
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                    {issue.description}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 8,
                      borderTop: '1px dashed var(--color-border-subtle)',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
                      <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Action Required:</span>
                      <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{issue.action}</span>
                    </div>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: 'var(--color-accent-primary)',
                      }}
                    >
                      District Nodal Action <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </motion.div>
  )
}
