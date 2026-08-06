import type { ReactNode } from 'react'
import { ReqBadge } from './ReqBadge'

export function PageHeader({
  screen,
  title,
  description,
  refs,
  actions,
  children,
}: {
  /** Screen code, e.g. "S02" — shown as a chip and used for refs coverage. */
  screen?: string
  title: string
  description?: string
  refs?: string[]
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {screen && (
              <span className="rounded border border-ink-300 bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink-600">
                {screen}
              </span>
            )}
            <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">{title}</h1>
            {refs && <ReqBadge refs={refs} screen={screen} />}
          </div>
          {description && <p className="mt-1 max-w-3xl text-sm text-ink-600">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}
