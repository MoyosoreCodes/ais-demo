import type { ReactNode } from 'react'

export interface TabItem {
  id: string
  label: string
  count?: number
  badge?: ReactNode
}

export function Tabs({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: TabItem[]
  active: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div className={`-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 ${className}`}>
      <div role="tablist" className="flex min-w-max gap-1 border-b border-ink-200">
        {tabs.map((t) => {
          const selected = t.id === active
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => onChange(t.id)}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-900'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {t.label}
                {t.count !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                      selected ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    {t.count}
                  </span>
                )}
                {t.badge}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
