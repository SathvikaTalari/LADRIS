/**
 * LADRIS — Core TypeScript Types
 * These mirror the backend Pydantic schemas exactly.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'SUPER_ADMIN'
  | 'CENTRAL_ADMIN'
  | 'STATE_ADMIN'
  | 'DISTRICT_OFFICER'
  | 'LA_OFFICER'
  | 'PROJECT_OFFICER'
  | 'PROJECT_AGENCY'
  | 'POLICY_ANALYST'
  | 'ANALYST'
  | 'VIEWER'

export type ProjectStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'ACTIVE'
  | 'DELAYED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ON_HOLD'

export type ProjectType =
  | 'HIGHWAY'
  | 'RAILWAY'
  | 'METRO_RAIL'
  | 'AIRPORT'
  | 'PORT'
  | 'POWER_TRANSMISSION'
  | 'PIPELINE'
  | 'IRRIGATION'
  | 'URBAN_DEVELOPMENT'
  | 'INDUSTRIAL_CORRIDOR'
  | 'DEFENCE'
  | 'OTHER'

export type AcquisitionAct =
  | 'RFCTLARR_2013'
  | 'NH_ACT_1956'
  | 'RAILWAYS_ACT_1989'
  | 'ELECTRICITY_ACT_2003'
  | 'STATE_SPECIFIC'
  | 'OTHER'

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'

export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'

export type AlertType =
  | 'STAGE_DELAY'
  | 'RISK_ESCALATION'
  | 'LEGAL_CASE_FILED'
  | 'COMPENSATION_OVERDUE'
  | 'POSSESSION_BLOCKED'
  | 'APPROVAL_PENDING'
  | 'RR_MILESTONE_MISSED'
  | 'DATA_QUALITY'
  | 'SYSTEM'

export type DataStatus =
  | 'OFFICIAL_PUBLIC'
  | 'DERIVED'
  | 'SYNTHETIC'
  | 'PENDING_VERIFICATION'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  is_verified: boolean
  state_code: string | null
  district_code: string | null
  agency_name?: string | null
  assigned_project_ids?: string | null
  last_login_at: string | null
  created_at: string
}


export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name: string
  role?: UserRole
  state_code?: string
  district_code?: string
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  project_code: string
  name: string
  description: string | null
  project_type: ProjectType
  acquisition_act: AcquisitionAct
  status: ProjectStatus
  risk_level: RiskLevel
  state_code: string
  district_codes: string[]
  tehsil_names: string[] | null
  nodal_agency: string | null
  executing_agency: string | null
  total_area_ha: number | null
  area_acquired_ha: number | null
  area_in_possession_ha: number | null
  total_affected_families: number | null
  families_compensated: number | null
  families_rehabilitated: number | null
  planned_start_date: string | null
  planned_end_date: string | null
  actual_start_date: string | null
  actual_end_date: string | null
  estimated_compensation_inr: number | null
  disbursed_compensation_inr: number | null
  rehabilitation_progress_pct?: number | null
  notification_3a_date?: string | null
  notification_3d_date?: string | null
  milestone_data_status?: string | null
  legal_case_count?: number | null
  legal_case_status?: string | null
  delay_reason?: string | null
  delay_months?: number | null
  latitude?: number | null
  longitude?: number | null
  data_provenance_status?: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProjectListItem {
  id: string
  project_code: string
  name: string
  project_type: ProjectType
  status: ProjectStatus
  risk_level: RiskLevel
  state_code: string
  district_codes?: string[]
  nodal_agency?: string | null
  executing_agency?: string | null
  total_area_ha: number | null
  total_affected_families: number | null
  planned_end_date: string | null
  created_at: string
}

export interface ProjectCreate {
  project_code: string
  name: string
  description?: string
  project_type: ProjectType
  acquisition_act?: AcquisitionAct
  state_code: string
  district_codes?: string[]
  tehsil_names?: string[]
  nodal_agency?: string
  executing_agency?: string
  total_area_ha?: number
  area_acquired_ha?: number
  area_in_possession_ha?: number
  total_affected_families?: number
  families_compensated?: number
  families_rehabilitated?: number
  rehabilitation_progress_pct?: number
  planned_start_date?: string
  planned_end_date?: string
  estimated_compensation_inr?: number
  disbursed_compensation_inr?: number
  notification_3a_date?: string
  notification_3d_date?: string
  legal_case_count?: number
  legal_case_status?: string
  latitude?: number
  longitude?: number
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export interface Alert {
  id: string
  project_id: string | null
  project_name?: string | null
  alert_reason?: string | null
  explanation?: string | null
  alert_type: AlertType
  severity: AlertSeverity
  status: AlertStatus
  title: string
  message: string
  alert_metadata?: Record<string, any>
  // Email delivery
  email_sent?: boolean
  email_sent_at?: string | null
  email_recipient?: string | null
  // SMS delivery
  sms_sent?: boolean
  sms_sent_at?: string | null
  sms_recipient?: string | null
  triggered_at: string
  acknowledged_by?: string | null
  acknowledged_at: string | null
  resolved_at: string | null
  created_at?: string
}

export interface AlertSettings {
  email_notifications_enabled: boolean
  sms_notifications_enabled: boolean
  send_high_critical_only: boolean
  reminder_hours: number
  high_risk_alert_score?: number
  priority_action_score?: number
  minimum_data_completeness?: number
}

export interface NotificationLog {
  id: number
  alert_id?: string | null
  channel: 'email' | 'sms' | string
  recipient?: string | null
  status: 'SENT' | 'FAILED' | 'SIMULATED' | string
  sent_at: string
  error_msg?: string | null
}

export interface GlobalSearchResult {
  project_id: string
  project_name: string
  project_identifier: string
  state: string
  district: string
  agency: string
  match_type: string
  priority_score?: number
}

// ─── Data Sources ─────────────────────────────────────────────────────────────

export interface DataSource {
  id: string
  dataset_name: string
  description: string | null
  source_organization: string
  source_url: string | null
  retrieval_date: string | null
  data_period_start: string | null
  data_period_end: string | null
  data_status: DataStatus
  record_count: number | null
  file_format: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface APIResponse<T> {
  success: boolean
  message: string
  data: T | null
}

export interface HealthCheck {
  status: string
  version: string
  environment: string
  database: string
  timestamp: string
}

export interface AnalyticsOverview {
  status: string
  message: string
  summary: {
    total_projects: number
    high_risk_projects: number
    projects_requiring_attention: number
    average_delay_days: number | null
    total_area_ha: number | null
    total_affected_families: number | null
  }
  data_loaded: boolean
}

// ─── Phase 2/3 ML Predictions, Stage Risk & Data Quality ──────────────────────

export interface RiskFactor {
  factor_name: string
  factor_category: string
  importance_score: number
  direction: string
  feature_value?: number
  description?: string
  contributor_label?: string
}

// ─── Phase 3: Stage Risk ──────────────────────────────────────────────────────

export interface StageRisk {
  stage_id: string
  display_name?: string
  description?: string
  order?: number
  act_reference?: string
  eligible: boolean
  // v2: named delay_probability (semantic rename from risk)
  delay_probability?: number | null
  risk: number | null            // backward compat alias
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null
  primary_drivers?: string[]
  data_basis?: string
  data_coverage?: string
  feature_used?: string
  feature_value?: number | null
  data_completeness?: number
  reason?: string
}

export interface RiskFingerprint {
  project_id: string
  stages: StageRisk[]

  // v1 compat
  overall_fingerprint_risk: number | null
  overall_fingerprint_risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null
  peak_risk_stage: string | null
  peak_risk_value: number | null

  // v2: semantic rename + new fields
  overall_delay_probability?: number | null
  overall_risk_level?: string | null
  peak_risk_stage_name?: string | null
  stage_count?: number

  // v2: context signals
  has_legal_disputes?: boolean
  is_officially_delayed?: boolean
  state_risk_value?: number | null
  state_risk_level?: string | null

  // v2: transparency
  variables_used?: string[]
  data_coverage_summary?: Record<string, string>

  disclaimer: string
  output_type: string
  computed_at: string
  data_completeness_pct?: number
}

// ─── Phase 3: Dual-Signal Prediction ─────────────────────────────────────────

export interface AnomalyRiskSignal {
  score: number
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
  is_anomaly: boolean
  label: string
  description: string
}

export interface DelayRiskSignal {
  score: null
  risk_level: null
  prediction_available: false
  supervised_training_status: 'DEFERRED'
  reason: string
  label: string
  description: string
}

export interface SHAPContributor {
  factor: string
  raw_feature: string
  contribution: number
  direction: string
  feature_value: number
  feature_unit: string
  interpretation: string
  contributor_label: string
}

export interface SHAPExplanation {
  available: boolean
  anomaly_score: number
  model_output_type: string
  disclaimer: string
  causal_warning: string
  top_positive_contributors: SHAPContributor[]
  top_negative_contributors: SHAPContributor[]
  all_contributions: SHAPContributor[]
}

export interface OODResult {
  max_z_score: number | null
  mean_z_score: number | null
  ood_features: { feature: string; z_score: number }[]
  is_ood: boolean
}

export interface PredictionConfidenceDetail {
  data_completeness_pct: number
  out_of_distribution: OODResult
  confidence_note: string
  calibration_note: string
}

export interface PredictionResult {
  project_id: string
  prediction_status: 'AVAILABLE' | 'INSUFFICIENT_DATA' | 'ERROR' | 'PENDING'

  // Phase 3 dual-signal architecture
  anomaly_risk?: AnomalyRiskSignal
  delay_risk?: DelayRiskSignal

  // Core 12 ML Predictions
  estimated_delay_days?: number | null
  delay_range?: {
    lower_days: number | null
    upper_days: number | null
    range_text: string
  }
  stage_wise_risk?: Array<{
    stage: string
    delay_probability: number
    risk_score: number
    risk_category: 'HIGH' | 'MEDIUM' | 'LOW'
  }>
  stage_completion_estimates?: Array<{
    stage: string
    stage_name_display: string
    baseline_days: number
    estimated_duration_days: number
    delay_probability: number
    risk_score: number
    risk_category: 'HIGH' | 'MEDIUM' | 'LOW'
    expected_completion_date: string
  }>
  critical_stage?: {
    stage: string
    stage_name_display: string
    risk_score: number
    delay_probability: number
    reason: string
  }
  top_delay_drivers?: Array<{
    feature: string
    value: unknown
    contribution: number
    direction: string
    recommendation?: string | null
  }>
  risk_trend?: {
    trend: 'INCREASING' | 'DECREASING' | 'STABLE'
    delta: number
    previous_score?: number | null
  }
  recommended_action?: string | null
  high_risk_alert?: {
    requires_immediate_attention: boolean
    alert_level: 'HIGH' | 'MEDIUM' | 'LOW'
    alert_message: string
  }

  // Legacy compatibility (still returned for backward compat)
  overall_risk_score?: number
  delay_probability: number
  risk_score: number
  risk_category: 'HIGH' | 'MEDIUM' | 'LOW'
  predicted_delay_days: number | null
  prediction_interval: { p10: number | null; p90: number | null }
  stage_predictions: Array<{ stage: string; delay_probability: number; risk_score: number; risk_category: 'HIGH' | 'MEDIUM' | 'LOW' }>
  top_drivers: Array<{ feature: string; value: unknown; contribution: number; direction: string; recommendation?: string | null }>
  recommendations: string[]
  snapshot_date: string
  predicted_at: string
  latency_ms?: number | null
  is_stale: boolean
  unavailable_features: string[]
  current_stage: string
  risk_level?: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'

  model_version?: string
  model_type?: string
  dataset_version?: string
  prediction_timestamp?: string
  data_completeness_pct: number
  validation?: {
    is_valid: boolean
    error_count: number
    warning_count: number
    clamped_count: number
    errors: string[]
    warnings: string[]
    clamped: string[]
  }
  as_of_date?: string
  prediction_confidence?: PredictionConfidenceDetail
  authenticity_statement?: string
  data_provenance_reference?: {
    dataset_name: string
    source_organization: string
    source_url: string
    data_status: string
    training_records?: number
    dataset_version?: string
    training_date?: string
  }
  feature_contributions?: RiskFactor[]
  shap_explanation?: SHAPExplanation
  message?: string
  missing_fields?: string[]
  recommendation?: string
  supervised_training_status?: string
  supervised_training_reason?: string
}

export interface ExplanationResult {
  project_id: string
  model_version: string
  output_type: string
  disclaimer: string
  causal_warning?: string
  top_positive_contributors: SHAPContributor[]
  top_negative_contributors: SHAPContributor[]
  all_contributions: SHAPContributor[]
  anomaly_score?: number
}

export interface PredictionConfidence {
  project_id: string
  model_loaded: boolean
  model_version?: string
  dataset_version?: string
  data_completeness_pct: number
  missing_fields: string[]
  prediction_eligible: boolean
  confidence_assessment: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNAVAILABLE'
  confidence_note: string
  out_of_distribution: OODResult
  calibration_note: string
  supervised_training_status: string
  training_record_count?: number
}

export interface ModelInfo {
  model_name: string
  model_version: string
  model_type: string
  training_date: string | null
  dataset_version: string | null
  record_count_used: number | null
  evaluation_metrics: Record<string, any>
  feature_list: string[]
  authenticity_statement: string
  data_sources_used: string[]
  status: string
  supervised_training_status?: string
}

export interface ModelMetrics {
  model_version: string
  training_date?: string
  dataset_version?: string
  n_training_records?: number
  supervised_metrics: {
    available: false
    reason: string
    precision: null
    recall: null
    f1: null
    roc_auc: null
    pr_auc: null
    brier_score: null
  } | null
  anomaly_scorer_metrics?: {
    model_type: string
    n_training_records: number
    n_anomalies_detected: number
    anomaly_rate: number
    score_distribution: Record<string, number>
    metric_note: string
  }
  supervised_training_status: string
  supervised_training_reason: string
}

export interface DataSourceItem {
  id: string
  dataset_name: string
  description: string | null
  source_organization: string
  source_url: string | null
  retrieval_date: string | null
  data_period_start: string | null
  data_period_end: string | null
  data_status: DataStatus
  record_count: number | null
  file_format: string | null
  storage_path: string | null
  license: string | null
  fields_obtained: string[]
  authenticity_notes: string | null
  is_active: boolean
  created_at: string
}

export interface ProjectReadinessItem {
  id: string
  name: string
  project_code: string
  state_code: string
  project_type: string
  completeness_pct: number
  missing_critical_data: string
  ml_status: 'Ready' | 'Needs Data' | 'Not Ready'
}

export interface TechnicalFieldItem {
  field: string
  label: string
  null_rate: number
}

export interface GroupedCategoryItem {
  id: string
  name: string
  completeness_pct: number
  status: string
  description: string
  technical_fields: TechnicalFieldItem[]
}

export interface DataIssueItem {
  id: string
  title: string
  project_name: string
  project_code: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  description: string
  action: string
}

export interface DataQualityMetrics {
  summary: {
    overall_quality?: number
    prediction_ready?: number
    total_projects?: number
    avg_completeness?: number
    projects_needing_data?: number
    total_real_records: number
    valid_records: number
    invalid_records: number
    duplicate_records: number
    missing_value_rate: number
    source_coverage_count?: number
    prediction_eligible_records: number
    quality_issues_count?: number
    generated_at: string
    data_authenticity_statement?: string
  }
  projects_readiness?: ProjectReadinessItem[]
  grouped_categories?: GroupedCategoryItem[]
  data_issues?: DataIssueItem[]
  field_null_rates: Record<string, number>
  sources: {
    name: string
    records: number
    status: string
    quality?: string
  }[]
}

// ─── Phase 4: Intervention Intelligence Types ─────────────────────────────────

export interface InterventionScoreComponent {
  value: number
  weight: number
  weighted_contribution: number
  label: string
  description: string
}

export interface InterventionItem {
  intervention_id: string
  category: string
  stage: string
  display_name: string
  action_description: string
  urgency: number
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  evidence: string
  provenance: string
  non_causal_note: string
  priority_score: number
  priority_label: string
  priority_score_label: string
  score_components: Record<string, InterventionScoreComponent>
  stage_risk: number
  triggering_rules: string[]
  risk_drivers: string[]
  model_supported_contributors: SHAPContributor[]
  recommendation_type: string
  output_label: string
}

export interface InterventionListResponse {
  project_id: string
  status: 'AVAILABLE' | 'INSUFFICIENT_DATA' | 'ERROR'
  candidate_interventions: InterventionItem[]
  top_intervention: InterventionItem | null
  rules_fired: Array<{
    rule_id: string
    description: string
    stage: string
    risk_driver: string
    data_basis: string
    interventions_triggered: string[]
  }>
  total_rules_evaluated: number
  total_interventions_matched: number
  input_signals_summary: {
    anomaly_score: number | null
    overall_stage_risk: number
    stage_risks: Record<string, number | null>
    data_completeness_pct: number
  }
  methodology_note: string
  catalog_version: string
  data_completeness_pct: number
  generated_at: string
}

export interface SimulatableFieldSpec {
  field: string
  display_name: string
  description: string
  unit: string
  display_unit: string
  physical_min: number
  physical_max: number
  population_min?: number
  population_max?: number
  population_p25?: number
  population_p50?: number
  population_p75?: number
  population_p95?: number
  current_value: number | null
  data_source: string
  stage: string
  data_available: boolean
  simulatable: boolean
  not_simulatable_reason: string | null
}

export interface ScenarioResultDetail {
  status: 'AVAILABLE' | 'INVALID_INPUT' | 'ERROR'
  scenario_name: string
  scenario_method: string
  disclaimer: string
  validation_warnings: string[]
  changed_inputs: Array<{
    field: string
    display_name: string
    baseline_value: number | null
    scenario_value: number
    unit: string
    data_source: string
  }>
  baseline_signals: {
    overall_fingerprint_risk: number | null
    overall_fingerprint_risk_level: string | null
    peak_risk_stage: string | null
    peak_risk_value: number | null
    stage_risks: Record<string, number | null>
    anomaly_score: number | null
    feature_values: Record<string, any>
  } | null
  scenario_signals: {
    overall_fingerprint_risk: number | null
    overall_fingerprint_risk_level: string | null
    peak_risk_stage: string | null
    peak_risk_value: number | null
    stage_risks: Record<string, number | null>
    anomaly_score: number | null
    feature_values: Record<string, any>
  } | null
  delta: {
    overall_fingerprint_risk_delta: number | null
    anomaly_score_delta: number | null
    stage_risk_deltas: Record<string, number | null>
    interpretation: string
    disclaimer: string
  } | null
  computed_at: string
  model_version: string
}

export interface SimulateResponse {
  project_id: string
  scenario_result: ScenarioResultDetail
  eligible_fields: SimulatableFieldSpec[]
  audit_id: string | null
  scenario_estimate_notice: string
}

export interface CompareScenariosResponse {
  project_id: string
  status: string
  disclaimer: string
  scenario_method: string
  total_scenarios: number
  scenarios: ScenarioResultDetail[]
  comparison_table: Array<{
    scenario_name: string
    status: string
    changed_inputs: any[]
    baseline_overall_risk: number | null
    scenario_overall_risk: number | null
    overall_risk_delta: number | null
    baseline_anomaly_score: number | null
    scenario_anomaly_score: number | null
    stage_risk_deltas: Record<string, number | null>
  }>
  best_scenario: string | null
  best_scenario_note: string | null
  computed_at: string
  scenario_estimate_notice: string
}// ─── Phase 7: Decision Intelligence Types ─────────────────────────────────────

export type OutputType = 'A' | 'B' | 'C' | 'D' | 'E'
export type DNATier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type RiskTrendLabel = 'ESCALATING' | 'DE_ESCALATING' | 'STABLE' | 'INSUFFICIENT_DATA' | 'NO_DATA'
export type ConfidenceLevel = 'INSUFFICIENT' | 'LOW' | 'MEDIUM' | 'HIGH'
export type SimilarityTier = 'HIGH' | 'MODERATE' | 'LOW' | 'WEAK'
export type QueueTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type BottleneckType = 'NOTIFICATION' | 'COMPENSATION' | 'RR' | 'OBJECTION' | 'MIXED'

// ── Risk DNA ──────────────────────────────────────────────────────────────────

export interface DNADimensionBase {
  score: number
  weight: number
  output_type: OutputType
  output_type_label: string
  description: string
}

export interface AnomalyDimension extends DNADimensionBase {
  risk_level: string | null
  contribution: number
  available: boolean
}

export interface StageDimension extends DNADimensionBase {
  peak_stage: string | null
  peak_stage_value: number | null
  stage_details: Array<{
    stage_id: string
    risk: number | null
    risk_level: string | null
    data_basis: string
    data_completeness: number | null
    coverage: string
  }>
  contribution: number
  available: boolean
}

export interface CompletenessD extends DNADimensionBase {
  completeness_pct: number
  risk_contribution: number
}

export interface ShapD extends DNADimensionBase {
  top_driver_name: string | null
  top_driver_contribution: number
  contribution: number
  available: boolean
}

export interface ReliabilityD {
  score: number
  confidence_assessment: string
  is_out_of_distribution: boolean
  ood_details: Record<string, any>
  weight: number
  risk_contribution: number
  output_type: OutputType
  output_type_label: string
  description: string
}

export interface TemporalObservation {
  timestamp: string
  anomaly_score: number
  data_completeness_pct: number | null
  stage_fingerprint_risk: number | null
  model_version: string | null
  source: string
}

export interface TemporalInfo {
  observations_available: boolean
  observation_count: number
  observations: TemporalObservation[]
  risk_trend: number | null
  risk_trend_label: RiskTrendLabel
  temporal_disclaimer: string
  output_type: OutputType
  output_type_label: string
}

export interface RiskDNAResponse {
  project_id: string
  output_type: string
  output_label: string
  dna_composite_score: number
  dna_tier: DNATier
  disclaimer: string
  dimensions: {
    anomaly_signal: AnomalyDimension
    stage_fingerprint: StageDimension
    data_completeness: CompletenessD
    shap_driver_severity: ShapD
    reliability: ReliabilityD
  }
  temporal: TemporalInfo
  weights: Record<string, number>
  computed_at: string
  provenance: Record<string, string>
}

// ── Risk History ──────────────────────────────────────────────────────────────

export interface EscalationEvent {
  from_timestamp: string
  to_timestamp: string
  from_score: number
  to_score: number
  delta: number
  event_type: 'ESCALATION' | 'DE_ESCALATION'
}

export interface RiskHistoryResponse {
  project_id: string
  output_type: OutputType
  output_type_label: string
  temporal_data_available: boolean
  observation_count: number
  observations: TemporalObservation[]
  risk_trend: number | null
  risk_trend_label: RiskTrendLabel
  escalation_events: EscalationEvent[]
  deescalation_events: EscalationEvent[]
  first_observation_date: string | null
  last_observation_date: string | null
  score_statistics: {
    min: number
    max: number
    mean: number
    range: number
  } | null
  temporal_disclaimer: string
  trend_note: string | null
}

// ── Bottleneck Discovery ──────────────────────────────────────────────────────

export interface ConfidenceLevelObj {
  level: ConfidenceLevel
  label: string
  note: string
}

export interface BottleneckTypeEntry {
  bottleneck_type: BottleneckType
  label: string
  count: number
  percentage: number
  description: string
  typical_cause: string
  confidence: ConfidenceLevelObj
  sample_size: number
  data_limitation: string
}

export interface StateBottleneck {
  state_code: string
  n_projects: number
  available: boolean
  confidence: ConfidenceLevelObj
  dominant_bottleneck: BottleneckType | null
  bottleneck_label: string | null
  bottleneck_counts: Record<string, number> | null
  mean_stage_risks: Record<string, number> | null
  official_delay_evidence: {
    delayed_count: number
    total_monitored: number
    primary_reason: string | null
    source: string
    evidence_type: OutputType
    evidence_label: string
    evidence_limitation: string
  } | null
  reason: string | null
  data_limitation: string | null
}

export interface ClusterEntry {
  cluster_id: number
  cluster_size: number
  centroid_stage_risks: Record<string, number>
  peak_stage: string
  dominant_bottleneck: BottleneckType
  bottleneck_label: string
  states_in_cluster: string[]
  confidence: ConfidenceLevelObj
  data_limitation: string
}

export interface BottleneckResponse {
  output_type: OutputType
  output_type_label: string
  available: boolean
  n_projects_analyzed: number
  n_total_projects: number | null
  national_summary: {
    dominant_bottleneck: BottleneckTypeEntry | null
    mean_stage_risks: Record<string, {
      mean: number
      std: number
      min: number
      max: number
      coverage_type: string
    }>
    analysis_note: string
  } | null
  bottleneck_distribution: BottleneckTypeEntry[] | null
  state_bottlenecks: StateBottleneck[] | null
  cluster_analysis: {
    available: boolean
    algorithm: string | null
    n_clusters_selected: number | null
    n_samples: number | null
    feature_space: string | null
    clusters: ClusterEntry[] | null
    algorithm_note: string | null
    reason: string | null
  } | null
  data_provenance: Record<string, any> | null
  disclaimer: string
  computed_at: string
  reason: string | null
}

// ── Comparable Projects ───────────────────────────────────────────────────────

export interface FeatureSimilarity {
  feature: string
  label: string
  description: string
  target_value: number
  comparable_value: number
  closeness_score: number
  similarity_contribution: 'HIGH' | 'MEDIUM' | 'LOW'
  output_type: OutputType
}

export interface ComparableProject {
  rank: number
  project_id: string
  project_code: string | null
  project_name: string | null
  state_code: string | null
  executing_agency: string | null
  total_area_ha: number | null
  status: string | null
  risk_level: RiskLevel | null
  similarity_score: number
  similarity_tier: SimilarityTier
  similarity_explanation: FeatureSimilarity[]
  top_shared_features: string[]
  comparability_note: string
}

export interface ComparableProjectsResponse {
  project_id: string
  output_type: OutputType
  output_type_label: string
  available: boolean
  n_comparables_found: number
  n_projects_searched: number
  algorithm: string
  feature_space: string
  features_used: string[]
  comparable_projects: ComparableProject[]
  disclaimer: string
  methodology_note: string
  computed_at: string
  reason: string | null
}

// ── Priority Queue ────────────────────────────────────────────────────────────

export interface QueueEntry {
  rank: number
  project_id: string
  project_code: string | null
  project_name: string | null
  state_code: string | null
  executing_agency: string | null
  status: string | null
  composite_priority_score: number
  queue_tier: QueueTier
  score_breakdown: {
    base_priority_score: number
    bottleneck_modifier: number
    comparable_context_modifier: number
    phase4_components: Record<string, any> | null
  }
  risk_signals: {
    anomaly_score: number
    stage_fingerprint_risk: number
    peak_risk_stage: string | null
    effective_risk_severity: number
  }
  bottleneck_type: BottleneckType | null
  recommended_resource: { type: string; label: string } | null
  data_completeness_pct: number
  output_type: OutputType
  output_type_label: string
  scoring_note: string | null
}

export interface PriorityQueueResponse {
  output_type: OutputType
  output_type_label: string
  total_projects: number
  tier_summary: Record<string, number>
  active_filters: Record<string, string | null>
  queue: QueueEntry[]
  queue_disclaimer: string
  computed_at: string
}

// ── Resource Scenario ─────────────────────────────────────────────────────────

export interface ResourceScenarioRequest {
  capacity_constraints: Record<string, number>
  filter_state?: string | null
  filter_agency?: string | null
}

export interface ResourceScenarioResponse {
  output_type: 'E'
  output_type_label: string
  simulation_type: string
  disclaimer: string
  input_constraints: Record<string, number>
  total_projects: number
  assigned_count: number
  deferred_count: number
  remaining_capacity: Record<string, number>
  assigned_projects: (QueueEntry & { allocation_status: string; assigned_resource_type: string; assigned_resource_label: string; allocation_note: string })[]
  deferred_projects: (QueueEntry & { allocation_status: string; deferral_reason: string })[]
  simulation_note: string
  computed_at: string
  available: boolean
  reason: string | null
}
