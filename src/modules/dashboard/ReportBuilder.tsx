import { useMemo, useState } from 'react'
import { useAuth } from '../../app/AuthContext'
import { useDb } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { EmptyState } from '../../components/EmptyState'
import { SelectField, TextField } from '../../components/Field'
import { ReqBadge } from '../../components/ReqBadge'
import { exportTableCsv, exportTableExcel, exportTablePdf } from '../../lib/export'
import type { ReportColumn } from '../../lib/export'
import { DEMO_TODAY } from '../../lib/format'
import { can } from '../../lib/rbac'
import { DATASETS, applyFilters, distinctValues, summarise } from '../../lib/reports'
import type { ReportFilterState, ReportRow } from '../../lib/reports'

const EMPTY_FILTERS: ReportFilterState = { facets: {}, from: '', to: '', search: '' }

/**
 * S12 — ad-hoc report builder (xii.5, xii.6).
 *
 * Pick a dataset, narrow it with facets, a date range and free text, then export
 * exactly what is on screen to PDF, Excel or CSV. Datasets are gated by the same
 * permission as their registry, so the builder cannot be used to read around
 * role-based access control.
 */
export function ReportBuilder() {
  const db = useDb()
  const { role } = useAuth()
  const { toast } = useToast()

  const available = useMemo(
    () => DATASETS.filter((d) => can(role, d.permission)),
    [role],
  )

  const [datasetId, setDatasetId] = useState(available[0]?.id ?? '')
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY_FILTERS)
  const [busy, setBusy] = useState<'pdf' | 'excel' | 'csv' | null>(null)

  const dataset = available.find((d) => d.id === datasetId) ?? available[0]

  const allRows = useMemo(() => (dataset ? dataset.build(db) : []), [dataset, db])
  const rows = useMemo(
    () => (dataset ? applyFilters(dataset, allRows, filters) : []),
    [dataset, allRows, filters],
  )

  if (!dataset) {
    return (
      <div className="ais-card">
        <EmptyState
          title="No datasets available to your role"
          body="The report builder only offers datasets you are permitted to read."
        />
      </div>
    )
  }

  const columns: ReportColumn<ReportRow>[] = dataset.columns.map((c) => ({
    header: c.header,
    value: (row) => row[c.key] ?? '',
    align: c.align,
  }))

  const activeFacets = Object.entries(filters.facets).filter(([, v]) => v)
  const describeFilters = [
    ...activeFacets.map(([k, v]) => `${dataset.columns.find((c) => c.key === k)?.header ?? k}: ${v}`),
    filters.from ? `from ${filters.from}` : '',
    filters.to ? `to ${filters.to}` : '',
    filters.search ? `matching “${filters.search}”` : '',
  ].filter(Boolean)

  const options = {
    title: `${dataset.label} report`,
    subtitle: dataset.description,
    columns,
    rows,
    meta: [
      { label: 'Dataset', value: dataset.label },
      { label: 'Records', value: `${rows.length} of ${allRows.length}` },
      { label: 'Filters', value: describeFilters.length ? describeFilters.join('; ') : 'None — full dataset' },
    ],
    notes: summarise(dataset, rows),
    orientation: 'landscape' as const,
    fileStem: `ais-${dataset.id}-report`,
  }

  const runExport = async (kind: 'pdf' | 'excel' | 'csv') => {
    setBusy(kind)
    try {
      if (kind === 'pdf') await exportTablePdf(options)
      else if (kind === 'excel') await exportTableExcel(options)
      else exportTableCsv(options)
      toast({
        tone: 'success',
        title: `${kind.toUpperCase()} report generated`,
        body: `${rows.length} ${dataset.label.toLowerCase()} exported.`,
      })
    } catch {
      toast({ tone: 'error', title: 'Export failed' })
    } finally {
      setBusy(null)
    }
  }

  const reset = () => setFilters(EMPTY_FILTERS)

  return (
    <div>
      <div className="mb-4 rounded-lg border border-ink-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Build a report</h2>
          <ReqBadge refs={['xii.5', 'xii.6']} screen="S12" />
        </div>
        <p className="mt-0.5 text-xs text-ink-500">
          Choose a dataset, narrow it, and export what you see. Only datasets your role may read are
          offered — the builder cannot be used to read around access control.
        </p>

        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr),minmax(0,2fr)]">
          <SelectField
            label="Dataset"
            value={dataset.id}
            onChange={(e) => {
              setDatasetId(e.target.value)
              reset()
            }}
            hint={dataset.description}
          >
            {available.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </SelectField>

          <div>
            <label htmlFor="report-search" className="ais-label">Free-text search</label>
            <input
              id="report-search"
              type="search"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Any value in any column…"
              className="ais-input"
            />
          </div>
        </div>

        {/* ------------------------------------------------------ facets */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dataset.filterKeys.map((key) => {
            const column = dataset.columns.find((c) => c.key === key)
            const values = distinctValues(allRows, key)
            if (values.length < 2) return null
            return (
              <SelectField
                key={key}
                label={column?.header ?? key}
                value={filters.facets[key] ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, facets: { ...f.facets, [key]: e.target.value } }))
                }
              >
                <option value="">All</option>
                {values.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </SelectField>
            )
          })}

          {dataset.dateKey && (
            <>
              <TextField
                label={`${dataset.columns.find((c) => c.key === dataset.dateKey)?.header ?? 'Date'} from`}
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              />
              <TextField
                label="to"
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                hint={`Demonstration date is ${DEMO_TODAY.toISOString().slice(0, 10)}.`}
              />
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-4">
          <p className="mr-auto text-sm text-ink-600">
            <strong className="text-ink-900">{rows.length}</strong> of {allRows.length}{' '}
            {dataset.label.toLowerCase()} match
            {describeFilters.length > 0 && <span className="text-ink-500"> · {describeFilters.join(' · ')}</span>}
          </p>
          <button type="button" className="ais-btn-secondary" onClick={reset} disabled={!describeFilters.length}>
            Clear filters
          </button>
          <button type="button" className="ais-btn-secondary" onClick={() => void runExport('csv')} disabled={busy !== null || !rows.length}>
            {busy === 'csv' ? 'Generating…' : 'Export CSV'}
          </button>
          <button type="button" className="ais-btn-secondary" onClick={() => void runExport('excel')} disabled={busy !== null || !rows.length}>
            {busy === 'excel' ? 'Generating…' : 'Export Excel'}
          </button>
          <button type="button" className="ais-btn-primary" onClick={() => void runExport('pdf')} disabled={busy !== null || !rows.length}>
            {busy === 'pdf' ? 'Generating…' : 'Export PDF'}
            <ReqBadge refs="xii.6" screen="S12" />
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------- preview */}
      <div className="ais-card overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState title="No records match these filters" body="Clear a facet or widen the date range." />
        ) : (
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <caption className="sr-only">{dataset.label} report preview</caption>
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50">
                {dataset.columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={`whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-600 ${
                      c.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 25).map((row, i) => (
                <tr key={String(row[dataset.columns[0].key] ?? i)} className="border-b border-ink-100 last:border-0">
                  {dataset.columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-3 py-2 text-ink-800 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}
                    >
                      {String(row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > 25 && (
        <p className="mt-2 text-xs text-ink-500">
          Previewing the first 25 rows. The export contains all {rows.length}.
        </p>
      )}

      {rows.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-xs text-ink-500">
          {summarise(dataset, rows).map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
