/**
 * LADRIS — Clear & Easy-Language Page Voice Instructions
 *
 * Provides clear, friendly, and easy-to-understand voice descriptions
 * for each main page in LADRIS. Written in simple, non-technical English
 * so that any official, evaluator, or user can easily understand:
 *   1. What this page does
 *   2. What key information is shown
 *   3. How it helps them take quick, effective action
 *
 * Spoken in a smooth, clear Indian English female voice.
 */

export const PAGE_VOICE_INSTRUCTIONS: Record<string, string> = {
  // 1. Dashboard
  '/dashboard':
    'Welcome to the LADRIS Dashboard. This page gives you a quick and clear overview of all highway and road projects in India. Here, you can see total active projects, projects with high delay risk, important alerts, and compensation payments to landowners. You can also spot which states and districts have the biggest delays, so officers can take quick action where it is needed most.',

  // 2. Projects Directory
  '/projects':
    'This is the Projects Directory. Here, you can easily view and search all highway projects across different states and districts. You can filter projects by government agency, current work stage, or risk level. Each project card clearly shows how many days it might be delayed, the land required, and any open court cases. Simply click on any project to see its full details and smart recommendations.',

  // 3. Project Details (Deep-Dive)
  'project-details':
    'This is the Project Details page. It shows you the complete status of the selected highway project from start to finish. You can see how much land is acquired, compensation payments made to landowners, and predicted delay days. It also highlights the main reasons for delay, such as court disputes or pending approvals, and gives practical AI suggestions to speed up the work.',

  // 4. Decision Intelligence & What-If Simulator
  '/decision-intelligence':
    'Welcome to Decision Intelligence. This tool helps senior officers understand why delays happen and test solutions before making decisions. Using the simple What-If Simulator, you can see what happens if you add more field officers or resolve disputes faster. The system immediately calculates how many months of delay and cost you can save.',

  '/intelligence':
    'Welcome to Decision Intelligence. This tool helps senior officers understand why delays happen and test solutions before making decisions. Using the simple What-If Simulator, you can see what happens if you add more field officers or resolve disputes faster. The system immediately calculates how many months of delay and cost you can save.',

  // 5. Priority Watchlist
  '/priority-intelligence':
    'This is the Priority Watchlist. It automatically highlights the most urgent highway projects that need immediate attention. Projects are ranked by high delay risk, upcoming legal deadlines, and stalled compensation. Officers can quickly check the main issues and assign tasks to resolve them on priority.',

  // 6. Interactive Map (GIS)
  '/gis':
    'This is the Interactive Geospatial Map. It shows highway projects across India on an easy-to-read map. Each project is color-coded by risk level: red means critical risk, yellow means moderate risk, and green means on track. You can zoom in to your state or district, click on any route to see its live progress, and quickly find problem areas.',

  // 7. Analytics & Trends
  '/analytics':
    'This is the Analytics and Trends page. It helps you see the bigger picture of land acquisition across India. You can easily compare performance between different states, districts, and agencies. The clear charts show average time taken at each stage, common causes of delays, and compensation trends over time.',

  // 8. Alerts & Warnings
  '/alerts':
    'This is the Alerts and Early Warnings center. It constantly checks project deadlines to warn officers before delays become serious. Alerts are clearly marked as Critical, High, or Medium for legal disputes, pending payments, or overdue approvals. You can check email notifications sent to officers and take fast action to keep projects on track.',

  // 9. Official Data Sources
  '/data-sources':
    'This is the Official Data Sources page. LADRIS securely connects with official government portals, including BhoomiRashi, the national data portal, and court records. Here, you can verify when data was last updated, check connection status, and refresh project information with a single click.',

  // 10. Data Health & Quality
  '/data-quality':
    'This is the Data Health and Quality monitor. It automatically checks all project records for missing information or errors. A high health score means the project data is accurate and trustworthy. This ensures that all delay predictions and risk alerts are based on clean and reliable information.',

  // 11. Admin & AI Settings
  '/admin':
    'This is the Administration and AI Settings page. System administrators can manage user accounts, assign roles, and set alert rules. You can also configure automated email notifications for high-risk projects and review system activity logs to keep everything running smoothly.',

  // 12. Saarthi AI Copilot
  'saarthi':
    'This is Saarthi, your friendly AI assistant for land acquisition. You can ask Saarthi any question in simple words, either by speaking or typing. Saarthi can tell you project status, upcoming legal deadlines, reasons for delay, and helpful solutions based on official highway rules.',

  // 13. LA Officer Workbench
  '/la-workbench':
    'This is the Land Acquisition Officer Workbench. Specially designed for district revenue officers and competent authorities, this page makes daily field work simple. Officers can track land notifications, handle landowner objections, verify land titles, and oversee direct bank payments to beneficiaries.',

  // 14. Implementing Agency Portal
  '/agency-portal':
    'This is the Implementing Agency Portal for highway authorities and road corporations. It helps engineering teams track site handover, utility shifting, and right-of-way clearance, ensuring civil road construction can start on time without disputes.',
}

/**
 * Returns a clear, easy-language description of the current page.
 */
export function getPageVoiceInstruction(pathname?: string, isSaarthiOpen?: boolean): string {
  // If Saarthi chatbot window is open, describe Saarthi
  const saarthiActive =
    isSaarthiOpen ??
    (typeof document !== 'undefined' &&
      Boolean(
        document.getElementById('saarthi-chat-window') ||
        document.querySelector('[data-saarthi-open="true"]')
      ))

  if (saarthiActive) {
    return PAGE_VOICE_INSTRUCTIONS['saarthi']
  }

  const rawPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '/dashboard')
  const cleanPath = (rawPath || '').replace(/\/+$/, '') || '/dashboard'

  // Exact route match
  if (PAGE_VOICE_INSTRUCTIONS[cleanPath]) {
    return PAGE_VOICE_INSTRUCTIONS[cleanPath]
  }

  // Project Details match: /projects/:id (excluding /projects/new)
  if (cleanPath.startsWith('/projects/') && !cleanPath.endsWith('/new')) {
    return PAGE_VOICE_INSTRUCTIONS['project-details']
  }

  // Root fallback to Dashboard
  if (cleanPath === '' || cleanPath === '/') {
    return PAGE_VOICE_INSTRUCTIONS['/dashboard']
  }

  // Default friendly fallback
  return 'Welcome to LADRIS, your intelligent system for monitoring highway land acquisition. Use the top bar and left menu to explore projects, check delay predictions, view the interactive map, and access early warning alerts across India.'
}

/**
 * Backwards-compatible collector returning the easy-language page description.
 */
export function collectPageContent(pathname?: string): string {
  return getPageVoiceInstruction(pathname)
}
