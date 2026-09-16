/**
 * LADRIS — GIS Risk Map & Predictive Risk Heatmap
 * 
 * Layer 1: GIS Risk Map — Project markers with risk-based colors, rich popups,
 *          multi-filter panel (State, District, Agency, Stage, Risk Level)
 * Layer 2: Predictive Risk Heatmap — District-level intensity bubbles using
 *          multi-signal aggregation (Stage Risk, Compensation, Legal, Delay, Possession)
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers,
  Target,
  ExternalLink,
  ShieldCheck,
  MapPin,
  Search,
  Maximize2,
  Minimize2,
  Globe,
  Filter,
  Thermometer,
  X,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  BarChart3,
} from 'lucide-react'
import { PageHeader } from '@/components/common'
import { projectsAPI, intelligenceAPI } from '@/api/client'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Link } from 'react-router-dom'

// ─── State Centroids ─────────────────────────────────────────────────────────
const STATE_COORDINATES: Record<string, { coords: [number, number]; name: string; zoom: number }> = {
  UP: { coords: [26.8467, 80.9462], name: 'Uttar Pradesh', zoom: 7 },
  MH: { coords: [19.7515, 75.7139], name: 'Maharashtra', zoom: 7 },
  TN: { coords: [11.1271, 78.6569], name: 'Tamil Nadu', zoom: 7 },
  GJ: { coords: [22.2587, 71.1924], name: 'Gujarat', zoom: 7 },
  BR: { coords: [25.0961, 85.3131], name: 'Bihar', zoom: 7 },
  KA: { coords: [15.3173, 75.7139], name: 'Karnataka', zoom: 7 },
  RJ: { coords: [27.0238, 74.2179], name: 'Rajasthan', zoom: 7 },
  DL: { coords: [28.7041, 77.1025], name: 'Delhi NCR', zoom: 9 },
  WB: { coords: [22.9868, 87.8550], name: 'West Bengal', zoom: 7 },
  AP: { coords: [15.9129, 79.7400], name: 'Andhra Pradesh', zoom: 7 },
  TS: { coords: [18.1124, 79.0193], name: 'Telangana', zoom: 7 },
  TG: { coords: [18.1124, 79.0193], name: 'Telangana', zoom: 7 },
  MP: { coords: [22.9734, 78.6569], name: 'Madhya Pradesh', zoom: 7 },
  HR: { coords: [29.0588, 76.0856], name: 'Haryana', zoom: 8 },
  PB: { coords: [31.1471, 75.3412], name: 'Punjab', zoom: 8 },
  OD: { coords: [20.9517, 85.0985], name: 'Odisha', zoom: 7 },
  KL: { coords: [10.8505, 76.2711], name: 'Kerala', zoom: 7 },
  AS: { coords: [26.2006, 92.9376], name: 'Assam', zoom: 7 },
  JH: { coords: [23.6102, 85.2799], name: 'Jharkhand', zoom: 7 },
  UK: { coords: [30.0668, 79.0193], name: 'Uttarakhand', zoom: 8 },
  UT: { coords: [30.0668, 79.0193], name: 'Uttarakhand', zoom: 8 },
  HP: { coords: [31.1048, 77.1734], name: 'Himachal Pradesh', zoom: 8 },
  CT: { coords: [21.2787, 81.8661], name: 'Chhattisgarh', zoom: 7 },
  CG: { coords: [21.2787, 81.8661], name: 'Chhattisgarh', zoom: 7 },
  GA: { coords: [15.2993, 74.1240], name: 'Goa', zoom: 9 },
}

// ─── Map Tiles ────────────────────────────────────────────────────────────────
const MAP_TILES = {
  SATELLITE: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
  OSM: {
    name: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
}

// ─── Risk marker icon creator ─────────────────────────────────────────────────
function createRiskMarkerIcon(riskLevel: string) {
  let color = '#16a34a'
  let glowColor = 'rgba(22,163,74,0.4)'
  if (riskLevel === 'CRITICAL') { color = '#dc2626'; glowColor = 'rgba(220,38,38,0.5)' }
  else if (riskLevel === 'HIGH') { color = '#f97316'; glowColor = 'rgba(249,115,22,0.45)' }
  else if (riskLevel === 'MEDIUM') { color = '#eab308'; glowColor = 'rgba(234,179,8,0.45)' }

  const html = `
    <div style="position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
      <div style="position:absolute;width:30px;height:30px;border-radius:50%;background:${color};opacity:0.3;animation:ping 2.2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="width:16px;height:16px;border-radius:50%;background:${color};border:2.5px solid #ffffff;box-shadow:0 2px 8px ${glowColor},0 0 0 3px ${glowColor};"></div>
    </div>
  `
  return L.divIcon({ html, className: 'custom-risk-marker', iconSize: [30, 30], iconAnchor: [15, 15] })
}

// ─── Heatmap color by intensity ───────────────────────────────────────────────
function getHeatColor(intensity: number): string {
  if (intensity >= 75) return '#dc2626'
  if (intensity >= 55) return '#f97316'
  if (intensity >= 35) return '#eab308'
  return '#16a34a'
}

function getRiskLevelColor(level: string): string {
  if (level === 'CRITICAL') return '#dc2626'
  if (level === 'HIGH') return '#f97316'
  if (level === 'MEDIUM') return '#eab308'
  return '#16a34a'
}

// ─── Map View Controller ──────────────────────────────────────────────────────
function MapViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2, easeLinearity: 0.25 })
  }, [center, zoom, map])
  return null
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GIS() {
  const [projects, setProjects] = useState<any[]>([])
  const [heatmapData, setHeatmapData] = useState<any[]>([])
  const [isHeatmapLoading, setIsHeatmapLoading] = useState(false)

  // Map state
  const [tileKey, setTileKey] = useState<keyof typeof MAP_TILES>('SATELLITE')
  const [mapCenter, setMapCenter] = useState<[number, number]>([21.1458, 79.0882])
  const [mapZoom, setMapZoom] = useState(5)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // View mode: 'risk_map' | 'heatmap'
  const [viewMode, setViewMode] = useState<'risk_map' | 'heatmap'>('risk_map')

  // Layer toggles
  const [showMarkers, setShowMarkers] = useState(true)
  const [showHalos, setShowHalos] = useState(true)

  // Filters
  const [selectedState, setSelectedState] = useState('ALL')
  const [selectedRisk, setSelectedRisk] = useState('ALL')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedAgency, setSelectedAgency] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPanelOpen, setFilterPanelOpen] = useState(true)

  // Selected district for heatmap drilldown
  const [selectedHeatDistrict, setSelectedHeatDistrict] = useState<any>(null)

  // Load projects and heatmap together in ONE single initial network call
  useEffect(() => {
    let isMounted = true
    async function loadData() {
      try {
        setIsHeatmapLoading(true)
        const [projRes, heatRes] = await Promise.all([
          projectsAPI.list({ page_size: 100 }),
          intelligenceAPI.gisHeatmap().catch(() => ({ heatmap_points: [] })),
        ])

        if (!isMounted) return

        const items = projRes.items || []
        const mapped = items.map((p: any) => {
          const lat = p.latitude == null ? null : Number(p.latitude)
          const lng = p.longitude == null ? null : Number(p.longitude)
          return {
            ...p,
            lat,
            lng,
            risk_level: p.risk_level || 'UNKNOWN',
            priorityScore: p.priority_score ?? null,
            topBottleneck: p.top_bottleneck || p.delay_reason || 'Risk driver unavailable',
            stateLabel: p.state_code || 'Unknown',
          }
        }).filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng))

        setProjects(mapped)
        setHeatmapData(heatRes.heatmap_points || [])
      } catch (err) {
        console.error('GIS load error:', err)
      } finally {
        if (isMounted) setIsHeatmapLoading(false)
      }
    }
    loadData()
    return () => { isMounted = false }
  }, [])

  // Filtered projects
  const visibleProjects = useMemo(() => {
    return projects.filter(p => {
      if (selectedState !== 'ALL' && p.state_code !== selectedState) return false
      if (selectedRisk !== 'ALL' && p.risk_level !== selectedRisk) return false
      if (selectedStatus !== 'ALL' && p.status !== selectedStatus) return false
      if (selectedDistrict.trim()) {
        const distLower = selectedDistrict.toLowerCase()
        const distMatch = (p.district_codes || []).some((d: string) => d.toLowerCase().includes(distLower))
        if (!distMatch) return false
      }
      if (selectedAgency.trim()) {
        const agLower = selectedAgency.toLowerCase()
        if (
          !(p.executing_agency || '').toLowerCase().includes(agLower) &&
          !(p.nodal_agency || '').toLowerCase().includes(agLower)
        ) return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (!p.name.toLowerCase().includes(q) && !p.project_code.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [projects, selectedState, selectedRisk, selectedStatus, selectedDistrict, selectedAgency, searchQuery])

  // Summary stats
  const stats = useMemo(() => {
    const critical = visibleProjects.filter(p => p.risk_level === 'CRITICAL').length
    const high = visibleProjects.filter(p => p.risk_level === 'HIGH').length
    const medium = visibleProjects.filter(p => p.risk_level === 'MEDIUM').length
    const low = visibleProjects.filter(p => p.risk_level === 'LOW').length
    return { critical, high, medium, low, total: visibleProjects.length }
  }, [visibleProjects])

  // Unique filter options
  const statesInView = useMemo(() => {
    const seen = new Set<string>()
    projects.forEach(p => p.state_code && seen.add(p.state_code))
    return Array.from(seen).sort()
  }, [projects])

  const agenciesInView = useMemo(() => {
    const seen = new Set<string>()
    projects.forEach(p => {
      if (p.executing_agency) seen.add(p.executing_agency)
    })
    return Array.from(seen).sort().slice(0, 20)
  }, [projects])

  // Fly map to state
  const handleSelectState = useCallback((stateCode: string) => {
    setSelectedState(stateCode)
    if (stateCode === 'ALL') {
      setMapCenter([21.1458, 79.0882])
      setMapZoom(5)
    } else if (STATE_COORDINATES[stateCode]) {
      setMapCenter(STATE_COORDINATES[stateCode].coords)
      setMapZoom(STATE_COORDINATES[stateCode].zoom)
    }
  }, [])

  const handleReset = useCallback(() => {
    setSelectedState('ALL')
    setSelectedRisk('ALL')
    setSelectedStatus('ALL')
    setSelectedDistrict('')
    setSelectedAgency('')
    setSearchQuery('')
    setMapCenter([21.1458, 79.0882])
    setMapZoom(5)
    setSelectedHeatDistrict(null)
  }, [])

  const currentTile = MAP_TILES[tileKey]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ width: '100%' }}>
      <PageHeader
        title="Interactive Geographic Risk Map"
        subtitle="Visualize project locations, state-by-state delay hotspots, and district risk intensity across India"
      />

      {/* ── View Mode Toggle ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          display: 'flex',
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 4,
          gap: 4,
        }}>
          <button
            id="gis-view-risk-map"
            onClick={() => setViewMode('risk_map')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 18px', borderRadius: 'var(--radius-md)',
              border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
              background: viewMode === 'risk_map' ? 'var(--color-accent-primary)' : 'transparent',
              color: viewMode === 'risk_map' ? '#ffffff' : 'var(--color-text-muted)',
              transition: 'all 0.15s',
            }}
          >
            <MapPin size={14} /> Project Map View
          </button>
          <button
            id="gis-view-heatmap"
            onClick={() => setViewMode('heatmap')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 18px', borderRadius: 'var(--radius-md)',
              border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
              background: viewMode === 'heatmap' ? '#dc2626' : 'transparent',
              color: viewMode === 'heatmap' ? '#ffffff' : 'var(--color-text-muted)',
              transition: 'all 0.15s',
            }}
          >
            <Thermometer size={14} /> Delay Risk Heatmap
          </button>
        </div>
      </div>

      {/* ── Summary Stats Bar ─────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16,
      }}>
        {[
          { label: 'Total Projects', value: stats.total, color: 'var(--color-accent-primary)' },
          { label: '🔴 Critical Risk', value: stats.critical, color: '#dc2626' },
          { label: '🟠 High Risk', value: stats.high, color: '#f97316' },
          { label: '🟡 Medium Risk', value: stats.medium, color: '#eab308' },
          { label: '🟢 Low Risk', value: stats.low, color: '#16a34a' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Main Map + Sidebar ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isFullscreen ? '1fr' : '1fr 320px', gap: 16 }}>
        
        {/* Map Container */}
        <div className="card" style={{
          padding: 0, overflow: 'hidden',
          height: isFullscreen ? 'calc(100vh - 80px)' : 'calc(100vh - 260px)',
          minHeight: 680, position: 'relative',
        }}>
          {/* Floating Toolbar */}
          <div style={{
            position: 'absolute', top: 10, left: 52, right: 14, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, pointerEvents: 'none',
          }}>
            {/* Search */}
            <div style={{
              pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 10, padding: '6px 12px', boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
              backdropFilter: 'blur(8px)', width: 270,
            }}>
              <Search size={14} color="#64748b" />
              <input
                id="gis-search"
                type="text"
                placeholder="Search project name or code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.8rem', color: '#0f172a', width: '100%' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
              )}
            </div>

            {/* Controls */}
            <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Tile Switcher */}
              <div style={{
                display: 'flex', background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 10, padding: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.14)', gap: 2,
              }}>
                {(['SATELLITE', 'OSM'] as const).map(k => (
                  <button
                    key={k}
                    onClick={() => setTileKey(k)}
                    style={{
                      padding: '4px 14px', fontSize: '0.72rem', fontWeight: 700, borderRadius: 7,
                      border: 'none', cursor: 'pointer',
                      background: tileKey === k ? '#2563eb' : 'transparent',
                      color: tileKey === k ? '#fff' : '#475569', transition: 'all 0.13s',
                    }}
                  >
                    {k === 'SATELLITE' ? '🛰️ Satellite' : '🌐 Street'}
                  </button>
                ))}
              </div>

              <button onClick={handleReset} style={{
                height: 34, padding: '0 10px', background: 'rgba(255,255,255,0.97)',
                border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, fontSize: '0.75rem',
                fontWeight: 700, color: '#1e293b', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Globe size={13} color="#2563eb" /> Reset
              </button>

              <button onClick={() => setIsFullscreen(!isFullscreen)} style={{
                width: 34, height: 34, background: 'rgba(255,255,255,0.97)',
                border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              }}>
                {isFullscreen ? <Minimize2 size={14} color="#1e293b" /> : <Maximize2 size={14} color="#1e293b" />}
              </button>
            </div>
          </div>

          {/* Leaflet Map */}
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
          >
            <MapViewController center={mapCenter} zoom={mapZoom} />
            <TileLayer key={tileKey} attribution={currentTile.attribution} url={currentTile.url} />

            {/* ─── GIS Risk Map Mode ─── */}
            {viewMode === 'risk_map' && (
              <>
                {/* Risk Halo Circles */}
                {showHalos && visibleProjects.map(p => {
                  const colorMap: Record<string, string> = { CRITICAL: '#dc2626', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#16a34a' }
                  const radMap: Record<string, number> = { CRITICAL: 24, HIGH: 18, MEDIUM: 13, LOW: 9 }
                  const color = colorMap[p.risk_level] || '#16a34a'
                  return (
                    <CircleMarker
                      key={`halo-${p.id}`}
                      center={[p.lat, p.lng]}
                      radius={radMap[p.risk_level] || 9}
                      pathOptions={{ color, fillColor: color, fillOpacity: 0.13, weight: 1, opacity: 0.4 }}
                    />
                  )
                })}

                {/* Project Markers */}
                {showMarkers && visibleProjects.map(p => (
                  <Marker
                    key={`marker-${p.id}`}
                    position={[p.lat, p.lng]}
                    icon={createRiskMarkerIcon(p.risk_level)}
                  >
                    <Popup className="custom-leaflet-popup" maxWidth={300}>
                      <div style={{ padding: '4px 2px', color: '#0f172a', minWidth: 260 }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <code style={{
                            fontSize: '0.68rem', color: '#1d4ed8', fontWeight: 800,
                            background: '#eff6ff', padding: '2px 6px', borderRadius: 4, border: '1px solid #bfdbfe',
                          }}>
                            {p.project_code}
                          </code>
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                            background: p.risk_level === 'CRITICAL' ? '#fef2f2' : p.risk_level === 'HIGH' ? '#fff7ed' : p.risk_level === 'MEDIUM' ? '#fefce8' : '#f0fdf4',
                            color: getRiskLevelColor(p.risk_level),
                            border: `1px solid ${getRiskLevelColor(p.risk_level)}40`,
                          }}>
                            {p.risk_level}
                          </span>
                        </div>

                        {/* Name */}
                        <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: '0 0 8px', lineHeight: 1.3, color: '#0f172a' }}>
                          {p.name}
                        </h4>

                        {/* Details Grid */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>State / District:</span>
                            <strong style={{ color: '#0f172a', textAlign: 'right', maxWidth: 160 }}>
                              {p.stateLabel}{p.district_codes?.[0] ? ` · ${p.district_codes[0]}` : ''}
                            </strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Acq. Stage:</span>
                            <strong style={{ color: '#0f172a' }}>{p.status}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Agency:</span>
                            <strong style={{ color: '#0f172a', textAlign: 'right', maxWidth: 160 }}>{p.executing_agency || p.nodal_agency || 'N/A'}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#64748b' }}>Delay Risk Score:</span>
                            <strong style={{ color: getRiskLevelColor(p.risk_level), fontFamily: 'monospace', fontSize: '0.85rem' }}>
                              {p.priorityScore == null ? 'Unavailable' : `${p.priorityScore.toFixed(1)}/100`}
                            </strong>
                          </div>

                          {/* Score bar */}
                          <div style={{ width: '100%', height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${p.priorityScore}%`, background: getRiskLevelColor(p.risk_level), borderRadius: 3 }} />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ color: '#64748b' }}>Main Delay Factor:</span>
                            <strong style={{ color: '#dc2626', textAlign: 'right', maxWidth: 170, lineHeight: 1.3 }}>{p.topBottleneck}</strong>
                          </div>
                        </div>

                        <Link
                          to={`/projects/${p.id}`}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            width: '100%', marginTop: 10, padding: '7px 12px',
                            background: '#2563eb', color: '#fff', fontSize: '0.75rem',
                            fontWeight: 700, borderRadius: 8, textDecoration: 'none',
                            boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                          }}
                        >
                          View Project Details <ExternalLink size={12} />
                        </Link>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </>
            )}

            {/* ─── Predictive Risk Heatmap Mode ─── */}
            {viewMode === 'heatmap' && heatmapData.map((pt, i) => {
              const color = getHeatColor(pt.heat_intensity)
              const radius = 10 + (pt.heat_intensity / 100) * 28
              const opacity = 0.25 + (pt.heat_intensity / 100) * 0.45
              const stateName = STATE_COORDINATES[pt.state_code]?.name || pt.state_code

              return (
                <CircleMarker
                  key={`heat-${i}`}
                  center={[pt.lat, pt.lng]}
                  radius={radius}
                  pathOptions={{ color, fillColor: color, fillOpacity: opacity, weight: 2.5, opacity: 0.85 }}
                  eventHandlers={{
                    click: () => setSelectedHeatDistrict(pt),
                  }}
                >
                  <Tooltip permanent={false} direction="top" offset={[0, -10]}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, padding: '2px 4px' }}>
                      {pt.district}, {pt.state_code} · Risk Pressure: {pt.heat_intensity.toFixed(1)}/100 ({pt.dominant_risk_level})
                    </div>
                  </Tooltip>

                  <Popup maxWidth={360} className="gis-custom-popup">
                    <div style={{ minWidth: 260, maxWidth: 330, fontFamily: 'var(--font-sans)', color: '#0f172a', padding: '2px 0' }}>
                      {/* District & State Title */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', lineHeight: 1.2 }}>
                          {pt.district}, {stateName}
                        </div>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                          background: `${color}18`, color: color, border: `1px solid ${color}40`,
                          textTransform: 'uppercase', flexShrink: 0,
                        }}>
                          {pt.dominant_risk_level} RISK
                        </span>
                      </div>

                      {/* Acquisition Risk Pressure Gauge */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Acquisition Risk Pressure (ARP)</span>
                          <strong style={{ fontSize: '1rem', color: color, fontFamily: 'monospace' }}>
                            {pt.heat_intensity.toFixed(1)}/100
                          </strong>
                        </div>
                        <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, pt.heat_intensity)}%`, background: color, borderRadius: 3 }} />
                        </div>
                      </div>

                      {/* Signal Breakdown */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.74rem', borderTop: '1px solid #e2e8f0', paddingTop: 8, marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>Projects Mapped:</span>
                          <strong style={{ color: '#0f172a' }}>{pt.project_count || pt.top_projects?.length || 1}</strong>
                        </div>
                        {pt.predicted_delay_days != null && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Predicted Delay:</span>
                            <strong style={{ color: '#dc2626' }}>{Math.round(pt.predicted_delay_days)} days</strong>
                          </div>
                        )}
                        {pt.avg_comp_backlog_pct != null && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Compensation Backlog:</span>
                            <strong style={{ color: pt.avg_comp_backlog_pct > 20 ? '#dc2626' : '#16a34a' }}>
                              {pt.avg_comp_backlog_pct.toFixed(1)}%
                            </strong>
                          </div>
                        )}
                        {pt.current_stage && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Current Stage:</span>
                            <strong style={{ color: '#0f172a', textTransform: 'capitalize' }}>
                              {String(pt.current_stage).replace(/_/g, ' ')}
                            </strong>
                          </div>
                        )}
                      </div>

                      {/* Detected Risk Issues */}
                      {pt.issues && pt.issues.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                            Key Delay Drivers:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {pt.issues.map((issue: string, idx: number) => (
                              <span key={idx} style={{
                                fontSize: '0.65rem', background: '#fee2e2', color: '#991b1b',
                                padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                              }}>
                                ⚠️ {issue}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Project Link(s) */}
                      {pt.top_projects && pt.top_projects.map((proj: any) => (
                        <Link
                          key={proj.id}
                          to={`/projects/${proj.id}`}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', padding: '7px 10px', marginTop: 4,
                            background: '#2563eb', color: '#fff', fontSize: '0.75rem',
                            fontWeight: 700, borderRadius: 6, textDecoration: 'none',
                            boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>
                            {proj.name}
                          </span>
                          <ExternalLink size={12} style={{ flexShrink: 0, marginLeft: 6 }} />
                        </Link>
                      ))}
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>

          {/* Status Footer */}
          <div style={{
            position: 'absolute', bottom: 14, left: 14, zIndex: 1000,
            background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(0,0,0,0.1)',
            backdropFilter: 'blur(8px)', borderRadius: 10, padding: '8px 14px',
            fontSize: '0.72rem', color: '#334155', maxWidth: 380, boxShadow: '0 4px 18px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShieldCheck size={14} color="#2563eb" />
              {viewMode === 'risk_map' ? `${visibleProjects.length} Projects Mapped` : `${heatmapData.length} Districts — Acquisition Risk Pressure Active`}
            </div>
            {viewMode === 'risk_map'
              ? 'Click a marker to see project details and risk scores.'
              : 'Click a circle to see district risk details.'}
          </div>

          {/* Loading overlay for heatmap */}
          {isHeatmapLoading && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 2000,
              background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ textAlign: 'center' }}>
                <Thermometer size={32} color="#dc2626" style={{ marginBottom: 8 }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Loading risk heatmap...</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Calculating district risk scores</div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Sidebar ──────────────────────────────────────────────────── */}
        {!isFullscreen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* District Drilldown (Heatmap Mode) */}
            <AnimatePresence>
              {viewMode === 'heatmap' && selectedHeatDistrict && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="card"
                  style={{ border: `1px solid ${getHeatColor(selectedHeatDistrict.heat_intensity)}50`, background: `${getHeatColor(selectedHeatDistrict.heat_intensity)}08` }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <h4 style={{ fontSize: '0.82rem', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Thermometer size={14} color={getHeatColor(selectedHeatDistrict.heat_intensity)} />
                      {selectedHeatDistrict.district}
                    </h4>
                    <button onClick={() => setSelectedHeatDistrict(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                      <X size={14} />
                    </button>
                  </div>

                  {/* Acquisition Risk Pressure Bar */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Acquisition Risk Pressure</span>
                      <strong style={{ fontSize: '1.1rem', fontFamily: 'var(--font-mono)', color: getHeatColor(selectedHeatDistrict.heat_intensity) }}>
                        {selectedHeatDistrict.heat_intensity}
                      </strong>
                    </div>
                    <div style={{ height: 6, background: 'var(--color-bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${selectedHeatDistrict.heat_intensity}%`,
                        background: `linear-gradient(90deg, #16a34a, #eab308, #f97316, #dc2626)`,
                        borderRadius: 3, transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>

                  {/* Signal Breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.72rem', marginBottom: 12 }}>
                    {[
                      { label: 'Risk Level Score', value: selectedHeatDistrict.avg_risk_score ?? selectedHeatDistrict.heat_intensity ?? 0, max: 100 },
                      { label: 'Compensation Backlog', value: selectedHeatDistrict.avg_comp_backlog_pct ?? 0, max: 100 },
                      { label: 'Legal Disputes Risk', value: selectedHeatDistrict.avg_legal_score ?? 0, max: 100 },
                      { label: 'Delay Severity', value: selectedHeatDistrict.avg_delay_score ?? 0, max: 100 },
                      { label: 'Possession Gap', value: selectedHeatDistrict.avg_possession_gap ?? 0, max: 100 },
                    ].map(signal => {
                      const val = typeof signal.value === 'number' ? signal.value : 0
                      return (
                        <div key={signal.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>{signal.label}</span>
                            <span style={{ fontWeight: 700, color: getHeatColor(val) }}>{val.toFixed(0)}%</span>
                          </div>
                          <div style={{ height: 3, background: 'var(--color-bg-tertiary)', borderRadius: 2 }}>
                            <div style={{ height: '100%', width: `${Math.min(100, val)}%`, background: getHeatColor(val), borderRadius: 2 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Issues */}
                  {selectedHeatDistrict.issues && selectedHeatDistrict.issues.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Issues Detected</div>
                      {selectedHeatDistrict.issues.map((issue: string, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginBottom: 3 }}>
                          <AlertTriangle size={10} color="#f97316" style={{ marginTop: 2, flexShrink: 0 }} />
                          {String(issue).replace(/_/g, ' ')}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Top Projects */}
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Projects ({selectedHeatDistrict.project_count})
                    </div>
                    {selectedHeatDistrict.top_projects.map((proj: any) => (
                      <Link
                        key={proj.id}
                        to={`/projects/${proj.id}`}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '6px 8px', borderRadius: 6,
                          background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-subtle)',
                          marginBottom: 4, textDecoration: 'none',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{proj.name}</div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>{proj.project_code}</div>
                        </div>
                        <span style={{
                          fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: 8,
                          background: `${getRiskLevelColor(proj.risk_level)}18`,
                          color: getRiskLevelColor(proj.risk_level),
                          border: `1px solid ${getRiskLevelColor(proj.risk_level)}30`,
                        }}>{proj.risk_level}</span>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Filter Panel */}
            <div className="card">
              <button
                onClick={() => setFilterPanelOpen(!filterPanelOpen)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, marginBottom: filterPanelOpen ? 14 : 0,
                }}
              >
                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Filter size={13} color="var(--color-accent-primary)" /> Filters & Layer Controls
                </h4>
                {filterPanelOpen ? <ChevronDown size={14} color="var(--color-text-muted)" /> : <ChevronRight size={14} color="var(--color-text-muted)" />}
              </button>

              <AnimatePresence>
                {filterPanelOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    {/* State filter */}
                    <div style={{ marginBottom: 10 }}>
                      <label className="input-label" style={{ fontSize: '0.72rem' }}>State</label>
                      <select
                        id="gis-filter-state"
                        value={selectedState}
                        onChange={e => handleSelectState(e.target.value)}
                        className="input" style={{ height: 36, fontSize: '0.78rem' }}
                      >
                        <option value="ALL">All States</option>
                        {statesInView.map(st => (
                          <option key={st} value={st}>{STATE_COORDINATES[st]?.name || st} ({st})</option>
                        ))}
                      </select>
                    </div>

                    {/* District filter */}
                    <div style={{ marginBottom: 10 }}>
                      <label className="input-label" style={{ fontSize: '0.72rem' }}>District</label>
                      <input
                        id="gis-filter-district"
                        type="text"
                        placeholder="Filter by district name..."
                        value={selectedDistrict}
                        onChange={e => setSelectedDistrict(e.target.value)}
                        className="input" style={{ height: 36, fontSize: '0.78rem' }}
                      />
                    </div>

                    {/* Agency filter */}
                    <div style={{ marginBottom: 10 }}>
                      <label className="input-label" style={{ fontSize: '0.72rem' }}>Executing Agency</label>
                      <select
                        id="gis-filter-agency"
                        value={selectedAgency}
                        onChange={e => setSelectedAgency(e.target.value)}
                        className="input" style={{ height: 36, fontSize: '0.78rem' }}
                      >
                        <option value="">All Agencies</option>
                        {agenciesInView.map(a => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>

                    {/* Status filter */}
                    <div style={{ marginBottom: 10 }}>
                      <label className="input-label" style={{ fontSize: '0.72rem' }}>Project Status / Stage</label>
                      <select
                        id="gis-filter-status"
                        value={selectedStatus}
                        onChange={e => setSelectedStatus(e.target.value)}
                        className="input" style={{ height: 36, fontSize: '0.78rem' }}
                      >
                        <option value="ALL">All Stages</option>
                        <option value="ACTIVE">Active</option>
                        <option value="DELAYED">Delayed</option>
                        <option value="APPROVED">Approved</option>
                        <option value="UNDER_REVIEW">Under Review</option>
                        <option value="ON_HOLD">On Hold</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                    </div>

                    {/* Risk filter */}
                    <div style={{ marginBottom: 14 }}>
                      <label className="input-label" style={{ fontSize: '0.72rem' }}>Risk Level</label>
                      <select
                        id="gis-filter-risk"
                        value={selectedRisk}
                        onChange={e => setSelectedRisk(e.target.value)}
                        className="input" style={{ height: 36, fontSize: '0.78rem' }}
                      >
                        <option value="ALL">All Risk Levels</option>
                        <option value="CRITICAL">🔴 Critical</option>
                        <option value="HIGH">🟠 High</option>
                        <option value="MEDIUM">🟡 Medium</option>
                        <option value="LOW">🟢 Low</option>
                      </select>
                    </div>

                    {/* Layer Toggles — only in risk map mode */}
                    {viewMode === 'risk_map' && (
                      <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 12 }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                          <Layers size={11} style={{ marginRight: 4 }} />Layer Controls
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--color-text-primary)', cursor: 'pointer', marginBottom: 6 }}>
                          <input type="checkbox" checked={showMarkers} onChange={e => setShowMarkers(e.target.checked)} />
                          Project Markers
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={showHalos} onChange={e => setShowHalos(e.target.checked)} />
                          Risk Signal Halos
                        </label>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Legend */}
            <div className="card" style={{ border: '1px solid rgba(64,128,255,0.15)', background: 'rgba(64,128,255,0.03)' }}>
              <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4080ff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Target size={13} />
                {viewMode === 'risk_map' ? 'Project Delay Risk Legend' : 'District Risk Intensity Legend'}
              </h4>

              {viewMode === 'risk_map' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.75rem' }}>
                  {[
                    { color: '#dc2626', label: '🔴 Critical Risk', sub: 'Delay Risk Score > 80' },
                    { color: '#f97316', label: '🟠 High Risk', sub: 'Delay Risk Score 65–80' },
                    { color: '#eab308', label: '🟡 Medium Risk', sub: 'Delay Risk Score 45–65' },
                    { color: '#16a34a', label: '🟢 Low Risk', sub: 'Delay Risk Score < 45' },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: l.color, boxShadow: `0 0 6px ${l.color}60`, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{l.label}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{l.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.72rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 30, height: 8, borderRadius: 4, background: 'linear-gradient(90deg, #16a34a, #eab308, #f97316, #dc2626)' }} />
                    <span style={{ color: 'var(--color-text-muted)' }}>Low Risk → Critical Risk</span>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    Circle size = relative delay risk concentration<br />
                    Click any district bubble to view local delay factors
                  </div>
                  <div style={{ paddingTop: 6, borderTop: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>Risk Factors Included:</div>
                    {['Risk Level (35%)', 'Compensation Backlog (25%)', 'Legal Disputes (15%)', 'Delay Severity (15%)', 'Possession Gap (10%)'].map(s => (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: 2 }}>
                        <BarChart3 size={9} color="var(--color-accent-primary)" /> {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* High-Risk District List (Heatmap Mode) */}
            {viewMode === 'heatmap' && heatmapData.length > 0 && (
              <div className="card">
                <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <AlertTriangle size={13} color="#dc2626" /> Highest Risk Districts
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {heatmapData.slice(0, 8).map((pt, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedHeatDistrict(pt)
                        setMapCenter([pt.lat, pt.lng])
                        setMapZoom(9)
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 10px', borderRadius: 7, background: 'var(--color-bg-tertiary)',
                        border: '1px solid var(--color-border-subtle)', cursor: 'pointer',
                        width: '100%', textAlign: 'left',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {pt.district} <span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>({pt.state_code})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: getHeatColor(pt.heat_intensity) }}>
                          {pt.heat_intensity}
                        </span>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: getHeatColor(pt.heat_intensity) }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
