import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { KpiCard } from '../../components/KpiCard'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { StatusBadge } from '../../components/StatusBadge'
import { Tabs } from '../../components/Tabs'
import { exportTableExcel, exportTablePdf } from '../../lib/export'
import { SAMPLE_LIFECYCLE, SAMPLE_TYPE_LABELS } from '../../lib/labPanels'
import { clientName, formatDate } from '../../lib/format'
import { can } from '../../lib/rbac'
import { statusLabel } from '../../lib/workflow'
import { SAMPLE_TYPES } from '../../lib/types'
import type { Sample, SampleType } from '../../lib/types'

/**
 * S06 — sample registry (vi.2, vi.3, vi.4, vi.6 ★).
 *
 * One registry, filtered by type, so soil, water, plant and compost samples
 * share a single lifecycle rather than living in four disconnected lists.
 */
export function SampleRegistry() {
  const db = useDb()
  const { role } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [type, setType] = useState<'all' | SampleType>('all')
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null)

  const clientById = useMemo(() => new Map(db.clients.map((c) => [c.id, c])), [db.clients])
  const farmById = useMemo(() => new Map(db.farms.map((f) => [f.id, f])), [db.farms])
  const userById = useMemo(() => new Map(db.users.map((u) => [u.id, u])), [db.users])

  const byType = useMemo(
    () =>
      SAMPLE_TYPES.map((t) => ({
        type: t,
        count: db.samples.filter((s) => s.type === t).length,
      })),
    [db.samples],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return db.samples.filter((s) => {
      if (type !== 'all' && s.type !== type) return false
      if (status === 'open' ? s.status === 'completed' || s.status === 'cancelled' : status !== 'all' && s.status !== status) {
        return false
      }
      if (!q) return true
      const owner = clientById.get(s.clientId)
      const farm = farmById.get(s.farmId)
      return [s.id, s.type, s.purpose, s.status, farm?.name ?? '', owner ? `${owner.firstName} ${owner.lastName} ${owner.id} ${owner.nin}` : '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [db.samples, clientById, farmById, type, status, query])

  const kpis = useMemo(() => {
    const open = db.samples.filter((s) => !['completed', 'cancelled'].includes(s.status))
    const completed = db.samples.filter((s) => s.status === 'completed')
    const awaitingNotice = completed.filter((s) => !s.notifiedOn)
    const outOfRange = completed.filter((s) => s.results.some((r) => r.flag !== 'normal'))
    return {
      total: db.samples.length,
      open: open.length,
      inTesting: db.samples.filter((s) => s.status === 'testing').length,
      awaitingNotice: awaitingNotice.length,
      outOfRange: outOfRange.length,
    }
  }, [db.samples])

  const reportOptions = {
    title: 'Laboratory sample register',
    subtitle: type === 'all' ? 'All sample types' : `${SAMPLE_TYPE_LABELS[type]} samples`,
    columns: [
      { header: 'Reference', value: (s: Sample) => s.id },
      { header: 'Type', value: (s: Sample) => SAMPLE_TYPE_LABELS[s.type] },
      { header: 'Applicant', value: (s: Sample) => clientName(clientById.get(s.clientId)) },
      { header: 'Client ID', value: (s: Sample) => s.clientId },
      { header: 'Holding', value: (s: Sample) => farmById.get(s.farmId)?.name ?? s.farmId },
      { header: 'District', value: (s: Sample) => farmById.get(s.farmId)?.district ?? '—' },
      { header: 'Purpose', value: (s: Sample) => s.purpose },
      { header: 'Status', value: (s: Sample) => statusLabel(s.status) },
      { header: 'Requested', value: (s: Sample) => s.requestedOn },
      { header: 'Completed', value: (s: Sample) => s.completedOn ?? '—' },
      { header: 'Out of range', value: (s: Sample) => s.results.filter((r) => r.flag !== 'normal').length, align: 'right' as const },
      { header: 'Applicant notified', value: (s: Sample) => s.notifiedOn ?? '—' },
    ],
    rows: filtered,
    meta: [
      { label: 'Samples in view', value: String(filtered.length) },
      { label: 'Type filter', value: type === 'all' ? 'All types' : SAMPLE_TYPE_LABELS[type] },
      { label: 'Status filter', value: status === 'all' ? 'All statuses' : statusLabel(status) },
    ],
    notes: [
      `${kpis.inTesting} samples currently in testing; ${kpis.awaitingNotice} completed samples have not yet been notified to the applicant.`,
    ],
    orientation: 'landscape' as const,
    fileStem: 'laboratory-sample-register',
  }

  const runExport = async (kind: 'pdf' | 'excel') => {
    setBusy(kind)
    try {
      await (kind === 'pdf' ? exportTablePdf(reportOptions) : exportTableExcel(reportOptions))
      toast({ tone: 'success', title: `${kind === 'pdf' ? 'PDF' : 'Excel'} register generated`, body: `${filtered.length} samples exported.` })
    } catch {
      toast({ tone: 'error', title: 'Export failed' })
    } finally {
      setBusy(null)
    }
  }

  const columns: Column<Sample>[] = [
    {
      key: 'ref',
      header: 'Sample',
      sortValue: (s) => s.id,
      render: (s) => (
        <div className="min-w-0">
          <p className="truncate font-medium capitalize text-ink-900">
            {SAMPLE_TYPE_LABELS[s.type]} sample
          </p>
          <p className="font-mono text-xs text-ink-500">{s.id}</p>
        </div>
      ),
    },
    {
      key: 'applicant',
      header: 'Applicant',
      sortValue: (s) => clientName(clientById.get(s.clientId)),
      render: (s) => {
        const owner = clientById.get(s.clientId)
        return owner ? (
          <Link to={`/clients/${owner.id}`} onClick={(e) => e.stopPropagation()} className="text-sm text-brand-700 hover:underline">
            {clientName(owner)}
            <span className="block font-mono text-xs text-ink-500">{owner.id}</span>
          </Link>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        )
      },
    },
    {
      key: 'holding',
      header: 'Holding',
      sortValue: (s) => farmById.get(s.farmId)?.name ?? '',
      render: (s) => {
        const farm = farmById.get(s.farmId)
        return (
          <span className="text-sm">
            {farm?.name ?? s.farmId}
            <span className="block font-mono text-xs text-ink-500">{s.farmId}</span>
          </span>
        )
      },
      hideOnMobile: true,
    },
    {
      key: 'lifecycle',
      header: 'Lifecycle',
      render: (s) => <LifecycleChips status={s.status} />,
    },
    {
      key: 'requested',
      header: 'Requested',
      sortValue: (s) => s.requestedOn,
      render: (s) => (
        <span className="whitespace-nowrap text-sm">
          {formatDate(s.requestedOn)}
          <span className="block text-xs capitalize text-ink-500">{s.requestedVia.replace('-', ' ')}</span>
        </span>
      ),
    },
    {
      key: 'analyst',
      header: 'Analyst',
      render: (s) => (
        <span className="text-sm">
          {s.labTechUserId ? (userById.get(s.labTechUserId)?.fullName ?? s.labTechUserId) : '—'}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (s) => s.status,
      render: (s) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StatusBadge status={s.status} />
          {s.status === 'completed' && s.results.some((r) => r.flag !== 'normal') && (
            <StatusBadge status="out-of-range" tone="warn" label="Out of range" />
          )}
          {s.status === 'completed' && !s.notifiedOn && (
            <StatusBadge status="not-notified" tone="bad" label="Not notified" />
          )}
        </span>
      ),
    },
  ]

  return (
    <div className="pb-6">
      <PageHeader
        screen="S06"
        title="Sampling & laboratory"
        description="Soil, water, plant, compost and veterinary samples from request through collection, registration and testing to a reported result."
        refs={['vi.2', 'vi.3', 'vi.4']}
        actions={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => void runExport('excel')} disabled={busy !== null || !filtered.length}>
              {busy === 'excel' ? 'Generating…' : 'Export Excel'}
            </button>
            <button type="button" className="ais-btn-secondary" onClick={() => void runExport('pdf')} disabled={busy !== null || !filtered.length}>
              {busy === 'pdf' ? 'Generating…' : 'Export PDF'}
              <ReqBadge refs="vi.7" screen="S06" />
            </button>
            {(can(role, 'lab.register') || can(role, 'portal.self')) && (
              <Link to="/lab/request" className="ais-btn-primary">
                New sampling request
                <ReqBadge refs="vi.1" screen="S06" />
              </Link>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Samples" value={kpis.total} hint="All types, all time" onClick={() => { setStatus('all'); setType('all') }} active={status === 'all' && type === 'all'} />
        <KpiCard label="In progress" value={kpis.open} hint="Not yet completed" tone="warn" onClick={() => setStatus('open')} active={status === 'open'} />
        <KpiCard label="In testing" value={kpis.inTesting} hint="On the bench now" onClick={() => setStatus('testing')} active={status === 'testing'} />
        <KpiCard label="Results out of range" value={kpis.outOfRange} hint="Completed with a flagged parameter" tone="warn" />
        <KpiCard
          label="Awaiting notification"
          value={kpis.awaitingNotice}
          hint="Completed, applicant not yet told"
          tone={kpis.awaitingNotice ? 'bad' : 'good'}
          refs={['vi.8']}
          screen="S06"
        />
      </div>

      <Tabs
        tabs={[
          { id: 'all', label: 'All types', count: db.samples.length },
          ...byType.map((t) => ({ id: t.type, label: SAMPLE_TYPE_LABELS[t.type], count: t.count })),
        ]}
        active={type}
        onChange={(id) => setType(id as 'all' | SampleType)}
        className="mb-3"
      />

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(s) => s.id}
        onRowClick={(s) => navigate(`/lab/${s.id}`)}
        unit="samples"
        pageSize={12}
        initialSort={{ key: 'requested', direction: 'desc' }}
        caption="Laboratory sample register"
        emptyTitle="No samples match this filter"
        toolbar={
          <div className="ais-card p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label htmlFor="sample-search" className="ais-label">Search</label>
                <input
                  id="sample-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Reference, applicant, holding, purpose or NIN…"
                  className="ais-input"
                />
              </div>
              <div>
                <label htmlFor="sample-status" className="ais-label">Lifecycle status</label>
                <select id="sample-status" value={status} onChange={(e) => setStatus(e.target.value)} className="ais-input">
                  <option value="all">All statuses</option>
                  <option value="open">In progress</option>
                  {SAMPLE_LIFECYCLE.map((s) => (
                    <option key={s.status} value={s.status}>{s.label}</option>
                  ))}
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>
        }
      />
    </div>
  )
}

/** Compact lifecycle indicator: collected → registered → testing → completed. */
export function LifecycleChips({ status }: { status: string }) {
  const index = SAMPLE_LIFECYCLE.findIndex((s) => s.status === status)
  if (status === 'cancelled') {
    return <span className="text-xs text-ink-400">Cancelled</span>
  }
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Lifecycle: ${statusLabel(status)}`}>
      {SAMPLE_LIFECYCLE.map((s, i) => (
        <span
          key={s.status}
          title={`${s.label} — ${s.actor}`}
          className={`h-1.5 w-5 rounded-full ${
            i < index ? 'bg-brand-400' : i === index ? 'bg-brand-600' : 'bg-ink-200'
          }`}
        />
      ))}
      <span className="ml-1 text-xs text-ink-600">{statusLabel(status)}</span>
    </span>
  )
}
