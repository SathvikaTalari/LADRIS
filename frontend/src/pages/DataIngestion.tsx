/**
 * LADRIS — Multi-Source Data Ingestion Hub
 * Supports:
 * 1. Manual Forms (Project, Compensation, Legal, R&R, Stages, GIS, Stakeholders)
 * 2. CSV / Excel Uploads (Preview, Column Mapping, Validation, Error Report CSV)
 * 3. Connect API (REST API Key / JWT authentication, Interactive JSON Tester)
 * 4. Import Database Data (PostgreSQL / Relational DB connection & preview)
 * 5. Upload GIS Data (GeoJSON, KML, Shapefile ZIP, CSV lat/lng with PostGIS persistence & map preview)
 * 6. Upload Documents (PDF extraction of Gazette/Awards/SIA with human review & verification screen)
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Upload,
  Globe,
  Database,
  MapPin,
  FileCheck2,
  CheckCircle2,
  Download,
  Plus,
  ArrowRight,
  FileSpreadsheet,
  X,
  AlertCircle
} from 'lucide-react'
import { ingestionAPI, projectsAPI } from '@/api/client'
import type {
  CSVPreviewData,
  CSVImportSummaryData,
  GISIngestionData,
  DocumentExtractData,
} from '@/api/client'
import { PageHeader } from '@/components/common'

// Standard States
const STATES = [
  { code: 'AP', name: 'Andhra Pradesh' },
  { code: 'AS', name: 'Assam' },
  { code: 'BR', name: 'Bihar' },
  { code: 'CG', name: 'Chhattisgarh' },
  { code: 'DL', name: 'Delhi' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'HR', name: 'Haryana' },
  { code: 'HP', name: 'Himachal Pradesh' },
  { code: 'JH', name: 'Jharkhand' },
  { code: 'KA', name: 'Karnataka' },
  { code: 'KL', name: 'Kerala' },
  { code: 'MP', name: 'Madhya Pradesh' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'OD', name: 'Odisha' },
  { code: 'PB', name: 'Punjab' },
  { code: 'RJ', name: 'Rajasthan' },
  { code: 'TN', name: 'Tamil Nadu' },
  { code: 'TG', name: 'Telangana' },
  { code: 'UP', name: 'Uttar Pradesh' },
  { code: 'UK', name: 'Uttarakhand' },
  { code: 'WB', name: 'West Bengal' },
]

const PROJECT_TYPES = [
  'HIGHWAY', 'RAILWAY', 'METRO_RAIL', 'AIRPORT', 'PORT',
  'POWER_TRANSMISSION', 'PIPELINE', 'IRRIGATION',
  'URBAN_DEVELOPMENT', 'INDUSTRIAL_CORRIDOR', 'DEFENCE', 'OTHER'
]

export interface NewProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onProjectCreated?: () => void
}

export function NewProjectModal({ isOpen, onClose, onProjectCreated }: NewProjectModalProps) {
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(null), 5000)
  }

  const handleSubModalSuccess = (msg: string) => {
    setActiveModal(null)
    showToast(msg)
    if (onProjectCreated) {
      onProjectCreated()
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 990,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 1080,
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--color-bg-card, #161c28)',
            borderRadius: 14,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
            padding: '28px 32px',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Plus size={20} style={{ color: 'var(--color-accent-primary, #38bdf8)' }} />
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                  Create New Project — Select Data Input Method
                </h2>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
                Choose how you want to ingest or populate project, land acquisition, compensation, and GIS data.
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '6px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Toast Notification */}
          <AnimatePresence>
            {successToast && (
              <motion.div
                initial={{ opacity: 0, y: -15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid var(--color-accent-success, #10b981)',
                  borderRadius: 8,
                  padding: '12px 18px',
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: '#10b981',
                  fontWeight: 500,
                }}
              >
                <CheckCircle2 size={18} />
                <span>{successToast}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 6 Ingestion Method Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 16 }}>
            {/* 1. Manual Forms */}
            <IngestionCard
              title="Add Manually"
              tag="Form Wizard"
              icon={<FileText size={22} style={{ color: '#38bdf8' }} />}
              accentColor="#38bdf8"
              description="Enter projects, compensation, legal cases, R&R milestones, and GIS parcels via structured forms."
              onClick={() => setActiveModal('MANUAL')}
              buttonText="Open Manual Form"
            />

            {/* 2. CSV / Excel */}
            <IngestionCard
              title="Upload CSV / Excel"
              tag="Bulk Import"
              icon={<FileSpreadsheet size={22} style={{ color: '#34d399' }} />}
              accentColor="#34d399"
              description="Bulk import .csv, .xls, .xlsx with preview, column mapping, row validation, and error reports."
              onClick={() => setActiveModal('CSV')}
              buttonText="Upload Spreadsheet"
            />

            {/* 3. Connect API */}
            <IngestionCard
              title="Connect API"
              tag="REST / Push"
              icon={<Globe size={22} style={{ color: '#a78bfa' }} />}
              accentColor="#a78bfa"
              description="Push data via secure FastAPI endpoints with API key or JWT, schema validation, and idempotency."
              onClick={() => setActiveModal('API')}
              buttonText="View API & Test"
            />

            {/* 4. Import Database Data */}
            <IngestionCard
              title="Import Database Data"
              tag="PostgreSQL"
              icon={<Database size={22} style={{ color: '#fbbf24' }} />}
              accentColor="#fbbf24"
              description="Connect to external PostgreSQL or relational databases and import projects securely."
              onClick={() => setActiveModal('DATABASE')}
              buttonText="Connect Database"
            />

            {/* 5. Upload GIS Data */}
            <IngestionCard
              title="Upload GIS Data"
              tag="PostGIS"
              icon={<MapPin size={22} style={{ color: '#2dd4bf' }} />}
              accentColor="#2dd4bf"
              description="Import GeoJSON, KML, zipped Shapefiles, or CSV coordinates with spatial map preview."
              onClick={() => setActiveModal('GIS')}
              buttonText="Upload GIS Data"
            />

            {/* 6. Upload Documents */}
            <IngestionCard
              title="Upload Documents"
              tag="PDF Review"
              icon={<FileCheck2 size={22} style={{ color: '#f472b6' }} />}
              accentColor="#f472b6"
              description="Extract project data from PDF notifications, awards, and SIA reports with human verification."
              onClick={() => setActiveModal('DOCUMENT')}
              buttonText="Upload Document (PDF)"
            />
          </div>
        </motion.div>
      </div>

      {/* Sub-modals for each input method */}
      <AnimatePresence>
        {activeModal === 'MANUAL' && (
          <ManualFormModal
            onClose={() => setActiveModal(null)}
            onSuccess={(msg) => handleSubModalSuccess(msg)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === 'CSV' && (
          <CSVImportModal
            onClose={() => setActiveModal(null)}
            onSuccess={(msg) => handleSubModalSuccess(msg)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === 'API' && (
          <ConnectAPIModal
            onClose={() => setActiveModal(null)}
            onSuccess={(msg) => {
              showToast(msg)
              if (onProjectCreated) onProjectCreated()
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === 'DATABASE' && (
          <DatabaseImportModal
            onClose={() => setActiveModal(null)}
            onSuccess={(msg) => handleSubModalSuccess(msg)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === 'GIS' && (
          <GISUploadModal
            onClose={() => setActiveModal(null)}
            onSuccess={(msg) => handleSubModalSuccess(msg)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === 'DOCUMENT' && (
          <DocumentReviewModal
            onClose={() => setActiveModal(null)}
            onSuccess={(msg) => handleSubModalSuccess(msg)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

export default function DataIngestion() {
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(null), 5000)
  }

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', paddingBottom: 60 }}>
      <PageHeader
        title="Data Ingestion"
        subtitle="Add project data from forms, files, APIs, maps, or documents."
      />

      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid var(--color-accent-success, #10b981)',
              borderRadius: 8,
              padding: '12px 18px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#10b981',
              fontWeight: 500,
            }}
          >
            <CheckCircle2 size={18} />
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18, marginBottom: 36 }}>
        <IngestionCard
          title="Add Manually"
          tag="Form Wizard"
          icon={<FileText size={22} style={{ color: '#38bdf8' }} />}
          accentColor="#38bdf8"
          description="Enter projects, compensation, legal cases, R&R milestones, and GIS parcels via structured forms."
          onClick={() => setActiveModal('MANUAL')}
          buttonText="Open Manual Form"
        />

        <IngestionCard
          title="Upload CSV / Excel"
          tag="Bulk Import"
          icon={<FileSpreadsheet size={22} style={{ color: '#34d399' }} />}
          accentColor="#34d399"
          description="Bulk import .csv, .xls, .xlsx with preview, column mapping, row validation, and error reports."
          onClick={() => setActiveModal('CSV')}
          buttonText="Upload Spreadsheet"
        />

        <IngestionCard
          title="Connect API"
          tag="REST / Push"
          icon={<Globe size={22} style={{ color: '#a78bfa' }} />}
          accentColor="#a78bfa"
          description="Push data via secure FastAPI endpoints with API key or JWT, schema validation, and idempotency."
          onClick={() => setActiveModal('API')}
          buttonText="View API & Test"
        />

        <IngestionCard
          title="Import Database Data"
          tag="PostgreSQL"
          icon={<Database size={22} style={{ color: '#fbbf24' }} />}
          accentColor="#fbbf24"
          description="Connect to external PostgreSQL or relational databases and import projects securely."
          onClick={() => setActiveModal('DATABASE')}
          buttonText="Connect Database"
        />

        <IngestionCard
          title="Upload GIS Data"
          tag="PostGIS"
          icon={<MapPin size={22} style={{ color: '#2dd4bf' }} />}
          accentColor="#2dd4bf"
          description="Import GeoJSON, KML, zipped Shapefiles, or CSV coordinates with spatial map preview."
          onClick={() => setActiveModal('GIS')}
          buttonText="Upload GIS Data"
        />

        <IngestionCard
          title="Upload Documents"
          tag="PDF Review"
          icon={<FileCheck2 size={22} style={{ color: '#f472b6' }} />}
          accentColor="#f472b6"
          description="Extract project data from PDF notifications, awards, and SIA reports with human verification."
          onClick={() => setActiveModal('DOCUMENT')}
          buttonText="Upload Document (PDF)"
        />
      </div>

      <AnimatePresence>
        {activeModal === 'MANUAL' && (
          <ManualFormModal
            onClose={() => setActiveModal(null)}
            onSuccess={(msg) => {
              setActiveModal(null)
              showToast(msg)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === 'CSV' && (
          <CSVImportModal
            onClose={() => setActiveModal(null)}
            onSuccess={(msg) => {
              setActiveModal(null)
              showToast(msg)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === 'API' && (
          <ConnectAPIModal
            onClose={() => setActiveModal(null)}
            onSuccess={(msg) => {
              showToast(msg)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === 'DATABASE' && (
          <DatabaseImportModal
            onClose={() => setActiveModal(null)}
            onSuccess={(msg) => {
              setActiveModal(null)
              showToast(msg)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === 'GIS' && (
          <GISUploadModal
            onClose={() => setActiveModal(null)}
            onSuccess={(msg) => {
              setActiveModal(null)
              showToast(msg)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === 'DOCUMENT' && (
          <DocumentReviewModal
            onClose={() => setActiveModal(null)}
            onSuccess={(msg) => {
              setActiveModal(null)
              showToast(msg)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Card Component ──────────────────────────────────────────────────────────

function IngestionCard({
  title,
  tag,
  icon,
  accentColor,
  description,
  onClick,
  buttonText,
}: {
  title: string
  tag: string
  icon: React.ReactNode
  accentColor: string
  description: string
  onClick: () => void
  buttonText: string
}) {
  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="card"
      style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'var(--color-bg-card, #161c28)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 4,
          height: '100%',
          background: accentColor,
        }}
      />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `rgba(${accentColor === '#38bdf8' ? '56,189,248' : '255,255,255'}, 0.08)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {icon}
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              {title}
            </h3>
          </div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: accentColor, background: `${accentColor}18`, padding: '2px 8px', borderRadius: 4 }}>
            {tag}
          </span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>
          {description}
        </p>
      </div>

      <button
        onClick={onClick}
        className="btn btn-primary"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontSize: '0.85rem',
          padding: '10px 16px',
        }}
      >
        <span>{buttonText}</span>
        <ArrowRight size={14} />
      </button>
    </motion.div>
  )
}

// ─── Modal Shell ─────────────────────────────────────────────────────────────

function ModalShell({
  title,
  subtitle,
  children,
  onClose,
  maxWidth = 850,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  onClose: () => void
  maxWidth?: number
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--color-bg-card, #161c28)',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          padding: '26px 30px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  )
}

// ─── 1. Manual Form Modal ────────────────────────────────────────────────────

function ManualFormModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (msg: string) => void
}) {
  const [tab, setTab] = useState<'PROJECT' | 'COMPENSATION' | 'LEGAL' | 'RR' | 'GIS'>('PROJECT')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectsList, setProjectsList] = useState<{ id: string; code: string; name: string }[]>([])

  // Project Form Fields
  const [projectForm, setProjectForm] = useState({
    project_code: '',
    name: '',
    project_type: 'HIGHWAY',
    state_code: 'MH',
    district_codes: '',
    executing_agency: 'NHAI',
    total_area_ha: '',
    area_acquired_ha: '',
    area_in_possession_ha: '',
    estimated_compensation_inr: '',
    disbursed_compensation_inr: '',
    total_affected_families: '',
    families_compensated: '',
    families_rehabilitated: '',
    rehabilitation_progress_pct: '',
    planned_start_date: '',
    planned_end_date: '',
    notification_3a_date: '',
    notification_3d_date: '',
    legal_case_count: '0',
    latitude: '',
    longitude: '',
  })

  // Child record fields
  const [childForm, setChildForm] = useState({
    project_id: '',
    // Compensation
    awarded_amount_inr: '',
    disbursed_amount_inr: '',
    award_date: '',
    disbursement_date: '',
    // Legal
    case_status: 'FILED',
    filing_date: '',
    resolution_date: '',
    // R&R
    total_families_to_rehabilitate: '',
    families_relocated: '',
    resettlement_site_ready: false,
    // GIS
    khasra_number: '',
    village: '',
    tehsil: '',
    district: '',
    area_ha: '',
    latitude: '',
    longitude: '',
  })

  useEffect(() => {
    projectsAPI.list({ page_size: 50 }).then((res: any) => {
      setProjectsList((res.items || []).map((p: any) => ({ id: p.id, code: p.project_code, name: p.name })))
      if (res.items?.length > 0) {
        setChildForm((prev) => ({ ...prev, project_id: res.items[0].id }))
      }
    }).catch(console.error)
  }, [])

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Strong client-side validation check
    const totalArea = Number(projectForm.total_area_ha) || 0
    const acquiredArea = Number(projectForm.area_acquired_ha) || 0
    if (acquiredArea > totalArea && totalArea > 0) {
      setError(`Acquired area (${acquiredArea} ha) cannot exceed total area (${totalArea} ha).`)
      return
    }
    const sanctioned = Number(projectForm.estimated_compensation_inr) || 0
    const disbursed = Number(projectForm.disbursed_compensation_inr) || 0
    if (disbursed > sanctioned && sanctioned > 0) {
      setError(`Disbursed compensation cannot exceed sanctioned compensation.`)
      return
    }

    setSubmitting(true)
    try {
      const payload: any = { ...projectForm }
      if (projectForm.district_codes) {
        payload.district_codes = projectForm.district_codes.split(',').map((d) => d.trim()).filter(Boolean)
      }
      await ingestionAPI.manual({
        entity_type: 'PROJECT',
        data: payload,
      })
      onSuccess(`Project ${projectForm.project_code} created successfully! ML delay prediction generated.`)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to submit project.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChildSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!childForm.project_id) {
      setError('Please select a project.')
      return
    }

    setSubmitting(true)
    try {
      let entityType = 'COMPENSATION'
      let data: any = { project_id: childForm.project_id }

      if (tab === 'COMPENSATION') {
        entityType = 'COMPENSATION'
        data.awarded_amount_inr = Number(childForm.awarded_amount_inr)
        data.disbursed_amount_inr = Number(childForm.disbursed_amount_inr)
        data.award_date = childForm.award_date || null
        data.disbursement_date = childForm.disbursement_date || null
      } else if (tab === 'LEGAL') {
        entityType = 'LEGAL_CASE'
        data.case_status = childForm.case_status
        data.filing_date = childForm.filing_date || null
        data.resolution_date = childForm.resolution_date || null
      } else if (tab === 'RR') {
        entityType = 'RR_RECORD'
        data.total_families_to_rehabilitate = Number(childForm.total_families_to_rehabilitate)
        data.families_relocated = Number(childForm.families_relocated)
        data.resettlement_site_ready = childForm.resettlement_site_ready
      } else if (tab === 'GIS') {
        entityType = 'GIS'
        data.khasra_number = childForm.khasra_number
        data.village = childForm.village
        data.district = childForm.district
        data.area_ha = Number(childForm.area_ha) || null
        data.latitude = Number(childForm.latitude) || null
        data.longitude = Number(childForm.longitude) || null
      }

      await ingestionAPI.manual({ entity_type: entityType, data })
      onSuccess(`Record for ${entityType} added successfully! Project state updated.`)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      title="Manual Form Data Ingestion"
      subtitle="Input verified operational data directly into LADRIS."
      onClose={onClose}
      maxWidth={900}
    >
      {/* Entity Tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12, marginBottom: 20 }}>
        {(['PROJECT', 'COMPENSATION', 'LEGAL', 'RR', 'GIS'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setError(null) }}
            className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            {t === 'PROJECT' ? 'Project Master' : t === 'COMPENSATION' ? 'Compensation Record' : t === 'LEGAL' ? 'Legal / Disputes' : t === 'RR' ? 'R&R Record' : 'GIS Parcel'}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '10px 14px', borderRadius: 6, fontSize: '0.82rem', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {tab === 'PROJECT' ? (
        <form onSubmit={handleProjectSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
            <label>
              <span className="input-label">Project Code *</span>
              <input required className="input" placeholder="e.g. NHAI-MH-801" value={projectForm.project_code} onChange={(e) => setProjectForm({ ...projectForm, project_code: e.target.value })} />
            </label>
            <label style={{ gridColumn: 'span 2' }}>
              <span className="input-label">Project Name *</span>
              <input required className="input" placeholder="e.g. Pune-Nashik Industrial Expressway" value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} />
            </label>
            <label>
              <span className="input-label">Sector / Type</span>
              <select className="input" value={projectForm.project_type} onChange={(e) => setProjectForm({ ...projectForm, project_type: e.target.value })}>
                {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </label>
            <label>
              <span className="input-label">State Code *</span>
              <select className="input" value={projectForm.state_code} onChange={(e) => setProjectForm({ ...projectForm, state_code: e.target.value })}>
                {STATES.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
              </select>
            </label>
            <label>
              <span className="input-label">Districts (comma separated)</span>
              <input className="input" placeholder="e.g. Pune, Ahmednagar" value={projectForm.district_codes} onChange={(e) => setProjectForm({ ...projectForm, district_codes: e.target.value })} />
            </label>
            <label>
              <span className="input-label">Implementing Agency</span>
              <input className="input" placeholder="e.g. NHAI, MSRDC" value={projectForm.executing_agency} onChange={(e) => setProjectForm({ ...projectForm, executing_agency: e.target.value })} />
            </label>
            <label>
              <span className="input-label">Total Land Area (ha)</span>
              <input type="number" step="any" min="0" className="input" placeholder="e.g. 450.5" value={projectForm.total_area_ha} onChange={(e) => setProjectForm({ ...projectForm, total_area_ha: e.target.value })} />
            </label>
            <label>
              <span className="input-label">Area Acquired (ha)</span>
              <input type="number" step="any" min="0" className="input" placeholder="e.g. 200.0" value={projectForm.area_acquired_ha} onChange={(e) => setProjectForm({ ...projectForm, area_acquired_ha: e.target.value })} />
            </label>
            <label>
              <span className="input-label">Sanctioned Cost (₹)</span>
              <input type="number" step="any" min="0" className="input" placeholder="e.g. 50000000" value={projectForm.estimated_compensation_inr} onChange={(e) => setProjectForm({ ...projectForm, estimated_compensation_inr: e.target.value })} />
            </label>
            <label>
              <span className="input-label">Disbursed Cost (₹)</span>
              <input type="number" step="any" min="0" className="input" placeholder="e.g. 25000000" value={projectForm.disbursed_compensation_inr} onChange={(e) => setProjectForm({ ...projectForm, disbursed_compensation_inr: e.target.value })} />
            </label>
            <label>
              <span className="input-label">Total Affected Families</span>
              <input type="number" min="0" className="input" placeholder="e.g. 250" value={projectForm.total_affected_families} onChange={(e) => setProjectForm({ ...projectForm, total_affected_families: e.target.value })} />
            </label>
            <label>
              <span className="input-label">Families Compensated</span>
              <input type="number" min="0" className="input" placeholder="e.g. 150" value={projectForm.families_compensated} onChange={(e) => setProjectForm({ ...projectForm, families_compensated: e.target.value })} />
            </label>
            <label>
              <span className="input-label">Planned Start Date</span>
              <input type="date" className="input" value={projectForm.planned_start_date} onChange={(e) => setProjectForm({ ...projectForm, planned_start_date: e.target.value })} />
            </label>
            <label>
              <span className="input-label">Target Completion Date</span>
              <input type="date" className="input" value={projectForm.planned_end_date} onChange={(e) => setProjectForm({ ...projectForm, planned_end_date: e.target.value })} />
            </label>
            <label>
              <span className="input-label">Section 3A Date</span>
              <input type="date" className="input" value={projectForm.notification_3a_date} onChange={(e) => setProjectForm({ ...projectForm, notification_3a_date: e.target.value })} />
            </label>
            <label>
              <span className="input-label">Section 3D Date</span>
              <input type="date" className="input" value={projectForm.notification_3d_date} onChange={(e) => setProjectForm({ ...projectForm, notification_3d_date: e.target.value })} />
            </label>
            <label>
              <span className="input-label">Latitude</span>
              <input type="number" step="any" min="-90" max="90" className="input" placeholder="e.g. 18.5204" value={projectForm.latitude} onChange={(e) => setProjectForm({ ...projectForm, latitude: e.target.value })} />
            </label>
            <label>
              <span className="input-label">Longitude</span>
              <input type="number" step="any" min="-180" max="180" className="input" placeholder="e.g. 73.8567" value={projectForm.longitude} onChange={(e) => setProjectForm({ ...projectForm, longitude: e.target.value })} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving Project…' : 'Save Project'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleChildSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
            <label style={{ gridColumn: 'span 2' }}>
              <span className="input-label">Associate with Project *</span>
              <select className="input" value={childForm.project_id} onChange={(e) => setChildForm({ ...childForm, project_id: e.target.value })}>
                {projectsList.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </label>

            {tab === 'COMPENSATION' && (
              <>
                <label>
                  <span className="input-label">Sanctioned Amount (₹) *</span>
                  <input required type="number" min="0" step="any" className="input" value={childForm.awarded_amount_inr} onChange={(e) => setChildForm({ ...childForm, awarded_amount_inr: e.target.value })} placeholder="e.g. 500000" />
                </label>
                <label>
                  <span className="input-label">Disbursed Amount (₹) *</span>
                  <input required type="number" min="0" step="any" className="input" value={childForm.disbursed_amount_inr} onChange={(e) => setChildForm({ ...childForm, disbursed_amount_inr: e.target.value })} placeholder="e.g. 500000" />
                </label>
                <label>
                  <span className="input-label">Award Date</span>
                  <input type="date" className="input" value={childForm.award_date} onChange={(e) => setChildForm({ ...childForm, award_date: e.target.value })} />
                </label>
                <label>
                  <span className="input-label">Disbursement Date</span>
                  <input type="date" className="input" value={childForm.disbursement_date} onChange={(e) => setChildForm({ ...childForm, disbursement_date: e.target.value })} />
                </label>
              </>
            )}

            {tab === 'LEGAL' && (
              <>
                <label>
                  <span className="input-label">Case Status</span>
                  <select className="input" value={childForm.case_status} onChange={(e) => setChildForm({ ...childForm, case_status: e.target.value })}>
                    <option value="FILED">FILED</option>
                    <option value="HEARING">HEARING</option>
                    <option value="STAYED">STAYED</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="DISMISSED">DISMISSED</option>
                  </select>
                </label>
                <label>
                  <span className="input-label">Filing Date</span>
                  <input type="date" className="input" value={childForm.filing_date} onChange={(e) => setChildForm({ ...childForm, filing_date: e.target.value })} />
                </label>
                <label>
                  <span className="input-label">Resolution Date</span>
                  <input type="date" className="input" value={childForm.resolution_date} onChange={(e) => setChildForm({ ...childForm, resolution_date: e.target.value })} />
                </label>
              </>
            )}

            {tab === 'RR' && (
              <>
                <label>
                  <span className="input-label">Total Families to Resettle *</span>
                  <input required type="number" min="0" className="input" value={childForm.total_families_to_rehabilitate} onChange={(e) => setChildForm({ ...childForm, total_families_to_rehabilitate: e.target.value })} />
                </label>
                <label>
                  <span className="input-label">Families Relocated So Far</span>
                  <input type="number" min="0" className="input" value={childForm.families_relocated} onChange={(e) => setChildForm({ ...childForm, families_relocated: e.target.value })} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <input type="checkbox" checked={childForm.resettlement_site_ready} onChange={(e) => setChildForm({ ...childForm, resettlement_site_ready: e.target.checked })} />
                  <span style={{ fontSize: '0.85rem' }}>Resettlement Site Ready & Developed</span>
                </label>
              </>
            )}

            {tab === 'GIS' && (
              <>
                <label>
                  <span className="input-label">Survey / Khasra No.</span>
                  <input className="input" value={childForm.khasra_number} onChange={(e) => setChildForm({ ...childForm, khasra_number: e.target.value })} placeholder="e.g. 104/A" />
                </label>
                <label>
                  <span className="input-label">Village</span>
                  <input className="input" value={childForm.village} onChange={(e) => setChildForm({ ...childForm, village: e.target.value })} placeholder="e.g. Rampur" />
                </label>
                <label>
                  <span className="input-label">Area (ha)</span>
                  <input type="number" step="any" min="0" className="input" value={childForm.area_ha} onChange={(e) => setChildForm({ ...childForm, area_ha: e.target.value })} placeholder="e.g. 4.2" />
                </label>
                <label>
                  <span className="input-label">Latitude</span>
                  <input type="number" step="any" min="-90" max="90" className="input" value={childForm.latitude} onChange={(e) => setChildForm({ ...childForm, latitude: e.target.value })} placeholder="e.g. 18.5204" />
                </label>
                <label>
                  <span className="input-label">Longitude</span>
                  <input type="number" step="any" min="-180" max="180" className="input" value={childForm.longitude} onChange={(e) => setChildForm({ ...childForm, longitude: e.target.value })} placeholder="e.g. 73.8567" />
                </label>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving Record…' : 'Save Record'}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  )
}

// ─── 2. CSV / Excel Modal ────────────────────────────────────────────────────

function CSVImportModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (msg: string) => void
}) {
  const [step, setStep] = useState<'UPLOAD' | 'MAP' | 'SUMMARY'>('UPLOAD')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<CSVPreviewData | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [showManualMapping, setShowManualMapping] = useState(false)
  const [summary, setSummary] = useState<CSVImportSummaryData | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return
    const selected = e.target.files[0]
    setError(null)
    setLoading(true)
    try {
      const data = await ingestionAPI.previewSpreadsheet(selected)
      setPreview(data)
      setMapping(data.suggested_mappings || {})
      setStep('MAP')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to read file preview.')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!preview) return
    setLoading(true)
    setError(null)
    try {
      const res = await ingestionAPI.importSpreadsheet({
        file_id: preview.file_id,
        column_mapping: mapping,
        target_entity: 'PROJECT',
        source_name: preview.file_name,
      })
      setSummary(res)
      setStep('SUMMARY')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Import failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell
      title="Upload CSV / Excel Spreadsheet"
      subtitle="Bulk import projects or operational records with instant AI delay risk prediction."
      onClose={onClose}
      maxWidth={1020}
    >
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '10px 14px', borderRadius: 6, fontSize: '0.82rem', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'UPLOAD' && (
        <div style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div
            style={{
              border: '2px dashed rgba(255,255,255,0.15)',
              borderRadius: 12,
              padding: '40px 20px',
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.02)',
            }}
            onClick={() => document.getElementById('csv-upload-input')?.click()}
          >
            <Upload size={36} style={{ color: 'var(--color-accent-primary, #38bdf8)', margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              Click or drag .csv, .xls, or .xlsx file to upload
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
              Files up to 50MB supported with automatic column detection.
            </p>
            <input
              id="csv-upload-input"
              type="file"
              accept=".csv,.xls,.xlsx"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                const sampleCsv = `Project Code,Project Name,Project Type,State,Total Area (ha),Area Acquired (ha),Area in Possession,Affected Families,Families Compensated,Families Rehabilitated,R&R Progress %,Compensation Sanctioned,Compensation Disbursed,Planned Start Date,Expected Completion,Notification Date,Open Disputes,Latitude,Longitude
NHAI-EXP-PB-101,Delhi-Amritsar-Katra Expressway Section 3,HIGHWAY,PB,145.5,140.0,138.0,320,315,310,96.0,180000000,174000000,2023-01-15,2025-12-31,2022-04-10,0,31.6340,74.8723
MRIDC-RAIL-MH-202,Pune-Nashik Semi High-Speed Rail Corridor,RAILWAY,MH,260.0,195.0,150.0,850,680,450,58.0,360000000,285000000,2022-09-01,2026-06-30,2021-11-15,2,18.5204,73.8567
UPSIDA-IND-UP-303,Lucknow-Kanpur Industrial Corridor Node A,INDUSTRIAL_CORRIDOR,UP,410.0,160.0,95.0,1450,720,210,22.0,580000000,310000000,2022-03-10,2025-08-31,2021-05-20,7,26.8467,80.9462
BMRCL-METRO-KA-404,Bengaluru Metro Phase 3 Outer Ring Road,METRO_RAIL,KA,54.2,48.5,45.0,290,275,260,88.0,220000000,205000000,2023-05-01,2026-12-31,2022-08-14,1,12.9716,77.5946
TSIIC-AIR-TG-505,Warangal Greenfield Airport Expansion,AIRPORT,TG,325.0,110.0,65.0,980,420,150,18.0,440000000,190000000,2022-01-10,2025-06-30,2020-09-12,5,17.9689,79.5941`
                const blob = new Blob([sampleCsv], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'ladris_5_sample_projects.csv'
                a.click()
              }}
              style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={14} />
              Download Sample CSV Template
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Clean Table Preview */}
      {step === 'MAP' && preview && (
        <div>
          {/* Top Info Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-bg-secondary, rgba(255,255,255,0.03))',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 16,
            border: '1px solid var(--color-border-subtle, rgba(255,255,255,0.08))',
          }}>
            <div>
              <div style={{ fontSize: '0.92rem', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                Spreadsheet Extracted: <span style={{ color: 'var(--color-accent-primary, #38bdf8)' }}>{preview.file_name}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <CheckCircle2 size={14} />
                <span>All {preview.total_rows} rows extracted • Columns mapped automatically</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowManualMapping(!showManualMapping)}
              style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textDecoration: 'underline' }}
            >
              {showManualMapping ? 'Hide Column Mapping' : 'Customize Mapping (Optional)'}
            </button>
          </div>

          {/* Optional Collapsible Mapping Grid (Hidden by default) */}
          {showManualMapping && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: 8, marginBottom: 18, border: '1px solid rgba(255,255,255,0.05)' }}>
              <h4 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 10px' }}>
                Column Mapping Overrides:
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                {preview.columns.map((col) => (
                  <div key={col} style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 8px', borderRadius: 6 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Column: <strong>{col}</strong>
                    </div>
                    <select
                      className="input"
                      style={{ fontSize: '0.75rem', padding: '3px 6px' }}
                      value={mapping[col] || ''}
                      onChange={(e) => setMapping({ ...mapping, [col]: e.target.value })}
                    >
                      <option value="">(Ignore Column)</option>
                      {preview.available_target_fields.map((f) => (
                        <option key={f.field} value={f.field}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prominent Sample Rows Table Preview */}
          <div style={{
            background: 'var(--color-bg-primary, rgba(0,0,0,0.25))',
            borderRadius: 8,
            border: '1px solid var(--color-border-subtle, rgba(255,255,255,0.08))',
            overflow: 'hidden',
            marginBottom: 20,
          }}>
            <div style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--color-border-subtle, rgba(255,255,255,0.06))', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              Extracted Project Records Preview ({preview.sample_rows.length} of {preview.total_rows} rows)
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 340 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-primary)', position: 'sticky', top: 0, zIndex: 2 }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>#</th>
                    {preview.columns.map((col) => (
                      <th key={col} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample_rows.map((row, r_i) => (
                    <tr key={r_i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: r_i % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                      <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{r_i + 1}</td>
                      {preview.columns.map((col) => (
                        <td key={col} style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={() => setStep('UPLOAD')}>
              Upload Different File
            </button>
            <button className="btn btn-primary" onClick={handleImport} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {loading ? (
                <>
                  <div className="spinner-sm" />
                  <span>Importing & Triggering ML Model…</span>
                </>
              ) : (
                <span>Confirm & Import All {preview.total_rows} Projects →</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Summary */}
      {step === 'SUMMARY' && summary && (
        <div>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle2 size={42} style={{ color: '#10b981', margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              Import Completed
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '4px 0 20px' }}>
              Records normalized, validated, and synchronized with ML delay prediction model.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            <StatBox label="Total Rows" value={summary.total_rows} />
            <StatBox label="Imported" value={summary.imported_rows} color="#10b981" />
            <StatBox label="Duplicates" value={summary.duplicate_rows} color="#f59e0b" />
            <StatBox label="Rejected" value={summary.rejected_rows} color="#ef4444" />
          </div>

          {summary.rejected_rows > 0 && summary.error_report_url && (
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '14px 18px', borderRadius: 8, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f87171', margin: 0 }}>
                    {summary.rejected_rows} row(s) failed validation checks
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                    Download the detailed rejection report containing row numbers and exact reasons.
                  </p>
                </div>
                <a
                  href={summary.error_report_url}
                  download
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#f87171' }}
                >
                  <Download size={14} />
                  Download Error CSV
                </a>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => onSuccess(`Imported ${summary.imported_rows} projects from ${preview?.file_name}`)}>
              Done
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '14px', textAlign: 'center' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: color || 'var(--color-text-primary)' }}>{value}</div>
    </div>
  )
}

// ─── 3. Connect API Modal ────────────────────────────────────────────────────

function ConnectAPIModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (msg: string) => void
}) {
  const [apiKey] = useState('ladris-secure-api-key-default')
  const [jsonPayload, setJsonPayload] = useState(
    JSON.stringify(
      {
        source_name: 'PM_GATI_SHAKTI_INTEGRATION',
        reporting_period: '2026-Q1',
        projects: [
          {
            project_code: `API-EXT-${Math.floor(Math.random() * 900 + 100)}`,
            name: 'Surat-Chennai Economic Corridor Package 4',
            project_type: 'HIGHWAY',
            state_code: 'GJ',
            district_codes: ['Surat', 'Navsari'],
            total_area_ha: 320.5,
            area_acquired_ha: 210.0,
            estimated_compensation_inr: 45000000,
            disbursed_compensation_inr: 30000000,
            planned_start_date: '2024-06-01',
            planned_end_date: '2027-12-31',
            latitude: 21.1702,
            longitude: 72.8311,
          },
        ],
      },
      null,
      2
    )
  )
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    setLoading(true)
    try {
      const parsed = JSON.parse(jsonPayload)
      const res = await ingestionAPI.externalBatch(parsed)
      setResponse(res)
      onSuccess(`External API batch sent: ${res.imported} imported, ${res.duplicates} duplicates.`)
    } catch (e: any) {
      setResponse({ error: e?.response?.data?.detail || e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell
      title="REST API Push Ingestion"
      subtitle="Authorized government and partner systems can send structured JSON payloads directly."
      onClose={onClose}
      maxWidth={850}
    >
      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '14px 18px', borderRadius: 8, marginBottom: 18, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
          <strong>Endpoint:</strong> <code style={{ color: '#38bdf8' }}>POST /api/v1/ingestion/external</code>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
          <strong>Authentication Header:</strong> <code style={{ color: '#38bdf8' }}>X-API-Key: {apiKey}</code>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
          Idempotency supported via optional <code style={{ color: '#38bdf8' }}>Idempotency-Key</code> header or unique <code style={{ color: '#38bdf8' }}>project_code</code>.
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Interactive Batch JSON Payload Tester:
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>JSON Format</span>
        </div>
        <textarea
          rows={10}
          className="input"
          style={{ fontFamily: 'monospace', fontSize: '0.8rem', width: '100%' }}
          value={jsonPayload}
          onChange={(e) => setJsonPayload(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={handleSend} disabled={loading}>
          {loading ? 'Sending Request…' : 'Send Test Ingestion Request'}
        </button>
      </div>

      {response && (
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: response.error ? '#ef4444' : '#10b981', marginBottom: 6 }}>
            {response.error ? 'Response: Error' : 'Response: 200 OK'}
          </div>
          <pre style={{ fontSize: '0.75rem', margin: 0, overflowX: 'auto', color: 'var(--color-text-secondary)' }}>
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </ModalShell>
  )
}

// ─── 4. Database Import Modal ────────────────────────────────────────────────

function DatabaseImportModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (msg: string) => void
}) {
  const [tableName, setTableName] = useState('bhoomirashi_projects')
  const [testing, setTesting] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleTest = async () => {
    setTesting(true)
    setError(null)
    try {
      const res = await ingestionAPI.testDatabase({ table_name: tableName, limit: 5 })
      if (!res.success) {
        setError(res.error || 'Connection failed.')
      } else {
        setPreview(res)
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'Database test failed.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <ModalShell
      title="Import Database Data"
      subtitle="Connect to authorized PostgreSQL or external departmental databases using configured credentials."
      onClose={onClose}
      maxWidth={750}
    >
      <div style={{ marginBottom: 16 }}>
        <label>
          <span className="input-label">External Table / View Name *</span>
          <input
            className="input"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="e.g. state_land_records or projects_export"
          />
        </label>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
          Credentials loaded securely from backend environment variables (EXTERNAL_DB_URL).
        </p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '10px 14px', borderRadius: 6, fontSize: '0.82rem', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleTest} disabled={testing}>
          {testing ? 'Testing Connection…' : 'Test Connection & Preview'}
        </button>
      </div>

      {preview && preview.success && (
        <div>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 10px' }}>
            Table Columns Detected ({preview.columns.length}):
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {preview.columns.map((c: string) => (
              <span key={c} style={{ background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem' }}>
                {c}
              </span>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => onSuccess(`Connected to table ${tableName} successfully.`)}>
            Import Records
          </button>
        </div>
      )}
    </ModalShell>
  )
}

// ─── 5. Upload GIS Data Modal ────────────────────────────────────────────────

function GISUploadModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (msg: string) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gisResult, setGisResult] = useState<GISIngestionData | null>(null)
  const [projectsList, setProjectsList] = useState<{ id: string; code: string; name: string }[]>([])
  const [selectedProject, setSelectedProject] = useState('')

  useEffect(() => {
    projectsAPI.list({ page_size: 50 }).then((res: any) => {
      setProjectsList((res.items || []).map((p: any) => ({ id: p.id, code: p.project_code, name: p.name })))
    }).catch(console.error)
  }, [])

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const res = await ingestionAPI.uploadGIS(file, selectedProject || undefined)
      setGisResult(res)
      onSuccess(res.message)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'GIS upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <ModalShell
      title="Upload GIS Spatial Data"
      subtitle="Import GeoJSON, KML, zipped Shapefiles, or CSV coordinates into PostGIS."
      onClose={onClose}
      maxWidth={800}
    >
      <div style={{ marginBottom: 16 }}>
        <label>
          <span className="input-label">Link to Project (Optional)</span>
          <select className="input" value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
            <option value="">(Standalone GIS Alignment / Parcels)</option>
            {projectsList.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </label>
      </div>

      <div
        style={{
          border: '2px dashed rgba(255,255,255,0.15)',
          borderRadius: 10,
          padding: '30px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.02)',
          marginBottom: 16,
        }}
        onClick={() => document.getElementById('gis-file-input')?.click()}
      >
        <MapPin size={32} style={{ color: '#2dd4bf', margin: '0 auto 8px' }} />
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {file ? file.name : 'Select GeoJSON, KML, Shapefile (.zip), or CSV file'}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
          Validates geometry topology, closure, and coordinate bounds (EPSG:4326).
        </div>
        <input
          id="gis-file-input"
          type="file"
          accept=".geojson,.json,.kml,.zip,.csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.[0]) setFile(e.target.files[0])
          }}
        />
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '10px 14px', borderRadius: 6, fontSize: '0.82rem', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? 'Processing & Validating Geometries…' : 'Process & Ingest GIS'}
        </button>
      </div>

      {gisResult && (
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: 8, border: '1px solid rgba(45, 212, 191, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2dd4bf', fontWeight: 600, fontSize: '0.9rem', marginBottom: 8 }}>
            <CheckCircle2 size={16} />
            {gisResult.message}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: '0.8rem', marginTop: 10 }}>
            <div>Total Features: <strong>{gisResult.total_features}</strong></div>
            <div>Valid Polygons/Points: <strong style={{ color: '#10b981' }}>{gisResult.valid_features}</strong></div>
            <div>Geometry Types: <strong>{gisResult.geometry_types.join(', ')}</strong></div>
          </div>
          {gisResult.bounding_box && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8 }}>
              Bounding Box: [{gisResult.bounding_box.map((v) => v.toFixed(4)).join(', ')}]
            </div>
          )}
        </div>
      )}
    </ModalShell>
  )
}

// ─── 6. PDF Document Review Screen Modal ─────────────────────────────────────

function DocumentReviewModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (msg: string) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [docType, setDocType] = useState('NOTIFICATION')
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<DocumentExtractData | null>(null)
  const [confirmedFields, setConfirmedFields] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)

  const handleExtract = async () => {
    if (!file) return
    setExtracting(true)
    setError(null)
    try {
      const res = await ingestionAPI.extractDocument(file, docType)
      setExtracted(res)
      setConfirmedFields(res.extracted_fields || {})
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Document extraction failed.')
    } finally {
      setExtracting(false)
    }
  }

  const handleConfirm = async () => {
    if (!extracted) return
    setSaving(true)
    setError(null)
    try {
      await ingestionAPI.confirmDocument({
        document_id: extracted.document_id,
        confirmed_fields: confirmedFields,
        create_project: true,
      })
      onSuccess(`Document verified and incorporated into LADRIS: ${extracted.file_name}`)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Confirmation failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell
      title="Document Extraction & Verification Screen"
      subtitle="Extract text and fields from PDF notifications, awards, and SIA reports with human verification."
      onClose={onClose}
      maxWidth={900}
    >
      {!extracted ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 16 }}>
            <label>
              <span className="input-label">Document Type</span>
              <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
                <option value="NOTIFICATION">Section 3A / 4 Gazette Notification</option>
                <option value="AWARD">Section 23 / 3G Compensation Award</option>
                <option value="SIA_REPORT">Social Impact Assessment (SIA) Report</option>
                <option value="COURT_ORDER">High Court / Supreme Court Order</option>
                <option value="COMPENSATION_STATEMENT">Compensation Statement</option>
                <option value="APPROVAL_LETTER">Clearance / Approval Letter</option>
              </select>
            </label>
            <label>
              <span className="input-label">PDF File *</span>
              <input
                type="file"
                accept=".pdf"
                className="input"
                onChange={(e) => {
                  if (e.target.files?.[0]) setFile(e.target.files[0])
                }}
              />
            </label>
          </div>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '10px 14px', borderRadius: 6, fontSize: '0.82rem', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleExtract} disabled={!file || extracting}>
              {extracting ? 'Extracting Text & Fields…' : 'Extract Document Fields'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem' }}>
              <AlertCircle size={16} />
              Human Verification Required
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
              Extracted fields are suggestions. Please review and edit any values below before confirming import.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, maxHeight: 350, overflowY: 'auto', paddingRight: 4, marginBottom: 20 }}>
            <label>
              <span className="input-label">Project Code</span>
              <input
                className="input"
                value={confirmedFields.project_code || ''}
                onChange={(e) => setConfirmedFields({ ...confirmedFields, project_code: e.target.value })}
                placeholder="e.g. NHAI-EXT-401"
              />
            </label>
            <label>
              <span className="input-label">Project Name</span>
              <input
                className="input"
                value={confirmedFields.project_name || ''}
                onChange={(e) => setConfirmedFields({ ...confirmedFields, project_name: e.target.value })}
                placeholder="e.g. NH-44 Varanasi Bypass"
              />
            </label>
            <label>
              <span className="input-label">Gazette / Notification Ref</span>
              <input
                className="input"
                value={confirmedFields.notification_number || ''}
                onChange={(e) => setConfirmedFields({ ...confirmedFields, notification_number: e.target.value })}
                placeholder="e.g. S.O. 1234(E)"
              />
            </label>
            <label>
              <span className="input-label">Notification Date</span>
              <input
                type="date"
                className="input"
                value={confirmedFields.notification_date || ''}
                onChange={(e) => setConfirmedFields({ ...confirmedFields, notification_date: e.target.value })}
              />
            </label>
            <label>
              <span className="input-label">State Code</span>
              <input
                className="input"
                maxLength={3}
                value={confirmedFields.state_code || ''}
                onChange={(e) => setConfirmedFields({ ...confirmedFields, state_code: e.target.value.toUpperCase() })}
                placeholder="e.g. UP, MH"
              />
            </label>
            <label>
              <span className="input-label">District</span>
              <input
                className="input"
                value={confirmedFields.district || ''}
                onChange={(e) => setConfirmedFields({ ...confirmedFields, district: e.target.value })}
                placeholder="e.g. Varanasi"
              />
            </label>
            <label>
              <span className="input-label">Total Land Area (ha)</span>
              <input
                type="number"
                step="any"
                min="0"
                className="input"
                value={confirmedFields.total_area_ha || ''}
                onChange={(e) => setConfirmedFields({ ...confirmedFields, total_area_ha: e.target.value })}
              />
            </label>
            <label>
              <span className="input-label">Sanctioned / Award Cost (₹)</span>
              <input
                type="number"
                step="any"
                min="0"
                className="input"
                value={confirmedFields.estimated_compensation_inr || ''}
                onChange={(e) => setConfirmedFields({ ...confirmedFields, estimated_compensation_inr: e.target.value })}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setExtracted(null)}>Back</button>
            <button className="btn btn-primary" onClick={handleConfirm} disabled={saving}>
              {saving ? 'Confirming & Incorporating…' : 'Confirm & Ingest into LADRIS'}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  )
}
