/**
 * LADRIS — Decision Intelligence Hub
 * 
 * Simple, correct, and structured executive decision support:
 * 1. Overview: Executive summary of project health, primary blocker, and actionable remedies.
 * 2. Land Obstacles: Clear step-by-step land clearance stages & parcel inventory.
 * 3. Money vs. Land: Side-by-side comparison of funds disbursed vs physical possession.
 * 4. Approval Pipeline: Statutory clearances & department holding the file.
 * 5. What-If Planner: Interactive solution levers showing delay reduction in days.
 * 6. Actions Log: Official administrative interventions with verified impact tracking.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Sliders,
  ShieldCheck,
  Plus,
  Building,
  Scale,
  MapPin,
  Calendar,
  Sparkles,
  Check,
  RefreshCw,
  Clock,
  HelpCircle,
  IndianRupee,
} from 'lucide-react'
import { projectsAPI, decisionIntelligenceAPI } from '@/api/client'
import { PageHeader } from '@/components/common'
import type {
  ProjectSummaryHeaderData,
  LandBlockersData,
  WhatIfSimulationData,
  PaymentPossessionGapData,
  ProcessBottlenecksData,
  ProjectInterventionData,
  ProjectInterventionCreateData,
} from '@/api/client'

type TabKey = 'overview' | 'blockers' | 'gap' | 'bottlenecks' | 'simulator' | 'impact'

export default function DecisionIntelligence() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [showGuide, setShowGuide] = useState(false)

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
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const isMountedRef = useRef<boolean>(false)
  const skipDebounceRef = useRef<boolean>(true)

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
      setInterventions(overview.recent_interventions || [])

      // Initialize simulator sliders from baseline
      if (overview.what_if_baseline?.current_inputs) {
        const inp = overview.what_if_baseline.current_inputs
        setSimDisbursement(
          inp.compensation_disbursement_pct !== undefined && inp.compensation_disbursement_pct !== null
            ? Math.round(inp.compensation_disbursement_pct)
            : 50
        )
        setSimDisputes(
          inp.open_legal_dispute_count !== undefined && inp.open_legal_dispute_count !== null
            ? inp.open_legal_dispute_count
            : 0
        )
        setSimRehab(
          inp.rehabilitation_progress_pct !== undefined && inp.rehabilitation_progress_pct !== null
            ? Math.round(inp.rehabilitation_progress_pct)
            : 50
        )
        setSimResettlement(Boolean(inp.resettlement_site_ready))
        setSimUpdates(
          inp.stakeholder_update_count_90d !== undefined && inp.stakeholder_update_count_90d !== null
            ? inp.stakeholder_update_count_90d
            : 2
        )
        setActivePreset(null)
        skipDebounceRef.current = true
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
  const runSimulation = useCallback(
    async (overrides?: {
      disbursement?: number
      disputes?: number
      rehab?: number
      resettlement?: boolean
      updates?: number
    }) => {
      if (!selectedProjectId) return
      setSimulating(true)
      const disbursement = overrides?.disbursement !== undefined ? overrides.disbursement : simDisbursement
      const disputes = overrides?.disputes !== undefined ? overrides.disputes : simDisputes
      const rehab = overrides?.rehab !== undefined ? overrides.rehab : simRehab
      const resettlement = overrides?.resettlement !== undefined ? overrides.resettlement : simResettlement
      const updates = overrides?.updates !== undefined ? overrides.updates : simUpdates

      try {
        const res = await decisionIntelligenceAPI.simulate(selectedProjectId, {
          compensation_disbursement_pct: disbursement,
          open_legal_dispute_count: disputes,
          rehabilitation_progress_pct: rehab,
          resettlement_site_ready: resettlement,
          stakeholder_update_count_90d: updates,
        })
        setWhatIf(res)
      } catch (err) {
        console.error('Simulation failed:', err)
      } finally {
        setSimulating(false)
      }
    },
    [selectedProjectId, simDisbursement, simDisputes, simRehab, simResettlement, simUpdates]
  )

  // Preset scenarios for What-If: updates states and immediately runs simulation
  const applyPreset = (preset: 'AGGRESSIVE_SETTLEMENT' | 'SPEEDY_PAYOUT' | 'FULL_RESOLUTION') => {
    setActivePreset(preset)
    let nextDisputes = simDisputes
    let nextDisbursement = simDisbursement
    let nextRehab = simRehab
    let nextResettlement = simResettlement
    let nextUpdates = simUpdates

    if (preset === 'AGGRESSIVE_SETTLEMENT') {
      nextDisputes = 0
      nextUpdates = Math.max(simUpdates, 4)
    } else if (preset === 'SPEEDY_PAYOUT') {
      nextDisbursement = Math.min(100, Math.max(simDisbursement + 25, 85))
    } else if (preset === 'FULL_RESOLUTION') {
      nextDisputes = 0
      nextDisbursement = 90
      nextRehab = 85
      nextResettlement = true
      nextUpdates = 4
    }

    setSimDisputes(nextDisputes)
    setSimDisbursement(nextDisbursement)
    setSimRehab(nextRehab)
    setSimResettlement(nextResettlement)
    setSimUpdates(nextUpdates)

    skipDebounceRef.current = true
    runSimulation({
      disbursement: nextDisbursement,
      disputes: nextDisputes,
      rehab: nextRehab,
      resettlement: nextResettlement,
      updates: nextUpdates,
    })
  }

  // Auto-recalculate smoothly as user adjusts sliders (debounced 400ms)
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true
      return
    }
    if (skipDebounceRef.current) {
      skipDebounceRef.current = false
      return
    }
    if (!selectedProjectId) return

    const timer = setTimeout(() => {
      runSimulation()
    }, 400)

    return () => clearTimeout(timer)
  }, [simDisbursement, simDisputes, simRehab, simResettlement, simUpdates])

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
      setActionSuccessMsg(`Action logged! Delay reduced by ~${Math.round(created.delay_reduction_days)} days.`)
      setTimeout(() => setActionSuccessMsg(''), 6000)

      // Refresh overview
      loadProjectData(selectedProjectId)
    } catch (err) {
      console.error('Failed to record intervention:', err)
    } finally {
      setSavingAction(false)
    }
  }


  const getRiskBadge = (level: string) => {
    if (level === 'HIGH') {
      return {
        label: 'High Risk',
        sub: 'Critical Delay Imminent',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.35)',
      }
    }
    if (level === 'MEDIUM') {
      return {
        label: 'Moderate Risk',
        sub: 'Active Attention Required',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.35)',
      }
    }
    return {
      label: 'Low Risk',
      sub: 'Within Acceptable Schedule',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.35)',
    }
  }

  const riskMeta = summary ? getRiskBadge(summary.risk_level) : null

  const tabs: { key: TabKey; label: string; icon: any; count?: number | string }[] = [
    { key: 'overview', label: 'Executive Overview', icon: Brain },
    { key: 'blockers', label: 'Land Issues', icon: MapPin, count: blockers?.parcels_count },
    { key: 'gap', label: 'Funding Gap', icon: Scale },
    { key: 'bottlenecks', label: 'Approvals', icon: Building },
    { key: 'simulator', label: 'Simulator', icon: Sliders },
    { key: 'impact', label: 'Actions', icon: ShieldCheck, count: interventions.length },
  ]

  return (
    <div style={{ padding: '4px 0 60px 0', width: '100%' }}>
      {/* ─── Standardized Page Header ─── */}
      <PageHeader
        title="Decision Intelligence"
        subtitle="Identify delays and prioritize actions."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}
              title="Toggle user guide"
            >
              <HelpCircle size={14} />
              <span>{showGuide ? 'Hide Guide' : 'Guide'}</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label htmlFor="decision-intel-select" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                Project:
              </label>
              <select
                id="decision-intel-select"
                className="input"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                style={{
                  minWidth: 260,
                  maxWidth: 380,
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  borderColor: 'var(--color-border-strong)',
                  background: 'var(--color-bg-primary)',
                  padding: '6px 12px',
                  height: 36,
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.state_code || 'IN'})
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => selectedProjectId && loadProjectData(selectedProjectId)}
              title="Refresh analytics data"
              style={{ height: 36, padding: '0 10px' }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
          </div>
        }
      />

      {/* ─── Expandable Quick Reference Guide ─── */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginBottom: 16 }}
          >
            <div
              style={{
                background: 'rgba(244, 119, 33, 0.05)',
                border: '1px solid rgba(244, 119, 33, 0.2)',
                borderRadius: 10,
                padding: '14px 18px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 16,
                fontSize: '0.8rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              <div>
                <strong style={{ color: 'var(--color-accent-primary)', display: 'block', marginBottom: 2 }}>
                  1. Early Warning &amp; Bottlenecks
                </strong>
                Evaluates delay risk and reveals exactly which government office, land notification, or court case is holding the project.
              </div>
              <div>
                <strong style={{ color: 'var(--color-accent-primary)', display: 'block', marginBottom: 2 }}>
                  2. Money vs. Land Balance
                </strong>
                Highlights cases where 70%+ compensation is disbursed but under 40% physical possession is achieved (MoRTH Red Flag).
              </div>
              <div>
                <strong style={{ color: 'var(--color-accent-primary)', display: 'block', marginBottom: 2 }}>
                  3. What-If Simulator &amp; Ledger
                </strong>
                Scenario Simulator - Test interventions before implementation.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Success Notification */}
      {actionSuccessMsg && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            padding: '10px 16px',
            borderRadius: 8,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontWeight: 600,
            fontSize: '0.84rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{actionSuccessMsg}</span>
        </motion.div>
      )}

      {/* ─── Executive Summary KPI Strip ─── */}
      {summary && riskMeta && (
        <div
          className="card"
          style={{
            padding: '16px 20px',
            marginBottom: 20,
            background: 'var(--color-bg-secondary)',
            borderRadius: 12,
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 18,
              alignItems: 'center',
            }}
          >
            {/* Health & Risk Score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  background: riskMeta.bg,
                  border: `1.5px solid ${riskMeta.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: riskMeta.color, lineHeight: 1 }}>
                  {Math.round(summary.risk_score)}
                </span>
                <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>/100</span>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Project Health
                </div>
                <div style={{ fontSize: '0.96rem', fontWeight: 800, color: riskMeta.color, marginTop: 1 }}>
                  {riskMeta.label}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {riskMeta.sub}
                </div>
              </div>
            </div>

            {/* Projected Delay */}
            <div style={{ borderLeft: '1px solid var(--color-border-subtle)', paddingLeft: 16 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Estimated Delay
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 1 }}>
                {Math.round(summary.predicted_delay_days)} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>days</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', marginTop: 1 }}>
                {summary.predicted_delay_months} months behind schedule
              </div>
            </div>

            {/* Current Phase */}
            <div style={{ borderLeft: '1px solid var(--color-border-subtle)', paddingLeft: 16 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Current Stage &amp; State
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {summary.current_stage || 'In Progress'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-accent-primary)', fontWeight: 600, marginTop: 1 }}>
                Jurisdiction: State of {summary.state_code}
              </div>
            </div>

            {/* Critical Blocker Callout */}
            <div style={{ borderLeft: '1px solid var(--color-border-subtle)', paddingLeft: 16 }}>
              <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} />
                Main Risk
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {summary.main_blocker || 'No critical blocker reported'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Structured Navigation Tabs ─── */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--color-border-subtle)',
          marginBottom: 20,
          overflowX: 'auto',
          paddingBottom: 2,
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab(tab.key)}
              style={{
                borderRadius: '8px 8px 0 0',
                fontWeight: 600,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderBottom: isActive ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
              }}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--color-bg-secondary)',
                    color: isActive ? '#fff' : 'var(--color-text-muted)',
                    marginLeft: 2,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Loading Skeleton / State */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px auto' }} />
          Loading project intelligence data...
        </div>
      ) : (
        <div>

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: EXECUTIVE OVERVIEW                                            */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* 3 Structured Pillar Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>

                {/* 1. Primary Obstacle Card */}
                <div className="card" style={{ padding: 20, borderRadius: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Primary Obstacle
                      </span>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 700 }}>
                        {blockers?.days_pending ?? 0} days pending
                      </span>
                    </div>

                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                      {blockers?.most_blocking_issue || summary?.main_blocker || 'No critical blockers identified'}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 14 }}>
                      Stuck with: <strong style={{ color: 'var(--color-text-secondary)' }}>{blockers?.responsible_department || 'District Administration'}</strong>
                    </div>

                    <div style={{ background: 'var(--color-bg-secondary)', padding: '10px 12px', borderRadius: 8, fontSize: '0.78rem', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-subtle)' }}>
                      <strong style={{ color: 'var(--color-accent-primary)' }}>Remedy: </strong>
                      {summary?.action_needed || 'Follow up with revenue authorities for expedited clearance.'}
                    </div>
                  </div>

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setActiveTab('blockers')}
                    style={{ marginTop: 14, justifyContent: 'flex-start', paddingLeft: 0, color: 'var(--color-accent-primary)', fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    View land clearance journey <ArrowRight size={13} style={{ marginLeft: 4 }} />
                  </button>
                </div>

                {/* 2. Money vs. Land Balance Card */}
                <div className="card" style={{ padding: 20, borderRadius: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ color: 'var(--color-text-secondary)', fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Disbursement vs. Possession
                      </span>
                      {gap && (
                        <span style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 700,
                          background: gap.has_abnormal_gap ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          color: gap.has_abnormal_gap ? '#ef4444' : '#10b981',
                        }}>
                          {gap.has_abnormal_gap ? 'Imbalance Alert' : 'Balanced'}
                        </span>
                      )}
                    </div>

                    {gap && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                            <span>Funds Disbursed</span>
                            <strong style={{ color: 'var(--color-text-primary)' }}>{gap.payment_pct}%</strong>
                          </div>
                          <div style={{ height: 6, background: 'var(--color-bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${gap.payment_pct}%`, height: '100%', background: 'var(--color-accent-primary)', borderRadius: 3 }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                            <span>Physical Possession</span>
                            <strong style={{ color: '#10b981' }}>{gap.possession_pct}%</strong>
                          </div>
                          <div style={{ height: 6, background: 'var(--color-bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${gap.possession_pct}%`, height: '100%', background: '#10b981', borderRadius: 3 }} />
                          </div>
                        </div>

                        <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                          {gap.has_abnormal_gap
                            ? `Payment is ${Math.round(gap.payment_pct - gap.possession_pct)}% ahead of physical possession.`
                            : 'Disbursement and physical possession are progressing in sync.'}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setActiveTab('gap')}
                    style={{ marginTop: 14, justifyContent: 'flex-start', paddingLeft: 0, color: 'var(--color-accent-primary)', fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    Examine spending vs possession gap <ArrowRight size={13} style={{ marginLeft: 4 }} />
                  </button>
                </div>

                {/* 3. What-If Planner Card */}
                <div className="card" style={{ padding: 20, borderRadius: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ color: 'var(--color-text-secondary)', fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Solution Simulation (What-If)
                      </span>
                    </div>

                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                      Forecast delay days saved
                    </div>

                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 14px 0' }}>
                      Model out how many days can be saved by settling court stays or speeding up compensation payments.
                    </p>

                    {whatIf && (
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#3b82f6' }}>Potential time saved:</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#3b82f6' }}>
                          {whatIf.delay_reduction_days > 0 ? `${Math.round(whatIf.delay_reduction_days)} days` : 'Up to 90 days'}
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveTab('simulator')}
                    style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    Open What-If Simulator <ArrowRight size={13} />
                  </button>
                </div>
              </div>

              {/* Approval Pipeline Quick Row */}
              {bottlenecks && (
                <div className="card" style={{ padding: 20, borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        Statutory Approval Sequence
                      </h3>
                      <p style={{ margin: '3px 0 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                        Currently stuck at: <strong style={{ color: '#ef4444' }}>{bottlenecks.blocked_at}</strong> ({bottlenecks.responsible_department})
                      </p>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setActiveTab('bottlenecks')}
                      style={{ color: 'var(--color-accent-primary)', fontSize: '0.78rem', fontWeight: 700 }}
                    >
                      View All Steps <ArrowRight size={13} style={{ marginLeft: 4 }} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                    {bottlenecks.stages.map((st) => {
                      const isDone = st.status === 'COMPLETED'
                      const isBlocked = st.is_blocked_step
                      return (
                        <div
                          key={st.step_number}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: isBlocked ? 'rgba(239, 68, 68, 0.08)' : isDone ? 'rgba(16, 185, 129, 0.05)' : 'var(--color-bg-secondary)',
                            border: `1px solid ${isBlocked ? '#ef4444' : isDone ? 'rgba(16, 185, 129, 0.3)' : 'var(--color-border-subtle)'}`,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--color-text-muted)' }}>
                              STEP {st.step_number}
                            </span>
                            {isDone ? (
                              <Check size={12} color="#10b981" />
                            ) : isBlocked ? (
                              <AlertTriangle size={12} color="#ef4444" />
                            ) : null}
                          </div>
                          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: isBlocked ? '#ef4444' : 'var(--color-text-primary)' }}>
                            {st.name}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: LAND OBSTACLES & PARCELS                                      */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'blockers' && blockers && (
            <div className="card" style={{ padding: 20, borderRadius: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={18} color="var(--color-accent-primary)" />
                    Land Clearance Journey &amp; Parcels
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Six sequential readiness gates and individual parcel status.
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontWeight: 700,
                    background: blockers.risk_level === 'HIGH' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                    color: blockers.risk_level === 'HIGH' ? '#ef4444' : '#f59e0b',
                    border: `1px solid ${blockers.risk_level === 'HIGH' ? '#ef4444' : '#f59e0b'}`,
                  }}
                >
                  {blockers.risk_level} Priority Issue
                </span>
              </div>

              {/* 4 Summary Metric Tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
                <div style={{ background: 'var(--color-bg-secondary)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>RECORDED PARCELS</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 1 }}>
                    {blockers.parcels_count || 0}
                  </div>
                </div>
                <div style={{ background: 'var(--color-bg-secondary)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>COURT DISPUTES</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: (blockers.disputed_parcels_count || 0) > 0 ? '#ef4444' : '#10b981', marginTop: 1 }}>
                    {blockers.disputed_parcels_count || 0}
                  </div>
                </div>
                <div style={{ background: 'var(--color-bg-secondary)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>POSSESSION PENDING</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b', marginTop: 1 }}>
                    {blockers.possession_pending_count || 0}
                  </div>
                </div>
                <div style={{ background: 'var(--color-bg-secondary)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>DAYS PENDING</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 1 }}>
                    {blockers.days_pending} days
                  </div>
                </div>
              </div>

              {/* 6-Stage Clearance Journey */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                  Sequential Land Clearance Stages
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                  {blockers.nodes.map((node, index) => {
                    const isBlocked = node.status === 'BLOCKED'
                    const isWarning = node.status === 'WARNING'
                    const borderColor = isBlocked ? '#ef4444' : isWarning ? '#f59e0b' : 'rgba(16, 185, 129, 0.3)'
                    const bg = isBlocked ? 'rgba(239, 68, 68, 0.08)' : isWarning ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.04)'
                    const statusText = isBlocked ? 'Blocked' : isWarning ? 'Warning' : 'Cleared'

                    return (
                      <div
                        key={node.id}
                        style={{
                          background: bg,
                          border: `1.5px solid ${borderColor}`,
                          borderRadius: 8,
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--color-text-muted)' }}>
                              STAGE {index + 1}
                            </span>
                            <span style={{
                              fontSize: '0.6rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4,
                              background: isBlocked ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981', color: '#fff'
                            }}>
                              {statusText}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {node.label}
                          </div>
                          {node.detail && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                              {node.detail}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: MONEY VS. LAND (Payment-Possession Gap)                       */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'gap' && gap && (
            <div className="card" style={{ padding: 20, borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Scale size={18} color="var(--color-accent-primary)" />
                    Compensation Disbursed vs. Physical Land Possessed
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    MoRTH diagnostic: verifying if sanctioned compensation is converting into unencumbered right-of-way.
                  </p>
                </div>
                <span style={{
                  fontSize: '0.75rem', padding: '4px 10px', borderRadius: 6, fontWeight: 800,
                  background: gap.has_abnormal_gap ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: gap.has_abnormal_gap ? '#ef4444' : '#10b981',
                  border: `1px solid ${gap.has_abnormal_gap ? '#ef4444' : '#10b981'}`,
                }}>
                  {gap.status}
                </span>
              </div>

              {/* Progress Comparison Bars */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 18 }}>
                {/* 1. Compensation Paid */}
                <div style={{ background: 'var(--color-bg-secondary)', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <IndianRupee size={13} color="var(--color-accent-primary)" />
                      Compensation Paid
                    </span>
                    <span style={{ color: 'var(--color-accent-primary)' }}>{gap.payment_pct}%</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--color-bg-primary)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${gap.payment_pct}%`, height: '100%', background: 'var(--color-accent-primary)', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    ₹{(gap.compensation_disbursed_inr / 1e7).toFixed(1)} Cr disbursed out of ₹{(gap.compensation_sanctioned_inr / 1e7).toFixed(1)} Cr sanctioned
                  </div>
                </div>

                {/* 2. Land Handover */}
                <div style={{ background: 'var(--color-bg-secondary)', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={13} color="#10b981" />
                      Physical Land Received
                    </span>
                    <span style={{ color: '#10b981' }}>{gap.possession_pct}%</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--color-bg-primary)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${gap.possession_pct}%`, height: '100%', background: '#10b981', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    {gap.possessed_area_ha.toFixed(1)} ha possessed out of {gap.total_area_ha.toFixed(1)} ha total corridor
                  </div>
                </div>

                {/* 3. Delay Likelihood */}
                <div style={{ background: 'var(--color-bg-secondary)', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} color={(gap.likelihood_possession_delayed ?? 0) > 50 ? '#ef4444' : '#10b981'} />
                      Possession Delay Risk
                    </span>
                    <span style={{ color: (gap.likelihood_possession_delayed ?? 0) > 50 ? '#ef4444' : '#10b981' }}>
                      {gap.likelihood_possession_delayed !== undefined ? `${Math.round(gap.likelihood_possession_delayed)}%` : 'Low'}
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'var(--color-bg-primary)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{
                      width: `${Math.min(100, Math.max(0, gap.likelihood_possession_delayed ?? 0))}%`,
                      height: '100%',
                      background: (gap.likelihood_possession_delayed ?? 0) > 50 ? '#ef4444' : '#10b981',
                      borderRadius: 4
                    }} />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    {gap.has_abnormal_gap
                      ? `Disbursement is ahead of physical possession by ${Math.round(gap.payment_pct - gap.possession_pct)}%`
                      : 'Land handover is keeping pace with disbursements.'}
                  </div>
                </div>
              </div>

              {/* Diagnostic Callout */}
              <div style={{
                background: gap.has_abnormal_gap ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                borderLeft: `4px solid ${gap.has_abnormal_gap ? '#ef4444' : '#10b981'}`,
                borderRadius: '0 8px 8px 0',
                padding: '12px 16px',
                fontSize: '0.82rem',
              }}>
                <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {gap.diagnostic}
                </div>
                <div style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-accent-primary)' }}>Immediate Action Required: </span>
                  {gap.action_needed}
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* TAB 4: APPROVAL PIPELINE                                             */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'bottlenecks' && bottlenecks && (
            <div className="card" style={{ padding: 20, borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Building size={18} color="var(--color-accent-primary)" />
                    Statutory Clearances &amp; Approval Steps
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Identify the exact desk and administrative stage causing delay.
                  </p>
                </div>
              </div>

              {/* Pipeline KPI Cards */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10,
                background: 'var(--color-bg-secondary)', padding: '12px 16px', borderRadius: 8, marginBottom: 18,
                border: '1px solid var(--color-border-subtle)'
              }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Stuck At Stage
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ef4444', marginTop: 1 }}>
                    {bottlenecks.blocked_at}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Responsible Office
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 1 }}>
                    {bottlenecks.responsible_department}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Days Pending
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f59e0b', marginTop: 1 }}>
                    {bottlenecks.days_pending} days
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Project Delay Impact
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ef4444', marginTop: 1 }}>
                    +{Math.round(bottlenecks.estimated_days_impact ?? 0)} days
                  </div>
                </div>
              </div>

              {/* 6-Stage Statutory Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 18 }}>
                {bottlenecks.stages.map((stage) => {
                  const isBlocked = stage.is_blocked_step
                  const isDone = stage.status === 'COMPLETED'
                  const color = isBlocked ? '#ef4444' : isDone ? '#10b981' : 'var(--color-text-muted)'
                  const bg = isBlocked ? 'rgba(239, 68, 68, 0.08)' : isDone ? 'rgba(16, 185, 129, 0.05)' : 'var(--color-bg-secondary)'

                  return (
                    <div
                      key={stage.step_number}
                      style={{
                        background: bg,
                        border: `1.5px solid ${isBlocked ? '#ef4444' : isDone ? 'rgba(16, 185, 129, 0.3)' : 'var(--color-border-subtle)'}`,
                        borderRadius: 8,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ fontSize: '0.62rem', fontWeight: 800, color }}>STEP {stage.step_number}</span>
                          <span style={{
                            fontSize: '0.6rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4,
                            background: isBlocked ? '#ef4444' : isDone ? '#10b981' : '#64748b', color: '#fff'
                          }}>
                            {isBlocked ? 'Blocked' : isDone ? 'Done' : 'Pending'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {stage.name}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                          {stage.responsible_department}
                        </div>
                      </div>
                      {stage.details && (
                        <div style={{ fontSize: '0.68rem', color, fontWeight: 600, marginTop: 6 }}>
                          {stage.details}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Department Recommendation */}
              <div style={{
                padding: '10px 14px',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 8,
                fontSize: '0.8rem',
                color: 'var(--color-text-secondary)',
              }}>
                <span style={{ fontWeight: 700, color: 'var(--color-accent-primary)' }}>Recommended Action for Department: </span>
                {bottlenecks.recommendation}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* TAB 5: WHAT-IF PLANNER                                               */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'simulator' && whatIf && (
            <div className="card" style={{ padding: 20, borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sliders size={18} color="var(--color-accent-primary)" />
                    Interactive What-If Simulation
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Adjust factors below to see how much delay can be reduced.
                  </p>
                </div>

                {/* Quick Presets */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Presets:</span>
                  <button
                    type="button"
                    className={`btn btn-sm ${activePreset === 'AGGRESSIVE_SETTLEMENT' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => applyPreset('AGGRESSIVE_SETTLEMENT')}
                    style={{ fontSize: '0.72rem', padding: '3px 10px', height: 28, borderRadius: 6, gap: 4, display: 'inline-flex', alignItems: 'center' }}
                  >
                    <Scale size={12} />
                    Lok Adalat Fast-Track
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${activePreset === 'SPEEDY_PAYOUT' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => applyPreset('SPEEDY_PAYOUT')}
                    style={{ fontSize: '0.72rem', padding: '3px 10px', height: 28, borderRadius: 6, gap: 4, display: 'inline-flex', alignItems: 'center' }}
                  >
                    <IndianRupee size={12} />
                    Compensation Push
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${activePreset === 'FULL_RESOLUTION' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => applyPreset('FULL_RESOLUTION')}
                    style={{
                      fontSize: '0.72rem', padding: '3px 10px', height: 28, borderRadius: 6, gap: 4, display: 'inline-flex', alignItems: 'center',
                      borderColor: activePreset === 'FULL_RESOLUTION' ? undefined : 'var(--color-accent-primary)',
                      color: activePreset === 'FULL_RESOLUTION' ? '#fff' : 'var(--color-accent-primary)'
                    }}
                  >
                    <Sparkles size={12} />
                    Comprehensive Package
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 20 }}>
                {/* Controllable Levers Panel */}
                <div style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 10,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 6 }}>
                    Adjust Levers
                  </div>

                  {/* 1. Compensation Disbursement % */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      <span>Compensation Payout Rate</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {whatIf.current_inputs?.compensation_disbursement_pct !== undefined && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                            (Baseline: {Math.round(whatIf.current_inputs.compensation_disbursement_pct)}%)
                          </span>
                        )}
                        <span style={{ color: 'var(--color-accent-primary)', fontWeight: 800 }}>{simDisbursement}%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={simDisbursement}
                      onChange={(e) => {
                        setActivePreset(null)
                        setSimDisbursement(Number(e.target.value))
                      }}
                      style={{ width: '100%', accentColor: 'var(--color-accent-primary)', cursor: 'pointer', marginTop: 6 }}
                    />
                  </div>

                  {/* 2. Open Disputes Count */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      <span>Resolve Court Disputes (Remaining Cases)</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {whatIf.current_inputs?.open_legal_dispute_count !== undefined && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                            (Baseline: {whatIf.current_inputs.open_legal_dispute_count} cases)
                          </span>
                        )}
                        <span style={{ color: simDisputes > 0 ? '#ef4444' : '#10b981', fontWeight: 800 }}>{simDisputes} cases</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(10, (whatIf.current_inputs?.open_legal_dispute_count ?? 0) + 4)}
                      value={simDisputes}
                      onChange={(e) => {
                        setActivePreset(null)
                        setSimDisputes(Number(e.target.value))
                      }}
                      style={{ width: '100%', accentColor: '#ef4444', cursor: 'pointer', marginTop: 6 }}
                    />

                  </div>

                  {/* 3. Rehabilitation Progress % */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      <span>Rehabilitation &amp; Resettlement Completion</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {whatIf.current_inputs?.rehabilitation_progress_pct !== undefined && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                            (Baseline: {Math.round(whatIf.current_inputs.rehabilitation_progress_pct)}%)
                          </span>
                        )}
                        <span style={{ color: '#8b5cf6', fontWeight: 800 }}>{simRehab}%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={simRehab}
                      onChange={(e) => {
                        setActivePreset(null)
                        setSimRehab(Number(e.target.value))
                      }}
                      style={{ width: '100%', accentColor: '#8b5cf6', cursor: 'pointer', marginTop: 6 }}
                    />
                  </div>

                  {/* 4. Resettlement Ready Checkbox */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={simResettlement}
                        onChange={(e) => {
                          setActivePreset(null)
                          setSimResettlement(e.target.checked)
                        }}
                        style={{ width: 16, height: 16, accentColor: 'var(--color-accent-primary)' }}
                      />
                      Resettlement Colony Infrastructure Ready
                    </label>
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={() => runSimulation()}
                    disabled={simulating}
                    style={{ width: '100%', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 14px' }}
                  >
                    {simulating ? <div className="spinner-sm" /> : <Sparkles size={15} />}
                    {simulating ? 'Calculating Delay Reduction...' : 'Recalculate Delay Reduction'}
                  </button>
                </div>

                {/* Results Panel */}
                <div style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 10,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 6, marginBottom: 14 }}>
                      Projected Outcome
                    </div>

                    {/* Delay Saved Metric Highlight */}
                    <div style={{
                      background: whatIf.delay_reduction_days > 0
                        ? 'rgba(16, 185, 129, 0.08)'
                        : whatIf.simulated_delay_days > whatIf.baseline_delay_days
                          ? 'rgba(239, 68, 68, 0.08)'
                          : 'rgba(100, 116, 139, 0.08)',
                      border: `1px solid ${whatIf.delay_reduction_days > 0
                        ? 'rgba(16, 185, 129, 0.35)'
                        : whatIf.simulated_delay_days > whatIf.baseline_delay_days
                          ? 'rgba(239, 68, 68, 0.35)'
                          : 'rgba(100, 116, 139, 0.25)'
                        }`,
                      borderRadius: 8,
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 14,
                      transition: 'all 0.2s ease',
                      opacity: simulating ? 0.7 : 1,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {whatIf.delay_reduction_days > 0 ? (
                          <TrendingDown size={22} color="#10b981" />
                        ) : whatIf.simulated_delay_days > whatIf.baseline_delay_days ? (
                          <TrendingUp size={22} color="#ef4444" />
                        ) : (
                          <Clock size={22} color="#64748b" />
                        )}
                        <div>
                          <div style={{
                            fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                            color: whatIf.delay_reduction_days > 0
                              ? '#10b981'
                              : whatIf.simulated_delay_days > whatIf.baseline_delay_days
                                ? '#ef4444'
                                : 'var(--color-text-muted)'
                          }}>
                            {whatIf.delay_reduction_days > 0
                              ? 'Calculated Delay Reduction'
                              : whatIf.simulated_delay_days > whatIf.baseline_delay_days
                                ? 'Projected Delay Impact'
                                : 'Calculated Delay Reduction'}
                          </div>
                          <div style={{
                            fontSize: '1.3rem', fontWeight: 900,
                            color: whatIf.delay_reduction_days > 0
                              ? '#10b981'
                              : whatIf.simulated_delay_days > whatIf.baseline_delay_days
                                ? '#ef4444'
                                : 'var(--color-text-primary)'
                          }}>
                            {whatIf.delay_reduction_days > 0
                              ? `${Math.round(whatIf.delay_reduction_days)} Days Saved`
                              : whatIf.simulated_delay_days > whatIf.baseline_delay_days
                                ? `+${Math.round(whatIf.simulated_delay_days - whatIf.baseline_delay_days)} Days Added Delay`
                                : 'Baseline Schedule (0d saved)'}
                          </div>
                        </div>
                      </div>
                      {whatIf.delay_reduction_days > 0 && (
                        <div style={{ fontSize: '0.72rem', color: '#10b981', textAlign: 'right', fontWeight: 600 }}>
                          ~{(whatIf.delay_reduction_days / 30).toFixed(1)} months saved
                        </div>
                      )}
                      {whatIf.simulated_delay_days > whatIf.baseline_delay_days && (
                        <div style={{ fontSize: '0.72rem', color: '#ef4444', textAlign: 'right', fontWeight: 600 }}>
                          +{((whatIf.simulated_delay_days - whatIf.baseline_delay_days) / 30).toFixed(1)} months
                        </div>
                      )}
                    </div>

                    {/* Before vs After comparison */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                      <div style={{ background: 'var(--color-bg-primary)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>CURRENT BASELINE</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 1 }}>
                          {Math.round(whatIf.baseline_risk_score)} <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>/100</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: whatIf.baseline_risk_level === 'HIGH' ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                          {whatIf.baseline_risk_level} Risk • {Math.round(whatIf.baseline_delay_days)}d delay
                        </div>
                      </div>

                      <div style={{
                        background: whatIf.improved ? 'rgba(16, 185, 129, 0.08)' : 'var(--color-bg-primary)',
                        border: whatIf.improved ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--color-border-subtle)',
                        padding: '10px 12px',
                        borderRadius: 8
                      }}>
                        <div style={{ fontSize: '0.68rem', color: whatIf.improved ? '#10b981' : 'var(--color-text-muted)', fontWeight: 600 }}>WITH INTERVENTIONS</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: whatIf.improved ? '#10b981' : 'var(--color-text-primary)', marginTop: 1 }}>
                          {Math.round(whatIf.simulated_risk_score)} <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>/100</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: whatIf.simulated_risk_level === 'HIGH' ? '#ef4444' : whatIf.simulated_risk_level === 'MEDIUM' ? '#f59e0b' : '#10b981', fontWeight: 700 }}>
                          {whatIf.simulated_risk_level} Risk • {Math.round(whatIf.simulated_delay_days)}d delay
                        </div>
                      </div>
                    </div>

                    {/* Minimum practical changes */}
                    {whatIf.minimum_practical_changes && whatIf.minimum_practical_changes.length > 0 && (
                      <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', background: 'var(--color-bg-primary)', padding: '10px 12px', borderRadius: 8 }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                          Key Action Path:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {whatIf.minimum_practical_changes.map((step, idx) => (
                            <li key={idx} style={{ marginTop: 2 }}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* TAB 6: ACTIONS TAKEN & VERIFIED RESULTS                              */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'impact' && (
            <div className="card" style={{ padding: 20, borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={18} color="var(--color-accent-primary)" />
                    Official Action Ledger &amp; Verified Results
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Record administrative interventions and measure real impact on project schedule.
                  </p>
                </div>
                <button
                  id="log-new-action-btn"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowActionModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} />
                  Record Official Action
                </button>
              </div>

              {interventions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {interventions.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: 8,
                        padding: '12px 16px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ maxWidth: 520 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: '0.66rem', padding: '2px 7px', borderRadius: 4, fontWeight: 700,
                            background: 'rgba(244, 119, 33, 0.12)', color: 'var(--color-accent-primary)',
                          }}>
                            {item.intervention_type.replace(/_/g, ' ')}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={11} />
                            {item.action_date}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 3 }}>
                          {item.title}
                        </div>
                        {item.description && (
                          <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                            {item.description}
                          </div>
                        )}
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                          Nodal Authority: <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.action_taken_by}</span>
                        </div>
                      </div>

                      {/* Before / After Metrics */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ textAlign: 'center', background: 'var(--color-bg-primary)', padding: '6px 10px', borderRadius: 6 }}>
                          <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>RISK BEFORE</div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ef4444' }}>
                            {item.risk_score_before}
                          </div>
                        </div>

                        <ArrowRight size={14} color="var(--color-text-muted)" />

                        <div style={{ textAlign: 'center', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 10px', borderRadius: 6 }}>
                          <div style={{ fontSize: '0.62rem', color: '#10b981', fontWeight: 600 }}>RISK AFTER</div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#10b981' }}>
                            {item.risk_score_after}
                          </div>
                        </div>

                        <div style={{ textAlign: 'center', background: 'rgba(59, 130, 246, 0.08)', padding: '6px 10px', borderRadius: 6 }}>
                          <div style={{ fontSize: '0.62rem', color: '#3b82f6', fontWeight: 600 }}>DELAY SAVED</div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#3b82f6' }}>
                            {Math.round(item.delay_reduction_days)} days
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
                  padding: '32px 24px',
                  textAlign: 'center',
                }}>
                  <ShieldCheck size={32} style={{ margin: '0 auto 10px', color: 'var(--color-accent-primary)', opacity: 0.6 }} />
                  <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--color-text-primary)' }}>
                    No Official Interventions Recorded Yet
                  </div>
                  <p style={{ margin: '6px auto 16px', fontSize: '0.8rem', color: 'var(--color-text-muted)', maxWidth: 460 }}>
                    The Action Ledger tracks verified administrative steps (such as Special Lok Adalats, expedited compensation release, or R&amp;R layout approvals) and calculates real-time ML delay reductions.
                  </p>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowActionModal(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '0 auto' }}
                  >
                    <Plus size={14} /> Record First Official Action
                  </button>
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
              style={{ width: '100%', maxWidth: 500, padding: 20, borderRadius: 12, background: 'var(--color-bg-secondary)' }}
            >
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Record Official Action
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                Log an administrative intervention to calculate verified delay reductions.
              </p>

              <form onSubmit={handleSaveIntervention} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>
                    Action Category
                  </label>
                  <select
                    className="input"
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    style={{ width: '100%', fontSize: '0.82rem' }}
                  >
                    <option value="DISPUTE_RESOLUTION">Dispute Resolution (Lok Adalat / Settlement)</option>
                    <option value="COMPENSATION_RELEASE">Compensation Release (Direct Bank Transfer)</option>
                    <option value="APPROVAL_COMPLETION">Statutory Approval &amp; Treasury Sanction</option>
                    <option value="RR_PROGRESS">Rehabilitation &amp; Resettlement Colony</option>
                    <option value="POSSESSION_ACTION">Possession &amp; Boundary Demarcation</option>
                    <option value="OTHER">Other Administrative Intervention</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>
                    Action Title *
                  </label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="e.g. Disposed 3 court stay petitions via Special Lok Adalat"
                    value={actionTitle}
                    onChange={(e) => setActionTitle(e.target.value)}
                    style={{ width: '100%', fontSize: '0.82rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>
                    Order Reference / Details
                  </label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Provide meeting minutes, Gazette notification numbers, or key agreements."
                    value={actionDesc}
                    onChange={(e) => setActionDesc(e.target.value)}
                    style={{ width: '100%', fontSize: '0.82rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>
                    Nodal Officer / Department
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Special Land Acquisition Officer / District Magistrate"
                    value={actionOfficer}
                    onChange={(e) => setActionOfficer(e.target.value)}
                    style={{ width: '100%', fontSize: '0.82rem' }}
                  />
                </div>

                {actionType === 'DISPUTE_RESOLUTION' && (
                  <div>
                    <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>
                      Number of Disputes Resolved
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="input"
                      value={actionDisputesResolved}
                      onChange={(e) => setActionDisputesResolved(Number(e.target.value))}
                      style={{ width: '100%', fontSize: '0.82rem' }}
                    />
                  </div>
                )}

                {actionType === 'COMPENSATION_RELEASE' && (
                  <div>
                    <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 3 }}>
                      Additional Funds Released (%)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      className="input"
                      value={actionCompRelease}
                      onChange={(e) => setActionCompRelease(Number(e.target.value))}
                      style={{ width: '100%', fontSize: '0.82rem' }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowActionModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={savingAction}
                  >
                    {savingAction ? 'Calculating...' : 'Save Action'}
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
