/**
 * LADRIS — GIS Risk Map & Interactive Land Acquisition Map
 *
 * Layer 1: GIS Risk Map — Project markers with risk-based colors, rich popups,
 *          multi-filter panel (State, District, Agency, Stage, Risk Level)
 * Layer 2: Interactive Map — Per-project detailed land parcel GeoJSON map with
 *          risk bucket colours, acquisition status, clickable parcel popups,
 *          and risk summary panel.
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers,
  Target,
  ExternalLink,
  ShieldCheck,
  Search,
  Maximize2,
  Minimize2,
  Globe,
  Filter,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { PageHeader } from '@/components/common'
import { projectsAPI } from '@/api/client'
import DetailedMapView from '@/components/gis/DetailedMapView'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Link } from 'react-router-dom'

// State Centroids
const STATE_COORDINATES: Record<string, { coords: [number, number]; name: string; zoom: number }> = {
  UP: { coords: [26.8467, 80.9462], name: 'Uttar Pradesh', zoom: 7 },
  MH: { coords: [19.7515, 75.7139], name: 'Maharashtra', zoom: 7 },
  TN: { coords: [11.1271, 78.6569], name: 'Tamil Nadu', zoom: 7 },
  GJ: { coords: [22.2587, 71.1924], name: 'Gujarat', zoom: 7 },
  BR: { coords: [25.0961, 85.3131], name: 'Bihar', zoom: 7 },
  KA: { coords: [15.3173, 75.7139], name: 'Karnataka', zoom: 7 },
  RJ: { coords: [27.0238, 74.2179], name: 'Rajasthan', zoom: 7 },
  DL: { coords: [28.7041, 77.1025], name: 'Delhi NCR', zoom: 9 },
  WB: { coords: [22.9868, 87.855], name: 'West Bengal', zoom: 7 },
  AP: { coords: [15.9129, 79.74], name: 'Andhra Pradesh', zoom: 7 },
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
  GA: { coords: [15.2993, 74.124], name: 'Goa', zoom: 9 },
}

// Map Tiles
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

function createRiskMarkerIcon(riskLevel: string, showHalo: boolean = true) {
  const norm = (riskLevel || 'LOW').toUpperCase()

  // Coloured markers: low - green, medium - yellow, high - orange, critical - red
  let pinColor = '#10b981'       // low - green
  let borderDashed = '#047857'
  let haloBg = 'rgba(16, 185, 129, 0.18)'
  let glowColor = 'rgba(16, 185, 129, 0.4)'
  let haloSize = 54
  let pulseSpeed = '3s'

  if (norm === 'CRITICAL') {
    pinColor = '#dc2626'        // critical - red
    borderDashed = '#991b1b'
    haloBg = 'rgba(220, 38, 38, 0.22)'
    glowColor = 'rgba(220, 38, 38, 0.55)'
    haloSize = 72
    pulseSpeed = '1.8s'
  } else if (norm === 'HIGH') {
    pinColor = '#f97316'        // high - orange
    borderDashed = '#c2410c'
    haloBg = 'rgba(249, 115, 22, 0.20)'
    glowColor = 'rgba(249, 115, 22, 0.45)'
    haloSize = 64
    pulseSpeed = '2.2s'
  } else if (norm === 'MEDIUM') {
    pinColor = '#eab308'        // medium - yellow
    borderDashed = '#a16207'
    haloBg = 'rgba(234, 179, 8, 0.18)'
    glowColor = 'rgba(234, 179, 8, 0.4)'
    haloSize = 58
    pulseSpeed = '2.6s'
  }

  const haloHtml = showHalo ? `
    <div class="hotspot-halo-zone" style="
      position: absolute;
      top: 50%;
      left: 50%;
      width: ${haloSize}px;
      height: ${haloSize}px;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      border: 2px dashed ${borderDashed};
      background: ${haloBg};
      box-shadow: 0 0 10px ${glowColor};
      animation: hotspotPulse ${pulseSpeed} ease-in-out infinite;
      pointer-events: none;
    "></div>
    <div style="
      position: absolute;
      top: 50%;
      left: 50%;
      width: ${Math.round(haloSize * 0.55)}px;
      height: ${Math.round(haloSize * 0.55)}px;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      border: 1px solid ${borderDashed};
      opacity: 0.35;
      pointer-events: none;
    "></div>
  ` : ''

  const pinHtml = `
    <div class="hotspot-pin-anchor" style="
      position: absolute;
      left: 38px;
      bottom: 38px;
      transform: translateX(-50%);
      filter: drop-shadow(0 4px 6px rgba(0,0,0,0.55));
      cursor: pointer;
      transition: transform 0.15s ease;
      z-index: 10;
    ">
      <svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
        <path d="M12 0C5.37258 0 0 5.37258 0 12C0 20.2 12 32 12 32C12 32 24 20.2 24 12C24 5.37258 18.6274 0 12 0Z" fill="${pinColor}"/>
        <path d="M12 0.75C5.78679 0.75 0.75 5.78679 0.75 12C0.75 19.5 11.4 30.5 12 31.1C12.6 30.5 23.25 19.5 23.25 12C23.25 5.78679 18.2132 0.75 12 0.75Z" stroke="rgba(255,255,255,0.45)" stroke-width="1"/>
        <circle cx="12" cy="11.5" r="4.2" fill="#ffffff"/>
      </svg>
    </div>
    <div style="
      position: absolute;
      left: 38px;
      top: 38px;
      transform: translate(-50%, -50%);
      width: 6px;
      height: 3px;
      border-radius: 50%;
      background: rgba(0,0,0,0.5);
      z-index: 5;
    "></div>
  `

  const html = `
    <div class="hotspot-marker-container" style="
      position: relative;
      width: 76px;
      height: 76px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      ${haloHtml}
      ${pinHtml}
    </div>
  `

  return L.divIcon({
    html,
    className: 'custom-hotspot-risk-marker',
    iconSize: [76, 76],
    iconAnchor: [38, 38],
    popupAnchor: [0, -36],
  })
}

function getRiskLevelColor(level: string): string {
  const norm = (level || '').toUpperCase()
  if (norm === 'CRITICAL') return '#dc2626'
  if (norm === 'HIGH') return '#f97316'
  if (norm === 'MEDIUM') return '#eab308'
  return '#10b981'
}

function MapViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2, easeLinearity: 0.25 })
  }, [center, zoom, map])
  return null
}

// Main Component
export default function GIS() {
  const [activeTab, setActiveTab] = useState<'PROJECT_MAP' | 'DETAILED_MAP'>('PROJECT_MAP')
  const [projects, setProjects] = useState<any[]>([])
  const [tileKey, setTileKey] = useState<keyof typeof MAP_TILES>('SATELLITE')
  const [mapCenter, setMapCenter] = useState<[number, number]>([21.1458, 79.0882])
  const [mapZoom, setMapZoom] = useState(5)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showMarkers, setShowMarkers] = useState(true)
  const [showHalos, setShowHalos] = useState(true)
  const [selectedState, setSelectedState] = useState('ALL')
  const [selectedRisk, setSelectedRisk] = useState('ALL')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedAgency, setSelectedAgency] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPanelOpen, setFilterPanelOpen] = useState(true)
  const [detailedMapProject, setDetailedMapProject] = useState<any | null>(null)

  useEffect(() => {
    let isMounted = true
    async function loadData() {
      try {
        const projRes = await projectsAPI.list({ page_size: 100 })
        if (!isMounted) return
        const items = projRes.items || []
        const mapped = items.map((p: any) => {
          const lat = p.latitude == null ? null : Number(p.latitude)
          const lng = p.longitude == null ? null : Number(p.longitude)
          return { ...p, lat, lng, risk_level: p.risk_level || 'UNKNOWN', priorityScore: p.priority_score ?? null, topBottleneck: p.top_bottleneck || p.delay_reason || 'Risk driver unavailable', stateLabel: p.state_code || 'Unknown' }
        }).filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        setProjects(mapped)
      } catch (err) { console.error('GIS load error:', err) }
    }
    loadData()
    return () => { isMounted = false }
  }, [])

  const visibleProjects = useMemo(() => {
    return projects.filter(p => {
      if (selectedState !== 'ALL' && p.state_code !== selectedState) return false
      if (selectedRisk !== 'ALL' && p.risk_level !== selectedRisk) return false
      if (selectedStatus !== 'ALL' && p.status !== selectedStatus) return false
      if (selectedDistrict.trim()) {
        const dl = selectedDistrict.toLowerCase()
        if (!(p.district_codes || []).some((d: string) => d.toLowerCase().includes(dl))) return false
      }
      if (selectedAgency.trim()) {
        const al = selectedAgency.toLowerCase()
        if (!(p.executing_agency || '').toLowerCase().includes(al) && !(p.nodal_agency || '').toLowerCase().includes(al)) return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (!p.name.toLowerCase().includes(q) && !p.project_code.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [projects, selectedState, selectedRisk, selectedStatus, selectedDistrict, selectedAgency, searchQuery])

  const stats = useMemo(() => {
    const critical = visibleProjects.filter(p => p.risk_level === 'CRITICAL').length
    const high = visibleProjects.filter(p => p.risk_level === 'HIGH').length
    const medium = visibleProjects.filter(p => p.risk_level === 'MEDIUM').length
    const low = visibleProjects.filter(p => p.risk_level === 'LOW').length
    return { critical, high, medium, low, total: visibleProjects.length }
  }, [visibleProjects])

  const statesInView = useMemo(() => { const s = new Set<string>(); projects.forEach(p => p.state_code && s.add(p.state_code)); return Array.from(s).sort() }, [projects])
  const agenciesInView = useMemo(() => { const s = new Set<string>(); projects.forEach(p => { if (p.executing_agency) s.add(p.executing_agency) }); return Array.from(s).sort().slice(0, 20) }, [projects])

  const handleSelectState = useCallback((stateCode: string) => {
    setSelectedState(stateCode)
    if (stateCode === 'ALL') { setMapCenter([21.1458, 79.0882]); setMapZoom(5) }
    else if (STATE_COORDINATES[stateCode]) { setMapCenter(STATE_COORDINATES[stateCode].coords); setMapZoom(STATE_COORDINATES[stateCode].zoom) }
  }, [])

  const handleReset = useCallback(() => {
    setSelectedState('ALL'); setSelectedRisk('ALL'); setSelectedStatus('ALL')
    setSelectedDistrict(''); setSelectedAgency(''); setSearchQuery('')
    setMapCenter([21.1458, 79.0882]); setMapZoom(5)
  }, [])

  const currentTile = MAP_TILES[tileKey]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ width: '100%' }}>
      <PageHeader title="Interactive Geographic Risk Map" subtitle="Visualize project locations, state-by-state delay hotspots, and district risk intensity across India" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div id="tour-gis-tabs" style={{ display: 'flex', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', padding: 4, gap: 4 }}>
          <button
            id="gis-view-risk-map"
            onClick={() => setActiveTab('PROJECT_MAP')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 18px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.82rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'PROJECT_MAP' ? 'var(--color-accent-primary)' : 'transparent',
              color: activeTab === 'PROJECT_MAP' ? '#ffffff' : 'var(--color-text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            Project Map View
          </button>
          <button
            id="gis-view-detailed-map"
            onClick={() => setActiveTab('DETAILED_MAP')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 18px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.82rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'DETAILED_MAP' ? 'var(--color-accent-primary)' : 'transparent',
              color: activeTab === 'DETAILED_MAP' ? '#ffffff' : 'var(--color-text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            Detailed Map View
          </button>
        </div>
      </div>

      {activeTab === 'PROJECT_MAP' ? (
        <>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total Projects', value: stats.total, color: 'var(--color-accent-primary)' },
          { label: 'Critical Risk', value: stats.critical, color: '#dc2626' },
          { label: 'High Risk', value: stats.high, color: '#f97316' },
          { label: 'Medium Risk', value: stats.medium, color: '#eab308' },
          { label: 'Low Risk', value: stats.low, color: '#16a34a' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isFullscreen ? '1fr' : '1fr 320px', gap: 16 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden', height: isFullscreen ? 'calc(100vh - 80px)' : 'calc(100vh - 260px)', minHeight: 680, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 10, left: 52, right: 14, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '6px 12px', boxShadow: '0 4px 20px rgba(0,0,0,0.14)', backdropFilter: 'blur(8px)', width: 270 }}>
              <Search size={14} color="#64748b" />
              <input id="gis-search" type="text" placeholder="Search project name or code..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.8rem', color: '#0f172a', width: '100%' }} />
              {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>x</button>}
            </div>
            <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.14)', gap: 2 }}>
                {(['SATELLITE', 'OSM'] as const).map(k => (
                  <button key={k} onClick={() => setTileKey(k)} style={{ padding: '4px 14px', fontSize: '0.72rem', fontWeight: 700, borderRadius: 7, border: 'none', cursor: 'pointer', background: tileKey === k ? '#2563eb' : 'transparent', color: tileKey === k ? '#fff' : '#475569', transition: 'all 0.13s' }}>
                    {k === 'SATELLITE' ? 'Satellite' : 'Street'}
                  </button>
                ))}
              </div>
              <button onClick={handleReset} style={{ height: 34, padding: '0 10px', background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Globe size={13} color="#2563eb" /> Reset
              </button>
              <button onClick={() => setIsFullscreen(!isFullscreen)} style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                {isFullscreen ? <Minimize2 size={14} color="#1e293b" /> : <Maximize2 size={14} color="#1e293b" />}
              </button>
            </div>
          </div>

          <MapContainer center={mapCenter} zoom={mapZoom} className="gis-satellite-enhanced" style={{ height: '100%', width: '100%' }}>
            <MapViewController center={mapCenter} zoom={mapZoom} />
            <TileLayer key={tileKey} attribution={currentTile.attribution} url={currentTile.url} maxZoom={19} />
            {tileKey === 'SATELLITE' && (
              <>
                <TileLayer
                  key="gis-boundaries"
                  url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                  attribution="&copy; Esri &mdash; Boundaries and Places"
                  zIndex={400}
                  opacity={0.92}
                  maxZoom={19}
                />
                <TileLayer
                  key="gis-transportation"
                  url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
                  attribution="&copy; Esri &mdash; Transportation"
                  zIndex={401}
                  opacity={0.78}
                  maxZoom={19}
                />
              </>
            )}
            {showMarkers && visibleProjects.map(p => (
              <Marker key={`marker-${p.id}-${showHalos}`} position={[p.lat, p.lng]} icon={createRiskMarkerIcon(p.risk_level, showHalos)}>
                <Popup className="custom-leaflet-popup" maxWidth={300}>
                  <div style={{ padding: '4px 2px', color: '#0f172a', minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <code style={{ fontSize: '0.68rem', color: '#1d4ed8', fontWeight: 800, background: '#eff6ff', padding: '2px 6px', borderRadius: 4, border: '1px solid #bfdbfe' }}>{p.project_code}</code>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: p.risk_level === 'CRITICAL' ? '#fef2f2' : p.risk_level === 'HIGH' ? '#fff7ed' : p.risk_level === 'MEDIUM' ? '#fefce8' : '#f0fdf4', color: getRiskLevelColor(p.risk_level), border: `1px solid ${getRiskLevelColor(p.risk_level)}40` }}>{p.risk_level}</span>
                    </div>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: '0 0 8px', lineHeight: 1.3, color: '#0f172a' }}>{p.name}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>State:</span><strong>{p.stateLabel}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Stage:</span><strong>{p.status}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Agency:</span><strong style={{ textAlign: 'right', maxWidth: 160 }}>{p.executing_agency || 'N/A'}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Risk Score:</span><strong style={{ color: getRiskLevelColor(p.risk_level) }}>{p.priorityScore == null ? 'N/A' : `${p.priorityScore.toFixed(1)}/100`}</strong></div>
                      <div style={{ width: '100%', height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${p.priorityScore}%`, background: getRiskLevelColor(p.risk_level), borderRadius: 3 }} />
                      </div>
                    </div>
                    <button
                      id={`gis-open-detailed-${p.id}`}
                      onClick={() => {
                        setDetailedMapProject(p)
                        setActiveTab('DETAILED_MAP')
                      }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 8, padding: '6px 12px', background: '#1e40af', color: '#fff', fontSize: '0.72rem', fontWeight: 700, borderRadius: 7, border: 'none', cursor: 'pointer' }}
                    >
                      Open Detailed Map
                    </button>
                    <Link to={`/projects/${p.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 6, padding: '7px 12px', background: '#2563eb', color: '#fff', fontSize: '0.75rem', fontWeight: 700, borderRadius: 8, textDecoration: 'none', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}>
                      View Project Details <ExternalLink size={12} />
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          <div style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 1000, background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(0,0,0,0.1)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '8px 14px', fontSize: '0.72rem', color: '#334155', maxWidth: 380, boxShadow: '0 4px 18px rgba(0,0,0,0.1)' }}>
            <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShieldCheck size={14} color="#2563eb" /> {visibleProjects.length} Projects Mapped
            </div>
            Click a marker to open project details or Detailed Map.
          </div>
        </div>

        {!isFullscreen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card">
              <button onClick={() => setFilterPanelOpen(!filterPanelOpen)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: filterPanelOpen ? 14 : 0 }}>
                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Filter size={13} color="var(--color-accent-primary)" /> Filters & Layer Controls
                </h4>
                {filterPanelOpen ? <ChevronDown size={14} color="var(--color-text-muted)" /> : <ChevronRight size={14} color="var(--color-text-muted)" />}
              </button>
              <AnimatePresence>
                {filterPanelOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <div style={{ marginBottom: 10 }}><label className="input-label" style={{ fontSize: '0.72rem' }}>State</label><select id="gis-filter-state" value={selectedState} onChange={e => handleSelectState(e.target.value)} className="input" style={{ height: 36, fontSize: '0.78rem' }}><option value="ALL">All States</option>{statesInView.map(st => <option key={st} value={st}>{STATE_COORDINATES[st]?.name || st} ({st})</option>)}</select></div>
                    <div style={{ marginBottom: 10 }}><label className="input-label" style={{ fontSize: '0.72rem' }}>District</label><input id="gis-filter-district" type="text" placeholder="Filter by district name..." value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)} className="input" style={{ height: 36, fontSize: '0.78rem' }} /></div>
                    <div style={{ marginBottom: 10 }}><label className="input-label" style={{ fontSize: '0.72rem' }}>Executing Agency</label><select id="gis-filter-agency" value={selectedAgency} onChange={e => setSelectedAgency(e.target.value)} className="input" style={{ height: 36, fontSize: '0.78rem' }}><option value="">All Agencies</option>{agenciesInView.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                    <div style={{ marginBottom: 10 }}><label className="input-label" style={{ fontSize: '0.72rem' }}>Project Status / Stage</label><select id="gis-filter-status" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="input" style={{ height: 36, fontSize: '0.78rem' }}><option value="ALL">All Stages</option><option value="ACTIVE">Active</option><option value="DELAYED">Delayed</option><option value="APPROVED">Approved</option><option value="UNDER_REVIEW">Under Review</option><option value="ON_HOLD">On Hold</option><option value="COMPLETED">Completed</option></select></div>
                    <div style={{ marginBottom: 14 }}><label className="input-label" style={{ fontSize: '0.72rem' }}>Risk Level</label><select id="gis-filter-risk" value={selectedRisk} onChange={e => setSelectedRisk(e.target.value)} className="input" style={{ height: 36, fontSize: '0.78rem' }}><option value="ALL">All Risk Levels</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></div>
                    <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 12 }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><Layers size={11} /> Layer Controls</div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--color-text-primary)', cursor: 'pointer', marginBottom: 6 }}>
                        <input type="checkbox" checked={showMarkers} onChange={e => setShowMarkers(e.target.checked)} /> Hotspot Project Pins
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={showHalos} onChange={e => setShowHalos(e.target.checked)} /> Dashed Hotspot Zones
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="card" style={{ border: '1px solid rgba(64,128,255,0.15)', background: 'rgba(64,128,255,0.03)' }}>
              <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4080ff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Target size={13} /> Hotspot Delay Risk Legend</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '0.75rem' }}>
                {[
                  { color: '#dc2626', border: '#991b1b', bg: 'rgba(220,38,38,0.22)', label: 'Critical Risk', sub: 'Score > 80 (Urgent Bottlenecks)' },
                  { color: '#f97316', border: '#c2410c', bg: 'rgba(249,115,22,0.20)', label: 'High Risk', sub: 'Score 65-80 (Elevated Delay Hazard)' },
                  { color: '#eab308', border: '#a16207', bg: 'rgba(234,179,8,0.18)', label: 'Medium Risk', sub: 'Score 45-65 (Moderate Attention)' },
                  { color: '#10b981', border: '#047857', bg: 'rgba(16,185,129,0.18)', label: 'Low Risk', sub: 'Score < 45 (On Track / Stable)' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', border: `1.8px dashed ${l.border}`, background: l.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, boxShadow: `0 0 5px ${l.color}` }} />
                    </div>
                    <div><div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{l.label}</div><div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{l.sub}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      </>
      ) : (
        <DetailedMapView
          initialProjectId={detailedMapProject?.id}
          onBackToProjectMap={() => setActiveTab('PROJECT_MAP')}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes hotspotPulse {
          0% { transform: translate(-50%, -50%) scale(0.96); opacity: 0.82; }
          50% { transform: translate(-50%, -50%) scale(1.04); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.96); opacity: 0.82; }
        }
        .hotspot-pin-anchor:hover {
          transform: translateX(-50%) translateY(-3px) scale(1.1) !important;
        }
        .gis-satellite-enhanced .leaflet-tile-pane {
          filter: contrast(1.06) saturate(1.15) brightness(1.02);
        }
      `}</style>
    </motion.div>
  )
}