import { useEffect, useMemo, useState } from 'react'
import * as L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { SimChip } from './SimChip'
import { formatCoords } from '../lib/format'
import { simulatedFix } from '../lib/sim'

/**
 * GIS map controls (iii.2, iv.3) — react-leaflet over OpenStreetMap tiles.
 *
 * OSM tile requests are the only network traffic the prototype makes
 * (CLAUDE.md §2). Device geolocation is simulated: see lib/sim.ts for why.
 */

export interface LatLng {
  lat: number
  lng: number
}

export interface MapMarker extends LatLng {
  id: string
  label: string
  detail?: string
  tone?: 'primary' | 'muted' | 'warning'
}

/* Leaflet's default marker images break under bundlers, and shipping the PNGs
   adds nothing here — a div icon keeps the pins on-brand and asset-free. */
const pinIcon = (tone: 'primary' | 'muted' | 'warning' | 'active'): L.DivIcon => {
  const fill = { primary: '#0F6B4F', muted: '#68716F', warning: '#C77700', active: '#0F6B4F' }[tone]
  const ring = tone === 'active' ? '<circle cx="14" cy="14" r="13" fill="#0F6B4F" opacity="0.18"/>' : ''
  return L.divIcon({
    className: 'ais-pin',
    html: `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">
      ${ring}
      <path d="M14 37s11-13.4 11-22A11 11 0 1 0 3 15c0 8.6 11 22 11 22z" fill="${fill}" stroke="#fff" stroke-width="2"/>
      <circle cx="14" cy="14.5" r="4.2" fill="#fff"/>
    </svg>`,
    iconSize: [28, 38],
    iconAnchor: [14, 37],
    popupAnchor: [0, -34],
  })
}

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/** Keeps the view in step when the pin is moved from outside the map. */
function Recenter({ center, zoom }: { center: LatLng; zoom?: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom ?? map.getZoom(), { animate: true })
  }, [center.lat, center.lng, zoom, map])
  return null
}

function ClickCapture({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: Number(e.latlng.lat.toFixed(5)), lng: Number(e.latlng.lng.toFixed(5)) })
    },
  })
  return null
}

export function MapPicker({
  value,
  onChange,
  markers = [],
  height = 320,
  zoom = 15,
  readOnly = false,
  /** Centroid used by the simulated "use my location" control. */
  locateNear,
  onLocated,
  helpText = 'Drag the pin, or tap the map, to set the exact holding location.',
}: {
  value: LatLng
  onChange?: (p: LatLng) => void
  markers?: MapMarker[]
  height?: number
  zoom?: number
  readOnly?: boolean
  locateNear?: LatLng
  onLocated?: (accuracyM: number) => void
  helpText?: string
}) {
  const [locating, setLocating] = useState(false)
  const [accuracy, setAccuracy] = useState<number | null>(null)

  const icons = useMemo(
    () => ({
      active: pinIcon('active'),
      primary: pinIcon('primary'),
      muted: pinIcon('muted'),
      warning: pinIcon('warning'),
    }),
    [],
  )

  const useMyLocation = async () => {
    if (!onChange) return
    setLocating(true)
    try {
      const fix = await simulatedFix(locateNear ?? value)
      onChange({ lat: fix.lat, lng: fix.lng })
      setAccuracy(fix.accuracyM)
      onLocated?.(fix.accuracyM)
    } finally {
      setLocating(false)
    }
  }

  return (
    <div>
      <div
        className="overflow-hidden rounded-lg border border-ink-300"
        style={{ height }}
      >
        <MapContainer
          center={[value.lat, value.lng]}
          zoom={zoom}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer url={OSM_URL} attribution={OSM_ATTRIBUTION} maxZoom={19} />
          <Recenter center={value} />
          {!readOnly && onChange && <ClickCapture onPick={onChange} />}

          {markers.map((m) => (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={icons[m.tone ?? 'muted']}>
              <Popup>
                <span className="text-sm font-semibold">{m.label}</span>
                {m.detail && <span className="mt-0.5 block text-xs text-ink-600">{m.detail}</span>}
                <span className="mt-1 block font-mono text-[11px] text-ink-500">
                  {formatCoords(m.lat, m.lng)}
                </span>
              </Popup>
            </Marker>
          ))}

          <Marker
            position={[value.lat, value.lng]}
            icon={icons.active}
            draggable={!readOnly && Boolean(onChange)}
            eventHandlers={
              onChange
                ? {
                    dragend: (e) => {
                      const p = (e.target as L.Marker).getLatLng()
                      onChange({ lat: Number(p.lat.toFixed(5)), lng: Number(p.lng.toFixed(5)) })
                    },
                  }
                : undefined
            }
          />
        </MapContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="rounded bg-ink-100 px-2 py-1 font-mono text-xs text-ink-700">
          {formatCoords(value.lat, value.lng)}
        </span>
        {accuracy !== null && (
          <span className="text-xs text-ink-500">±{accuracy} m accuracy</span>
        )}
        {!readOnly && onChange && (
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="ais-btn-secondary px-3 py-1.5 text-xs"
          >
            {locating ? (
              <>
                <Spinner /> Acquiring fix…
              </>
            ) : (
              <>
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="10" cy="10" r="5" />
                  <path d="M10 1v3M10 16v3M1 10h3M16 10h3" strokeLinecap="round" />
                </svg>
                Use my location
              </>
            )}
          </button>
        )}
        {!readOnly && onChange && <SimChip label="GPS simulated" />}
      </div>

      {!readOnly && helpText && <p className="mt-1.5 text-xs text-ink-500">{helpText}</p>}
    </div>
  )
}

function Spinner() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="10" cy="10" r="7" opacity="0.25" />
      <path d="M17 10a7 7 0 00-7-7" strokeLinecap="round" />
    </svg>
  )
}

/** Read-only multi-pin map used by registries and dashboards. */
export function MapView({
  markers,
  center,
  zoom = 11,
  height = 380,
}: {
  markers: MapMarker[]
  center?: LatLng
  zoom?: number
  height?: number
}) {
  const fallback: LatLng = { lat: -4.62, lng: 55.53 }
  const focus =
    center ??
    (markers.length
      ? {
          lat: markers.reduce((s, m) => s + m.lat, 0) / markers.length,
          lng: markers.reduce((s, m) => s + m.lng, 0) / markers.length,
        }
      : fallback)

  const icons = useMemo(
    () => ({ primary: pinIcon('primary'), muted: pinIcon('muted'), warning: pinIcon('warning') }),
    [],
  )

  return (
    <div className="overflow-hidden rounded-lg border border-ink-300" style={{ height }}>
      <MapContainer center={[focus.lat, focus.lng]} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer url={OSM_URL} attribution={OSM_ATTRIBUTION} maxZoom={19} />
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={icons[m.tone ?? 'primary']}>
            <Popup>
              <span className="text-sm font-semibold">{m.label}</span>
              {m.detail && <span className="mt-0.5 block text-xs text-ink-600">{m.detail}</span>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
