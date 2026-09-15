/**
 * LADRIS — Controlled DOM-based Page Content Collector (V2)
 *
 * Extracts meaningful, visible content from the authenticated page container
 * and organizes it into a natural accessibility-style sequence:
 *
 * 1. Page introduction
 * 2. Important summary/metric information
 * 3. Current filters or selections
 * 4. Important risks/status information
 * 5. Main available actions
 * 6. Relevant table/list information
 *
 * Dynamically reads live DOM data without hardcoding. Zero fake statistics.
 */

function isElementVisible(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false

  // Check element geometry
  if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.getClientRects().length === 0) {
    return false
  }

  // Check computed styles
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false
  }

  // Exclude elements marked hidden for accessibility
  if (el.closest('[aria-hidden="true"]')) {
    return false
  }

  return true
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
}

const ROUTE_INTRODUCTIONS: Record<string, string> = {
  '/dashboard':
    'Welcome to the Command Dashboard, providing a national overview of land acquisition velocity, delay risks, and project portfolios.',
  '/projects':
    'You are on the Land Acquisition Projects directory, where you can search, filter, and track infrastructure projects across states and agencies.',
  '/gis':
    'This is the GIS Command Map, displaying geospatial project alignments, district risk heatmaps, and spatial delay patterns.',
  '/analytics':
    'You are viewing the Analytics dashboard, providing delay risk modeling, compensation outlay analysis, and stage progression metrics.',
  '/alerts':
    'This is the Alerts and Early-Warning Command Center, monitoring real-time risk escalations, project delays, and system notifications.',
  '/intelligence':
    'Welcome to Decision Intelligence, delivering AI-driven delay root-cause analysis and proactive risk mitigation insights.',
  '/priority-intelligence':
    'You are on Priority Intelligence, highlighting high-impact projects that require urgent administrative review and intervention.',
  '/la-workbench':
    'This is the Land Acquisition Officer Workbench, designed for milestone tracking, field verification, and district workflow management.',
  '/agency-portal':
    'Welcome to the Implementing Agency Portal, allowing executing agencies to monitor assigned land acquisition packages and project progress.',
  '/data-sources':
    'You are on the Data Sources registry, managing official dataset integrations, sync schedules, and API connections.',
  '/data-quality':
    'This is the Data Quality and AI Reliability monitor, evaluating data completeness, validation health, and model confidence scores.',
  '/admin':
    'You are in the Administration panel, managing user accounts, access roles, district assignments, and system configurations.',
}

function getRouteIntroduction(): string | null {
  if (typeof window === 'undefined' || !window.location) return null
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
  return ROUTE_INTRODUCTIONS[pathname] || null
}

/**
 * Collects visible, meaningful page content from the current authenticated view.
 * If no content is found, returns the fallback string: "LADRIS voice guidance is ready."
 */
export function collectPageContent(): string {
  if (typeof document === 'undefined') {
    return 'LADRIS voice guidance is ready.'
  }

  // Target the authenticated page container inside main
  const root =
    document.querySelector('main .page-container') ||
    document.querySelector('main') ||
    document.querySelector('.page-container')

  if (!root || !isElementVisible(root)) {
    return 'LADRIS voice guidance is ready.'
  }

  const sections: string[] = []
  const seenTexts = new Set<string>()

  const addSnippet = (snippet: string) => {
    const cleaned = cleanText(snippet)
    if (!cleaned || cleaned.length < 2) return

    const normalized = cleaned.toLowerCase()
    if (seenTexts.has(normalized)) return
    seenTexts.add(normalized)
    sections.push(cleaned)
  }

  // ─── 1. PAGE INTRODUCTION ───────────────────────────────────────────────────
  const intro = getRouteIntroduction()
  const introParts: string[] = []

  if (intro) {
    introParts.push(intro)
  }

  const pageTitleEl = root.querySelector('.page-header-title, h1') || document.querySelector('header h1')
  const titleText = pageTitleEl && isElementVisible(pageTitleEl) ? cleanText(pageTitleEl.textContent || '') : ''

  const pageSubtitleEl = root.querySelector('.page-header-subtitle')
  const subtitleText = pageSubtitleEl && isElementVisible(pageSubtitleEl) ? cleanText(pageSubtitleEl.textContent || '') : ''

  if (!intro && titleText) {
    introParts.push(`You are viewing ${titleText}.`)
  }

  if (subtitleText) {
    const cleanedSub = subtitleText.endsWith('.') ? subtitleText : `${subtitleText}.`
    introParts.push(cleanedSub)
  }

  if (introParts.length > 0) {
    addSnippet(introParts.join(' '))
  }

  // ─── 2. IMPORTANT SUMMARY / METRIC INFORMATION ─────────────────────────────
  const metricSummaries: string[] = []
  const metricCards = root.querySelectorAll('.metric-card')
  metricCards.forEach((card) => {
    if (!isElementVisible(card)) return
    const labelEl = card.querySelector('.metric-label')
    const valueEl = card.querySelector('.metric-value')
    if (labelEl && valueEl) {
      const label = cleanText(labelEl.textContent || '')
      const val = cleanText(valueEl.textContent || '')
      if (label && val && val !== '—') {
        metricSummaries.push(`${label} at ${val}`)
      }
    }
  })

  // Extract key figures in cards if metric-cards are absent
  const cardFigures: string[] = []
  const cards = root.querySelectorAll('.card')
  cards.forEach((card) => {
    if (!isElementVisible(card) || card.querySelector('table')) return
    const strongPairs = card.querySelectorAll('div > span:first-child + strong')
    strongPairs.forEach((strong) => {
      const parent = strong.parentElement
      if (parent && isElementVisible(parent)) {
        const span = parent.querySelector('span')
        if (span) {
          const k = cleanText(span.textContent || '').replace(/:$/, '')
          const v = cleanText(strong.textContent || '')
          if (k && v && k.length < 40 && !metricSummaries.some((m) => m.includes(k))) {
            cardFigures.push(`${k} at ${v}`)
          }
        }
      }
    })
  })

  if (metricSummaries.length > 0) {
    addSnippet(`Key metrics show ${metricSummaries.slice(0, 6).join(', ')}.`)
  } else if (cardFigures.length > 0) {
    addSnippet(`Key summary figures include ${cardFigures.slice(0, 3).join(', ')}.`)
  }

  // ─── 3. CURRENT FILTERS OR SELECTIONS ──────────────────────────────────────
  const filters: string[] = []
  const selects = root.querySelectorAll('select')
  selects.forEach((select) => {
    if (!isElementVisible(select)) return
    const selectedOption = cleanText(select.options[select.selectedIndex]?.text || '')
    const label = cleanText(select.getAttribute('aria-label') || select.name || '')
    if (selectedOption && !selectedOption.toLowerCase().includes('select')) {
      filters.push(label ? `${label} set to ${selectedOption}` : selectedOption)
    }
  })

  const activeTabs = root.querySelectorAll('[role="tab"][aria-selected="true"], .btn-tab.active, [data-state="active"]')
  activeTabs.forEach((tab) => {
    if (!isElementVisible(tab)) return
    const tabText = cleanText(tab.textContent || '')
    if (tabText && tabText.length < 30) {
      filters.push(tabText)
    }
  })

  if (filters.length > 0) {
    addSnippet(`Current filters and selections are ${filters.slice(0, 4).join(', ')}.`)
  }

  // ─── 4. IMPORTANT RISKS / STATUS INFORMATION ───────────────────────────────
  const alertElements = root.querySelectorAll('[role="alert"], .badge-red, .badge-yellow, .risk-badge')
  const riskNotices: string[] = []
  alertElements.forEach((el) => {
    if (!isElementVisible(el)) return
    const parentItem = el.closest('[style*="border"], .card, div')
    const alertTitle = parentItem?.querySelector('[style*="ellipsis"], [style*="bold"], strong, h4')
    const badgeText = cleanText(el.textContent || '')

    if (alertTitle && isElementVisible(alertTitle) && parentItem !== el) {
      const titleStr = cleanText(alertTitle.textContent || '')
      if (titleStr && titleStr.length < 60 && !riskNotices.some((r) => r.includes(titleStr))) {
        riskNotices.push(`${badgeText}: ${titleStr}`)
        return
      }
    }

    if (badgeText && !seenTexts.has(badgeText.toLowerCase()) && riskNotices.length < 4) {
      riskNotices.push(badgeText)
    }
  })

  if (riskNotices.length > 0) {
    addSnippet(`Important risk notices highlight ${riskNotices.slice(0, 4).join(', ')}.`)
  }

  // ─── 5. MAIN AVAILABLE ACTIONS ─────────────────────────────────────────────
  const actionButtons: string[] = []
  const buttons = root.querySelectorAll(
    '.page-header button, .page-header .btn, button.btn-primary, button.btn-secondary, button:not([aria-hidden="true"])'
  )
  buttons.forEach((btn) => {
    if (!isElementVisible(btn)) return
    if (btn.closest('header') || btn.closest('.sidebar') || btn.closest('nav')) return
    const btnText = cleanText(btn.textContent || '')
    if (
      btnText &&
      btnText.length > 2 &&
      btnText.length < 30 &&
      !/^[\W_\d]+$/.test(btnText) &&
      !actionButtons.includes(btnText)
    ) {
      actionButtons.push(btnText)
    }
  })

  if (actionButtons.length > 0) {
    addSnippet(`Available actions include ${actionButtons.slice(0, 3).join(', ')}.`)
  }

  // ─── 6. RELEVANT TABLE / LIST INFORMATION ──────────────────────────────────
  const tables = root.querySelectorAll('table')
  tables.forEach((table) => {
    if (!isElementVisible(table)) return

    const ths = table.querySelectorAll('thead th')
    const colNames: string[] = []
    ths.forEach((th) => {
      if (isElementVisible(th)) {
        const text = cleanText(th.textContent || '')
        if (text && text.length < 30) colNames.push(text)
      }
    })

    if (colNames.length > 0) {
      addSnippet(`The table displays columns for ${colNames.slice(0, 5).join(', ')}.`)
    }

    const rows = table.querySelectorAll('tbody tr')
    const rowSummaries: string[] = []
    let rowCount = 0
    rows.forEach((row) => {
      if (rowCount >= 2 || !isElementVisible(row)) return
      const cells = row.querySelectorAll('td')
      const cellTexts: string[] = []
      cells.forEach((td) => {
        if (isElementVisible(td)) {
          const text = cleanText(td.textContent || '')
          if (text && text.length < 40) cellTexts.push(text)
        }
      })
      if (cellTexts.length > 0) {
        rowSummaries.push(cellTexts.slice(0, 4).join(', '))
        rowCount++
      }
    })

    if (rowSummaries.length > 0) {
      addSnippet(`Top records include: ${rowSummaries.join('; and ')}.`)
    }
  })

  // Fallback if no meaningful text collected
  if (sections.length === 0) {
    return 'LADRIS voice guidance is ready.'
  }

  // Limit narration length for very long pages (~200 words max)
  const fullNarration = sections.join(' ')
  const words = fullNarration.split(' ')
  if (words.length > 200) {
    return words.slice(0, 200).join(' ') + '... and additional details visible on page.'
  }

  return fullNarration
}
