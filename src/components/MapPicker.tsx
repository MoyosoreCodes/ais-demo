import type { LatLngExpression, LeafletEvent } from 'leaflet';
import { useEffect } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';

import { simulateGps } from '../lib/sim';
import { brandHex, dangerHex } from '../lib/theme';
import { Icon } from './Icon';
import { SimBadge } from './ui';

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; OpenStreetMap contributors';

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(+e.latlng.lat.toFixed(5), +e.latlng.lng.toFixed(5)) });
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

export interface MapMarker {
  lat: number;
  lng: number;
  label?: string;
  tone?: 'primary' | 'danger';
}

export function MapPicker({
  lat,
  lng,
  onChange,
  height = 320,
  zoom = 13,
  others = [],
  simCenter,
  readOnly,
}: {
  lat: number;
  lng: number;
  onChange?: (lat: number, lng: number) => void;
  height?: number;
  zoom?: number;
  others?: MapMarker[];
  simCenter?: [number, number];
  readOnly?: boolean;
}) {
  const draggable = !readOnly && !!onChange;
  return (
    <div>
      <div className="overflow-hidden rounded-md border border-slate-200" style={{ height }}>
        <MapContainer center={[lat, lng] as LatLngExpression} zoom={zoom} scrollWheelZoom>
          <TileLayer url={OSM_URL} attribution={OSM_ATTR} />
          <Recenter lat={lat} lng={lng} />
          {draggable && onChange && <ClickCapture onPick={onChange} />}
          <Marker
            position={[lat, lng]}
            draggable={draggable}
            eventHandlers={
              onChange
                ? {
                    dragend: (e: LeafletEvent) => {
                      const p = e.target.getLatLng();
                      onChange(+p.lat.toFixed(5), +p.lng.toFixed(5));
                    },
                  }
                : undefined
            }
          />
          {others.map((m, i) => (
            <CircleMarker
              key={i}
              center={[m.lat, m.lng]}
              radius={7}
              pathOptions={{
                color: m.tone === 'danger' ? dangerHex() : brandHex(600),
                fillOpacity: 0.35,
              }}
            >
              {m.label && <Tooltip>{m.label}</Tooltip>}
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      {draggable && onChange && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <button
            type="button"
            className="btn-secondary px-2.5 py-1 text-xs"
            onClick={() => {
              const [la, ln] = simulateGps(simCenter ?? [lat, lng]);
              onChange(la, ln);
            }}
          >
            <Icon name="pin" size={14} /> Use my location
          </button>
          <SimBadge label="GPS simulated" />
          <span className="font-mono">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        </div>
      )}
    </div>
  );
}
