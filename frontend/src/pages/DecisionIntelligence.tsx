/**
 * LADRIS — Decision Intelligence Hub
 * 
 * 5 Core Decision Support Features:
 * 1. Land Blockers (Land Conflict Graph)
 * 2. What-If Simulator (What-If Risk Simulator calling LightGBM ML model)
 * 3. Payment vs Possession (Compensation-to-Possession Gap Detector)
 * 4. Process Bottlenecks (Administrative Dependency Graph)
 * 5. Action Impact (Official Intervention Impact Tracker)
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  TrendingDown,
  Sliders,
  ShieldCheck,
  Plus,
  Building,
  Scale,
  MapPin,
  Calendar,
  HelpCircle,
  Sparkles,
} from 'lucide-react'
import { projectsAPI, decisionIntelligenceAPI } from '@/api/client'
import type {
  ProjectSummaryHeaderData,
  LandBlockersData,
  WhatIfSimulationData,
  PaymentPossessionGapData,
  ProcessBottlenecksData,
  ProjectInterventionData,
  ProjectInterventionCreateData,
} from '@/api/client'

export default function DecisionIntelligence() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'blockers' | 'simulator' | 'gap' | 'bottlenecks' | 'impact'>('all')

  // Data states
  const [summary, setSummary] = useState<ProjectSummaryHeaderData | null>(null)
  const [blockers, setBlockers] = useState<LandBlockersData | null>(null)
  const [whatIf, setWhatIf] = useState<WhatIfSimulationData | null>(null)
  const [gap, setGap] = useState<PaymentPossessionGapData | null>(null)
  const [bottlenecks, setBottlenecks] = useState<ProcessBottlenecksData | null>(null)
  const [interventions, setInterventions] = useState<ProjectInterventionData[]>([])

  // What-If Simulator inputs
  const [simDisbursement, setSimDisbursement] = useState<number>(50)
  const [simDisputes, setSimDisputes] = useState<number>(0)
  const [simRehab, setSimRehab] = useState<number>(50)
  const [simResettlement, setSimResettlement] = useState<boolean>(false)
  const [simUpdates, setSimUpdates] = useState<number>(2)
  const [simulating, setSimulating] = useState<boolean>(false)

  // Intervention Modal
  const [showActionModal, setShowActionModal] = useState(false)
  const [actionType, setActionType] = useState('DISPUTE_RESOLUTION')
  const [actionTitle, setActionTitle] = useState('')
  const [actionDesc, setActionDesc] = useState('')
  const [actionOfficer, setActionOfficer] = useState('')
  const [actionDisputesResolved, setActionDisputesResolved] = useState(1)
  const [actionCompRelease, setActionCompRelease] = useState(15)
  const [savingAction, setSavingAction] = useState(false)
  const [actionSuccessMsg, setActionSuccessMsg] = useState('')

  // 1. Initial Load of Projects
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await projectsAPI.list({ page_size: 100 })
        const items = res.items || []
        setProjects(items)
        if (items.length > 0) {
          setSelectedProjectId(items[0].id)
        }
      } catch (err) {
        console.error('Failed to load projects:', err)
      }
    }
    loadProjects()
  }, [])

  // 2. Load Project Decision Intelligence Bundle
  const loadProjectData = async (projectId: string) => {
    if (!projectId) return
    setLoading(true)
    try {
      const overview = await decisionIntelligenceAPI.getOverview(projectId)
      setSummary(overview.summary)
      setBlockers(overview.land_blockers)
      setWhatIf(overview.what_if_baseline)
      setGap(overview.payment_possession_gap)
      setBottlenecks(overview.process_bottlenecks)
      setInterventions(overview.recent_interventions)

      // Initialize simulator sliders from baseline
      if (overview.what_if_baseline?.current_inputs) {
        const inp = overview.what_if_baseline.current_inputs
        setSimDisbursement(inp.compensation_disbursement_pct !== undefined && inp.compensation_disbursement_pct !== null ? Math.round(inp.compensation_disbursement_pct) : 50)
        setSimDisputes(inp.open_legal_dispute_count !== undefined && inp.open_legal_dispute_count !== null ? inp.open_legal_dispute_count : 0)
        setSimRehab(inp.rehabilitation_progress_pct !== undefined && inp.rehabilitation_progress_pct !== null ? Math.round(inp.rehabilitation_progress_pct) : 50)
        setSimResettlement(Boolean(inp.resettlement_site_ready))
        setSimUpdates(inp.stakeholder_update_count_90d !== undefined && inp.stakeholder_update_count_90d !== null ? inp.stakeholder_update_count_90d : 2)
      }
    } catch (err) {
      console.error('Failed to load Decision Intelligence bundle:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectData(selectedProjectId)
    }
  }, [selectedProjectId])

  // 3. Handle What-If Simulation
  const handleRunSimulation = async () => {
    if (!selectedProjectId) return
    setSimulating(true)
    try {
      const res = await decisionIntelligenceAPI.simulate(selectedProjectId, {
        compensation_disbursement_pct: simDisbursement,
        open_legal_dispute_count: simDisputes,
        rehabilitation_progress_pct: simRehab,
        resettlement_site_ready: simResettlement,
        stakeholder_update_count_90d: simUpdates,
      })
      setWhatIf(res)
    } catch (err) {
      console.error('Simulation failed:', err)
    } finally {
      setSimulating(false)
    }
  }

  // 4. Handle Logging New Intervention
  const handleSaveIntervention = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProjectId || !actionTitle.trim()) return
    setSavingAction(true)
    try {
      const payload: ProjectInterventionCreateData = {
        intervention_type: actionType,
        title: actionTitle.trim(),
        description: actionDesc.trim() || undefined,
        action_taken_by: actionOfficer.trim() || 'Nodal Officer',
      }
      if (actionType === 'DISPUTE_RESOLUTION') {
        payload.resolved_disputes_count = Number(actionDisputesResolved)
      } else if (actionType === 'COMPENSATION_RELEASE') {
        payload.updated_compensation_pct = Math.min(100, (gap?.payment_pct || 50) + Number(actionCompRelease))
      }

      const created = await decisionIntelligenceAPI.recordIntervention(selectedProjectId, payload)
      setInterventions((prev) => [created, ...prev])
      setShowActionModal(false)
      setActionTitle('')
      setActionDesc('')
      setActionOfficer('')
      setActionSuccessMsg(`Action logged: Predicted delay reduced by ${created.delay_reduction_days} days!`)
      setTimeout(() => setActionSuccessMsg(''), 6000)

      // Refresh overview
      loadProjectData(selectedProjectId)
    } catch (err) {
      console.error('Failed to record intervention:', err)
    } finally {
      setSavingAction(false)
    }
  }

  return (
    <div style={{ padding: '4px 0 40px 0', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      {/* ─── Top Control Bar: Project Selector & Quick Filters ─── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
          }}>
            <Brain size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              Decision Intelligence
            </h1>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
              Real-time conflict detection, policy what-if simulations, and intervention tracking.
            </p>
          </div>
        </div>

        {/* Project Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
            Select Project:
          </label>
          <select
            id="decision-intelligence-project-selector"
            className="input"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{
              minWidth: 320,
              fontWeight: 600,
              fontSize: '0.88rem',
              borderColor: 'var(--color-accent-primary)',
              background: 'var(--color-bg-secondary)',
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_code ? `[${p.project_code}] ` : ''}{p.name} ({p.state_code || 'IN'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionSuccessMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            padding: '12px 18px',
            borderRadius: 8,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{actionSuccessMsg}</span>
        </motion.div>
      )}

      {/* ─── Summary Header Banner ─── */}
      {summary && (
        <div
          className="card"
          style={{
            padding: '20px 24px',
            marginBottom: 24,
            background: 'linear-gradient(180deg, var(--color-bg-secondary) 0%, rgba(20,28,45,0.7) 100%)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 14,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 20 }}>
            {/* 1. Risk Score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 12,
                background: summary.risk_level === 'HIGH' ? 'rgba(239, 68, 68, 0.15)' : summary.risk_level === 'MEDIUM' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                border: `1px solid ${summary.risk_level === 'HIGH' ? '#ef4444' : summary.risk_level === 'MEDIUM' ? '#f59e0b' : '#10b981'}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: summary.risk_level === 'HIGH' ? '#ef4444' : summary.risk_level === 'MEDIUM' ? '#f59e0b' : '#10b981', lineHeight: 1 }}>
                  {summary.risk_score}
                </span>
                <span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>/ 100</span>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Current Risk
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{
                    fontSize: '0.95rem', fontWeight: 800,
                    color: summary.risk_level === 'HIGH' ? '#ef4444' : summary.risk_level === 'MEDIUM' ? '#f59e0b' : '#10b981'
                  }}>
                    {summary.risk_level} Risk
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Predicted Delay */}
            <div style={{ borderLeft: '1px solid var(--color-border-subtle)', paddingLeft: 18 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Predicted Delay
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 2 }}>
                {Math.round(summary.predicted_delay_days)} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>days</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                approx. {summary.predicted_delay_months} months slippage
              </div>
            </div>

            {/* 3. Current Stage */}
            <div style={{ borderLeft: '1px solid var(--color-border-subtle)', paddingLeft: 18 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Current Stage
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {summary.current_stage}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-accent-primary)', fontWeight: 600 }}>
                State: {summary.state_code}
              </div>
            </div>

            {/* 4. Main Blocker */}
            <div style={{ borderLeft: '1px solid var(--color-border-subtle)', paddingLeft: 18, minWidth: 240 }}>
              <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertTriangle size={13} />
                Main Blocker
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 2 }}>
                {summary.main_blocker}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                Action: {summary.action_needed}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Navigation Sub-Tabs ─── */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid var(--color-border-subtle)',
        marginBottom: 24,
        overflowX: 'auto',
      }}>
        {[
          { key: 'all', label: 'All Modules' },
          { key: 'blockers', label: '1. Land Blockers' },
          { key: 'simulator', label: '2. What-If Simulator' },
          { key: 'gap', label: '3. Payment vs Possession' },
          { key: 'bottlenecks', label: '4. Process Bottlenecks' },
          { key: 'impact', label: '5. Action Impact' },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`btn btn-sm ${activeTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab.key as any)}
            style={{ borderRadius: '6px 6px 0 0', fontWeight: 600, fontSize: '0.84rem' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px auto' }} />
          Loading Decision Intelligence analytics for selected project...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* FEATURE 1: LAND CONFLICT GRAPH (Land Blockers)                       */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'blockers') && blockers && (
            <div className="card" style={{ padding: 24, borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={18} color="var(--color-accent-primary)" />
                    {blockers.title}
                  </h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.83rem', color: 'var(--color-text-muted)' }}>
                    {blockers.short_text}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: '0.72rem', padding: '4px 10px', borderRadius: 6, fontWeight: 700,
                    background: blockers.blocked_stage?.includes('Clear') ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    color: blockers.blocked_stage?.includes('Clear') ? '#10b981' : '#ef4444',
                    border: `1px solid ${blockers.blocked_stage?.includes('Clear') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  }}>
                    Blocked Stage: {blockers.blocked_stage}
                  </span>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Dept: {blockers.responsible_department}
                  </div>
                </div>
              </div>

              {/* Blocker Predictor Detail Card */}
              {blockers.most_blocking_issue && (
                <div style={{
                  background: blockers.risk_level === 'HIGH' ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-bg-secondary)',
                  border: `1px solid ${blockers.risk_level === 'HIGH' ? 'rgba(239, 68, 68, 0.3)' : 'var(--color-border-subtle)'}`,
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 16,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={18} color={blockers.risk_level === 'HIGH' ? '#ef4444' : '#f59e0b'} />
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: blockers.risk_level === 'HIGH' ? '#ef4444' : '#f59e0b' }}>
                        Predicted Primary Blocker ({blockers.risk_level} Risk • {blockers.days_pending}d pending)
                      </div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {blockers.most_blocking_issue}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', background: 'var(--color-bg-tertiary)', padding: '6px 12px', borderRadius: 6 }}>
                    Downstream Impact: <strong>{blockers.affected_downstream_stage || 'Possession'}</strong>
                  </div>
                </div>
              )}

              {/* 6-Node Visual Conflict Chain */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 12,
                marginTop: 10,
                marginBottom: 20,
              }}>
                {blockers.nodes.map((node, index) => {
                  const isBlocked = node.status === 'BLOCKED'
                  const isWarning = node.status === 'WARNING'
                  const borderColor = isBlocked ? '#ef4444' : isWarning ? '#f59e0b' : 'rgba(16, 185, 129, 0.4)'
                  const bg = isBlocked ? 'rgba(239, 68, 68, 0.08)' : isWarning ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.05)'
                  const tagColor = isBlocked ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981'

                  return (
                    <div
                      key={node.id}
                      style={{
                        background: bg,
                        border: `1.5px solid ${borderColor}`,
                        borderRadius: 10,
                        padding: '14px 12px',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: tagColor, textTransform: 'uppercase' }}>
                            Step {index + 1}
                          </span>
                          <span style={{
                            fontSize: '0.62rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                            background: isBlocked ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981', color: '#fff'
                          }}>
                            {node.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {node.label}
                        </div>
                        {node.detail && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', marginTop: 4, fontWeight: 500 }}>
                            {node.detail}
                          </div>
                        )}
                      </div>
                      {node.subtext && (
                        <div style={{ fontSize: '0.7rem', color: tagColor, marginTop: 8, fontWeight: 600, borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: 6 }}>
                          {node.subtext}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Parcel Breakdown or No Data Message */}
              {blockers.parcel_items && blockers.parcel_items.length > 0 ? (
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                    Sample Parcel Status ({blockers.parcels_count} recorded parcels):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                    {blockers.parcel_items.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--color-bg-tertiary)',
                          border: '1px solid var(--color-border-subtle)',
                          borderRadius: 8,
                          padding: '10px 12px',
                          fontSize: '0.78rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          <span>Khasra #{p.khasra_number}</span>
                          <span style={{ color: p.has_legal_dispute ? '#ef4444' : p.is_in_possession ? '#10b981' : '#f59e0b' }}>
                            {p.has_legal_dispute ? 'Disputed' : p.is_in_possession ? 'Possessed' : 'Pending'}
                          </span>
                        </div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', marginTop: 2 }}>
                          Village: {p.village} • Area: {p.area_ha ? `${p.area_ha} ha` : 'N/A'} • Owners: {p.owner_count}
                        </div>
                        {p.issue && (
                          <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: 4, fontWeight: 600 }}>
                            {p.issue}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px dashed var(--color-border-subtle)',
                  borderRadius: 8,
                  padding: '14px 18px',
                  fontSize: '0.82rem',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <HelpCircle size={16} />
                  <span>Cadastral parcel boundaries have not been uploaded yet. Macro-level land conflict analysis is running on project revenue records.</span>
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* FEATURE 2: WHAT-IF RISK SIMULATOR                                    */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'simulator') && whatIf && (
            <div className="card" style={{ padding: 24, borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sliders size={18} color="var(--color-accent-primary)" />
                    {whatIf.title}
                  </h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.83rem', color: 'var(--color-text-muted)' }}>
                    {whatIf.short_text}
                  </p>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  ML Engine: LightGBM ({whatIf.model_version})
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                {/* Controllable Sliders Panel */}
                <div style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 12,
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 8 }}>
                    Adjust Controllable Levers
                  </div>

                  {/* 1. Compensation Disbursement % */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      <span>Compensation Disbursement</span>
                      <span style={{ color: 'var(--color-accent-primary)', fontWeight: 800 }}>{simDisbursement}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={simDisbursement}
                      onChange={(e) => setSimDisbursement(Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--color-accent-primary)', cursor: 'pointer', marginTop: 6 }}
                    />
                  </div>

                  {/* 2. Open Disputes Count */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      <span>Open Legal Disputes</span>
                      <span style={{ color: simDisputes > 0 ? '#ef4444' : '#10b981', fontWeight: 800 }}>{simDisputes} disputes</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={simDisputes}
                      onChange={(e) => setSimDisputes(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#ef4444', cursor: 'pointer', marginTop: 6 }}
                    />
                  </div>

                  {/* 3. Rehabilitation Progress % */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      <span>Rehabilitation (R&R) Progress</span>
                      <span style={{ color: '#8b5cf6', fontWeight: 800 }}>{simRehab}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={simRehab}
                      onChange={(e) => setSimRehab(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#8b5cf6', cursor: 'pointer', marginTop: 6 }}
                    />
                  </div>

                  {/* 4. Resettlement Ready & Meetings */}
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={simResettlement}
                        onChange={(e) => setSimResettlement(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: 'var(--color-accent-primary)' }}
                      />
                      Resettlement Site Ready
                    </label>
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={handleRunSimulation}
                    disabled={simulating}
                    style={{ width: '100%', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    {simulating ? <div className="spinner-sm" /> : <Sparkles size={16} />}
                    Recalculate Risk via ML Model
                  </button>
                </div>

                {/* Simulation Prediction Results Panel */}
                <div style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 12,
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 8, marginBottom: 14 }}>
                      Simulated ML Prediction Outcome
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                      {/* Before Box */}
                      <div style={{ background: 'var(--color-bg-tertiary)', padding: '12px 14px', borderRadius: 8 }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                          Current Risk
                        </div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 4 }}>
                          {whatIf.baseline_risk_score}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: whatIf.baseline_risk_level === 'HIGH' ? '#ef4444' : '#f59e0b' }}>
                          {whatIf.baseline_risk_level} Risk • {Math.round(whatIf.baseline_delay_days)}d delay
                        </div>
                      </div>

                      {/* After Box */}
                      <div style={{
                        background: whatIf.improved ? 'rgba(16, 185, 129, 0.08)' : 'var(--color-bg-tertiary)',
                        border: whatIf.improved ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--color-border-subtle)',
                        padding: '12px 14px', borderRadius: 8
                      }}>
                        <div style={{ fontSize: '0.72rem', color: whatIf.improved ? '#10b981' : 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                          After Action
                        </div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: whatIf.improved ? '#10b981' : 'var(--color-text-primary)', marginTop: 4 }}>
                          {whatIf.simulated_risk_score}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: whatIf.simulated_risk_level === 'HIGH' ? '#ef4444' : whatIf.simulated_risk_level === 'MEDIUM' ? '#f59e0b' : '#10b981' }}>
                          {whatIf.simulated_risk_level} Risk • {Math.round(whatIf.simulated_delay_days)}d delay
                        </div>
                      </div>
                    </div>

                    {/* Delay Reduction Metric */}
                    <div style={{
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 14,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6' }}>
                        <TrendingDown size={18} />
                        <span>Possible Delay Reduction:</span>
                      </div>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#3b82f6' }}>
                        {whatIf.delay_reduction_days > 0 ? `${whatIf.delay_reduction_days} days` : '0 days'}
                      </span>
                    </div>

                    {/* Target & Practical Recommendations */}
                    {whatIf.minimum_practical_changes && whatIf.minimum_practical_changes.length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', background: 'var(--color-bg-primary)', padding: '10px 12px', borderRadius: 8, marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                          {whatIf.target_transition || 'Minimum practical changes required:'}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {whatIf.minimum_practical_changes.map((step, idx) => (
                            <li key={idx} style={{ marginTop: 2 }}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Simulated Stage Risks */}
                    {whatIf.simulated_stage_risks && whatIf.simulated_stage_risks.length > 0 && (
                      <div style={{ marginTop: 10, background: 'var(--color-bg-primary)', padding: '10px 12px', borderRadius: 8 }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                          Simulated Stage Risk Projections:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {whatIf.simulated_stage_risks.map((st) => (
                            <span
                              key={st.stage}
                              style={{
                                fontSize: '0.7rem',
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: 'var(--color-bg-secondary)',
                                border: '1px solid var(--color-border-subtle)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{st.stage.replace(/_/g, ' ')}:</span>
                              <span style={{ color: st.risk_category === 'HIGH' ? '#ef4444' : st.risk_category === 'MEDIUM' ? '#f59e0b' : '#10b981', fontWeight: 700 }}>
                                {st.risk_score} ({st.risk_category})
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* FEATURE 3: COMPENSATION-TO-POSSESSION GAP DETECTOR                   */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'gap') && gap && (
            <div className="card" style={{ padding: 24, borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Scale size={18} color="var(--color-accent-primary)" />
                    {gap.title}
                  </h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.83rem', color: 'var(--color-text-muted)' }}>
                    {gap.short_text}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {gap.has_abnormal_gap && (
                    <span style={{
                      fontSize: '0.75rem', padding: '4px 10px', borderRadius: 6, fontWeight: 800,
                      background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444'
                    }}>
                      ABNORMAL GAP ({gap.severity} SEVERITY)
                    </span>
                  )}
                  <span style={{
                    fontSize: '0.8rem', padding: '5px 12px', borderRadius: 6, fontWeight: 800,
                    background: gap.status_level === 'danger' ? 'rgba(239, 68, 68, 0.15)' : gap.status_level === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: gap.status_level === 'danger' ? '#ef4444' : gap.status_level === 'warning' ? '#f59e0b' : '#10b981',
                    border: `1px solid ${gap.status_level === 'danger' ? '#ef4444' : gap.status_level === 'warning' ? '#f59e0b' : '#10b981'}`,
                  }}>
                    Status: {gap.status}
                  </span>
                </div>
              </div>

              {/* Progress Comparison Bars & Predicted Likelihood */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 18 }}>
                {/* 1. Compensation Paid Bar */}
                <div style={{ background: 'var(--color-bg-secondary)', padding: '14px 16px', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                    <span>Compensation Disbursed</span>
                    <span style={{ color: 'var(--color-accent-primary)' }}>{gap.payment_pct}%</span>
                  </div>
                  <div style={{ height: 10, background: 'var(--color-bg-tertiary)', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${gap.payment_pct}%`, height: '100%', background: 'var(--color-accent-primary)', borderRadius: 6 }} />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    INR {(gap.compensation_disbursed_inr / 1e7).toFixed(1)} Cr disbursed of INR {(gap.compensation_sanctioned_inr / 1e7).toFixed(1)} Cr sanctioned
                  </div>
                </div>

                {/* 2. Possession Progress Bar */}
                <div style={{ background: 'var(--color-bg-secondary)', padding: '14px 16px', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                    <span>Physical Possession</span>
                    <span style={{ color: '#10b981' }}>{gap.possession_pct}%</span>
                  </div>
                  <div style={{ height: 10, background: 'var(--color-bg-tertiary)', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${gap.possession_pct}%`, height: '100%', background: '#10b981', borderRadius: 6 }} />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    {gap.possessed_area_ha.toFixed(1)} ha possessed of {gap.total_area_ha.toFixed(1)} ha total corridor
                  </div>
                </div>

                {/* 3. Predicted Likelihood Possession Remains Delayed */}
                <div style={{ background: 'var(--color-bg-secondary)', padding: '14px 16px', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                    <span>Possession Delay Probability</span>
                    <span style={{ color: (gap.likelihood_possession_delayed ?? 0) > 50 ? '#ef4444' : '#10b981', fontWeight: 800 }}>
                      {gap.likelihood_possession_delayed !== undefined ? `${Math.round(gap.likelihood_possession_delayed)}%` : 'N/A'}
                    </span>
                  </div>
                  <div style={{ height: 10, background: 'var(--color-bg-tertiary)', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{
                      width: `${Math.min(100, Math.max(0, gap.likelihood_possession_delayed ?? 0))}%`,
                      height: '100%',
                      background: (gap.likelihood_possession_delayed ?? 0) > 50 ? '#ef4444' : '#10b981',
                      borderRadius: 6
                    }} />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    {gap.has_abnormal_gap ? `Disbursement leads possession by ${(gap.payment_pct - gap.possession_pct).toFixed(0)}%` : 'Balanced progress between payment & possession'}
                  </div>
                </div>
              </div>

              {/* Diagnostic Message Callout */}
              <div style={{
                background: gap.status_level === 'danger' ? 'rgba(239, 68, 68, 0.08)' : gap.status_level === 'warning' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                borderLeft: `4px solid ${gap.status_level === 'danger' ? '#ef4444' : gap.status_level === 'warning' ? '#f59e0b' : '#10b981'}`,
                borderRadius: '0 8px 8px 0',
                padding: '12px 18px',
                fontSize: '0.84rem',
              }}>
                <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {gap.diagnostic}
                </div>
                <div style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-accent-primary)' }}>Recommended Action: </span>
                  {gap.action_needed}
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* FEATURE 4: ADMINISTRATIVE DEPENDENCY GRAPH (Process Bottlenecks)     */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'bottlenecks') && bottlenecks && (
            <div className="card" style={{ padding: 24, borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Building size={18} color="var(--color-accent-primary)" />
                    {bottlenecks.title}
                  </h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.83rem', color: 'var(--color-text-muted)' }}>
                    {bottlenecks.short_text}
                  </p>
                </div>
              </div>

              {/* Highlight summary badge row with predictive metrics */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12,
                background: 'var(--color-bg-secondary)', padding: '14px 18px', borderRadius: 10, marginBottom: 20
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Blocked At
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ef4444', marginTop: 2 }}>
                    {bottlenecks.blocked_at}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Responsible Department
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 2 }}>
                    {bottlenecks.responsible_department}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Days Pending
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>
                    {bottlenecks.days_pending} days
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Downstream Delay Probability
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: (bottlenecks.probability_downstream_delay ?? 0) > 50 ? '#ef4444' : '#10b981', marginTop: 2 }}>
                    {bottlenecks.probability_downstream_delay !== undefined ? `${Math.round(bottlenecks.probability_downstream_delay)}%` : 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Estimated Delay Impact
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ef4444', marginTop: 2 }}>
                    +{Math.round(bottlenecks.estimated_days_impact ?? 0)} days
                  </div>
                </div>
              </div>

              {/* Later Stages Affected Banner */}
              {bottlenecks.later_stages_affected_list && bottlenecks.later_stages_affected_list.length > 0 && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: '0.8rem',
                }}>
                  <AlertTriangle size={16} color="#ef4444" />
                  <div>
                    <strong style={{ color: '#ef4444' }}>Downstream Stages at Risk of Delay: </strong>
                    <span style={{ color: 'var(--color-text-primary)' }}>
                      {bottlenecks.later_stages_affected_list.join(' → ')}
                    </span>
                  </div>
                </div>
              )}

              {/* 6-Stage Statutory Pipeline */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                {bottlenecks.stages.map((stage) => {
                  const isBlocked = stage.is_blocked_step
                  const isDone = stage.status === 'COMPLETED'
                  const color = isBlocked ? '#ef4444' : isDone ? '#10b981' : '#64748b'
                  const bg = isBlocked ? 'rgba(239, 68, 68, 0.1)' : isDone ? 'rgba(16, 185, 129, 0.06)' : 'var(--color-bg-secondary)'

                  return (
                    <div
                      key={stage.step_number}
                      style={{
                        background: bg,
                        border: `1.5px solid ${isBlocked ? '#ef4444' : isDone ? 'rgba(16, 185, 129, 0.4)' : 'var(--color-border-subtle)'}`,
                        borderRadius: 10,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.66rem', fontWeight: 800, color }}>Step {stage.step_number}</span>
                          <span style={{
                            fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4,
                            background: isBlocked ? '#ef4444' : isDone ? '#10b981' : '#64748b', color: '#fff'
                          }}>
                            {stage.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {stage.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                          {stage.responsible_department}
                        </div>
                      </div>
                      {stage.details && (
                        <div style={{ fontSize: '0.7rem', color, fontWeight: 600, marginTop: 8 }}>
                          {stage.details}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Operational Recommendation */}
              <div style={{
                marginTop: 18,
                padding: '10px 14px',
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 8,
                fontSize: '0.82rem',
                color: 'var(--color-text-secondary)',
              }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Department Next Step: </span>
                {bottlenecks.recommendation}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* FEATURE 5: INTERVENTION IMPACT TRACKER (Action Impact)               */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'impact') && (
            <div className="card" style={{ padding: 24, borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={18} color="var(--color-accent-primary)" />
                    Action Impact
                  </h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.83rem', color: 'var(--color-text-muted)' }}>
                    Track whether official actions are reducing project risk.
                  </p>
                </div>
                <button
                  id="log-new-action-btn"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowActionModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={15} />
                  Log Official Action
                </button>
              </div>

              {/* Interventions Timeline */}
              {interventions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {interventions.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: 10,
                        padding: '14px 18px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 14,
                      }}
                    >
                      <div style={{ maxWidth: 460 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: '0.68rem', padding: '2px 7px', borderRadius: 4, fontWeight: 700,
                            background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)'
                          }}>
                            {item.intervention_type.replace('_', ' ')}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={12} />
                            {item.action_date}
                          </span>
                          {(item.status_improved || item.improved) && (
                            <span style={{
                              fontSize: '0.68rem', padding: '2px 7px', borderRadius: 4, fontWeight: 700,
                              background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}>
                              IMPROVED PROGRESS
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 4 }}>
                          {item.title}
                        </div>
                        {item.description && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                            {item.description}
                          </div>
                        )}
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                          Officer: <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.action_taken_by}</span>
                        </div>
                      </div>

                      {/* Before / After Metrics Comparison */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {/* Risk Before */}
                        <div style={{ textAlign: 'center', background: 'var(--color-bg-tertiary)', padding: '8px 12px', borderRadius: 6 }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                            Risk Before
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ef4444' }}>
                            {item.risk_score_before} <span style={{ fontSize: '0.7rem' }}>({item.risk_category_before})</span>
                          </div>
                          {item.delay_days_before !== undefined && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                              {Math.round(item.delay_days_before)}d delay
                            </div>
                          )}
                        </div>

                        <ArrowRight size={16} color="var(--color-text-muted)" />

                        {/* Risk After */}
                        <div style={{ textAlign: 'center', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '8px 12px', borderRadius: 6 }}>
                          <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>
                            Risk After
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981' }}>
                            {item.risk_score_after} <span style={{ fontSize: '0.7rem' }}>({item.risk_category_after})</span>
                          </div>
                          {item.delay_days_after !== undefined && (
                            <div style={{ fontSize: '0.68rem', color: '#10b981', marginTop: 2, fontWeight: 600 }}>
                              {Math.round(item.delay_days_after)}d delay
                            </div>
                          )}
                        </div>

                        {/* Delay Days Reduced */}
                        <div style={{ textAlign: 'center', background: 'rgba(59, 130, 246, 0.08)', padding: '8px 12px', borderRadius: 6 }}>
                          <div style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase' }}>
                            Delay Reduced
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#3b82f6' }}>
                            {Math.round(item.delay_reduction_days)} days
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#3b82f6', marginTop: 2, fontWeight: 600 }}>
                            -{Math.max(0, item.risk_score_before - item.risk_score_after)} pts
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px dashed var(--color-border-subtle)',
                  borderRadius: 10,
                  padding: '24px 18px',
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.84rem',
                }}>
                  No interventions logged yet for this project. Click "+ Log Official Action" to record an intervention and evaluate its ML risk impact.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Log Official Action Modal ─── */}
      <AnimatePresence>
        {showActionModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card"
              style={{ width: '100%', maxWidth: 540, padding: 24, borderRadius: 14, background: 'var(--color-bg-secondary)' }}
            >
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Log Official Action
              </h3>
              <p style={{ margin: '0 0 18px 0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                Record an administrative intervention and let LADRIS calculate the ML risk reduction before and after.
              </p>

              <form onSubmit={handleSaveIntervention} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Action Category
                  </label>
                  <select
                    className="input"
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="DISPUTE_RESOLUTION">Dispute Resolution (Lok Adalat / Settlement)</option>
                    <option value="COMPENSATION_RELEASE">Compensation Release (SLAO Account Credit)</option>
                    <option value="APPROVAL_COMPLETION">Statutory Approval &amp; Treasury Sanction</option>
                    <option value="RR_PROGRESS">R&amp;R Progress &amp; Housing Handover</option>
                    <option value="POSSESSION_ACTION">Possession &amp; Boundary Demarcation</option>
                    <option value="OTHER">Other Administrative Intervention</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Action Title *
                  </label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="e.g. Settled 3 court stay orders in joint lok adalat session"
                    value={actionTitle}
                    onChange={(e) => setActionTitle(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Details / Order Reference
                  </label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Provide meeting minutes, notification numbers, or key decisions taken."
                    value={actionDesc}
                    onChange={(e) => setActionDesc(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Officer / Department Taking Action
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Special Land Acquisition Officer / CALA"
                    value={actionOfficer}
                    onChange={(e) => setActionOfficer(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                {actionType === 'DISPUTE_RESOLUTION' && (
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                      Number of Disputes Resolved
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="input"
                      value={actionDisputesResolved}
                      onChange={(e) => setActionDisputesResolved(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}

                {actionType === 'COMPENSATION_RELEASE' && (
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                      Additional Disbursement Released (%)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      className="input"
                      value={actionCompRelease}
                      onChange={(e) => setActionCompRelease(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowActionModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingAction}
                  >
                    {savingAction ? 'Evaluating & Saving...' : 'Save Intervention'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
