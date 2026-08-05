// Vertical change/activity history (client edits, workflow events, case history).
import type { ReactNode } from 'react';

import { fmtDateTime } from '../lib/format';

export interface TimelineItem {
  at: string;
  title: ReactNode;
  by?: string;
  note?: string;
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return <p className="text-sm text-slate-400">No history yet.</p>;
  return (
    <ol className="relative ml-1 border-l border-slate-200 pl-4">
      {items.map((it, i) => (
        <li key={i} className="mb-4 last:mb-0">
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary-500" />
          <div className="text-sm font-medium text-slate-800">{it.title}</div>
          <div className="text-xs text-slate-400">
            {fmtDateTime(it.at)}
            {it.by ? ` · ${it.by}` : ''}
          </div>
          {it.note && <div className="mt-0.5 text-xs text-slate-500">{it.note}</div>}
        </li>
      ))}
    </ol>
  );
}
