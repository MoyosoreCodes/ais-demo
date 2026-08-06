import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { EmptyState } from '../../components/EmptyState'
import { ReadOnlyField, SelectField, TextAreaField, TextField } from '../../components/Field'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StatusBadge } from '../../components/StatusBadge'
import { Timeline } from '../../components/Timeline'
import { DEMO_TODAY, clientName, formatDate, formatHa, localId } from '../../lib/format'
import { can } from '../../lib/rbac'
import { statusLabel } from '../../lib/workflow'
import { ROLE_LABELS } from '../../lib/types'
import type { LivestockVisit } from '../../lib/types'

/** The lifecycle a complaint moves through (vii.1 ★). */
const VISIT_LIFECYCLE: { status: LivestockVisit['status']; label: string; actor: string }[] = [
  { status: 'registered', label: 'Registered', actor: 'Officer at the district office' },
  { status: 'assigned', label: 'Assigned', actor: 'Named officer' },
  { status: 'in-progress', label: 'Visit made', actor: 'Attending officer' },
  { status: 'resolved', label: 'Resolved', actor: 'Attending officer' },
  { status: 'closed', label: 'Closed', actor: 'Supervising officer' },
]

/**
 * S07 — a single service visit (vii.1 ★, vii.3, vii.4 ★, vii.5).
 *
 * The service history panel is the point of vii.5: everything the department has
 * ever done at this holding, in one place, resolved by Farm ID.
 */
export function VisitDetail() {
  const { id } = useParams<{ id: string }>()
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()

  const [assignOpen, setAssignOpen] = useState(false)
  const [recordOpen, setRecordOpen] = useState(false)

  const visit = db.livestockVisits.find((v) => v.id === id)
  const client = db.clients.find((c) => c.id === visit?.clientId)
  const farm = db.farms.find((f) => f.id === visit?.farmId)
  const officer = db.users.find((u) => u.id === visit?.officerUserId)

  /** Every other service this holding has had (vii.5). */
  const history = useMemo(
    () =>
      visit
        ? db.livestockVisits
            .filter((v) => v.farmId === visit.farmId && v.id !== visit.id)
            .sort((a, b) => (a.scheduledOn < b.scheduledOn ? 1 : -1))
        : [],
    [db.livestockVisits, visit],
  )

  const relatedCases = useMemo(
    () => (visit ? db.surveillanceCases.filter((c) => c.farmId === visit.farmId) : []),
    [db.surveillanceCases, visit],
  )

  if (!visit || !client) {
    return (
      <div className="ais-card">
        <EmptyState
          title="Service visit not found"
          action={<Link to="/livestock" className="ais-btn-secondary">Back to livestock services</Link>}
        />
      </div>
    )
  }

  const stageIndex = VISIT_LIFECYCLE.findIndex((s) => s.status === visit.status)
  const canEdit = can(role, 'livestock.edit')

  const assign = (userId: string) => {
    if (!user) return
    const target = db.users.find((u) => u.id === userId)
    dispatch({
      type: 'visit/update',
      id: visit.id,
      patch: { officerUserId: userId, status: visit.status === 'registered' ? 'assigned' : visit.status },
      change: {
        id: localId('VH'), at: new Date().toISOString(), actorUserId: user.id, actorName: user.fullName,
        action: 'Visit assigned to officer',
        field: 'officer',
        from: officer?.fullName,
        to: target?.fullName ?? userId,
      },
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'livestock.visit.assigned', entityType: 'livestock_visit', entityId: visit.id,
        detail: `Visit assigned to ${target?.fullName ?? userId}`,
      },
    })
    setAssignOpen(false)
    toast({ tone: 'success', title: 'Visit assigned', body: target?.fullName })
  }

  const recordFindings = (patch: Partial<LivestockVisit>) => {
    if (!user) return
    dispatch({
      type: 'visit/update',
      id: visit.id,
      patch: { ...patch, status: 'resolved', visitedOn: patch.visitedOn ?? DEMO_TODAY.toISOString().slice(0, 10) },
      change: {
        id: localId('VH'), at: new Date().toISOString(), actorUserId: user.id, actorName: user.fullName,
        action: 'Visit completed; observations and findings recorded',
        note: patch.findings,
      },
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'livestock.visit.recorded', entityType: 'livestock_visit', entityId: visit.id,
        detail: `${statusLabel(visit.type)} visit recorded at ${farm?.name ?? visit.farmId}`,
      },
    })
    setRecordOpen(false)
    toast({ tone: 'success', title: 'Findings recorded', body: 'The visit is now resolved.' })
  }

  const closeVisit = () => {
    if (!user) return
    dispatch({
      type: 'visit/update',
      id: visit.id,
      patch: { status: 'closed' },
      change: {
        id: localId('VH'), at: new Date().toISOString(), actorUserId: user.id, actorName: user.fullName,
        action: 'Visit closed',
        field: 'status', from: statusLabel(visit.status), to: 'Closed',
      },
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'livestock.visit.closed', entityType: 'livestock_visit', entityId: visit.id,
        detail: `Visit ${visit.id} closed`,
      },
    })
    toast({ tone: 'success', title: 'Visit closed' })
  }

  return (
    <div className="pb-6">
      <PageHeader
        screen="S07"
        title={`${statusLabel(visit.type)} visit — ${visit.species}`}
        description={`${clientName(client)} · ${farm?.name ?? visit.farmId}${farm ? ` · ${farm.district}` : ''}`}
        refs={['vii.3', 'vii.4']}
        actions={
          <>
            <Link to="/livestock" className="ais-btn-secondary">Back to services</Link>
            {canEdit && !['resolved', 'closed'].includes(visit.status) && (
              <>
                <button type="button" className="ais-btn-secondary" onClick={() => setAssignOpen(true)}>
                  {visit.status === 'registered' ? 'Assign officer' : 'Reassign'}
                </button>
                <button type="button" className="ais-btn-primary" onClick={() => setRecordOpen(true)}>
                  Record findings
                </button>
              </>
            )}
            {canEdit && visit.status === 'resolved' && (
              <button type="button" className="ais-btn-secondary" onClick={closeVisit}>
                Close visit
              </button>
            )}
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded bg-ink-100 px-2 py-1 font-mono text-xs font-semibold text-ink-700">{visit.id}</span>
          <StatusBadge status={visit.status} />
          {visit.type === 'complaint' && <StatusBadge status="complaint" tone="warn" label="Complaint" />}
          <Link
            to={`/clients/${client.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800 hover:bg-brand-100"
          >
            {clientName(client)} · {client.id}
            <ReqBadge refs="vii.4" screen="S07" />
          </Link>
          {farm && (
            <Link
              to={`/farms/${farm.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-0.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
            >
              {farm.name} · {farm.id}
            </Link>
          )}
        </div>
      </PageHeader>

      {/* ------------------------------------------ complaint lifecycle */}
      <section className="ais-card mb-5 p-4">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
          {visit.type === 'complaint' ? 'Complaint handling' : 'Visit progress'}
          <ReqBadge refs="vii.1" screen="S07" />
        </h2>
        <ol className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-0">
          {VISIT_LIFECYCLE.map((step, i) => {
            const done = i < stageIndex
            const active = i === stageIndex
            return (
              <li key={step.status} className="flex gap-3 sm:flex-1 sm:flex-col sm:gap-2">
                <div className="flex shrink-0 flex-col items-center sm:w-full sm:flex-row">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      done ? 'bg-brand-600 text-white' : active ? 'bg-white text-brand-700 ring-2 ring-brand-600' : 'bg-white text-ink-400 ring-1 ring-ink-300'
                    }`}
                    aria-hidden
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  {i < VISIT_LIFECYCLE.length - 1 && (
                    <span className={`w-px flex-1 sm:h-px sm:w-full ${done ? 'bg-brand-400' : 'bg-ink-200'}`} aria-hidden />
                  )}
                </div>
                <div className="min-w-0 pb-1 sm:pr-4">
                  <p className="text-sm font-semibold text-ink-900">{step.label}</p>
                  <p className="text-xs text-ink-500">{step.actor}</p>
                  <p className={`mt-0.5 text-xs font-medium ${done || active ? 'text-brand-700' : 'text-ink-400'}`}>
                    {active ? 'Current step' : done ? 'Complete' : 'Not reached'}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        {/* --------------------------------------- observations & findings */}
        <section className="ais-card p-4">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
            Observations and findings
            <ReqBadge refs="vii.3" screen="S07" />
          </h2>

          {visit.complaintSummary && (
            <div className="mb-3 rounded-lg border border-warn-200 bg-warn-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-warn-700">Complaint reported</p>
              <p className="mt-0.5 text-sm text-warn-900">{visit.complaintSummary}</p>
            </div>
          )}

          {visit.observations || visit.findings ? (
            <dl className="space-y-3">
              <ReadOnlyField label="Observations on site" value={visit.observations} />
              <ReadOnlyField label="Findings" value={visit.findings} />
              <ReadOnlyField label="Action taken" value={visit.actionTaken} />
              {visit.followUpOn && <ReadOnlyField label="Follow-up due" value={formatDate(visit.followUpOn)} />}
            </dl>
          ) : (
            <p className="text-sm text-ink-500">
              No observations recorded yet — the visit has not been made.
            </p>
          )}
        </section>

        {/* -------------------------------------------------- visit details */}
        <div className="space-y-5">
          <section className="ais-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Visit details</h2>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
              <ReadOnlyField label="Reference" value={<span className="font-mono">{visit.id}</span>} />
              <ReadOnlyField label="Type" value={statusLabel(visit.type)} />
              <ReadOnlyField label="Species" value={visit.species} />
              <ReadOnlyField label="Attending officer" value={officer ? `${officer.fullName} · ${ROLE_LABELS[officer.role]}` : 'Unassigned'} />
              <ReadOnlyField label="Scheduled" value={formatDate(visit.scheduledOn)} />
              <ReadOnlyField label="Visited" value={visit.visitedOn ? formatDate(visit.visitedOn) : '—'} />
              {farm && <ReadOnlyField label="Holding size" value={formatHa(farm.sizeHa)} />}
              {farm && (
                <ReadOnlyField
                  label="Livestock on record"
                  value={farm.livestock.map((l) => `${l.headcount} ${l.type}`).join(', ') || '—'}
                />
              )}
            </dl>
          </section>

          {relatedCases.length > 0 && (
            <section className="ais-card p-4">
              <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Surveillance at this holding
                <ReqBadge refs="viii.4" screen="S07" />
              </h2>
              <ul className="space-y-2">
                {relatedCases.map((c) => (
                  <li key={c.id} className="rounded-lg border border-ink-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link to={`/surveillance/${c.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                        {c.suspectedDisease}
                      </Link>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="font-mono text-xs text-ink-500">{c.id} · reported {formatDate(c.reportedOn)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* ----------------------------------------------- service history */}
      <section className="ais-card mt-5 p-4">
        <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
          Service history at {farm?.name ?? 'this holding'}
          <ReqBadge refs="vii.5" screen="S07" />
          <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">
            {history.length}
          </span>
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-500">This is the only service visit recorded at this holding.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((v) => (
              <li key={v.id} className="rounded-lg border border-ink-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/livestock/${v.id}`} className="text-sm font-medium capitalize text-brand-700 hover:underline">
                    {v.type} visit · {v.species}
                  </Link>
                  <StatusBadge status={v.status} />
                </div>
                <p className="font-mono text-xs text-ink-500">
                  {v.id} · {formatDate(v.visitedOn ?? v.scheduledOn)}
                </p>
                {v.findings && <p className="mt-1 text-sm text-ink-600">{v.findings}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ais-card mt-5 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Visit history</h2>
          <SimChip label="append-only" title="Entries are appended, never edited or removed." />
        </div>
        <Timeline events={visit.history} />
      </section>

      {/* ---------------------------------------------------- dialogs */}
      <AssignDialog open={assignOpen} onClose={() => setAssignOpen(false)} onAssign={assign} currentId={visit.officerUserId} />
      <RecordFindingsDialog open={recordOpen} onClose={() => setRecordOpen(false)} visit={visit} onSave={recordFindings} />
    </div>
  )
}

function AssignDialog({
  open, onClose, onAssign, currentId,
}: {
  open: boolean
  onClose: () => void
  onAssign: (userId: string) => void
  currentId: string
}) {
  const db = useDb()
  const officers = db.users.filter(
    (u) => u.status === 'active' && ['agriculture_officer', 'field_officer'].includes(u.role),
  )

  return (
    <Modal open={open} onClose={onClose} title="Assign the visit" size="sm" description="The named officer becomes responsible for attending and recording findings.">
      <ul className="space-y-2">
        {officers.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => onAssign(u.id)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                u.id === currentId ? 'border-brand-400 bg-brand-50' : 'border-ink-200 hover:border-brand-300 hover:bg-brand-50/50'
              }`}
            >
              <span>
                <span className="block text-sm font-medium text-ink-900">{u.fullName}</span>
                <span className="block text-xs text-ink-500">{ROLE_LABELS[u.role]}</span>
              </span>
              {u.id === currentId && <span className="text-xs font-semibold text-brand-700">Current</span>}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

function RecordFindingsDialog({
  open, onClose, visit, onSave,
}: {
  open: boolean
  onClose: () => void
  visit: LivestockVisit
  onSave: (patch: Partial<LivestockVisit>) => void
}) {
  const [observations, setObservations] = useState(visit.observations)
  const [findings, setFindings] = useState(visit.findings)
  const [actionTaken, setActionTaken] = useState(visit.actionTaken)
  const [visitedOn, setVisitedOn] = useState(visit.visitedOn ?? DEMO_TODAY.toISOString().slice(0, 10))
  const [followUp, setFollowUp] = useState(visit.followUpOn ?? '')

  const canSave = observations.trim().length > 5 && findings.trim().length > 3

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record observations and findings"
      size="md"
      description="Structured capture from the visit. Recording findings resolves the visit."
      footer={
        <>
          <button type="button" className="ais-btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="ais-btn-primary"
            disabled={!canSave}
            onClick={() =>
              onSave({
                observations: observations.trim(),
                findings: findings.trim(),
                actionTaken: actionTaken.trim(),
                visitedOn,
                followUpOn: followUp || undefined,
              })
            }
          >
            Record and resolve
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <TextAreaField
          label="Observations on site"
          required
          rows={3}
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          placeholder="e.g. Flock of 240 broilers at 28 days. Housing dry and well ventilated. Two birds with mild respiratory rales isolated in the sick pen."
        />
        <TextAreaField
          label="Findings"
          required
          rows={3}
          value={findings}
          onChange={(e) => setFindings(e.target.value)}
          placeholder="e.g. Flock condition generally good. Vaccination record for Newcastle disease is up to date."
        />
        <TextAreaField
          label="Action taken and advice"
          rows={2}
          value={actionTaken}
          onChange={(e) => setActionTaken(e.target.value)}
          placeholder="e.g. Advised on night ventilation and litter turning. Isolated birds monitored daily."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Date of visit" type="date" value={visitedOn} onChange={(e) => setVisitedOn(e.target.value)} />
          <TextField label="Follow-up due" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} hint="Optional." />
        </div>
        <SelectField label="Species concerned" value={visit.species} disabled hint="Set when the visit was registered.">
          <option value={visit.species}>{visit.species}</option>
        </SelectField>
      </div>
    </Modal>
  )
}
