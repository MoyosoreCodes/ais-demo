import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ReqBadge } from '../../components/ReqBadge'

/** Public shell for the unauthenticated S01 screens. */
export function AuthShell({
  title,
  subtitle,
  refs,
  children,
  aside,
}: {
  title: string
  subtitle?: string
  refs?: string[]
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <img src="./crest.svg" alt="" className="h-9 w-9" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900 sm:text-base">
              Agriculture Information System
            </p>
            <p className="truncate text-[11px] text-ink-500 sm:text-xs">
              Republic of Seychelles · Department of Agriculture
            </p>
          </div>
          <span className="ml-auto rounded border border-warn-300 bg-warn-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-warn-700">
            Prototype — demonstration build
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr),380px]">
          <div className="mx-auto w-full max-w-lg lg:mx-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-ink-300 bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink-600">
                S01
              </span>
              <h1 className="text-2xl font-semibold text-ink-900">{title}</h1>
              {refs && <ReqBadge refs={refs} screen="S01" />}
            </div>
            {subtitle && <p className="mt-1.5 text-sm text-ink-600">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>

          {aside && <aside className="lg:pt-14">{aside}</aside>}
        </div>
      </main>

      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-4 text-xs text-ink-500 sm:px-6">
          <span className="rounded border border-danger-200 bg-danger-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-danger-700">
            Fictional demonstration data
          </span>
          <span>
            No real person, National Identification Number or telephone number appears in this
            prototype.
          </span>
          <Link to="/coverage" className="ais-link ml-auto">
            Traceability coverage
          </Link>
        </div>
      </footer>
    </div>
  )
}
