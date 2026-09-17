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
  MapPin,
  Search,
  Maximize2,
  Minimize2,
  Globe,
  Filter,
  ChevronDown,
  ChevronRight,
  Map,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gavel,
  BarChart3,
  Info,
} from 'lucide-react'
import { PageHeader } from '@/components/common'
import { projectsAPI, gisAPI } from '@/api/client'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  useMap,
  GeoJSON,
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

// Parcel Risk Colours
const PARCEL_RISK_COLORS: Record<string, { fill: string; stroke: string; fillOpacity: number }> = {
  CRITICAL: { fill: '#dc2626', stroke: '#991b1b', fillOpacity: 0.55 },
  HIGH: { fill: '#f97316', stroke: '#c2410c', fillOpacity: 0.5 },
  MEDIUM: { fill: '#eab308', stroke: '#a16207', fillOpacity: 0.45 },
  LOW: { fill: '#16a34a', stroke: '#15803d', fillOpacity: 0.4 },
}

function createRiskMarkerIcon(riskLevel: string) {
  let color = '#16a34a'
  let glowColor = 'rgba(22,163,74,0.4)'
  if (riskLevel === 'CRITICAL') { color = '#dc2626'; glowColor = 'rgba(220,38,38,0.5)' }
  else if (riskLevel === 'HIGH') { color = '#f97316'; glowColor = 'rgba(249,115,22,0.45)' }
  else if (riskLevel === 'MEDIUM') { color = '#eab308'; glowColor = 'rgba(234,179,8,0.45)' }
  const html = `<div style="position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;"><div style="position:absolute;width:30px;height:30px;border-radius:50%;background:${color};opacity:0.3;animation:ping 2.2s cubic-bezier(0,0,0.2,1) infinite;"></div><div style="width:16px;height:16px;border-radius:50%;background:${color};border:2.5px solid #ffffff;box-shadow:0 2px 8px ${glowColor},0 0 0 3px ${glowColor};"></div></div>`
  return L.divIcon({ html, className: 'custom-risk-marker', iconSize: [30, 30], iconAnchor: [15, 15] })
}

function getRiskLevelColor(level: string): string {
  if (level === 'CRITICAL') return '#dc2626'
  if (level === 'HIGH') return '#f97316'
  if (level === 'MEDIUM') return '#eab308'
  return '#16a34a'
}

function MapViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2, easeLinearity: 0.25 })
  }, [center, zoom, map])
  return null
}

function parcelStyle(feature: any) {
  const risk = feature?.properties?.risk_bucket || 'MEDIUM'
  const cfg = PARCEL_RISK_COLORS[risk] || PARCEL_RISK_COLORS.MEDIUM
  return { color: cfg.stroke, fillColor: cfg.fill, fillOpacity: cfg.fillOpacity, weight: 1.5 }
}

function onEachParcelFeature(feature: any, layer: any) {
  if (!feature.properties) return
  const p = feature.properties
  const riskColors: Record<string, string> = { CRITICAL: '#dc2626', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#16a34a' }
  const rc = riskColors[p.risk_bucket] || '#64748b'
  layer.bindPopup(`<div style="min-width:220px;font-family:Inter,sans-serif;font-size:0.78rem;color:#0f172a;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><strong style="font-size:0.85rem;">Khasra ${p.khasra_number}</strong><span style="padding:2px 8px;border-radius:10px;font-size:0.65rem;font-weight:700;background:${rc}20;color:${rc};border:1px solid ${rc}40;">${p.risk_bucket}</span></div><div style="display:flex;flex-direction:column;gap:4px;border-top:1px solid #e2e8f0;padding-top:6px;"><div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Village:</span><strong>${p.village}${p.tehsil ? ' / ' + p.tehsil : ''}</strong></div><div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Area:</span><strong>${p.area_ha != null ? Number(p.area_ha).toFixed(3) + ' ha' : 'N/A'}</strong></div><div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Land Use:</span><strong>${p.land_use_type}</strong></div><div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Owners:</span><strong>${p.owner_count}</strong></div><div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Status:</span><strong style="color:${rc};">${p.comp_status}</strong></div>${p.has_legal_dispute ? '<div style="margin-top:4px;padding:4px 6px;background:#fef2f2;border-radius:6px;color:#dc2626;font-size:0.7rem;font-weight:600;">Legal Dispute Active</div>' : ''}${p.days_pending != null ? '<div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Days Pending:</span><strong>' + p.days_pending + '</strong></div>' : ''}</div></div>`, { maxWidth: 280 })
}

interface DetailedMapProps {
  project: any
  onClose: () => void
}

function DetailedMapModal({ project, onClose }: DetailedMapProps) {
  const [gisData, setGisData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailTile, setDetailTile] = useState<'SATELLITE' | 'OSM'>('OSM')
  const [activeParcel, setActiveParcel] = useState<any | null>(null)
  const [parcelFilter, setParcelFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL')

  const mapCenter: [number, number] = project.lat && project.lng ? [project.lat, project.lng] : [21.1458, 79.0882]

  useEffect(() => {
    setLoading(true); setError(null)
    gisAPI.getProjectGIS(project.id)
      .then((data: any) => { setGisData(data); setLoading(false) })
      .catch((err: any) => { console.error(err); setError('Could not load GIS data for this project.'); setLoading(false) })
  }, [project.id])

  const summary = gisData?.risk_summary || {}
  const parcels = gisData?.parcels || { type: 'FeatureCollection', features: [] }

  const filteredParcels = useMemo(() => {
    if (parcelFilter === 'ALL') return parcels
    return { type: 'FeatureCollection', features: (parcels.features || []).filter((f: any) => f?.properties?.risk_bucket === parcelFilter) }
  }, [parcels, parcelFilter])

  const parcelList = useMemo(() => {
    const feats: any[] = (parcels.features || [])
    if (parcelFilter === 'ALL') return feats
    return feats.filter((f: any) => f?.properties?.risk_bucket === parcelFilter)
  }, [parcels, parcelFilter])

  const hasGeometries = (parcels.features || []).some((f: any) => f?.geometry != null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const riskBadge = (risk: string) => ({
    padding: '2px 8px', borderRadius: 10, fontSize: '0.65rem', fontWeight: 700,
    background: getRiskLevelColor(risk) + '20', color: getRiskLevelColor(risk),
    border: `1px solid ${getRiskLevelColor(risk)}40`,
  } as React.CSSProperties)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'stretch' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }} transition={{ duration: 0.22 }}
        style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-primary)', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#1e40af,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Map size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>{project.name}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <code style={{ fontSize: '0.68rem', padding: '1px 5px', background: '#eff6ff', borderRadius: 4, color: '#1d4ed8' }}>{project.project_code}</code>
                <span style={riskBadge(project.risk_level)}>{project.risk_level}</span>
                Land Acquisition Risk Map
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to={`/projects/${project.id}`} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, fontSize: '0.76rem', fontWeight: 700, background: 'var(--color-accent-primary)', color: '#fff', textDecoration: 'none' }}>
              Open Full Project <ExternalLink size={12} />
            </Link>
            <button id="detailed-map-close" onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} color="var(--color-text-muted)" />
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--color-border-subtle)', borderTopColor: 'var(--color-accent-primary)', animation: 'spin 0.9s linear infinite' }} />
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Loading land parcel data…</div>
          </div>
        ) : error ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#dc2626' }}>
            <AlertTriangle size={22} /> {error}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', overflow: 'hidden' }}>
            {/* Map */}
            <div style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.14)', gap: 2 }}>
                {(['SATELLITE', 'OSM'] as const).map(k => (
                  <button key={k} onClick={() => setDetailTile(k)} style={{ padding: '4px 14px', fontSize: '0.72rem', fontWeight: 700, borderRadius: 7, border: 'none', cursor: 'pointer', background: detailTile === k ? '#2563eb' : 'transparent', color: detailTile === k ? '#fff' : '#475569' }}>
                    {k === 'SATELLITE' ? 'Satellite' : 'Street'}
                  </button>
                ))}
              </div>
              <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer key={detailTile} attribution={MAP_TILES[detailTile].attribution} url={MAP_TILES[detailTile].url} />
                {project.lat && project.lng && (
                  <Marker position={[project.lat, project.lng]} icon={createRiskMarkerIcon(project.risk_level)}>
                    <Popup><strong>{project.name}</strong><br /><span style={{ fontSize: '0.75rem', color: '#64748b' }}>Project Centroid</span></Popup>
                  </Marker>
                )}
                {hasGeometries && (
                  <GeoJSON
                    key={`${project.id}-${parcelFilter}`}
                    data={filteredParcels as any}
                    style={parcelStyle}
                    onEachFeature={(feature, layer) => {
                      onEachParcelFeature(feature, layer)
                      ;(layer as any).on('click', () => setActiveParcel(feature.properties))
                    }}
                  />
                )}
              </MapContainer>
              {!hasGeometries && !loading && (
                <div style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 1000, background: 'rgba(255,255,255,0.97)', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 14px', fontSize: '0.72rem', color: '#92400e', maxWidth: 360, boxShadow: '0 4px 18px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Info size={13} /> Parcel geometries not yet uploaded. Attribute data is shown in the panel.
                </div>
              )}
            </div>

            {/* Right Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)', overflow: 'hidden' }}>
              {/* Acquisition Summary */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border-subtle)', flexShrink: 0 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <BarChart3 size={13} color="var(--color-accent-primary)" /> Acquisition Summary
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                    <span>Possession Progress</span>
                    <strong style={{ color: (summary.acquisition_pct || 0) >= 75 ? '#16a34a' : (summary.acquisition_pct || 0) >= 40 ? '#eab308' : '#dc2626' }}>{summary.acquisition_pct || 0}%</strong>
                  </div>
                  <div style={{ width: '100%', height: 7, background: 'var(--color-border-subtle)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, width: `${summary.acquisition_pct || 0}%`, background: (summary.acquisition_pct || 0) >= 75 ? '#16a34a' : (summary.acquisition_pct || 0) >= 40 ? '#eab308' : '#dc2626', transition: 'width 0.5s' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    { icon: <Target size={12} />, label: 'Total Parcels', value: summary.total_parcels || 0, color: '#6366f1' },
                    { icon: <CheckCircle2 size={12} />, label: 'In Possession', value: summary.in_possession || 0, color: '#16a34a' },
                    { icon: <Clock size={12} />, label: 'Pending', value: summary.pending || 0, color: '#f97316' },
                    { icon: <Gavel size={12} />, label: 'Disputed', value: summary.disputed || 0, color: '#dc2626' },
                  ].map(s => (
                    <div key={s.label} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--color-bg-primary)', border: `1px solid ${s.color}25`, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ color: s.color }}>{s.icon}</div>
                      <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Filter */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border-subtle)', flexShrink: 0 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 7 }}>Filter by Risk</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
                  {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(f => (
                    <button key={f} onClick={() => setParcelFilter(f)} style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700, border: `1px solid ${parcelFilter === f ? (f === 'ALL' ? 'var(--color-accent-primary)' : getRiskLevelColor(f)) : 'var(--color-border-subtle)'}`, background: parcelFilter === f ? (f === 'ALL' ? 'var(--color-accent-primary)' : getRiskLevelColor(f) + '20') : 'transparent', color: parcelFilter === f ? (f === 'ALL' ? '#fff' : getRiskLevelColor(f)) : 'var(--color-text-muted)', cursor: 'pointer' }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parcel List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {parcelList.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                    {(summary.total_parcels || 0) === 0 ? 'No parcel data available for this project yet.' : 'No parcels match the selected filter.'}
                  </div>
                ) : (
                  parcelList.map((f: any, i: number) => {
                    const p = f.properties || f
                    const rc = getRiskLevelColor(p.risk_bucket)
                    const isActive = activeParcel?.id === p.id
                    return (
                      <div key={p.id || i} onClick={() => setActiveParcel(isActive ? null : p)} style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${isActive ? rc + '60' : 'var(--color-border-subtle)'}`, background: isActive ? rc + '08' : 'var(--color-bg-primary)', transition: 'all 0.15s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Khasra {p.khasra_number}</span>
                          <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: '0.6rem', fontWeight: 700, background: rc + '20', color: rc, border: `1px solid ${rc}40` }}>{p.risk_bucket}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', gap: 8 }}>
                          <span>{p.village}</span>
                          {p.area_ha != null && <span>{Number(p.area_ha).toFixed(2)} ha</span>}
                          <span style={{ color: rc, fontWeight: 600 }}>{p.comp_status}</span>
                        </div>
                        {p.has_legal_dispute && (
                          <div style={{ marginTop: 3, fontSize: '0.62rem', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <AlertTriangle size={10} /> Legal Dispute Active
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Legend */}
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border-subtle)', flexShrink: 0 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 6 }}>Parcel Risk Legend</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    { color: '#dc2626', label: 'Critical', sub: 'Legal dispute active' },
                    { color: '#f97316', label: 'High', sub: 'Notified, compensation pending' },
                    { color: '#eab308', label: 'Medium', sub: 'Not yet notified' },
                    { color: '#16a34a', label: 'Low', sub: 'Compensated / Clear' },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.7rem' }}>
                      <div style={{ width: 11, height: 11, borderRadius: 3, background: l.color, flexShrink: 0 }} />
                      <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{l.label}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>— {l.sub}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// Main Component
export default function GIS() {
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
  const [interactiveSearchQuery, setInteractiveSearchQuery] = useState('')
  const [interactiveRisk, setInteractiveRisk] = useState('ALL')

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

  const interactiveProjects = useMemo(() => {
    return projects.filter(p => {
      if (interactiveRisk !== 'ALL' && p.risk_level !== interactiveRisk) return false
      if (interactiveSearchQuery.trim()) {
        const q = interactiveSearchQuery.toLowerCase()
        if (!p.name.toLowerCase().includes(q) && !p.project_code.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [projects, interactiveRisk, interactiveSearchQuery])

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
        <div style={{ display: 'flex', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', padding: 4, gap: 4 }}>
          <div id="gis-view-risk-map" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 18px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', fontWeight: 700, background: 'var(--color-accent-primary)', color: '#ffffff' }}>
            <MapPin size={14} /> Project Map View
          </div>
        </div>
      </div>

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

          <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }}>
            <MapViewController center={mapCenter} zoom={mapZoom} />
            <TileLayer key={tileKey} attribution={currentTile.attribution} url={currentTile.url} />
            {showHalos && visibleProjects.map(p => {
              const colorMap: Record<string, string> = { CRITICAL: '#dc2626', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#16a34a' }
              const radMap: Record<string, number> = { CRITICAL: 24, HIGH: 18, MEDIUM: 13, LOW: 9 }
              const color = colorMap[p.risk_level] || '#16a34a'
              return <CircleMarker key={`halo-${p.id}`} center={[p.lat, p.lng]} radius={radMap[p.risk_level] || 9} pathOptions={{ color, fillColor: color, fillOpacity: 0.13, weight: 1, opacity: 0.4 }} />
            })}
            {showMarkers && visibleProjects.map(p => (
              <Marker key={`marker-${p.id}`} position={[p.lat, p.lng]} icon={createRiskMarkerIcon(p.risk_level)}>
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
                    <button id={`gis-open-detailed-${p.id}`} onClick={() => setDetailedMapProject(p)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 8, padding: '6px 12px', background: '#1e40af', color: '#fff', fontSize: '0.72rem', fontWeight: 700, borderRadius: 7, border: 'none', cursor: 'pointer' }}>
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
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--color-text-primary)', cursor: 'pointer', marginBottom: 6 }}><input type="checkbox" checked={showMarkers} onChange={e => setShowMarkers(e.target.checked)} /> Project Markers</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--color-text-primary)', cursor: 'pointer' }}><input type="checkbox" checked={showHalos} onChange={e => setShowHalos(e.target.checked)} /> Risk Signal Halos</label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="card" style={{ border: '1px solid rgba(64,128,255,0.15)', background: 'rgba(64,128,255,0.03)' }}>
              <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4080ff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Target size={13} /> Project Delay Risk Legend</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.75rem' }}>
                {[{ color: '#dc2626', label: 'Critical Risk', sub: 'Score > 80' }, { color: '#f97316', label: 'High Risk', sub: 'Score 65-80' }, { color: '#eab308', label: 'Medium Risk', sub: 'Score 45-65' }, { color: '#16a34a', label: 'Low Risk', sub: 'Score < 45' }].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: l.color, boxShadow: `0 0 6px ${l.color}60`, flexShrink: 0 }} />
                    <div><div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{l.label}</div><div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{l.sub}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Interactive Map Section ──────────────────────────────────────────── */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 14, borderBottom: '2px solid var(--color-border-subtle)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#1e40af,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Map size={16} color="#fff" />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>Interactive Map — Land Acquisition Risk View</h2>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: 0, maxWidth: 640 }}>
              Select any project to open a detailed Land Acquisition Risk Map with parcel-level status, ownership disputes, compensation tracking, and risk colour coding.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 10, padding: '7px 14px' }}>
            <Search size={14} color="var(--color-text-muted)" />
            <input id="interactive-map-search" type="text" placeholder="Search project to open detailed map..." value={interactiveSearchQuery} onChange={e => setInteractiveSearchQuery(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.82rem', color: 'var(--color-text-primary)', width: '100%' }} />
          </div>
          <select id="interactive-map-risk-filter" value={interactiveRisk} onChange={e => setInteractiveRisk(e.target.value)} className="input" style={{ width: 160, height: 40, fontSize: '0.78rem' }}>
            <option value="ALL">All Risk Levels</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
          {interactiveProjects.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No projects match your search.</div>
          ) : (
            interactiveProjects.map(p => {
              const rc = getRiskLevelColor(p.risk_level)
              return (
                <motion.div key={p.id} whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }} transition={{ duration: 0.15 }} className="card" style={{ padding: '14px 16px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${rc},${rc}80)` }} />
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <code style={{ fontSize: '0.65rem', color: '#1d4ed8', fontWeight: 800, background: '#eff6ff', padding: '2px 6px', borderRadius: 4, border: '1px solid #bfdbfe' }}>{p.project_code}</code>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: rc + '18', color: rc, border: `1px solid ${rc}35` }}>{p.risk_level}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6, lineHeight: 1.3 }}>{p.name}</div>
                  <div style={{ display: 'flex', gap: 10, fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: 10 }}>
                    <span>{STATE_COORDINATES[p.state_code]?.name || p.state_code || 'N/A'}</span>
                    <span>• {p.status}</span>
                  </div>
                  {p.priorityScore != null && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: 3 }}>
                        <span>Risk Score</span><strong style={{ color: rc }}>{p.priorityScore.toFixed(0)}/100</strong>
                      </div>
                      <div style={{ height: 4, background: 'var(--color-border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${p.priorityScore}%`, background: rc, borderRadius: 2 }} />
                      </div>
                    </div>
                  )}
                  <button id={`interactive-open-map-${p.id}`} onClick={() => setDetailedMapProject(p)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '8px 12px', background: 'linear-gradient(135deg,#1e40af,#2563eb)', color: '#fff', fontSize: '0.74rem', fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(37,99,235,0.25)' }}>
                    Open Detailed Map
                  </button>
                </motion.div>
              )
            })
          )}
        </div>
      </div>

      <AnimatePresence>
        {detailedMapProject && (
          <DetailedMapModal project={detailedMapProject} onClose={() => setDetailedMapProject(null)} />
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  )
}