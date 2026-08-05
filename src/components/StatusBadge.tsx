// Coloured status pill. Centralised status→tone map so every screen renders the
// same colour for the same state.
import { titleCase } from '../lib/format';
import { cx } from './ui';

const TONES = {
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  violet: 'bg-violet-100 text-violet-700',
  slate: 'bg-slate-100 text-slate-600',
} as const;

type Tone = keyof typeof TONES;

const STATUS_TONE: Record<string, Tone> = {
  active: 'green',
  approved: 'green',
  completed: 'green',
  verified: 'green',
  resolved: 'green',
  disbursed: 'green',
  sent: 'green',
  pending: 'amber',
  submitted: 'amber',
  assessment: 'amber',
  committee: 'amber',
  testing: 'amber',
  registered: 'amber',
  collected: 'amber',
  assigned: 'amber',
  investigating: 'amber',
  in_progress: 'amber',
  scheduled: 'amber',
  queued: 'amber',
  reported: 'amber',
  pending_sync: 'amber',
  expired: 'amber',
  rejected: 'red',
  suspended: 'red',
  confirmed: 'red',
  inactive: 'slate',
  merged: 'slate',
  ruled_out: 'slate',
  closed: 'slate',
  draft: 'slate',
  read: 'slate',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = STATUS_TONE[status] ?? 'slate';
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        TONES[tone],
      )}
    >
      {label ?? titleCase(status)}
    </span>
  );
}
