/**
 * LADRIS — Project List Page
 * Multi-criteria filterable directory by Status, Risk Level, State, District, and Agency.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, Filter, FolderKanban, ChevronRight, RotateCcw, MapPin, Building2, Edit3, CheckCircle2, X } from 'lucide-react'
import { projectsAPI } from '@/api/client'
import type { ProjectListItem, ProjectStatus, RiskLevel } from '@/types'
import { RiskBadge, StatusBadge, EmptyState, LoadingState, PageHeader } from '@/components/common'
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

  // Filters
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
      transition={{ duration: 0.3 }}
    >
      <PageHeader
        title="Infrastructure Projects Directory"
        subtitle={total > 0 ? `Showing ${total} active project${total !== 1 ? 's' : ''} across Indian states and sectors` : 'Browse, filter, and monitor delay risks for all infrastructure projects'}
        actions={
          <button
            className="btn btn-primary"
            onClick={() => setShowNewProjectModal(true)}
          >
            <Plus size={16} />
            New Project
          </button>
        }
      />

      {/* Deleted Project Success Alert */}
      {deletedAlert && (
        <div
          className="card"
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            color: '#22c55e',
            padding: '12px 18px',
            marginBottom: 20,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={18} />
            <span style={{ fontSize: '0.9rem' }}>
              Project <strong>{deletedAlert.code}</strong> {deletedAlert.name && deletedAlert.name !== deletedAlert.code ? `(${deletedAlert.name})` : ''} has been successfully deleted from the active directory.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDeletedAlert(null)}
            className="btn btn-ghost"
            style={{ padding: '2px 6px', color: '#22c55e', minHeight: 'auto' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* New Project Modal with all 6 data ingestion methods */}
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

      {/* Filter Control Bar */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Filter size={15} style={{ color: 'var(--color-accent-primary)' }} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
            Filter Directory
          </span>
          {isFiltered && (
            <button
              onClick={clearAllFilters}
              className="btn btn-secondary"
              style={{
                marginLeft: 'auto',
                padding: '4px 10px',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <RotateCcw size={13} />
              Reset Filters
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
            }} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: 36, width: '100%', fontSize: '0.85rem' }}
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>

          {/* Status Dropdown */}
          <select
            className="input"
            style={{ width: '100%', fontSize: '0.85rem' }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Risk Level Dropdown */}
          <select
            className="input"
            style={{ width: '100%', fontSize: '0.85rem' }}
            value={riskFilter}
            onChange={(e) => { setRiskFilter(e.target.value); setPage(1) }}
          >
            {RISK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* State Dropdown */}
          <select
            className="input"
            style={{ width: '100%', fontSize: '0.85rem' }}
            value={stateFilter}
            onChange={(e) => { setStateFilter(e.target.value); setPage(1) }}
          >
            {STATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* District Input */}
          <div style={{ position: 'relative' }}>
            <MapPin size={14} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
            }} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: 34, width: '100%', fontSize: '0.85rem' }}
              placeholder="Filter by District..."
              value={districtFilter}
              onChange={(e) => { setDistrictFilter(e.target.value); setPage(1) }}
            />
          </div>

          {/* Agency Dropdown */}
          <select
            className="input"
            style={{ width: '100%', fontSize: '0.85rem' }}
            value={agencyFilter}
            onChange={(e) => { setAgencyFilter(e.target.value); setPage(1) }}
          >
            {AGENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Projects Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 24 }}>
            <LoadingState rows={6} />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban size={28} />}
            title="No Projects Found"
            description={isFiltered
              ? 'No projects match your selected filters. Try clearing or adjusting search criteria.'
              : 'No projects currently loaded. You can create a new project or sync data records.'}
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
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project Code</th>
                  <th>Project Name</th>
                  <th>Sector & Agency</th>
                  <th>Status</th>
                  <th>Delay Risk</th>
                  <th>State & District</th>
                  <th>Land Area (ha)</th>
                  <th>Target Completion</th>
                  <th style={{ textAlign: 'right', minWidth: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project, i) => {
                  const districtName = project.district_codes && project.district_codes.length > 0
                    ? project.district_codes.join(', ')
                    : 'N/A'
                  const agencyName = project.executing_agency || project.nodal_agency || 'MoRTH / NHAI'

                  return (
                    <motion.tr
                      key={project.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <td>
                        <code style={{
                          fontSize: '0.8rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--color-accent-primary)',
                          background: 'var(--color-accent-glow)',
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}>
                          {project.project_code}
                        </code>
                      </td>
                      <td style={{ color: 'var(--color-text-primary)', fontWeight: 500, maxWidth: 280 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={project.name}>
                          {project.name}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.825rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                          {project.project_type.replace(/_/g, ' ')}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Building2 size={11} /> {agencyName}
                        </div>
                      </td>
                      <td><StatusBadge status={project.status} /></td>
                      <td><RiskBadge level={project.risk_level} /></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="badge badge-gray" style={{ fontWeight: 600 }}>{project.state_code}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
                            {districtName}
                          </span>
                        </div>
                      </td>
                      <td>{formatHa(project.total_area_ha)}</td>
                      <td>{formatDate(project.planned_end_date)}</td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.78rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              color: 'var(--color-text-secondary)',
                              borderRadius: 4,
                            }}
                            title="Edit Project"
                            onClick={() => navigate(`/projects/${project.id}/edit`)}
                          >
                            <Edit3 size={13} />
                            Edit
                          </button>
                          <ChevronRight size={16} color="var(--color-text-muted)" onClick={() => navigate(`/projects/${project.id}`)} />
                        </div>
                      </td>
                    </motion.tr>
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
