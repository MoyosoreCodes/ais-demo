import { useMemo, useState } from 'react'
import { useRefsMode } from '../../app/RefsContext'
import { PageHeader } from '../../components/PageHeader'
import { StatusBadge } from '../../components/StatusBadge'
import { MODULES, REQUIREMENTS, compareRefs } from '../../lib/refs'

/**
 * Traceability coverage — supports annex TECH-8(6) and the CLAUDE.md §10
 * definition of done ("`?refs=1` badge mode covers every requirement row").
 *
 * "Annotated" means a `<ReqBadge>` for that row has actually rendered in this
 * browser session, so the figure reflects the built app rather than a list
 * someone maintained by hand.
 */
export function CoverageScreen() {
  const { seen, screensFor, enabled, setEnabled } = useRefsMode()
  const [moduleFilter, setModuleFilter] = useState('all')

  const seenSet = useMemo(() => new Set(seen), [seen])

  const rows = useMemo(
    () =>
      REQUIREMENTS.filter((r) => moduleFilter === 'all' || r.module === moduleFilter).sort((a, b) =>
        compareRefs(a.ref, b.ref),
      ),
    [moduleFilter],
  )

  const annotated = REQUIREMENTS.filter((r) => seenSet.has(r.ref)).length
  const pct = Math.round((annotated / REQUIREMENTS.length) * 100)

  const byModule = useMemo(
    () =>
      Object.keys(MODULES).map((m) => {
        const all = REQUIREMENTS.filter((r) => r.module === m)
        return {
          module: m,
          name: MODULES[m],
          total: all.length,
          seen: all.filter((r) => seenSet.has(r.ref)).length,
        }
      }),
    [seenSet],
  )

  return (
    <div className="pb-6">
      <PageHeader
        title="Requirement traceability coverage"
        description="The 91 Appendix A6 rows, and where each is annotated in the built prototype. Turn on requirement badges and walk the screens to populate the “annotated” column."
        actions={
          <button
            type="button"
            className={enabled ? 'ais-btn-secondary' : 'ais-btn-primary'}
            onClick={() => setEnabled(!enabled)}
          >
            {enabled ? 'Turn badges off' : 'Turn badges on'}
          </button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="ais-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Requirement rows</p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">{REQUIREMENTS.length}</p>
          <p className="text-xs text-ink-500">across 14 modules</p>
        </div>
        <div className="ais-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
            Annotated this session
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">
            {annotated}
            <span className="text-base font-normal text-ink-500"> / {REQUIREMENTS.length}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-200">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="ais-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
            Rows the bid promised to exceed
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">
            {REQUIREMENTS.filter((r) => r.exceeds).length}
            <span className="ml-1 text-warn-600">★</span>
          </p>
          <p className="text-xs text-ink-500">
            {REQUIREMENTS.filter((r) => r.exceeds && seenSet.has(r.ref)).length} annotated so far
          </p>
        </div>
      </div>

      <div className="ais-card mb-4 p-3">
        <p className="text-sm text-ink-600">
          Coverage is measured live: a row counts as annotated once a{' '}
          <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-xs">&lt;ReqBadge&gt;</code>{' '}
          for it has rendered in this browser session. Reloading the page resets the count. Rows for
          screens that are still to be built (Waves B–D) will show as not annotated until those
          screens exist.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setModuleFilter('all')}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            moduleFilter === 'all' ? 'border-brand-500 bg-brand-600 text-white' : 'border-ink-300 bg-white text-ink-700'
          }`}
        >
          All modules
        </button>
        {byModule.map((m) => (
          <button
            key={m.module}
            type="button"
            onClick={() => setModuleFilter(m.module)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              moduleFilter === m.module ? 'border-brand-500 bg-brand-600 text-white' : 'border-ink-300 bg-white text-ink-700'
            }`}
            title={m.name}
          >
            {m.module} · {m.seen}/{m.total}
          </button>
        ))}
      </div>

      <div className="ais-card overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">Appendix A6 requirement coverage</caption>
          <thead>
            <tr className="border-b border-ink-200 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-600">
              <th scope="col" className="px-3 py-2.5 font-semibold">Ref</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Requirement</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Screen(s)</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Annotated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const screens = screensFor(r.ref)
              return (
                <tr key={r.ref} className="border-b border-ink-100 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 align-top">
                    <span className="font-mono text-xs font-bold text-ink-800">{r.ref}</span>
                    {r.exceeds && <span className="ml-1 text-warn-600" title="Bid promised to exceed">★</span>}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <p className="text-ink-900">{r.requirement}</p>
                    <p className="mt-0.5 text-xs text-ink-500">{r.promised}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top text-xs">
                    <span className="font-medium text-ink-700">{r.screens.join(', ')}</span>
                    {screens.length > 0 && (
                      <span className="mt-0.5 block text-ink-400">seen on {screens.join(', ')}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {seenSet.has(r.ref) ? (
                      <StatusBadge status="pass" label="Annotated" />
                    ) : (
                      <StatusBadge status="pending" tone="muted" label="Not yet" />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
