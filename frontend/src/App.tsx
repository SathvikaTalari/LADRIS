/**
 * LADRIS — Main Router Assembly
 */
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

import { AppShell } from '@/components/layout/AppShell'
import Login from '@/pages/Login'
import Landing from '@/pages/Landing'
import SiteMap from '@/pages/SiteMap'
import Dashboard from '@/pages/Dashboard'
import ProjectList from '@/pages/Projects/ProjectList'
import ProjectDetail from '@/pages/Projects/ProjectDetail'
import ProjectForm from '@/pages/Projects/ProjectForm'
import GIS from '@/pages/GIS'
import Analytics from '@/pages/Analytics'
import Alerts from '@/pages/Alerts'
import Admin from '@/pages/Admin'
import DataSources from '@/pages/DataSources'
import DataQuality from '@/pages/DataQuality'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, fetchMe } = useAuthStore()
  const token = localStorage.getItem('access_token')

  useEffect(() => {
    if (token && !isAuthenticated) {
      fetchMe()
    }
  }, [token, isAuthenticated, fetchMe])

  if (!isAuthenticated && !token) {
    return <Navigate to="/landing" replace />
  }

  return <>{children}</>
}

import PriorityIntelligence from '@/pages/PriorityIntelligence'
import Intelligence from '@/pages/Intelligence'
import LAWorkbench from '@/pages/LAWorkbench'
import AgencyPortal from '@/pages/AgencyPortal'
import { useThemeStore } from '@/store/themeStore'

export default function App() {
  const { theme } = useThemeStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/sitemap" element={<SiteMap />} />

        {/* Protected Dashboard Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="la-workbench" element={<LAWorkbench />} />
          <Route path="agency-portal" element={<AgencyPortal />} />
          <Route path="priority-intelligence" element={<PriorityIntelligence />} />
          <Route path="intelligence" element={<Intelligence />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/new" element={<ProjectForm />} />
          <Route path="projects/:id/edit" element={<ProjectForm />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="gis" element={<GIS />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="data-sources" element={<DataSources />} />
          <Route path="data-quality" element={<DataQuality />} />
          <Route path="admin" element={<Admin />} />
        </Route>


        {/* Fallback */}
        <Route path="*" element={<Navigate to="/landing" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
