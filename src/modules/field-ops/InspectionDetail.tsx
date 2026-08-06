import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useOffline } from '../../app/OfflineContext'
import { useToast } from '../../app/ToastContext'
import { EmptyState } from '../../components/EmptyState'
import { ReadOnlyField, SelectField, TextAreaField, TextField } from '../../components/Field'
import { MapView } from '../../components/MapPicker'
import { PageHeader } from '../../components/PageHeader'
import { PhotoCapture } from '../../components/PhotoCapture'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StatusBadge } from '../../components/StatusBadge'
import { Timeline } from '../../components/Timeline'
import { OfflineBar } from './OfflineBar'
import { DEMO_TODAY, clientName, formatDate, formatDateTime, formatHa, localId } from '../../lib/format'
import { can } from '../../lib/rbac'
import { statusLabel } from '../../lib/workflow'
import { ROLE_LABELS } from '../../lib/types'
import type { Inspection, PhotoRef } from '../../lib/types'

const OUTCOMES: Inspection['outcome'][] = ['compliant', 'minor-issues', 'non-compliant']

/**
 * S10 — a single inspection, and the surface a field officer captures on
 * (x.3 ★, x.4, x.5). Mobile-priority.
 *
 * Capture works identically online and offline; the only difference is whether
 * the submission reaches the register immediately or waits in the device queue.
 */
export function InspectionDetail() {
  const { id } = useParams<{ id: string }>()
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { online } = useOffline()
  const { toast } = useToast()

  const inspection = db.inspections.find((i) => i.id === id)
  const queued = db.outbox.find((q) => q.payload.id === id)
  const client = db.clients.find((c) => c.id === inspection?.clientId)
  const farm = db.farms.find((f) => f.id === inspection?.farmId)
  const officer = db.users.find((u) => u.id === inspection?.officerUserId)

  /* Draft state for the capture form. */
  const [observations, setObservations] = useState(inspection?.observations ?? '')
  const [findings, setFindings] = useState(inspection?.findings ?? '')
  const [outcome, setOutcome] = useState<Inspection['outcome']>(
    inspection && inspection.outcome !== 'not-assessed' ? inspection.outcome : 'compliant',
  )
  const [completedOn, setCompletedOn] = useState(
    inspection?.completedOn ?? DEMO_TODAY.toISOString().slice(0, 10),
  )
  const [photos, setPhotos] = useState<PhotoRef[]>(inspection?.photos ?? [])

  /** Prior inspections at the same holding (x.5). */
  const history = useMemo(
    () =>
      inspection
        ? db.inspections
            .filter((i) => i.farmId === inspection.farmId && i.id !== inspection.id)
            .sort((a, b) => (a.scheduledOn < b.scheduledOn ? 1 : -1))
        : [],
    [db.inspections, inspection],
  )

  if (!inspection || !client) {
    return (
      <div className="ais-card">
        <EmptyState
          title="Inspection not found"
          action={<Link to="/field-ops" className="ais-btn-secondary">Back to field operations</Link>}
        />
      </div>
    )
  }

  const canCapture =
    can(role, 'fieldops.capture') || can(role, 'fieldops.schedule') || role === 'admin'
  const isOpen = ['scheduled', 'in-progress'].includes(inspection.status) && !queued
  const canSubmit = observations.trim().length > 5 && findings.trim().length > 3

  const submit = () => {
    if (!user || !canSubmit) return
    const now = new Date().toISOString()

    const captured: Inspection = {
      ...inspection,
      observations: observations.trim(),
      findings: findings.trim(),
      outcome,
      completedOn,
      photos,
      status: 'completed',
      capturedOffline: !online,
      history: [
        ...inspection.history,
        {
          id: localId('IH'), at: now, actorUserId: user.id, actorName: user.fullName,
          action: online
            ? 'Findings captured on device (online)'
            : 'Captured on device while offline (simulated)',
          note: `${photos.length} photograph${photos.length === 1 ? '' : 's'} attached. Outcome: ${statusLabel(outcome)}.`,
        },
      ],
    }

    if (online) {
      dispatch({
        type: 'inspection/update',
        id: inspection.id,
        patch: {
          observations: captured.observations,
          findings: captured.findings,
          outcome,
          completedOn,
          photos,
          status: 'completed',
          capturedOffline: false,
          syncedOn: now,
        },
        change: captured.history[captured.history.length - 1],
        audit: {
          actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
          action: 'inspection.completed', entityType: 'inspection', entityId: inspection.id,
          detail: `Inspection completed at ${farm?.name ?? inspection.farmId} — outcome ${outcome}, ${photos.length} photographs`,
        },
      })
      toast({ tone: 'success', title: 'Inspection submitted', body: 'Recorded in the central register.' })
    } else {
      dispatch({
        type: 'outbox/queue',
        submission: {
          id: localId('Q'),
          queuedAt: now,
          kind: 'inspection',
          label: `${statusLabel(inspection.type)} — ${farm?.name ?? inspection.farmId}`,
          payload: captured,
        },
      })
      toast({
        tone: 'warning',
        title: 'Held on the device',
        body: 'The capture is queued and will be sent when the signal returns.',
        simulated: true,
      })
    }
  }

  const addPhoto = (p: PhotoRef) => setPhotos((prev) => [...prev, p])
  const removePhoto = (photoId: string) => setPhotos((prev) => prev.filter((p) => p.id !== photoId))

  return (
    <div className="pb-6">
      <PageHeader
        screen="S10"
        title={`${statusLabel(inspection.type)} inspection`}
        description={`${clientName(client)} · ${farm?.name ?? inspection.farmId}${farm ? ` · ${farm.district}` : ''}`}
        refs={['x.3', 'x.5']}
        actions={<Link to="/field-ops" className="ais-btn-secondary">Back to field operations</Link>}
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded bg-ink-100 px-2 py-1 font-mono text-xs font-semibold text-ink-700">{inspection.id}</span>
          <StatusBadge status={queued ? 'queued' : inspection.status} tone={queued ? 'warn' : undefined} label={queued ? 'Pending sync' : undefined} />
          {inspection.status === 'completed' && <StatusBadge status={inspection.outcome} />}
          {inspection.capturedOffline && <SimChip label="captured offline" />}
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
            </Link>
          )}
        </div>
      </PageHeader>

      {canCapture && <OfflineBar />}

      {queued && (
        <div className="mb-5 rounded-lg border border-warn-400 bg-warn-50 p-4">
          <p className="inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-warn-900">
            This capture is waiting on the device
            <SimChip />
            <ReqBadge refs="x.3" screen="S10" />
          </p>
          <p className="mt-1 text-sm text-warn-800">
            Captured {formatDateTime(queued.queuedAt)} and held in the outbox. It reaches the central
            register the moment the device is back online and the queue is synchronised — the record
            will then carry both the capture time and the synchronisation time.
          </p>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)]">
        <div className="space-y-5">
          {/* -------------------------------------------------- capture */}
          {isOpen && canCapture ? (
            <section className="ais-card p-4">
              <h2 className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Record the inspection
                <ReqBadge refs={['x.3', 'x.4']} screen="S10" />
              </h2>
              <p className="mb-4 text-xs text-ink-500">
                The form behaves the same whether the device has signal or not.
              </p>

              <div className="space-y-4">
                <TextAreaField
                  label="Observations on site"
                  required
                  rows={4}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="e.g. Proposed poultry-house footprint pegged out on the upper terrace, clear of the river buffer. Access track passable by pickup in dry weather."
                />
                <TextAreaField
                  label="Findings"
                  required
                  rows={3}
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder="e.g. Site suitable for the proposed 200 m² poultry house. Setback from the watercourse measured at 22 m, above the 15 m minimum."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as Inspection['outcome'])}>
                    {OUTCOMES.map((o) => (
                      <option key={o} value={o}>{statusLabel(o)}</option>
                    ))}
                  </SelectField>
                  <TextField label="Date attended" type="date" value={completedOn} onChange={(e) => setCompletedOn(e.target.value)} />
                </div>

                <PhotoCapture photos={photos} onAdd={addPhoto} onRemove={removePhoto} />

                <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-4">
                  <button
                    type="button"
                    className={online ? 'ais-btn-primary' : 'ais-btn-secondary'}
                    onClick={submit}
                    disabled={!canSubmit}
                  >
                    {online ? 'Submit inspection' : 'Save to device queue'}
                  </button>
                  {!canSubmit && (
                    <p className="text-sm text-ink-500">
                      Observations and findings are required before the inspection can be submitted.
                    </p>
                  )}
                  {canSubmit && !online && (
                    <p className="inline-flex flex-wrap items-center gap-2 text-sm text-warn-700">
                      No signal — this will be held on the device. <SimChip />
                    </p>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <section className="ais-card p-4">
              <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Findings
                <ReqBadge refs="x.3" screen="S10" />
              </h2>
              {inspection.observations || inspection.findings ? (
                <dl className="space-y-3">
                  <ReadOnlyField label="Observations on site" value={inspection.observations} />
                  <ReadOnlyField label="Findings" value={inspection.findings} />
                  <ReadOnlyField label="Outcome" value={<StatusBadge status={inspection.outcome} />} />
                </dl>
              ) : (
                <p className="text-sm text-ink-500">
                  {queued
                    ? 'The capture is in the device queue and has not yet reached the register.'
                    : 'No findings recorded yet.'}
                </p>
              )}
            </section>
          )}

          {/* -------------------------------------------------- photos */}
          {!isOpen && inspection.photos.length > 0 && (
            <section className="ais-card p-4">
              <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Photographic evidence
                <ReqBadge refs="x.4" screen="S10" />
              </h2>
              <PhotoCapture photos={inspection.photos} readOnly label="Attached to this inspection" />
            </section>
          )}
        </div>

        {/* ------------------------------------------------------ sidebar */}
        <div className="space-y-5">
          <section className="ais-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Inspection details</h2>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
              <ReadOnlyField label="Reference" value={<span className="font-mono">{inspection.id}</span>} />
              <ReadOnlyField label="Type" value={statusLabel(inspection.type)} />
              <ReadOnlyField label="Scheduled" value={formatDate(inspection.scheduledOn)} />
              <ReadOnlyField label="Completed" value={inspection.completedOn ? formatDate(inspection.completedOn) : '—'} />
              <ReadOnlyField
                label="Assigned officer"
                value={officer ? `${officer.fullName} · ${ROLE_LABELS[officer.role]}` : '—'}
                badge={<ReqBadge refs="x.2" screen="S10" />}
                className="col-span-2"
              />
              {inspection.syncedOn && (
                <ReadOnlyField
                  label="Synchronised"
                  value={formatDateTime(inspection.syncedOn)}
                  badge={<SimChip label="offline sync" />}
                  className="col-span-2"
                />
              )}
              {farm && <ReadOnlyField label="Holding size" value={formatHa(farm.sizeHa)} />}
              {farm && <ReadOnlyField label="Parcel" value={<span className="font-mono">{farm.parcelRef}</span>} />}
            </dl>
            {farm && (
              <div className="mt-4">
                <MapView
                  markers={[{ id: farm.id, lat: farm.lat, lng: farm.lng, label: farm.name, detail: `${inspection.id} · ${statusLabel(inspection.type)}` }]}
                  center={{ lat: farm.lat, lng: farm.lng }}
                  zoom={15}
                  height={180}
                />
              </div>
            )}
          </section>

          {history.length > 0 && (
            <section className="ais-card p-4">
              <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Inspection history at this holding
                <ReqBadge refs="x.5" screen="S10" />
                <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">
                  {history.length}
                </span>
              </h2>
              <ul className="space-y-2">
                {history.map((i) => (
                  <li key={i.id} className="rounded-lg border border-ink-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link to={`/field-ops/${i.id}`} className="text-sm font-medium capitalize text-brand-700 hover:underline">
                        {i.type.replace(/-/g, ' ')}
                      </Link>
                      <StatusBadge status={i.outcome} />
                    </div>
                    <p className="font-mono text-xs text-ink-500">
                      {i.id} · {formatDate(i.completedOn ?? i.scheduledOn)}
                      {i.capturedOffline ? ' · captured offline' : ''}
                    </p>
                    {i.findings && <p className="mt-1 text-sm text-ink-600">{i.findings}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <section className="ais-card mt-5 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Inspection history</h2>
          <ReqBadge refs="x.5" screen="S10" />
          <SimChip label="append-only" title="Entries are appended, never edited or removed." />
        </div>
        <Timeline events={queued ? queued.payload.history : inspection.history} />
      </section>
    </div>
  )
}
