/**
 * LADRIS — Zustand Auth Store
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { authAPI } from '@/api/client'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
  clearError: () => void
}

export function getRoleDefaultPath(_role?: string): string {
  return '/dashboard'
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const tokens = await authAPI.login({ email, password })
          localStorage.setItem('access_token', tokens.access_token)
          localStorage.setItem('refresh_token', tokens.refresh_token)
          const user = await authAPI.me()
          set({ user, isAuthenticated: true, isLoading: false })
        } catch (err: unknown) {
          const axiosErr = err as {
            response?: { status?: number; data?: { detail?: string } }
            message?: string
          }
          let message = 'Login failed. Please check your credentials.'
          if (axiosErr?.response?.data?.detail) {
            message = axiosErr.response.data.detail
          } else if (axiosErr?.response?.status === 500) {
            message = 'Backend server error (500). Please check backend logs or database.'
          } else if (axiosErr?.message?.toLowerCase().includes('network') || !axiosErr?.response) {
            message = 'Cannot connect to backend server. Please verify the backend is running.'
          }
          set({ error: message, isLoading: false, isAuthenticated: false })
          throw err
        }
      },

      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, isAuthenticated: false, error: null })
      },

      fetchMe: async () => {
        const token = localStorage.getItem('access_token')
        if (!token) {
          set({ user: null, isAuthenticated: false, isLoading: false })
          return
        }
        try {
          set({ isLoading: true })
          const user = await authAPI.me()
          set({ user, isAuthenticated: true, isLoading: false })
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false })
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'ladris-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)

