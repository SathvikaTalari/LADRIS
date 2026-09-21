import { useEffect, useState, useMemo, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Edit3,
  MapPin,
  RefreshCw,
  Trash2,
  AlertCircle,
  Calendar,
  Building2,
  ShieldAlert,
} from 'lucide-react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { predictionsAPI, projectsAPI } from '@/api/client'
import type { PredictionResult, Project, RiskLevel, ProjectStatus } from '@/types'
import { EmptyState } from '@/components/common'
import { formatDate, formatINR } from '@/utils'
import { useAuthStore } from '@/store/authStore'

type Tab = 'overview' | 'stages' | 'risk' | 'actions'

function formatFeatureName(name: string): string {
  const map: Record<string, string> = {
    compensation_disbursement_ratio: 'Compensation Paid vs Sanctioned',
    rehabilitation_progress_pct: 'Rehabilitation & Resettlement (R&R) Progress',
    max_dispute_pendency_days: 'Pending Court Dispute Time',
    dispute_count: 'Active Legal Disputes Count',
    stakeholder_update_cadence_days: 'Days Since Last Progress Update',
    total_area_ha: 'Total Land Area Required',
    total_affected_families: 'Number of Affected Families',
    approval_timeline_days: 'Approval Processing Time',
    possession_status_pct: 'Physical Land Possession',
    district_historical_delay_rate: 'District Historical Delay Rate',
    agency_historical_delay_rate: 'Agency Historical Track Record',
    scheduled_area: 'Scheduled / Tribal Area Status',
    forest_area_ha: 'Forest Land Involved',
    acquisition_mode: 'Mode of Acquisition',
  }
  return map[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const DRIVER_TITLE_MAP: Record<string, string> = {
  compensation_disbursement_pct: 'Compensation Disbursement',
  compensation_disbursement_ratio: 'Compensation Disbursement',
  compensation_disbursed: 'Compensation Disbursement',
  compensation_sanctioned: 'Compensation Sanctioned',
  rehabilitation_progress_pct: 'R&R Progress',
  open_legal_dispute_count: 'Open Disputes',
  dispute_count: 'Open Disputes',
  legal_dispute_count: 'Legal Disputes',
  max_dispute_pendency_days: 'Dispute Pendency',
  days_to_expected_completion: 'Time Remaining',
  remaining_statutory_days: 'Time Remaining',
  timeline_days: 'Time Remaining',
  district_historical_delay_rate: 'Historical Area Risk',
  agency_historical_delay_rate: 'Agency Historical Track Record',
  stakeholder_update_cadence_days: 'Stakeholder Reporting Gap',
  avg_days_between_updates: 'Stakeholder Update Gap',
  stakeholder_update_count_90d: 'Stakeholder Updates',
  days_since_last_disbursement: 'Disbursement Activity',
  days_since_notification: 'Project Age Since 3A',
  affected_families_count: 'Affected Families',
  total_affected_families: 'Affected Families',
  land_area_hectares: 'Land Area Required',
  total_area_ha: 'Total Land Area',
  possession_status_pct: 'Physical Land Possession',
  forest_area_ha: 'Forest Land Involved',
  scheduled_area: 'Scheduled / Tribal Area',
  approval_timeline_days: 'Approval Processing Time',
}

function formatCurrentSituation(feature: string, val: any): string {
  if (val == null || val === '') return 'Not available'
  const num = Number(val)
  if (!isNaN(num)) {
    if (feature.includes('pct') || feature.includes('ratio')) {
      const pct = num <= 1 && feature.includes('ratio') ? num * 100 : num
      if (feature.includes('compensation') || feature.includes('disbursement')) {
        return `${Math.round(pct)}% paid`
      }
      if (feature.includes('rehab') || feature.includes('r&r') || feature.includes('possession')) {
        return `${Math.round(pct)}% complete`
      }
      return `${Math.round(pct)}%`
    }
    if (feature.includes('dispute') || feature.includes('case')) {
      return `${Math.round(num)} ${Math.round(num) === 1 ? 'case' : 'cases'}`
    }
    if (feature.includes('famil')) {
      return `${Math.round(num)} families`
    }
    if (feature.includes('days') || feature.includes('time') || feature.includes('completion')) {
      return `${Math.round(num)} days`
    }
    if (feature.includes('ha') || feature.includes('area')) {
      return `${num.toLocaleString()} ha`
    }
    if (feature.includes('rate')) {
      return num >= 0.4 ? 'High' : num >= 0.2 ? 'Moderate' : 'Low'
    }
    if (feature.includes('update')) {
      return `${Math.round(num)} updates`
    }
  }
  if (typeof val === 'boolean') {
    return val ? 'Yes' : 'No'
  }
  return String(val)
}

function getImpactMeta(driver: any, index: number) {
  const contribution = driver.contribution != null ? Number(driver.contribution) : 0
  const isIncreases = driver.direction === 'increases_risk' || contribution > 0
  const absContrib = Math.abs(contribution)

  if (!isIncreases) {
    return {
      label: 'Reduces risk',
      dotColor: '#10b981', // Green
      textColor: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.1)',
    }
  }

  if (index === 0 || absContrib >= 0.08) {
    return {
      label: 'High impact',
      dotColor: '#ef4444', // Red
      textColor: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.1)',
    }
  }
  if (index === 1 || absContrib >= 0.03) {
    return {
      label: 'Medium impact',
      dotColor: '#f97316', // Orange
      textColor: '#f97316',
      badgeBg: 'rgba(249, 115, 22, 0.1)',
    }
  }
  return {
    label: 'Supporting factor',
    dotColor: '#eab308', // Yellow
    textColor: '#eab308',
    badgeBg: 'rgba(234, 179, 8, 0.1)',
  }
}

function getPlainLanguageMeaning(feature: string, value: any, direction: string): string {
  const num = Number(value)
  const isNum = !isNaN(num)
  const isRisk = direction === 'increases_risk' || Number(value) < 0

  if (feature.includes('compensation') || feature.includes('disbursement')) {
    if (isNum && num <= 40) return 'Most compensation is still pending'
    if (isNum && num < 70) return 'Compensation release is behind schedule'
    if (isRisk) return 'Disbursement delays risk landowner resistance'
    return 'Strong compensation release helps secure unencumbered land'
  }

  if (feature.includes('rehab') || feature.includes('r&r')) {
    if (isNum && num <= 35) return 'Rehabilitation is far behind'
    if (isNum && num < 70) return 'Resettlement colony progress is lagging'
    if (isRisk) return 'Incomplete resettlement holds up physical handover'
    return 'R&R colony progress supports smooth handover'
  }

  if (feature.includes('dispute') || feature.includes('court') || feature.includes('legal')) {
    if (isNum && num > 0) return 'Legal issues may delay possession'
    if (isRisk) return 'Litigation poses risk to clear right-of-way'
    return 'Clear legal status with no active stay petitions'
  }

  if (feature.includes('completion') || feature.includes('timeline') || feature.includes('days_to')) {
    if (isNum && num <= 60) return 'Very little time remains before deadline'
    if (isNum && num <= 120) return 'Tight timeline leaves little buffer for clearance'
    if (isRisk) return 'Schedule pressure limits buffer for statutory approvals'
    return 'Adequate schedule buffer exists before target date'
  }

  if (feature.includes('historical') || feature.includes('district') || feature.includes('agency')) {
    if (isRisk) return 'Similar projects in this area often face delays'
    return 'Region historically demonstrates prompt project delivery'
  }

  if (feature.includes('update') || feature.includes('cadence')) {
    if (isRisk) return 'Infrequent inter-agency updates slow down approvals'
    return 'Active stakeholder updates keep departments aligned'
  }

  if (feature.includes('area') || feature.includes('ha')) {
    if (isRisk) return 'Large acquisition scale increases survey & notification complexity'
    return 'Manageable land footprint enables focused execution'
  }

  if (feature.includes('famil')) {
    if (isRisk) return 'High affected family count requires extensive consultations'
    return 'Low social impact accelerates local consensus'
  }

  if (feature.includes('pendency')) {
    if (isRisk) return 'Long-standing dispute requires judicial escalation'
    return 'Disputes are resolved within normal timeframes'
  }

  if (feature.includes('notification')) {
    if (isRisk) return 'Extended period since preliminary notification'
    return 'Recent notification with active momentum'
  }

  return isRisk
    ? 'Contributes to project schedule slippage'
    : 'Helps maintain momentum toward delivery'
}

function getMainReason(drivers: any[], riskScore: number): string {
  if (riskScore < 40) {
    return 'Statutory milestones and project parameters are well on schedule.'
  }
  const topRiskDrivers = drivers.filter((d) => d.direction === 'increases_risk' || Number(d.contribution) > 0)
  if (topRiskDrivers.length === 0) {
    return 'Schedule is moving within normal statutory limits.'
  }

  const first = topRiskDrivers[0]
  const second = topRiskDrivers.length > 1 ? topRiskDrivers[1] : null

  const firstTitle = DRIVER_TITLE_MAP[first.feature] || first.feature.replace(/_/g, ' ')
  const secondTitle = second ? (DRIVER_TITLE_MAP[second.feature] || second.feature.replace(/_/g, ' ')) : null

  if (first.feature.includes('compensation') && second && second.feature.includes('rehab')) {
    return 'Compensation and R&R progress are too low.'
  }
  if (first.feature.includes('rehab') && second && second.feature.includes('compensation')) {
    return 'R&R progress and compensation payouts are lagging behind.'
  }
  if (first.feature.includes('dispute')) {
    return secondTitle
      ? `Active legal disputes and ${secondTitle.toLowerCase()} are impeding possession.`
      : 'Open court disputes are holding up physical possession.'
  }
  if (first.feature.includes('time') || first.feature.includes('completion')) {
    return 'Critical deadline is approaching while key statutory clearances remain pending.'
  }
  if (secondTitle) {
    return `${firstTitle} and ${secondTitle.toLowerCase()} are the primary factors causing delay.`
  }
  return `${firstTitle} is the primary factor increasing delay risk.`
}

function formatWhy(feature: string, value: any): ReactNode {
  const f = feature.toLowerCase()

  if (f.includes('compensation') && (f.includes('pct') || f.includes('disbursement') || f.includes('ratio'))) {
    const num = Number(value)
    const formatted = !isNaN(num) ? (num > 1 ? num.toFixed(1) : (num * 100).toFixed(1)) : '0.0'
    return (
      <span>
        Only <strong style={{ color: 'var(--color-text-primary)' }}>{formatted}%</strong> has been paid
      </span>
    )
  }

  if (f.includes('rehab') && f.includes('pct')) {
    const num = Number(value)
    const formatted = !isNaN(num) ? Math.round(num > 1 ? num : num * 100) : 0
    return (
      <span>
        R&R progress is only <strong style={{ color: 'var(--color-text-primary)' }}>{formatted}%</strong>
      </span>
    )
  }

  if (f.includes('resettlement')) {
    return <span>Resettlement site readiness is pending, stalling physical possession</span>
  }

  if (f.includes('open_legal_dispute') || (f.includes('dispute') && f.includes('count'))) {
    const count = Number(value) || 1
    return (
      <span>
        <strong style={{ color: 'var(--color-text-primary)' }}>{count}</strong> active legal dispute{count > 1 ? 's' : ''} pending in court
      </span>
    )
  }

  if (f.includes('pendency')) {
    const days = Math.round(Number(value)) || 0
    return (
      <span>
        Oldest court objection has been pending for <strong style={{ color: 'var(--color-text-primary)' }}>{days} days</strong>
      </span>
    )
  }

  if (f.includes('days_since_notification') || f.includes('notification')) {
    const days = Math.round(Number(value)) || 0
    return (
      <span>
        <strong style={{ color: 'var(--color-text-primary)' }}>{days} days</strong> elapsed since preliminary notification
      </span>
    )
  }

  if (f.includes('last_disbursement')) {
    const days = Math.round(Number(value)) || 0
    return (
      <span>
        No disbursement recorded for <strong style={{ color: 'var(--color-text-primary)' }}>{days} days</strong>
      </span>
    )
  }

  if (f.includes('stakeholder') || f.includes('update')) {
    const count = Number(value) || 0
    return (
      <span>
        Only <strong style={{ color: 'var(--color-text-primary)' }}>{count}</strong> stakeholder update(s) recorded in 90 days
      </span>
    )
  }

  if (f.includes('district_historical') || f.includes('district')) {
    const rate = Number(value) || 0
    const pct = rate > 1 ? rate.toFixed(1) : (rate * 100).toFixed(1)
    return (
      <span>
        District has a high historical delay rate of <strong style={{ color: 'var(--color-text-primary)' }}>{pct}%</strong>
      </span>
    )
  }

  if (f.includes('agency_historical') || f.includes('agency')) {
    const rate = Number(value) || 0
    const pct = rate > 1 ? rate.toFixed(1) : (rate * 100).toFixed(1)
    return (
      <span>
        Implementing agency has a historical delay rate of <strong style={{ color: 'var(--color-text-primary)' }}>{pct}%</strong>
      </span>
    )
  }

  if (f.includes('days_to_expected_completion') || f.includes('completion')) {
    const days = Math.round(Number(value)) || 0
    if (days < 0) {
      return (
        <span>
          Project is <strong style={{ color: 'var(--color-text-primary)' }}>{Math.abs(days)} days past</strong> planned completion date
        </span>
      )
    }
    return (
      <span>
        Only <strong style={{ color: 'var(--color-text-primary)' }}>{days} days remain</strong> until scheduled completion
      </span>
    )
  }

  if (f.includes('land_area') || f.includes('hectares')) {
    const ha = Number(value) ? Number(value).toFixed(1) : '0'
    return (
      <span>
        Project involves large acquisition scope of <strong style={{ color: 'var(--color-text-primary)' }}>{ha} ha</strong>
      </span>
    )
  }

  if (f.includes('families')) {
    const count = Math.round(Number(value)) || 0
    return (
      <span>
        Project affects <strong style={{ color: 'var(--color-text-primary)' }}>{count} families</strong> requiring rehabilitation
      </span>
    )
  }

  return (
    <span>
      Contributing factor: <strong style={{ color: 'var(--color-text-primary)' }}>{feature.replace(/_/g, ' ')}</strong>
    </span>
  )
}

function getActionMeta(feature: string): { action: string; owner: string } {
  const f = feature.toLowerCase()

  if (f.includes('compensation') && (f.includes('pct') || f.includes('disbursement') || f.includes('disbursed') || f.includes('ratio'))) {
    return {
      action: 'Accelerate compensation disbursement',
      owner: 'LA Officer / Finance',
    }
  }

  if (f.includes('rehab') || f.includes('resettlement')) {
    return {
      action: 'Speed up R&R activities and site readiness',
      owner: 'R&R Cell / District Admin',
    }
  }

  if (f.includes('open_legal_dispute') || f.includes('dispute_count') || f.includes('legal_dispute')) {
    return {
      action: 'Fast-track hearings for pending court disputes',
      owner: 'Legal Cell / Special LAO',
    }
  }

  if (f.includes('pendency')) {
    return {
      action: 'Escalate long-pending litigation for urgent hearing',
      owner: 'Legal Cell / Government Pleader',
    }
  }

  if (f.includes('days_since_notification') || f.includes('notification')) {
    return {
      action: 'Publish Section 19 declaration to prevent notification lapse',
      owner: 'Competent Authority (CALA) / Revenue Dept',
    }
  }

  if (f.includes('last_disbursement')) {
    return {
      action: 'Investigate payment stall and release pending compensation',
      owner: 'Treasury / LA Finance Cell',
    }
  }

  if (f.includes('stakeholder') || f.includes('update')) {
    return {
      action: 'Enforce bi-weekly inter-agency coordination cadence',
      owner: 'Nodal Project Officer / PMU',
    }
  }

  if (f.includes('district_historical')) {
    return {
      action: 'Deploy district-level land acquisition monitoring cell',
      owner: 'District Magistrate / Revenue Officer',
    }
  }

  if (f.includes('agency_historical')) {
    return {
      action: 'Conduct joint review with implementing agency leadership',
      owner: 'Executing Agency Head / MoRTH Liaison',
    }
  }

  if (f.includes('days_to_expected_completion') || f.includes('completion')) {
    return {
      action: 'Conduct emergency schedule review and re-baseline critical path',
      owner: 'Project Director / Implementing Agency',
    }
  }

  if (f.includes('land_area')) {
    return {
      action: 'Deploy additional revenue survey teams for physical demarcation',
      owner: 'District Land Records / Survey Dept',
    }
  }

  if (f.includes('families')) {
    return {
      action: 'Assign dedicated R&R coordinators for family socio-economic surveys',
      owner: 'R&R Cell / Social Welfare Dept',
    }
  }

  return {
    action: `Address ${feature.replace(/_/g, ' ')} bottlenecks`,
    owner: 'Competent Authority (CALA)',
  }
}

function getCriticalBottleneckAction(criticalStage: any) {
  const stageKey = (typeof criticalStage === 'string' ? criticalStage : criticalStage?.stage || '').toLowerCase()
  const stageName = (typeof criticalStage === 'object' && criticalStage?.stage_name_display) || criticalStage?.stage?.replace(/_/g, ' ') || 'Active Stage'

  let owner = 'Competent Authority (CALA)'
  let action = `Resolve ${stageName} bottlenecks to enable downstream progression`
  if (stageKey.includes('notification') || stageKey.includes('approval')) {
    owner = 'Revenue Dept / Competent Authority (CALA)'
    action = 'Finalize statutory 3A/3D notifications and resolve gazette objections'
  } else if (stageKey.includes('survey')) {
    owner = 'Survey & Settlement Dept / SIA Unit'
    action = 'Complete joint measurement survey and boundary pillar demarcation'
  } else if (stageKey.includes('compensation')) {
    owner = 'Competent Authority (CALA) / Finance'
    action = 'Disburse pending award compensation to verified land owners'
  } else if (stageKey.includes('legal')) {
    owner = 'Legal Cell / Revenue Division'
    action = 'Expedite hearing and out-of-court settlement for high-risk land disputes'
  } else if (stageKey.includes('rehab')) {
    owner = 'R&R Cell / District Admin'
    action = 'Complete R&R package entitlement and resettlement site development'
  } else if (stageKey.includes('possession')) {
    owner = 'District Administration / Police Liaison'
    action = 'Complete physical possession handover and clear encumbrances'
  }

  return {
    action,
    why: <span>Stage is currently blocking downstream project milestones and increasing risk</span>,
    owner: owner,
    target: 'Immediate',
    status: 'Immediate',
    dotColor: '#f59e0b',
    statusBg: 'rgba(245, 158, 11, 0.08)',
    statusColor: '#d97706',
    statusBorder: 'rgba(245, 158, 11, 0.25)',
  }
}

// ─── Compact Status Indicator (government portal style) ─────────────────────
function StatusIndicator({ status }: { status: ProjectStatus }) {
  const norm = (status || '').toLowerCase().replace(/\s/g, '_')
  const labels: Record<string, string> = {
    active: 'Active', delayed: 'Delayed', approved: 'Approved',
    draft: 'Draft', completed: 'Completed', on_hold: 'On Hold',
    under_review: 'Under Review', cancelled: 'Cancelled',
  }
  const label = labels[norm] ?? String(status)
  const cls = ['active', 'delayed', 'approved', 'draft', 'completed', 'on_hold'].includes(norm) ? norm : 'default'
  return (
    <span className={`pl-status pl-status--${cls}`}>
      <span className="pl-status-dot" />
      {label}
    </span>
  )
}

// ─── Compact Risk Indicator (government portal style) ────────────────────────
function RiskIndicator({ level }: { level: string | RiskLevel }) {
  const norm = (level || '').toLowerCase()
  const labels: Record<string, string> = {
    critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', unknown: 'Unknown',
  }
  const label = labels[norm] ?? String(level)
  const cls = ['critical', 'high', 'medium', 'low'].includes(norm) ? norm : 'unknown'
  return (
    <span className={`pl-risk pl-risk--${cls}`}>
      <span className="pl-risk-bar" />
      {label}
    </span>
  )
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [project, setProject] = useState<Project | null>(null)
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [predicting, setPredicting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [predictionError, setPredictionError] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [recalculatedNotice, setRecalculatedNotice] = useState<{
    timestamp: Date
    latencyMs?: number | null
    modelVersion?: string
    riskScore: number
    delayDays: number | null
    riskCategory: string
  } | null>(null)

  // Filter out confusing entries (unavailable/missing features claiming to mitigate risk) and select top 3-5 drivers
  const displayDrivers = useMemo(() => {
    const rawDrivers = prediction?.top_delay_drivers || prediction?.top_drivers || []
    if (!rawDrivers.length) return []

    const valid = rawDrivers.filter((driver: any) => {
      if (!driver || !driver.feature) return false
      const val = driver.value
      if (val == null || val === 'Unavailable' || val === '' || (typeof val === 'number' && isNaN(val))) return false
      if (Math.abs(Number(driver.contribution || 0)) < 1e-4) return false

      // Remove confusing entries such as unavailable features being shown as mitigating risk
      const isMitigating = driver.direction === 'decreases_risk' || Number(driver.contribution) < 0
      if (isMitigating) {
        const numVal = Number(val)
        if (!isNaN(numVal)) {
          if (driver.feature.includes('compensation') && numVal < 50) return false
          if (driver.feature.includes('rehab') && numVal < 50) return false
          if (driver.feature.includes('possession') && numVal < 50) return false
        }
      }
      return true
    })

    // Sort by impact: risk-increasing factors first (highest contribution first), then genuine mitigators
    valid.sort((a: any, b: any) => {
      const aContrib = Number(a.contribution || 0)
      const bContrib = Number(b.contribution || 0)
      const aIsRisk = a.direction === 'increases_risk' || aContrib > 0
      const bIsRisk = b.direction === 'increases_risk' || bContrib > 0

      if (aIsRisk && !bIsRisk) return -1
      if (!aIsRisk && bIsRisk) return 1
      return Math.abs(bContrib) - Math.abs(aContrib)
    })

    return valid.slice(0, 5)
  }, [prediction])

  // Generate 2-4 clean, prioritized actions based directly on ML/SHAP drivers and critical bottleneck
  const actionPlanItems = useMemo(() => {
    const topRiskDrivers = displayDrivers.filter(
      (d) => d.direction === 'increases_risk' || Number(d.contribution) > 0
    )

    const items: Array<{
      priority: number
      dotColor: string
      action: string
      why: ReactNode
      owner: string
      target: string
      status: string
      statusBg: string
      statusColor: string
      statusBorder: string
    }> = []

    // Action 1: MUST address the strongest delay driver if one exists
    if (topRiskDrivers.length > 0) {
      const d1 = topRiskDrivers[0]
      const meta1 = getActionMeta(d1.feature)
      items.push({
        priority: 1,
        dotColor: '#ef4444',
        action: meta1.action,
        why: formatWhy(d1.feature, d1.value),
        owner: meta1.owner,
        target: '7 days',
        status: 'Action Required',
        statusBg: 'rgba(239, 68, 68, 0.08)',
        statusColor: '#ef4444',
        statusBorder: 'rgba(239, 68, 68, 0.25)',
      })
    }

    // Action 2: Addresses the second strongest delay driver
    if (topRiskDrivers.length > 1) {
      const d2 = topRiskDrivers[1]
      const meta2 = getActionMeta(d2.feature)
      items.push({
        priority: 2,
        dotColor: '#ef4444',
        action: meta2.action,
        why: formatWhy(d2.feature, d2.value),
        owner: meta2.owner,
        target: '14 days',
        status: 'Action Required',
        statusBg: 'rgba(239, 68, 68, 0.08)',
        statusColor: '#ef4444',
        statusBorder: 'rgba(239, 68, 68, 0.25)',
      })
    }

    // Action 3: Targets the Critical Bottleneck stage
    if (prediction?.critical_stage) {
      const bottleneckAct = getCriticalBottleneckAction(prediction.critical_stage)
      items.push({
        priority: items.length + 1,
        ...bottleneckAct,
      })
    }

    // Action 4: If we have a 3rd risk driver and items < 4
    if (topRiskDrivers.length > 2 && items.length < 4) {
      const d3 = topRiskDrivers[2]
      const meta3 = getActionMeta(d3.feature)
      items.push({
        priority: items.length + 1,
        dotColor: '#f59e0b',
        action: meta3.action,
        why: formatWhy(d3.feature, d3.value),
        owner: meta3.owner,
        target: '21 days',
        status: 'Scheduled',
        statusBg: 'rgba(245, 158, 11, 0.08)',
        statusColor: '#d97706',
        statusBorder: 'rgba(245, 158, 11, 0.25)',
      })
    }

    // Proactive fallback if no risk drivers exist (e.g. project with risk < 40 on track)
    if (items.length === 0) {
      items.push({
        priority: 1,
        dotColor: '#10b981',
        action: 'Maintain statutory milestone tracking & schedule audit',
        why: <span>All statutory milestones and clearances are progressing within planned schedule</span>,
        owner: 'Project Monitoring Unit (PMU)',
        target: '30 days',
        status: 'On Track',
        statusBg: 'rgba(16, 185, 129, 0.08)',
        statusColor: '#059669',
        statusBorder: 'rgba(16, 185, 129, 0.25)',
      })
      items.push({
        priority: 2,
        dotColor: '#10b981',
        action: 'Conduct periodic inter-agency coordination review',
        why: <span>Maintain active alignment between revenue department, survey teams, and executing agency</span>,
        owner: 'Nodal Project Officer',
        target: 'Quarterly',
        status: 'Scheduled',
        statusBg: 'rgba(16, 185, 129, 0.08)',
        statusColor: '#059669',
        statusBorder: 'rgba(16, 185, 129, 0.25)',
      })
    }

    // Ensure strictly between 2 and 4 actions
    return items.slice(0, 4)
  }, [displayDrivers, prediction])

  const canEdit =
    user &&
    [
      'SUPER_ADMIN',
      'CENTRAL_ADMIN',
      'STATE_ADMIN',
      'DISTRICT_OFFICER',
      'LA_OFFICER',
      'PROJECT_OFFICER',
      'PROJECT_AGENCY',
    ].includes(user.role)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([projectsAPI.get(id), predictionsAPI.get(id).catch(() => null)])
      .then(([projectResult, predictionResult]) => {
        setProject(projectResult)
        setPrediction(predictionResult)
      })
      .catch(() => setError('Project not found or access denied.'))
      .finally(() => setLoading(false))
  }, [id])

  const generate = async () => {
    if (!id) return
    setPredicting(true)
    setPredictionError(null)
    try {
      const newPrediction = await predictionsAPI.generate(id)
      setPrediction(newPrediction)

      // Refresh project to sync risk_level and status without altering any user data
      const updatedProject = await projectsAPI.get(id).catch(() => null)
      if (updatedProject) {
        setProject(updatedProject)
      }

      setRecalculatedNotice({
        timestamp: new Date(),
        latencyMs: newPrediction.latency_ms,
        modelVersion: newPrediction.model_version,
        riskScore: newPrediction.risk_score,
        delayDays: newPrediction.predicted_delay_days ?? newPrediction.estimated_delay_days ?? null,
        riskCategory: newPrediction.risk_category,
      })
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setPredictionError(
        typeof detail === 'string'
          ? detail
          : JSON.stringify(detail || 'Prediction could not be generated.')
      )
    } finally {
      setPredicting(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!id || !project) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await projectsAPI.delete(id)
      setShowDeleteModal(false)
      navigate('/projects', {
        replace: true,
        state: {
          deletedProjectCode: project.project_code,
          deletedProjectName: project.name,
        },
      })
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setDeleteError(
        typeof detail === 'string'
          ? detail
          : 'Failed to delete project. Please verify permissions and try again.'
      )
    } finally {
      setDeleting(false)
    }
  }

  if (loading)
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto', color: 'var(--color-accent-primary)' }} />
        <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-text-primary)' }}>Loading project details…</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
          Retrieving land parcels, statutory stages, and calibrated ML delay predictions
        </div>
      </div>
    )

  if (error || !project)
    return (
      <EmptyState
        icon={<AlertTriangle size={28} />}
        title="Project unavailable"
        description={error || 'Project record unavailable.'}
      />
    )

  const coords: [number, number] | null =
    project.latitude != null && project.longitude != null
      ? [Number(project.latitude), Number(project.longitude)]
      : null

  const compensationPct =
    project.estimated_compensation_inr && Number(project.estimated_compensation_inr) > 0
      ? Math.min(
        100,
        Math.round(
          (Number(project.disbursed_compensation_inr || 0) /
            Number(project.estimated_compensation_inr)) *
          100
        )
      )
      : null

  // Ensure effective physical land acquired is always realistic and accurate:
  // If explicitly in database, use area_acquired_ha. Otherwise, derive from compensation % or stage.
  const effectiveAreaAcquired =
    project.area_acquired_ha != null && Number(project.area_acquired_ha) > 0
      ? Number(project.area_acquired_ha)
      : project.total_area_ha && compensationPct
        ? Math.round(project.total_area_ha * (compensationPct / 100) * 10) / 10
        : (project.area_acquired_ha || 0)

  const landAcquiredPct =
    project.total_area_ha && project.total_area_ha > 0
      ? Math.min(100, Math.round(((effectiveAreaAcquired || 0) / project.total_area_ha) * 100))
      : 0

  const riskCategory = prediction?.risk_category || 'UNKNOWN'
  const riskColor =
    (riskCategory as string) === 'HIGH' || (riskCategory as string) === 'CRITICAL'
      ? '#ef4444'
      : (riskCategory as string) === 'MEDIUM'
        ? '#f59e0b'
        : '#10b981'

  const isHighRisk =
    (riskCategory as string) === 'HIGH' ||
    (riskCategory as string) === 'CRITICAL' ||
    Boolean(prediction?.high_risk_alert?.requires_immediate_attention) ||
    prediction?.high_risk_alert?.alert_level === 'HIGH' ||
    (prediction?.risk_score != null && prediction.risk_score >= 70)

  const delayProb = prediction ? Math.round(prediction.delay_probability * 100) : null
  const delayDays = prediction?.predicted_delay_days ?? prediction?.estimated_delay_days ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 60 }}>
      {/* 1. Sleek Navigation & Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          className="btn btn-ghost"
          onClick={() => navigate('/projects')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem' }}
        >
          <ArrowLeft size={16} /> Back to Projects
        </button>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {canEdit && (
            <>
              <Link
                className="btn btn-secondary"
                to={`/projects/${project.id}/edit`}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
              >
                <Edit3 size={14} /> Edit Project
              </Link>
              <button
                type="button"
                className="btn"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 12px',
                  borderRadius: 6,
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="Delete Project"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}

          <button
            className="btn btn-primary"
            disabled={predicting}
            onClick={generate}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} className={predicting ? 'animate-spin' : ''} />
            {predicting
              ? 'Running ML Model…'
              : prediction
                ? 'Recalculate Prediction'
                : 'Generate Delay Prediction'}
          </button>
        </div>
      </div>

      {/* Recalculation Live Status Banner */}
      {recalculatedNotice && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 8,
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#10b981',
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 800,
              }}
            >
              ✓
            </span>
            <span style={{ color: 'var(--color-text-primary)' }}>
              <strong>ML Delay Risk Recalculated:</strong> LightGBM model evaluated statutory parameters. Risk score: <strong style={{ color: riskColor }}>{recalculatedNotice.riskScore}/100</strong> ({recalculatedNotice.riskCategory})
              {recalculatedNotice.delayDays != null && (
                <> · Projected slippage: <strong>{Math.round(recalculatedNotice.delayDays)} days</strong></>
              )}.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            <span>
              {recalculatedNotice.latencyMs ? `${Math.round(recalculatedNotice.latencyMs)}ms · ` : ''}
              {recalculatedNotice.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              type="button"
              onClick={() => setRecalculatedNotice(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '1.1rem',
                lineHeight: 1,
              }}
              title="Dismiss notice"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 2. Structured Executive Project Hero Banner */}
      <div
        className="card"
        style={{
          padding: '24px 28px',
          borderRadius: 12,
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--color-bg-card, #ffffff)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          {/* Left: Code, Title, and Metadata Chips */}
          <div style={{ flex: '1 1 560px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                  letterSpacing: '0.02em',
                }}
              >
                {project.project_code}
              </span>

              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  padding: '3px 10px',
                  borderRadius: 6,
                  background: 'var(--color-bg-secondary, #f1f5f9)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {project.project_type.replace(/_/g, ' ')}
              </span>

              {project.acquisition_act && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: 'var(--color-bg-secondary, #f1f5f9)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {project.acquisition_act.replace(/_/g, ' ')}
                </span>
              )}
            </div>

            <h1
              style={{
                margin: '0 0 8px 0',
                fontSize: '1.2rem',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
              }}
            >
              {project.name}
            </h1>

            {/* Clean Metadata Strip with Subtle Icons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
                fontSize: '0.85rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={14} style={{ color: 'var(--color-accent-primary)' }} />
                <strong>{project.state_code}</strong>
                {project.district_codes && project.district_codes.length > 0 && (
                  <span>· {project.district_codes.join(', ')}</span>
                )}
              </span>

              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Building2 size={14} style={{ color: 'var(--color-accent-primary)' }} />
                <span>{project.executing_agency || project.nodal_agency || 'MoRTH / NHAI'}</span>
              </span>

              {project.planned_end_date && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Calendar size={14} style={{ color: 'var(--color-accent-primary)' }} />
                  <span>Target: {formatDate(project.planned_end_date)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Right: Status & Risk — compact text indicators */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
            <StatusIndicator status={project.status} />
            <RiskIndicator level={riskCategory as any} />
          </div>
        </div>
      </div>

      {/* 3. Compact High-Risk Escalation Banner (Only for high risk projects) */}
      {isHighRisk && prediction?.high_risk_alert && (
        <div
          className="card"
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(239, 68, 68, 0.07)',
            borderLeft: '4px solid #ef4444',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>
            <span>{prediction.high_risk_alert.alert_message}</span>
          </div>
        </div>
      )}

      {predictionError && (
        <div
          className="card"
          style={{
            borderColor: 'var(--color-risk-critical)',
            color: 'var(--color-risk-critical)',
            background: 'rgba(239, 68, 68, 0.05)',
            padding: '12px 16px',
          }}
        >
          {predictionError}
        </div>
      )}

      {/* 4. Compact KPI Strip — government portal style */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 1,
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 6,
          overflow: 'hidden',
          opacity: predicting ? 0.7 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        {/* KPI 1: Risk Score */}
        <div style={{ padding: '14px 18px', background: 'var(--color-bg-card)', borderRight: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Risk Score
            {prediction?.latency_ms != null && (
              <span style={{ fontWeight: 400, marginLeft: 6 }}>{Math.round(prediction.latency_ms)}ms</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: riskColor, fontFamily: 'var(--font-mono)' }}>
              {prediction ? prediction.risk_score : '—'}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>/100</span>
          </div>
          <div style={{ marginTop: 8, height: 4, background: 'var(--color-border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${prediction ? Math.min(100, Math.max(3, prediction.risk_score)) : 0}%`, background: riskColor, borderRadius: 2 }} />
          </div>
          {prediction?.predicted_at && (
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
              Updated {new Date(prediction.predicted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        {/* KPI 2: Probability of Delay */}
        <div style={{ padding: '14px 18px', background: 'var(--color-bg-card)', borderRight: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Probability of Delay
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: delayProb && delayProb >= 60 ? '#dc2626' : '#16a34a', fontFamily: 'var(--font-mono)' }}>
            {delayProb != null ? `${delayProb}%` : '—'}
          </div>
          <div style={{ marginTop: 8, height: 4, background: 'var(--color-border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${delayProb || 0}%`, background: delayProb && delayProb >= 60 ? '#dc2626' : '#16a34a', borderRadius: 2 }} />
          </div>
        </div>

        {/* KPI 3: Projected Slippage */}
        <div style={{ padding: '14px 18px', background: 'var(--color-bg-card)', borderRight: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Projected Slippage
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: delayDays && Number(delayDays) > 0 ? '#d97706' : 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
            {delayDays != null ? `${Math.round(Number(delayDays))} days` : '0 days'}
          </div>
          {(() => {
            const days = delayDays != null ? Math.round(Number(delayDays)) : 0
            const baseDate = project?.planned_end_date ? new Date(project.planned_end_date) : null
            if (!baseDate || isNaN(baseDate.getTime())) return null
            const estimatedDate = new Date(baseDate)
            estimatedDate.setDate(estimatedDate.getDate() + days)
            return (
              <div style={{ fontSize: '0.7rem', color: days > 0 ? '#d97706' : 'var(--color-text-muted)', marginTop: 5, fontWeight: 500 }}>
                Est. completion: {estimatedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            )
          })()}
        </div>

        {/* KPI 4: Critical Bottleneck */}
        <div style={{ padding: '14px 18px', background: 'var(--color-bg-card)' }}>
          <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Critical Bottleneck
          </div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.4, marginTop: 4 }}>
            {typeof prediction?.critical_stage === 'string'
              ? prediction.critical_stage
              : prediction?.critical_stage?.stage_name_display ||
              prediction?.current_stage?.replace(/_/g, ' ') ||
              'Award & Compensation'}
          </div>
        </div>
      </div>

      {/* 5. Tab Navigation — government portal style */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '2px solid var(--color-border-subtle)',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'overview', label: 'Project Overview' },
          { id: 'stages', label: 'Stage-wise Timeline' },
          { id: 'risk', label: 'Delay Factors' },
          { id: 'actions', label: 'Recommended Actions' },
        ].map((item) => {
          const isActive = tab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id as Tab)}
              style={{
                padding: '9px 16px',
                marginBottom: -2,
                fontSize: '0.82rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s, border-color 0.15s',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {/* 6. TAB 1: OVERVIEW — Structured Executive Layout */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 18 }}>
          {/* Left Column: Land & Financial Execution Progress */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Visual Progress Card */}
            <div className="card" style={{ padding: '22px 24px', borderRadius: 10 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Acquisition & Financial Progress
              </h3>

              {/* Progress 1: Land Acquired */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Physical Land Acquired
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-accent-primary)' }}>
                    {effectiveAreaAcquired != null && Number(effectiveAreaAcquired) > 0
                      ? `${Number(effectiveAreaAcquired).toLocaleString()} ha`
                      : project.area_acquired_ha != null
                        ? `${project.area_acquired_ha.toLocaleString()} ha`
                        : '0 ha'}
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>
                      {' '}
                      / {project.total_area_ha != null ? `${project.total_area_ha.toLocaleString()} ha` : '—'}
                    </span>
                    <strong style={{ marginLeft: 8, color: '#10b981' }}>({landAcquiredPct}%)</strong>
                  </span>
                </div>
                  <div style={{ height: 5, background: 'var(--color-bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${landAcquiredPct}%`,
                        background: '#16a34a',
                        borderRadius: 3,
                      }}
                    />
                </div>
              </div>

              {/* Progress 2: Compensation Disbursed */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Compensation Disbursed
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-accent-primary)' }}>
                    {project.disbursed_compensation_inr != null
                      ? formatINR(project.disbursed_compensation_inr)
                      : '₹0'}
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>
                      {' '}
                      / {project.estimated_compensation_inr != null ? formatINR(project.estimated_compensation_inr) : '—'}
                    </span>
                    {compensationPct != null && (
                      <strong style={{ marginLeft: 8, color: '#3b82f6' }}>({compensationPct}%)</strong>
                    )}
                  </span>
                </div>
                  <div style={{ height: 5, background: 'var(--color-bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${compensationPct || 0}%`,
                        background: '#2563eb',
                        borderRadius: 3,
                      }}
                    />
                </div>
              </div>
            </div>

            {/* Structured Project Parameters Grid (Clean tiles instead of clumsy list) */}
            <div className="card" style={{ padding: '22px 24px', borderRadius: 10 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Project Parameters
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                <StatTile
                  label="Affected Families (PAFs)"
                  value={project.total_affected_families != null ? `${project.total_affected_families.toLocaleString()} families` : 'None recorded'}
                  subtext={project.families_rehabilitated != null ? `${project.families_rehabilitated} rehabilitated` : undefined}
                />
                <StatTile
                  label="R&R Progress"
                  value={project.rehabilitation_progress_pct != null ? `${project.rehabilitation_progress_pct}%` : 'Not initiated'}
                  subtext="Resettlement execution"
                />
                <StatTile
                  label="Court Disputes"
                  value={project.legal_case_count ? `${project.legal_case_count} active litigation${project.legal_case_count > 1 ? 's' : ''}` : 'Zero active cases'}
                  subtext={project.legal_case_status ? `Status: ${project.legal_case_status}` : undefined}
                  highlightColor={project.legal_case_count && project.legal_case_count > 0 ? '#ef4444' : undefined}
                />
                <StatTile
                  label="Preliminary Notification (Sec 3A)"
                  value={project.notification_3a_date ? formatDate(project.notification_3a_date) : 'Pending issuance'}
                  subtext={project.notification_3d_date ? `3D Declared: ${formatDate(project.notification_3d_date)}` : undefined}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Geographic Location Map */}
          <div className="card" style={{ padding: '22px 24px', borderRadius: 10, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={16} color="var(--color-accent-primary)" /> Project Location
              </h3>
              {coords && (
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                  {coords[0].toFixed(4)}° N, {coords[1].toFixed(4)}° E
                </span>
              )}
            </div>

            {coords ? (
              <div style={{ height: 340, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border-subtle, #e2e8f0)' }}>
                <MapContainer center={coords} zoom={12} style={{ height: '100%', width: '100%' }}>
                  <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={coords} icon={markerIcon(riskCategory)}>
                    <Popup>{project.name}</Popup>
                  </Marker>
                </MapContainer>
              </div>
            ) : (
              <div
                style={{
                  height: 340,
                  borderRadius: 8,
                  border: '1px dashed var(--color-border-default, #cbd5e1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24,
                  textAlign: 'center',
                  background: 'var(--color-bg-secondary, #f8fafc)',
                }}
              >
                <MapPin size={32} color="var(--color-text-muted)" style={{ marginBottom: 10 }} />
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                  GPS Coordinates Not Specified
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4, maxWidth: 260 }}>
                  Parcels are tracked at district level ({project.district_codes?.join(', ') || project.state_code}). Add latitude and longitude via Edit Project.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. TAB 2: STAGE-WISE TIMELINE */}
      {tab === 'stages' && (
        <div className="card" style={{ padding: '24px 28px', borderRadius: 10 }}>
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              Acquisition Lifecycle Stages & Risk Breakdown
            </h3>
            <br></br>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
            {prediction?.stage_predictions?.map((stage) => {
              const isCurrent = stage.stage === prediction.current_stage
              const sColor =
                (stage.risk_category as string) === 'HIGH' || (stage.risk_category as string) === 'CRITICAL'
                  ? '#ef4444'
                  : (stage.risk_category as string) === 'MEDIUM'
                    ? '#f59e0b'
                    : '#10b981'

              return (
                <div
                  key={stage.stage}
                  style={{
                    padding: '12px 14px',
                    border: isCurrent
                      ? '1px solid var(--color-accent-primary)'
                      : '1px solid var(--color-border-subtle)',
                    borderLeft: isCurrent ? '3px solid var(--color-accent-primary)' : '3px solid transparent',
                    background: 'var(--color-bg-card)',
                    borderRadius: 4,
                  }}
                >
                  {isCurrent && (
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--color-accent-primary)', fontWeight: 700, letterSpacing: '0.07em', display: 'block', marginBottom: 4 }}>
                      ● Active
                    </span>
                  )}
                  <strong style={{ display: 'block', fontSize: '0.82rem', color: 'var(--color-text-primary)', marginBottom: 6, lineHeight: 1.3 }}>
                    {stage.stage.replace(/_/g, ' ')}
                  </strong>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: sColor, fontFamily: 'var(--font-mono)' }}>
                        {stage.risk_score}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>/100</span>
                    </div>
                    <RiskIndicator level={stage.risk_category as any} />
                  </div>
                </div>
              )
            }) || <p style={{ color: 'var(--color-text-muted)' }}>Stage predictions unavailable.</p>}
          </div>

          <br></br>

          {prediction?.stage_completion_estimates && prediction.stage_completion_estimates.length > 0 && (
            <div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Timeline
              </h3>
              <br></br>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary, #f1f5f9)', textAlign: 'left', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <th style={{ padding: '10px 14px' }}>Lifecycle Stage</th>
                      <th style={{ padding: '10px 14px' }}>Statutory Duration</th>
                      <th style={{ padding: '10px 14px' }}>Predicted Duration</th>
                      <th style={{ padding: '10px 14px' }}>Delay Risk</th>
                      <th style={{ padding: '10px 14px' }}>Target Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prediction.stage_completion_estimates.map((est) => (
                      <tr key={est.stage} style={{ borderBottom: '1px solid var(--color-border-subtle, #f1f5f9)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{est.stage_name_display}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)' }}>{est.baseline_days} days</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: est.estimated_duration_days > est.baseline_days ? '#f59e0b' : 'inherit' }}>
                          {est.estimated_duration_days} days
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <RiskIndicator level={est.risk_category} />
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)' }}>{est.expected_completion_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 8. TAB 3: WHY THIS PROJECT IS AT RISK (OFFICER-FRIENDLY EXPLAINABILITY) */}
      {tab === 'risk' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Delay Factors Card */}
          <div
            className="card"
            style={{
              padding: '20px 24px',
              borderRadius: 6,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: 'none',
            }}
          >
            {/* Header: Title & Subtitle */}
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Delay Factors
              </h2>
              <br></br>
            </div>

            {/* Risk Score & Main Reason Headline (Exact reference from image) */}
            <div
              style={{
                marginBottom: 22,
                paddingBottom: 16,
                borderBottom: '1px solid var(--color-border-subtle, #e2e8f0)',
              }}
            >
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                Risk Score:{' '}
                <span
                  style={{
                    color:
                      prediction && prediction.risk_score >= 70
                        ? '#ef4444'
                        : prediction && prediction.risk_score >= 40
                          ? '#f59e0b'
                          : '#10b981',
                  }}
                >
                  {prediction ? Math.round(prediction.risk_score) : '—'}
                </span>{' '}
                / 100
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                <strong style={{ color: 'var(--color-text-primary)' }}>Main reason: </strong>
                <span>{getMainReason(displayDrivers, prediction?.risk_score || 0)}</span>
              </div>
            </div>

            {/* Structured Table matching attached reference image */}
            {displayDrivers.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid var(--color-border-subtle, #e2e8f0)' }}>
                      <th style={{ padding: '12px 14px', fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-primary)', width: '26%' }}>
                        Risk Driver
                      </th>
                      <th style={{ padding: '12px 14px', fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-primary)', width: '20%' }}>
                        Current Situation
                      </th>
                      <th style={{ padding: '12px 14px', fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-primary)', width: '22%' }}>
                        Impact
                      </th>
                      <th style={{ padding: '12px 14px', fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-primary)', width: '32%' }}>
                        What it means
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayDrivers.map((driver, index) => {
                      const impact = getImpactMeta(driver, index)
                      const driverTitle = DRIVER_TITLE_MAP[driver.feature] || formatFeatureName(driver.feature)
                      const currentSituation = formatCurrentSituation(driver.feature, driver.value)
                      const meaning = getPlainLanguageMeaning(driver.feature, driver.value, driver.direction)

                      return (
                        <tr
                          key={driver.feature}
                          style={{
                            borderBottom: '1px solid var(--color-border-subtle, #f1f5f9)',
                          }}
                        >
                          {/* 1. Risk Driver */}
                          <td style={{ padding: '16px 14px', verticalAlign: 'middle' }}>
                            <strong style={{ fontSize: '0.92rem', color: 'var(--color-text-primary)', display: 'block' }}>
                              {driverTitle}
                            </strong>
                          </td>

                          {/* 2. Current Situation */}
                          <td style={{ padding: '16px 14px', verticalAlign: 'middle', fontSize: '0.88rem', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                            {currentSituation}
                          </td>

                          {/* 3. Impact */}
                          <td style={{ padding: '16px 14px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                style={{
                                  width: 11,
                                  height: 11,
                                  borderRadius: '50%',
                                  backgroundColor: impact.dotColor,
                                  display: 'inline-block',
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                {impact.label}
                              </span>
                            </div>
                          </td>

                          {/* 4. What it means */}
                          <td style={{ padding: '16px 14px', verticalAlign: 'middle', fontSize: '0.86rem', color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                            {meaning}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
                No critical delay drivers identified. Project schedule is on track.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 9. TAB 4: RECOMMENDED ACTIONS (OFFICER-FRIENDLY ACTION PLAN) */}
      {tab === 'actions' && (
        <div
          className="card"
          style={{
            padding: '20px 24px',
            borderRadius: 6,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: 'none',
          }}
        >
          {/* Header: Title & Subtitle */}
          <div style={{ marginBottom: 22 }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              Recommended Actions
            </h2>
            <br></br>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid var(--color-border-subtle, #e2e8f0)' }}>
                  <th style={{ padding: '12px 14px', fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-primary)', width: '10%' }}>
                    Priority
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-primary)', width: '28%' }}>
                    Action
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-primary)', width: '24%' }}>
                    Why
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-primary)', width: '20%' }}>
                    Owner
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-primary)', width: '9%' }}>
                    Target
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-primary)', width: '9%' }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {actionPlanItems.map((item) => (
                  <tr
                    key={item.priority}
                    style={{
                      borderBottom: '1px solid var(--color-border-subtle, #f1f5f9)',
                    }}
                  >
                    {/* Priority */}
                    <td style={{ padding: '16px 14px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: '50%',
                            backgroundColor: item.dotColor,
                            display: 'inline-block',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--color-text-primary)' }}>
                          {item.priority}
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '16px 14px', verticalAlign: 'middle' }}>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                        {item.action}
                      </strong>
                    </td>

                    {/* Why */}
                    <td style={{ padding: '16px 14px', verticalAlign: 'middle', fontSize: '0.88rem', color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                      {item.why}
                    </td>

                    {/* Owner */}
                    <td style={{ padding: '16px 14px', verticalAlign: 'middle', fontSize: '0.88rem', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                      {item.owner}
                    </td>

                    {/* Target */}
                    <td style={{ padding: '16px 14px', verticalAlign: 'middle', fontSize: '0.88rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                      {item.target}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '16px 14px', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          background: item.statusBg,
                          color: item.statusColor,
                          border: `1px solid ${item.statusBorder}`,
                        }}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  Are you sure you want to delete <strong style={{ color: 'var(--color-text-primary)' }}>{project.name}</strong> (
                  <code style={{ color: 'var(--color-accent-primary)' }}>{project.project_code}</code>)?
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

function StatTile({
  label,
  value,
  subtext,
  highlightColor,
}: {
  label: string
  value: string
  subtext?: string
  highlightColor?: string
}) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 8,
        background: 'var(--color-bg-secondary, #f8fafc)',
        border: '1px solid var(--color-border-subtle, #e2e8f0)',
      }}
    >
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: 4, color: highlightColor || 'var(--color-text-primary)' }}>
        {value}
      </div>
      {subtext && (
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{subtext}</div>
      )}
    </div>
  )
}

function markerIcon(level?: string) {
  const color =
    level === 'HIGH' || level === 'CRITICAL'
      ? '#ef4444'
      : level === 'MEDIUM'
        ? '#f59e0b'
        : '#10b981'
  return L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 8px rgba(0,0,0,0.5)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}
