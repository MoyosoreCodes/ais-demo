// Shared, paginated table. All registries use this — no copy-pasted <table>s.
import { type ReactNode, useMemo, useState } from 'react';

import { cx, EmptyState } from './ui';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  onRowClick,
  empty,
  pageSize = 10,
  dense,
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  pageSize?: number;
  dense?: boolean;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = useMemo(
    () => rows.slice(current * pageSize, current * pageSize + pageSize),
    [rows, current, pageSize],
  );

  if (rows.length === 0) return <>{empty ?? <EmptyState title="No records" />}</>;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cx(
                    'px-3 py-2 font-medium',
                    c.hideOnMobile && 'hidden sm:table-cell',
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cx(
                  'border-b border-slate-100 last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-slate-50',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cx(
                      dense ? 'px-3 py-1.5' : 'px-3 py-2.5',
                      c.hideOnMobile && 'hidden sm:table-cell',
                      c.className,
                    )}
                  >
                    {c.render
                      ? c.render(row)
                      : String((row as Record<string, unknown>)[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-500">
          <span>
            {rows.length} records · page {current + 1} of {pages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              className="btn-secondary px-2 py-1"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Prev
            </button>
            <button
              type="button"
              className="btn-secondary px-2 py-1"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
