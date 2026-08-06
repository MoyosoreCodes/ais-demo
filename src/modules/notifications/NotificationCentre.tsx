import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { EmptyState } from '../../components/EmptyState'
import { SelectField, TextAreaField, TextField } from '../../components/Field'
import { KpiCard } from '../../components/KpiCard'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StatusBadge } from '../../components/StatusBadge'
import { Tabs } from '../../components/Tabs'
import { clientName, formatDateTime, localId } from '../../lib/format'
import { CHANNEL_LABELS, renderTemplate } from '../../lib/notify'
import { can } from '../../lib/rbac'
import { statusLabel } from '../../lib/workflow'
import type { AppNotification, FeedbackMessage, NotificationTemplate } from '../../lib/types'

const CHANNEL_TONE: Record<string, string> = {
  sms: 'border-brand-200 bg-brand-50 text-brand-800',
  email: 'border-ink-300 bg-ink-100 text-ink-700',
  'in-app': 'border-warn-200 bg-warn-50 text-warn-800',
}

/** Sample values so a template preview reads like a real message. */
const PREVIEW_VARS: Record<string, string> = {
  firstName: 'Marie-Ange',
  lastName: 'Hoareau',
  applicationType: 'loan application',
  applicationId: 'LN-2026-0014',
  status: 'approved',
  detail: 'The committee approved the application at its meeting.',
  sampleId: 'LAB-2026-0031',
  sampleType: 'soil',
  farmName: 'Rivière Doux Farm',
  interpretation: 'Available phosphorus is below the target range and pH is marginally low for banana.',
  leaseId: 'LSE-2019-0044',
  parcelRef: 'PR/AB/1042',
  endDate: '30 Jun 2029',
  dueDate: '27 Dec 2026',
  amount: '2,400',
  inspectionType: 'loan-verification',
  scheduledOn: '12 Mar 2026',
  caseId: 'SUR-2026-004',
  disease: 'Newcastle disease',
}

/**
 * S13 — notification centre (xiii.1–xiii.5).
 *
 * Every message the system has sent, across all three channels, with the
 * templates that produced them. Email and SMS delivery is simulated; in-app
 * messages are genuinely delivered to the recipient's portal, and the list says
 * which is which.
 */
export function NotificationCentre() {
  const db = useDb()
  const dispatch = useDispatch()
  const { role } = useAuth()
  const { toast } = useToast()

  const [tab, setTab] = useState('sent')
  const [query, setQuery] = useState('')
  const [channel, setChannel] = useState('all')
  const [event, setEvent] = useState('all')
  const [preview, setPreview] = useState<AppNotification | null>(null)

  const clientById = useMemo(() => new Map(db.clients.map((c) => [c.id, c])), [db.clients])

  const events = useMemo(
    () => [...new Set(db.notifications.map((n) => n.event))].sort(),
    [db.notifications],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return db.notifications.filter((n) => {
      if (channel !== 'all' && n.channel !== channel) return false
      if (event !== 'all' && n.event !== event) return false
      if (!q) return true
      const recipient = n.recipientClientId ? clientById.get(n.recipientClientId) : undefined
      return [n.subject, n.body, n.recipientAddress, n.event, n.relatedId ?? '', recipient ? clientName(recipient) : '']
        .join(' ').toLowerCase().includes(q)
    })
  }, [db.notifications, clientById, query, channel, event])

  const kpis = useMemo(
    () => ({
      total: db.notifications.length,
      sms: db.notifications.filter((n) => n.channel === 'sms').length,
      email: db.notifications.filter((n) => n.channel === 'email').length,
      inApp: db.notifications.filter((n) => n.channel === 'in-app').length,
      unread: db.notifications.filter((n) => !n.read).length,
      newFeedback: db.feedback.filter((f) => f.status === 'new').length,
    }),
    [db.notifications, db.feedback],
  )

  const columns: Column<AppNotification>[] = [
    {
      key: 'channel',
      header: 'Channel',
      sortValue: (n) => n.channel,
      render: (n) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CHANNEL_TONE[n.channel]}`}>
            {CHANNEL_LABELS[n.channel]}
          </span>
          {n.simulated && <SimChip />}
        </span>
      ),
    },
    {
      key: 'subject',
      header: 'Message',
      sortValue: (n) => n.subject,
      render: (n) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-900">{n.subject}</p>
          <p className="truncate text-xs text-ink-500">{n.body.split('\n')[0]}</p>
        </div>
      ),
    },
    {
      key: 'recipient',
      header: 'Recipient',
      render: (n) => {
        const c = n.recipientClientId ? clientById.get(n.recipientClientId) : undefined
        return (
          <span className="text-sm">
            {c ? clientName(c) : '—'}
            <span className="block truncate text-xs text-ink-500">{n.recipientAddress}</span>
          </span>
        )
      },
    },
    {
      key: 'event',
      header: 'Event',
      sortValue: (n) => n.event,
      render: (n) => <code className="font-mono text-xs text-ink-700">{n.event}</code>,
      hideOnMobile: true,
    },
    {
      key: 'related',
      header: 'Record',
      render: (n) => (n.relatedId ? <span className="font-mono text-xs text-ink-600">{n.relatedId}</span> : <span className="text-xs text-ink-400">—</span>),
      hideOnMobile: true,
    },
    {
      key: 'sent',
      header: 'Sent',
      sortValue: (n) => n.sentOn,
      render: (n) => <span className="whitespace-nowrap text-sm">{formatDateTime(n.sentOn)}</span>,
    },
    {
      key: 'read',
      header: 'Read',
      render: (n) => (n.read ? <StatusBadge status="read" tone="muted" label="Read" /> : <StatusBadge status="unread" tone="progress" label="Unread" />),
    },
  ]

  return (
    <div className="pb-6">
      <PageHeader
        screen="S13"
        title="Notifications & communication"
        description="Every message the system has issued — status updates, laboratory results, lease reminders and case updates — across SMS, email and in-app, with the templates behind them."
        refs={['xiii.1', 'xiii.2', 'xiii.3', 'xiii.4']}
        actions={
          kpis.unread > 0 && can(role, 'notifications.manage') ? (
            <button
              type="button"
              className="ais-btn-secondary"
              onClick={() => {
                dispatch({ type: 'notification/readAll' })
                toast({ tone: 'success', title: 'All marked as read' })
              }}
            >
              Mark all as read
            </button>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Messages issued" value={kpis.total} hint="All channels" onClick={() => setChannel('all')} active={channel === 'all'} />
        <KpiCard label="SMS" value={kpis.sms} hint="Low-connectivity reach" refs={['xiii.4']} screen="S13" tone="good" onClick={() => setChannel('sms')} active={channel === 'sms'} />
        <KpiCard label="Email" value={kpis.email} hint="Full detail and reports" refs={['xiii.3']} screen="S13" onClick={() => setChannel('email')} active={channel === 'email'} />
        <KpiCard label="In-app" value={kpis.inApp} hint="Delivered to the portal" onClick={() => setChannel('in-app')} active={channel === 'in-app'} />
        <KpiCard label="New feedback" value={kpis.newFeedback} hint="Awaiting a reply" refs={['xiii.5']} screen="S13" tone={kpis.newFeedback ? 'warn' : 'good'} onClick={() => setTab('feedback')} />
      </div>

      <Tabs
        tabs={[
          { id: 'sent', label: 'Messages issued', count: db.notifications.length },
          { id: 'templates', label: 'Templates', count: db.notificationTemplates.length },
          { id: 'feedback', label: 'Feedback & messages', count: db.feedback.length },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-3"
      />

      {tab === 'sent' && (
        <>
          <div className="mb-3 rounded-lg border border-ink-200 bg-white p-3">
            <p className="inline-flex flex-wrap items-center gap-2 text-sm text-ink-700">
              <SimChip />
              <span>
                SMS and email delivery is simulated — nothing leaves the browser. In-app messages are
                genuinely delivered and appear in the recipient's portal. Every row says which it is.
              </span>
            </p>
          </div>

          <DataTable
            rows={filtered}
            columns={columns}
            rowKey={(n) => n.id}
            onRowClick={(n) => setPreview(n)}
            unit="messages"
            pageSize={12}
            initialSort={{ key: 'sent', direction: 'desc' }}
            caption="Messages issued"
            emptyTitle="No messages match this filter"
            toolbar={
              <div className="ais-card p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[220px] flex-1">
                    <label htmlFor="notif-search" className="ais-label">Search</label>
                    <input
                      id="notif-search"
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Subject, body, recipient or record…"
                      className="ais-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="notif-channel" className="ais-label">Channel</label>
                    <select id="notif-channel" value={channel} onChange={(e) => setChannel(e.target.value)} className="ais-input">
                      <option value="all">All channels</option>
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                      <option value="in-app">In-app</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="notif-event" className="ais-label">Event</label>
                    <select id="notif-event" value={event} onChange={(e) => setEvent(e.target.value)} className="ais-input">
                      <option value="all">All events</option>
                      {events.map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            }
          />
        </>
      )}

      {tab === 'templates' && <TemplatesTab />}
      {tab === 'feedback' && <FeedbackTab />}

      {/* ------------------------------------------------ message preview */}
      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.subject ?? ''}
        size="md"
        description={
          preview ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CHANNEL_TONE[preview.channel]}`}>
                {CHANNEL_LABELS[preview.channel]}
              </span>
              to {preview.recipientAddress} · {formatDateTime(preview.sentOn)}
              {preview.simulated && <SimChip />}
            </span>
          ) : undefined
        }
        footer={
          <>
            {preview && !preview.read && (
              <button
                type="button"
                className="ais-btn-secondary"
                onClick={() => {
                  dispatch({ type: 'notification/read', id: preview.id })
                  setPreview(null)
                }}
              >
                Mark as read
              </button>
            )}
            <button type="button" className="ais-btn-primary" onClick={() => setPreview(null)}>Close</button>
          </>
        }
      >
        {preview && (
          <div className="space-y-3">
            <p className="whitespace-pre-line rounded-lg border border-ink-200 bg-ink-50 p-3 text-sm text-ink-800">
              {preview.body}
            </p>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs">
              <div>
                <dt className="text-ink-500">Event</dt>
                <dd className="font-mono text-ink-800">{preview.event}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Template</dt>
                <dd className="font-mono text-ink-800">{preview.templateId}</dd>
              </div>
              {preview.relatedId && (
                <div className="col-span-2">
                  <dt className="text-ink-500">Related record</dt>
                  <dd className="font-mono text-ink-800">
                    {preview.relatedType} · {preview.relatedId}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Templates (xiii.1)
 * ------------------------------------------------------------------ */

function TemplatesTab() {
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()
  const [editing, setEditing] = useState<NotificationTemplate | null>(null)

  const canEdit = can(role, 'notifications.manage')

  const save = (template: NotificationTemplate, subject: string, body: string) => {
    if (!user) return
    dispatch({
      type: 'template/update',
      id: template.id,
      patch: { subject, body },
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'notification.template.updated', entityType: 'notification_template', entityId: template.id,
        detail: `Template "${template.name}" wording updated`,
      },
    })
    setEditing(null)
    toast({
      tone: 'success',
      title: 'Template updated',
      body: 'The next message on this event uses the new wording.',
    })
  }

  return (
    <div>
      <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
        <p className="inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-brand-900">
          Message wording is configuration, not code
          <ReqBadge refs="xiii.1" screen="S13" />
        </p>
        <p className="mt-1 text-sm text-brand-800">
          Each template belongs to an event and a channel. When S04, S05, S06, S08 or S10 raise that
          event, these are the words that go out — edit one and the next message changes, with no
          redeployment. <code className="rounded bg-white px-1 font-mono text-xs">{'{{tokens}}'}</code>{' '}
          are filled from the record that triggered it.
        </p>
      </div>

      <ul className="grid gap-3 lg:grid-cols-2">
        {db.notificationTemplates.map((t) => (
          <li key={t.id} className="ais-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900">{t.name}</p>
                <p className="font-mono text-xs text-ink-500">{t.id}</p>
              </div>
              <span className="flex items-center gap-1.5">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CHANNEL_TONE[t.channel]}`}>
                  {CHANNEL_LABELS[t.channel]}
                </span>
                {t.channel !== 'in-app' && <SimChip />}
              </span>
            </div>

            <p className="mt-2 text-xs text-ink-500">
              Fires on <code className="font-mono text-ink-700">{t.event}</code>
            </p>

            <div className="mt-3 rounded-lg border border-ink-200 bg-ink-50 p-3">
              <p className="text-xs font-semibold text-ink-700">{renderTemplate(t.subject, PREVIEW_VARS)}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink-700">
                {renderTemplate(t.body, PREVIEW_VARS)}
              </p>
              <p className="mt-2 border-t border-ink-200 pt-2 text-[11px] text-ink-500">
                Previewed with sample values.
              </p>
            </div>

            {canEdit && (
              <button type="button" className="ais-btn-secondary mt-3 px-3 py-1.5 text-xs" onClick={() => setEditing(t)}>
                Edit wording
              </button>
            )}
          </li>
        ))}
      </ul>

      <TemplateEditor template={editing} onClose={() => setEditing(null)} onSave={save} />
    </div>
  )
}

function TemplateEditor({
  template, onClose, onSave,
}: {
  template: NotificationTemplate | null
  onClose: () => void
  onSave: (t: NotificationTemplate, subject: string, body: string) => void
}) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  if (template && loadedFor !== template.id) {
    setSubject(template.subject)
    setBody(template.body)
    setLoadedFor(template.id)
  }

  if (!template) return null

  const tokens = [...new Set([...template.subject.matchAll(/\{\{(\w+)\}\}/g), ...template.body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))]

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${template.name}`}
      size="md"
      description={`Fires on ${template.event} · ${CHANNEL_LABELS[template.channel]}`}
      footer={
        <>
          <button type="button" className="ais-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="ais-btn-primary" onClick={() => onSave(template, subject, body)}>
            Save wording
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <TextAreaField
          label="Message body"
          rows={template.channel === 'sms' ? 3 : 8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          hint={template.channel === 'sms' ? `${body.length} characters — keep an SMS under 160 where possible.` : undefined}
        />
        <div>
          <p className="ais-label mb-1.5">Available tokens</p>
          <div className="flex flex-wrap gap-1.5">
            {tokens.map((t) => (
              <code key={t} className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[11px] text-ink-700">
                {`{{${t}}}`}
              </code>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-500">
            Tokens are replaced from the record that raised the event. An unknown token is left
            visible rather than silently blanked.
          </p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
          <p className="text-xs font-semibold text-ink-600">Preview with sample values</p>
          <p className="mt-1 text-xs font-semibold text-ink-800">{renderTemplate(subject, PREVIEW_VARS)}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{renderTemplate(body, PREVIEW_VARS)}</p>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ *
 * Feedback and messaging (xiii.5)
 * ------------------------------------------------------------------ */

function FeedbackTab() {
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()

  const [composeOpen, setComposeOpen] = useState(false)
  const [replyTo, setReplyTo] = useState<FeedbackMessage | null>(null)
  const [reply, setReply] = useState('')

  const isFarmer = role === 'farmer'
  const canRespond = can(role, 'notifications.manage')

  /** A farmer sees only their own thread. */
  const visible = useMemo(
    () => (isFarmer ? db.feedback.filter((f) => f.fromClientId === user?.clientId) : db.feedback),
    [db.feedback, isFarmer, user?.clientId],
  )

  const sendReply = () => {
    if (!user || !replyTo || reply.trim().length < 3) return
    dispatch({
      type: 'feedback/update',
      id: replyTo.id,
      patch: { status: 'resolved', response: reply.trim(), respondedOn: new Date().toISOString() },
    })
    dispatch({
      type: 'audit/append',
      draft: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'feedback.responded', entityType: 'feedback', entityId: replyTo.id,
        detail: `Response sent to ${replyTo.fromName}`,
      },
    })
    setReplyTo(null)
    setReply('')
    toast({ tone: 'success', title: 'Response sent', body: 'The message is in the sender’s portal.' })
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm text-ink-600">
          Two-way messaging between farmers and the department
          <ReqBadge refs="xiii.5" screen="S13" />
        </p>
        <button type="button" className="ais-btn-primary" onClick={() => setComposeOpen(true)}>
          Send a message
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="ais-card">
          <EmptyState title="No messages yet" body="Feedback and questions from farmers appear here." />
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((f) => (
            <li key={f.id} className="ais-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">{f.subject}</p>
                  <p className="text-xs text-ink-500">
                    {f.fromName}
                    {f.fromClientId && (
                      <>
                        {' · '}
                        <Link to={`/clients/${f.fromClientId}`} className="font-mono text-brand-700 hover:underline">
                          {f.fromClientId}
                        </Link>
                      </>
                    )}
                    {' · '}
                    {formatDateTime(f.sentOn)}
                  </p>
                </div>
                <span className="flex items-center gap-1.5">
                  <StatusBadge status={f.category} tone="neutral" label={statusLabel(f.category)} />
                  <StatusBadge status={f.status === 'new' ? 'reported' : f.status} label={statusLabel(f.status)} />
                </span>
              </div>

              <p className="mt-2 text-sm text-ink-700">{f.body}</p>

              {f.response ? (
                <div className="mt-3 rounded-lg border-l-4 border-brand-500 bg-brand-50 p-3">
                  <p className="text-xs font-semibold text-brand-800">
                    Department response · {f.respondedOn ? formatDateTime(f.respondedOn) : ''}
                  </p>
                  <p className="mt-1 text-sm text-brand-900">{f.response}</p>
                </div>
              ) : (
                canRespond && (
                  <button
                    type="button"
                    className="ais-btn-secondary mt-3 px-3 py-1.5 text-xs"
                    onClick={() => {
                      setReplyTo(f)
                      setReply('')
                    }}
                  >
                    Respond
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} />

      <Modal
        open={replyTo !== null}
        onClose={() => setReplyTo(null)}
        title="Respond to the sender"
        size="md"
        description={replyTo ? `Re: ${replyTo.subject} — ${replyTo.fromName}` : undefined}
        footer={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => setReplyTo(null)}>Cancel</button>
            <button type="button" className="ais-btn-primary" onClick={sendReply} disabled={reply.trim().length < 3}>
              Send response
            </button>
          </>
        }
      >
        {replyTo && (
          <div className="space-y-3">
            <p className="rounded-lg border border-ink-200 bg-ink-50 p-3 text-sm text-ink-700">{replyTo.body}</p>
            <TextAreaField
              label="Your response"
              rows={4}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Answer the question, or say what will happen next and when."
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

function ComposeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<FeedbackMessage['category']>('question')

  const client = db.clients.find((c) => c.id === user?.clientId)
  const valid = subject.trim().length > 3 && body.trim().length > 10

  const send = () => {
    if (!user || !valid) return
    const message: FeedbackMessage = {
      id: localId('FB'),
      fromClientId: client?.id,
      fromUserId: user.id,
      fromName: client ? clientName(client) : user.fullName,
      subject: subject.trim(),
      body: body.trim(),
      category,
      sentOn: new Date().toISOString(),
      status: 'new',
    }
    dispatch({
      type: 'feedback/add',
      message,
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'feedback.submitted', entityType: 'feedback', entityId: message.id,
        detail: `${statusLabel(category)} submitted — "${message.subject}"`,
      },
    })
    setSubject('')
    setBody('')
    onClose()
    toast({ tone: 'success', title: 'Message sent', body: 'The district office will respond in the portal.' })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send a message to the department"
      size="md"
      description={role === 'farmer' ? 'Questions, complaints and suggestions reach your district office.' : 'Recorded against your account.'}
      footer={
        <>
          <button type="button" className="ais-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="ais-btn-primary" onClick={send} disabled={!valid}>Send message</button>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value as FeedbackMessage['category'])}>
          <option value="question">Question</option>
          <option value="complaint">Complaint</option>
          <option value="suggestion">Suggestion</option>
          <option value="support">Support request</option>
        </SelectField>
        <TextField label="Subject" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Where can I obtain agricultural lime?" />
        <TextAreaField
          label="Message"
          required
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Give enough detail for the office to answer without calling you back."
        />
      </div>
    </Modal>
  )
}
