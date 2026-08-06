import type { ReactNode } from 'react'
import { ReqBadge } from './ReqBadge'

/** KPI tile used by the S05/S06/S04 mini-dashboards and later by S12. */
export function KpiCard({
  label,
  value,
  hint,
  refs,
  screen,
  tone = 'neutral',
  onClick,
  active = false,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  refs?: string[]
  screen?: string
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
  /** Supplying this turns the tile into a filter control. */
  onClick?: () => void
  active?: boolean
}) {
  const accent = {
    neutral: 'text-ink-900',
    good: 'text-brand-700',
    warn: 'text-warn-600',
    bad: 'text-danger-600',
  }[tone]

  const body = (
    <>
      <p className="inline-flex flex-wrap items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">
        {label}
        {refs && <ReqBadge refs={refs} screen={screen} />}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${accent}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </>
  )

  if (!onClick) return <div className="ais-card p-4">{body}</div>

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`ais-card p-4 text-left transition-colors ${
        active ? 'border-brand-500 bg-brand-50/60' : 'hover:border-brand-300 hover:bg-brand-50/30'
      }`}
    >
      {body}
    </button>
  )
}
