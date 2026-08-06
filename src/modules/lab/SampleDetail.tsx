import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { EmptyState } from '../../components/EmptyState'
import { ReadOnlyField, SelectField, TextAreaField, TextField } from '../../components/Field'
import { MapView } from '../../components/MapPicker'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StatusBadge } from '../../components/StatusBadge'
import { Timeline } from '../../components/Timeline'
import { exportLabReportPdf } from '../../lib/export'
import { LAB_PANELS, SAMPLE_LIFECYCLE, SAMPLE_TYPE_LABELS, flagResult } from '../../lib/labPanels'
import {
  DEMO_TODAY, clientName, formatCoords, formatDate, formatDateTime, formatHa, localId,
} from '../../lib/format'
import { composeNotification, templatesFor } from '../../lib/notify'
import { can } from '../../lib/rbac'
import { statusLabel } from '../../lib/workflow'
import { ROLE_LABELS } from '../../lib/types'
import type { LabResult, SampleStatus } from '../../lib/types'

/**
 * S06 — a single sample (vi.2–vi.8).
 *
 * The lifecycle advances one step at a time and each step names the role that
 * performs it, so an evaluator can see collection, registration, testing and
 * reporting as distinct custodial events rather than one status field.
 */
export function SampleDetail() {
  const { id } = useParams<{ id: string }>()
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()

  const [resultsOpen, setResultsOpen] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const sample = db.samples.find((s) => s.id === id)
  const client = db.clients.find((c) => c.id === sample?.clientId)
  const farm = db.farms.find((f) => f.id === sample?.farmId)
  const analyst = db.users.find((u) => u.id === sample?.labTechUserId)

  /* Cases that cite this submission — the visible half of viii.4. */
  const linkedCases = useMemo(
    () => (sample ? db.surveillanceCases.filter((c) => c.linkedSampleId === sample.id) : []),
    [db.surveillanceCases, sample],
  )

  if (!sample || !client) {
    return (
      <div className="ais-card">
        <EmptyState
          title="Sample not found"
          action={<Link to="/lab" className="ais-btn-secondary">Back to the register</Link>}
        />
      </div>
    )
  }

  const panel = LAB_PANELS[sample.type]
  const stageIndex = SAMPLE_LIFECYCLE.findIndex((s) => s.status === sample.status)
  const outOfRange = sample.results.filter((r) => r.flag !== 'normal')

  const canCollect = can(role, 'lab.register') || can(role, 'fieldops.capture')
  const canRegister = can(role, 'lab.register')
  const canResult = can(role, 'lab.results')

  /* --------------------------------------------------------- actions */

  const advanceTo = (
    next: SampleStatus,
    action: string,
    patch: Record<string, unknown> = {},
    note?: string,
  ) => {
    if (!user) return
    dispatch({
      type: 'sample/update',
      id: sample.id,
      patch: { status: next, ...patch },
      change: {
        id: localId('SH'),
        at: new Date().toISOString(),
        actorUserId: user.id,
        actorName: user.fullName,
        action,
        note,
      },
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: `sample.${next}`,
        entityType: 'sample',
        entityId: sample.id,
        detail: `${action} — ${sample.id} (${sample.type})`,
      },
    })
    toast({ tone: 'success', title: action })
  }

  const today = DEMO_TODAY.toISOString().slice(0, 10)

  const recordCollection = () =>
    advanceTo('collected', 'Sample collected on farm', { collectedOn: today }, 'Composited sub-samples taken at the holding.')

  const registerAtLab = () =>
    advanceTo('registered', 'Sample registered at laboratory', {
      registeredOn: today,
      labTechUserId: user?.id,
    })

  const startTesting = () => advanceTo('testing', 'Testing started', { testingStartedOn: today })

  const saveResults = (results: LabResult[], interpretation: string, recommendation: string) => {
    if (!user) return
    dispatch({
      type: 'sample/update',
      id: sample.id,
      patch: {
        status: 'completed',
        completedOn: today,
        labTechUserId: user.id,
        results,
        interpretation: interpretation.trim() || undefined,
        recommendation: recommendation.trim() || undefined,
      },
      change: {
        id: localId('SH'),
        at: new Date().toISOString(),
        actorUserId: user.id,
        actorName: user.fullName,
        action: 'Results entered and validated',
        note: `${results.length} parameters recorded; ${results.filter((r) => r.flag !== 'normal').length} outside the reference range.`,
      },
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'sample.results.entered',
        entityType: 'sample',
        entityId: sample.id,
        detail: `Results entered and validated (${results.length} parameters)`,
      },
    })
    setResultsOpen(false)
    toast({
      tone: 'success',
      title: 'Results recorded',
      body: 'The applicant can now be notified from this screen.',
    })
  }

  /** vi.8 ★ — SMS, email and in-app notification, all recorded in the store. */
  const notifyApplicant = () => {
    if (!user) return
    const templates = templatesFor(db.notificationTemplates, 'lab.results.ready')
    let sent = 0
    for (const template of templates) {
      if (template.channel === 'email' && !client.email) continue
      dispatch({
        type: 'notification/add',
        notification: composeNotification({
          template,
          client,
          vars: {
            sampleId: sample.id,
            sampleType: sample.type,
            farmName: farm?.name ?? sample.farmId,
            interpretation: sample.interpretation ?? 'The full result set is available in the portal.',
          },
          relatedType: 'sample',
          relatedId: sample.id,
        }),
      })
      sent += 1
    }

    dispatch({
      type: 'sample/update',
      id: sample.id,
      patch: { notifiedOn: today },
      change: {
        id: localId('SH'),
        at: new Date().toISOString(),
        actorUserId: user.id,
        actorName: user.fullName,
        action: 'Applicant notified (SMS + email, simulated)',
      },
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'notification.sent',
        entityType: 'sample',
        entityId: sample.id,
        detail: `Applicant notified across ${sent} channel${sent === 1 ? '' : 's'} (simulated delivery)`,
      },
    })

    setNotifyOpen(false)
    toast({
      tone: 'success',
      title: 'Applicant notified',
      body: `${sent} message${sent === 1 ? '' : 's'} recorded for ${clientName(client)}.`,
      simulated: true,
    })
  }

  const downloadReport = async () => {
    setExporting(true)
    try {
      await exportLabReportPdf({
        sampleId: sample.id,
        sampleType: sample.type,
        purpose: sample.purpose,
        clientName: clientName(client),
        clientId: client.id,
        nin: client.nin,
        farmName: farm?.name ?? sample.farmId,
        farmId: sample.farmId,
        parcelRef: farm?.parcelRef ?? '—',
        district: farm ? `${farm.district}, ${farm.island}` : client.district,
        coordinates: farm ? formatCoords(farm.lat, farm.lng) : '—',
        requestedOn: formatDate(sample.requestedOn),
        collectedOn: sample.collectedOn ? formatDate(sample.collectedOn) : undefined,
        registeredOn: sample.registeredOn ? formatDate(sample.registeredOn) : undefined,
        testingStartedOn: sample.testingStartedOn ? formatDate(sample.testingStartedOn) : undefined,
        completedOn: sample.completedOn ? formatDate(sample.completedOn) : undefined,
        analystName: analyst?.fullName ?? 'Laboratory',
        results: sample.results.map((r) => ({
          parameter: r.parameter,
          value: String(r.value),
          unit: r.unit,
          method: r.method,
          referenceRange: r.referenceRange,
          flag: r.flag,
        })),
        interpretation: sample.interpretation,
        recommendation: sample.recommendation,
      })
      toast({ tone: 'success', title: 'Laboratory report generated', body: `${sample.id}.pdf` })
    } catch {
      toast({ tone: 'error', title: 'Report generation failed' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="pb-6">
      <PageHeader
        screen="S06"
        title={`${SAMPLE_TYPE_LABELS[sample.type]} sample`}
        description={sample.purpose}
        refs={['vi.5', 'vi.6']}
        actions={
          <>
            <Link to="/lab" className="ais-btn-secondary">Back to register</Link>
            {sample.status === 'completed' && (
              <>
                <button type="button" className="ais-btn-secondary" onClick={() => void downloadReport()} disabled={exporting}>
                  {exporting ? 'Generating…' : 'Laboratory report (PDF)'}
                  <ReqBadge refs="vi.7" screen="S06" />
                </button>
                {can(role, 'lab.results') || can(role, 'notifications.manage') ? (
                  <button
                    type="button"
                    className={sample.notifiedOn ? 'ais-btn-secondary' : 'ais-btn-primary'}
                    onClick={() => setNotifyOpen(true)}
                  >
                    {sample.notifiedOn ? 'Notify again' : 'Notify applicant'}
                    <ReqBadge refs="vi.8" screen="S06" />
                  </button>
                ) : null}
              </>
            )}
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded bg-ink-100 px-2 py-1 font-mono text-xs font-semibold text-ink-700">{sample.id}</span>
          <StatusBadge status={sample.status} />
          {outOfRange.length > 0 && (
            <StatusBadge status="out" tone="warn" label={`${outOfRange.length} outside reference range`} />
          )}
          {sample.status === 'completed' && (
            sample.notifiedOn ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800">
                Applicant notified {formatDate(sample.notifiedOn)} <SimChip />
              </span>
            ) : (
              <StatusBadge status="pending-notice" tone="bad" label="Applicant not yet notified" />
            )
          )}
          <Link
            to={`/clients/${client.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800 hover:bg-brand-100"
          >
            {clientName(client)} · {client.id}
            <ReqBadge refs="vi.6" screen="S06" />
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

      {/* ------------------------------------------------------ lifecycle */}
      <section className="ais-card mb-5 p-4">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
          Sample lifecycle
          <ReqBadge refs={['vi.2', 'vi.3', 'vi.4']} screen="S06" />
        </h2>

        <ol className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-0">
          {SAMPLE_LIFECYCLE.map((step, i) => {
            const done = i < stageIndex
            const active = i === stageIndex
            const dates: Record<string, string | undefined> = {
              requested: sample.requestedOn,
              collected: sample.collectedOn,
              registered: sample.registeredOn,
              testing: sample.testingStartedOn,
              completed: sample.completedOn,
            }
            return (
              <li key={step.status} className="flex gap-3 sm:flex-1 sm:flex-col sm:gap-2">
                <div className="flex shrink-0 flex-col items-center sm:w-full sm:flex-row">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      done
                        ? 'bg-brand-600 text-white'
                        : active
                          ? 'bg-white text-brand-700 ring-2 ring-brand-600'
                          : 'bg-white text-ink-400 ring-1 ring-ink-300'
                    }`}
                    aria-hidden
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  {i < SAMPLE_LIFECYCLE.length - 1 && (
                    <span
                      className={`w-px flex-1 sm:h-px sm:w-full ${done ? 'bg-brand-400' : 'bg-ink-200'}`}
                      aria-hidden
                    />
                  )}
                </div>
                <div className="min-w-0 pb-1 sm:pr-4">
                  <p className="text-sm font-semibold text-ink-900">{step.label}</p>
                  <p className="text-xs text-ink-500">{step.actor}</p>
                  <p className={`mt-0.5 text-xs font-medium ${done || active ? 'text-brand-700' : 'text-ink-400'}`}>
                    {dates[step.status] ? formatDate(dates[step.status]) : active ? 'Current step' : 'Not reached'}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>

        {/* ------------------------------------------------ next action */}
        <div className="mt-4 border-t border-ink-100 pt-4">
          {sample.status === 'requested' && (
            canCollect ? (
              <button type="button" className="ais-btn-primary" onClick={recordCollection}>
                Record collection
              </button>
            ) : (
              <p className="text-sm text-ink-600">Awaiting collection by a field officer.</p>
            )
          )}
          {sample.status === 'collected' && (
            canRegister ? (
              <button type="button" className="ais-btn-primary" onClick={registerAtLab}>
                Register at laboratory
              </button>
            ) : (
              <p className="text-sm text-ink-600">Awaiting registration by the laboratory.</p>
            )
          )}
          {sample.status === 'registered' && (
            canResult ? (
              <button type="button" className="ais-btn-primary" onClick={startTesting}>
                Start testing
              </button>
            ) : (
              <p className="text-sm text-ink-600">Awaiting the laboratory to begin testing.</p>
            )
          )}
          {sample.status === 'testing' && (
            canResult ? (
              <button type="button" className="ais-btn-primary" onClick={() => setResultsOpen(true)}>
                Enter results
                <ReqBadge refs="vi.5" screen="S06" />
              </button>
            ) : (
              <p className="text-sm text-ink-600">
                Testing is in progress. Results are entered by Laboratory Staff — you are signed in as{' '}
                {role ? ROLE_LABELS[role] : 'an unknown role'}.
              </p>
            )
          )}
          {sample.status === 'completed' && canResult && (
            <button type="button" className="ais-btn-secondary" onClick={() => setResultsOpen(true)}>
              Amend results
            </button>
          )}
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        {/* ------------------------------------------------------ results */}
        <section className="ais-card p-4">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
            Results
            <ReqBadge refs="vi.5" screen="S06" />
          </h2>
          {sample.results.length === 0 ? (
            <p className="text-sm text-ink-500">
              No results recorded yet. The panel for a {sample.type} sample carries{' '}
              {panel.length} parameters.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                      <th className="py-1.5 pr-3 font-semibold">Parameter</th>
                      <th className="py-1.5 pr-3 font-semibold">Result</th>
                      <th className="py-1.5 pr-3 font-semibold">Reference</th>
                      <th className="py-1.5 font-semibold">Assessment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sample.results.map((r) => (
                      <tr key={r.parameter} className="border-b border-ink-100 last:border-0">
                        <td className="py-1.5 pr-3 text-ink-800">
                          {r.parameter}
                          <span className="block text-xs text-ink-400">{r.method}</span>
                        </td>
                        <td className="whitespace-nowrap py-1.5 pr-3 font-medium text-ink-900">
                          {r.value} {r.unit}
                        </td>
                        <td className="whitespace-nowrap py-1.5 pr-3 text-ink-500">{r.referenceRange}</td>
                        <td className="py-1.5"><StatusBadge status={r.flag} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sample.interpretation && (
                <p className="mt-3 text-sm text-ink-700">
                  <strong className="text-ink-900">Interpretation. </strong>
                  {sample.interpretation}
                </p>
              )}
              {sample.recommendation && (
                <p className="mt-1.5 text-sm text-ink-700">
                  <strong className="text-ink-900">Recommendation. </strong>
                  {sample.recommendation}
                </p>
              )}
            </>
          )}
        </section>

        {/* ------------------------------------------------- provenance */}
        <div className="space-y-5">
          <section className="ais-card p-4">
            <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              Submission
              <ReqBadge refs="vi.1" screen="S06" />
            </h2>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
              <ReadOnlyField label="Reference" value={<span className="font-mono">{sample.id}</span>} />
              <ReadOnlyField label="Type" value={SAMPLE_TYPE_LABELS[sample.type]} />
              <ReadOnlyField label="Requested" value={formatDate(sample.requestedOn)} />
              <ReadOnlyField label="Channel" value={statusLabel(sample.requestedVia)} />
              <ReadOnlyField label="Analyst" value={analyst?.fullName ?? '—'} />
              <ReadOnlyField label="Completed" value={sample.completedOn ? formatDate(sample.completedOn) : '—'} />
              <ReadOnlyField label="Purpose" value={sample.purpose} className="col-span-2" />
            </dl>
          </section>

          {farm && (
            <section className="ais-card p-4">
              <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Holding sampled
                <ReqBadge refs="vi.6" screen="S06" />
              </h2>
              <dl className="mb-3 grid grid-cols-2 gap-x-5 gap-y-2">
                <ReadOnlyField label="Holding" value={farm.name} />
                <ReadOnlyField label="Parcel" value={<span className="font-mono">{farm.parcelRef}</span>} />
                <ReadOnlyField label="Size" value={formatHa(farm.sizeHa)} />
                <ReadOnlyField label="District" value={farm.district} />
              </dl>
              <MapView
                markers={[{ id: farm.id, lat: farm.lat, lng: farm.lng, label: farm.name, detail: `${farm.parcelRef} · sample ${sample.id}` }]}
                center={{ lat: farm.lat, lng: farm.lng }}
                zoom={15}
                height={180}
              />
            </section>
          )}

          {linkedCases.length > 0 && (
            <section className="ais-card p-4">
              <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Linked surveillance cases
                <ReqBadge refs="viii.4" screen="S06" />
              </h2>
              <ul className="space-y-2">
                {linkedCases.map((c) => (
                  <li key={c.id} className="rounded-lg border border-ink-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink-900">{c.suspectedDisease}</span>
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

      <section className="ais-card mt-5 p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Chain of custody</h2>
        <Timeline events={sample.history} />
      </section>

      <ResultEntryDialog
        open={resultsOpen}
        onClose={() => setResultsOpen(false)}
        sampleType={sample.type}
        existing={sample.results}
        existingInterpretation={sample.interpretation ?? ''}
        existingRecommendation={sample.recommendation ?? ''}
        onSave={saveResults}
      />

      <Modal
        open={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        title="Notify the applicant"
        size="md"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            Result-ready messages across every configured channel. <SimChip />
          </span>
        }
        footer={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => setNotifyOpen(false)}>Cancel</button>
            <button type="button" className="ais-btn-primary" onClick={notifyApplicant}>
              Send notifications
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-700">
            {clientName(client)} will receive the following. Nothing leaves the browser — each message
            is recorded against the client record and appears in their portal.
          </p>
          <ul className="space-y-2">
            {templatesFor(db.notificationTemplates, 'lab.results.ready').map((t) => {
              const unavailable = t.channel === 'email' && !client.email
              return (
                <li
                  key={t.id}
                  className={`rounded-lg border p-3 ${unavailable ? 'border-ink-200 bg-ink-50 opacity-60' : 'border-ink-200'}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-600">
                      {t.channel}
                    </span>
                    <span className="text-xs text-ink-500">
                      {t.channel === 'sms' ? client.phone : t.channel === 'email' ? (client.email || 'no address on file') : 'In-app'}
                    </span>
                    {unavailable && <span className="text-xs text-danger-600">skipped — no email on file</span>}
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-sm text-ink-700">
                    {t.body
                      .replace('{{sampleId}}', sample.id)
                      .replace('{{sampleType}}', sample.type)
                      .replace('{{firstName}}', client.firstName)
                      .replace('{{farmName}}', farm?.name ?? sample.farmId)
                      .replace('{{interpretation}}', sample.interpretation ?? '')}
                  </p>
                </li>
              )
            })}
          </ul>
          {sample.notifiedOn && (
            <p className="rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-sm text-warn-800">
              The applicant was already notified on {formatDateTime(sample.notifiedOn)}. Sending again
              adds new messages rather than replacing the originals.
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Result entry (vi.5)
 * ------------------------------------------------------------------ */

function ResultEntryDialog({
  open, onClose, sampleType, existing, existingInterpretation, existingRecommendation, onSave,
}: {
  open: boolean
  onClose: () => void
  sampleType: keyof typeof LAB_PANELS
  existing: LabResult[]
  existingInterpretation: string
  existingRecommendation: string
  onSave: (results: LabResult[], interpretation: string, recommendation: string) => void
}) {
  const panel = LAB_PANELS[sampleType]
  const [values, setValues] = useState<Record<string, string>>({})
  const [interpretation, setInterpretation] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [initialisedFor, setInitialisedFor] = useState<string | null>(null)

  // Re-seed the form the first time it opens for a given sample state.
  const key = `${sampleType}|${existing.length}|${open}`
  if (open && initialisedFor !== key) {
    setValues(Object.fromEntries(panel.map((p) => {
      const found = existing.find((r) => r.parameter === p.parameter)
      return [p.parameter, found ? String(found.value) : '']
    })))
    setInterpretation(existingInterpretation)
    setRecommendation(existingRecommendation)
    setInitialisedFor(key)
  }

  const draft: LabResult[] = panel
    .filter((p) => values[p.parameter]?.trim())
    .map((p) =>
      flagResult({
        parameter: p.parameter,
        value: p.kind === 'number' ? Number(values[p.parameter]) : values[p.parameter],
        unit: p.unit,
        method: p.method,
        referenceRange: p.referenceRange,
      }),
    )

  const complete = draft.length === panel.length
  const flagged = draft.filter((r) => r.flag !== 'normal')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Enter ${SAMPLE_TYPE_LABELS[sampleType].toLowerCase()} analysis results`}
      size="lg"
      description="Each parameter is assessed against its reference range as you type."
      footer={
        <>
          <button type="button" className="ais-btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="ais-btn-primary"
            onClick={() => onSave(draft, interpretation, recommendation)}
            disabled={!complete}
          >
            Validate and complete
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-3">
          {panel.map((p) => {
            const raw = values[p.parameter] ?? ''
            const assessed = raw.trim()
              ? flagResult({
                  parameter: p.parameter,
                  value: p.kind === 'number' ? Number(raw) : raw,
                  unit: p.unit,
                  method: p.method,
                  referenceRange: p.referenceRange,
                })
              : null
            return (
              <div key={p.parameter} className="grid gap-2 sm:grid-cols-[1fr,auto] sm:items-end">
                {p.kind === 'number' ? (
                  <TextField
                    label={`${p.parameter}${p.unit ? ` (${p.unit})` : ''}`}
                    type="number"
                    step={p.step}
                    value={raw}
                    onChange={(e) => setValues((v) => ({ ...v, [p.parameter]: e.target.value }))}
                    hint={`Reference ${p.referenceRange} · ${p.method}`}
                  />
                ) : (
                  <SelectField
                    label={p.parameter}
                    value={raw}
                    onChange={(e) => setValues((v) => ({ ...v, [p.parameter]: e.target.value }))}
                    hint={`Reference ${p.referenceRange} · ${p.method}`}
                  >
                    <option value="">Select…</option>
                    {(p.options ?? []).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </SelectField>
                )}
                <div className="mb-6 sm:mb-7">
                  {assessed ? <StatusBadge status={assessed.flag} /> : <span className="text-xs text-ink-400">—</span>}
                </div>
              </div>
            )
          })}
        </div>

        {flagged.length > 0 && (
          <p className="rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-sm text-warn-800">
            {flagged.length} parameter{flagged.length > 1 ? 's fall' : ' falls'} outside the reference
            range: {flagged.map((f) => f.parameter).join(', ')}. Explain the implication in the
            interpretation below — it is reproduced on the report the applicant receives.
          </p>
        )}

        <TextAreaField
          label="Interpretation"
          rows={3}
          value={interpretation}
          onChange={(e) => setInterpretation(e.target.value)}
          placeholder="e.g. Moderately acidic soil with good organic matter. Available phosphorus is below the target range."
        />
        <TextAreaField
          label="Recommendation"
          rows={3}
          value={recommendation}
          onChange={(e) => setRecommendation(e.target.value)}
          placeholder="e.g. Apply agricultural lime at 1.5 t/ha. Re-test in 9 months."
        />

        {!complete && (
          <p className="text-sm text-ink-500">
            All {panel.length} parameters must be entered before the analysis can be validated —{' '}
            {draft.length} recorded so far.
          </p>
        )}
      </div>
    </Modal>
  )
}
