import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { projectsAPI } from '@/api/client'

const PROJECT_TYPES = ['HIGHWAY','RAILWAY','METRO_RAIL','AIRPORT','PORT','POWER_TRANSMISSION','PIPELINE','IRRIGATION','URBAN_DEVELOPMENT','INDUSTRIAL_CORRIDOR','DEFENCE','OTHER']
const ACTS = ['RFCTLARR_2013','NH_ACT_1956','RAILWAYS_ACT_1989','ELECTRICITY_ACT_2003','STATE_SPECIFIC','OTHER']
const numericFields = ['total_area_ha','area_acquired_ha','area_in_possession_ha','total_affected_families','families_compensated','families_rehabilitated','rehabilitation_progress_pct','estimated_compensation_inr','disbursed_compensation_inr','legal_case_count','latitude','longitude']

export default function ProjectForm() {
  const { id } = useParams<{ id: string }>()
  const edit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState<Record<string, string>>({ project_code: '', name: '', project_type: 'HIGHWAY', acquisition_act: 'RFCTLARR_2013', state_code: '', district_codes: '', executing_agency: '', total_area_ha: '', area_acquired_ha: '', area_in_possession_ha: '', total_affected_families: '', families_compensated: '', families_rehabilitated: '', rehabilitation_progress_pct: '', planned_start_date: '', planned_end_date: '', notification_3a_date: '', notification_3d_date: '', estimated_compensation_inr: '', disbursed_compensation_inr: '', legal_case_count: '', legal_case_status: 'NONE', latitude: '', longitude: '' })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    projectsAPI.get(id).then((project: any) => setForm((current) => {
      const next = { ...current }
      Object.keys(next).forEach((key) => {
        const value = key === 'district_codes' ? (project.district_codes || []).join(', ') : project[key]
        next[key] = value == null ? '' : String(value)
      })
      return next
    })).catch(() => setError('Project could not be loaded.'))
  }, [id])

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null)
    const number = (key: string) => form[key] === '' ? undefined : Number(form[key])
    const payload: any = { ...form, district_codes: form.district_codes.split(',').map((item) => item.trim()).filter(Boolean) }
    numericFields.forEach((key) => payload[key] = number(key))
    Object.keys(payload).forEach((key) => payload[key] === '' || payload[key] === undefined ? delete payload[key] : undefined)
    if ((payload.area_acquired_ha ?? 0) > (payload.total_area_ha ?? Infinity)) return setError('Acquired area cannot exceed total area.')
    if ((payload.area_in_possession_ha ?? 0) > (payload.area_acquired_ha ?? Infinity)) return setError('Possession area cannot exceed acquired area.')
    if ((payload.disbursed_compensation_inr ?? 0) > (payload.estimated_compensation_inr ?? Infinity)) return setError('Disbursed compensation cannot exceed sanctioned compensation.')
    setSaving(true)
    try {
      const saved = edit ? await projectsAPI.update(id!, payload) : await projectsAPI.create(payload)
      navigate(`/projects/${saved.id}`)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail || 'Project could not be saved.'))
    } finally { setSaving(false) }
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

  return <form className="card" onSubmit={submit} style={{ maxWidth: 1100, margin: '0 auto' }}>
    <h1>{edit ? 'Edit Project Details' : 'Register New Project'}</h1>
    <p style={{ color: 'var(--color-text-muted)' }}>Fill in project details below. Delay predictions, risk scores, and recommendations will be automatically calculated.</p>
    {error && <div style={{ color: 'var(--color-risk-critical)', marginBottom: 12 }}>{error}</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
      <Field label="Project Code" required><input className="input" disabled={edit} value={form.project_code} onChange={(e) => set('project_code', e.target.value)} placeholder="e.g. NHAI-DL-001" /></Field>
      <Field label="Project Name" required><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Delhi-Dehradun Expressway" /></Field>
      <Field label="Sector / Project Type"><select className="input" value={form.project_type} onChange={(e) => set('project_type', e.target.value)}>{PROJECT_TYPES.map((value) => <option key={value}>{value.replace(/_/g, ' ')}</option>)}</select></Field>
      <Field label="Acquisition Act"><select className="input" value={form.acquisition_act} onChange={(e) => set('acquisition_act', e.target.value)}>{ACTS.map((value) => <option key={value}>{value.replace(/_/g, ' ')}</option>)}</select></Field>
      <Field label="State Code" required><input className="input" maxLength={3} value={form.state_code} onChange={(e) => set('state_code', e.target.value.toUpperCase())} placeholder="e.g. UP, MH, DL" /></Field>
      <Field label="Districts (comma separated)"><input className="input" value={form.district_codes} onChange={(e) => set('district_codes', e.target.value)} placeholder="e.g. Ghaziabad, Meerut" /></Field>
      <Field label="Implementing Agency"><input className="input" value={form.executing_agency} onChange={(e) => set('executing_agency', e.target.value)} placeholder="e.g. NHAI, PWD, Indian Railways" /></Field>
      {['total_area_ha','area_acquired_ha','area_in_possession_ha','total_affected_families','families_compensated','families_rehabilitated','rehabilitation_progress_pct','estimated_compensation_inr','disbursed_compensation_inr','legal_case_count'].map((key) => <Field key={key} label={labelMap[key] || key.replace(/_/g, ' ')}><input className="input" type="number" min="0" max={key === 'rehabilitation_progress_pct' ? 100 : undefined} step="any" value={form[key]} onChange={(e) => set(key, e.target.value)} /></Field>)}
      {['planned_start_date','planned_end_date','notification_3a_date','notification_3d_date'].map((key) => <Field key={key} label={labelMap[key] || key.replace(/_/g, ' ')}><input className="input" type="date" value={form[key]} onChange={(e) => set(key, e.target.value)} /></Field>)}
      <Field label="Legal Case Status"><select className="input" value={form.legal_case_status} onChange={(e) => set('legal_case_status', e.target.value)}>{['NONE','OPEN','PENDING','RESOLVED','CLOSED'].map((value) => <option key={value}>{value}</option>)}</select></Field>
      <Field label="Latitude"><input className="input" type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="e.g. 28.6139" /></Field>
      <Field label="Longitude"><input className="input" type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="e.g. 77.2090" /></Field>
    </div>
    <div style={{ display: 'flex', gap: 10, marginTop: 20 }}><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Project'}</button><button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button></div>
  </form>
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label><span className="input-label">{label}{required ? ' *' : ''}</span>{children}</label> }
