import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { DocUploader } from '../../components/DocUploader'
import { EmptyState } from '../../components/EmptyState'
import { ReadOnlyField, TextAreaField } from '../../components/Field'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StageTracker } from '../../components/StageTracker'
import { StatusBadge } from '../../components/StatusBadge'
import { Tabs } from '../../components/Tabs'
import { Timeline } from '../../components/Timeline'
import { clientName, formatDate, formatDateTime, formatScr, localId } from '../../lib/format'
import { composeNotification, templatesFor } from '../../lib/notify'
import { can } from '../../lib/rbac'
import { advance, currentStage, statusLabel } from '../../lib/workflow'
import { ROLE_LABELS } from '../../lib/types'
import type { DocRef, LoanStatus } from '../../lib/types'

/** The document categories an application must carry before assessment (v.2). */
const REQUIRED_DOCUMENTS = [
  { category: 'Identity', why: 'Confirms the applicant against the client record.' },
  { category: 'Business plan', why: 'Evidences the proposed use of funds.' },
  { category: 'Financial', why: 'Evidences repayment capacity.' },
]

/**
 * S05 — a single application (v.2, v.3, v.4, v.5).
 *
 * The decision panel is driven by the workflow definition held in the store:
 * the stage names the role that must act, and only a user holding that role
 * sees the approve/reject controls.
 */
export function LoanDetail() {
  const { id } = useParams<{ id: string }>()
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()

  const [tab, setTab] = useState('overview')
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null)
  const [comment, setComment] = useState('')
  const [disburseOpen, setDisburseOpen] = useState(false)

  const loan = db.loans.find((l) => l.id === id)
  const client = db.clients.find((c) => c.id === loan?.clientId)
  const farm = db.farms.find((f) => f.id === loan?.farmId)
  const workflow = db.workflows.find((w) => w.id === loan?.workflowId)

  const actorNames = useMemo(
    () => Object.fromEntries(db.users.map((u) => [u.id, u.fullName])),
    [db.users],
  )

  /** The global audit entries that concern this application (v.5). */
  const auditEntries = useMemo(
    () => (loan ? db.audit.filter((e) => e.entityId === loan.id).slice().reverse() : []),
    [db.audit, loan],
  )

  if (!loan || !client) {
    return (
      <div className="ais-card">
        <EmptyState
          title="Loan application not found"
          action={<Link to="/loans" className="ais-btn-secondary">Back to the pipeline</Link>}
        />
      </div>
    )
  }

  const stage = currentStage(loan.stageInstances)
  const stageDefinition = workflow?.stages.find((s) => s.id === stage?.stageId)

  const isOpen = ['submitted', 'under-review'].includes(loan.status)
  const holdsStageRole = user?.role === stage?.actorRole || role === 'admin'
  const holdsPermission = can(role, 'loans.assess') || can(role, 'loans.decide')
  const canDecide = isOpen && Boolean(stage) && holdsStageRole && holdsPermission

  const documentsPresent = REQUIRED_DOCUMENTS.map((r) => ({
    ...r,
    doc: loan.documents.find((d) => d.category === r.category),
  }))
  const missingDocuments = documentsPresent.filter((d) => !d.doc)
  const unverifiedDocuments = documentsPresent.filter((d) => d.doc && d.doc.verification !== 'verified')

  /* --------------------------------------------------------- actions */

  const notifyClient = (status: string, detail: string) => {
    for (const template of templatesFor(db.notificationTemplates, 'application.status.changed')) {
      if (template.channel === 'email' && !client.email) continue
      dispatch({
        type: 'notification/add',
        notification: composeNotification({
          template,
          client,
          vars: {
            applicationType: 'loan application',
            applicationId: loan.id,
            status: statusLabel(status).toLowerCase(),
            detail,
          },
          relatedType: 'loan',
          relatedId: loan.id,
        }),
      })
    }
  }

  const submitDecision = () => {
    if (!user || !stage || !decision) return
    const on = new Date().toISOString().slice(0, 10)
    const result = advance(loan.stageInstances, {
      stageId: stage.stageId,
      outcome: decision,
      byUserId: user.id,
      on,
      comment: comment.trim() || undefined,
    })

    const nextStatus: LoanStatus = result.status
    const nextStageName = result.currentStageId
      ? (workflow?.stages.find((s) => s.id === result.currentStageId)?.name ?? '')
      : ''

    dispatch({
      type: 'loan/update',
      id: loan.id,
      patch: {
        stageInstances: result.stages,
        status: nextStatus,
        currentStageId: result.currentStageId,
      },
      change: {
        id: localId('LH'),
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
        action: decision === 'approved' ? 'workflow.stage.approved' : 'workflow.stage.rejected',
        entityType: 'loan',
        entityId: loan.id,
        detail: `Stage "${stage.name}" ${decision}${nextStageName ? ` — routed to "${nextStageName}"` : ` — application ${statusLabel(nextStatus).toLowerCase()}`}`,
      },
    })

    if (result.currentStageId) {
      dispatch({
        type: 'loan/update',
        id: loan.id,
        patch: {},
        change: {
          id: localId('LH'),
          at: new Date().toISOString(),
          actorUserId: 'SYSTEM',
          actorName: 'Workflow engine',
          action: `Routed to stage "${nextStageName}"`,
        },
      })
    }

    notifyClient(
      nextStatus,
      decision === 'approved' && result.final
        ? 'Your application has been approved. The district office will contact you about disbursement.'
        : decision === 'rejected'
          ? `The application was not approved at the "${stage.name}" stage.`
          : `The application has passed "${stage.name}" and is now with the ${nextStageName.toLowerCase()}.`,
    )

    setDecision(null)
    setComment('')
    toast({
      tone: decision === 'approved' ? 'success' : 'warning',
      title: `Stage ${decision}`,
      body: result.final
        ? `Application ${statusLabel(nextStatus).toLowerCase()}. Applicant notified.`
        : `Routed to "${nextStageName}". Applicant notified.`,
      simulated: true,
    })
  }

  const recordDisbursement = () => {
    if (!user) return
    dispatch({
      type: 'loan/update',
      id: loan.id,
      patch: {
        status: 'disbursed',
        disbursedOn: new Date().toISOString().slice(0, 10),
        balanceScr: loan.amountScr,
      },
      change: {
        id: localId('LH'),
        at: new Date().toISOString(),
        actorUserId: user.id,
        actorName: user.fullName,
        action: 'Disbursement recorded',
        field: 'status',
        from: 'approved',
        to: 'disbursed',
      },
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'loan.disbursed',
        entityType: 'loan',
        entityId: loan.id,
        detail: `Disbursement of ${formatScr(loan.amountScr)} recorded`,
      },
    })
    notifyClient('disbursed', `${formatScr(loan.amountScr)} has been disbursed against your approved application.`)
    setDisburseOpen(false)
    toast({ tone: 'success', title: 'Disbursement recorded', body: 'Applicant notified.', simulated: true })
  }

  const addDocument = (doc: DocRef) => {
    if (!user) return
    dispatch({
      type: 'loan/update',
      id: loan.id,
      patch: { documents: [...loan.documents, doc] },
      change: {
        id: localId('LH'),
        at: new Date().toISOString(),
        actorUserId: user.id,
        actorName: user.fullName,
        action: 'Supporting document attached',
        note: `${doc.name} (${doc.category})`,
      },
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'loan.document.added',
        entityType: 'loan',
        entityId: loan.id,
        detail: `Document "${doc.name}" attached to ${loan.id}`,
      },
    })
    toast({ tone: 'success', title: 'Document attached', simulated: true })
  }

  const verifyDocument = (docId: string) => {
    if (!user) return
    const doc = loan.documents.find((d) => d.id === docId)
    if (!doc) return
    dispatch({
      type: 'loan/update',
      id: loan.id,
      patch: {
        documents: loan.documents.map((d) =>
          d.id === docId
            ? { ...d, verification: 'verified' as const, verifiedBy: user.id, verifiedOn: new Date().toISOString().slice(0, 10) }
            : d,
        ),
      },
      change: {
        id: localId('LH'),
        at: new Date().toISOString(),
        actorUserId: user.id,
        actorName: user.fullName,
        action: 'Document verified',
        note: doc.name,
      },
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'loan.document.verified',
        entityType: 'loan',
        entityId: loan.id,
        detail: `Document "${doc.name}" verified`,
      },
    })
    toast({ tone: 'success', title: 'Document verified' })
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'documents', label: 'Documents', count: loan.documents.length },
    { id: 'audit', label: 'Audit trail', count: loan.history.length + auditEntries.length },
  ]

  return (
    <div className="pb-6">
      <PageHeader
        screen="S05"
        title={loan.purpose}
        description={`${clientName(client)} · ${farm?.name ?? loan.farmId} · ${farm?.district ?? ''}`}
        refs={['v.3', 'v.4']}
        actions={
          <>
            <Link to="/loans" className="ais-btn-secondary">Back to pipeline</Link>
            {loan.status === 'approved' && can(role, 'loans.decide') && (
              <button type="button" className="ais-btn-primary" onClick={() => setDisburseOpen(true)}>
                Record disbursement
              </button>
            )}
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded bg-ink-100 px-2 py-1 font-mono text-xs font-semibold text-ink-700">{loan.id}</span>
          <StatusBadge status={loan.status} />
          <span className="text-sm font-semibold text-ink-900">{formatScr(loan.amountScr)}</span>
          <span className="text-sm text-ink-500">
            {loan.termMonths} months at {loan.interestRatePct}%
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
            </Link>
          )}
        </div>
      </PageHeader>

      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-4" />

      {tab === 'overview' && (
        <div className="space-y-5">
          {/* ------------------------------------------ status tracker */}
          <section className="ais-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Approval workflow
                <ReqBadge refs={['v.3', 'v.4']} screen="S05" />
              </h2>
              {workflow && (
                <span className="text-xs text-ink-500">
                  {workflow.name} · {workflow.stages.length} stages · configured{' '}
                  {formatDate(workflow.updatedOn)}
                </span>
              )}
            </div>
            <div className="mt-4">
              <StageTracker stages={loan.stageInstances} actorNames={actorNames} />
            </div>
            <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-500">
              Stages and their acting roles come from the workflow definition held in the system, not
              from code. An administrator can change the hierarchy without a redeployment.
            </p>
          </section>

          {/* ----------------------------------------- decision panel */}
          {isOpen && stage && (
            <section
              className={`rounded-lg border p-4 ${
                canDecide ? 'border-brand-300 bg-brand-50' : 'border-ink-200 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-ink-900">
                  Current stage — {stage.name}
                </h2>
                <StatusBadge status="in-progress" label={`Awaiting ${ROLE_LABELS[stage.actorRole]}`} />
              </div>
              {stageDefinition && (
                <p className="mt-1 text-sm text-ink-600">
                  {stageDefinition.description} Service standard {stageDefinition.slaDays} days.
                </p>
              )}

              {canDecide ? (
                <>
                  {(missingDocuments.length > 0 || unverifiedDocuments.length > 0) && (
                    <p className="mt-3 rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-sm text-warn-800">
                      {missingDocuments.length > 0 && (
                        <>
                          <strong>{missingDocuments.length} required document
                          {missingDocuments.length > 1 ? 's are' : ' is'} missing</strong>{' '}
                          ({missingDocuments.map((d) => d.category).join(', ')}).{' '}
                        </>
                      )}
                      {unverifiedDocuments.length > 0 && (
                        <>{unverifiedDocuments.length} attached document
                        {unverifiedDocuments.length > 1 ? 's have' : ' has'} not been verified.</>
                      )}{' '}
                      A decision can still be recorded, and the gap is written to the audit trail.
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
                  {holdsStageRole
                    ? 'Your role does not carry the permission required to decide this stage.'
                    : `This stage is awaiting a decision from a ${ROLE_LABELS[stage.actorRole]}. You are signed in as ${role ? ROLE_LABELS[role] : 'an unknown role'}, so the controls are not available — role-based access control is enforced per stage, not only per screen.`}
                </p>
              )}
            </section>
          )}

          {/* ------------------------------------- application details */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
            <section className="ais-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-ink-900">Application</h2>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
                <ReadOnlyField label="Reference" value={<span className="font-mono">{loan.id}</span>} />
                <ReadOnlyField label="Submitted" value={formatDate(loan.submittedOn)} />
                <ReadOnlyField label="Amount requested" value={formatScr(loan.amountScr)} />
                <ReadOnlyField label="Term" value={`${loan.termMonths} months`} />
                <ReadOnlyField label="Interest rate" value={`${loan.interestRatePct}%`} />
                <ReadOnlyField label="Status" value={statusLabel(loan.status)} />
                {loan.disbursedOn && <ReadOnlyField label="Disbursed" value={formatDate(loan.disbursedOn)} />}
                {loan.balanceScr !== undefined && (
                  <ReadOnlyField label="Outstanding balance" value={formatScr(loan.balanceScr)} />
                )}
                <ReadOnlyField label="Purpose" value={loan.purpose} className="col-span-2" />
              </dl>
            </section>

            <section className="ais-card p-4">
              <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Document checklist
                <ReqBadge refs="v.2" screen="S05" />
              </h2>
              <ul className="space-y-2">
                {documentsPresent.map((row) => (
                  <li
                    key={row.category}
                    className={`rounded-lg border p-3 ${
                      row.doc?.verification === 'verified'
                        ? 'border-brand-200 bg-brand-50/50'
                        : row.doc
                          ? 'border-warn-200 bg-warn-50/50'
                          : 'border-danger-200 bg-danger-50/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink-900">{row.category}</span>
                      {row.doc ? (
                        <StatusBadge status={row.doc.verification} />
                      ) : (
                        <StatusBadge status="missing" tone="bad" label="Missing" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-600">
                      {row.doc ? row.doc.name : row.why}
                    </p>
                    {row.doc && row.doc.verification === 'pending' && can(role, 'loans.assess') && (
                      <button
                        type="button"
                        className="ais-btn-secondary mt-2 px-2.5 py-1 text-xs"
                        onClick={() => verifyDocument(row.doc!.id)}
                      >
                        Mark as verified
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-500">
                {loan.documents.length} document{loan.documents.length === 1 ? '' : 's'} attached in
                total — see the Documents tab.
              </p>
            </section>
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <section className="ais-card p-4">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
            Supporting documents
            <ReqBadge refs="v.2" screen="S05" />
          </h2>
          <DocUploader
            documents={loan.documents}
            onAdd={can(role, 'loans.assess') || can(role, 'portal.self') ? addDocument : undefined}
            readOnly={!can(role, 'loans.assess') && !can(role, 'portal.self')}
            uploadedBy={user?.id ?? 'SYSTEM'}
            categories={['Identity', 'Business plan', 'Financial', 'Tenure evidence', 'Quotation', 'Other']}
            label="Attachments"
            hint="Identity, business plan and financial evidence are required before assessment."
          />
          {can(role, 'loans.assess') && loan.documents.some((d) => d.verification === 'pending') && (
            <div className="mt-4 rounded-lg border border-warn-200 bg-warn-50 p-3">
              <p className="text-sm font-semibold text-warn-900">Awaiting verification</p>
              <ul className="mt-2 space-y-1.5">
                {loan.documents
                  .filter((d) => d.verification === 'pending')
                  .map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-ink-800">{d.name}</span>
                      <button
                        type="button"
                        className="ais-btn-secondary px-3 py-1.5 text-xs"
                        onClick={() => verifyDocument(d.id)}
                      >
                        Mark as verified
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {tab === 'audit' && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
          <section className="ais-card p-4">
            <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              Application trail
              <ReqBadge refs="v.5" screen="S05" />
              <SimChip label="append-only" title="Entries are appended, never edited or removed." />
            </h2>
            <Timeline events={loan.history} />
          </section>

          <section className="ais-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink-900">System audit entries</h2>
            <p className="mb-3 text-xs text-ink-500">
              The hash-chained entries in the central audit log that reference{' '}
              <span className="font-mono">{loan.id}</span>. The full log, with chain verification, is
              on the Administration screen.
            </p>
            {auditEntries.length === 0 ? (
              <p className="text-sm text-ink-500">No central audit entries reference this application yet.</p>
            ) : (
              <ul className="space-y-2">
                {auditEntries.map((e) => (
                  <li key={e.id} className="rounded-lg border border-ink-200 p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <code className="font-mono text-xs font-semibold text-ink-800">{e.action}</code>
                      <span className="text-xs text-ink-500">{formatDateTime(e.at)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-700">{e.detail}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {e.actorName} · {ROLE_LABELS[e.actorRole]} ·{' '}
                      <span className="font-mono">#{e.seq}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* ------------------------------------------------ decision modal */}
      <Modal
        open={decision !== null}
        onClose={() => setDecision(null)}
        title={decision === 'approved' ? `Approve stage: ${stage?.name ?? ''}` : 'Reject application'}
        tone={decision === 'rejected' ? 'danger' : 'neutral'}
        size="md"
        description={
          decision === 'approved'
            ? 'The application moves to the next stage, or is approved outright if this is the final stage.'
            : 'A rejection is terminal. Remaining stages are marked as not reached.'
        }
        footer={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => setDecision(null)}>
              Cancel
            </button>
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
            <ReadOnlyField label="Application" value={<span className="font-mono">{loan.id}</span>} />
            <ReadOnlyField label="Amount" value={formatScr(loan.amountScr)} />
            <ReadOnlyField label="Deciding as" value={user ? `${user.fullName} · ${ROLE_LABELS[user.role]}` : '—'} />
            <ReadOnlyField label="Stage" value={stage?.name ?? '—'} />
          </dl>
          <TextAreaField
            label="Decision note"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              decision === 'approved'
                ? 'e.g. Farm verified on site. Broiler capacity and repayment plan are realistic.'
                : 'e.g. Insufficient repayment capacity evidenced.'
            }
            hint="The note is stored on the stage, shown in the status tracker, and written to the audit trail."
          />
          <p className="inline-flex flex-wrap items-center gap-2 text-xs text-ink-500">
            The applicant is notified by SMS and email when the decision is recorded.
            <SimChip />
          </p>
        </div>
      </Modal>

      {/* ------------------------------------------- disbursement modal */}
      <Modal
        open={disburseOpen}
        onClose={() => setDisburseOpen(false)}
        title="Record disbursement"
        size="sm"
        description="Marks the approved loan as disbursed and opens the repayment balance."
        footer={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => setDisburseOpen(false)}>
              Cancel
            </button>
            <button type="button" className="ais-btn-primary" onClick={recordDisbursement}>
              Record {formatScr(loan.amountScr)}
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          This prototype records the disbursement against the application and notifies the applicant.
          It does not move money and is not connected to any financial system.
        </p>
      </Modal>
    </div>
  )
}
