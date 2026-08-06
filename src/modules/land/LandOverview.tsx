import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { KpiCard } from '../../components/KpiCard'
import { MapView } from '../../components/MapPicker'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StatusBadge } from '../../components/StatusBadge'
import { Tabs } from '../../components/Tabs'
import { exportTableExcel, exportTablePdf } from '../../lib/export'
import { DEMO_TODAY, clientName, formatDate, formatHa, formatScr } from '../../lib/format'
import { composeNotification, templatesFor } from '../../lib/notify'
import { can } from '../../lib/rbac'
import { currentStage, statusLabel } from '../../lib/workflow'
import type { EnforcementAction, LandApplication, Lease } from '../../lib/types'

/** Leases inside this window are treated as expiring soon (iv.6 ★). */
const EXPIRY_WINDOW_DAYS = 90

const daysUntil = (date: string): number =>
  differenceInCalendarDays(parseISO(date), DEMO_TODAY)

/**
 * S04 — land management (iv.1, iv.2, iv.5, iv.6 ★, iv.7).
 *
 * Applications, the lease register and enforcement share one screen because
 * they are one lifecycle: an allocation becomes a lease, and a lease that is
 * not honoured becomes an enforcement case.
 */
export function LandOverview() {
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [tab, setTab] = useState('applications')
  const [query, setQuery] = useState('')
  const [reminderKind, setReminderKind] = useState<'expiry' | 'payment' | null>(null)
  const [busy, setBusy] = useState(false)

  const clientById = useMemo(() => new Map(db.clients.map((c) => [c.id, c])), [db.clients])

  /* ---------------------------------------------------------- slices */
  const expiring = useMemo(
    () =>
      db.leases.filter(
        (l) => l.status === 'active' && daysUntil(l.endDate) <= EXPIRY_WINDOW_DAYS && daysUntil(l.endDate) >= 0,
      ),
    [db.leases],
  )
  const overdue = useMemo(() => db.leases.filter((l) => l.paymentStatus === 'overdue'), [db.leases])
  const openApplications = useMemo(
    () => db.landApplications.filter((a) => ['submitted', 'under-review'].includes(a.status)),
    [db.landApplications],
  )
  const openEnforcement = useMemo(
    () => db.enforcementActions.filter((e) => ['open', 'under-review'].includes(e.status)),
    [db.enforcementActions],
  )

  const match = (haystack: string[]) =>
    !query.trim() || haystack.join(' ').toLowerCase().includes(query.trim().toLowerCase())

  const applications = db.landApplications.filter((a) =>
    match([a.id, a.parcelRef, a.purpose, a.district, a.status, clientName(clientById.get(a.clientId))]),
  )
  const leases = db.leases.filter((l) =>
    match([l.id, l.parcelRef, l.district, l.status, l.paymentStatus, clientName(clientById.get(l.clientId))]),
  )
  const enforcement = db.enforcementActions.filter((e) =>
    match([e.id, e.leaseId, e.type, e.reason, e.status, clientName(clientById.get(e.clientId))]),
  )

  /* --------------------------------------------- reminders (iv.6 ★) */
  const reminderTargets = reminderKind === 'expiry' ? expiring : overdue

  const sendReminders = () => {
    if (!user || !reminderKind) return
    setBusy(true)
    const event = reminderKind === 'expiry' ? 'lease.expiring' : 'lease.payment.due'
    let sent = 0
    let skipped = 0

    for (const lease of reminderTargets) {
      const client = clientById.get(lease.clientId)
      if (!client) continue
      for (const template of templatesFor(db.notificationTemplates, event)) {
        if (template.channel === 'email' && !client.email) {
          skipped += 1
          continue
        }
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
    }

    dispatch({
      type: 'audit/append',
      draft: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: reminderKind === 'expiry' ? 'lease.reminder.expiry' : 'lease.reminder.payment',
        entityType: 'lease',
        entityId: `${reminderTargets.length} leases`,
        detail: `${sent} ${reminderKind} reminder${sent === 1 ? '' : 's'} issued across ${reminderTargets.length} leases (simulated delivery)`,
      },
    })

    setBusy(false)
    setReminderKind(null)
    toast({
      tone: 'success',
      title: `${sent} reminder${sent === 1 ? '' : 's'} issued`,
      body: skipped ? `${skipped} email channel(s) skipped — no address on file.` : undefined,
      simulated: true,
    })
  }

  /* --------------------------------------------------------- reports */
  const exportLeases = async (kind: 'pdf' | 'excel') => {
    const options = {
      title: 'Lease register report',
      subtitle: 'State agricultural land — lease status and payment position',
      columns: [
        { header: 'Lease', value: (l: Lease) => l.id },
        { header: 'Lessee', value: (l: Lease) => clientName(clientById.get(l.clientId)) },
        { header: 'Client ID', value: (l: Lease) => l.clientId },
        { header: 'Parcel', value: (l: Lease) => l.parcelRef },
        { header: 'District', value: (l: Lease) => l.district },
        { header: 'Area (ha)', value: (l: Lease) => l.areaHa, align: 'right' as const },
        { header: 'Start', value: (l: Lease) => l.startDate },
        { header: 'End', value: (l: Lease) => l.endDate },
        { header: 'Days to expiry', value: (l: Lease) => daysUntil(l.endDate), align: 'right' as const },
        { header: 'Annual rent (SCR)', value: (l: Lease) => l.annualRentScr, align: 'right' as const },
        { header: 'Status', value: (l: Lease) => statusLabel(l.status) },
        { header: 'Payment', value: (l: Lease) => statusLabel(l.paymentStatus) },
        { header: 'Next payment due', value: (l: Lease) => l.nextPaymentDue },
      ],
      rows: leases,
      meta: [
        { label: 'Leases in view', value: String(leases.length) },
        { label: 'Expiring within 90 days', value: String(expiring.length) },
        { label: 'Payments overdue', value: String(overdue.length) },
      ],
      notes: [
        `Annual rent under active leases in this view: ${formatScr(leases.filter((l) => l.status === 'active').reduce((s, l) => s + l.annualRentScr, 0))}.`,
      ],
      orientation: 'landscape' as const,
      fileStem: 'lease-register-report',
    }
    setBusy(true)
    try {
      await (kind === 'pdf' ? exportTablePdf(options) : exportTableExcel(options))
      toast({ tone: 'success', title: `${kind === 'pdf' ? 'PDF' : 'Excel'} report generated` })
    } finally {
      setBusy(false)
    }
  }

  /* ---------------------------------------------------------- tables */
  const applicationColumns: Column<LandApplication>[] = [
    {
      key: 'ref',
      header: 'Application',
      sortValue: (a) => a.id,
      render: (a) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-900">{a.purpose}</p>
          <p className="font-mono text-xs text-ink-500">{a.id} · {a.parcelRef}</p>
        </div>
      ),
    },
    {
      key: 'applicant',
      header: 'Applicant',
      sortValue: (a) => clientName(clientById.get(a.clientId)),
      render: (a) => {
        const c = clientById.get(a.clientId)
        return c ? (
          <Link to={`/clients/${c.id}`} onClick={(e) => e.stopPropagation()} className="text-sm text-brand-700 hover:underline">
            {clientName(c)}
            <span className="block font-mono text-xs text-ink-500">{c.id}</span>
          </Link>
        ) : <span className="text-xs text-ink-400">—</span>
      },
    },
    { key: 'district', header: 'District', sortValue: (a) => a.district, render: (a) => <span className="text-sm">{a.district}</span> },
    { key: 'area', header: 'Area', sortValue: (a) => a.requestedAreaHa, render: (a) => <span className="text-sm tabular-nums">{formatHa(a.requestedAreaHa)}</span> },
    {
      key: 'stage',
      header: 'Current stage',
      render: (a) => {
        const s = currentStage(a.stageInstances)
        return s ? (
          <span className="text-sm">
            {s.name}
            <span className="block text-xs text-ink-500">{s.status === 'in-progress' ? 'Awaiting decision' : statusLabel(s.status)}</span>
          </span>
        ) : <span className="text-xs text-ink-400">Complete</span>
      },
    },
    { key: 'submitted', header: 'Submitted', sortValue: (a) => a.submittedOn, render: (a) => <span className="whitespace-nowrap text-sm">{formatDate(a.submittedOn)}</span> },
    { key: 'status', header: 'Status', sortValue: (a) => a.status, render: (a) => <StatusBadge status={a.status} /> },
  ]

  const leaseColumns: Column<Lease>[] = [
    {
      key: 'ref',
      header: 'Lease',
      sortValue: (l) => l.id,
      render: (l) => (
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium text-ink-900">{l.id}</p>
          <p className="font-mono text-xs text-ink-500">{l.parcelRef}</p>
        </div>
      ),
    },
    {
      key: 'lessee',
      header: 'Lessee',
      sortValue: (l) => clientName(clientById.get(l.clientId)),
      render: (l) => {
        const c = clientById.get(l.clientId)
        return c ? (
          <Link to={`/clients/${c.id}`} onClick={(e) => e.stopPropagation()} className="text-sm text-brand-700 hover:underline">
            {clientName(c)}
            <span className="block font-mono text-xs text-ink-500">{c.id}</span>
          </Link>
        ) : <span className="text-xs text-ink-400">—</span>
      },
    },
    { key: 'district', header: 'District', sortValue: (l) => l.district, render: (l) => <span className="text-sm">{l.district}</span>, hideOnMobile: true },
    { key: 'area', header: 'Area', sortValue: (l) => l.areaHa, render: (l) => <span className="text-sm tabular-nums">{formatHa(l.areaHa)}</span> },
    {
      key: 'term',
      header: 'Term',
      sortValue: (l) => l.endDate,
      render: (l) => {
        const d = daysUntil(l.endDate)
        return (
          <span className="whitespace-nowrap text-sm">
            {formatDate(l.startDate)} – {formatDate(l.endDate)}
            <span className={`block text-xs ${d < 0 ? 'text-danger-600' : d <= EXPIRY_WINDOW_DAYS ? 'text-warn-600' : 'text-ink-500'}`}>
              {d < 0 ? `expired ${Math.abs(d)} days ago` : `${d} days remaining`}
            </span>
          </span>
        )
      },
    },
    { key: 'rent', header: 'Annual rent', sortValue: (l) => l.annualRentScr, render: (l) => <span className="whitespace-nowrap text-sm tabular-nums">{formatScr(l.annualRentScr)}</span> },
    {
      key: 'payment',
      header: 'Payment',
      sortValue: (l) => l.paymentStatus,
      render: (l) => (
        <span className="text-sm">
          <StatusBadge status={l.paymentStatus} />
          <span className="mt-0.5 block text-xs text-ink-500">due {formatDate(l.nextPaymentDue)}</span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', sortValue: (l) => l.status, render: (l) => <StatusBadge status={l.status} /> },
  ]

  const enforcementColumns: Column<EnforcementAction>[] = [
    {
      key: 'ref',
      header: 'Action',
      sortValue: (e) => e.id,
      render: (e) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium capitalize text-ink-900">{e.type.replace(/-/g, ' ')}</p>
          <p className="font-mono text-xs text-ink-500">{e.id} · lease {e.leaseId}</p>
        </div>
      ),
    },
    {
      key: 'lessee',
      header: 'Lessee',
      sortValue: (e) => clientName(clientById.get(e.clientId)),
      render: (e) => <span className="text-sm">{clientName(clientById.get(e.clientId))}</span>,
    },
    { key: 'reason', header: 'Reason', render: (e) => <span className="text-sm text-ink-700">{e.reason}</span> },
    { key: 'raised', header: 'Raised', sortValue: (e) => e.raisedOn, render: (e) => <span className="whitespace-nowrap text-sm">{formatDate(e.raisedOn)}</span> },
    { key: 'served', header: 'Notice served', render: (e) => <span className="whitespace-nowrap text-sm">{e.noticeServedOn ? formatDate(e.noticeServedOn) : '—'}</span>, hideOnMobile: true },
    { key: 'status', header: 'Status', sortValue: (e) => e.status, render: (e) => <StatusBadge status={e.status} /> },
  ]

  return (
    <div className="pb-6">
      <PageHeader
        screen="S04"
        title="Land management"
        description="State land allocation applications, the lease register with its payment position, and non-compliance enforcement — one lifecycle, one screen."
        refs={['iv.1', 'iv.5', 'iv.6']}
        actions={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => void exportLeases('excel')} disabled={busy}>
              Export Excel
            </button>
            <button type="button" className="ais-btn-secondary" onClick={() => void exportLeases('pdf')} disabled={busy}>
              Export PDF
              <ReqBadge refs="iv.6" screen="S04" />
            </button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Open applications" value={openApplications.length} hint="Submitted or under review" refs={['iv.1']} screen="S04" onClick={() => setTab('applications')} />
        <KpiCard label="Active leases" value={db.leases.filter((l) => l.status === 'active').length} hint={`${db.leases.length} on the register`} tone="good" onClick={() => setTab('leases')} />
        <KpiCard label="Expiring in 90 days" value={expiring.length} hint="Renewal action required" tone={expiring.length ? 'warn' : 'good'} refs={['iv.6']} screen="S04" onClick={() => setTab('leases')} />
        <KpiCard label="Payments overdue" value={overdue.length} hint="Rent unpaid past the due date" tone={overdue.length ? 'bad' : 'good'} onClick={() => setTab('leases')} />
        <KpiCard label="Open enforcement" value={openEnforcement.length} hint="Warnings, retractions, evictions" tone={openEnforcement.length ? 'warn' : 'good'} refs={['iv.7']} screen="S04" onClick={() => setTab('enforcement')} />
      </div>

      {/* ------------------------------------------------ reminder banner */}
      {(expiring.length > 0 || overdue.length > 0) && can(role, 'notifications.manage') && (
        <section className="mb-5 rounded-lg border border-warn-300 bg-warn-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <svg viewBox="0 0 20 20" className="h-5 w-5 text-warn-600" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="10" cy="10" r="7" />
              <path d="M10 6v4l3 2" strokeLinecap="round" />
            </svg>
            <h2 className="text-sm font-semibold text-warn-900">Lease reminders due</h2>
            <ReqBadge refs="iv.6" screen="S04" />
            <SimChip />
          </div>
          <p className="mt-1 text-sm text-warn-800">
            {expiring.length} lease{expiring.length === 1 ? '' : 's'} expire within {EXPIRY_WINDOW_DAYS} days
            and {overdue.length} rent payment{overdue.length === 1 ? ' is' : 's are'} overdue. Reminders go
            out by SMS and email and appear in the lessee's portal.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="ais-btn-secondary" onClick={() => setReminderKind('expiry')} disabled={!expiring.length}>
              Issue {expiring.length} expiry reminder{expiring.length === 1 ? '' : 's'}
            </button>
            <button type="button" className="ais-btn-secondary" onClick={() => setReminderKind('payment')} disabled={!overdue.length}>
              Issue {overdue.length} payment reminder{overdue.length === 1 ? '' : 's'}
            </button>
          </div>
        </section>
      )}

      <Tabs
        tabs={[
          { id: 'applications', label: 'Allocation applications', count: db.landApplications.length },
          { id: 'leases', label: 'Lease register', count: db.leases.length },
          { id: 'enforcement', label: 'Enforcement', count: db.enforcementActions.length },
          { id: 'map', label: 'Parcel map' },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-3"
      />

      {tab !== 'map' && (
        <div className="ais-card mb-3 p-3">
          <label htmlFor="land-search" className="ais-label">Search</label>
          <input
            id="land-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Reference, parcel, lessee, district or status…"
            className="ais-input"
          />
        </div>
      )}

      {tab === 'applications' && (
        <DataTable
          rows={applications}
          columns={applicationColumns}
          rowKey={(a) => a.id}
          onRowClick={(a) => navigate(`/land/applications/${a.id}`)}
          unit="applications"
          pageSize={10}
          initialSort={{ key: 'submitted', direction: 'desc' }}
          caption="Land allocation applications"
          emptyTitle="No applications match this search"
        />
      )}

      {tab === 'leases' && (
        <DataTable
          rows={leases}
          columns={leaseColumns}
          rowKey={(l) => l.id}
          onRowClick={(l) => navigate(`/land/leases/${l.id}`)}
          unit="leases"
          pageSize={10}
          initialSort={{ key: 'term', direction: 'asc' }}
          caption="Lease register"
          emptyTitle="No leases match this search"
        />
      )}

      {tab === 'enforcement' && (
        <DataTable
          rows={enforcement}
          columns={enforcementColumns}
          rowKey={(e) => e.id}
          onRowClick={(e) => navigate(`/land/leases/${e.leaseId}`)}
          unit="enforcement actions"
          pageSize={10}
          initialSort={{ key: 'raised', direction: 'desc' }}
          caption="Enforcement actions"
          emptyTitle="No enforcement actions recorded"
        />
      )}

      {tab === 'map' && (
        <div>
          <MapView
            markers={db.landApplications.map((a) => ({
              id: a.id,
              lat: a.lat,
              lng: a.lng,
              label: `${a.parcelRef} · ${formatHa(a.requestedAreaHa)}`,
              detail: `${a.id} · ${a.purpose} · ${statusLabel(a.status)}`,
              tone: a.status === 'approved' ? ('primary' as const) : a.status === 'rejected' ? ('muted' as const) : ('warning' as const),
            }))}
            height={520}
            zoom={11}
          />
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-500">
            {db.landApplications.length} allocation applications plotted. Green approved, amber under
            consideration, grey rejected. Tiles © OpenStreetMap contributors.
            <ReqBadge refs="iv.3" screen="S04" />
          </p>
        </div>
      )}

      {/* ------------------------------------------------- reminder modal */}
      <Modal
        open={reminderKind !== null}
        onClose={() => setReminderKind(null)}
        title={reminderKind === 'expiry' ? 'Issue lease-expiry reminders' : 'Issue lease-payment reminders'}
        size="md"
        tone="warning"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            One message per configured channel, per lessee. <SimChip />
          </span>
        }
        footer={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => setReminderKind(null)}>Cancel</button>
            <button type="button" className="ais-btn-primary" onClick={sendReminders} disabled={busy}>
              {busy ? 'Issuing…' : `Issue reminders for ${reminderTargets.length} lease${reminderTargets.length === 1 ? '' : 's'}`}
            </button>
          </>
        }
      >
        <ul className="space-y-2">
          {reminderTargets.slice(0, 10).map((l) => {
            const c = clientById.get(l.clientId)
            return (
              <li key={l.id} className="rounded-lg border border-ink-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink-900">{clientName(c)}</span>
                  <span className="font-mono text-xs text-ink-500">{l.id} · {l.parcelRef}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-600">
                  {reminderKind === 'expiry'
                    ? `Expires ${formatDate(l.endDate)} — ${daysUntil(l.endDate)} days remaining.`
                    : `Rent of ${formatScr(l.annualRentScr)} due ${formatDate(l.nextPaymentDue)}.`}
                  {c && ` Channels: SMS ${c.phone}${c.email ? `, email ${c.email}` : ' (no email on file)'}.`}
                </p>
              </li>
            )
          })}
          {reminderTargets.length > 10 && (
            <li className="text-sm text-ink-500">…and {reminderTargets.length - 10} more.</li>
          )}
        </ul>
      </Modal>
    </div>
  )
}
