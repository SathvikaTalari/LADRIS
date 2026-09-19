/**
 * LADRIS — Comprehensive Page Voice Descriptions
 *
 * Provides thorough, clear, and comprehensive voice descriptions for each main page
 * so that officials and users can understand everything about that particular page:
 * its core purpose, key sections and metrics, and how to use it effectively.
 * Spoken in clear, professional Indian English female voice.
 */

export const PAGE_VOICE_INSTRUCTIONS: Record<string, string> = {
  // 1. Dashboard
  '/dashboard':
    'Welcome to the LADRIS Executive Command Dashboard. This page gives officials and decision-makers a comprehensive overview of active linear infrastructure and highway projects across India. At the top, you can track verified project counts, corridors facing critical delay risk, active statutory alerts, and overall compensation disbursement progress. Below, the dashboard features state and district delay distributions, a priority intervention queue for critical projects, and quick-action links. Use this page to monitor national portfolio velocity and prioritize high-risk corridors that require urgent administrative intervention.',

  // 2. Projects Directory
  '/projects':
    'You are on the Land Acquisition Projects Directory. This central management hub lists all infrastructure corridors monitored by LADRIS across National Highways, state expressways, and economic corridors. You can quickly search projects by name or code, filter by state, district, implementing agency such as NHAI, current acquisition stage, and AI delay risk tier. Each project card displays vital metrics, including predicted delay days, total land area required, compensation disbursement progress, and open court disputes. Clicking on any project will open its detailed intelligence and risk breakdown view.',

  // 3. Project Details
  'project-details':
    'This is the Project Details and Deep-Dive view. It provides an exhaustive breakdown of the selected infrastructure corridor across its entire acquisition lifecycle—from Section 3A preliminary notification and 3D declaration, to compensation award, dispute resolution, and physical possession. On this page, you can review calibrated Machine Learning delay predictions, explainable SHAP risk drivers, compensation sanctioned versus disbursed, active litigation pendency, and real-time milestone progress. You will also find actionable AI recommendations and an intervention history log to help expedite project clearances.',

  // 4. Decision Intelligence & What-If Simulator
  '/decision-intelligence':
    'Welcome to Decision Intelligence and Policy Simulation. This strategic module helps administrative leaders understand why delays occur and evaluate the exact impact of corrective actions before deploying resources. In the Executive Overview, you can analyze systemic bottlenecks, dispute timelines, and statutory lapse cliffs. Using the interactive What-If Policy Simulator below, officials can test scenarios such as allocating special fast-track arbitration budgets or expanding field disbursement teams to calculate precisely how many months of project delay can be compressed.',
  '/intelligence':
    'Welcome to Decision Intelligence and Policy Simulation. This strategic module helps administrative leaders understand why delays occur and evaluate the exact impact of corrective actions before deploying resources. In the Executive Overview, you can analyze systemic bottlenecks, dispute timelines, and statutory lapse cliffs. Using the interactive What-If Policy Simulator below, officials can test scenarios such as allocating special fast-track arbitration budgets or expanding field disbursement teams to calculate precisely how many months of project delay can be compressed.',
  '/priority-intelligence':
    'This is the Priority Intelligence Watchlist. It automatically ranks infrastructure projects that require urgent intervention based on multidimensional risk criteria—including statutory lapse proximity, prolonged stage tenure, severe compensation bottlenecks, and critical court cases. Officials can review high-risk corridors, inspect their primary delay drivers, and immediately assign action items to resolve field bottlenecks.',

  // 5. Interactive Map (GIS)
  '/gis':
    'This is the GIS Geospatial Risk Map. It provides a spatial overview of linear infrastructure corridors across Indian states and districts using verified coordinates. Projects are color-coded by AI delay risk—red for critical risk, amber for high risk, yellow for medium risk, and green for on-track corridors. You can zoom into highway alignments, filter by state and risk level, click on corridor pins to view real-time stage progress, and identify geographic clusters where land acquisition encumbrances are heavily concentrated.',

  // 6. Analytics & Trends
  '/analytics':
    'You are viewing the District and State Analytics portal. This page delivers macro-level analytical intelligence on land acquisition velocity and delay trends across India. Key sections include historical delay trends across districts, agency-wise performance benchmarks, compensation outlay versus actual payment ratios, and average tenure spent in each statutory stage. Planners and policy researchers can utilize these trends to pinpoint systemic procedural delays, forecast future land acquisition timelines, and guide institutional policy reforms.',

  // 7. Alerts & Early Warnings
  '/alerts':
    'This is the Alerts and Early-Warning Command Center. It continuously audits project timelines against Indian statutory deadlines, such as the mandatory one-year Section 3D lapse rule under the National Highways Act. Alerts are classified by severity—Critical, High, and Medium—covering legal disputes, compensation bottlenecks, and stage overruns. On this page, officials can acknowledge active alerts, inspect automated email notification delivery statuses, view responsible officers, and initiate rapid mitigation measures to prevent legal lapses.',

  // 8. Data Sources & Pipelines
  '/data-sources':
    'This is the Official Data Sources and Ingestion Center. LADRIS integrates directly with verified public and government portals, including the Ministry of Road Transport and Highways BhoomiRashi gazette feed, the Data.gov.in national repository, and judicial court databases. On this page, administrators can inspect synchronization schedules, review API connector health, verify source organizations and licensing, and trigger manual or scheduled data refreshes to ensure all project intelligence is always up to date.',

  // 9. Data Quality & AI Reliability
  '/data-quality':
    'This is the Data Quality and AI Reliability monitor. It rigorously audits the integrity, completeness, and validity of all incoming project records across eighty-two statutory fields. The page displays data validation health scores, anomaly detection flags, and machine learning model confidence ratings. This comprehensive auditing ensures that all delay predictions, risk categories, and executive decisions are grounded in authenticated, high-quality data.',

  // 10. Admin & AI Settings
  '/admin':
    'This is the Administration and AI Settings panel. System administrators can manage user accounts, assign role-based permissions for Central, State, and District authorities, and configure alert thresholds. You can also monitor machine learning model health, review feature importance metrics, inspect audit logs, and customize automated email notification settings for high-risk project alerts.',

  // 11. Saarthi AI Copilot
  'saarthi':
    'This is Saarthi, your AI-powered conversational copilot for land acquisition. Saarthi is grounded in real-time project database metrics and Indian statutory laws, including the National Highways Act of 1956 and RFCTLARR 2013. You can ask Saarthi questions in natural speech or text to check project status, identify high-risk corridors, calculate statutory deadlines, or understand legal delay factors instantly.',

  // 12. LA Officer Workbench
  '/la-workbench':
    'This is the Competent Authority Land Acquisition Workbench. Designed specifically for CALA and district revenue officers, this dashboard streamlines field operations. Officers can track Section 3A, 3D, and 3G notifications, manage public objection hearings, verify land ownership parcels, and coordinate direct compensation payments into beneficiary bank accounts.',

  // 13. Implementing Agency Portal
  '/agency-portal':
    'This is the Implementing Agency Portal for executing bodies such as the National Highways Authority of India and state road corporations. It focuses on project execution milestones, tracking encumbrance-free Right-of-Way clearance, utility shifting, and physical possession handovers to ensure civil construction can proceed without site disputes.',
}

/**
 * Returns a proper, comprehensive description of the current page.
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

  // Default fallback
  return "Welcome to LADRIS, India's AI-Powered Land Acquisition Early-Warning and Decision Support Intelligence System. Use the top navigation bar and sidebar to explore infrastructure projects, delay predictions, GIS spatial maps, and decision support tools across national highway corridors."
}

/**
 * Backwards-compatible collector returning the comprehensive page description.
 */
export function collectPageContent(pathname?: string): string {
  return getPageVoiceInstruction(pathname)
}
