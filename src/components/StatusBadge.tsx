import { statusLabel } from '../lib/workflow'

type Tone = 'neutral' | 'progress' | 'good' | 'warn' | 'bad' | 'muted'

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'border-ink-300 bg-ink-100 text-ink-700',
  progress: 'border-brand-200 bg-brand-50 text-brand-700',
  good: 'border-brand-300 bg-brand-100 text-brand-800',
  warn: 'border-warn-200 bg-warn-50 text-warn-700',
  bad: 'border-danger-200 bg-danger-50 text-danger-700',
  muted: 'border-ink-200 bg-white text-ink-500',
}

const STATUS_TONE: Record<string, Tone> = {
  // workflow
  draft: 'muted',
  submitted: 'neutral',
  'under-review': 'progress',
  approved: 'good',
  rejected: 'bad',
  withdrawn: 'muted',
  pending: 'neutral',
  'in-progress': 'progress',
  skipped: 'muted',
  // loans
  disbursed: 'good',
  repaying: 'progress',
  closed: 'muted',
  // clients / users / farms
  active: 'good',
  inactive: 'muted',
  merged: 'muted',
  registered: 'good',
  suspended: 'warn',
  deactivated: 'muted',
  // leases
  expired: 'bad',
  terminated: 'bad',
  current: 'good',
  due: 'warn',
  overdue: 'bad',
  // laboratory
  requested: 'neutral',
  collected: 'progress',
  testing: 'progress',
  completed: 'good',
  cancelled: 'muted',
  // surveillance
  reported: 'warn',
  assigned: 'progress',
  investigating: 'progress',
  sampled: 'progress',
  confirmed: 'bad',
  negative: 'good',
  resolved: 'good',
  // field ops
  scheduled: 'neutral',
  compliant: 'good',
  'minor-issues': 'warn',
  'non-compliant': 'bad',
  'not-assessed': 'muted',
  // market
  vacant: 'muted',
  allocated: 'good',
  reserved: 'warn',
  maintenance: 'neutral',
  // documents
  pass: 'good',
  warn: 'warn',
  fail: 'bad',
  verified: 'good',
  // results
  normal: 'good',
  low: 'warn',
  high: 'warn',
}

export function StatusBadge({
  status,
  tone,
  label,
  className = '',
}: {
  status: string
  tone?: Tone
  label?: string
  className?: string
}) {
  const resolved = tone ?? STATUS_TONE[status] ?? 'neutral'
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[resolved]} ${className}`}
    >
      {label ?? statusLabel(status)}
    </span>
  )
}
