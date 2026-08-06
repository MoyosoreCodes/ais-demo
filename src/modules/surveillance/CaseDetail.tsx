import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { EmptyState } from '../../components/EmptyState'
import { ReadOnlyField, TextAreaField } from '../../components/Field'
import { MapView } from '../../components/MapPicker'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StatusBadge } from '../../components/StatusBadge'
import { Timeline } from '../../components/Timeline'
import { clientName, formatDate, localId } from '../../lib/format'
import { composeNotification, templatesFor } from '../../lib/notify'
import { can } from '../../lib/rbac'
import { statusLabel } from '../../lib/workflow'
import { ROLE_LABELS } from '../../lib/types'
import type { SurveillanceCase } from '../../lib/types'

/** Investigation lifecycle (viii.2 ★). Confirmed and negative are terminal outcomes. */
const CASE_LIFECYCLE: { status: SurveillanceCase['status']; label: string; actor: string }[] = [
  { status: 'reported', label: 'Reported', actor: 'Farmer, officer or hotline' },
  { status: 'assigned', label: 'Assigned', actor: 'Supervisor' },
  { status: 'investigating', label: 'Investigating', actor: 'Assigned officer' },
  { status: 'sampled', label: 'Sampled', actor: 'Assigned officer' },
  { status: 'closed', label: 'Closed', actor: 'Supervisor' },
]

/**
 * S08 — a single surveillance case (viii.2 ★, viii.3, viii.4 ★).
 *
 * viii.4 is the substance of this screen: a case is only useful if it resolves
 * to a holding *and* to the laboratory submission that will confirm or clear it.
 */
export function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()

  const [assignOpen, setAssignOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [outcomeOpen, setOutcomeOpen] = useState<'confirmed' | 'negative' | null>(null)
  const [note, setNote] = useState('')

  const surveillanceCase = db.surveillanceCases.find((c) => c.id === id)
  const client = db.clients.find((c) => c.id === surveillanceCase?.clientId)
  const farm = db.farms.find((f) => f.id === surveillanceCase?.farmId)
  const officer = db.users.find((u) => u.id === surveillanceCase?.assignedOfficerUserId)
  const sample = db.samples.find((s) => s.id === surveillanceCase?.linkedSampleId)

  /** Samples from the same holding — the candidates for linking. */
  const candidateSamples = useMemo(
    () => (surveillanceCase ? db.samples.filter((s) => s.farmId === surveillanceCase.farmId) : []),
    [db.samples, surveillanceCase],
  )

  const relatedVisits = useMemo(
    () => (surveillanceCase ? db.livestockVisits.filter((v) => v.farmId === surveillanceCase.farmId) : []),
    [db.livestockVisits, surveillanceCase],
  )

  const priorCases = useMemo(
    () =>
      surveillanceCase
        ? db.surveillanceCases
            .filter((c) => c.farmId === surveillanceCase.farmId && c.id !== surveillanceCase.id)
            .sort((a, b) => (a.reportedOn < b.reportedOn ? 1 : -1))
        : [],
    [db.surveillanceCases, surveillanceCase],
  )

  if (!surveillanceCase || !client) {
    return (
      <div className="ais-card">
        <EmptyState
          title="Surveillance case not found"
          action={<Link to="/surveillance" className="ais-btn-secondary">Back to surveillance</Link>}
        />
      </div>
    )
  }

  const c = surveillanceCase
  const stageIndex = ['confirmed', 'negative'].includes(c.status)
    ? CASE_LIFECYCLE.length - 1
    : CASE_LIFECYCLE.findIndex((s) => s.status === c.status)
  const isOpen = !['confirmed', 'negative', 'closed'].includes(c.status)
  const canAssign = can(role, 'surveillance.assign')
  const canEdit = can(role, 'surveillance.edit')

  const notifyFarmer = (statusText: string) => {
    for (const template of templatesFor(db.notificationTemplates, 'surveillance.case.updated')) {
      dispatch({
        type: 'notification/add',
        notification: composeNotification({
          template,
          client,
          vars: { caseId: c.id, disease: c.suspectedDisease, status: statusText },
          relatedType: 'surveillance',
          relatedId: c.id,
        }),
      })
    }
  }

  const update = (
    patch: Partial<SurveillanceCase>,
    action: string,
    detail: string,
    auditAction: string,
    extra?: { field?: string; from?: string; to?: string; note?: string },
  ) => {
    if (!user) return
    dispatch({
      type: 'case/update',
      id: c.id,
      patch,
      change: {
        id: localId('CH'), at: new Date().toISOString(), actorUserId: user.id, actorName: user.fullName,
        action, ...extra,
      },
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: auditAction, entityType: 'surveillance', entityId: c.id, detail,
      },
    })
  }

  const assign = (userId: string) => {
    const target = db.users.find((u) => u.id === userId)
    update(
      { assignedOfficerUserId: userId, status: c.status === 'reported' ? 'assigned' : c.status },
      'Case assigned to officer',
      `Case assigned to ${target?.fullName ?? userId}`,
      'surveillance.case.assigned',
      { field: 'assignedOfficerUserId', from: officer?.fullName, to: target?.fullName ?? userId },
    )
    notifyFarmer('assigned to an officer')
    setAssignOpen(false)
    toast({ tone: 'success', title: 'Case assigned', body: target?.fullName, simulated: true })
  }

  const beginInvestigation = () => {
    update(
      { status: 'investigating' },
      'Investigation started',
      `Investigation started on ${c.id}`,
      'surveillance.case.investigating',
      { field: 'status', from: statusLabel(c.status), to: 'Investigating' },
    )
    notifyFarmer('under investigation')
    toast({ tone: 'success', title: 'Investigation started', simulated: true })
  }

  const linkSample = (sampleId: string) => {
    update(
      { linkedSampleId: sampleId, status: 'sampled' },
      `Laboratory submission linked (${sampleId})`,
      `Laboratory submission ${sampleId} linked to case ${c.id}`,
      'surveillance.case.linked',
      { field: 'linkedSampleId', from: c.linkedSampleId, to: sampleId },
    )
    notifyFarmer('sampled — laboratory testing in progress')
    setLinkOpen(false)
    toast({ tone: 'success', title: 'Laboratory submission linked', body: sampleId, simulated: true })
  }

  const recordOutcome = (outcome: 'confirmed' | 'negative') => {
    update(
      { status: outcome, notes: note.trim() ? `${c.notes}\n\n${note.trim()}` : c.notes },
      outcome === 'confirmed' ? 'Disease confirmed' : 'Case cleared — laboratory negative',
      `Case ${c.id} recorded as ${outcome}`,
      outcome === 'confirmed' ? 'surveillance.case.confirmed' : 'surveillance.case.negative',
      { field: 'status', from: statusLabel(c.status), to: statusLabel(outcome), note: note.trim() || undefined },
    )
    notifyFarmer(outcome === 'confirmed' ? 'confirmed by the laboratory' : 'cleared — laboratory result negative')
    setOutcomeOpen(null)
    setNote('')
    toast({
      tone: outcome === 'confirmed' ? 'warning' : 'success',
      title: outcome === 'confirmed' ? 'Disease confirmed' : 'Case cleared',
      body: 'The holder has been notified.',
      simulated: true,
    })
  }

  const closeCase = () => {
    update(
      { status: 'closed' },
      'Case closed',
      `Case ${c.id} closed`,
      'surveillance.case.closed',
      { field: 'status', from: statusLabel(c.status), to: 'Closed' },
    )
    toast({ tone: 'success', title: 'Case closed' })
  }

  return (
    <div className="pb-6">
      <PageHeader
        screen="S08"
        title={c.suspectedDisease}
        description={`${c.species} · ${clientName(client)} · ${farm?.name ?? c.farmId}`}
        refs={['viii.2', 'viii.4']}
        actions={
          <>
            <Link to="/surveillance" className="ais-btn-secondary">Back to register</Link>
            {canAssign && isOpen && (
              <button type="button" className="ais-btn-secondary" onClick={() => setAssignOpen(true)}>
                {c.assignedOfficerUserId ? 'Reassign' : 'Assign officer'}
                <ReqBadge refs="viii.3" screen="S08" />
              </button>
            )}
            {canEdit && c.status === 'assigned' && (
              <button type="button" className="ais-btn-secondary" onClick={beginInvestigation}>
                Start investigation
              </button>
            )}
            {canEdit && isOpen && (
              <button type="button" className="ais-btn-secondary" onClick={() => setLinkOpen(true)}>
                {c.linkedSampleId ? 'Change laboratory link' : 'Link laboratory submission'}
                <ReqBadge refs="viii.4" screen="S08" />
              </button>
            )}
            {canEdit && c.status === 'sampled' && (
              <>
                <button type="button" className="ais-btn-secondary" onClick={() => setOutcomeOpen('negative')}>
                  Record negative
                </button>
                <button type="button" className="ais-btn-danger" onClick={() => setOutcomeOpen('confirmed')}>
                  Confirm disease
                </button>
              </>
            )}
            {canAssign && ['confirmed', 'negative'].includes(c.status) && (
              <button type="button" className="ais-btn-secondary" onClick={closeCase}>
                Close case
              </button>
            )}
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded bg-ink-100 px-2 py-1 font-mono text-xs font-semibold text-ink-700">{c.id}</span>
          <StatusBadge status={c.status} />
          <span className="text-sm text-ink-700">
            {c.affectedCount} affected · {c.mortalityCount} mortality
          </span>
          <Link
            to={`/clients/${client.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800 hover:bg-brand-100"
          >
            {clientName(client)} · {client.id}
          </Link>
          {farm && (
            <Link
              to={`/farms/${farm.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-0.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
            >
              {farm.name} · {farm.id}
              <ReqBadge refs="viii.4" screen="S08" />
            </Link>
          )}
        </div>
      </PageHeader>

      {/* --------------------------------------------------- lifecycle */}
      <section className="ais-card mb-5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
            Investigation lifecycle
            <ReqBadge refs="viii.2" screen="S08" />
          </h2>
          {['confirmed', 'negative'].includes(c.status) && (
            <StatusBadge
              status={c.status}
              label={c.status === 'confirmed' ? 'Outcome: disease confirmed' : 'Outcome: laboratory negative'}
            />
          )}
        </div>
        <ol className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-0">
          {CASE_LIFECYCLE.map((step, i) => {
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
                  {i < CASE_LIFECYCLE.length - 1 && (
                    <span className={`w-px flex-1 sm:h-px sm:w-full ${done ? 'bg-brand-400' : 'bg-ink-200'}`} aria-hidden />
                  )}
                </div>
                <div className="min-w-0 pb-1 sm:pr-4">
                  <p className="text-sm font-semibold text-ink-900">{step.label}</p>
                  <p className="text-xs text-ink-500">{step.actor}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          {/* ------------------------------------------------ case detail */}
          <section className="ais-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Case detail</h2>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
              <ReadOnlyField label="Case reference" value={<span className="font-mono">{c.id}</span>} />
              <ReadOnlyField label="Suspected disease" value={c.suspectedDisease} />
              <ReadOnlyField label="Species" value={c.species} />
              <ReadOnlyField label="Reported" value={formatDate(c.reportedOn)} />
              <ReadOnlyField label="Reported by" value={c.reportedBy} />
              <ReadOnlyField label="Channel" value={statusLabel(c.reportedVia)} />
              <ReadOnlyField label="Animals affected" value={String(c.affectedCount)} />
              <ReadOnlyField label="Mortality" value={String(c.mortalityCount)} />
              <ReadOnlyField
                label="Assigned officer"
                value={officer ? `${officer.fullName} · ${ROLE_LABELS[officer.role]}` : 'Unassigned'}
                badge={<ReqBadge refs="viii.3" screen="S08" />}
                className="col-span-2"
              />
              <ReadOnlyField label="Notes" value={<span className="whitespace-pre-line">{c.notes}</span>} className="col-span-2" />
            </dl>
          </section>

          {/* --------------------------------------- laboratory linkage */}
          <section className="ais-card p-4">
            <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              Laboratory submission
              <ReqBadge refs="viii.4" screen="S08" />
            </h2>
            {sample ? (
              <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/lab/${sample.id}`} className="text-sm font-semibold text-brand-800 hover:underline">
                    {sample.type.charAt(0).toUpperCase() + sample.type.slice(1)} sample {sample.id}
                  </Link>
                  <StatusBadge status={sample.status} />
                </div>
                <p className="mt-0.5 text-xs text-ink-600">{sample.purpose}</p>
                {sample.results.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {sample.results.map((r) => (
                      <li key={r.parameter} className="rounded border border-ink-200 bg-white px-2 py-1 text-xs">
                        <span className="text-ink-600">{r.parameter}</span>{' '}
                        <span className="font-semibold text-ink-900">{r.value}{r.unit && ` ${r.unit}`}</span>{' '}
                        <StatusBadge status={r.flag} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-ink-600">
                    Testing is in progress — no results have been validated yet.
                  </p>
                )}
                {sample.interpretation && (
                  <p className="mt-2 text-sm text-ink-700">
                    <strong className="text-ink-900">Interpretation. </strong>
                    {sample.interpretation}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-500">
                No laboratory submission is linked to this case yet. Linking one moves the case to
                <em> sampled</em> and lets the result decide the outcome.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-5">
          {farm && (
            <section className="ais-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-ink-900">Holding</h2>
              <dl className="mb-3 grid grid-cols-2 gap-x-5 gap-y-2">
                <ReadOnlyField label="Holding" value={farm.name} />
                <ReadOnlyField label="Parcel" value={<span className="font-mono">{farm.parcelRef}</span>} />
                <ReadOnlyField label="District" value={farm.district} />
                <ReadOnlyField
                  label="Livestock on record"
                  value={farm.livestock.map((l) => `${l.headcount} ${l.type}`).join(', ') || '—'}
                />
              </dl>
              <MapView
                markers={[{ id: farm.id, lat: farm.lat, lng: farm.lng, label: farm.name, detail: `${c.id} · ${c.suspectedDisease}`, tone: c.status === 'confirmed' ? 'warning' : 'primary' }]}
                center={{ lat: farm.lat, lng: farm.lng }}
                zoom={15}
                height={200}
              />
            </section>
          )}

          {relatedVisits.length > 0 && (
            <section className="ais-card p-4">
              <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Livestock services at this holding
                <ReqBadge refs="vii.4" screen="S08" />
              </h2>
              <ul className="space-y-2">
                {relatedVisits.map((v) => (
                  <li key={v.id} className="rounded-lg border border-ink-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link to={`/livestock/${v.id}`} className="text-sm font-medium capitalize text-brand-700 hover:underline">
                        {v.type} visit · {v.species}
                      </Link>
                      <StatusBadge status={v.status} />
                    </div>
                    <p className="font-mono text-xs text-ink-500">{v.id} · {formatDate(v.visitedOn ?? v.scheduledOn)}</p>
                    {v.findings && <p className="mt-1 text-sm text-ink-600">{v.findings}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {priorCases.length > 0 && (
            <section className="ais-card p-4">
              <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Historical cases at this holding
                <ReqBadge refs="viii.2" screen="S08" />
              </h2>
              <ul className="space-y-2">
                {priorCases.map((p) => (
                  <li key={p.id} className="rounded-lg border border-ink-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link to={`/surveillance/${p.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                        {p.suspectedDisease}
                      </Link>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="font-mono text-xs text-ink-500">{p.id} · {formatDate(p.reportedOn)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <section className="ais-card mt-5 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Case history</h2>
          <ReqBadge refs="viii.2" screen="S08" />
          <SimChip label="append-only" title="Entries are appended, never edited or removed." />
        </div>
        <Timeline events={c.history} />
      </section>

      {/* ---------------------------------------------------- dialogs */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign the case" size="sm" description="The named officer becomes responsible for the investigation.">
        <ul className="space-y-2">
          {db.users
            .filter((u) => u.status === 'active' && ['agriculture_officer', 'field_officer'].includes(u.role))
            .map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => assign(u.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    u.id === c.assignedOfficerUserId ? 'border-brand-400 bg-brand-50' : 'border-ink-200 hover:border-brand-300 hover:bg-brand-50/50'
                  }`}
                >
                  <span>
                    <span className="block text-sm font-medium text-ink-900">{u.fullName}</span>
                    <span className="block text-xs text-ink-500">{ROLE_LABELS[u.role]}</span>
                  </span>
                  {u.id === c.assignedOfficerUserId && <span className="text-xs font-semibold text-brand-700">Current</span>}
                </button>
              </li>
            ))}
        </ul>
      </Modal>

      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Link a laboratory submission"
        size="md"
        description="Only samples taken from this holding are offered, so a case cannot be linked to the wrong farm's result."
      >
        {candidateSamples.length === 0 ? (
          <p className="text-sm text-ink-600">
            No laboratory samples have been submitted from this holding yet. Raise a sampling request
            on the laboratory screen first.
          </p>
        ) : (
          <ul className="space-y-2">
            {candidateSamples.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => linkSample(s.id)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    s.id === c.linkedSampleId ? 'border-brand-400 bg-brand-50' : 'border-ink-200 hover:border-brand-300 hover:bg-brand-50/50'
                  }`}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium capitalize text-ink-900">{s.type} sample</span>
                    <StatusBadge status={s.status} />
                  </span>
                  <span className="mt-0.5 block font-mono text-xs text-ink-500">
                    {s.id} · requested {formatDate(s.requestedOn)}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-600">{s.purpose}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        open={outcomeOpen !== null}
        onClose={() => setOutcomeOpen(null)}
        title={outcomeOpen === 'confirmed' ? 'Confirm the disease' : 'Record a negative result'}
        tone={outcomeOpen === 'confirmed' ? 'danger' : 'neutral'}
        size="md"
        footer={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => setOutcomeOpen(null)}>Cancel</button>
            <button
              type="button"
              className={outcomeOpen === 'confirmed' ? 'ais-btn-danger' : 'ais-btn-primary'}
              onClick={() => outcomeOpen && recordOutcome(outcomeOpen)}
            >
              {outcomeOpen === 'confirmed' ? 'Confirm disease' : 'Record negative'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {sample && (
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-3 text-sm">
              <p className="font-medium text-ink-900">Laboratory submission {sample.id}</p>
              {sample.results.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5 text-xs text-ink-700">
                  {sample.results.map((r) => (
                    <li key={r.parameter}>
                      {r.parameter}: <strong>{r.value}{r.unit && ` ${r.unit}`}</strong> ({r.flag})
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-warn-700">
                  This submission has no validated results yet — record the outcome only if you have
                  the result by another route.
                </p>
              )}
            </div>
          )}
          <TextAreaField
            label="Outcome note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              outcomeOpen === 'confirmed'
                ? 'e.g. Newcastle disease virus detected. Holding quarantined, movement suspended, remaining flock re-vaccinated.'
                : 'e.g. No pathogen detected. Signs attributed to a management issue; advice given.'
            }
          />
          <p className="inline-flex flex-wrap items-center gap-2 text-xs text-ink-500">
            The holder is notified of the outcome. <SimChip />
          </p>
        </div>
      </Modal>
    </div>
  )
}
