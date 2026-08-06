import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { DocUploader } from '../../components/DocUploader'
import { EmptyState } from '../../components/EmptyState'
import { CheckboxField, ReadOnlyField, SelectField, TextAreaField } from '../../components/Field'
import { MapView } from '../../components/MapPicker'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StageTracker } from '../../components/StageTracker'
import { StatusBadge } from '../../components/StatusBadge'
import { Tabs } from '../../components/Tabs'
import { Timeline } from '../../components/Timeline'
import {
  DEMO_TODAY, clientName, formatCoords, formatDate, formatHa, formatScr, localId,
} from '../../lib/format'
import { composeNotification, templatesFor } from '../../lib/notify'
import { can } from '../../lib/rbac'
import { advance, currentStage, statusLabel } from '../../lib/workflow'
import { ROLE_LABELS } from '../../lib/types'
import type { DocRef, LandAssessment, Lease } from '../../lib/types'

/** Indicative annual rent used when an allocation is converted into a lease. */
const RENT_PER_HA_SCR = 1500

/**
 * S04 — a single allocation application (iv.1, iv.2, iv.3 ★, iv.4, iv.8).
 *
 * Approval runs on the same metadata-driven engine as loans; the difference is
 * the workflow definition, not the code.
 */
export function LandApplicationDetail() {
  const { id } = useParams<{ id: string }>()
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [tab, setTab] = useState('overview')
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null)
  const [comment, setComment] = useState('')
  const [assessOpen, setAssessOpen] = useState(false)
  const [leaseOpen, setLeaseOpen] = useState(false)

  const application = db.landApplications.find((a) => a.id === id)
  const client = db.clients.find((c) => c.id === application?.clientId)
  const workflow = db.workflows.find((w) => w.id === application?.workflowId)

  const actorNames = useMemo(
    () => Object.fromEntries(db.users.map((u) => [u.id, u.fullName])),
    [db.users],
  )

  const existingLease = useMemo(
    () => db.leases.find((l) => l.parcelRef === application?.parcelRef && l.clientId === application?.clientId),
    [db.leases, application],
  )

  if (!application || !client) {
    return (
      <div className="ais-card">
        <EmptyState
          title="Land application not found"
          action={<Link to="/land" className="ais-btn-secondary">Back to land management</Link>}
        />
      </div>
    )
  }

  const stage = currentStage(application.stageInstances)
  const stageDefinition = workflow?.stages.find((s) => s.id === stage?.stageId)
  const isOpen = ['submitted', 'under-review'].includes(application.status)
  const holdsStageRole = user?.role === stage?.actorRole || role === 'admin'
  const canDecide = isOpen && Boolean(stage) && holdsStageRole && (can(role, 'land.edit') || can(role, 'land.decide'))
  const canAssess = can(role, 'land.edit') || can(role, 'fieldops.capture') || role === 'admin'

  /* --------------------------------------------------------- actions */

  const notifyApplicant = (status: string, detail: string) => {
    for (const template of templatesFor(db.notificationTemplates, 'application.status.changed')) {
      if (template.channel === 'email' && !client.email) continue
      dispatch({
        type: 'notification/add',
        notification: composeNotification({
          template,
          client,
          vars: {
            applicationType: 'land allocation application',
            applicationId: application.id,
            status: statusLabel(status).toLowerCase(),
            detail,
          },
          relatedType: 'land',
          relatedId: application.id,
        }),
      })
    }
  }

  const submitDecision = () => {
    if (!user || !stage || !decision) return
    const on = DEMO_TODAY.toISOString().slice(0, 10)
    const result = advance(application.stageInstances, {
      stageId: stage.stageId,
      outcome: decision,
      byUserId: user.id,
      on,
      comment: comment.trim() || undefined,
    })
    const nextStageName = result.currentStageId
      ? (workflow?.stages.find((s) => s.id === result.currentStageId)?.name ?? '')
      : ''

    dispatch({
      type: 'land/update',
      id: application.id,
      patch: {
        stageInstances: result.stages,
        status: result.status,
        currentStageId: result.currentStageId,
      },
      change: {
        id: localId('LAH'),
        at: new Date().toISOString(),
        actorUserId: user.id,
        actorName: user.fullName,
        action: `Stage "${stage.name}" ${decision}`,
        note: comment.trim() || undefined,
      },
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: decision === 'approved' ? 'land.stage.approved' : 'land.stage.rejected',
        entityType: 'land_application',
        entityId: application.id,
        detail: `Stage "${stage.name}" ${decision}${nextStageName ? ` — routed to "${nextStageName}"` : ` — application ${statusLabel(result.status).toLowerCase()}`}`,
      },
    })

    notifyApplicant(
      result.status,
      result.final && decision === 'approved'
        ? 'Your allocation has been approved. A lease will be prepared for signature.'
        : decision === 'rejected'
          ? `The application was not approved at the "${stage.name}" stage.`
          : `The application has passed "${stage.name}" and is now at ${nextStageName.toLowerCase()}.`,
    )

    setDecision(null)
    setComment('')
    toast({
      tone: decision === 'approved' ? 'success' : 'warning',
      title: `Stage ${decision}`,
      body: result.final ? `Application ${statusLabel(result.status).toLowerCase()}.` : `Routed to "${nextStageName}".`,
      simulated: true,
    })
  }

  const saveAssessment = (assessment: LandAssessment) => {
    if (!user) return
    dispatch({
      type: 'land/update',
      id: application.id,
      patch: { assessments: [...application.assessments, assessment] },
      change: {
        id: localId('LAH'),
        at: new Date().toISOString(),
        actorUserId: user.id,
        actorName: user.fullName,
        action: 'Site assessment recorded',
        note: `Soil ${assessment.soilSuitability}, slope ${assessment.slope}; recommendation: ${assessment.recommendation.replace(/-/g, ' ')}.`,
      },
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'land.assessment.recorded',
        entityType: 'land_application',
        entityId: application.id,
        detail: `Site assessment recorded — recommendation ${assessment.recommendation}`,
      },
    })
    setAssessOpen(false)
    toast({ tone: 'success', title: 'Assessment recorded' })
  }

  const addDocument = (doc: DocRef) => {
    if (!user) return
    dispatch({
      type: 'land/update',
      id: application.id,
      patch: { documents: [...application.documents, doc] },
      change: {
        id: localId('LAH'),
        at: new Date().toISOString(),
        actorUserId: user.id,
        actorName: user.fullName,
        action: 'Document attached',
        note: `${doc.name} (${doc.category})`,
      },
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'land.document.added',
        entityType: 'land_application',
        entityId: application.id,
        detail: `Document "${doc.name}" attached`,
      },
    })
    toast({ tone: 'success', title: 'Document attached', simulated: true })
  }

  const issueLease = () => {
    if (!user) return
    const start = DEMO_TODAY
    const end = addDays(start, 365 * 10)
    const lease: Lease = {
      id: `LSE-${start.getUTCFullYear()}-${String(db.leases.length + 200).padStart(4, '0')}`,
      clientId: client.id,
      parcelRef: application.parcelRef,
      district: application.district,
      areaHa: application.requestedAreaHa,
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
      annualRentScr: Math.round(application.requestedAreaHa * RENT_PER_HA_SCR),
      status: 'pending',
      paymentStatus: 'due',
      nextPaymentDue: format(addDays(start, 30), 'yyyy-MM-dd'),
      documents: [],
      history: [
        {
          id: localId('LSH'),
          at: new Date().toISOString(),
          actorUserId: user.id,
          actorName: user.fullName,
          action: `Lease issued from approved allocation ${application.id}`,
        },
      ],
    }

    dispatch({
      type: 'lease/create',
      lease,
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'lease.issued',
        entityType: 'lease',
        entityId: lease.id,
        detail: `Lease issued for parcel ${lease.parcelRef} (${formatHa(lease.areaHa)}) from allocation ${application.id}`,
      },
    })
    setLeaseOpen(false)
    toast({ tone: 'success', title: 'Lease issued', body: `${lease.id} created, awaiting signature.` })
    navigate(`/land/leases/${lease.id}`)
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'assessment', label: 'Assessments', count: application.assessments.length },
    { id: 'documents', label: 'Documents', count: application.documents.length },
    { id: 'history', label: 'History', count: application.history.length },
  ]

  return (
    <div className="pb-6">
      <PageHeader
        screen="S04"
        title={application.purpose}
        description={`${clientName(client)} · parcel ${application.parcelRef} · ${application.district}, ${application.island}`}
        refs={['iv.1', 'iv.2']}
        actions={
          <>
            <Link to="/land" className="ais-btn-secondary">Back to land management</Link>
            {application.status === 'approved' && !existingLease && can(role, 'land.edit') && (
              <button type="button" className="ais-btn-primary" onClick={() => setLeaseOpen(true)}>
                Issue lease
                <ReqBadge refs="iv.5" screen="S04" />
              </button>
            )}
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded bg-ink-100 px-2 py-1 font-mono text-xs font-semibold text-ink-700">{application.id}</span>
          <StatusBadge status={application.status} />
          <span className="text-sm text-ink-700">{formatHa(application.requestedAreaHa)} requested</span>
          <Link
            to={`/clients/${client.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800 hover:bg-brand-100"
          >
            {clientName(client)} · {client.id}
          </Link>
          {existingLease && (
            <Link
              to={`/land/leases/${existingLease.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-0.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
            >
              Lease {existingLease.id}
            </Link>
          )}
        </div>
      </PageHeader>

      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-4" />

      {tab === 'overview' && (
        <div className="space-y-5">
          <section className="ais-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Allocation workflow
                <ReqBadge refs={['iv.1', 'iv.2']} screen="S04" />
              </h2>
              {workflow && (
                <span className="text-xs text-ink-500">{workflow.name} · {workflow.stages.length} stages</span>
              )}
            </div>
            <div className="mt-4">
              <StageTracker stages={application.stageInstances} actorNames={actorNames} />
            </div>
          </section>

          {isOpen && stage && (
            <section className={`rounded-lg border p-4 ${canDecide ? 'border-brand-300 bg-brand-50' : 'border-ink-200 bg-white'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-ink-900">Current stage — {stage.name}</h2>
                <StatusBadge status="in-progress" label={`Awaiting ${ROLE_LABELS[stage.actorRole]}`} />
              </div>
              {stageDefinition && (
                <p className="mt-1 text-sm text-ink-600">
                  {stageDefinition.description} Service standard {stageDefinition.slaDays} days.
                </p>
              )}
              {canDecide ? (
                <>
                  {stage.stageId === 'stg-decision' && application.assessments.length === 0 && (
                    <p className="mt-3 rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-sm text-warn-800">
                      No site assessment has been recorded. A decision can still be taken, and the gap
                      is written to the audit trail.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="ais-btn-primary" onClick={() => setDecision('approved')}>
                      Approve this stage
                    </button>
                    <button type="button" className="ais-btn-danger" onClick={() => setDecision('rejected')}>
                      Reject application
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-ink-600">
                  This stage is awaiting a decision from a {ROLE_LABELS[stage.actorRole]}. You are
                  signed in as {role ? ROLE_LABELS[role] : 'an unknown role'}.
                </p>
              )}
            </section>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
            <section className="ais-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-ink-900">Application</h2>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
                <ReadOnlyField label="Reference" value={<span className="font-mono">{application.id}</span>} />
                <ReadOnlyField label="Submitted" value={formatDate(application.submittedOn)} />
                <ReadOnlyField label="Parcel" value={<span className="font-mono">{application.parcelRef}</span>} />
                <ReadOnlyField label="Area requested" value={formatHa(application.requestedAreaHa)} />
                <ReadOnlyField label="District" value={application.district} />
                <ReadOnlyField label="Island" value={application.island} />
                <ReadOnlyField
                  label="Coordinates"
                  value={<span className="font-mono">{formatCoords(application.lat, application.lng)}</span>}
                  className="col-span-2"
                />
                <ReadOnlyField label="Purpose" value={application.purpose} className="col-span-2" />
              </dl>
            </section>

            <section className="ais-card p-4">
              <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Parcel view
                <ReqBadge refs="iv.3" screen="S04" />
              </h2>
              <MapView
                markers={[
                  {
                    id: application.id,
                    lat: application.lat,
                    lng: application.lng,
                    label: application.parcelRef,
                    detail: `${formatHa(application.requestedAreaHa)} · ${application.purpose}`,
                    tone: application.status === 'approved' ? 'primary' : 'warning',
                  },
                  ...db.farms
                    .filter((f) => f.district === application.district)
                    .slice(0, 25)
                    .map((f) => ({
                      id: f.id, lat: f.lat, lng: f.lng, label: f.name,
                      detail: `${f.id} · ${f.parcelRef}`, tone: 'muted' as const,
                    })),
                ]}
                center={{ lat: application.lat, lng: application.lng }}
                zoom={14}
                height={300}
              />
              <p className="mt-2 text-xs text-ink-500">
                The requested parcel in context, with registered holdings in the same district shown
                in grey.
              </p>
            </section>
          </div>
        </div>
      )}

      {tab === 'assessment' && (
        <section className="ais-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              Site assessments
              <ReqBadge refs="iv.3" screen="S04" />
            </h2>
            {canAssess && (
              <button type="button" className="ais-btn-primary" onClick={() => setAssessOpen(true)}>
                Record an assessment
              </button>
            )}
          </div>

          {application.assessments.length === 0 ? (
            <p className="text-sm text-ink-500">
              No site assessment has been recorded for this parcel yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {application.assessments.map((a) => {
                const assessor = db.users.find((u) => u.id === a.assessorUserId)
                return (
                  <li key={a.id} className="rounded-lg border border-ink-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink-900">
                        Assessed {formatDate(a.assessedOn)}
                      </span>
                      <StatusBadge
                        status={a.recommendation}
                        tone={a.recommendation === 'reject' ? 'bad' : a.recommendation === 'approve' ? 'good' : 'warn'}
                        label={statusLabel(a.recommendation)}
                      />
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
                      <ReadOnlyField label="Soil suitability" value={statusLabel(a.soilSuitability)} />
                      <ReadOnlyField label="Slope" value={statusLabel(a.slope)} />
                      <ReadOnlyField label="Water access" value={a.waterAccess ? 'Yes' : 'No'} />
                      <ReadOnlyField label="Access road" value={a.accessRoad ? 'Yes' : 'No'} />
                    </dl>
                    {a.notes && <p className="mt-2 text-sm text-ink-700">{a.notes}</p>}
                    <p className="mt-1 text-xs text-ink-500">{assessor?.fullName ?? a.assessorUserId}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {tab === 'documents' && (
        <section className="ais-card p-4">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
            Assessment reports and supporting documents
            <ReqBadge refs="iv.4" screen="S04" />
          </h2>
          <DocUploader
            documents={application.documents}
            onAdd={can(role, 'land.edit') ? addDocument : undefined}
            readOnly={!can(role, 'land.edit')}
            uploadedBy={user?.id ?? 'SYSTEM'}
            categories={['Application', 'Assessment', 'Site plan', 'Correspondence', 'Tenure evidence', 'Other']}
            label="Attachments"
            hint="Assessment reports, site plans and correspondence attached to this application."
          />
        </section>
      )}

      {tab === 'history' && (
        <section className="ais-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-900">Allocation history</h2>
            <ReqBadge refs="iv.8" screen="S04" />
            <SimChip label="append-only" title="Entries are appended, never edited or removed." />
          </div>
          <Timeline events={application.history} />
        </section>
      )}

      {/* ------------------------------------------------ decision modal */}
      <Modal
        open={decision !== null}
        onClose={() => setDecision(null)}
        title={decision === 'approved' ? `Approve stage: ${stage?.name ?? ''}` : 'Reject application'}
        tone={decision === 'rejected' ? 'danger' : 'neutral'}
        size="md"
        footer={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => setDecision(null)}>Cancel</button>
            <button
              type="button"
              className={decision === 'rejected' ? 'ais-btn-danger' : 'ais-btn-primary'}
              onClick={submitDecision}
            >
              {decision === 'approved' ? 'Record approval' : 'Record rejection'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-2">
            <ReadOnlyField label="Application" value={<span className="font-mono">{application.id}</span>} />
            <ReadOnlyField label="Parcel" value={application.parcelRef} />
            <ReadOnlyField label="Deciding as" value={user ? `${user.fullName} · ${ROLE_LABELS[user.role]}` : '—'} />
            <ReadOnlyField label="Stage" value={stage?.name ?? '—'} />
          </dl>
          <TextAreaField
            label="Decision note"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={decision === 'approved' ? 'e.g. Parcel is workable with modest clearing; access adequate.' : 'e.g. Parcel required for a competing public purpose.'}
          />
          <p className="inline-flex flex-wrap items-center gap-2 text-xs text-ink-500">
            The applicant is notified when the decision is recorded. <SimChip />
          </p>
        </div>
      </Modal>

      <AssessmentDialog
        open={assessOpen}
        onClose={() => setAssessOpen(false)}
        onSave={saveAssessment}
        assessorUserId={user?.id ?? 'SYSTEM'}
        index={application.assessments.length}
      />

      {/* --------------------------------------------------- lease modal */}
      <Modal
        open={leaseOpen}
        onClose={() => setLeaseOpen(false)}
        title="Issue a lease from this allocation"
        size="sm"
        footer={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => setLeaseOpen(false)}>Cancel</button>
            <button type="button" className="ais-btn-primary" onClick={issueLease}>Issue lease</button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-700">
            A ten-year lease will be created on the lease register for{' '}
            <strong>{clientName(client)}</strong> over parcel{' '}
            <span className="font-mono">{application.parcelRef}</span>.
          </p>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-2">
            <ReadOnlyField label="Area" value={formatHa(application.requestedAreaHa)} />
            <ReadOnlyField label="Term" value="10 years" />
            <ReadOnlyField label="Indicative annual rent" value={formatScr(Math.round(application.requestedAreaHa * RENT_PER_HA_SCR))} />
            <ReadOnlyField label="Initial status" value="Pending signature" />
          </dl>
        </div>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Assessment capture (iv.3 ★)
 * ------------------------------------------------------------------ */

function AssessmentDialog({
  open, onClose, onSave, assessorUserId, index,
}: {
  open: boolean
  onClose: () => void
  onSave: (a: LandAssessment) => void
  assessorUserId: string
  index: number
}) {
  const [soil, setSoil] = useState<LandAssessment['soilSuitability']>('moderate')
  const [slope, setSlope] = useState<LandAssessment['slope']>('gentle')
  const [waterAccess, setWaterAccess] = useState(true)
  const [accessRoad, setAccessRoad] = useState(true)
  const [recommendation, setRecommendation] = useState<LandAssessment['recommendation']>('approve-with-conditions')
  const [notes, setNotes] = useState('')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a site assessment"
      size="md"
      description="Structured capture of the physical assessment of the parcel."
      footer={
        <>
          <button type="button" className="ais-btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="ais-btn-primary"
            onClick={() =>
              onSave({
                id: localId(`LAS-${index}`),
                assessedOn: DEMO_TODAY.toISOString().slice(0, 10),
                assessorUserId,
                soilSuitability: soil,
                slope,
                waterAccess,
                accessRoad,
                recommendation,
                notes: notes.trim(),
              })
            }
          >
            Record assessment
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Soil suitability" value={soil} onChange={(e) => setSoil(e.target.value as LandAssessment['soilSuitability'])}>
            <option value="high">High</option>
            <option value="moderate">Moderate</option>
            <option value="low">Low</option>
          </SelectField>
          <SelectField label="Slope" value={slope} onChange={(e) => setSlope(e.target.value as LandAssessment['slope'])}>
            <option value="flat">Flat</option>
            <option value="gentle">Gentle</option>
            <option value="steep">Steep</option>
          </SelectField>
        </div>
        <div className="space-y-2.5">
          <CheckboxField label="Water access available" checked={waterAccess} onChange={(e) => setWaterAccess(e.target.checked)} />
          <CheckboxField label="Vehicle access road present" checked={accessRoad} onChange={(e) => setAccessRoad(e.target.checked)} />
        </div>
        <SelectField
          label="Recommendation"
          value={recommendation}
          onChange={(e) => setRecommendation(e.target.value as LandAssessment['recommendation'])}
          hint="Carried to the allocation decision stage."
        >
          <option value="approve">Approve</option>
          <option value="approve-with-conditions">Approve with conditions</option>
          <option value="reject">Reject</option>
        </SelectField>
        <TextAreaField
          label="Assessment notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Slope will require terracing before cultivation. Water access limited in the dry season."
        />
      </div>
    </Modal>
  )
}
