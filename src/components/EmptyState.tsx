import type { ReactNode } from 'react'

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <svg viewBox="0 0 48 48" className="h-10 w-10 text-ink-300" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="8" y="10" width="32" height="28" rx="3" />
        <path d="M8 18h32M16 26h16M16 32h10" strokeLinecap="round" />
      </svg>
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {body && <p className="max-w-sm text-sm text-ink-500">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
