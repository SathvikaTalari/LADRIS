import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { projectsAPI } from '@/api/client'
import { AlertTriangle, ArrowLeft, Save, Trash2, AlertCircle } from 'lucide-react'

const PROJECT_TYPES = ['HIGHWAY','RAILWAY','METRO_RAIL','AIRPORT','PORT','POWER_TRANSMISSION','PIPELINE','IRRIGATION','URBAN_DEVELOPMENT','INDUSTRIAL_CORRIDOR','DEFENCE','OTHER']
const ACTS = ['RFCTLARR_2013','NH_ACT_1956','RAILWAYS_ACT_1989','ELECTRICITY_ACT_2003','STATE_SPECIFIC','OTHER']
const numericFields = ['total_area_ha','area_acquired_ha','area_in_possession_ha','total_affected_families','families_compensated','families_rehabilitated','rehabilitation_progress_pct','estimated_compensation_inr','disbursed_compensation_inr','legal_case_count','latitude','longitude']

export default function ProjectForm() {
  const { id } = useParams<{ id: string }>()
  const edit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState<Record<string, string>>({
    project_code: '',
    name: '',
    project_type: 'HIGHWAY',
    acquisition_act: 'RFCTLARR_2013',
    state_code: '',
    district_codes: '',
    executing_agency: '',
    total_area_ha: '',
    area_acquired_ha: '',
    area_in_possession_ha: '',
    total_affected_families: '',
    families_compensated: '',
    families_rehabilitated: '',
    rehabilitation_progress_pct: '',
    planned_start_date: '',
    planned_end_date: '',
    notification_3a_date: '',
    notification_3d_date: '',
    estimated_compensation_inr: '',
    disbursed_compensation_inr: '',
    legal_case_count: '',
    legal_case_status: 'NONE',
    latitude: '',
    longitude: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [projectTitle, setProjectTitle] = useState('')
  const [initialProjectCode, setInitialProjectCode] = useState('')

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    projectsAPI.get(id).then((project: any) => {
      setProjectTitle(project.name || '')
      setInitialProjectCode(project.project_code || '')
      setForm((current) => {
        const next = { ...current }
        Object.keys(next).forEach((key) => {
          const value = key === 'district_codes' ? (project.district_codes || []).join(', ') : project[key]
          next[key] = value == null ? '' : String(value)
        })
        return next
      })
    }).catch(() => setError('Project record could not be loaded.'))
  }, [id])

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const number = (key: string) => (form[key] === '' ? undefined : Number(form[key]))
    const payload: any = {
      ...form,
      district_codes: form.district_codes.split(',').map((item) => item.trim()).filter(Boolean),
    }
    numericFields.forEach((key) => (payload[key] = number(key)))
    Object.keys(payload).forEach((key) =>
      payload[key] === '' || payload[key] === undefined ? delete payload[key] : undefined
    )
    if ((payload.area_acquired_ha ?? 0) > (payload.total_area_ha ?? Infinity))
      return setError('Acquired area cannot exceed total area.')
    if ((payload.area_in_possession_ha ?? 0) > (payload.area_acquired_ha ?? Infinity))
      return setError('Possession area cannot exceed acquired area.')
    if ((payload.disbursed_compensation_inr ?? 0) > (payload.estimated_compensation_inr ?? Infinity))
      return setError('Disbursed compensation cannot exceed sanctioned compensation.')
    setSaving(true)
    try {
      const saved = edit ? await projectsAPI.update(id!, payload) : await projectsAPI.create(payload)
      navigate(`/projects/${saved.id}`)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail || 'Project could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!id) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await projectsAPI.delete(id)
      setShowDeleteModal(false)
      navigate('/projects', {
        replace: true,
        state: {
          deletedProjectCode: form.project_code || initialProjectCode,
          deletedProjectName: form.name || projectTitle,
        },
      })
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setDeleteError(
        typeof detail === 'string'
          ? detail
          : 'Failed to delete project. Please verify administrative credentials and try again.'
      )
    } finally {
      setDeleting(false)
    }
  }

  const labelMap: Record<string, string> = {
    total_area_ha: 'Total Land Area (ha)',
    area_acquired_ha: 'Land Acquired So Far (ha)',
    area_in_possession_ha: 'Land in Physical Possession (ha)',
    total_affected_families: 'Total Affected Families',
    families_compensated: 'Families Compensated',
    families_rehabilitated: 'Families Resettled / Rehabilitated',
    rehabilitation_progress_pct: 'Rehabilitation Progress (%)',
    estimated_compensation_inr: 'Sanctioned Compensation (₹)',
    disbursed_compensation_inr: 'Disbursed Compensation (₹)',
    legal_case_count: 'Pending Court Cases',
    planned_start_date: 'Project Planned Start Date',
    planned_end_date: 'Target Completion Date',
    notification_3a_date: 'Section 3A / 4 Preliminary Notification Date',
    notification_3d_date: 'Section 3D / 19 Declaration Date',
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>
      {/* Top action navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={16} /> Back to Projects
        </button>

        {edit && (
          <button
            type="button"
            className="btn"
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.85rem',
              fontWeight: 600,
              padding: '7px 14px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 size={15} /> Delete Project
          </button>
        )}
      </div>

      <form className="card" onSubmit={submit}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '1.45rem' }}>
              {edit ? 'Edit Project Details' : 'Register New Project'}
            </h1>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              {edit
                ? `Update parameters for ${form.project_code || initialProjectCode}. Delay predictions and risk scores will automatically re-calibrate.`
                : 'Fill in project details below. Delay predictions, risk scores, and recommendations will be automatically calculated.'}
            </p>
          </div>

          {edit && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                padding: '4px 10px',
                background: 'var(--color-bg-secondary)',
                borderRadius: 4,
                color: 'var(--color-accent-primary)',
                border: '1px solid var(--color-border)',
              }}
            >
              {form.project_code || initialProjectCode}
            </span>
          )}
        </div>

        {error && (
          <div
            style={{
              color: 'var(--color-risk-critical)',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '10px 14px',
              borderRadius: 6,
              marginBottom: 16,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
          <Field label="Project Code" required>
            <input
              className="input"
              disabled={edit}
              value={form.project_code}
              onChange={(e) => set('project_code', e.target.value)}
              placeholder="e.g. NHAI-DL-001"
            />
          </Field>
          <Field label="Project Name" required>
            <input
              className="input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Delhi-Dehradun Expressway"
            />
          </Field>
          <Field label="Sector / Project Type">
            <select className="input" value={form.project_type} onChange={(e) => set('project_type', e.target.value)}>
              {PROJECT_TYPES.map((value) => (
                <option key={value}>{value.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </Field>
          <Field label="Acquisition Act">
            <select
              className="input"
              value={form.acquisition_act}
              onChange={(e) => set('acquisition_act', e.target.value)}
            >
              {ACTS.map((value) => (
                <option key={value}>{value.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </Field>
          <Field label="State Code" required>
            <input
              className="input"
              maxLength={3}
              value={form.state_code}
              onChange={(e) => set('state_code', e.target.value.toUpperCase())}
              placeholder="e.g. UP, MH, DL"
            />
          </Field>
          <Field label="Districts (comma separated)">
            <input
              className="input"
              value={form.district_codes}
              onChange={(e) => set('district_codes', e.target.value)}
              placeholder="e.g. Ghaziabad, Meerut"
            />
          </Field>
          <Field label="Implementing Agency">
            <input
              className="input"
              value={form.executing_agency}
              onChange={(e) => set('executing_agency', e.target.value)}
              placeholder="e.g. NHAI, PWD, Indian Railways"
            />
          </Field>
          {[
            'total_area_ha',
            'area_acquired_ha',
            'area_in_possession_ha',
            'total_affected_families',
            'families_compensated',
            'families_rehabilitated',
            'rehabilitation_progress_pct',
            'estimated_compensation_inr',
            'disbursed_compensation_inr',
            'legal_case_count',
          ].map((key) => (
            <Field key={key} label={labelMap[key] || key.replace(/_/g, ' ')}>
              <input
                className="input"
                type="number"
                min="0"
                max={key === 'rehabilitation_progress_pct' ? 100 : undefined}
                step="any"
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </Field>
          ))}
          {['planned_start_date', 'planned_end_date', 'notification_3a_date', 'notification_3d_date'].map((key) => (
            <Field key={key} label={labelMap[key] || key.replace(/_/g, ' ')}>
              <input
                className="input"
                type="date"
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </Field>
          ))}
          <Field label="Legal Case Status">
            <select
              className="input"
              value={form.legal_case_status}
              onChange={(e) => set('legal_case_status', e.target.value)}
            >
              {['NONE', 'OPEN', 'PENDING', 'RESOLVED', 'CLOSED'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Latitude">
            <input
              className="input"
              type="number"
              min="-90"
              max="90"
              step="any"
              value={form.latitude}
              onChange={(e) => set('latitude', e.target.value)}
              placeholder="e.g. 28.6139"
            />
          </Field>
          <Field label="Longitude">
            <input
              className="input"
              type="number"
              min="-180"
              max="180"
              step="any"
              value={form.longitude}
              onChange={(e) => set('longitude', e.target.value)}
              placeholder="e.g. 77.2090"
            />
          </Field>
        </div>

        {/* Action button row */}
        <div style={{ display: 'flex', gap: 10, marginTop: 24, alignItems: 'center' }}>
          <button className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Save size={15} />
            {saving ? 'Saving Changes…' : edit ? 'Save & Recalculate' : 'Register Project'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>

          {edit && (
            <button
              type="button"
              className="btn"
              style={{
                marginLeft: 'auto',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
                padding: '8px 16px',
                borderRadius: 6,
                cursor: 'pointer',
              }}
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 size={15} /> Delete Project
            </button>
          )}
        </div>
      </form>

      {/* Danger Zone Section when editing */}
      {edit && (
        <div
          style={{
            marginTop: 28,
            padding: '20px 24px',
            borderRadius: 10,
            border: '1px solid rgba(239, 68, 68, 0.35)',
            background: 'rgba(239, 68, 68, 0.04)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
              <AlertTriangle size={18} /> Danger Zone: Delete Project
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)', maxWidth: 640 }}>
              Permanently remove this project record (<strong>{form.project_code || initialProjectCode}</strong>).
              This action will soft-delete the project, immediately removing it from active monitoring, delay rankings, and GIS spatial layers.
            </p>
          </div>
          <button
            type="button"
            className="btn"
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 600,
              padding: '10px 18px',
              borderRadius: 6,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)',
            }}
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 size={15} />
            Delete This Project
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.68)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 520,
              width: '100%',
              background: 'var(--color-bg-primary, #0f172a)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 12,
              padding: 28,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#ef4444',
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>
                  Delete Project?
                </h2>
                <p style={{ margin: '0 0 14px 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  Are you sure you want to delete <strong style={{ color: 'var(--color-text-primary)' }}>{form.name || projectTitle}</strong> (
                  <code style={{ color: 'var(--color-accent-primary)' }}>{form.project_code || initialProjectCode}</code>)?
                </p>
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    borderLeft: '3px solid #ef4444',
                    padding: '10px 14px',
                    borderRadius: 4,
                    fontSize: '0.82rem',
                    color: 'var(--color-text-secondary)',
                    marginBottom: 18,
                  }}
                >
                  ⚠️ <strong>Notice:</strong> This will soft-delete the project record from LADRIS. It will immediately be removed from the active projects list, priority rankings, and ML prediction runs.
                </div>

                {deleteError && (
                  <div
                    style={{
                      color: '#ef4444',
                      fontSize: '0.85rem',
                      marginBottom: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <AlertCircle size={15} /> {deleteError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={deleting}
                    onClick={() => setShowDeleteModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={deleting}
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontWeight: 600,
                      cursor: deleting ? 'not-allowed' : 'pointer',
                      opacity: deleting ? 0.7 : 1,
                      padding: '8px 18px',
                      borderRadius: 6,
                    }}
                    onClick={handleDeleteProject}
                  >
                    <Trash2 size={15} />
                    {deleting ? 'Deleting Project…' : 'Yes, Delete Project'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label>
      <span className="input-label">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  )
}
