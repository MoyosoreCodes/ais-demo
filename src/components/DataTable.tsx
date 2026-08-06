import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { EmptyState } from './EmptyState'

/**
 * The one table in the prototype (CLAUDE.md §7.4 — no copy-pasted tables).
 *
 * Renders as a true table from `md` up and as stacked cards below it, so every
 * registry stays usable at 390 px on a field officer's phone.
 */

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Supplying this makes the column sortable. */
  sortValue?: (row: T) => string | number
  /** Extra classes for the cell. */
  className?: string
  /** Header alignment / width utility classes. */
  headerClassName?: string
  /** Hide this column in the stacked mobile card. */
  hideOnMobile?: boolean
}

interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  pageSize?: number
  emptyTitle?: string
  emptyBody?: string
  /** Rendered above the table — search inputs, filter chips. */
  toolbar?: ReactNode
  caption?: string
  /** Label for the row count, e.g. "clients". */
  unit?: string
  initialSort?: { key: string; direction: 'asc' | 'desc' }
  dense?: boolean
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  pageSize = 10,
  emptyTitle = 'No records found',
  emptyBody = 'Adjust the search or filters to widen the result set.',
  toolbar,
  caption,
  unit = 'records',
  initialSort,
  dense = false,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(
    initialSort ?? null,
  )
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const dir = sort.direction === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a)
      const vb = col.sortValue!(b)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb), 'en', { numeric: true }) * dir
    })
  }, [rows, sort, columns])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const visible = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)

  const toggleSort = (key: string) => {
    setPage(0)
    setSort((prev) =>
      prev?.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  const cellPad = dense ? 'px-3 py-2' : 'px-3 py-3'

  return (
    <div>
      {toolbar}

      {sorted.length === 0 ? (
        <div className="ais-card mt-3">
          <EmptyState title={emptyTitle} body={emptyBody} />
        </div>
      ) : (
        <>
          {/* Table — md and up */}
          <div className="ais-card mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              {caption && <caption className="sr-only">{caption}</caption>}
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50">
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      className={`${cellPad} text-left text-xs font-semibold uppercase tracking-wide text-ink-600 ${c.headerClassName ?? ''}`}
                      aria-sort={
                        sort?.key === c.key
                          ? sort.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                    >
                      {c.sortValue ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className="inline-flex items-center gap-1 rounded hover:text-brand-700"
                        >
                          {c.header}
                          <span aria-hidden className="text-[10px]">
                            {sort?.key === c.key ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`border-b border-ink-100 last:border-0 ${
                      onRowClick ? 'cursor-pointer hover:bg-brand-50/60' : ''
                    }`}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={`${cellPad} align-top text-ink-800 ${c.className ?? ''}`}>
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Stacked cards — below md */}
          <ul className="mt-3 space-y-2 md:hidden">
            {visible.map((row) => {
              const [first, ...rest] = columns
              return (
                <li key={rowKey(row)}>
                  <div
                    role={onRowClick ? 'button' : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onRowClick(row)
                            }
                          }
                        : undefined
                    }
                    className={`ais-card p-3 ${onRowClick ? 'cursor-pointer active:bg-brand-50' : ''}`}
                  >
                    <div className="text-sm font-semibold text-ink-900">{first.render(row)}</div>
                    <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 text-sm">
                      {rest
                        .filter((c) => !c.hideOnMobile)
                        .map((c) => (
                          <div key={c.key} className="contents">
                            <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">
                              {c.header}
                            </dt>
                            <dd className="min-w-0 text-ink-800">{c.render(row)}</dd>
                          </div>
                        ))}
                    </dl>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-600">
              Showing <strong className="text-ink-900">{safePage * pageSize + 1}</strong>–
              <strong className="text-ink-900">
                {Math.min((safePage + 1) * pageSize, sorted.length)}
              </strong>{' '}
              of <strong className="text-ink-900">{sorted.length}</strong> {unit}
            </p>
            {pageCount > 1 && (
              <nav className="flex items-center gap-1" aria-label="Pagination">
                <button
                  type="button"
                  className="ais-btn-secondary px-3 py-1.5 text-xs"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                >
                  Previous
                </button>
                <span className="px-2 text-sm text-ink-600">
                  Page {safePage + 1} of {pageCount}
                </span>
                <button
                  type="button"
                  className="ais-btn-secondary px-3 py-1.5 text-xs"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={safePage >= pageCount - 1}
                >
                  Next
                </button>
              </nav>
            )}
          </div>
        </>
      )}
    </div>
  )
}
