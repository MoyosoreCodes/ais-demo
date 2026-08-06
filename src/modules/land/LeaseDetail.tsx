import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { DocUploader } from '../../components/DocUploader'
import { EmptyState } from '../../components/EmptyState'
import { ReadOnlyField, SelectField, TextAreaField } from '../../components/Field'
import { MapView } from '../../components/MapPicker'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StatusBadge } from '../../components/StatusBadge'
import { Tabs } from '../../components/Tabs'
import { Timeline } from '../../components/Timeline'
import { DEMO_TODAY, clientName, formatDate, formatHa, formatScr, localId } from '../../lib/format'
import { composeNotification, templatesFor } from '../../lib/notify'
import { can } from '../../lib/rbac'
import { statusLabel } from '../../lib/workflow'
import type { DocRef, EnforcementAction } from '../../lib/types'

/** The escalation ladder for non-compliance (iv.7). */
const ENFORCEMENT_LADDER: {
  type: EnforcementAction['type']
  label: string
  description: string
}[] = [
  { type: 'warning', label: 'Written warning', description: 'First formal notice of non-compliance, with a period to remedy.' },
  { type: 'retraction-notice', label: 'Retraction notice', description: 'Notice of intent to retract the allocation, subject to appeal.' },
  { type: 'eviction-notice', label: 'Eviction notice', description: 'Final notice to vacate the parcel. Requires supervisor approval.' },
]

const NON_COMPLIANCE_REASONS = [
  'Annual rent unpaid for more than 12 months.',
  'Parcel left uncultivated contrary to lease condition 4(b).',
  'Unauthorised sub-letting of the leased parcel.',
  'Watercourse buffer breached by unauthorised construction.',
  'Access denied to authorised officers for inspection.',
]

/**
 * S04 — a single lease (iv.5, iv.6 ★, iv.7, iv.8).
 *
 * The enforcement ladder is deliberately explicit: a warning precedes a
 * retraction notice, which precedes eviction, and each notice is recorded with
 * the officer who raised it.
 */
export function LeaseDetail() {
  const { id } = useParams<{ id: string }>()
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()

  const [tab, setTab] = useState('overview')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [enforcementOpen, setEnforcementOpen] = useState(false)

  const lease = db.leases.find((l) => l.id === id)
  const client = db.clients.find((c) => c.id === lease?.clientId)
  const farm = db.farms.find((f) => f.id === lease?.farmId) ?? db.farms.find((f) => f.parcelRef === lease?.parcelRef)

  const actions = useMemo(
    () => db.enforcementActions.filter((e) => e.leaseId === lease?.id),
    [db.enforcementActions, lease?.id],
  )

  if (!lease || !client) {
    return (
      <div className="ais-card">
        <EmptyState
          title="Lease not found"
          action={<Link to="/land" className="ais-btn-secondary">Back to land management</Link>}
        />
      </div>
    )
  }

  const daysToExpiry = differenceInCalendarDays(parseISO(lease.endDate), DEMO_TODAY)
  const canManage = can(role, 'land.edit') || role === 'admin'
  const canEnforce = can(role, 'land.decide') || can(role, 'land.edit') || role === 'admin'

  /* --------------------------------------------------------- actions */

  const recordPayment = () => {
    if (!user) return
    const today = DEMO_TODAY.toISOString().slice(0, 10)
    dispatch({
      type: 'lease/update',
      id: lease.id,
      patch: {
        paymentStatus: 'current',
        lastPaymentOn: today,
        nextPaymentDue: format(addDays(DEMO_TODAY, 365), 'yyyy-MM-dd'),
      },
      change: {
        id: localId('LSH'),
        at: new Date().toISOString(),
        actorUserId: user.id,
        actorName: user.fullName,
        action: 'Annual rent payment recorded',
        field: 'paymentStatus',
        from: statusLabel(lease.paymentStatus),
        to: 'Current',
        note: `${formatScr(lease.annualRentScr)} received.`,
      },
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'lease.payment.recorded',
        entityType: 'lease',
        entityId: lease.id,
        detail: `Annual rent of ${formatScr(lease.annualRentScr)} recorded; next payment due in 12 months`,
      },
    })
    setPaymentOpen(false)
    toast({ tone: 'success', title: 'Payment recorded', body: 'The lease is now current.' })
  }

  const sendReminder = (kind: 'expiry' | 'payment') => {
    if (!user) return
    const event = kind === 'expiry' ? 'lease.expiring' : 'lease.payment.due'
    let sent = 0
    for (const template of templatesFor(db.notificationTemplates, event)) {
      if (template.channel === 'email' && !client.email) continue
      dispatch({
        type: 'notification/add',
        notification: composeNotification({
          template,
          client,
          vars: {
            leaseId: lease.id,
            parcelRef: lease.parcelRef,
            endDate: formatDate(lease.endDate),
            dueDate: formatDate(lease.nextPaymentDue),
            amount: lease.annualRentScr.toLocaleString('en-GB'),
          },
          relatedType: 'lease',
          relatedId: lease.id,
        }),
      })
      sent += 1
    }
    dispatch({
      type: 'lease/update',
      id: lease.id,
      patch: {},
      change: {
        id: localId('LSH'),
        at: new Date().toISOString(),
        actorUserId: user.id,
        actorName: user.fullName,
        action: kind === 'expiry' ? 'Lease-expiry reminder issued' : 'Lease-payment reminder issued',
        note: `${sent} channel${sent === 1 ? '' : 's'} (simulated delivery).`,
      },
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: kind === 'expiry' ? 'lease.reminder.expiry' : 'lease.reminder.payment',
        entityType: 'lease',
        entityId: lease.id,
        detail: `${kind} reminder issued to ${clientName(client)} across ${sent} channel(s)`,
      },
    })
    setReminderOpen(false)
    toast({ tone: 'success', title: 'Reminder issued', body: `${sent} message(s) recorded.`, simulated: true })
  }

  const raiseEnforcement = (type: EnforcementAction['type'], reason: string, note: string) => {
    if (!user) return
    const today = DEMO_TODAY.toISOString().slice(0, 10)
    const action: EnforcementAction = {
      id: localId('ENF'),
      leaseId: lease.id,
      clientId: client.id,
      type,
      raisedOn: today,
      raisedByUserId: user.id,
      reason,
      status: type === 'eviction-notice' ? 'under-review' : 'open',
      noticeServedOn: today,
      history: [
        {
          id: localId('ENH'),
          at: new Date().toISOString(),
          actorUserId: user.id,
          actorName: user.fullName,
          action: `${ENFORCEMENT_LADDER.find((l) => l.type === type)?.label ?? type} raised`,
          note: note.trim() || undefined,
        },
        {
          id: localId('ENH'),
          at: new Date().toISOString(),
          actorUserId: user.id,
          actorName: user.fullName,
          action: 'Notice served to lessee',
        },
      ],
    }

    dispatch({
      type: 'enforcement/create',
      action,
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'land.enforcement.raised',
        entityType: 'lease',
        entityId: lease.id,
        detail: `${ENFORCEMENT_LADDER.find((l) => l.type === type)?.label ?? type} raised against ${lease.id} — ${reason}`,
      },
    })

    // An eviction notice retires the lease itself.
    if (type === 'eviction-notice') {
      dispatch({
        type: 'lease/update',
        id: lease.id,
        patch: { status: 'terminated' },
        change: {
          id: localId('LSH'),
          at: new Date().toISOString(),
          actorUserId: user.id,
          actorName: user.fullName,
          action: 'Lease terminated following eviction notice',
          field: 'status',
          from: statusLabel(lease.status),
          to: 'Terminated',
        },
      })
    }

    for (const template of templatesFor(db.notificationTemplates, 'application.status.changed')) {
      if (template.channel === 'email' && !client.email) continue
      dispatch({
        type: 'notification/add',
        notification: composeNotification({
          template,
          client,
          vars: {
            applicationType: 'lease',
            applicationId: lease.id,
            status: ENFORCEMENT_LADDER.find((l) => l.type === type)?.label.toLowerCase() ?? type,
            detail: `${reason} Contact your district office within 30 days.`,
          },
          relatedType: 'lease',
          relatedId: lease.id,
        }),
      })
    }

    setEnforcementOpen(false)
    toast({
      tone: 'warning',
      title: 'Enforcement action raised',
      body: 'Notice served and the lessee notified.',
      simulated: true,
    })
  }

  const addDocument = (doc: DocRef) => {
    if (!user) return
    dispatch({
      type: 'lease/update',
      id: lease.id,
      patch: { documents: [...lease.documents, doc] },
      change: {
        id: localId('LSH'),
        at: new Date().toISOString(),
        actorUserId: user.id,
        actorName: user.fullName,
        action: 'Document attached',
        note: `${doc.name} (${doc.category})`,
      },
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'lease.document.added', entityType: 'lease', entityId: lease.id,
        detail: `Document "${doc.name}" attached to ${lease.id}`,
      },
    })
    toast({ tone: 'success', title: 'Document attached', simulated: true })
  }

  const nextLadderStep = ENFORCEMENT_LADDER.find(
    (step) => !actions.some((a) => a.type === step.type),
  )

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'enforcement', label: 'Enforcement', count: actions.length },
    { id: 'documents', label: 'Documents', count: lease.documents.length },
    { id: 'history', label: 'History', count: lease.history.length },
  ]

  return (
    <div className="pb-6">
      <PageHeader
        screen="S04"
        title={`Lease ${lease.id}`}
        description={`${clientName(client)} · parcel ${lease.parcelRef} · ${lease.district}`}
        refs={['iv.5', 'iv.6']}
        actions={
          <>
            <Link to="/land" className="ais-btn-secondary">Back to land management</Link>
            {canManage && lease.paymentStatus !== 'current' && (
              <button type="button" className="ais-btn-primary" onClick={() => setPaymentOpen(true)}>
                Record payment
              </button>
            )}
            {can(role, 'notifications.manage') && (
              <button type="button" className="ais-btn-secondary" onClick={() => setReminderOpen(true)}>
                Issue reminder
                <ReqBadge refs="iv.6" screen="S04" />
              </button>
            )}
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded bg-ink-100 px-2 py-1 font-mono text-xs font-semibold text-ink-700">{lease.parcelRef}</span>
          <StatusBadge status={lease.status} />
          <StatusBadge status={lease.paymentStatus} label={`Payment ${statusLabel(lease.paymentStatus).toLowerCase()}`} />
          {lease.status === 'active' && (
            <span className={`text-xs font-medium ${daysToExpiry < 0 ? 'text-danger-600' : daysToExpiry <= 90 ? 'text-warn-600' : 'text-ink-500'}`}>
              {daysToExpiry < 0 ? `Expired ${Math.abs(daysToExpiry)} days ago` : `${daysToExpiry} days to expiry`}
            </span>
          )}
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
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
          <section className="ais-card p-4">
            <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              Lease terms
              <ReqBadge refs="iv.5" screen="S04" />
            </h2>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
              <ReadOnlyField label="Lease reference" value={<span className="font-mono">{lease.id}</span>} />
              <ReadOnlyField label="Parcel" value={<span className="font-mono">{lease.parcelRef}</span>} />
              <ReadOnlyField label="Area" value={formatHa(lease.areaHa)} />
              <ReadOnlyField label="District" value={lease.district} />
              <ReadOnlyField label="Commences" value={formatDate(lease.startDate)} />
              <ReadOnlyField label="Expires" value={formatDate(lease.endDate)} />
              <ReadOnlyField label="Annual rent" value={formatScr(lease.annualRentScr)} />
              <ReadOnlyField label="Status" value={statusLabel(lease.status)} />
            </dl>
          </section>

          <section className="ais-card p-4">
            <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              Payment position
              <ReqBadge refs="iv.6" screen="S04" />
            </h2>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
              <ReadOnlyField label="Payment status" value={<StatusBadge status={lease.paymentStatus} />} />
              <ReadOnlyField label="Last payment" value={lease.lastPaymentOn ? formatDate(lease.lastPaymentOn) : 'None recorded'} />
              <ReadOnlyField label="Next payment due" value={formatDate(lease.nextPaymentDue)} />
              <ReadOnlyField label="Annual rent" value={formatScr(lease.annualRentScr)} />
            </dl>

            {lease.paymentStatus === 'overdue' && (
              <p className="mt-3 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-800">
                Rent has been overdue since {formatDate(lease.nextPaymentDue)}. Sustained non-payment
                is grounds for the enforcement ladder on the Enforcement tab.
              </p>
            )}
            {lease.status === 'active' && daysToExpiry <= 90 && daysToExpiry >= 0 && (
              <p className="mt-3 rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-sm text-warn-800">
                This lease expires in {daysToExpiry} days. Issue a renewal reminder from the header.
              </p>
            )}

            {farm && (
              <div className="mt-4">
                <MapView
                  markers={[{ id: farm.id, lat: farm.lat, lng: farm.lng, label: lease.parcelRef, detail: `${lease.id} · ${formatHa(lease.areaHa)}` }]}
                  center={{ lat: farm.lat, lng: farm.lng }}
                  zoom={15}
                  height={200}
                />
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'enforcement' && (
        <div className="space-y-5">
          <section className="ais-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Retraction and eviction
                <ReqBadge refs="iv.7" screen="S04" />
              </h2>
              {canEnforce && nextLadderStep && lease.status !== 'terminated' && (
                <button type="button" className="ais-btn-danger" onClick={() => setEnforcementOpen(true)}>
                  Raise {nextLadderStep.label.toLowerCase()}
                </button>
              )}
            </div>

            <ol className="space-y-2">
              {ENFORCEMENT_LADDER.map((step, i) => {
                const raised = actions.find((a) => a.type === step.type)
                return (
                  <li
                    key={step.type}
                    className={`rounded-lg border p-3 ${raised ? 'border-danger-200 bg-danger-50/50' : 'border-ink-200'}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-ink-900">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${raised ? 'bg-danger-500 text-white' : 'bg-ink-100 text-ink-500'}`}>
                          {i + 1}
                        </span>
                        {step.label}
                      </span>
                      {raised ? <StatusBadge status={raised.status} /> : <span className="text-xs text-ink-400">Not raised</span>}
                    </div>
                    <p className="mt-1 pl-8 text-xs text-ink-600">{step.description}</p>
                    {raised && (
                      <div className="mt-2 pl-8">
                        <p className="text-sm text-ink-800">{raised.reason}</p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          Raised {formatDate(raised.raisedOn)}
                          {raised.noticeServedOn && ` · notice served ${formatDate(raised.noticeServedOn)}`}
                          {' · '}
                          {db.users.find((u) => u.id === raised.raisedByUserId)?.fullName ?? raised.raisedByUserId}
                        </p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>

            {lease.status === 'terminated' && (
              <p className="mt-3 rounded-md border border-danger-300 bg-danger-50 px-3 py-2 text-sm text-danger-800">
                This lease has been terminated. The record is retained on the register so the
                enforcement history remains auditable.
              </p>
            )}
          </section>

          {actions.length > 0 && (
            <section className="ais-card p-4">
              <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Enforcement history
                <ReqBadge refs="iv.8" screen="S04" />
              </h2>
              {actions.map((a) => (
                <div key={a.id} className="mb-4 last:mb-0">
                  <p className="mb-2 font-mono text-xs text-ink-500">{a.id}</p>
                  <Timeline events={a.history} />
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {tab === 'documents' && (
        <section className="ais-card p-4">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
            Lease documents
            <ReqBadge refs="iv.4" screen="S04" />
          </h2>
          <DocUploader
            documents={lease.documents}
            onAdd={canManage ? addDocument : undefined}
            readOnly={!canManage}
            uploadedBy={user?.id ?? 'SYSTEM'}
            categories={['Lease', 'Notice', 'Correspondence', 'Payment receipt', 'Site plan', 'Other']}
            label="Attachments"
            hint="The signed agreement, served notices and payment receipts."
          />
        </section>
      )}

      {tab === 'history' && (
        <section className="ais-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-900">Lease history</h2>
            <ReqBadge refs="iv.8" screen="S04" />
            <SimChip label="append-only" title="Entries are appended, never edited or removed." />
          </div>
          <Timeline events={lease.history} />
        </section>
      )}

      {/* -------------------------------------------------- dialogs */}
      <Modal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title="Record annual rent payment"
        size="sm"
        footer={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => setPaymentOpen(false)}>Cancel</button>
            <button type="button" className="ais-btn-primary" onClick={recordPayment}>
              Record {formatScr(lease.annualRentScr)}
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          Marks the lease as current and sets the next payment due in twelve months. The prototype
          records the receipt against the lease; it does not process a payment.
        </p>
      </Modal>

      <Modal
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        title="Issue a reminder"
        size="sm"
        description={<span className="inline-flex flex-wrap items-center gap-2">SMS and email to the lessee. <SimChip /></span>}
      >
        <div className="space-y-2">
          <button type="button" className="ais-btn-secondary w-full justify-start" onClick={() => sendReminder('expiry')}>
            Lease-expiry reminder — expires {formatDate(lease.endDate)}
          </button>
          <button type="button" className="ais-btn-secondary w-full justify-start" onClick={() => sendReminder('payment')}>
            Payment reminder — {formatScr(lease.annualRentScr)} due {formatDate(lease.nextPaymentDue)}
          </button>
        </div>
      </Modal>

      <EnforcementDialog
        open={enforcementOpen}
        onClose={() => setEnforcementOpen(false)}
        step={nextLadderStep}
        onRaise={raiseEnforcement}
      />
    </div>
  )
}

function EnforcementDialog({
  open, onClose, step, onRaise,
}: {
  open: boolean
  onClose: () => void
  step?: (typeof ENFORCEMENT_LADDER)[number]
  onRaise: (type: EnforcementAction['type'], reason: string, note: string) => void
}) {
  const [reason, setReason] = useState(NON_COMPLIANCE_REASONS[0])
  const [note, setNote] = useState('')

  if (!step) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Raise a ${step.label.toLowerCase()}`}
      tone="danger"
      size="md"
      description={step.description}
      footer={
        <>
          <button type="button" className="ais-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="ais-btn-danger" onClick={() => onRaise(step.type, reason, note)}>
            Raise and serve notice
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField
          label="Grounds for the action"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          hint="Recorded on the notice and in the audit log."
        >
          {NON_COMPLIANCE_REASONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </SelectField>
        <TextAreaField
          label="Officer note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything the district office should record alongside the notice."
        />
        {step.type === 'eviction-notice' && (
          <p className="rounded-md border border-danger-300 bg-danger-50 px-3 py-2 text-sm text-danger-800">
            An eviction notice terminates the lease on the register and is raised for supervisor
            review. The lease record is retained so the enforcement history stays auditable.
          </p>
        )}
        <p className="inline-flex flex-wrap items-center gap-2 text-xs text-ink-500">
          The lessee is notified when the notice is served. <SimChip />
        </p>
      </div>
    </Modal>
  )
}
