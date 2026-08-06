import { SIMULATED_LABEL } from '../lib/sim'

/**
 * The single visual marker for a simulated integration (CLAUDE.md §2, §10).
 * Every SeyID, SMS, email, payment, photo-capture and offline-sync control in
 * the app renders one of these, so an evaluator can always tell what is staged.
 */
export function SimChip({
  label = SIMULATED_LABEL,
  title = 'This integration is simulated in the demonstration prototype — no external service is contacted.',
  className = '',
}: {
  label?: string
  title?: string
  className?: string
}) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-warn-200 bg-warn-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warn-700 ${className}`}
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor" aria-hidden>
        <circle cx="6" cy="6" r="5" fillOpacity="0.35" />
        <circle cx="6" cy="6" r="2" />
      </svg>
      {label}
    </span>
  )
}
