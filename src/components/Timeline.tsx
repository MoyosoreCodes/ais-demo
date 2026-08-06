import { formatDateTime } from '../lib/format'
import type { ChangeEvent } from '../lib/types'

/**
 * Change-history timeline (ii.4, iv.8, v.5, x.5).
 * Entries are rendered newest-first and are never editable — the underlying
 * arrays are append-only.
 */
export function Timeline({
  events,
  emptyLabel = 'No changes recorded yet.',
}: {
  events: ChangeEvent[]
  emptyLabel?: string
}) {
  if (!events.length) {
    return <p className="py-3 text-sm text-ink-500">{emptyLabel}</p>
  }

  const ordered = [...events].sort((a, b) => (a.at < b.at ? 1 : -1))

  return (
    <ol className="relative space-y-4 border-l border-ink-200 pl-5">
      {ordered.map((e) => (
        <li key={e.id} className="relative">
          <span
            className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500"
            aria-hidden
          />
          <p className="text-sm font-medium text-ink-900">{e.action}</p>
          {(e.field || e.to) && (
            <p className="mt-0.5 text-sm text-ink-600">
              {e.field && <span className="font-mono text-xs text-ink-500">{e.field}: </span>}
              {e.from && (
                <>
                  <span className="line-through decoration-danger-400">{e.from}</span>
                  <span className="mx-1 text-ink-400" aria-label="changed to">→</span>
                </>
              )}
              {e.to && <span className="font-medium text-ink-800">{e.to}</span>}
            </p>
          )}
          {e.note && <p className="mt-0.5 text-sm italic text-ink-600">{e.note}</p>}
          <p className="mt-0.5 text-xs text-ink-500">
            {formatDateTime(e.at)} · {e.actorName}
          </p>
        </li>
      ))}
    </ol>
  )
}
