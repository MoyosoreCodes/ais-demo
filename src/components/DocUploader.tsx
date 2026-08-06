import { useState } from 'react'
import { SimChip } from './SimChip'
import { StatusBadge } from './StatusBadge'
import { formatDate, localId } from '../lib/format'
import { DEMO_TODAY } from '../lib/format'
import type { DocRef } from '../lib/types'

/**
 * Document upload (iii.4, iv.4, v.2) — SIMULATED.
 *
 * No file is read or stored: the control records a document *reference* with a
 * verification status so the workflow around uploads is demonstrable. The
 * "simulated" chip is always visible, per CLAUDE.md §2.
 */

const CATEGORY_SUGGESTIONS = [
  'Identity',
  'Tenure evidence',
  'Site plan',
  'Business plan',
  'Financial',
  'Assessment',
  'Other',
]

export function DocUploader({
  documents,
  onAdd,
  onRemove,
  categories = CATEGORY_SUGGESTIONS,
  uploadedBy,
  readOnly = false,
  label = 'Supporting documents',
  hint = 'Attach tenure evidence, identity documents and any site plans.',
}: {
  documents: DocRef[]
  onAdd?: (doc: DocRef) => void
  onRemove?: (id: string) => void
  categories?: string[]
  uploadedBy: string
  readOnly?: boolean
  label?: string
  hint?: string
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState(categories[0])

  const add = () => {
    const trimmed = name.trim()
    if (!trimmed || !onAdd) return
    onAdd({
      id: localId('DOCREF'),
      name: trimmed.includes('.') ? trimmed : `${trimmed}.pdf`,
      category,
      // A plausible size so the record looks like a real attachment row.
      sizeKb: 120 + ((trimmed.length * 37) % 1600),
      uploadedOn: DEMO_TODAY.toISOString().slice(0, 10),
      uploadedBy,
      verification: 'pending',
      simulated: true,
    })
    setName('')
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-ink-700">{label}</p>
        <SimChip label="upload simulated" />
      </div>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}

      {!readOnly && (
        <div className="mt-2 rounded-lg border border-dashed border-ink-300 bg-ink-50 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr,auto,auto]">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  add()
                }
              }}
              placeholder="Document name, e.g. Lease agreement"
              aria-label="Document name"
              className="ais-input mt-0"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Document category"
              className="ais-input mt-0 sm:w-44"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button type="button" className="ais-btn-secondary" onClick={add} disabled={!name.trim()}>
              Attach
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            No file is transferred or stored. The prototype records the document reference and its
            verification status so the review workflow can be demonstrated end to end.
          </p>
        </div>
      )}

      {documents.length > 0 && (
        <ul className="mt-3 space-y-2">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
                <path d="M14 3v5h5" />
              </svg>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">{d.name}</span>
              <span className="text-xs text-ink-500">{d.category}</span>
              <span className="text-xs text-ink-400">{d.sizeKb} KB</span>
              <span className="text-xs text-ink-400">{formatDate(d.uploadedOn)}</span>
              <StatusBadge status={d.verification} />
              {!readOnly && onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(d.id)}
                  className="rounded p-1 text-ink-400 hover:bg-danger-50 hover:text-danger-600"
                  aria-label={`Remove ${d.name}`}
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
