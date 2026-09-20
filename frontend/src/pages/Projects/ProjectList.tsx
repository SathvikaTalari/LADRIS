/**
 * LADRIS — Project List Page
 * Multi-criteria filterable directory by Status, Risk Level, State, District, and Agency.
 * Visual redesign: Government portal style (pl-* scoped classes).
 * ALL data, logic, API calls, filtering, and routing are unchanged.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, Filter, FolderKanban, ChevronRight, RotateCcw, MapPin, Building2, Edit3, CheckCircle2, X } from 'lucide-react'
import { projectsAPI } from '@/api/client'
import type { ProjectListItem, ProjectStatus, RiskLevel } from '@/types'
import { EmptyState, LoadingState } from '@/components/common'
import { formatDate, formatHa } from '@/utils'
import { NewProjectModal } from '@/pages/DataIngestion'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DELAYED', label: 'Delayed' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ON_HOLD', label: 'On Hold' },
]

const RISK_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Risk Levels' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
]

const STATE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All States' },
  { value: 'UP', label: 'Uttar Pradesh (UP)' },
  { value: 'MH', label: 'Maharashtra (MH)' },
  { value: 'KA', label: 'Karnataka (KA)' },
  { value: 'GJ', label: 'Gujarat (GJ)' },
  { value: 'WB', label: 'West Bengal (WB)' },
  { value: 'BR', label: 'Bihar (BR)' },
  { value: 'MP', label: 'Madhya Pradesh (MP)' },
  { value: 'AP', label: 'Andhra Pradesh (AP)' },
  { value: 'DL', label: 'Delhi (DL)' },
  { value: 'TG', label: 'Telangana (TG)' },
  { value: 'OD', label: 'Odisha (OD)' },
  { value: 'RJ', label: 'Rajasthan (RJ)' },
  { value: 'TN', label: 'Tamil Nadu (TN)' },
]

const AGENCY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Agencies' },
  { value: 'NHAI', label: 'NHAI' },
  { value: 'NHIDCL', label: 'NHIDCL' },
  { value: 'MoRTH', label: 'MoRTH' },
  { value: 'PWD', label: 'State PWD' },
  { value: 'Railways', label: 'Indian Railways' },
  { value: 'SIDC', label: 'State Ind. Dev. Corp' },
  { value: 'DMRC', label: 'Metro Rail (DMRC)' },
]

// ─── Status Indicator ─────────────────────────────────────────────────────────
function StatusIndicator({ status }: { status: ProjectStatus }) {
  const norm = (status || '').toLowerCase().replace(/\s/g, '_')
  const labels: Record<string, string> = {
    active: 'Active',
    delayed: 'Delayed',
    approved: 'Approved',
    draft: 'Draft',
    completed: 'Completed',
    on_hold: 'On Hold',
    under_review: 'Under Review',
    cancelled: 'Cancelled',
  }
  const label = labels[norm] ?? status
  const cls = ['active', 'delayed', 'approved', 'draft', 'completed', 'on_hold'].includes(norm)
    ? norm
    : 'default'
  return (
    <span className={`pl-status pl-status--${cls}`}>
      <span className="pl-status-dot" />
      {label}
    </span>
  )
}

// ─── Risk Indicator ───────────────────────────────────────────────────────────
function RiskIndicator({ level }: { level: RiskLevel }) {
  const norm = (level || '').toLowerCase()
  const labels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    unknown: 'Unknown',
  }
  const label = labels[norm] ?? level
  const cls = ['critical', 'high', 'medium', 'low'].includes(norm) ? norm : 'unknown'
  return (
    <span className={`pl-risk pl-risk--${cls}`}>
      <span className="pl-risk-bar" />
      {label}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProjectList() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(searchParams.get('new') === 'true')
  const [deletedAlert, setDeletedAlert] = useState<{ code: string; name: string } | null>(null)
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Filters — unchanged
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [riskFilter, setRiskFilter] = useState<string>('')
  const [stateFilter, setStateFilter] = useState<string>('')
  const [districtFilter, setDistrictFilter] = useState<string>('')
  const [agencyFilter, setAgencyFilter] = useState<string>('')

  const isFiltered = Boolean(search || statusFilter || riskFilter || stateFilter || districtFilter || agencyFilter)

  const clearAllFilters = () => {
    setSearch('')
    setStatusFilter('')
    setRiskFilter('')
    setStateFilter('')
    setDistrictFilter('')
    setAgencyFilter('')
    setPage(1)
  }

  const loadProjects = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await projectsAPI.list({
        page,
        page_size: 25,
        search: search || undefined,
        status: (statusFilter as ProjectStatus) || undefined,
        risk_level: (riskFilter as RiskLevel) || undefined,
        state_code: stateFilter || undefined,
        district: districtFilter || undefined,
        agency: agencyFilter || undefined,
      })
      setProjects(data.items)
      setTotal(data.total)
    } catch (err) {
      console.error('Failed to load projects:', err)
    } finally {
      setIsLoading(false)
    }
  }, [page, search, statusFilter, riskFilter, stateFilter, districtFilter, agencyFilter])

  useEffect(() => {
    const timer = setTimeout(loadProjects, 300)
    return () => clearTimeout(timer)
  }, [loadProjects])

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowNewProjectModal(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (location.state?.deletedProjectCode) {
      setDeletedAlert({
        code: location.state.deletedProjectCode,
        name: location.state.deletedProjectName || location.state.deletedProjectCode,
      })
      window.history.replaceState({}, document.title)
      loadProjects()
    }
  }, [location.state, loadProjects])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* ── Page Header ── */}
      <div className="pl-header">
        <div>
          <h1 className="pl-header-title">Infrastructure Projects Directory</h1>
          <p className="pl-header-subtitle">
            {total > 0
              ? `Showing ${total} project${total !== 1 ? 's' : ''} across Indian states and sectors`
              : 'Browse, filter, and monitor delay risks for all infrastructure projects'}
          </p>
        </div>
        <div className="pl-header-actions">
          <button
            className="pl-btn-new"
            onClick={() => setShowNewProjectModal(true)}
          >
            <Plus size={14} />
            New Project
          </button>
        </div>
      </div>

      {/* ── Deleted Project Success Alert ── */}
      {deletedAlert && (
        <div className="pl-alert-success">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={15} />
            <span>
              Project <strong>{deletedAlert.code}</strong>
              {deletedAlert.name && deletedAlert.name !== deletedAlert.code
                ? ` (${deletedAlert.name})`
                : ''}{' '}
              has been successfully deleted from the active directory.
            </span>
          </div>
          <button
            type="button"
            className="pl-alert-close"
            onClick={() => setDeletedAlert(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── New Project Modal ── */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => {
          setShowNewProjectModal(false)
          if (searchParams.get('new')) {
            setSearchParams({})
          }
        }}
        onProjectCreated={() => {
          loadProjects()
        }}
      />

      {/* ── Filter Toolbar ── */}
      <div className="pl-filter-bar">
        <div className="pl-filter-bar-top">
          <span className="pl-filter-label">
            <Filter size={11} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
            Filter Directory
          </span>
          {isFiltered && (
            <button className="pl-filter-reset" onClick={clearAllFilters}>
              <RotateCcw size={11} />
              Reset Filters
            </button>
          )}
        </div>

        <div className="pl-filter-grid">
          {/* Search */}
          <div className="pl-search-wrap">
            <span className="pl-search-icon"><Search size={13} /></span>
            <input
              type="text"
              className="pl-filter-input"
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>

          {/* Status */}
          <select
            className="pl-filter-select"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Risk Level */}
          <select
            className="pl-filter-select"
            value={riskFilter}
            onChange={(e) => { setRiskFilter(e.target.value); setPage(1) }}
          >
            {RISK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* State */}
          <select
            className="pl-filter-select"
            value={stateFilter}
            onChange={(e) => { setStateFilter(e.target.value); setPage(1) }}
          >
            {STATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* District */}
          <div className="pl-district-wrap">
            <span className="pl-district-icon"><MapPin size={12} /></span>
            <input
              type="text"
              className="pl-filter-input"
              placeholder="Filter by District..."
              value={districtFilter}
              onChange={(e) => { setDistrictFilter(e.target.value); setPage(1) }}
            />
          </div>

          {/* Agency */}
          <select
            className="pl-filter-select"
            value={agencyFilter}
            onChange={(e) => { setAgencyFilter(e.target.value); setPage(1) }}
          >
            {AGENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Projects Table ── */}
      <div className="pl-table-card">
        {isLoading ? (
          <div style={{ padding: 24 }}>
            <LoadingState rows={6} />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban size={26} />}
            title="No Projects Found"
            description={
              isFiltered
                ? 'No projects match your selected filters. Try clearing or adjusting search criteria.'
                : 'No projects currently loaded. You can create a new project or sync data records.'
            }
            action={
              isFiltered ? (
                <button className="btn btn-secondary" onClick={clearAllFilters}>
                  <RotateCcw size={14} /> Clear All Filters
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => navigate('/data-sources')}>
                  View Data Sources
                </button>
              )
            }
          />
        ) : (
          <div className="pl-table-scroll">
            <table className="pl-table">
              <thead>
                <tr>
                  <th>Project Code</th>
                  <th>Project Name</th>
                  <th>Sector &amp; Agency</th>
                  <th>Status</th>
                  <th>Delay Risk</th>
                  <th>State &amp; District</th>
                  <th style={{ textAlign: 'right' }}>Land Area (ha)</th>
                  <th>Target Completion</th>
                  <th style={{ textAlign: 'right', minWidth: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => {
                  const districtName =
                    project.district_codes && project.district_codes.length > 0
                      ? project.district_codes.join(', ')
                      : 'N/A'
                  const agencyName =
                    project.executing_agency || project.nodal_agency || 'MoRTH / NHAI'

                  return (
                    <tr
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      {/* Project Code */}
                      <td>
                        <span className="pl-code">{project.project_code}</span>
                      </td>

                      {/* Project Name */}
                      <td style={{ maxWidth: 280 }}>
                        <span className="pl-project-name" title={project.name}>
                          {project.name}
                        </span>
                      </td>

                      {/* Sector & Agency */}
                      <td>
                        <span className="pl-sector">
                          {project.project_type.replace(/_/g, ' ')}
                        </span>
                        <span className="pl-agency">
                          <Building2 size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                          {agencyName}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <StatusIndicator status={project.status} />
                      </td>

                      {/* Delay Risk */}
                      <td>
                        <RiskIndicator level={project.risk_level} />
                      </td>

                      {/* State & District */}
                      <td>
                        <span className="pl-location">
                          <span className="pl-location-state">{project.state_code}</span>
                          <span className="pl-location-sep">·</span>
                          {districtName}
                        </span>
                      </td>

                      {/* Land Area */}
                      <td style={{ textAlign: 'right' }}>
                        <span className="pl-area">{formatHa(project.total_area_ha)}</span>
                      </td>

                      {/* Target Completion */}
                      <td>
                        <span className="pl-date">{formatDate(project.planned_end_date)}</span>
                      </td>

                      {/* Actions */}
                      <td
                        style={{ textAlign: 'right' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="pl-actions">
                          <button
                            type="button"
                            className="pl-btn-edit"
                            title="Edit Project"
                            onClick={() => navigate(`/projects/${project.id}/edit`)}
                          >
                            <Edit3 size={11} />
                            Edit
                          </button>
                          <ChevronRight
                            size={15}
                            className="pl-chevron"
                            onClick={() => navigate(`/projects/${project.id}`)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  )
}
