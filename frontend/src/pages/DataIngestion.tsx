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
  Sparkles,
  Layers,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Code,
  Terminal,
  Info,
  HelpCircle,
  FileCode,
} from 'lucide-react'
import { ingestionAPI, projectsAPI } from '@/api/client'
import type {
  CSVPreviewData,
  CSVImportSummaryData,
  GISIngestionData,
  MultiDocumentExtractData,
  DocumentConfirmResult,
  DatabaseTestResult,
  DatabaseImportResult,
  ExternalIngestionResult,
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
  const [downloadingSamples, setDownloadingSamples] = useState(false)

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                id="btn-download-sample-docs-modal"
                onClick={async () => {
                  setDownloadingSamples(true)
                  try {
                    await ingestionAPI.downloadSampleDocuments()
                    showToast('Sample documents package (.zip) downloaded successfully!')
                  } catch (e) {
                    showToast('Failed to download sample documents.')
                  } finally {
                    setDownloadingSamples(false)
                  }
                }}
                disabled={downloadingSamples}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 14px',
                  borderRadius: 8,
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(99, 102, 241, 0.15))',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                  cursor: downloadingSamples ? 'wait' : 'pointer',
                  transition: 'all 0.18s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                }}
                title="Download all sample test files (.csv, .json, .kml, .geojson, .sql, .txt)"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(56, 189, 248, 0.28), rgba(99, 102, 241, 0.28))'
                  e.currentTarget.style.borderColor = '#38bdf8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(99, 102, 241, 0.15))'
                  e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)'
                }}
              >
                <Download size={15} />
                <span>{downloadingSamples ? 'Downloading…' : 'Download Sample Docs'}</span>
              </button>

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
  const [downloadingSamples, setDownloadingSamples] = useState(false)

  const showToast = (msg: string) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(null), 5000)
  }

  const handleDownloadSamples = async () => {
    setDownloadingSamples(true)
    try {
      await ingestionAPI.downloadSampleDocuments()
      showToast('Sample documents package (.zip) downloaded successfully!')
    } catch {
      showToast('Failed to download sample documents.')
    } finally {
      setDownloadingSamples(false)
    }
  }

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', paddingBottom: 60 }}>
      <PageHeader
        title="Data Ingestion"
        subtitle="Add project data from forms, files, APIs, maps, or documents."
        actions={
          <button
            id="btn-download-sample-docs-page"
            onClick={handleDownloadSamples}
            disabled={downloadingSamples}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontWeight: 600,
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(99, 102, 241, 0.15))',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              cursor: downloadingSamples ? 'wait' : 'pointer',
              transition: 'all 0.18s ease',
            }}
            title="Download complete sample test files folder (.zip) for all 6 input methods"
          >
            <Download size={15} />
            <span>{downloadingSamples ? 'Downloading…' : 'Download Sample Docs'}</span>
          </button>
        }
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
  const [isDragging, setIsDragging] = useState(false)

  const processFile = async (selected: File) => {
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return
    processFile(e.target.files[0])
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
        <div style={{ padding: '24px 16px' }}>
          <div
            id="csv-dropzone"
            style={{
              border: isDragging
                ? '2px dashed var(--color-accent-primary, #38bdf8)'
                : '2px dashed rgba(56, 189, 248, 0.45)',
              borderRadius: 14,
              padding: '48px 24px',
              cursor: loading ? 'wait' : 'pointer',
              background: isDragging
                ? 'rgba(56, 189, 248, 0.12)'
                : 'rgba(56, 189, 248, 0.03)',
              textAlign: 'center',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => document.getElementById('csv-upload-input')?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setIsDragging(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              if (e.dataTransfer.files?.[0]) {
                processFile(e.dataTransfer.files[0])
              }
            }}
            onMouseEnter={(e) => {
              if (!isDragging) {
                e.currentTarget.style.borderColor = 'var(--color-accent-primary, #38bdf8)'
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.08)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isDragging) {
                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.45)'
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.03)'
              }
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: '50%',
                background: 'rgba(56, 189, 248, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <Upload size={30} style={{ color: 'var(--color-accent-primary, #38bdf8)' }} />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              Click or drag .csv, .xls, or .xlsx file to upload
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', margin: '8px 0 0' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
            <StatBox label="Total Rows" value={summary.total_rows} />
            <StatBox label="Imported (New)" value={summary.imported_rows} color="#10b981" />
            <StatBox label="Updated" value={summary.updated_rows ?? 0} color="#38bdf8" />
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
            <button className="btn btn-primary" onClick={() => onSuccess(
              summary.imported_rows > 0 && summary.updated_rows === 0
                ? `Imported ${summary.imported_rows} new project(s) from ${preview?.file_name}`
                : summary.updated_rows > 0 && summary.imported_rows === 0
                  ? `Updated ${summary.updated_rows} existing project(s) from ${preview?.file_name}`
                  : `Imported ${summary.imported_rows} new + updated ${summary.updated_rows ?? 0} existing project(s)`
            )}>
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

const SAMPLE_05_PAYLOAD = {
  source_name: 'BhoomiRashi National Data Gateway',
  reporting_period: 'Q2-2026',
  records: [
    {
      project_code: 'NHAI-NH16-PKG7',
      name: 'NH-16 Vijayawada–Rajam Six-Lane Expressway Package-7',
      description: 'Six-laning of NH16 from Anakapalli to Vizianagaram under Bharatmala Pariyojana Phase-I',
      project_type: 'HIGHWAY',
      acquisition_act: 'NH_ACT_1956',
      status: 'DELAYED',
      risk_level: 'CRITICAL',
      nodal_agency: 'MoRTH',
      executing_agency: 'NHAI',
      state_code: 'AP',
      district_codes: ['Visakhapatnam', 'Vizianagaram'],
      tehsil_names: ['Anakapalli', 'Bheemunipatnam', 'Vizianagaram'],
      total_area_ha: 2180.6,
      area_acquired_ha: 1050.0,
      area_in_possession_ha: 620.0,
      total_affected_families: 6200,
      families_compensated: 2800,
      families_rehabilitated: 1900,
      rehabilitation_progress_pct: 30.65,
      planned_start_date: '2020-11-01',
      planned_end_date: '2023-10-31',
      actual_start_date: '2021-04-15',
      baseline_duration_days: 1095,
      estimated_compensation_inr: 650000000.0,
      disbursed_compensation_inr: 195000000.0,
      notification_3a_date: '2021-04-15',
      notification_3d_date: '2022-03-10',
      delay_months: 34,
      delay_reason: 'High Court Interim Stay on 680 Ha in Vizianagaram district; tribal R&R package under revision',
      legal_case_count: 28,
      legal_case_status: 'ACTIVE',
      latitude: 17.7384,
      longitude: 83.2184,
    },
    {
      project_code: 'NHAI-NH27-PKG2',
      name: 'NH-27 Varanasi–Kolkata Expressway Package-2',
      description: 'Greenfield 6-lane access-controlled expressway; Dehri-on-Sone to Sasaram section',
      project_type: 'HIGHWAY',
      acquisition_act: 'RFCTLARR_2013',
      status: 'ACTIVE',
      risk_level: 'MEDIUM',
      nodal_agency: 'MoRTH',
      executing_agency: 'NHAI',
      state_code: 'BR',
      district_codes: ['Rohtas', 'Aurangabad'],
      tehsil_names: ['Dehri', 'Sasaram', 'Obra'],
      total_area_ha: 1640.0,
      area_acquired_ha: 1490.0,
      area_in_possession_ha: 1340.0,
      total_affected_families: 4100,
      families_compensated: 3900,
      families_rehabilitated: 3600,
      rehabilitation_progress_pct: 87.8,
      planned_start_date: '2022-06-01',
      planned_end_date: '2025-05-31',
      actual_start_date: '2022-08-20',
      baseline_duration_days: 1095,
      estimated_compensation_inr: 420000000.0,
      disbursed_compensation_inr: 395000000.0,
      notification_3a_date: '2022-08-20',
      notification_3d_date: '2023-07-18',
      delay_months: 4,
      delay_reason: 'Minor compensation revision for 60 families near Sasaram urban boundary',
      legal_case_count: 3,
      legal_case_status: 'SETTLED',
      latitude: 24.9268,
      longitude: 84.035,
    },
    {
      project_code: 'NHAI-RRTS-DELHI-MRT',
      name: 'Delhi–Meerut Regional Rapid Transit System Package-4',
      description: 'RRTS corridor viaduct and station construction from Sahibabad to Ghaziabad Urban Centre',
      project_type: 'METRO_RAIL',
      acquisition_act: 'RFCTLARR_2013',
      status: 'COMPLETED',
      risk_level: 'LOW',
      nodal_agency: 'MoHUA',
      executing_agency: 'NCRTC',
      state_code: 'UP',
      district_codes: ['Ghaziabad'],
      tehsil_names: ['Sahibabad', 'Ghaziabad'],
      total_area_ha: 64.8,
      area_acquired_ha: 64.8,
      area_in_possession_ha: 64.8,
      total_affected_families: 820,
      families_compensated: 820,
      families_rehabilitated: 820,
      rehabilitation_progress_pct: 100.0,
      planned_start_date: '2019-03-01',
      planned_end_date: '2022-02-28',
      actual_start_date: '2019-05-01',
      actual_end_date: '2023-01-15',
      baseline_duration_days: 1095,
      estimated_compensation_inr: 245000000.0,
      disbursed_compensation_inr: 245000000.0,
      notification_3a_date: '2019-05-01',
      notification_3d_date: '2020-03-25',
      delay_months: 10,
      delay_reason: 'COVID-19 lockdown halted SIA and compensation disbursement for 8 months',
      legal_case_count: 0,
      legal_case_status: 'NONE',
      latitude: 28.6667,
      longitude: 77.4314,
    },
  ],
}

const API_PRESETS = [
  {
    id: 'SAMPLE_DOC_05',
    name: '05_API_Batch_Payload.json',
    badge: '3 Projects',
    data: SAMPLE_05_PAYLOAD,
  },
  {
    id: 'PM_GATISHAKTI',
    name: 'PM-GatiShakti Stream',
    badge: '2 Projects',
    data: {
      source_name: 'PM_GATI_SHAKTI',
      reporting_period: '2026-Q1',
      projects: [
        {
          project_code: 'PMGS-SCEC-PKG4',
          name: 'Surat-Chennai Economic Corridor Package 4',
          project_type: 'HIGHWAY',
          state_code: 'GJ',
          district_codes: ['Surat', 'Navsari'],
          total_area_ha: 340.5,
          area_acquired_ha: 215.0,
          area_in_possession_ha: 160.0,
          estimated_compensation_inr: 480000000,
          disbursed_compensation_inr: 310000000,
          total_affected_families: 420,
          families_compensated: 280,
          families_rehabilitated: 180,
          rehabilitation_progress_pct: 42.8,
          legal_case_count: 2,
          planned_start_date: '2024-06-01',
          planned_end_date: '2027-12-31',
          latitude: 21.1702,
          longitude: 72.8311,
        },
        {
          project_code: 'PMGS-VKEX-PKG2',
          name: 'Varanasi-Kolkata Greenfield Expressway Package 2',
          project_type: 'HIGHWAY',
          state_code: 'JH',
          district_codes: ['Ranchi', 'Ramgarh'],
          total_area_ha: 410.0,
          area_acquired_ha: 190.0,
          area_in_possession_ha: 120.0,
          estimated_compensation_inr: 550000000,
          disbursed_compensation_inr: 230000000,
          total_affected_families: 560,
          families_compensated: 210,
          families_rehabilitated: 110,
          rehabilitation_progress_pct: 20.0,
          legal_case_count: 4,
          planned_start_date: '2024-08-15',
          planned_end_date: '2028-03-31',
          latitude: 23.3441,
          longitude: 85.3096,
        },
      ],
    },
  },
  {
    id: 'BHOOMIRASHI',
    name: 'MoRTH BhoomiRashi',
    badge: '1 Project',
    data: {
      source_name: 'BHOOMIRASHI_PORTAL',
      reporting_period: '2026-Q1',
      projects: [
        {
          project_code: 'BHOOMI-NH44-HYD',
          name: 'NH-44 Hyderabad-Bengaluru Section Four-Laning',
          project_type: 'HIGHWAY',
          state_code: 'TS',
          district_codes: ['Mahbubnagar'],
          total_area_ha: 280.0,
          area_acquired_ha: 210.0,
          area_in_possession_ha: 175.0,
          estimated_compensation_inr: 320000000,
          disbursed_compensation_inr: 240000000,
          total_affected_families: 310,
          families_compensated: 240,
          families_rehabilitated: 190,
          rehabilitation_progress_pct: 61.2,
          legal_case_count: 1,
          planned_start_date: '2024-03-01',
          planned_end_date: '2026-11-30',
          latitude: 16.7488,
          longitude: 77.9944,
        },
      ],
    },
  },
  {
    id: 'BULLET_TRAIN',
    name: 'High-Speed Rail Corridor',
    badge: '1 Project',
    data: {
      source_name: 'NHSRCL_PORTAL',
      reporting_period: '2026-Q1',
      projects: [
        {
          project_code: 'HSR-MAHSR-C3',
          name: 'Mumbai-Ahmedabad Bullet Train Package C3',
          project_type: 'RAILWAY',
          state_code: 'MH',
          district_codes: ['Thane', 'Palghar'],
          total_area_ha: 195.0,
          area_acquired_ha: 160.0,
          area_in_possession_ha: 140.0,
          estimated_compensation_inr: 620000000,
          disbursed_compensation_inr: 510000000,
          total_affected_families: 280,
          families_compensated: 250,
          families_rehabilitated: 210,
          rehabilitation_progress_pct: 75.0,
          legal_case_count: 0,
          planned_start_date: '2023-10-01',
          planned_end_date: '2027-06-30',
          latitude: 19.2183,
          longitude: 72.9781,
        },
      ],
    },
  },
]

function ConnectAPIModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (msg: string) => void
}) {
  const [apiKey] = useState('ladris-secure-api-key-default')
  const [activeTab, setActiveTab] = useState<'PRESETS' | 'CUSTOM' | 'DEV_INTEGRATION'>('PRESETS')
  const [activePreset, setActivePreset] = useState('SAMPLE_DOC_05')
  const [jsonPayload, setJsonPayload] = useState(JSON.stringify(SAMPLE_05_PAYLOAD, null, 2))
  const [parsedData, setParsedData] = useState<any>(SAMPLE_05_PAYLOAD)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [copiedType, setCopiedType] = useState<'curl' | null>(null)
  const [response, setResponse] = useState<ExternalIngestionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDraggingJson, setIsDraggingJson] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [codeLang, setCodeLang] = useState<'curl' | 'python' | 'javascript'>('curl')

  const handleSelectPreset = (presetId: string) => {
    setActivePreset(presetId)
    const preset = API_PRESETS.find((p) => p.id === presetId)
    if (preset) {
      setJsonPayload(JSON.stringify(preset.data, null, 2))
      setParsedData(preset.data)
      setJsonError(null)
      setError(null)
    }
  }

  const handleJsonChange = (val: string) => {
    setJsonPayload(val)
    try {
      const parsed = JSON.parse(val)
      setParsedData(parsed)
      setJsonError(null)
    } catch (err: any) {
      setJsonError(err.message)
    }
  }

  const processJsonFile = (file: File) => {
    setUploadedFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      try {
        const parsed = JSON.parse(content)
        setJsonPayload(JSON.stringify(parsed, null, 2))
        setParsedData(parsed)
        setJsonError(null)
      } catch (err: any) {
        setJsonError(`Invalid JSON: ${err.message}`)
      }
    }
    reader.readAsText(file)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processJsonFile(file)
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedType('curl')
    setTimeout(() => setCopiedType(null), 2000)
  }

  const handleSend = async () => {
    setLoading(true)
    setError(null)
    try {
      let payloadToSubmit: any
      try {
        payloadToSubmit = JSON.parse(jsonPayload)
      } catch (e: any) {
        throw new Error(`Invalid JSON syntax: ${e.message}`)
      }

      const res = await ingestionAPI.externalBatch(payloadToSubmit, apiKey)
      setResponse(res)
      onSuccess(res.message || `Ingested ${res.imported} new, ${res.duplicates} updated.`)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'Ingestion failed.')
    } finally {
      setLoading(false)
    }
  }

  const projectsToPreview: any[] = parsedData?.projects || parsedData?.records || []
  const endpointUrl = `${window.location.origin.replace(/:[0-9]+$/, ':8000')}/api/v1/ingestion/external`

  const getCodeSnippet = (lang: 'curl' | 'python' | 'javascript') => {
    const payloadStr = JSON.stringify(parsedData || SAMPLE_05_PAYLOAD, null, 2)
    if (lang === 'curl') {
      return `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '${payloadStr}'`
    }
    if (lang === 'python') {
      return `import requests

url = "${endpointUrl}"
headers = {
    "Content-Type": "application/json",
    "X-API-Key": "${apiKey}"
}
payload = ${payloadStr}

response = requests.post(url, headers=headers, json=payload)
print(response.status_code, response.json())`
    }
    return `const response = await fetch("${endpointUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${apiKey}"
  },
  body: JSON.stringify(${payloadStr})
});

const result = await response.json();
console.log(result);`
  }

  return (
    <ModalShell
      title="Connect API"
      subtitle="Select a preset stream or upload a JSON payload to run AI delay predictions."
      onClose={onClose}
      maxWidth={880}
    >
      {response && response.projects && response.projects.length > 0 ? (
        <div>
          <div style={{ textAlign: 'center', padding: '10px 0 16px' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 8px auto',
              }}
            >
              <CheckCircle2 size={24} color="#10b981" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              Ingested & Scored Successfully
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              Processed <strong>{response.total}</strong> project(s) ({response.imported} new, {response.duplicates} updated).
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {response.projects.map((p) => {
              const isHigh = p.risk_category === 'HIGH' || p.risk_category === 'CRITICAL'
              const isMed = p.risk_category === 'MEDIUM'
              const badgeColor = isHigh ? '#ef4444' : isMed ? '#f59e0b' : '#10b981'
              const badgeBg = isHigh ? 'rgba(239, 68, 68, 0.15)' : isMed ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'

              return (
                <div
                  key={p.project_id}
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 10,
                    padding: '14px 18px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {p.project_name}
                      </span>
                      <code style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '1px 6px', borderRadius: 4 }}>
                        {p.project_code}
                      </code>
                    </div>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                      background: badgeBg, color: badgeColor, border: `1px solid ${badgeColor}40`
                    }}>
                      {p.risk_category || 'SCORED'} RISK
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
                    <div style={{ background: 'var(--color-bg-tertiary)', padding: '8px 10px', borderRadius: 6 }}>
                      <div style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Risk Score</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: badgeColor }}>{p.risk_score} / 100</div>
                    </div>
                    <div style={{ background: 'var(--color-bg-tertiary)', padding: '8px 10px', borderRadius: 6 }}>
                      <div style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Delay Probability</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {p.delay_probability !== undefined ? `${Math.round(p.delay_probability * 100)}%` : 'N/A'}
                      </div>
                    </div>
                    <div style={{ background: 'var(--color-bg-tertiary)', padding: '8px 10px', borderRadius: 6 }}>
                      <div style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Predicted Delay</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {p.predicted_delay_days !== undefined ? `${Math.round(p.predicted_delay_days)} d` : 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <a
                      href={`/projects/${p.project_id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}
                    >
                      <span>View ML Analytics</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setResponse(null)}>
              Send Another Batch
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Clean 3 Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 16,
              borderBottom: '1px solid var(--color-border-subtle, rgba(255,255,255,0.08))',
              paddingBottom: 8,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('PRESETS')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'PRESETS' ? 'var(--color-accent-primary, #38bdf8)' : 'transparent',
                color: activeTab === 'PRESETS' ? '#fff' : 'var(--color-text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              <Sparkles size={14} />
              <span>Presets</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('CUSTOM')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'CUSTOM' ? 'var(--color-accent-primary, #38bdf8)' : 'transparent',
                color: activeTab === 'CUSTOM' ? '#fff' : 'var(--color-text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              <Code size={14} />
              <span>Upload / Custom JSON</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('DEV_INTEGRATION')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'DEV_INTEGRATION' ? 'var(--color-accent-primary, #38bdf8)' : 'transparent',
                color: activeTab === 'DEV_INTEGRATION' ? '#fff' : 'var(--color-text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              <Terminal size={14} />
              <span>cURL & Developer API</span>
            </button>
          </div>

          {/* TAB 1: PRESETS */}
          {activeTab === 'PRESETS' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
              {API_PRESETS.map((p) => {
                const isSelected = activePreset === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPreset(p.id)}
                    style={{
                      border: isSelected ? '2px solid var(--color-accent-primary, #38bdf8)' : '1px solid var(--color-border-subtle, rgba(255,255,255,0.1))',
                      borderRadius: 10,
                      padding: '12px 14px',
                      background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'var(--color-bg-secondary, rgba(255,255,255,0.02))',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: isSelected ? 'var(--color-accent-primary, #38bdf8)' : 'var(--color-text-primary)', marginBottom: 6 }}>
                      {p.name}
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                        {p.badge}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* TAB 2: CUSTOM JSON */}
          {activeTab === 'CUSTOM' && (
            <div style={{ marginBottom: 16 }}>
              {/* Dotted Rectangle Box Dropzone for JSON file */}
              <div
                id="json-dropzone"
                style={{
                  border: isDraggingJson
                    ? '2px dashed var(--color-accent-primary, #38bdf8)'
                    : uploadedFileName
                    ? '2px solid rgba(16, 185, 129, 0.6)'
                    : '2px dashed rgba(56, 189, 248, 0.45)',
                  borderRadius: 10,
                  padding: uploadedFileName ? '14px 18px' : '24px 18px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDraggingJson
                    ? 'rgba(56, 189, 248, 0.12)'
                    : uploadedFileName
                    ? 'rgba(16, 185, 129, 0.04)'
                    : 'rgba(56, 189, 248, 0.03)',
                  marginBottom: 14,
                  transition: 'all 0.2s ease',
                }}
                onClick={() => document.getElementById('api-json-file-input')?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDraggingJson(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  setIsDraggingJson(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDraggingJson(false)
                  if (e.dataTransfer.files?.[0]) {
                    processJsonFile(e.dataTransfer.files[0])
                  }
                }}
                onMouseEnter={(e) => {
                  if (!isDraggingJson && !uploadedFileName) {
                    e.currentTarget.style.borderColor = 'var(--color-accent-primary, #38bdf8)'
                    e.currentTarget.style.background = 'rgba(56, 189, 248, 0.07)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDraggingJson && !uploadedFileName) {
                    e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.45)'
                    e.currentTarget.style.background = 'rgba(56, 189, 248, 0.03)'
                  }
                }}
              >
                {uploadedFileName ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'rgba(16, 185, 129, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <CheckCircle2 size={18} color="#10b981" />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {uploadedFileName}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#10b981' }}>
                          Loaded into code preview • {projectsToPreview.length} project(s) parsed
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setUploadedFileName(null)
                        setJsonPayload('{\n  "source_name": "Custom Integration",\n  "records": []\n}')
                        setParsedData({ records: [] })
                      }}
                      style={{
                        background: 'none',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: 6,
                        padding: '4px 10px',
                        color: 'var(--color-text-muted)',
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                      }}
                    >
                      Clear File
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      background: 'rgba(56, 189, 248, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 8px auto',
                    }}>
                      <Upload size={20} style={{ color: 'var(--color-accent-primary, #38bdf8)' }} />
                    </div>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                      Click or drag .json file to upload
                    </h4>
                    <p style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                      Automatically parses payload and populates the JSON code preview
                    </p>
                  </>
                )}
                <input
                  id="api-json-file-input"
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
              </div>

              {/* JSON Code Preview Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  <Code size={14} />
                  <span>JSON Code Preview</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: jsonError ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                  {jsonError ? `⚠️ Invalid JSON` : `✅ ${projectsToPreview.length} project(s) ready`}
                </div>
              </div>

              {/* JSON Code Preview Area */}
              <textarea
                rows={11}
                className="input"
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  width: '100%',
                  lineHeight: 1.45,
                  background: 'var(--color-bg-primary)',
                  borderRadius: 8,
                  border: jsonError ? '1px solid #ef4444' : '1px solid var(--color-border-subtle)',
                  padding: '10px 12px',
                }}
                value={jsonPayload}
                onChange={(e) => handleJsonChange(e.target.value)}
                placeholder="Paste JSON here..."
              />
            </div>
          )}

          {/* TAB 3: DEVELOPER / CURL INTEGRATION */}
          {activeTab === 'DEV_INTEGRATION' && (
            <div style={{ marginBottom: 16 }}>
              {/* Explainer Banner */}
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.05)',
                  border: '1px solid rgba(56, 189, 248, 0.18)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-accent-primary, #38bdf8)', fontWeight: 700, fontSize: '0.84rem', marginBottom: 4 }}>
                  <Terminal size={15} />
                  <span>Automated System-to-System REST API</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                  Use this endpoint to stream land acquisition records directly from external government portals (e.g. NHAI BhoomiRashi, PM GatiShakti, MoRTH, State Portals) or automated server cron jobs without needing manual web upload.
                </div>
              </div>

              {/* Endpoint Specs Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Endpoint URL</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: '#38bdf8', marginTop: 2, wordBreak: 'break-all' }}>
                    POST /api/v1/ingestion/external
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Authentication Header</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--color-text-primary)', marginTop: 2 }}>
                    X-API-Key: {apiKey}
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Payload Format</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: '#10b981', marginTop: 2 }}>
                    application/json (Batch Records)
                  </div>
                </div>
              </div>

              {/* Language Switcher & Copy */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['curl', 'python', 'javascript'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setCodeLang(lang)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        background: codeLang === lang ? 'var(--color-accent-primary, #38bdf8)' : 'var(--color-bg-secondary)',
                        color: codeLang === lang ? '#fff' : 'var(--color-text-secondary)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {lang === 'curl' ? 'cURL' : lang === 'python' ? 'Python (requests)' : 'Node.js / JS (fetch)'}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.72rem', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => handleCopy(getCodeSnippet(codeLang))}
                >
                  {copiedType === 'curl' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  <span>{copiedType === 'curl' ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>

              {/* Code Block */}
              <pre
                style={{
                  background: 'var(--color-bg-primary)',
                  padding: '12px 14px',
                  borderRadius: 8,
                  fontSize: '0.74rem',
                  lineHeight: 1.45,
                  overflowX: 'auto',
                  maxHeight: 160,
                  border: '1px solid var(--color-border-subtle)',
                  color: '#94a9c9',
                  fontFamily: 'monospace',
                  margin: 0,
                }}
              >
                {getCodeSnippet(codeLang)}
              </pre>
            </div>
          )}

          {/* STREAM PREVIEW (Projects to be ingested - only for Presets tab) */}
          {activeTab === 'PRESETS' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
                Projects to Ingest ({projectsToPreview.length})
              </div>

              {projectsToPreview.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', background: 'var(--color-bg-secondary)', borderRadius: 8, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                  No projects found in payload.
                </div>
              ) : (
                <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {projectsToPreview.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border-subtle, rgba(255,255,255,0.06))',
                        borderRadius: 8,
                        padding: '8px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {item.name || item.project_name || `Project ${idx + 1}`}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {item.project_type || 'HIGHWAY'} • {item.state_code || 'IN'} • {item.total_area_ha ? `${item.total_area_ha} ha` : ''} {item.estimated_compensation_inr ? `• ₹${(item.estimated_compensation_inr / 10000000).toFixed(1)} Cr` : ''}
                        </div>
                      </div>
                      <code style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 6px', borderRadius: 4 }}>
                        {item.project_code || 'AUTOGEN'}
                      </code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '10px 14px', borderRadius: 6, fontSize: '0.8rem', marginBottom: 14 }}>
              {error}
            </div>
          )}

          {/* Action Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            {activeTab === 'DEV_INTEGRATION' ? (
              <button
                className="btn btn-primary"
                onClick={handleSend}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    <span>Testing Endpoint…</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>Send Test API Request</span>
                  </>
                )}
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleSend}
                disabled={loading || projectsToPreview.length === 0 || !!jsonError}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    <span>Processing…</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>Import {projectsToPreview.length > 0 ? `${projectsToPreview.length} Projects` : ''} & Predict Delays</span>
                  </>
                )}
              </button>
            )}
          </div>
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
  const [importMode, setImportMode] = useState<'sql_file' | 'live_connection'>('sql_file')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loadingSample, setLoadingSample] = useState(false)
  const [tableName, setTableName] = useState('external_la_projects')
  const [connectionUrl, setConnectionUrl] = useState('')
  const [showAdvUrl, setShowAdvUrl] = useState(false)
  const [testing, setTesting] = useState(false)
  const [preview, setPreview] = useState<DatabaseTestResult | null>(null)
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<DatabaseImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = (file: File) => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!['.sql', '.dump', '.txt'].includes(ext)) {
      setError(`Invalid file format '${ext}'. Please upload a .sql database script or dump file.`)
      return
    }
    setSelectedFile(file)
    setError(null)
  }

  const handleUploadSQL = async () => {
    if (!selectedFile) {
      setError('Please select or drop a .sql database script file.')
      return
    }
    setTesting(true)
    setError(null)
    try {
      const res = await ingestionAPI.uploadDatabaseSQL(selectedFile)
      if (!res.success) {
        setError(res.error || 'Failed to parse database SQL script.')
      } else {
        setPreview(res)
        if (res.table_name) setTableName(res.table_name)
        setColumnMapping(res.suggested_mapping || {})
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'SQL upload and execution failed.')
    } finally {
      setTesting(false)
    }
  }

  const handleLoadSample = async () => {
    setLoadingSample(true)
    setError(null)
    try {
      const res = await ingestionAPI.loadSampleDatabaseSQL()
      if (!res.success) {
        setError(res.error || 'Failed to load sample database script.')
      } else {
        setPreview(res)
        if (res.table_name) setTableName(res.table_name)
        setColumnMapping(res.suggested_mapping || {})
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'Failed to load sample database.')
    } finally {
      setLoadingSample(false)
    }
  }

  const handleTestConnection = async () => {
    if (!tableName.trim()) {
      setError('Please provide a table or view name.')
      return
    }
    setTesting(true)
    setError(null)
    try {
      const res = await ingestionAPI.testDatabase({
        table_name: tableName.trim(),
        connection_url: connectionUrl.trim() || undefined,
        limit: 5,
      })
      if (!res.success) {
        setError(res.error || 'Connection to table failed. Verify the table name exists in the database.')
      } else {
        setPreview(res)
        setColumnMapping(res.suggested_mapping || {})
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'Database test failed.')
    } finally {
      setTesting(false)
    }
  }

  const handleImport = async () => {
    const targetTable = preview?.table_name || tableName.trim()
    if (!targetTable) {
      setError('Missing table name.')
      return
    }
    setImporting(true)
    setError(null)
    try {
      const res = await ingestionAPI.importDatabase({
        table_name: targetTable,
        connection_url: importMode === 'live_connection' ? (connectionUrl.trim() || undefined) : undefined,
        column_mapping: columnMapping,
        source_name: importMode === 'sql_file' ? (selectedFile ? `SQL Script: ${selectedFile.name}` : `SQL Dump: ${targetTable}`) : `PostgreSQL: ${targetTable}`,
        limit: 100,
      })
      setImportResult(res)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'Database import failed.')
    } finally {
      setImporting(false)
    }
  }

  const getRiskBadgeColor = (category?: string) => {
    switch (category?.toUpperCase()) {
      case 'CRITICAL':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: '#ef4444' }
      case 'HIGH':
        return { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316', border: '#f97316' }
      case 'MEDIUM':
        return { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', border: '#eab308' }
      case 'LOW':
        return { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: '#22c55e' }
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: '#64748b' }
    }
  }

  return (
    <ModalShell
      title="Import Database Data"
      subtitle={
        importResult
          ? 'Live ML delay risk scoring results from database records.'
          : preview
          ? 'Review extracted schema and verify canonical column mappings.'
          : 'Directly upload SQL database script dumps (.sql) or connect to authorized PostgreSQL systems.'
      }
      onClose={onClose}
      maxWidth={importResult ? 960 : preview ? 900 : 720}
    >
      {/* ── State 3: Instant ML Delay Prediction Result Card ── */}
      {importResult ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 78, 59, 0.25))',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: 12,
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={24} style={{ color: '#34d399' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#34d399', margin: '0 0 4px' }}>
                Database Import Complete — ML Delay Predictions Computed
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                {importResult.message}
              </p>
            </div>
          </div>

          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            <div style={{ background: 'var(--color-bg-secondary)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Table Name</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 2, fontFamily: 'monospace' }}>
                {importResult.table_name}
              </div>
            </div>

            <div style={{ background: 'var(--color-bg-secondary)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Projects Processed</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
                {importResult.imported_count + importResult.duplicates_count}
              </div>
            </div>

            <div style={{ background: 'var(--color-bg-secondary)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>ML Predictions Generated</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399', marginTop: 2 }}>
                {importResult.ml_refreshed_count}
              </div>
            </div>

            <div style={{ background: 'var(--color-bg-secondary)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>ML Pipeline Model</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#a78bfa', marginTop: 4 }}>
                LightGBM + SHAP
              </div>
            </div>
          </div>

          {/* Table of Imported Projects with Live Predictions */}
          <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 10, border: '1px solid var(--color-border-subtle)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} style={{ color: '#fbbf24' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  ML Delay Prediction Scores & Key Drivers
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                {importResult.projects.length} project(s) synchronized
              </span>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: 300 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <th style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Project</th>
                    <th style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Risk Score</th>
                    <th style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Delay Probability</th>
                    <th style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Predicted Delay</th>
                    <th style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Top Delay Driver (SHAP)</th>
                  </tr>
                </thead>
                <tbody>
                  {importResult.projects.map((proj, idx) => {
                    const badge = getRiskBadgeColor(proj.risk_category)
                    const topDriver = proj.top_delay_drivers?.[0]
                    return (
                      <tr key={proj.project_id || idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{proj.project_name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{proj.project_code}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                            }}
                          >
                            {proj.risk_score != null ? `${proj.risk_score.toFixed(1)}` : 'N/A'} {proj.risk_category}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {proj.delay_probability != null ? `${(proj.delay_probability * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {proj.predicted_delay_days != null ? (
                            <div>
                              <span style={{ fontWeight: 700, color: '#f87171' }}>{proj.predicted_delay_days.toFixed(0)} days</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: 4 }}>
                                (~{(proj.predicted_delay_days / 30.4).toFixed(1)} mos)
                              </span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', maxWidth: 280 }}>
                          {topDriver ? (
                            <div>
                              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#fbbf24', textTransform: 'capitalize' }}>
                                {topDriver.feature.replace(/_/g, ' ')}
                              </span>
                              {topDriver.recommendation && (
                                <p style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)', margin: '2px 0 0', lineHeight: 1.3 }}>
                                  {topDriver.recommendation}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Balanced risk profile</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setImportResult(null)
                setPreview(null)
                setSelectedFile(null)
              }}
            >
              Import Another Database
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  window.location.href = '/decision-intelligence'
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>Open Decision Intelligence</span>
                <ExternalLink size={14} />
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onSuccess(`Successfully imported ${importResult.imported_count + importResult.duplicates_count} projects and computed ML delay predictions.`)
                }}
              >
                Done / View in Projects Directory
              </button>
            </div>
          </div>
        </div>
      ) : preview && preview.success ? (
        /* ── State 2: Table Data Preview & Column Mapping ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Database size={18} style={{ color: '#fbbf24' }} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                Table: <span style={{ fontFamily: 'monospace', color: '#fbbf24' }}>{preview.table_name || tableName}</span>
              </span>
              <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600 }}>
                {preview.total_rows_approx != null ? `${preview.total_rows_approx} total rows` : 'Connected'}
              </span>
              <span style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem' }}>
                {preview.columns.length} columns
              </span>
            </div>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              onClick={() => setPreview(null)}
            >
              Change File / Table
            </button>
          </div>

          {preview.message && (
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', padding: '8px 12px', borderRadius: 6, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={15} />
              <span>{preview.message}</span>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '10px 14px', borderRadius: 6, fontSize: '0.82rem' }}>
              {error}
            </div>
          )}

          {/* Sample Data Table Preview */}
          <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 8, border: '1px solid var(--color-border-subtle)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border-subtle)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              Data Sample (First {preview.sample_rows.length} rows):
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 220 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                    {preview.columns.slice(0, 10).map((col) => (
                      <th key={col} style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {col}
                      </th>
                    ))}
                    {preview.columns.length > 10 && (
                      <th style={{ padding: '8px 12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        +{preview.columns.length - 10} more
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample_rows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      {preview.columns.slice(0, 10).map((col) => (
                        <td key={col} style={{ padding: '8px 12px', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row[col] != null ? String(row[col]) : '—'}
                        </td>
                      ))}
                      {preview.columns.length > 10 && (
                        <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>…</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Auto-Mapping Info Badge */}
          <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Sparkles size={16} style={{ color: '#38bdf8' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#38bdf8' }}>
                Intelligent Schema Mapping
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              Recognized {Object.keys(columnMapping).length} canonical fields (project code, name, sector, land area, compensation outlay, PAFs, R&R metrics, and statutory dates). These are automatically extracted and fed into the LightGBM + SHAP ML delay prediction engine.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={() => setPreview(null)}>
              Back
            </button>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importing}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {importing ? (
                <>
                  <div className="spinner-sm" />
                  <span>Importing & Generating ML Predictions…</span>
                </>
              ) : (
                <span>Import Projects & Run ML Prediction →</span>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* ── State 1: Upload SQL File OR Live Connection Form ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Segmented Mode Selector */}
          <div
            style={{
              display: 'inline-flex',
              padding: 4,
              borderRadius: 8,
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-subtle)',
              gap: 4,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setImportMode('sql_file')
                setError(null)
              }}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: '0.82rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: importMode === 'sql_file' ? 'var(--color-accent-primary)' : 'transparent',
                color: importMode === 'sql_file' ? '#0f172a' : 'var(--color-text-secondary)',
              }}
            >
              <FileCode size={15} />
              <span>Upload SQL File (.sql)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setImportMode('live_connection')
                setError(null)
              }}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: '0.82rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: importMode === 'live_connection' ? 'var(--color-accent-primary)' : 'transparent',
                color: importMode === 'live_connection' ? '#0f172a' : 'var(--color-text-secondary)',
              }}
            >
              <Database size={15} />
              <span>Live PostgreSQL Connection</span>
            </button>
          </div>

          {importMode === 'sql_file' ? (
            /* Mode A: Direct SQL File Upload */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0])
                }}
                onClick={() => document.getElementById('db-sql-file-input')?.click()}
                style={{
                  border: isDragging ? '2px dashed #38bdf8' : '2px dashed rgba(255, 255, 255, 0.18)',
                  borderRadius: 12,
                  padding: '28px 20px',
                  textAlign: 'center',
                  background: isDragging ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <input
                  id="db-sql-file-input"
                  type="file"
                  accept=".sql,.dump,.txt"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileSelect(e.target.files[0])
                  }}
                />
                {selectedFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: 'rgba(56, 189, 248, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FileCode size={24} style={{ color: '#38bdf8' }} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--color-text-primary)' }}>
                        {selectedFile.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                        {(selectedFile.size / 1024).toFixed(1)} KB • Click or drop another file to change
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload size={32} style={{ color: 'var(--color-accent-primary)', margin: '0 auto 10px' }} />
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                      Click or drag database file (.sql) here
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                      Supports PostgreSQL dump scripts, DDL statements, and INSERT tuples (.sql)
                    </p>
                  </div>
                )}
              </div>

              {/* Sample Database File Quick Action */}
              <div
                style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Need a test SQL file?
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    Use the pre-packaged external highway database schema with 6 realistic projects.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  disabled={loadingSample || testing}
                  style={{
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: 7,
                    padding: '6px 12px',
                    color: '#38bdf8',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {loadingSample ? (
                    <>
                      <div className="spinner-sm" />
                      <span>Loading Sample…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Load Sample (09_External_DB_Schema_And_Data.sql)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Mode B: Live PostgreSQL Connection Form */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>
                  <span className="input-label">External Table / View Name *</span>
                  <input
                    className="input"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="e.g. external_la_projects, bhoomirashi_projects, or state_land_records"
                  />
                </label>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                  Authorized table or view in your PostgreSQL database (e.g. <code style={{ color: '#fbbf24' }}>external_la_projects</code>).
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvUrl(!showAdvUrl)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-accent-primary)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {showAdvUrl ? '− Hide Custom Connection URL' : '+ Custom Database Connection URL (Optional)'}
                </button>
                {showAdvUrl && (
                  <div style={{ marginTop: 8 }}>
                    <label>
                      <span className="input-label">PostgreSQL Connection URL</span>
                      <input
                        className="input"
                        value={connectionUrl}
                        onChange={(e) => setConnectionUrl(e.target.value)}
                        placeholder="postgresql://user:password@host:port/database"
                      />
                    </label>
                    <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
                      Leave empty to use credentials configured in backend environment variables.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '10px 14px', borderRadius: 6, fontSize: '0.82rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            {importMode === 'sql_file' ? (
              <button
                className="btn btn-primary"
                onClick={handleUploadSQL}
                disabled={testing || !selectedFile}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {testing ? (
                  <>
                    <div className="spinner-sm" />
                    <span>Parsing & Inspecting SQL…</span>
                  </>
                ) : (
                  <span>Parse & Preview Table Records →</span>
                )}
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleTestConnection}
                disabled={testing}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {testing ? (
                  <>
                    <div className="spinner-sm" />
                    <span>Connecting & Previewing…</span>
                  </>
                ) : (
                  <span>Test Connection & Preview →</span>
                )}
              </button>
            )}
          </div>
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

  // Ingestion mode
  const [mode, setMode] = useState<'NEW_PROJECT' | 'LINK_EXISTING'>('NEW_PROJECT')
  const [selectedProject, setSelectedProject] = useState('')

  // Custom metadata (optional override)
  const [projectName, setProjectName] = useState('')
  const [projectCode, setProjectCode] = useState('')
  const [projectType, setProjectType] = useState('HIGHWAY')
  const [stateCode, setStateCode] = useState('TS')
  const [district, setDistrict] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [isDragging, setIsDragging] = useState(false)

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
      const isNew = mode === 'NEW_PROJECT'
      const res = await ingestionAPI.uploadGIS(file, {
        projectId: isNew ? undefined : (selectedProject || undefined),
        createProject: isNew,
        projectName: isNew && projectName.trim() ? projectName.trim() : undefined,
        projectCode: isNew && projectCode.trim() ? projectCode.trim() : undefined,
        projectType: isNew ? projectType : undefined,
        stateCode: isNew ? stateCode : undefined,
        district: isNew && district.trim() ? district.trim() : undefined,
      })
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
      title="Upload GIS Data"
      subtitle="Import GeoJSON, KML, Shapefile, or CSV parcel alignments with AI delay predictions."
      onClose={onClose}
      maxWidth={840}
    >
      {/* State 2: ML Delay Prediction & Spatial Intelligence Result */}
      {gisResult ? (
        <div>
          <div style={{ textAlign: 'center', padding: '12px 0 18px' }}>
            <div style={{
              width: 54, height: 54, borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px auto'
            }}>
              <CheckCircle2 size={28} color="#10b981" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              GIS Spatial Alignment Ingested & Scored!
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
              Parcels validated and saved to PostGIS. Project <strong>{gisResult.project_name || gisResult.project_code || 'GIS Alignment'}</strong> ({gisResult.project_code || 'PROCESSED'}) is now active.
            </p>
          </div>

          {/* Machine Learning Delay Prediction Card */}
          {gisResult.prediction && (
            <div style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 12,
              padding: '18px 22px',
              marginBottom: 16,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} style={{ color: '#0d9488' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Machine Learning Delay Risk Forecast
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 10 }}>
                  Live LightGBM Engine
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div style={{ background: 'var(--color-bg-tertiary)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Delay Risk Score</div>
                  <div style={{
                    fontSize: '1.4rem', fontWeight: 800, marginTop: 4,
                    color: gisResult.prediction.risk_category === 'HIGH' ? '#ef4444' : gisResult.prediction.risk_category === 'MEDIUM' ? '#f59e0b' : '#10b981'
                  }}>
                    {gisResult.prediction.risk_score} <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>/ 100</span>
                  </div>
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                    background: gisResult.prediction.risk_category === 'HIGH' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: gisResult.prediction.risk_category === 'HIGH' ? '#ef4444' : '#10b981'
                  }}>
                    {gisResult.prediction.risk_category} RISK
                  </span>
                </div>

                <div style={{ background: 'var(--color-bg-tertiary)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Delay Probability</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 4 }}>
                    {(gisResult.prediction.delay_probability * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>schedule slippage likelihood</div>
                </div>

                <div style={{ background: 'var(--color-bg-tertiary)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Expected Delay</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
                    +{Math.round(gisResult.prediction.predicted_delay_days)} <span style={{ fontSize: '0.85rem' }}>days</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    ~{Math.round(gisResult.prediction.predicted_delay_days / 30)} months past schedule
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-tertiary)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Model Confidence</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0d9488', marginTop: 4 }}>
                    {(gisResult.prediction.confidence_score * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>high data completeness</div>
                </div>
              </div>

              {gisResult.prediction.top_delay_drivers && gisResult.prediction.top_delay_drivers.length > 0 && (
                <div style={{ background: 'var(--color-bg-tertiary)', padding: '10px 14px', borderRadius: 8, fontSize: '0.78rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Key Delay Drivers Identified:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {gisResult.prediction.top_delay_drivers.map((drv: any, idx: number) => (
                      <span key={idx} style={{
                        padding: '3px 8px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', fontWeight: 600
                      }}>
                        {drv.feature?.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Spatial Summary Card */}
          <div style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 10,
            padding: '16px 20px',
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Layers size={17} style={{ color: '#0d9488' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Spatial Geometry & PostGIS Persistence Summary
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Total Parcels:</span>{' '}
                <strong style={{ color: '#10b981' }}>{gisResult.valid_features}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Calculated Land Area:</span>{' '}
                <strong>{gisResult.total_calculated_area_ha || '—'} ha</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Geometry Types:</span>{' '}
                <strong>{gisResult.geometry_types.join(', ')}</strong>
              </div>
              {gisResult.centroid && (
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Spatial Anchor:</span>{' '}
                  <strong>{gisResult.centroid.latitude.toFixed(4)}, {gisResult.centroid.longitude.toFixed(4)}</strong>
                </div>
              )}
            </div>
            {gisResult.bounding_box && (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8 }}>
                Bounding Box: [{gisResult.bounding_box.map((v) => v.toFixed(4)).join(', ')}]
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setGisResult(null)
                setFile(null)
              }}
            >
              Upload Another GIS Alignment
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              {gisResult.project_id && (
                <a
                  href={`/projects/${gisResult.project_id}`}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                >
                  <span>View Project ML Analytics</span>
                  <ExternalLink size={15} />
                </a>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* State 1: Upload and Configuration Form */
        <div>
          {/* Segmented Mode Selector */}
          <div
            style={{
              display: 'flex',
              background: 'var(--color-bg-tertiary, rgba(0,0,0,0.04))',
              padding: 4,
              borderRadius: 8,
              border: '1px solid var(--color-border-subtle, rgba(0,0,0,0.08))',
              marginBottom: 16,
              gap: 4,
            }}
          >
            <button
              type="button"
              onClick={() => setMode('NEW_PROJECT')}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: 6,
                border: 'none',
                background: mode === 'NEW_PROJECT' ? 'var(--color-bg-secondary, #fff)' : 'transparent',
                color: mode === 'NEW_PROJECT' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                boxShadow: mode === 'NEW_PROJECT' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                fontWeight: mode === 'NEW_PROJECT' ? 600 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <Sparkles size={14} style={{ color: mode === 'NEW_PROJECT' ? '#0d9488' : 'currentColor' }} />
              <span>Create New Project (Auto-derive)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('LINK_EXISTING')}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: 6,
                border: 'none',
                background: mode === 'LINK_EXISTING' ? 'var(--color-bg-secondary, #fff)' : 'transparent',
                color: mode === 'LINK_EXISTING' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                boxShadow: mode === 'LINK_EXISTING' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                fontWeight: mode === 'LINK_EXISTING' ? 600 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <Layers size={14} style={{ color: mode === 'LINK_EXISTING' ? '#0d9488' : 'currentColor' }} />
              <span>Link to Existing Project</span>
            </button>
          </div>

          {mode === 'LINK_EXISTING' ? (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                Select Target Project *
              </label>
              <select
                className="input"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                style={{ fontSize: '0.84rem' }}
              >
                <option value="">-- Choose Existing Project --</option>
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(13, 148, 136, 0.05)',
                  border: '1px solid rgba(13, 148, 136, 0.15)',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                  <Sparkles size={13} style={{ color: '#0d9488', flexShrink: 0 }} />
                  <span>Project details will be automatically derived from GIS alignment geometry.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0d9488',
                    cursor: 'pointer',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    whiteSpace: 'nowrap',
                    marginLeft: 8,
                  }}
                >
                  {showAdvanced ? 'Hide Custom Fields' : 'Customize Details (Optional)'}
                </button>
              </div>

              {showAdvanced && (
                <div
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    marginTop: 8,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: 10,
                  }}
                >
                  <div>
                    <label className="input-label" style={{ fontSize: '0.72rem' }}>Project Name</label>
                    <input
                      className="input"
                      style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                      placeholder="e.g. NH65 Vijayawada Expressway"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: '0.72rem' }}>Project Code</label>
                    <input
                      className="input"
                      style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                      placeholder="e.g. NHAI-NH65-PKG2"
                      value={projectCode}
                      onChange={(e) => setProjectCode(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: '0.72rem' }}>Project Type</label>
                    <select
                      className="input"
                      style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                      value={projectType}
                      onChange={(e) => setProjectType(e.target.value)}
                    >
                      {PROJECT_TYPES.map((t) => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: '0.72rem' }}>State</label>
                    <select
                      className="input"
                      style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                      value={stateCode}
                      onChange={(e) => setStateCode(e.target.value)}
                    >
                      {STATES.map((s) => (
                        <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: '0.72rem' }}>District</label>
                    <input
                      className="input"
                      style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                      placeholder="e.g. Rangareddy"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* File Upload Dropzone */}
          <div
            id="gis-dropzone"
            style={{
              border: isDragging
                ? '2px dashed #0d9488'
                : file
                ? '2px solid rgba(13, 148, 136, 0.6)'
                : '2px dashed rgba(13, 148, 136, 0.45)',
              borderRadius: 12,
              padding: file ? '20px 16px' : '36px 20px',
              textAlign: 'center',
              cursor: uploading ? 'wait' : 'pointer',
              background: isDragging
                ? 'rgba(13, 148, 136, 0.1)'
                : file
                ? 'rgba(13, 148, 136, 0.05)'
                : 'rgba(13, 148, 136, 0.02)',
              marginBottom: 20,
              transition: 'all 0.2s ease',
            }}
            onClick={() => document.getElementById('gis-file-input')?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setIsDragging(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              if (e.dataTransfer.files?.[0]) {
                setFile(e.dataTransfer.files[0])
              }
            }}
            onMouseEnter={(e) => {
              if (!isDragging && !file) {
                e.currentTarget.style.borderColor = '#0d9488'
                e.currentTarget.style.background = 'rgba(13, 148, 136, 0.06)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isDragging && !file) {
                e.currentTarget.style.borderColor = 'rgba(13, 148, 136, 0.45)'
                e.currentTarget.style.background = 'rgba(13, 148, 136, 0.02)'
              }
            }}
          >
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <CheckCircle2 size={22} color="#10b981" />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {(file.size / 1024).toFixed(1)} KB • Ready for spatial ingestion & ML scoring
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                  }}
                  style={{
                    background: 'none',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 6,
                    padding: '4px 10px',
                    color: '#ef4444',
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'rgba(13, 148, 136, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto'
                }}>
                  <MapPin size={26} style={{ color: '#0d9488' }} />
                </div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                  Click or drag GIS file here
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
                  Supports GeoJSON (.geojson), KML (.kml), Shapefile (.zip), or CSV coordinates
                </p>
              </>
            )}
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

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={uploading}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={!file || uploading || (mode === 'LINK_EXISTING' && !selectedProject)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {uploading ? (
                <>
                  <span className="spinner" />
                  <span>Processing Alignment & Running ML…</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>Ingest GIS & Run Delay Prediction</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  )
}

// ─── 6. PDF Document Review Screen Modal ─────────────────────────────────────

// ─── 6. Multi-PDF Document Review Screen Modal ───────────────────────────────

function DocumentReviewModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (msg: string) => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<MultiDocumentExtractData | null>(null)
  const [confirmedFields, setConfirmedFields] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [mlResult, setMlResult] = useState<DocumentConfirmResult | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const incoming = Array.from(e.target.files)
    setFiles((prev) => [...prev, ...incoming])
    setError(null)
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleExtract = async () => {
    if (files.length === 0) return
    setExtracting(true)
    setError(null)
    try {
      const res = await ingestionAPI.extractMultipleDocuments(files, 'AUTO_DETECT')
      setExtracted(res)
      setConfirmedFields(res.merged_fields || {})
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
      const res = await ingestionAPI.confirmDocument({
        document_id: extracted.primary_document_id,
        document_ids: extracted.document_ids,
        confirmed_fields: confirmedFields,
        create_project: true,
      })
      setMlResult(res)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Confirmation failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell
      title="Upload Documents & AI Field Extraction"
      subtitle="Upload single or multiple project PDFs (Gazette notifications, awards, SIA reports, court orders) for automated extraction & ML scoring."
      onClose={onClose}
      maxWidth={980}
    >
      {/* State 3: ML Result Screen after Confirmation */}
      {mlResult ? (
        <div>
          <div style={{ textAlign: 'center', padding: '16px 0 20px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto'
            }}>
              <CheckCircle2 size={30} color="#10b981" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              Project Ingested & Scored via Machine Learning!
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
              Documents verified. Project <strong>{mlResult.project_code || confirmedFields.project_code}</strong> has been created with all canonical fields.
            </p>
          </div>

          {/* ML Prediction Result Card */}
          {mlResult.prediction && (
            <div style={{
              background: 'linear-gradient(180deg, var(--color-bg-secondary) 0%, rgba(20,28,45,0.85) 100%)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 12,
              padding: '18px 22px',
              marginBottom: 20,
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 8 }}>
                <Sparkles size={18} color="var(--color-accent-primary)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Calibrated Machine Learning Delay Risk Forecast
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 14 }}>
                <div style={{ background: 'var(--color-bg-tertiary)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Delay Risk Score</div>
                  <div style={{
                    fontSize: '1.4rem', fontWeight: 800, marginTop: 4,
                    color: mlResult.prediction.risk_category === 'HIGH' ? '#ef4444' : mlResult.prediction.risk_category === 'MEDIUM' ? '#f59e0b' : '#10b981'
                  }}>
                    {mlResult.prediction.risk_score} <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>/ 100</span>
                  </div>
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                    background: mlResult.prediction.risk_category === 'HIGH' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: mlResult.prediction.risk_category === 'HIGH' ? '#ef4444' : '#10b981'
                  }}>
                    {mlResult.prediction.risk_category} RISK
                  </span>
                </div>

                <div style={{ background: 'var(--color-bg-tertiary)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Delay Probability</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 4 }}>
                    {(mlResult.prediction.delay_probability * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>likelihood of schedule slippage</div>
                </div>

                <div style={{ background: 'var(--color-bg-tertiary)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Expected Delay</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
                    +{Math.round(mlResult.prediction.predicted_delay_days)} <span style={{ fontSize: '0.85rem' }}>days</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    ~{Math.round(mlResult.prediction.predicted_delay_days / 30)} months past deadline
                  </div>
                </div>
              </div>

              {mlResult.prediction.top_drivers && mlResult.prediction.top_drivers.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: 8, fontSize: '0.78rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Key Delay Drivers Identified:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {mlResult.prediction.top_drivers.map((drv: any, idx: number) => (
                      <span key={idx} style={{
                        padding: '3px 8px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', fontWeight: 600
                      }}>
                        {drv.feature?.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                onSuccess(`Document project ingested successfully: ${mlResult.project_code || ''}`)
              }}
            >
              Close & View Directory
            </button>
            {mlResult.project_id && (
              <a
                href={`/projects/${mlResult.project_id}`}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
              >
                <span>View Full Project ML Analytics</span>
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        </div>
      ) : !extracted ? (
        /* State 1: Upload Documents (Multi-Upload Support) */
        <div>
          <div style={{
            background: 'var(--color-bg-secondary)',
            border: '2px dashed var(--color-border-subtle)',
            borderRadius: 12,
            padding: '28px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 16,
          }}
          onClick={() => document.getElementById('multi-doc-input')?.click()}
          >
            <Layers size={36} color="var(--color-accent-primary)" style={{ margin: '0 auto 10px auto' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              Select or Drag Multiple PDF Documents
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '4px 0 12px 0' }}>
              Upload Gazette Notifications, Section 23/3G Awards, SIA/R&R Reports, and Court Orders.
            </p>
            <input
              id="multi-doc-input"
              type="file"
              accept=".pdf"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); document.getElementById('multi-doc-input')?.click() }}>
              Browse Files (Multiple)
            </button>
          </div>

          {/* Selected Files List */}
          {files.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                <span>Selected Documents ({files.length}):</span>
                <button
                  type="button"
                  onClick={() => setFiles([])}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Clear All
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {files.map((f, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--color-bg-tertiary)',
                      border: '1px solid var(--color-border-subtle)',
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <FileCheck2 size={16} color="var(--color-accent-primary)" />
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 450 }}>
                        {f.name}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                        ({(f.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      title="Remove file"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '10px 14px', borderRadius: 6, fontSize: '0.82rem', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleExtract}
              disabled={files.length === 0 || extracting}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {extracting ? (
                <>
                  <div className="spinner-sm" />
                  <span>Extracting & Synthesizing {files.length} Document(s)…</span>
                </>
              ) : (
                <span>Extract & Synthesize Data ({files.length} Files) →</span>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* State 2: Verification Screen with Structured Field Groups */
        <div>
          {/* Header Info */}
          <div style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Extracted Data Synthesized from {extracted.total_files} Document(s)
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} />
                <span>Cross-document reconciliation complete • Review values below before ML scoring</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {extracted.documents.map((d, i) => (
                <span key={i} style={{
                  fontSize: '0.68rem', padding: '2px 7px', borderRadius: 4,
                  background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-secondary)',
                }}>
                  {d.file_name} ({d.document_type})
                </span>
              ))}
            </div>
          </div>

          {/* Grouped Form Fields */}
          <div style={{ maxHeight: 380, overflowY: 'auto', paddingRight: 6, display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            {/* Group 1: Project Identity */}
            <div style={{ background: 'var(--color-bg-secondary)', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-accent-primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                1. Project Identity & Location
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <label>
                  <span className="input-label">Project Code *</span>
                  <input
                    className="input"
                    value={confirmedFields.project_code || ''}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, project_code: e.target.value })}
                    placeholder="e.g. NHAI-EXT-401"
                  />
                  {extracted.field_sources?.project_code && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>from {extracted.field_sources.project_code}</span>
                  )}
                </label>

                <label>
                  <span className="input-label">Project Name *</span>
                  <input
                    className="input"
                    value={confirmedFields.project_name || ''}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, project_name: e.target.value })}
                    placeholder="e.g. NH-44 Varanasi Corridor"
                  />
                </label>

                <label>
                  <span className="input-label">Sector / Project Type</span>
                  <select
                    className="input"
                    value={confirmedFields.project_type || 'HIGHWAY'}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, project_type: e.target.value })}
                  >
                    {PROJECT_TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="input-label">State Code *</span>
                  <select
                    className="input"
                    value={confirmedFields.state_code || 'UP'}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, state_code: e.target.value })}
                  >
                    {STATES.map((s) => (
                      <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                    ))}
                  </select>
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
              </div>
            </div>

            {/* Group 2: Land & Acquisition Progress */}
            <div style={{ background: 'var(--color-bg-secondary)', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#34d399', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                2. Land Requirements & Physical Possession
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <label>
                  <span className="input-label">Total Land Area (ha) *</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input"
                    value={confirmedFields.total_area_ha ?? ''}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, total_area_ha: e.target.value })}
                  />
                </label>

                <label>
                  <span className="input-label">Land Area Acquired (ha)</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input"
                    value={confirmedFields.area_acquired_ha ?? ''}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, area_acquired_ha: e.target.value })}
                  />
                </label>

                <label>
                  <span className="input-label">Area in Physical Possession (ha)</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input"
                    value={confirmedFields.area_in_possession_ha ?? ''}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, area_in_possession_ha: e.target.value })}
                  />
                </label>
              </div>
            </div>

            {/* Group 3: Compensation & Financials */}
            <div style={{ background: 'var(--color-bg-secondary)', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                3. Financial Outlay & Compensation Disbursement
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <label>
                  <span className="input-label">Compensation Sanctioned (₹)</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input"
                    value={confirmedFields.estimated_compensation_inr ?? ''}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, estimated_compensation_inr: e.target.value })}
                  />
                  {extracted.field_sources?.estimated_compensation_inr && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>from {extracted.field_sources.estimated_compensation_inr}</span>
                  )}
                </label>

                <label>
                  <span className="input-label">Compensation Disbursed (₹)</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input"
                    value={confirmedFields.disbursed_compensation_inr ?? ''}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, disbursed_compensation_inr: e.target.value })}
                  />
                  {extracted.field_sources?.disbursed_compensation_inr && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>from {extracted.field_sources.disbursed_compensation_inr}</span>
                  )}
                </label>
              </div>
            </div>

            {/* Group 4: Rehabilitation & Resettlement */}
            <div style={{ background: 'var(--color-bg-secondary)', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#a78bfa', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                4. Affected Families (PAFs) & R&R Status
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <label>
                  <span className="input-label">Total Affected Families (PAFs)</span>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={confirmedFields.total_affected_families ?? ''}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, total_affected_families: e.target.value })}
                  />
                </label>

                <label>
                  <span className="input-label">Families Compensated</span>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={confirmedFields.families_compensated ?? ''}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, families_compensated: e.target.value })}
                  />
                </label>

                <label>
                  <span className="input-label">Families Rehabilitated</span>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={confirmedFields.families_rehabilitated ?? ''}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, families_rehabilitated: e.target.value })}
                  />
                </label>

                <label>
                  <span className="input-label">R&R Progress (%)</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    className="input"
                    value={confirmedFields.rehabilitation_progress_pct ?? ''}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, rehabilitation_progress_pct: e.target.value })}
                  />
                </label>
              </div>
            </div>

            {/* Group 5: Disputes & Statutory Dates */}
            <div style={{ background: 'var(--color-bg-secondary)', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f472b6', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                5. Legal Disputes & Statutory Dates
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <label>
                  <span className="input-label">Open Court Disputes / Cases</span>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={confirmedFields.legal_case_count ?? 0}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, legal_case_count: e.target.value })}
                  />
                  {extracted.field_sources?.legal_case_count && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>from {extracted.field_sources.legal_case_count}</span>
                  )}
                </label>

                <label>
                  <span className="input-label">Preliminary Notification (3A / 4) Date</span>
                  <input
                    type="date"
                    className="input"
                    value={confirmedFields.notification_3a_date || confirmedFields.notification_date || ''}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, notification_3a_date: e.target.value })}
                  />
                </label>

                <label>
                  <span className="input-label">Target Completion Date</span>
                  <input
                    type="date"
                    className="input"
                    value={confirmedFields.planned_end_date || ''}
                    onChange={(e) => setConfirmedFields({ ...confirmedFields, planned_end_date: e.target.value })}
                  />
                </label>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={() => setExtracted(null)}>
              Back to Documents
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {saving ? (
                <>
                  <div className="spinner-sm" />
                  <span>Incorporating & Running ML Model…</span>
                </>
              ) : (
                <span>Confirm & Run ML Prediction →</span>
              )}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  )
}
