// Simulated document/photo attachment. No real file leaves the browser; every
// control is labelled "simulated" per the honesty constraint.
import { fmtDate } from '../lib/format';
import { makeSimDoc } from '../lib/sim';
import type { DocRef } from '../lib/types';
import { Icon } from './Icon';
import { cx, SimBadge } from './ui';

export function DocUploader({
  docs,
  onChange,
  label = 'Supporting documents',
  categories = ['lease', 'permit', 'id', 'report', 'map'],
}: {
  docs: DocRef[];
  onChange: (docs: DocRef[]) => void;
  label?: string;
  categories?: string[];
}) {
  const add = (category: string) =>
    onChange([...docs, makeSimDoc(`${category}-${docs.length + 1}.pdf`, category)]);
  const toggleVerified = (id: string) =>
    onChange(docs.map((d) => (d.id === id ? { ...d, verified: !d.verified } : d)));
  const remove = (id: string) => onChange(docs.filter((d) => d.id !== id));

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <SimBadge label="upload simulated" />
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className="btn-secondary px-2.5 py-1 text-xs"
            onClick={() => add(c)}
          >
            <Icon name="plus" size={14} /> {c}
          </button>
        ))}
      </div>
      {docs.length === 0 ? (
        <p className="text-xs text-slate-400">No documents attached.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-700">{d.name}</span>
                <span className="text-xs text-slate-400">
                  {d.category} · {d.sizeKb} KB · {fmtDate(d.uploadedAt)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleVerified(d.id)}
                  className={cx(
                    'rounded px-1.5 py-0.5 text-xs font-medium',
                    d.verified ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500',
                  )}
                >
                  {d.verified ? 'verified' : 'unverified'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(d.id)}
                  className="btn-ghost px-1 py-0.5"
                  aria-label="Remove document"
                >
                  <Icon name="x" size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
