import { useState } from 'react'
import { SimChip } from './SimChip'
import { DEMO_TODAY, formatDate, localId } from '../lib/format'
import { placeholderImage } from '../lib/sim'
import type { PhotoRef } from '../lib/types'

/**
 * Inspection photo capture (x.4) — SIMULATED.
 *
 * No camera is opened and no file is read. Each "photo" is a deterministic
 * generated placeholder so the capture, review and sync flow is demonstrable
 * without shipping images of real holdings. The chip says so on screen.
 */

const SWATCHES = ['a1', 'a3', 'b2', 'b4', 'c1', 'c3', 'd2', 'd4']

const SUGGESTED_CAPTIONS = [
  'General view of the holding',
  'Crop stand detail',
  'Boundary and access',
  'Livestock housing',
  'Irrigation infrastructure',
  'Storage and chemical store',
  'Non-compliance observed',
]

export function PhotoCapture({
  photos,
  onAdd,
  onRemove,
  readOnly = false,
  label = 'Inspection photographs',
}: {
  photos: PhotoRef[]
  onAdd?: (photo: PhotoRef) => void
  onRemove?: (id: string) => void
  readOnly?: boolean
  label?: string
}) {
  const [caption, setCaption] = useState(SUGGESTED_CAPTIONS[0])
  const [preview, setPreview] = useState<PhotoRef | null>(null)

  const capture = () => {
    if (!onAdd) return
    onAdd({
      id: localId('PH'),
      caption,
      takenOn: DEMO_TODAY.toISOString().slice(0, 10),
      swatch: SWATCHES[photos.length % SWATCHES.length],
      simulated: true,
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-ink-700">{label}</p>
        <SimChip label="camera simulated" />
      </div>

      {!readOnly && (
        <div className="mt-2 rounded-lg border border-dashed border-ink-300 bg-ink-50 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr,auto]">
            <select
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              aria-label="Photograph caption"
              className="ais-input mt-0"
            >
              {SUGGESTED_CAPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button type="button" className="ais-btn-secondary" onClick={capture}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M3 8h3l2-3h8l2 3h3v11H3z" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              Take photograph
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            On a real device this opens the camera. Here each capture produces a
            generated placeholder image, so no photograph of a real holding is ever
            stored in the demonstration build.
          </p>
        </div>
      )}

      {photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="group relative">
              <button
                type="button"
                onClick={() => setPreview(p)}
                className="block w-full overflow-hidden rounded-lg border border-ink-200 bg-white text-left hover:border-brand-400"
              >
                <img
                  src={placeholderImage(p.swatch, p.caption, 300, 220)}
                  alt={`${p.caption} — generated placeholder`}
                  className="h-28 w-full object-cover"
                />
                <span className="block px-2 py-1.5">
                  <span className="block truncate text-xs font-medium text-ink-800">{p.caption}</span>
                  <span className="block text-[11px] text-ink-500">{formatDate(p.takenOn)}</span>
                </span>
              </button>
              {!readOnly && onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  aria-label={`Remove ${p.caption}`}
                  className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-ink-500 shadow hover:bg-danger-50 hover:text-danger-600"
                >
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-ink-900/60 p-4">
          <button
            type="button"
            aria-label="Close photograph"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setPreview(null)}
            tabIndex={-1}
          />
          <div className="relative max-h-full max-w-lg overflow-y-auto rounded-lg bg-white p-3 shadow-xl">
            <img
              src={placeholderImage(preview.swatch, preview.caption, 520, 380)}
              alt={`${preview.caption} — generated placeholder`}
              className="w-full rounded"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink-900">{preview.caption}</p>
                <p className="text-xs text-ink-500">Taken {formatDate(preview.takenOn)}</p>
              </div>
              <SimChip label="generated placeholder" />
            </div>
            <button type="button" className="ais-btn-secondary mt-3 w-full" onClick={() => setPreview(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
