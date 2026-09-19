/**
 * LADRIS — Detailed Map View Component
 *
 * Dedicated land-acquisition location intelligence tab:
 * - Shows project route alignment and acquisition boundary.
 * - 3 Simple parcel colors:
 *     Green = Clear, Orange = Attention, Red = Disputed/Blocked.
 * - Instant, responsive click on any parcel or marker without map crashes or broken zoom.
 * - Simple, easy-to-understand controls: Project selector & Status filter tabs.
 * - Clear right-hand inspector showing parcel details or project overview.
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ExternalLink,
  AlertTriangle,
  RotateCcw,
  Building2,
  Info,
  X,
} from 'lucide-react'
import { gisAPI } from '@/api/client'

// Map Tile Providers
const MAP_TILES = {
  OSM: {
    name: 'Street Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  SATELLITE: {
    name: 'Satellite (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS',
  },
}

// 3 Simple Parcel Colors
const STATUS_COLORS: Record<'GREEN' | 'ORANGE' | 'RED', { stroke: string; fill: string; label: string; text: string; bg: string }> = {
  GREEN: {
    stroke: '#15803d',
    fill: '#22c55e',
    label: 'Clear',
    text: '#166534',
    bg: '#dcfce7',
  },
  ORANGE: {
    stroke: '#c2410c',
    fill: '#f97316',
    label: 'Attention Needed',
    text: '#9a3412',
    bg: '#ffedd5',
  },
  RED: {
    stroke: '#991b1b',
    fill: '#ef4444',
    label: 'Disputed / Blocked',
    text: '#991b1b',
    bg: '#fee2e2',
  },
}

// Custom Risk Beacon Icon for Hotspot Locations
function createHotspotBeaconIcon(color: string = '#dc2626') {
  const html = `
    <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
      <div style="position:absolute;width:32px;height:32px;border-radius:50%;background:${color};opacity:0.35;animation:pulseHotspot 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="position:absolute;width:20px;height:20px;border-radius:50%;background:${color};opacity:0.8;"></div>
      <div style="width:10px;height:10px;border-radius:50%;background:#ffffff;border:2px solid ${color};box-shadow:0 0 8px ${color};z-index:2;"></div>
    </div>
  `
  return L.divIcon({
    html,
    className: 'hotspot-beacon-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

// Map Auto-Fitter Helper (gentle bounds fitting on project or village change)
function MapBoundsController({
  bounds,
}: {
  bounds: L.LatLngBoundsExpression | null
}) {
  const map = useMap()
  useEffect(() => {
    if (bounds) {
      map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 15, duration: 0.9 })
    }
  }, [bounds, map])
  return null
}

interface DetailedMapViewProps {
  initialProjectId?: string
}

export default function DetailedMapView({ initialProjectId }: DetailedMapViewProps) {
  // Main Controls
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '')
  const [projectsList, setProjectsList] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RED' | 'ORANGE' | 'GREEN'>('ALL')
  const [selectedVillage, setSelectedVillage] = useState<string | null>(null)
  const [selectedParcel, setSelectedParcel] = useState<any | null>(null)
  const [tileKey, setTileKey] = useState<keyof typeof MAP_TILES>('OSM')

  // Spatial Data
  const [projectGIS, setProjectGIS] = useState<any | null>(null)
  const [loadingGIS, setLoadingGIS] = useState<boolean>(false)
  const [, setGisError] = useState<string | null>(null)
  const [mapTargetBounds, setMapTargetBounds] = useState<L.LatLngBoundsExpression | null>(null)

  // 1. Fetch available projects for selector
  useEffect(() => {
    let isSubscribed = true
    gisAPI.getDetailedProjects()
      .then((data: any) => {
        if (!isSubscribed) return
        const list = data?.projects || []
        setProjectsList(list)
        if (list.length > 0 && !selectedProjectId) {
          const firstWithGIS = list.find((p: any) => p.has_detailed_gis) || list[0]
          setSelectedProjectId(firstWithGIS.id)
        }
      })
      .catch((err: any) => {
        console.error('Failed to load projects list:', err)
      })
    return () => { isSubscribed = false }
  }, [selectedProjectId])

  // 2. Fetch GIS spatial data for selected project
  useEffect(() => {
    if (!selectedProjectId) {
      setProjectGIS(null)
      return
    }

    let isSubscribed = true
    setLoadingGIS(true)
    setGisError(null)
    setSelectedVillage(null)
    setSelectedParcel(null)

    gisAPI.getProjectGIS(selectedProjectId)
      .then((data: any) => {
        if (!isSubscribed) return
        setProjectGIS(data)
        setLoadingGIS(false)

        // Compute initial bounds to fit map nicely
        const boundsList: [number, number][] = []
        if (data?.alignment?.geometry?.coordinates) {
          const coords = data.alignment.geometry.coordinates
          coords.forEach(([lng, lat]: [number, number]) => boundsList.push([lat, lng]))
        }
        if (data?.parcels?.features) {
          data.parcels.features.forEach((f: any) => {
            if (f.geometry?.type === 'Polygon' && f.geometry.coordinates?.[0]) {
              f.geometry.coordinates[0].forEach(([lng, lat]: [number, number]) => boundsList.push([lat, lng]))
            } else if (f.properties?.centroid) {
              const [lng, lat] = f.properties.centroid
              boundsList.push([lat, lng])
            }
          })
        }
        if (boundsList.length > 0) {
          setMapTargetBounds(L.latLngBounds(boundsList))
        } else if (data?.project?.latitude && data?.project?.longitude) {
          const lat = data.project.latitude
          const lng = data.project.longitude
          setMapTargetBounds(L.latLngBounds([[lat - 0.05, lng - 0.05], [lat + 0.05, lng + 0.05]]))
        } else {
          setMapTargetBounds(null)
        }
      })
      .catch((err: any) => {
        if (!isSubscribed) return
        console.error('Failed to load project GIS:', err)
        setGisError('Could not load detailed spatial data for this project.')
        setLoadingGIS(false)
      })

    return () => { isSubscribed = false }
  }, [selectedProjectId])

  // Filtered parcels based on selected village and status filter
  const activeParcels = useMemo(() => {
    let list = projectGIS?.parcels?.features || []
    if (selectedVillage) {
      list = list.filter((f: any) => f.properties?.village === selectedVillage)
    }
    if (statusFilter !== 'ALL') {
      list = list.filter((f: any) => {
        const st = f.properties?.status_color || (f.properties?.has_legal_dispute ? 'RED' : 'ORANGE')
        return st === statusFilter
      })
    }
    return list
  }, [projectGIS, selectedVillage, statusFilter])

  // Reset view back to full project bounds
  const handleResetView = () => {
    setSelectedVillage(null)
    setSelectedParcel(null)
    setStatusFilter('ALL')

    const boundsList: [number, number][] = []
    const features = projectGIS?.parcels?.features || []
    features.forEach((f: any) => {
      if (f.geometry?.type === 'Polygon' && f.geometry.coordinates?.[0]) {
        f.geometry.coordinates[0].forEach(([lng, lat]: [number, number]) => boundsList.push([lat, lng]))
      }
    })
    if (boundsList.length > 0) {
      setMapTargetBounds(L.latLngBounds(boundsList))
    }
  }

  // Focus on a village
  const handleSelectVillage = (villageName: string | null) => {
    setSelectedVillage(villageName)
    setSelectedParcel(null)

    if (!villageName) {
      handleResetView()
      return
    }

    const villageFeatures = (projectGIS?.parcels?.features || []).filter(
      (f: any) => f.properties?.village === villageName
    )
    const vBounds: [number, number][] = []
    villageFeatures.forEach((f: any) => {
      if (f.geometry?.type === 'Polygon' && f.geometry.coordinates?.[0]) {
        f.geometry.coordinates[0].forEach(([lng, lat]: [number, number]) => vBounds.push([lat, lng]))
      } else if (f.properties?.centroid) {
        const [lng, lat] = f.properties.centroid
        vBounds.push([lat, lng])
      }
    })
    if (vBounds.length > 0) {
      setMapTargetBounds(L.latLngBounds(vBounds))
    }
  }

  // Handle parcel selection on click
  const handleSelectParcel = (parcelProps: any) => {
    setSelectedParcel(parcelProps)
  }

  // Current project summary info
  const currentProject = projectGIS?.project
  const summary = projectGIS?.summary || {}
  const totalProjectParcels = projectGIS?.parcels?.features?.length || 0
  const hasSpatialData = projectGIS?.has_spatial_data === true && (totalProjectParcels > 0 || projectGIS?.alignment || projectGIS?.acquisition_boundary)

  // GeoJSON styling for parcels
  const getParcelStyle = useCallback(
    (feature: any) => {
      const p = feature?.properties || {}
      const stColor: 'GREEN' | 'ORANGE' | 'RED' = p.status_color || (p.has_legal_dispute ? 'RED' : 'ORANGE')
      const cfg = STATUS_COLORS[stColor] || STATUS_COLORS.ORANGE
      const isSelected = selectedParcel?.id === p.id

      return {
        color: isSelected ? '#1e40af' : cfg.stroke,
        fillColor: cfg.fill,
        fillOpacity: isSelected ? 0.85 : 0.55,
        weight: isSelected ? 3.5 : 2,
        dashArray: isSelected ? '4 3' : undefined,
      }
    },
    [selectedParcel]
  )

  // Leaflet Parcel feature binder
  const onEachParcel = useCallback(
    (feature: any, layer: any) => {
      const p = feature?.properties
      if (!p) return

      const stColor: 'GREEN' | 'ORANGE' | 'RED' = p.status_color || (p.has_legal_dispute ? 'RED' : 'ORANGE')
      const cfg = STATUS_COLORS[stColor] || STATUS_COLORS.ORANGE

      const popupContent = `
        <div style="min-width:240px;font-family:Inter,sans-serif;font-size:0.8rem;color:#0f172a;line-height:1.5;padding:2px;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid #e2e8f0;margin-bottom:8px;">
            <strong style="font-size:0.95rem;color:#0f172a;">Khasra ${p.parcel_no || p.khasra_number || 'N/A'}</strong>
            <span style="padding:2px 8px;border-radius:10px;font-size:0.68rem;font-weight:700;background:${cfg.bg};color:${cfg.text};">${cfg.label}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;font-size:0.75rem;">
            <div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Village:</span> <strong>${p.village || 'N/A'}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Ownership:</span> <strong>${p.ownership_status || 'N/A'}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Compensation:</span> <strong>${p.compensation_status || 'N/A'}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Legal Status:</span> <strong style="color:${stColor === 'RED' ? '#dc2626' : '#0f172a'};">${p.legal_status || 'N/A'}</strong></div>
            <div style="display:flex;justify-content:space-between;border-top:1px dashed #e2e8f0;padding-top:4px;margin-top:2px;">
              <span style="color:#64748b;">Pending:</span> <strong style="color:${p.days_pending > 60 ? '#ea580c' : '#15803d'};">${p.days_pending || 0} days</strong>
            </div>
          </div>
        </div>
      `

      layer.bindPopup(popupContent, { maxWidth: 320, minWidth: 240 })

      layer.on('click', () => {
        handleSelectParcel(p)
      })

      layer.on('mouseover', () => {
        layer.setStyle({ weight: 3.5, fillOpacity: 0.8 })
      })
      layer.on('mouseout', () => {
        layer.setStyle(getParcelStyle(feature))
      })
    },
    [getParcelStyle]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      {/* ── 1. Top Bar: Clean Controls ─────────────────────────────────────────── */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          border: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-card)',
        }}
      >
        {/* Row 1: Title & Map Layer Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Detailed Map View
            </h3>
            <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
              Click any land parcel on the map to inspect its ownership, compensation, and legal status.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Street / Satellite Tile Switcher */}
            <div
              style={{
                display: 'flex',
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 8,
                padding: 2,
                gap: 2,
              }}
            >
              {(['OSM', 'SATELLITE'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setTileKey(k)}
                  style={{
                    padding: '4px 12px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: tileKey === k ? 'var(--color-accent-primary)' : 'transparent',
                    color: tileKey === k ? '#ffffff' : 'var(--color-text-muted)',
                  }}
                >
                  {k === 'OSM' ? 'Street' : 'Satellite'}
                </button>
              ))}
            </div>

            {/* Reset View Button */}
            <button
              onClick={handleResetView}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                borderRadius: 8,
                fontSize: '0.74rem',
                fontWeight: 600,
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
              }}
              title="Reset map view to whole project"
            >
              <RotateCcw size={13} /> Reset View
            </button>
          </div>
        </div>

        {/* Row 2: Clean Project Selector & Status Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderTop: '1px solid var(--color-border-subtle)', paddingTop: 10 }}>
          {/* Project Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 280, flex: '1 1 300px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Project:
            </span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="input"
              style={{ height: 36, fontSize: '0.78rem', fontWeight: 600, flex: 1 }}
            >
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_code} — {p.name} ({p.risk_level})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Parcel Status Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Filter Parcels:</span>
            {[
              { id: 'ALL', label: `All (${summary.total_parcels || 0})`, color: 'var(--color-accent-primary)' },
              { id: 'RED', label: `Blocked (${summary.disputed_count || 0})`, color: '#ef4444' },
              { id: 'ORANGE', label: `Attention (${summary.attention_count || 0})`, color: '#f97316' },
              { id: 'GREEN', label: `Clear (${summary.clear_count || 0})`, color: '#22c55e' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setStatusFilter(t.id as any)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: '0.72rem',
                  fontWeight: statusFilter === t.id ? 700 : 500,
                  border: statusFilter === t.id ? `1px solid ${t.color}` : '1px solid var(--color-border-subtle)',
                  background: statusFilter === t.id ? `${t.color}20` : 'var(--color-bg-primary)',
                  color: statusFilter === t.id ? t.color : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. Main Spatial View: Map (Left) + Detail Inspector (Right) ─────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gap: 14,
          alignItems: 'stretch',
        }}
      >
        {/* Left: Map Container */}
        <div
          className="card"
          style={{
            padding: 0,
            overflow: 'hidden',
            height: 'calc(100vh - 240px)',
            minHeight: 620,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {loadingGIS ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  border: '3px solid var(--color-border-subtle)',
                  borderTopColor: 'var(--color-accent-primary)',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Loading map spatial data…
              </div>
            </div>
          ) : !hasSpatialData ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 14,
                padding: 30,
                textAlign: 'center',
              }}
            >
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(234,179,8,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                <Info size={26} />
              </div>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
                  Detailed GIS data not available.
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', maxWidth: 360, margin: '0 auto', lineHeight: 1.4 }}>
                  PostGIS parcel boundaries have not yet been linked for <strong>{currentProject?.name || 'this project'}</strong>.
                </p>
              </div>
            </div>
          ) : (
            <>
              <MapContainer
                center={
                  currentProject?.latitude && currentProject?.longitude
                    ? [currentProject.latitude, currentProject.longitude]
                    : [17.32, 78.6]
                }
                zoom={13}
                style={{ width: '100%', height: '100%' }}
              >
                <MapBoundsController bounds={mapTargetBounds} />
                <TileLayer key={tileKey} attribution={MAP_TILES[tileKey].attribution} url={MAP_TILES[tileKey].url} />

                {/* 1. Project Alignment Route */}
                {projectGIS?.alignment && (
                  <GeoJSON
                    key={`alignment-${selectedProjectId}`}
                    data={projectGIS.alignment}
                    style={{
                      color: '#2563eb',
                      weight: 5,
                      opacity: 0.9,
                    }}
                    onEachFeature={(_feat, layer) => {
                      layer.bindPopup(
                        `<div style="font-family:Inter,sans-serif;font-size:0.75rem;"><strong>${currentProject?.name}</strong><br/><span style="color:#64748b;">Project Alignment Route</span></div>`
                      )
                    }}
                  />
                )}

                {/* 2. Acquisition Statutory Boundary */}
                {projectGIS?.acquisition_boundary && (
                  <GeoJSON
                    key={`boundary-${selectedProjectId}`}
                    data={projectGIS.acquisition_boundary}
                    style={{
                      color: '#7c3aed',
                      weight: 2,
                      dashArray: '6 6',
                      fillColor: '#8b5cf6',
                      fillOpacity: 0.08,
                    }}
                    onEachFeature={(_feat, layer) => {
                      layer.bindPopup(
                        `<div style="font-family:Inter,sans-serif;font-size:0.75rem;"><strong>Acquisition Boundary</strong><br/><span style="color:#64748b;">Statutory RoW Limit</span></div>`
                      )
                    }}
                  />
                )}

                {/* 3. Land Parcels GeoJSON Layer */}
                {activeParcels.length > 0 && (
                  <GeoJSON
                    key={`parcels-${selectedProjectId}-${selectedVillage || 'all'}-${statusFilter}`}
                    data={{ type: 'FeatureCollection', features: activeParcels } as any}
                    style={getParcelStyle}
                    onEachFeature={onEachParcel}
                  />
                )}

                {/* 4. Hotspot Beacon Markers */}
                {activeParcels
                  .filter((f: any) => f.properties?.is_hotspot || f.properties?.status_color === 'RED')
                  .map((f: any) => {
                    const centroid = f.properties?.centroid
                    if (!centroid) return null
                    const [lng, lat] = centroid
                    const color = f.properties?.status_color === 'RED' ? '#dc2626' : '#ea580c'
                    const cfg = STATUS_COLORS[f.properties?.status_color as 'RED' | 'ORANGE'] || STATUS_COLORS.ORANGE

                    return (
                      <Marker
                        key={`hotspot-beacon-${f.id}`}
                        position={[lat, lng]}
                        icon={createHotspotBeaconIcon(color)}
                        eventHandlers={{
                          click: () => handleSelectParcel(f.properties),
                        }}
                      >
                        <Popup>
                          <div style={{ minWidth: 220, fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: '#0f172a', padding: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
                              <strong style={{ fontSize: '0.9rem' }}>Khasra {f.properties.parcel_no}</strong>
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: 8, background: cfg.bg, color: cfg.text }}>
                                {cfg.label}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Village: <strong>{f.properties.village}</strong></div>
                            <div style={{ fontSize: '0.74rem', color: '#334155', marginTop: 3 }}>{f.properties.legal_status}</div>
                            <div style={{ fontSize: '0.74rem', color: f.properties.days_pending > 60 ? '#ea580c' : '#16a34a', fontWeight: 700, marginTop: 4 }}>
                              Pending: {f.properties.days_pending} days
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    )
                  })}
              </MapContainer>

              {/* In-Map Clean Legend */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  zIndex: 999,
                  background: 'rgba(255,255,255,0.96)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 10,
                  padding: '8px 12px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  fontSize: '0.7rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  maxWidth: 240,
                }}
              >
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Acquisition Status
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 11, height: 11, borderRadius: 2, background: STATUS_COLORS.GREEN.fill, border: `1px solid ${STATUS_COLORS.GREEN.stroke}` }} />
                  <span style={{ fontWeight: 600, color: '#166534' }}>Green = Clear</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 11, height: 11, borderRadius: 2, background: STATUS_COLORS.ORANGE.fill, border: `1px solid ${STATUS_COLORS.ORANGE.stroke}` }} />
                  <span style={{ fontWeight: 600, color: '#9a3412' }}>Orange = Attention</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 11, height: 11, borderRadius: 2, background: STATUS_COLORS.RED.fill, border: `1px solid ${STATUS_COLORS.RED.stroke}` }} />
                  <span style={{ fontWeight: 600, color: '#991b1b' }}>Red = Disputed / Blocked</span>
                </div>
                {projectGIS?.alignment && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 3, borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ width: 14, height: 3, background: '#2563eb', borderRadius: 2 }} />
                    <span style={{ color: '#1e40af', fontWeight: 600 }}>Route Alignment</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: Clean Inspector Column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 240px)',
          }}
        >
          {/* Active Parcel Details Card (When parcel is clicked) */}
          {selectedParcel ? (
            <div
              className="card"
              style={{
                padding: '14px 16px',
                border: `1.5px solid ${selectedParcel.status_color === 'RED' ? '#f87171' : selectedParcel.status_color === 'ORANGE' ? '#fb923c' : '#86efac'}`,
                background: selectedParcel.status_color === 'RED' ? 'rgba(254,242,242,0.6)' : selectedParcel.status_color === 'ORANGE' ? 'rgba(255,247,237,0.6)' : 'rgba(240,253,244,0.6)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                    Selected Parcel
                  </div>
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                    Khasra {selectedParcel.parcel_no || selectedParcel.khasra_number}
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedParcel(null)}
                  style={{
                    background: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 6,
                    padding: '3px 8px',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <X size={12} /> Deselect
                </button>
              </div>

              {/* Status Badge */}
              <div style={{ marginBottom: 10 }}>
                {selectedParcel.status_color === 'RED' ? (
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}>
                    🔴 Disputed / Blocked
                  </span>
                ) : selectedParcel.status_color === 'ORANGE' ? (
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: 8, background: '#ffedd5', color: '#ea580c', border: '1px solid #fed7aa' }}>
                    🟠 Attention Required
                  </span>
                ) : (
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: 8, background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                    🟢 Clear / Acquired
                  </span>
                )}
              </div>

              {/* Key Details List */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  fontSize: '0.76rem',
                  background: 'var(--color-bg-card)',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Village:</span>
                  <strong>{selectedParcel.village} ({selectedParcel.tehsil || 'Tehsil'})</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Area:</span>
                  <strong>{selectedParcel.area_ha ? `${selectedParcel.area_ha} ha` : 'N/A'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>Ownership:</span>
                  <strong style={{ textAlign: 'right' }}>{selectedParcel.ownership_status}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>Compensation:</span>
                  <strong style={{ textAlign: 'right' }}>{selectedParcel.compensation_status}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>Legal Status:</span>
                  <strong style={{ textAlign: 'right', color: selectedParcel.status_color === 'RED' ? '#dc2626' : 'var(--color-text-primary)' }}>
                    {selectedParcel.legal_status}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 5, borderTop: '1px dashed var(--color-border-subtle)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Days Pending:</span>
                  <strong style={{ color: selectedParcel.days_pending > 60 ? '#dc2626' : '#16a34a', fontWeight: 800 }}>
                    {selectedParcel.days_pending || 0} Days
                  </strong>
                </div>
              </div>

              {/* Action / Blocker Note */}
              <div
                style={{
                  marginTop: 10,
                  padding: '8px 10px',
                  borderRadius: 6,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  background: selectedParcel.status_color === 'RED' ? '#fee2e2' : selectedParcel.status_color === 'ORANGE' ? '#ffedd5' : '#dcfce7',
                  color: selectedParcel.status_color === 'RED' ? '#991b1b' : selectedParcel.status_color === 'ORANGE' ? '#9a3412' : '#166534',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 6,
                }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  {selectedParcel.status_color === 'RED'
                    ? 'Court Stay active. Legal resolution required before possession.'
                    : selectedParcel.status_color === 'ORANGE'
                    ? 'Compensation inquiry pending. Follow up with CALA treasury.'
                    : 'Land acquired & verified. No active blockers.'}
                </span>
              </div>
            </div>
          ) : (
            /* Friendly Tip when no parcel is selected */
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                background: 'rgba(37,99,235,0.06)',
                border: '1px dashed rgba(37,99,235,0.25)',
                color: 'var(--color-text-muted)',
                fontSize: '0.74rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Info size={16} color="var(--color-accent-primary)" style={{ flexShrink: 0 }} />
              <span>Click any colored parcel on the map to inspect its ownership and delay reasons.</span>
            </div>
          )}

          {/* Project Summary Card */}
          {currentProject && (
            <div
              className="card"
              style={{
                padding: '14px 16px',
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-bg-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <code style={{ fontSize: '0.68rem', color: '#1d4ed8', fontWeight: 800, background: '#eff6ff', padding: '2px 6px', borderRadius: 4 }}>
                  {currentProject.project_code}
                </code>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: currentProject.risk_level === 'CRITICAL' ? '#fef2f2' : currentProject.risk_level === 'HIGH' ? '#fff7ed' : '#f0fdf4',
                    color: currentProject.risk_level === 'CRITICAL' ? '#dc2626' : currentProject.risk_level === 'HIGH' ? '#ea580c' : '#16a34a',
                    border: `1px solid ${currentProject.risk_level === 'CRITICAL' ? '#fca5a5' : '#fed7aa'}`,
                  }}
                >
                  {currentProject.risk_level} RISK
                </span>
              </div>

              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 4px', lineHeight: 1.3 }}>
                {currentProject.name}
              </h4>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: 10 }}>
                {currentProject.state_code} • {currentProject.district}
              </div>

              {/* 4 Stat Counters */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
                <div style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 6, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>{summary.total_parcels || 0}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>Total</div>
                </div>
                <div style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#dc2626' }}>{summary.disputed_count || 0}</div>
                  <div style={{ fontSize: '0.6rem', color: '#991b1b' }}>Blocked</div>
                </div>
                <div style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 6, background: '#fff7ed', border: '1px solid #fed7aa' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ea580c' }}>{summary.attention_count || 0}</div>
                  <div style={{ fontSize: '0.6rem', color: '#9a3412' }}>Attention</div>
                </div>
                <div style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#16a34a' }}>{summary.clear_count || 0}</div>
                  <div style={{ fontSize: '0.6rem', color: '#166534' }}>Clear</div>
                </div>
              </div>

              <Link
                to={`/projects/${currentProject.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '7px 12px',
                  background: 'var(--color-accent-primary)',
                  color: '#ffffff',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  borderRadius: 7,
                  textDecoration: 'none',
                }}
              >
                View Project Details <ExternalLink size={12} />
              </Link>
            </div>
          )}

          {/* Affected Villages Card */}
          <div
            className="card"
            style={{
              padding: '14px 16px',
              border: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={13} color="var(--color-accent-primary)" />
                <h5 style={{ fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', margin: 0 }}>
                  Villages ({projectGIS?.villages?.length || 0})
                </h5>
              </div>
              {selectedVillage && (
                <button
                  onClick={() => handleSelectVillage(null)}
                  style={{
                    fontSize: '0.68rem',
                    color: 'var(--color-accent-primary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  Show All
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {(projectGIS?.villages || []).map((v: any) => {
                const isSelected = selectedVillage === v.name
                return (
                  <div
                    key={v.name}
                    onClick={() => handleSelectVillage(isSelected ? null : v.name)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: `1px solid ${isSelected ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'}`,
                      background: isSelected ? 'rgba(37,99,235,0.08)' : 'var(--color-bg-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.74rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{v.name}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {v.disputed_parcels > 0 && (
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: '#fee2e2', color: '#dc2626' }}>
                          {v.disputed_parcels} Disputed
                        </span>
                      )}
                      {v.attention_parcels > 0 && (
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: '#ffedd5', color: '#ea580c' }}>
                          {v.attention_parcels} Attention
                        </span>
                      )}
                      {v.clear_parcels > 0 && (
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: '#dcfce7', color: '#16a34a' }}>
                          {v.clear_parcels} Clear
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseHotspot {
          0% { transform: scale(0.6); opacity: 0.8; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
