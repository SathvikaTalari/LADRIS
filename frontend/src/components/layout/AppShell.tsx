/**
 * LADRIS — AppShell Layout
 */
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'
import { SaarthiWidget } from '@/components/chatbot/SaarthiWidget'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Land Acquisition Overview',
  '/la-workbench': 'LA Officer Workbench',
  '/agency-portal': 'Implementing Agency Portal',
  '/priority-intelligence': 'Priority Intelligence',
  '/intelligence': 'Decision Intelligence',
  '/projects': 'Projects',
  '/gis': 'GIS Risk Map',
  '/analytics': 'Analytics',
  '/alerts': 'Alerts & Notifications',
  '/data-sources': 'Data Sources',
  '/data-quality': 'Data Quality',
  '/admin': 'Administration',
}


export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()

  const pageTitle = PAGE_TITLES[location.pathname] ??
    (location.pathname.startsWith('/projects/') ? 'Project Detail' : undefined)

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <TopNav sidebarCollapsed={sidebarCollapsed} pageTitle={pageTitle} />
      <motion.main
        animate={{
          marginLeft: sidebarCollapsed ? 68 : 252,
          width: sidebarCollapsed ? 'calc(100% - 68px)' : 'calc(100% - 252px)',
        }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
        style={{
          boxSizing: 'border-box',
          marginTop: 'calc(var(--topnav-height) + 14px)',
          minHeight: 'calc(100vh - var(--topnav-height) - 14px)',
          background: 'var(--color-bg-primary)',
          overflowX: 'hidden',
        }}
      >
        <div className="page-container">
          <Outlet />
        </div>
      </motion.main>
      <SaarthiWidget />
    </div>
  )
}
