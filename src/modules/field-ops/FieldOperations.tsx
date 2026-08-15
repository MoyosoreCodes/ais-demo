import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  startOfMonth, startOfWeek,
} from 'date-fns'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useOffline } from '../../app/OfflineContext'
import { useToast } from '../../app/ToastContext'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { SelectField, TextField } from '../../components/Field'
import { KpiCard } from '../../components/KpiCard'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StatusBadge } from '../../components/StatusBadge'
import { Tabs } from '../../components/Tabs'
import { OfflineBar } from './OfflineBar'
import { exportTableExcel, exportTablePdf } from '../../lib/export'
import { DEMO_TODAY, clientName, formatDate, localId, nextInspectionId } from '../../lib/format'
import { composeNotification, templatesFor } from '../../lib/notify'
import { can } from '../../lib/rbac'
import { statusLabel } from '../../lib/workflow'
import { ROLE_LABELS } from '../../lib/types'
import type { Inspection } from '../../lib/types'

const INSPECTION_TYPES: Inspection['type'][] = [
  'farm-compliance',
  'land-lease',
  'loan-verification',
  'biosecurity',
]

/**
 * S10 — field operations (x.1, x.2, x.5, x.6). Mobile-priority.
 *
 * The calendar is the scheduling surface an office supervisor uses; the register
 * is what a field officer filters to find their own work.
 */
export function FieldOperations() {
  const db = useDb()
  const { user, role } = useAuth()
  const { pending } = useOffline()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [tab, setTab] = useState('calendar')
  const [month, setMonth] = useState(startOfMonth(DEMO_TODAY))
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [mineOnly, setMineOnly] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null)

  const clientById = useMemo(() => new Map(db.clients.map((c) => [c.id, c])), [db.clients])
  const farmById = useMemo(() => new Map(db.farms.map((f) => [f.id, f])), [db.farms])
  const userById = useMemo(() => new Map(db.users.map((u) => [u.id, u])), [db.users])
  const queuedIds = useMemo(() => new Set(db.outbox.map((q) => q.payload.id)), [db.outbox])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return db.inspections.filter((i) => {
      if (mineOnly && i.officerUserId !== user?.id) return false
      if (status === 'due' ? !['scheduled', 'in-progress'].includes(i.status) : status !== 'all' && i.status !== status) {
        return false
      }
      if (!q) return true
      const owner = clientById.get(i.clientId)
      const farm = farmById.get(i.farmId)
      return [i.id, i.type, i.status, i.outcome, i.findings, farm?.name ?? '', owner ? `${owner.firstName} ${owner.lastName}` : '']
        .join(' ').toLowerCase().includes(q)
    })
  }, [db.inspections, clientById, farmById, query, status, mineOnly, user?.id])

  const kpis = useMemo(() => {
    const scheduled = db.inspections.filter((i) => i.status === 'scheduled')
    const completed = db.inspections.filter((i) => i.status === 'completed')
    return {
      total: db.inspections.length,
      scheduled: scheduled.length,
      mine: db.inspections.filter((i) => i.officerUserId === user?.id && ['scheduled', 'in-progress'].includes(i.status)).length,
      nonCompliant: completed.filter((i) => i.outcome === 'non-compliant').length,
      offlineCaptured: completed.filter((i) => i.capturedOffline).length,
    }
  }, [db.inspections, user?.id])

  /* ---------------------------------------------- calendar grid (x.1) */
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [month])

  const inspectionsByDay = useMemo(() => {
    const map = new Map<string, Inspection[]>()
    for (const i of db.inspections) {
      const key = i.scheduledOn
      map.set(key, [...(map.get(key) ?? []), i])
    }
    return map
  }, [db.inspections])

  const reportOptions = {
    title: 'Field inspection report',
    subtitle: 'Scheduled and completed inspections with outcomes',
    columns: [
      { header: 'Inspection', value: (i: Inspection) => i.id },
      { header: 'Type', value: (i: Inspection) => statusLabel(i.type) },
      { header: 'Farmer', value: (i: Inspection) => clientName(clientById.get(i.clientId)) },
      { header: 'Holding', value: (i: Inspection) => farmById.get(i.farmId)?.name ?? i.farmId },
      { header: 'District', value: (i: Inspection) => farmById.get(i.farmId)?.district ?? '—' },
      { header: 'Officer', value: (i: Inspection) => userById.get(i.officerUserId)?.fullName ?? i.officerUserId },
      { header: 'Scheduled', value: (i: Inspection) => i.scheduledOn },
      { header: 'Completed', value: (i: Inspection) => i.completedOn ?? '—' },
      { header: 'Status', value: (i: Inspection) => statusLabel(i.status) },
      { header: 'Outcome', value: (i: Inspection) => statusLabel(i.outcome) },
      { header: 'Photographs', value: (i: Inspection) => i.photos.length, align: 'right' as const },
      { header: 'Captured offline', value: (i: Inspection) => (i.capturedOffline ? 'Yes' : 'No') },
      { header: 'Findings', value: (i: Inspection) => i.findings || '—' },
    ],
    rows: filtered,
    meta: [
      { label: 'Inspections in view', value: String(filtered.length) },
      { label: 'Scheduled', value: String(kpis.scheduled) },
      { label: 'Non-compliant outcomes', value: String(kpis.nonCompliant) },
    ],
    notes: [
      `${kpis.offlineCaptured} completed inspection${kpis.offlineCaptured === 1 ? '' : 's'} ${kpis.offlineCaptured === 1 ? 'was' : 'were'} captured offline and synchronised on reconnection.`,
    ],
    orientation: 'landscape' as const,
    fileStem: 'field-inspection-report',
  }

  const runExport = async (kind: 'pdf' | 'excel') => {
    setBusy(kind)
    try {
      await (kind === 'pdf' ? exportTablePdf(reportOptions) : exportTableExcel(reportOptions))
      toast({ tone: 'success', title: `${kind === 'pdf' ? 'PDF' : 'Excel'} report generated`, body: `${filtered.length} inspections exported.` })
    } finally {
      setBusy(null)
    }
  }

  const columns: Column<Inspection>[] = [
    {
      key: 'ref',
      header: 'Inspection',
      sortValue: (i) => i.id,
      render: (i) => (
        <div className="min-w-0">
          <p className="truncate font-medium capitalize text-ink-900">{i.type.replace(/-/g, ' ')}</p>
          <p className="font-mono text-xs text-ink-500">{i.id}</p>
        </div>
      ),
    },
    {
      key: 'holding',
      header: 'Holding',
      sortValue: (i) => farmById.get(i.farmId)?.name ?? '',
      render: (i) => {
        const farm = farmById.get(i.farmId)
        return (
          <span className="text-sm">
            {farm?.name ?? i.farmId}
            <span className="block text-xs text-ink-500">
              {clientName(clientById.get(i.clientId))}{farm ? ` · ${farm.district}` : ''}
            </span>
          </span>
        )
      },
    },
    {
      key: 'officer',
      header: 'Officer',
      sortValue: (i) => userById.get(i.officerUserId)?.fullName ?? '',
      render: (i) => <span className="text-sm">{userById.get(i.officerUserId)?.fullName ?? '—'}</span>,
      hideOnMobile: true,
    },
    {
      key: 'scheduled',
      header: 'Scheduled',
      sortValue: (i) => i.scheduledOn,
      render: (i) => <span className="whitespace-nowrap text-sm">{formatDate(i.scheduledOn)}</span>,
    },
    {
      key: 'evidence',
      header: 'Evidence',
      render: (i) => (
        <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
          {i.photos.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded bg-ink-100 px-1.5 py-0.5 text-ink-600">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h3l2-3h8l2 3h3v11H3z" strokeLinejoin="round" />
              </svg>
              {i.photos.length}
            </span>
          )}
          {i.capturedOffline && <SimChip label="offline" />}
          {queuedIds.has(i.id) && <StatusBadge status="queued" tone="warn" label="Pending sync" />}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (i) => i.status,
      render: (i) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StatusBadge status={i.status} />
          {i.status === 'completed' && <StatusBadge status={i.outcome} />}
        </span>
      ),
    },
  ]

  return (
    <div className="pb-6">
      <PageHeader
        screen="S10"
        title="Field operations"
        description="Scheduling, assignment and on-site capture of farm inspections — built for a phone in the field as much as a desk in the office."
        refs={['x.1', 'x.2', 'x.5']}
        actions={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => void runExport('excel')} disabled={busy !== null || !filtered.length}>
              {busy === 'excel' ? 'Generating…' : 'Export Excel'}
            </button>
            <button type="button" className="ais-btn-secondary" onClick={() => void runExport('pdf')} disabled={busy !== null || !filtered.length}>
              {busy === 'pdf' ? 'Generating…' : 'Export PDF'}
              <ReqBadge refs="x.6" screen="S10" />
            </button>
            {can(role, 'fieldops.schedule') && (
              <button type="button" className="ais-btn-primary" onClick={() => setScheduleOpen(true)}>
                Schedule an inspection
                <ReqBadge refs={['x.1', 'x.2']} screen="S10" />
              </button>
            )}
          </>
        }
      />

      <OfflineBar />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Inspections" value={kpis.total} hint="All time" onClick={() => { setStatus('all'); setMineOnly(false) }} active={status === 'all' && !mineOnly} />
        <KpiCard label="Scheduled" value={kpis.scheduled} hint="Not yet attended" tone="warn" onClick={() => setStatus('scheduled')} active={status === 'scheduled'} />
        <KpiCard label="Assigned to me" value={kpis.mine} hint="Open on my list" refs={['x.2']} screen="S10" onClick={() => setMineOnly(!mineOnly)} active={mineOnly} />
        <KpiCard label="Non-compliant" value={kpis.nonCompliant} hint="Completed with findings" tone={kpis.nonCompliant ? 'bad' : 'good'} />
        <KpiCard
          label="Captured offline"
          value={kpis.offlineCaptured}
          hint={pending > 0 ? `${pending} still queued on device` : 'All synchronised'}
          refs={['x.3']}
          screen="S10"
          tone={pending > 0 ? 'warn' : 'good'}
        />
      </div>

      <Tabs
        tabs={[
          { id: 'calendar', label: 'Schedule' },
          { id: 'register', label: 'Inspection register', count: db.inspections.length },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-3"
      />

      {/* ------------------------------------------------------ calendar */}
      {tab === 'calendar' && (
        <section className="ais-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              {format(month, 'MMMM yyyy')}
              <ReqBadge refs="x.1" screen="S10" />
            </h2>
            <div className="flex items-center gap-1">
              <button type="button" className="ais-btn-secondary px-2.5 py-1 text-xs" onClick={() => setMonth(addMonths(month, -1))}>
                Previous
              </button>
              <button type="button" className="ais-btn-secondary px-2.5 py-1 text-xs" onClick={() => setMonth(startOfMonth(DEMO_TODAY))}>
                Today
              </button>
              <button type="button" className="ais-btn-secondary px-2.5 py-1 text-xs" onClick={() => setMonth(addMonths(month, 1))}>
                Next
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const items = inspectionsByDay.get(key) ?? []
              const inMonth = isSameMonth(day, month)
              const isToday = isSameDay(day, DEMO_TODAY)
              return (
                <div
                  key={key}
                  className={`min-h-[74px] rounded-lg border p-1.5 ${
                    isToday ? 'border-brand-500 bg-brand-50/60' : inMonth ? 'border-ink-200 bg-white' : 'border-ink-100 bg-ink-50/60'
                  }`}
                >
                  <p className={`text-xs font-semibold ${inMonth ? 'text-ink-700' : 'text-ink-400'}`}>
                    {format(day, 'd')}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {items.slice(0, 3).map((i) => {
                      const farm = farmById.get(i.farmId)
                      return (
                        <li key={i.id}>
                          <button
                            type="button"
                            onClick={() => navigate(`/field-ops/${i.id}`)}
                            title={`${i.id} — ${farm?.name ?? i.farmId} — ${userById.get(i.officerUserId)?.fullName ?? ''}`}
                            className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium ${
                              i.status === 'completed'
                                ? 'bg-brand-100 text-brand-800'
                                : i.status === 'cancelled'
                                  ? 'bg-ink-100 text-ink-500 line-through'
                                  : 'bg-warn-100 text-warn-800'
                            }`}
                          >
                            {farm?.name ?? i.farmId}
                          </button>
                        </li>
                      )
                    })}
                    {items.length > 3 && (
                      <li className="px-1 text-[10px] text-ink-500">+{items.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )
            })}
          </div>

          <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-500">
            Amber scheduled, green completed, struck through cancelled. Select an entry to open the
            inspection.
          </p>
        </section>
      )}

      {/* ------------------------------------------------------ register */}
      {tab === 'register' && (
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(i) => i.id}
          onRowClick={(i) => navigate(`/field-ops/${i.id}`)}
          unit="inspections"
          pageSize={12}
          initialSort={{ key: 'scheduled', direction: 'desc' }}
          caption="Field inspection register"
          emptyTitle="No inspections match this filter"
          toolbar={
            <div className="ais-card p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <label htmlFor="ins-search" className="ais-label">Search</label>
                  <input
                    id="ins-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Reference, holding, farmer, type or findings…"
                    className="ais-input"
                  />
                </div>
                <div>
                  <label htmlFor="ins-status" className="ais-label">Status</label>
                  <select id="ins-status" value={status} onChange={(e) => setStatus(e.target.value)} className="ais-input">
                    <option value="all">All statuses</option>
                    <option value="due">Due (scheduled or in progress)</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in-progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <label className="mb-2 inline-flex items-center gap-2 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    checked={mineOnly}
                    onChange={(e) => setMineOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-600"
                  />
                  Assigned to me
                </label>
              </div>
            </div>
          }
        />
      )}

      <ScheduleDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Scheduling and assignment (x.1, x.2)
 * ------------------------------------------------------------------ */

function ScheduleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDb()
  const dispatch = useDispatch()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [farmId, setFarmId] = useState('')
  const [type, setType] = useState<Inspection['type']>('farm-compliance')
  const [scheduledOn, setScheduledOn] = useState(format(addMonths(DEMO_TODAY, 0), 'yyyy-MM-dd'))
  const [officerUserId, setOfficerUserId] = useState('')

  const farms = useMemo(() => db.farms.filter((f) => f.status === 'registered'), [db.farms])
  const farm = farms.find((f) => f.id === farmId)
  const owner = db.clients.find((c) => c.id === farm?.clientId)
  const officers = useMemo(
    () => db.users.filter((u) => u.status === 'active' && ['field_officer', 'agriculture_officer'].includes(u.role)),
    [db.users],
  )

  /** Officer workload on the chosen date, so scheduling is not blind. */
  const load = useMemo(() => {
    const counts = new Map<string, number>()
    for (const i of db.inspections) {
      if (i.scheduledOn !== scheduledOn) continue
      counts.set(i.officerUserId, (counts.get(i.officerUserId) ?? 0) + 1)
    }
    return counts
  }, [db.inspections, scheduledOn])

  const canSave = Boolean(farm && owner && officerUserId && scheduledOn)

  const save = () => {
    if (!user || !farm || !owner || !canSave) return
    const id = nextInspectionId(db.inspections.map((i) => i.id))
    const officer = db.users.find((u) => u.id === officerUserId)

    const inspection: Inspection = {
      id,
      clientId: owner.id,
      farmId: farm.id,
      type,
      scheduledOn,
      officerUserId,
      status: 'scheduled',
      observations: '',
      findings: '',
      outcome: 'not-assessed',
      photos: [],
      capturedOffline: false,
      history: [
        {
          id: localId('IH'), at: new Date().toISOString(), actorUserId: user.id, actorName: user.fullName,
          action: 'Inspection scheduled and assigned',
          field: 'officer', to: officer?.fullName ?? officerUserId,
          note: `${statusLabel(type)} inspection of ${farm.name} on ${formatDate(scheduledOn)}.`,
        },
      ],
    }

    dispatch({
      type: 'inspection/create',
      inspection,
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'inspection.scheduled', entityType: 'inspection', entityId: id,
        detail: `${statusLabel(type)} inspection of ${farm.name} (${farm.id}) assigned to ${officer?.fullName ?? officerUserId} for ${scheduledOn}`,
      },
    })

    for (const template of templatesFor(db.notificationTemplates, 'inspection.scheduled')) {
      dispatch({
        type: 'notification/add',
        notification: composeNotification({
          template,
          client: owner,
          vars: { inspectionType: statusLabel(type).toLowerCase(), farmName: farm.name, scheduledOn: formatDate(scheduledOn) },
          relatedType: 'inspection',
          relatedId: id,
        }),
      })
    }

    toast({ tone: 'success', title: 'Inspection scheduled', body: `${id} assigned to ${officer?.fullName ?? ''}.` })
    onClose()
    navigate(`/field-ops/${id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule a field inspection"
      size="md"
      description="Assigning an officer puts the inspection on their list and notifies the holder."
      footer={
        <>
          <button type="button" className="ais-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="ais-btn-primary" onClick={save} disabled={!canSave}>
            Schedule and assign
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField label="Holding to inspect" required value={farmId} onChange={(e) => setFarmId(e.target.value)}>
          <option value="">Select a holding…</option>
          {farms.map((f) => {
            const c = db.clients.find((x) => x.id === f.clientId)
            return (
              <option key={f.id} value={f.id}>
                {f.name} · {f.id} · {clientName(c)}
              </option>
            )
          })}
        </SelectField>

        {farm && owner && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm">
            <p className="font-semibold text-ink-900">{clientName(owner)}</p>
            <p className="font-mono text-xs text-ink-600">{owner.id} · {farm.id} · {farm.parcelRef}</p>
            <p className="mt-0.5 text-xs text-ink-600">{farm.district}, {farm.island}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Inspection type" value={type} onChange={(e) => setType(e.target.value as Inspection['type'])}>
            {INSPECTION_TYPES.map((t) => (
              <option key={t} value={t}>{statusLabel(t)}</option>
            ))}
          </SelectField>
          <TextField label="Scheduled for" type="date" required value={scheduledOn} onChange={(e) => setScheduledOn(e.target.value)} />
        </div>

        <div>
          <p className="ais-label mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              Assign to officer
              <ReqBadge refs="x.2" screen="S10" />
            </span>
          </p>
          <ul className="space-y-1.5">
            {officers.map((u) => {
              const count = load.get(u.id) ?? 0
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => setOfficerUserId(u.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                      officerUserId === u.id ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-brand-300'
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-medium text-ink-900">{u.fullName}</span>
                      <span className="block text-xs text-ink-500">{ROLE_LABELS[u.role]}</span>
                    </span>
                    <span className={`text-xs ${count > 2 ? 'font-semibold text-warn-700' : 'text-ink-500'}`}>
                      {count} on this date
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <p className="inline-flex flex-wrap items-center gap-2 text-xs text-ink-500">
          The holder is notified that an inspection has been scheduled. <SimChip />
        </p>
      </div>
    </Modal>
  )
}
