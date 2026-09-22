/**
 * LADRIS — Axios API Client
 * Handles authentication headers, token refresh, and error normalization.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/authStore'

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `http://${window.location.hostname}:8000`
    }
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
}

const BASE_URL = getBaseUrl()

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// ─── Request Interceptor: Attach JWT ──────────────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── Response Interceptor: Handle 401 ────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('refresh_token')

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
            refresh_token: refreshToken,
          })
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${data.access_token}`
          }
          return apiClient(originalRequest)
        } catch {
          // Refresh failed — clear state and tokens, redirect to login
          useAuthStore.getState().logout()
          if (window.location.pathname !== '/login') {
            window.location.href = '/login'
          }
        }
      } else {
        useAuthStore.getState().logout()
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
    }

    return Promise.reject(error)
  }
)

// ─── Typed API Functions ──────────────────────────────────────────────────────
import type {
  LoginRequest,
  TokenResponse,
  User,
  Project,
  ProjectListItem,
  ProjectCreate,
  PaginatedResponse,
  AnalyticsOverview,
  HealthCheck,
  PredictionResult,
  ExplanationResult,
  RiskFingerprint,
  PredictionConfidence,
  ModelInfo,
  ModelMetrics,
  DataSourceItem,
  DataQualityMetrics,
  RiskDNAResponse,
  RiskHistoryResponse,
  BottleneckResponse,
  ComparableProjectsResponse,
  PriorityQueueResponse,
} from '@/types'

export const authAPI = {
  login: (data: LoginRequest) =>
    apiClient.post<TokenResponse>('/api/v1/auth/login', data).then((r) => r.data),

  register: (data: object) =>
    apiClient.post<User>('/api/v1/auth/register', data).then((r) => r.data),

  me: () =>
    apiClient.get<User>('/api/v1/auth/me').then((r) => r.data),
}

export const usersAPI = {
  list: () => apiClient.get<User[]>('/api/v1/auth/users').then((r) => r.data),
  create: (data: any) => apiClient.post<User>('/api/v1/auth/users', data).then((r) => r.data),
  update: (id: string, data: any) => apiClient.patch<User>(`/api/v1/auth/users/${id}`, data).then((r) => r.data),
}

export const projectsAPI = {
  list: (params?: {
    page?: number
    page_size?: number
    state_code?: string
    district?: string
    agency?: string
    status?: string
    risk_level?: string
    search?: string
  }) =>
    apiClient
      .get<PaginatedResponse<ProjectListItem>>('/api/v1/projects/', { params })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Project>(`/api/v1/projects/${id}`).then((r) => r.data),

  create: (data: ProjectCreate) =>
    apiClient.post<Project>('/api/v1/projects/', data).then((r) => r.data),

  update: (id: string, data: Partial<ProjectCreate>) =>
    apiClient.put<Project>(`/api/v1/projects/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/api/v1/projects/${id}`),
}

export const predictionsAPI = {
  get: (projectId: string) =>
    apiClient.get<PredictionResult>(`/api/ml/prediction/${projectId}`).then((r) => r.data),

  generate: (projectId: string, snapshotDate?: string) =>
    apiClient.post<PredictionResult>(`/api/ml/predict/${projectId}`, null, { params: snapshotDate ? { snapshot_date: snapshotDate } : undefined }).then((r) => r.data),

  stages: (projectId: string) =>
    apiClient.get<RiskFingerprint>(`/api/ml/stages/${projectId}`).then((r) => r.data),

  explanation: (projectId: string) =>
    apiClient.get<ExplanationResult>(`/api/ml/explanation/${projectId}`).then((r) => r.data),

  confidence: (projectId: string) =>
    apiClient.get<PredictionConfidence>(`/api/v1/predictions/${projectId}/confidence`).then((r) => r.data),
}

export const modelsAPI = {
  current: () =>
    apiClient.get<ModelInfo>('/api/v1/models/current').then((r) => r.data),

  metrics: () =>
    apiClient.get<ModelMetrics>('/api/v1/models/metrics').then((r) => r.data),

  features: () =>
    apiClient.get<Record<string, any>>('/api/v1/models/features').then((r) => r.data),

  monitoring: () =>
    apiClient.get<any>('/api/ml/monitoring').then((r) => r.data),

  retrainingStatus: () =>
    apiClient.get<any>('/api/ml/retraining-status').then((r) => r.data),

  trainingHistory: () =>
    apiClient.get<any>('/api/ml/training-history').then((r) => r.data),

  triggerRetraining: (force: boolean = false) =>
    apiClient.post<any>(`/api/ml/retrain?force=${force}`).then((r) => r.data),
}

export const auditAPI = {
  list: (params?: { action?: string; resource_type?: string; user_email?: string; limit?: number; offset?: number }) =>
    apiClient.get<{ status: string; total: number; limit: number; offset: number; items: any[] }>('/api/v1/audit/', { params }).then((r) => r.data),

  stats: () =>
    apiClient.get<{ status: string; total_audit_records: number; top_actions: any[]; top_resources: any[] }>('/api/v1/audit/stats').then((r) => r.data),
}

export const monitoringAPI = {
  summary: () =>
    apiClient.get<Record<string, any>>('/api/v1/monitoring/summary').then((r) => r.data),

  dataGapReport: () =>
    apiClient.get<Record<string, any>>('/api/v1/monitoring/data-gap-report').then((r) => r.data),
}

export interface DataSourceOverviewCard {
  id: string
  name: string
  status: 'Available' | 'Partial' | 'Missing'
  record_count: string
  last_updated: string
}

export interface ProjectCoverageCategory {
  id: string
  name: string
  status: 'Available' | 'Partial' | 'Missing'
  detail: string
}

export interface ProjectCoverageItem {
  id: string
  project_code: string
  name: string
  state_code: string
  district: string
  risk_level: string
  categories: ProjectCoverageCategory[]
}

export interface DataSourceOverviewResponse {
  overview_cards: DataSourceOverviewCard[]
  projects: ProjectCoverageItem[]
}

export const dataSourcesAPI = {
  list: () =>
    apiClient.get<{ total: number; data_sources: DataSourceItem[] }>('/api/v1/data-sources/').then((r) => r.data),

  get: (id: string) =>
    apiClient.get<DataSourceItem>(`/api/v1/data-sources/${id}`).then((r) => r.data),

  overview: () =>
    apiClient.get<DataSourceOverviewResponse>('/api/v1/data-sources/overview').then((r) => r.data),
}

export const dataQualityAPI = {
  get: () =>
    apiClient.get<DataQualityMetrics>('/api/v1/data-quality/').then((r) => r.data),
}

export const analyticsAPI = {
  overview: () =>
    apiClient.get<AnalyticsOverview>('/api/v1/analytics/overview').then((r) => r.data),
  executive: () =>
    apiClient.get<any>('/api/v1/analytics/executive').then((r) => r.data),
  districtSummary: () =>
    apiClient.get<any>('/api/v1/analytics/district-summary').then((r) => r.data),
  riskTrend: () =>
    apiClient.get<any>('/api/v1/analytics/risk-trend').then((r) => r.data),
}

export const alertsAPI = {
  list: (params?: { project_id?: string; status?: string }) =>
    apiClient.get('/api/v1/alerts/', { params }).then((r) => r.data),

  update: (id: string, data: { status: string }) =>
    apiClient.patch(`/api/v1/alerts/${id}`, data).then((r) => r.data),

  getSettings: () =>
    apiClient.get('/api/v1/alerts/settings').then((r) => r.data),

  updateSettings: (data: any) =>
    apiClient.post('/api/v1/alerts/settings', data).then((r) => r.data),
}

export const notificationLogsAPI = {
  list: (params?: { alert_id?: string; channel?: string; limit?: number }) =>
    apiClient.get('/api/v1/notification-logs/', { params }).then((r) => r.data),
}

export const searchAPI = {
  query: (q: string) =>
    apiClient.get('/api/v1/search/', { params: { q } }).then((r) => r.data),
}

export const reportsAPI = {
  projectsCsvUrl: () => `${BASE_URL}/api/v1/reports/projects.csv`,
}

export const interventionsAPI = {
  catalog: () =>
    apiClient.get('/api/v1/interventions/catalog').then((r) => r.data),

  get: (projectId: string) =>
    apiClient.get(`/api/v1/interventions/${projectId}`).then((r) => r.data),

  priority: (projectId: string) =>
    apiClient.get(`/api/v1/interventions/${projectId}/priority`).then((r) => r.data),

  evidence: (projectId: string) =>
    apiClient.get(`/api/v1/interventions/${projectId}/evidence`).then((r) => r.data),

  fields: (projectId: string) =>
    apiClient.get(`/api/v1/interventions/${projectId}/fields`).then((r) => r.data),

  simulate: (projectId: string, data: { scenario_name?: string; inputs: Record<string, number> }) =>
    apiClient.post(`/api/v1/interventions/${projectId}/simulate`, data).then((r) => r.data),

  compare: (projectId: string, data: { scenarios: Array<{ scenario_name: string; inputs: Record<string, number> }> }) =>
    apiClient.post(`/api/v1/interventions/${projectId}/compare`, data).then((r) => r.data),
}

export const intelligenceAPI = {
  riskDna: (projectId: string) =>
    apiClient.get<RiskDNAResponse>(`/api/v1/intelligence/risk-dna/${projectId}`).then((r) => r.data),

  riskHistory: (projectId: string) =>
    apiClient.get<RiskHistoryResponse>(`/api/v1/intelligence/risk-history/${projectId}`).then((r) => r.data),

  bottlenecks: (stateCode?: string) =>
    apiClient.get<BottleneckResponse>(stateCode ? `/api/v1/intelligence/bottlenecks/${stateCode}` : '/api/v1/intelligence/bottlenecks').then((r) => r.data),

  comparableProjects: (projectId: string, topK: number = 5) =>
    apiClient.get<ComparableProjectsResponse>(`/api/v1/intelligence/comparable-projects/${projectId}`, { params: { top_k: topK } }).then((r) => r.data),

  priorityQueue: (params?: { filter_state?: string; filter_agency?: string; filter_tier?: string }) =>
    apiClient.get<PriorityQueueResponse>('/api/v1/intelligence/priority-queue', { params }).then((r) => r.data),

  riskVelocity: (projectId: string, riskType: string = 'structural_anomaly') =>
    apiClient.get<any>(`/api/v1/intelligence/risk-velocity/${projectId}`, { params: { risk_type: riskType } }).then((r) => r.data),

  riskVelocitySummary: () =>
    apiClient.get<any>('/api/v1/intelligence/risk-velocity-summary').then((r) => r.data),

  gisHeatmap: () =>
    apiClient.get<any>('/api/v1/intelligence/gis-heatmap').then((r) => r.data),
}

export const healthAPI = {
  check: () =>
    apiClient.get<HealthCheck>('/health').then((r) => r.data),
}

export interface ChatActionItem {
  label: string
  path: string
}

export interface ChatResponse {
  reply: string
  actions: ChatActionItem[]
  suggestions: string[]
  timestamp: string
}

export const chatbotAPI = {
  chat: (data: { message: string; history?: Array<{ role: string; content: string }>; active_page?: string }) =>
    apiClient.post<ChatResponse>('/api/v1/chatbot/chat', data).then((r) => r.data),

  suggestions: (activePage?: string) =>
    apiClient.get<string[]>('/api/v1/chatbot/suggestions', { params: { active_page: activePage } }).then((r) => r.data),
}

// ─── Data Ingestion API ───────────────────────────────────────────────────────
export interface CSVPreviewData {
  file_id: string
  file_name: string
  total_rows: number
  columns: string[]
  sample_rows: Record<string, any>[]
  suggested_entity: string
  suggested_mappings: Record<string, string>
  available_target_fields: { field: string; label: string; required: string }[]
}

export interface CSVImportSummaryData {
  job_id: string
  total_rows: number
  imported_rows: number
  updated_rows: number
  duplicate_rows: number
  invalid_rows: number
  rejected_rows: number
  error_report_url?: string
  sample_errors: Array<{ row_index: number; project_code: string; reason: string }>
  ml_refreshed_count: number
  status: string
}

export interface ExternalImportedProject {
  project_id: string
  project_code: string
  project_name: string
  project_type?: string
  state_code?: string
  district?: string
  total_area_ha?: number
  risk_score?: number
  risk_category?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string
  delay_probability?: number
  predicted_delay_days?: number
  confidence_score?: number
  top_delay_drivers?: Array<{
    feature: string
    importance?: number
    shap_value?: number
    direction?: string
    recommendation?: string
  }>
}

export interface ExternalIngestionResult {
  job_id: string
  status: string
  total: number
  imported: number
  duplicates: number
  invalid: number
  errors: Array<{ row_index: number; project_code?: string; reason: string }>
  ml_refreshed_count: number
  projects: ExternalImportedProject[]
  message?: string
}

export interface GISIngestionData {
  job_id: string
  file_name: string
  project_id?: string
  project_code?: string
  project_name?: string
  total_features: number
  valid_features: number
  invalid_features: number
  geometry_types: string[]
  geojson_preview: any
  bounding_box?: number[]
  centroid?: { latitude: number; longitude: number }
  total_calculated_area_ha?: number
  ml_refreshed: boolean
  prediction?: {
    risk_score: number
    risk_category: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string
    delay_probability: number
    predicted_delay_days: number
    confidence_score: number
    top_delay_drivers?: Array<{
      feature: string
      importance?: number
      shap_value?: number
      direction?: string
      recommendation?: string
    }>
  }
  message: string
}

export interface SingleDocumentSummary {
  document_id: string
  file_name: string
  file_size_bytes: number
  document_type: string
  extracted_text_preview: string
  extracted_fields: Record<string, any>
  field_details?: Record<string, { value: any; confidence: number; source_snippet?: string }>
}

export interface MultiDocumentExtractData {
  documents: SingleDocumentSummary[]
  merged_fields: Record<string, any>
  field_sources: Record<string, string>
  primary_document_id: string
  document_ids: string[]
  suggested_project_id?: string
  review_status: string
  total_files: number
}

export interface DocumentConfirmResult {
  document_id?: string
  document_ids?: string[]
  project_id?: string
  project_code?: string
  status: string
  ml_refreshed: boolean
  message: string
  prediction?: {
    risk_score: number
    risk_category: string
    delay_probability: number
    predicted_delay_days: number
    top_drivers?: any[]
  }
}

export interface DocumentExtractData {
  document_id: string
  job_id?: string
  file_name: string
  file_size_bytes: number
  document_type: string
  extracted_text_preview: string
  extracted_fields: Record<string, any>
  field_details: Record<string, { value: any; confidence: number; source_snippet?: string }>
  suggested_project_id?: string
  review_status: string
}

export interface IngestionJobItem {
  id: string
  job_type: string
  source_name: string
  source_type: string
  source_file_name?: string
  status: string
  total_records: number
  valid_records: number
  invalid_records: number
  duplicate_records: number
  imported_records: number
  project_id?: string
  reporting_period?: string
  error_summary: any[]
  created_at: string
  completed_at?: string
}

export interface DatabaseTestResult {
  success: boolean
  table_name?: string
  columns: string[]
  sample_rows: Record<string, any>[]
  suggested_mapping?: Record<string, string>
  total_rows_approx?: number
  error?: string
}

export interface DatabaseImportedProject {
  project_id: string
  project_code: string
  project_name: string
  risk_score?: number
  risk_category?: string
  delay_probability?: number
  predicted_delay_days?: number
  top_delay_drivers?: Array<{
    feature: string
    value: any
    contribution: number
    direction: string
    recommendation?: string
  }>
}

export interface DatabaseImportResult {
  job_id: string
  status: string
  table_name: string
  total_records: number
  imported_count: number
  duplicates_count: number
  invalid_count: number
  ml_refreshed_count: number
  projects: DatabaseImportedProject[]
  message: string
}

export const ingestionAPI = {
  manual: (data: { entity_type: string; data: Record<string, any>; source_name?: string; reporting_period?: string }) =>
    apiClient.post('/api/v1/ingestion/manual', data).then((r) => r.data),

  previewSpreadsheet: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<CSVPreviewData>('/api/v1/ingestion/csv-excel/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  importSpreadsheet: (params: {
    file_id?: string
    file?: File
    column_mapping: Record<string, string>
    target_entity?: string
    source_name?: string
    reporting_period?: string
  }) => {
    const formData = new FormData()
    if (params.file) formData.append('file', params.file)
    if (params.file_id) formData.append('file_id', params.file_id)
    formData.append('column_mapping', JSON.stringify(params.column_mapping))
    formData.append('target_entity', params.target_entity || 'PROJECT')
    if (params.source_name) formData.append('source_name', params.source_name)
    if (params.reporting_period) formData.append('reporting_period', params.reporting_period)

    return apiClient.post<CSVImportSummaryData>('/api/v1/ingestion/csv-excel/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  externalBatch: (batch: any, apiKey?: string) =>
    apiClient.post<ExternalIngestionResult>('/api/v1/ingestion/external', batch, {
      headers: apiKey ? { 'X-API-Key': apiKey } : undefined,
    }).then((r) => r.data),

  uploadGIS: (
    file: File,
    optionsOrProjectId?:
      | string
      | {
          projectId?: string
          createProject?: boolean
          projectCode?: string
          projectName?: string
          projectType?: string
          stateCode?: string
          district?: string
        }
  ) => {
    const formData = new FormData()
    formData.append('file', file)
    if (typeof optionsOrProjectId === 'string') {
      formData.append('project_id', optionsOrProjectId)
    } else if (optionsOrProjectId) {
      if (optionsOrProjectId.projectId) formData.append('project_id', optionsOrProjectId.projectId)
      if (optionsOrProjectId.createProject !== undefined)
        formData.append('create_project', String(optionsOrProjectId.createProject))
      if (optionsOrProjectId.projectCode) formData.append('project_code', optionsOrProjectId.projectCode)
      if (optionsOrProjectId.projectName) formData.append('project_name', optionsOrProjectId.projectName)
      if (optionsOrProjectId.projectType) formData.append('project_type', optionsOrProjectId.projectType)
      if (optionsOrProjectId.stateCode) formData.append('state_code', optionsOrProjectId.stateCode)
      if (optionsOrProjectId.district) formData.append('district', optionsOrProjectId.district)
    }
    return apiClient.post<GISIngestionData>('/api/v1/ingestion/gis', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  extractDocument: (file: File, documentType: string = 'NOTIFICATION', projectId?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', documentType)
    if (projectId) formData.append('project_id', projectId)
    return apiClient.post<DocumentExtractData>('/api/v1/ingestion/document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  extractMultipleDocuments: (files: File[], documentType: string = 'AUTO_DETECT', projectId?: string) => {
    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))
    formData.append('document_type', documentType)
    if (projectId) formData.append('project_id', projectId)
    return apiClient.post<MultiDocumentExtractData>('/api/v1/ingestion/documents/multi-extract', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  confirmDocument: (data: {
    document_id?: string
    document_ids?: string[]
    confirmed_fields: Record<string, any>
    create_project?: boolean
    project_id?: string
  }) => apiClient.post<DocumentConfirmResult>('/api/v1/ingestion/document/confirm', data).then((r) => r.data),

  testDatabase: (data: { connection_url?: string; table_name: string; limit?: number }) =>
    apiClient.post<DatabaseTestResult>('/api/v1/ingestion/database/test', data).then((r) => r.data),

  importDatabase: (data: {
    connection_url?: string
    table_name: string
    target_entity?: string
    column_mapping?: Record<string, string>
    source_name?: string
    limit?: number
    project_id?: string
  }) => apiClient.post<DatabaseImportResult>('/api/v1/ingestion/database/import', data).then((r) => r.data),

  history: (params?: { limit?: number; job_type?: string }) =>
    apiClient.get<{ total: number; jobs: IngestionJobItem[] }>('/api/v1/ingestion/history', { params }).then((r) => r.data),

  errorReportUrl: (jobId: string) => `${BASE_URL}/api/v1/ingestion/jobs/${jobId}/errors.csv`,
}

// ─── Decision Intelligence Types & API ────────────────────────────────────────

export interface ProjectSummaryHeaderData {
  project_id: string
  project_name: string
  project_code: string
  state_code: string
  risk_score: number
  risk_level: string
  predicted_delay_days: number
  predicted_delay_months: number
  current_stage: string
  main_blocker: string
  action_needed: string
  model_version: string
  predicted_at: string
}

export interface ConflictNodeData {
  id: string
  label: string
  category: string
  status: 'CLEAR' | 'WARNING' | 'BLOCKED' | 'PENDING'
  detail?: string
  subtext?: string
}

export interface LandParcelDetailData {
  id?: string
  khasra_number?: string
  village?: string
  district?: string
  area_ha?: number
  owner_count?: number
  has_legal_dispute: boolean
  is_in_possession: boolean
  issue?: string
}

export interface LandBlockersData {
  title: string
  short_text: string
  has_data: boolean
  message?: string
  parcels_count: number
  disputed_parcels_count: number
  possession_pending_count: number
  blocked_stage?: string
  responsible_department?: string
  most_blocking_issue?: string | null
  risk_level?: string
  days_pending?: number
  affected_downstream_stage?: string | null
  nodes: ConflictNodeData[]
  parcel_items: LandParcelDetailData[]
}

export interface WhatIfSimulationRequestData {
  compensation_disbursement_pct?: number
  open_legal_dispute_count?: number
  rehabilitation_progress_pct?: number
  resettlement_site_ready?: boolean
  stakeholder_update_count_90d?: number
}

export interface WhatIfSimulationData {
  title: string
  short_text: string
  baseline_risk_score: number
  baseline_risk_level: string
  baseline_delay_days: number
  simulated_risk_score: number
  simulated_risk_level: string
  simulated_delay_days: number
  risk_score_reduction: number
  delay_reduction_days: number
  improved: boolean
  target_transition?: string
  minimum_practical_changes: string[]
  current_inputs: Record<string, any>
  simulated_inputs: Record<string, any>
  simulated_stage_risks?: Array<{ stage: string; delay_probability: number; risk_score: number; risk_category: string }>
  model_version: string
  simulated_at: string
}

export interface PaymentPossessionGapData {
  title: string
  short_text: string
  compensation_sanctioned_inr: number
  compensation_disbursed_inr: number
  payment_pct: number
  total_area_ha: number
  possessed_area_ha: number
  possession_pct: number
  gap_pct: number
  has_abnormal_gap?: boolean
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  likelihood_possession_delayed?: number
  status: 'Aligned' | 'Attention Needed' | 'Critical Disconnect' | 'Early Stage'
  status_level: 'success' | 'warning' | 'danger' | 'info'
  diagnostic: string
  action_needed: string
}

export interface WorkflowStageData {
  name: string
  step_number: number
  status: 'COMPLETED' | 'IN_PROGRESS' | 'BLOCKED' | 'PENDING'
  responsible_department: string
  days_taken_or_pending: number
  is_blocked_step: boolean
  details?: string
}

export interface ProcessBottlenecksData {
  title: string
  short_text: string
  blocked_at: string
  responsible_department: string
  days_pending: number
  next_stages_affected: number
  probability_downstream_delay?: number
  estimated_days_impact?: number
  later_stages_affected_list?: string[]
  stages: WorkflowStageData[]
  recommendation: string
}

export interface ProjectInterventionCreateData {
  intervention_type: string
  title: string
  description?: string
  action_taken_by?: string
  action_date?: string
  updated_compensation_pct?: number
  resolved_disputes_count?: number
  updated_rr_pct?: number
  resettlement_ready?: boolean
}

export interface ProjectInterventionData {
  id: string
  project_id: string
  intervention_type: string
  title: string
  description?: string
  action_taken_by?: string
  action_date: string
  risk_score_before: number
  risk_category_before: string
  predicted_delay_before?: number
  delay_days_before?: number
  risk_score_after: number
  risk_category_after: string
  predicted_delay_after?: number
  delay_days_after?: number
  risk_score_reduction: number
  delay_reduction_days: number
  status_improved: boolean
  improved?: boolean
  model_version: string
  prediction_timestamp: string
  created_at: string
}

export interface DecisionIntelligenceOverviewData {
  summary: ProjectSummaryHeaderData
  land_blockers: LandBlockersData
  what_if_baseline: WhatIfSimulationData
  payment_possession_gap: PaymentPossessionGapData
  process_bottlenecks: ProcessBottlenecksData
  recent_interventions: ProjectInterventionData[]
}

export const decisionIntelligenceAPI = {
  getOverview: (projectId: string) =>
    apiClient.get<DecisionIntelligenceOverviewData>(`/api/v1/decision-intelligence/${projectId}`).then((r) => r.data),

  getSummary: (projectId: string) =>
    apiClient.get<ProjectSummaryHeaderData>(`/api/v1/decision-intelligence/${projectId}/summary`).then((r) => r.data),

  getLandBlockers: (projectId: string) =>
    apiClient.get<LandBlockersData>(`/api/v1/decision-intelligence/${projectId}/land-blockers`).then((r) => r.data),

  simulate: (projectId: string, data: WhatIfSimulationRequestData) =>
    apiClient.post<WhatIfSimulationData>(`/api/v1/decision-intelligence/${projectId}/simulate`, data).then((r) => r.data),

  getPaymentPossessionGap: (projectId: string) =>
    apiClient.get<PaymentPossessionGapData>(`/api/v1/decision-intelligence/${projectId}/payment-possession-gap`).then((r) => r.data),

  getProcessBottlenecks: (projectId: string) =>
    apiClient.get<ProcessBottlenecksData>(`/api/v1/decision-intelligence/${projectId}/process-bottlenecks`).then((r) => r.data),

  recordIntervention: (projectId: string, data: ProjectInterventionCreateData) =>
    apiClient.post<ProjectInterventionData>(`/api/v1/decision-intelligence/${projectId}/interventions`, data).then((r) => r.data),

  getInterventions: (projectId: string) =>
    apiClient.get<ProjectInterventionData[]>(`/api/v1/decision-intelligence/${projectId}/interventions`).then((r) => r.data),

  deleteIntervention: (projectId: string, interventionId: string) =>
    apiClient.delete(`/api/v1/decision-intelligence/${projectId}/interventions/${interventionId}`),
}

export const gisAPI = {
  getProjects: () =>
    apiClient.get('/api/v1/gis/projects').then((r) => r.data),

  getDetailedProjects: (params?: {
    state?: string
    district?: string
    risk_level?: string
    issue_type?: string
  }) =>
    apiClient
      .get<{ total: number; projects: any[] }>('/api/v1/gis/detailed-projects', { params })
      .then((r) => r.data),

  getProjectGIS: async (projectId: string) => {
    try {
      const res = await apiClient.get(`/api/v1/gis/projects/${projectId}`)
      return res.data
    } catch {
      return {
        status: 'UNAVAILABLE',
        has_spatial_data: false,
        message: 'Detailed GIS data not available.',
        project_id: projectId,
        project: {
          id: projectId,
          project_code: 'UNKNOWN',
          name: 'Project',
          state_code: '',
          district: '',
          risk_level: 'MEDIUM',
          status: 'ACTIVE',
          total_area_ha: 0,
        },
        risk_summary: {
          total_parcels: 0,
          acquired_parcels: 0,
          pending_parcels: 0,
          disputed_parcels: 0,
          possession_pct: 0,
          compensation_disbursed_pct: 0,
        },
        summary: {
          total_parcels: 0,
          clear_count: 0,
          attention_count: 0,
          disputed_count: 0,
          hotspots_count: 0,
          total_area_ha: 0,
          villages_count: 0,
        },
        villages: [],
        parcels: {
          type: 'FeatureCollection',
          features: [],
        },
      }
    }
  },
}



