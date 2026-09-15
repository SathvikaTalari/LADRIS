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
  ResourceScenarioRequest,
  ResourceScenarioResponse,
} from '@/types'

export const authAPI = {
  login: (data: LoginRequest) =>
    apiClient.post<TokenResponse>('/api/v1/auth/login', data).then((r) => r.data),

  register: (data: object) =>
    apiClient.post<User>('/api/v1/auth/register', data).then((r) => r.data),

  me: () =>
    apiClient.get<User>('/api/v1/auth/me').then((r) => r.data),
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
    apiClient.get<PredictionResult>(`/api/v1/predictions/${projectId}`).then((r) => r.data),

  stages: (projectId: string) =>
    apiClient.get<RiskFingerprint>(`/api/v1/predictions/${projectId}/stages`).then((r) => r.data),

  explanation: (projectId: string) =>
    apiClient.get<ExplanationResult>(`/api/v1/predictions/${projectId}/explanation`).then((r) => r.data),

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
}

export const monitoringAPI = {
  summary: () =>
    apiClient.get<Record<string, any>>('/api/v1/monitoring/summary').then((r) => r.data),

  dataGapReport: () =>
    apiClient.get<Record<string, any>>('/api/v1/monitoring/data-gap-report').then((r) => r.data),
}

export const dataSourcesAPI = {
  list: () =>
    apiClient.get<{ total: number; data_sources: DataSourceItem[] }>('/api/v1/data-sources/').then((r) => r.data),

  get: (id: string) =>
    apiClient.get<DataSourceItem>(`/api/v1/data-sources/${id}`).then((r) => r.data),
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
}

export const alertsAPI = {
  list: (params?: { project_id?: string; status?: string }) =>
    apiClient.get('/api/v1/alerts/', { params }).then((r) => r.data),

  update: (id: string, data: { status: string }) =>
    apiClient.patch(`/api/v1/alerts/${id}`, data).then((r) => r.data),
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

  resourceScenario: (data: ResourceScenarioRequest) =>
    apiClient.post<ResourceScenarioResponse>('/api/v1/intelligence/resource-scenario', data).then((r) => r.data),

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

