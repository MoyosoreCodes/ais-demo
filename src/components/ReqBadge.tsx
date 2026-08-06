import { useEffect } from 'react'
import { useRefsMode } from '../app/RefsContext'
import { REQUIREMENT_BY_REF } from '../lib/refs'

/**
 * Requirement annotation badge (CLAUDE.md §7.5).
 *
 * Renders only in `?refs=1` mode, but registers unconditionally so the
 * coverage view can report which Appendix A6 rows the built app annotates.
 *
 *   <ReqBadge refs="iii.2" screen="S03" />
 *   <ReqBadge refs={['ii.5', 'ii.6']} screen="S02" />
 */
export function ReqBadge({
  refs,
  screen,
  className = '',
}: {
  refs: string | string[]
  screen?: string
  className?: string
}) {
  const { enabled, register } = useRefsMode()
  const list = Array.isArray(refs) ? refs : [refs]
  const key = list.join(',')

  useEffect(() => {
    register(key.split(','), screen)
  }, [key, screen, register])

  if (!enabled) return null

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 align-middle ${className}`}>
      {list.map((ref) => {
        const row = REQUIREMENT_BY_REF[ref]
        return (
          <span
            key={ref}
            title={row ? `${ref}${row.exceeds ? ' ★' : ''} — ${row.requirement}` : ref}
            className="inline-flex items-center gap-0.5 rounded border border-brand-300 bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none text-brand-700"
          >
            {ref}
            {row?.exceeds && <span className="text-warn-600">★</span>}
          </span>
        )
      })}
    </span>
  )
}
