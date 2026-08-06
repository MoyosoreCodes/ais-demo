import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { SelectField, TextAreaField, TextField } from '../../components/Field'
import { KpiCard } from '../../components/KpiCard'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { StatusBadge } from '../../components/StatusBadge'
import { Tabs } from '../../components/Tabs'
import { exportTableExcel, exportTablePdf } from '../../lib/export'
import { DEMO_TODAY, clientName, formatDate, localId, nextVisitId } from '../../lib/format'
import { can } from '../../lib/rbac'
import { statusLabel } from '../../lib/workflow'
import { LIVESTOCK_TYPES, ROLE_LABELS } from '../../lib/types'
import type { LivestockType, LivestockVisit } from '../../lib/types'

/** Complaints an officer records at the counter or over the telephone. */
const COMPLAINT_TEMPLATES = [
  'Sudden drop in egg production reported by the farmer.',
  'Unexplained mortality in the flock overnight.',
  'Animals showing lameness and reluctance to feed.',
  'Neighbour complaint regarding odour from the piggery.',
  'Suspected feed contamination — stock off feed.',
  'Pale combs and reduced water intake in the layer flock.',
]

/**
 * S07 — livestock services (vii.1 ★, vii.2, vii.5, vii.6).
 *
 * Complaint and routine visits share one register because they share one
 * record: the difference is how the visit started, not what is captured.
 */
export function LivestockServices() {
  const db = useDb()
  const { role } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [captureOpen, setCaptureOpen] = useState(false)
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null)

  const clientById = useMemo(() => new Map(db.clients.map((c) => [c.id, c])), [db.clients])
  const farmById = useMemo(() => new Map(db.farms.map((f) => [f.id, f])), [db.farms])
  const userById = useMemo(() => new Map(db.users.map((u) => [u.id, u])), [db.users])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return db.livestockVisits.filter((v) => {
      if (tab !== 'all' && v.type !== tab) return false
      if (status === 'open' ? ['resolved', 'closed'].includes(v.status) : status !== 'all' && v.status !== status) {
        return false
      }
      if (!q) return true
      const owner = clientById.get(v.clientId)
      const farm = farmById.get(v.farmId)
      return [
        v.id, v.type, v.species, v.status, v.complaintSummary ?? '', v.findings, v.observations,
        farm?.name ?? '', owner ? `${owner.firstName} ${owner.lastName} ${owner.id}` : '',
      ].join(' ').toLowerCase().includes(q)
    })
  }, [db.livestockVisits, clientById, farmById, tab, status, query])

  const kpis = useMemo(() => {
    const complaints = db.livestockVisits.filter((v) => v.type === 'complaint')
    const open = db.livestockVisits.filter((v) => !['resolved', 'closed'].includes(v.status))
    const unassigned = db.livestockVisits.filter((v) => v.status === 'registered')
    return {
      total: db.livestockVisits.length,
      complaints: complaints.length,
      openComplaints: complaints.filter((v) => !['resolved', 'closed'].includes(v.status)).length,
      open: open.length,
      unassigned: unassigned.length,
    }
  }, [db.livestockVisits])

  const reportOptions = {
    title: 'Livestock service report',
    subtitle: tab === 'all' ? 'Complaint and routine visits' : `${statusLabel(tab)} visits`,
    columns: [
      { header: 'Reference', value: (v: LivestockVisit) => v.id },
      { header: 'Type', value: (v: LivestockVisit) => statusLabel(v.type) },
      { header: 'Species', value: (v: LivestockVisit) => v.species },
      { header: 'Farmer', value: (v: LivestockVisit) => clientName(clientById.get(v.clientId)) },
      { header: 'Client ID', value: (v: LivestockVisit) => v.clientId },
      { header: 'Holding', value: (v: LivestockVisit) => farmById.get(v.farmId)?.name ?? v.farmId },
      { header: 'District', value: (v: LivestockVisit) => farmById.get(v.farmId)?.district ?? '—' },
      { header: 'Officer', value: (v: LivestockVisit) => userById.get(v.officerUserId)?.fullName ?? v.officerUserId },
      { header: 'Scheduled', value: (v: LivestockVisit) => v.scheduledOn },
      { header: 'Visited', value: (v: LivestockVisit) => v.visitedOn ?? '—' },
      { header: 'Status', value: (v: LivestockVisit) => statusLabel(v.status) },
      { header: 'Findings', value: (v: LivestockVisit) => v.findings || '—' },
    ],
    rows: filtered,
    meta: [
      { label: 'Visits in view', value: String(filtered.length) },
      { label: 'Complaint visits', value: String(filtered.filter((v) => v.type === 'complaint').length) },
      { label: 'Open', value: String(filtered.filter((v) => !['resolved', 'closed'].includes(v.status)).length) },
    ],
    notes: [
      `${kpis.openComplaints} complaint visits are open across the service; ${kpis.unassigned} visits have not yet been assigned to an officer.`,
    ],
    orientation: 'landscape' as const,
    fileStem: 'livestock-service-report',
  }

  const runExport = async (kind: 'pdf' | 'excel') => {
    setBusy(kind)
    try {
      await (kind === 'pdf' ? exportTablePdf(reportOptions) : exportTableExcel(reportOptions))
      toast({ tone: 'success', title: `${kind === 'pdf' ? 'PDF' : 'Excel'} report generated`, body: `${filtered.length} visits exported.` })
    } finally {
      setBusy(null)
    }
  }

  const columns: Column<LivestockVisit>[] = [
    {
      key: 'ref',
      header: 'Visit',
      sortValue: (v) => v.id,
      render: (v) => (
        <div className="min-w-0">
          <p className="truncate font-medium capitalize text-ink-900">
            {v.type} visit · {v.species}
          </p>
          <p className="font-mono text-xs text-ink-500">{v.id}</p>
        </div>
      ),
    },
    {
      key: 'farmer',
      header: 'Farmer',
      sortValue: (v) => clientName(clientById.get(v.clientId)),
      render: (v) => {
        const owner = clientById.get(v.clientId)
        return owner ? (
          <Link to={`/clients/${owner.id}`} onClick={(e) => e.stopPropagation()} className="text-sm text-brand-700 hover:underline">
            {clientName(owner)}
            <span className="block font-mono text-xs text-ink-500">{owner.id}</span>
          </Link>
        ) : <span className="text-xs text-ink-400">—</span>
      },
    },
    {
      key: 'holding',
      header: 'Holding',
      sortValue: (v) => farmById.get(v.farmId)?.name ?? '',
      render: (v) => {
        const farm = farmById.get(v.farmId)
        return (
          <span className="text-sm">
            {farm?.name ?? v.farmId}
            <span className="block text-xs text-ink-500">{farm?.district ?? ''}</span>
          </span>
        )
      },
      hideOnMobile: true,
    },
    {
      key: 'summary',
      header: 'Reason / findings',
      render: (v) => (
        <span className="text-sm text-ink-700">
          {v.complaintSummary || v.findings || <span className="text-ink-400">Routine schedule</span>}
        </span>
      ),
    },
    {
      key: 'officer',
      header: 'Officer',
      sortValue: (v) => userById.get(v.officerUserId)?.fullName ?? '',
      render: (v) => <span className="text-sm">{userById.get(v.officerUserId)?.fullName ?? '—'}</span>,
      hideOnMobile: true,
    },
    {
      key: 'date',
      header: 'Date',
      sortValue: (v) => v.visitedOn ?? v.scheduledOn,
      render: (v) => (
        <span className="whitespace-nowrap text-sm">
          {formatDate(v.visitedOn ?? v.scheduledOn)}
          <span className="block text-xs text-ink-500">{v.visitedOn ? 'visited' : 'scheduled'}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (v) => v.status,
      render: (v) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StatusBadge status={v.status} />
          {v.type === 'complaint' && <StatusBadge status="complaint" tone="warn" label="Complaint" />}
        </span>
      ),
    },
  ]

  return (
    <div className="pb-6">
      <PageHeader
        screen="S07"
        title="Livestock services"
        description="Complaint and routine visits to registered holdings, with the observations and findings each visit produced."
        refs={['vii.1', 'vii.2', 'vii.5']}
        actions={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => void runExport('excel')} disabled={busy !== null || !filtered.length}>
              {busy === 'excel' ? 'Generating…' : 'Export Excel'}
            </button>
            <button type="button" className="ais-btn-secondary" onClick={() => void runExport('pdf')} disabled={busy !== null || !filtered.length}>
              {busy === 'pdf' ? 'Generating…' : 'Export PDF'}
              <ReqBadge refs="vii.6" screen="S07" />
            </button>
            {can(role, 'livestock.edit') && (
              <button type="button" className="ais-btn-primary" onClick={() => setCaptureOpen(true)}>
                Register a visit
                <ReqBadge refs={['vii.1', 'vii.2']} screen="S07" />
              </button>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Service visits" value={kpis.total} hint="All time" onClick={() => { setTab('all'); setStatus('all') }} active={tab === 'all' && status === 'all'} />
        <KpiCard label="Complaint visits" value={kpis.complaints} hint="Farmer or neighbour reported" tone="warn" refs={['vii.1']} screen="S07" onClick={() => setTab('complaint')} active={tab === 'complaint'} />
        <KpiCard label="Open complaints" value={kpis.openComplaints} hint="Not yet resolved" tone={kpis.openComplaints ? 'warn' : 'good'} />
        <KpiCard label="Open visits" value={kpis.open} hint="Any type" onClick={() => setStatus('open')} active={status === 'open'} />
        <KpiCard label="Awaiting assignment" value={kpis.unassigned} hint="Registered, no officer yet" tone={kpis.unassigned ? 'bad' : 'good'} onClick={() => setStatus('registered')} active={status === 'registered'} />
      </div>

      <Tabs
        tabs={[
          { id: 'all', label: 'All visits', count: db.livestockVisits.length },
          { id: 'complaint', label: 'Complaint visits', count: db.livestockVisits.filter((v) => v.type === 'complaint').length },
          { id: 'routine', label: 'Routine visits', count: db.livestockVisits.filter((v) => v.type === 'routine').length },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-3"
      />

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(v) => v.id}
        onRowClick={(v) => navigate(`/livestock/${v.id}`)}
        unit="visits"
        pageSize={12}
        initialSort={{ key: 'date', direction: 'desc' }}
        caption="Livestock service visits"
        emptyTitle="No visits match this filter"
        toolbar={
          <div className="ais-card p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label htmlFor="visit-search" className="ais-label">Search</label>
                <input
                  id="visit-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Reference, farmer, holding, species or findings…"
                  className="ais-input"
                />
              </div>
              <div>
                <label htmlFor="visit-status" className="ais-label">Status</label>
                <select id="visit-status" value={status} onChange={(e) => setStatus(e.target.value)} className="ais-input">
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="registered">Registered</option>
                  <option value="assigned">Assigned</option>
                  <option value="in-progress">In progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>
        }
      />

      <RegisterVisitDialog open={captureOpen} onClose={() => setCaptureOpen(false)} />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Register a visit (vii.1 ★, vii.2)
 * ------------------------------------------------------------------ */

function RegisterVisitDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDb()
  const dispatch = useDispatch()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [type, setType] = useState<'complaint' | 'routine'>('complaint')
  const [farmId, setFarmId] = useState('')
  const [species, setSpecies] = useState<LivestockType>('broiler')
  const [scheduledOn, setScheduledOn] = useState(DEMO_TODAY.toISOString().slice(0, 10))
  const [officerUserId, setOfficerUserId] = useState('')
  const [complaint, setComplaint] = useState(COMPLAINT_TEMPLATES[0])

  const livestockFarms = useMemo(
    () => db.farms.filter((f) => f.status === 'registered' && f.livestock.length > 0),
    [db.farms],
  )
  const farm = livestockFarms.find((f) => f.id === farmId)
  const owner = db.clients.find((c) => c.id === farm?.clientId)

  const officers = useMemo(
    () => db.users.filter((u) => u.status === 'active' && ['agriculture_officer', 'field_officer'].includes(u.role)),
    [db.users],
  )

  const canSave = Boolean(farm) && (type === 'routine' || complaint.trim().length > 5)

  const save = () => {
    if (!user || !farm || !owner || !canSave) return
    const id = nextVisitId(db.livestockVisits.map((v) => v.id))
    const now = new Date().toISOString()
    const assigned = Boolean(officerUserId)

    const visit: LivestockVisit = {
      id,
      type,
      clientId: owner.id,
      farmId: farm.id,
      species,
      scheduledOn,
      officerUserId: officerUserId || user.id,
      status: assigned ? 'assigned' : 'registered',
      complaintSummary: type === 'complaint' ? complaint.trim() : undefined,
      observations: '',
      findings: '',
      actionTaken: '',
      history: [
        {
          id: localId('VH'), at: now, actorUserId: user.id, actorName: user.fullName,
          action: type === 'complaint' ? 'Complaint registered' : 'Routine visit scheduled',
          note: type === 'complaint' ? complaint.trim() : `Scheduled for ${formatDate(scheduledOn)}.`,
        },
        ...(assigned
          ? [{
              id: localId('VH'), at: now, actorUserId: user.id, actorName: user.fullName,
              action: 'Visit assigned to officer',
              field: 'officer',
              to: db.users.find((u) => u.id === officerUserId)?.fullName ?? officerUserId,
            }]
          : []),
      ],
    }

    dispatch({
      type: 'visit/create',
      visit,
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: type === 'complaint' ? 'livestock.complaint.registered' : 'livestock.visit.scheduled',
        entityType: 'livestock_visit', entityId: id,
        detail: `${statusLabel(type)} visit registered for ${farm.name} (${farm.id}) — ${species}`,
      },
    })

    toast({ tone: 'success', title: `${statusLabel(type)} visit registered`, body: `${id} created.` })
    onClose()
    navigate(`/livestock/${id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register a livestock service visit"
      size="md"
      description="Complaint visits start from a report; routine visits from the extension schedule. Both produce the same structured record."
      footer={
        <>
          <button type="button" className="ais-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="ais-btn-primary" onClick={save} disabled={!canSave}>
            Register visit
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="ais-label mb-1.5">Visit type</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              { id: 'complaint', label: 'Complaint visit', detail: 'Reported by the farmer, a neighbour or the hotline.' },
              { id: 'routine', label: 'Routine visit', detail: 'Scheduled extension or monitoring visit.' },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setType(opt.id)}
                aria-pressed={type === opt.id}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  type === opt.id ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-brand-300'
                }`}
              >
                <span className="block text-sm font-semibold text-ink-900">{opt.label}</span>
                <span className="mt-0.5 block text-xs text-ink-600">{opt.detail}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <SelectField
          label="Holding"
          required
          value={farmId}
          onChange={(e) => {
            setFarmId(e.target.value)
            const f = livestockFarms.find((x) => x.id === e.target.value)
            if (f?.livestock[0]) setSpecies(f.livestock[0].type)
          }}
          badge={<ReqBadge refs="vii.4" screen="S07" />}
          hint="Only holdings with livestock recorded on the farm registry are listed."
        >
          <option value="">Select a holding…</option>
          {livestockFarms.map((f) => {
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
            <p className="font-mono text-xs text-ink-600">{owner.id} · {farm.id}</p>
            <p className="mt-0.5 text-xs text-ink-600">
              {farm.livestock.map((l) => `${l.headcount} ${l.type}`).join(', ') || 'No livestock recorded'}
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Species concerned" value={species} onChange={(e) => setSpecies(e.target.value as LivestockType)}>
            {LIVESTOCK_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </SelectField>
          <TextField label="Scheduled for" type="date" value={scheduledOn} onChange={(e) => setScheduledOn(e.target.value)} />
        </div>

        <SelectField
          label="Assign to officer"
          value={officerUserId}
          onChange={(e) => setOfficerUserId(e.target.value)}
          hint="Optional at registration. An unassigned visit shows on the awaiting-assignment tile."
        >
          <option value="">Leave unassigned</option>
          {officers.map((u) => (
            <option key={u.id} value={u.id}>{u.fullName} · {ROLE_LABELS[u.role]}</option>
          ))}
        </SelectField>

        {type === 'complaint' && (
          <TextAreaField
            label="Complaint reported"
            required
            rows={3}
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            hint="What the farmer or complainant described. Recorded verbatim on the visit."
          />
        )}
      </div>
    </Modal>
  )
}
