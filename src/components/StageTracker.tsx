import { formatDate } from '../lib/format'
import { ROLE_LABELS } from '../lib/types'
import type { StageInstance } from '../lib/types'

const DOT: Record<StageInstance['status'], string> = {
  approved: 'bg-brand-600 text-white',
  rejected: 'bg-danger-500 text-white',
  'in-progress': 'bg-white text-brand-700 ring-2 ring-brand-600',
  pending: 'bg-white text-ink-400 ring-1 ring-ink-300',
  skipped: 'bg-ink-200 text-ink-500',
}

const GLYPH: Record<StageInstance['status'], string> = {
  approved: '✓',
  rejected: '✕',
  'in-progress': '●',
  pending: '',
  skipped: '–',
}

/**
 * End-to-end status tracker for a running workflow instance (v.4, xi.2, iv.2).
 * Horizontal on wide screens, vertical below `sm` so it stays legible at 390 px.
 */
export function StageTracker({
  stages,
  actorNames = {},
  compact = false,
}: {
  stages: StageInstance[]
  /** userId → display name, so decisions can be attributed. */
  actorNames?: Record<string, string>
  compact?: boolean
}) {
  if (!stages.length) return null

  return (
    <ol className={`flex flex-col gap-3 ${compact ? '' : 'sm:flex-row sm:gap-0'}`}>
      {stages.map((s, i) => (
        <li key={s.stageId} className={`flex gap-3 ${compact ? '' : 'sm:flex-1 sm:flex-col sm:gap-2'}`}>
          <div className={`flex shrink-0 flex-col items-center ${compact ? '' : 'sm:w-full sm:flex-row'}`}>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${DOT[s.status]}`}
              aria-hidden
            >
              {GLYPH[s.status] || i + 1}
            </span>
            {i < stages.length - 1 && (
              <span
                className={`${compact ? 'w-px flex-1' : 'w-px flex-1 sm:h-px sm:w-full sm:flex-1'} ${
                  s.status === 'approved' ? 'bg-brand-400' : 'bg-ink-200'
                }`}
                aria-hidden
              />
            )}
          </div>

          <div className={`min-w-0 pb-1 ${compact ? '' : 'sm:pr-4'}`}>
            <p className="text-sm font-semibold text-ink-900">{s.name}</p>
            <p className="text-xs text-ink-500">{ROLE_LABELS[s.actorRole]}</p>
            <p
              className={`mt-0.5 text-xs font-medium ${
                s.status === 'approved'
                  ? 'text-brand-700'
                  : s.status === 'rejected'
                    ? 'text-danger-700'
                    : s.status === 'in-progress'
                      ? 'text-brand-700'
                      : 'text-ink-400'
              }`}
            >
              {s.status === 'approved' && `Approved ${formatDate(s.decidedOn)}`}
              {s.status === 'rejected' && `Rejected ${formatDate(s.decidedOn)}`}
              {s.status === 'in-progress' && 'Awaiting decision'}
              {s.status === 'pending' && 'Not started'}
              {s.status === 'skipped' && 'Not reached'}
            </p>
            {s.decidedByUserId && (
              <p className="text-xs text-ink-500">{actorNames[s.decidedByUserId] ?? s.decidedByUserId}</p>
            )}
            {s.comment && <p className="mt-1 text-xs italic text-ink-600">“{s.comment}”</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
