import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { useAuth } from '../../app/AuthContext'
import { useDb } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { KpiCard } from '../../components/KpiCard'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { StatusBadge } from '../../components/StatusBadge'
import { exportTableExcel, exportTablePdf } from '../../lib/export'
import { clientName, formatDate, formatScr } from '../../lib/format'
import { can } from '../../lib/rbac'
import { currentStage, statusLabel } from '../../lib/workflow'
import type { Loan } from '../../lib/types'

const OPEN_STATUSES = ['submitted', 'under-review']
const STATUS_COLOURS: Record<string, string> = {
  submitted: '#8B9494',
  'under-review': '#3F9A80',
  approved: '#0F6B4F',
  rejected: '#C62828',
  disbursed: '#1B7D62',
  repaying: '#6FB8A2',
  closed: '#B9C0C0',
}

/**
 * S05 — loan pipeline, reports and monitoring dashboard (v.4, v.6, v.7 ★).
 *
 * The KPI tiles double as filters, so the dashboard and the working list are
 * the same view rather than two screens that can disagree.
 */
export function LoanPipeline() {
  const db = useDb()
  const { role } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [stage, setStage] = useState('all')
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null)

  const clientById = useMemo(() => new Map(db.clients.map((c) => [c.id, c])), [db.clients])
  const farmById = useMemo(() => new Map(db.farms.map((f) => [f.id, f])), [db.farms])
  const workflow = db.workflows.find((w) => w.id === 'loan-approval')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return db.loans.filter((l) => {
      if (status === 'open' ? !OPEN_STATUSES.includes(l.status) : status !== 'all' && l.status !== status) {
        return false
      }
      if (stage !== 'all' && currentStage(l.stageInstances)?.stageId !== stage) return false
      if (!q) return true
      const owner = clientById.get(l.clientId)
      const farm = farmById.get(l.farmId)
      return [l.id, l.purpose, l.status, farm?.name ?? '', owner ? `${owner.firstName} ${owner.lastName} ${owner.id} ${owner.nin}` : '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [db.loans, clientById, farmById, query, status, stage])

  /* ------------------------------------------------------ KPIs (v.7 ★) */
  const kpis = useMemo(() => {
    const open = db.loans.filter((l) => OPEN_STATUSES.includes(l.status))
    const approved = db.loans.filter((l) => ['approved', 'disbursed', 'repaying', 'closed'].includes(l.status))
    const rejected = db.loans.filter((l) => l.status === 'rejected')
    const outstanding = db.loans
      .filter((l) => l.status === 'repaying')
      .reduce((s, l) => s + (l.balanceScr ?? 0), 0)
    const decided = approved.length + rejected.length
    return {
      total: db.loans.length,
      open: open.length,
      openValue: open.reduce((s, l) => s + l.amountScr, 0),
      approvedValue: approved.reduce((s, l) => s + l.amountScr, 0),
      outstanding,
      approvalRate: decided ? Math.round((approved.length / decided) * 100) : 0,
    }
  }, [db.loans])

  const byStatus = useMemo(() => {
    const order = ['submitted', 'under-review', 'approved', 'rejected', 'disbursed', 'repaying', 'closed']
    return order
      .map((s) => {
        const rows = db.loans.filter((l) => l.status === s)
        return { status: s, label: statusLabel(s), count: rows.length, value: rows.reduce((a, l) => a + l.amountScr, 0) }
      })
      .filter((r) => r.count > 0)
  }, [db.loans])

  const byMonth = useMemo(() => {
    const buckets = new Map<string, { month: string; count: number; value: number }>()
    for (const l of db.loans) {
      const key = l.submittedOn.slice(0, 7)
      const b = buckets.get(key) ?? { month: key, count: 0, value: 0 }
      b.count += 1
      b.value += l.amountScr
      buckets.set(key, b)
    }
    return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12)
  }, [db.loans])

  /* ---------------------------------------------------- reports (v.6) */
  const reportColumns = [
    { header: 'Reference', value: (l: Loan) => l.id },
    { header: 'Farmer', value: (l: Loan) => clientName(clientById.get(l.clientId)) },
    { header: 'Client ID', value: (l: Loan) => l.clientId },
    { header: 'Holding', value: (l: Loan) => farmById.get(l.farmId)?.name ?? l.farmId },
    { header: 'District', value: (l: Loan) => farmById.get(l.farmId)?.district ?? '—' },
    { header: 'Purpose', value: (l: Loan) => l.purpose },
    { header: 'Amount (SCR)', value: (l: Loan) => l.amountScr, align: 'right' as const },
    { header: 'Term (months)', value: (l: Loan) => l.termMonths, align: 'right' as const },
    { header: 'Rate (%)', value: (l: Loan) => l.interestRatePct, align: 'right' as const },
    { header: 'Status', value: (l: Loan) => statusLabel(l.status) },
    { header: 'Current stage', value: (l: Loan) => currentStage(l.stageInstances)?.name ?? '—' },
    { header: 'Submitted', value: (l: Loan) => l.submittedOn },
  ]

  const reportOptions = {
    title: 'Loan monitoring report',
    subtitle: 'Agricultural credit scheme — application pipeline',
    columns: reportColumns,
    rows: filtered,
    meta: [
      { label: 'Applications in view', value: String(filtered.length) },
      { label: 'Status filter', value: status === 'all' ? 'All statuses' : statusLabel(status) },
      { label: 'Total value', value: formatScr(filtered.reduce((s, l) => s + l.amountScr, 0)) },
    ],
    notes: [
      `Approval rate across decided applications: ${kpis.approvalRate}%.`,
      `Outstanding balance on repaying loans: ${formatScr(kpis.outstanding)}.`,
    ],
    orientation: 'landscape' as const,
    fileStem: 'loan-monitoring-report',
  }

  const runExport = async (kind: 'pdf' | 'excel') => {
    setBusy(kind)
    try {
      await (kind === 'pdf' ? exportTablePdf(reportOptions) : exportTableExcel(reportOptions))
      toast({
        tone: 'success',
        title: `${kind === 'pdf' ? 'PDF' : 'Excel'} report generated`,
        body: `${filtered.length} applications exported.`,
      })
    } catch {
      toast({ tone: 'error', title: 'Export failed', body: 'The report could not be generated.' })
    } finally {
      setBusy(null)
    }
  }

  /* ------------------------------------------------------------ table */
  const columns: Column<Loan>[] = [
    {
      key: 'ref',
      header: 'Application',
      sortValue: (l) => l.id,
      render: (l) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-900">{l.purpose}</p>
          <p className="font-mono text-xs text-ink-500">{l.id}</p>
        </div>
      ),
    },
    {
      key: 'farmer',
      header: 'Farmer',
      sortValue: (l) => clientName(clientById.get(l.clientId)),
      render: (l) => {
        const owner = clientById.get(l.clientId)
        return owner ? (
          <Link
            to={`/clients/${owner.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-brand-700 hover:underline"
          >
            {clientName(owner)}
            <span className="block font-mono text-xs text-ink-500">{owner.id}</span>
          </Link>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        )
      },
    },
    {
      key: 'holding',
      header: 'Holding',
      sortValue: (l) => farmById.get(l.farmId)?.name ?? '',
      render: (l) => {
        const farm = farmById.get(l.farmId)
        return (
          <span className="text-sm">
            {farm?.name ?? l.farmId}
            <span className="block text-xs text-ink-500">{farm?.district ?? ''}</span>
          </span>
        )
      },
      hideOnMobile: true,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortValue: (l) => l.amountScr,
      render: (l) => (
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-ink-900">
          {formatScr(l.amountScr)}
          <span className="block text-xs font-normal text-ink-500">{l.termMonths} months</span>
        </span>
      ),
    },
    {
      key: 'stage',
      header: 'Current stage',
      render: (l) => {
        const s = currentStage(l.stageInstances)
        return s ? (
          <span className="text-sm">
            {s.name}
            <span className="block text-xs text-ink-500">{s.status === 'in-progress' ? 'Awaiting decision' : statusLabel(s.status)}</span>
          </span>
        ) : (
          <span className="text-xs text-ink-400">Complete</span>
        )
      },
    },
    {
      key: 'submitted',
      header: 'Submitted',
      sortValue: (l) => l.submittedOn,
      render: (l) => <span className="whitespace-nowrap text-sm">{formatDate(l.submittedOn)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (l) => l.status,
      render: (l) => <StatusBadge status={l.status} />,
    },
  ]

  return (
    <div className="pb-6">
      <PageHeader
        screen="S05"
        title="Loan management"
        description="The agricultural credit pipeline: applications, the configurable approval workflow, and live monitoring of value and approval rate."
        refs={['v.4', 'v.6', 'v.7']}
        actions={
          <>
            <button
              type="button"
              className="ais-btn-secondary"
              onClick={() => void runExport('excel')}
              disabled={busy !== null || filtered.length === 0}
            >
              {busy === 'excel' ? 'Generating…' : 'Export Excel'}
            </button>
            <button
              type="button"
              className="ais-btn-secondary"
              onClick={() => void runExport('pdf')}
              disabled={busy !== null || filtered.length === 0}
            >
              {busy === 'pdf' ? 'Generating…' : 'Export PDF'}
              <ReqBadge refs="v.6" screen="S05" />
            </button>
            {can(role, 'portal.self') && (
              <Link to="/loans/apply" className="ais-btn-primary">
                Apply for a loan
                <ReqBadge refs="v.1" screen="S05" />
              </Link>
            )}
          </>
        }
      />

      {/* ------------------------------------------------ mini-dashboard */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Applications"
          value={kpis.total}
          hint="All time"
          refs={['v.7']}
          screen="S05"
          onClick={() => setStatus('all')}
          active={status === 'all'}
        />
        <KpiCard
          label="Open"
          value={kpis.open}
          hint={formatScr(kpis.openValue)}
          tone="warn"
          onClick={() => setStatus('open')}
          active={status === 'open'}
        />
        <KpiCard label="Approved value" value={formatScr(kpis.approvedValue)} hint="Approved, disbursed or repaid" tone="good" />
        <KpiCard label="Outstanding" value={formatScr(kpis.outstanding)} hint="Balance on repaying loans" />
        <KpiCard label="Approval rate" value={`${kpis.approvalRate}%`} hint="Of decided applications" tone="good" />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <section className="ais-card p-4">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
            Value by status
            <ReqBadge refs="v.7" screen="S05" />
          </h2>
          <p className="mt-0.5 text-xs text-ink-500">Select a bar to filter the pipeline below.</p>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatus} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEFEF" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#68716F' }} interval={0} angle={-18} textAnchor="end" height={52} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#68716F' }}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  width={44}
                />
                <Tooltip
                  formatter={(value: number, name) => [name === 'value' ? formatScr(value) : value, name === 'value' ? 'Value' : 'Applications']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #DCE0E0' }}
                />
                <Bar dataKey="value" name="value" radius={[4, 4, 0, 0]} cursor="pointer">
                  {byStatus.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_COLOURS[entry.status] ?? '#0F6B4F'}
                      opacity={status === 'all' || status === entry.status ? 1 : 0.35}
                      onClick={() => setStatus(status === entry.status ? 'all' : entry.status)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="ais-card p-4">
          <h2 className="text-sm font-semibold text-ink-900">Applications submitted per month</h2>
          <p className="mt-0.5 text-xs text-ink-500">Last {byMonth.length} months with activity.</p>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byMonth} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEFEF" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#68716F' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#68716F' }} width={30} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #DCE0E0' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="count" name="Applications" stroke="#0F6B4F" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* -------------------------------------------------------- filters */}
      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(l) => l.id}
        onRowClick={(l) => navigate(`/loans/${l.id}`)}
        unit="applications"
        pageSize={12}
        initialSort={{ key: 'submitted', direction: 'desc' }}
        caption="Loan applications"
        emptyTitle="No applications match this filter"
        emptyBody="Clear the search box or select a different status."
        toolbar={
          <div className="ais-card p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label htmlFor="loan-search" className="ais-label">Search</label>
                <input
                  id="loan-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Reference, purpose, farmer, holding or NIN…"
                  className="ais-input"
                />
              </div>
              <div>
                <label htmlFor="loan-status" className="ais-label">Status</label>
                <select id="loan-status" value={status} onChange={(e) => setStatus(e.target.value)} className="ais-input">
                  <option value="all">All statuses</option>
                  <option value="open">Open (submitted or under review)</option>
                  <option value="submitted">Submitted</option>
                  <option value="under-review">Under review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="disbursed">Disbursed</option>
                  <option value="repaying">Repaying</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label htmlFor="loan-stage" className="ais-label">
                  <span className="inline-flex items-center gap-1.5">
                    Awaiting stage
                    <ReqBadge refs="v.3" screen="S05" />
                  </span>
                </label>
                <select id="loan-stage" value={stage} onChange={(e) => setStage(e.target.value)} className="ais-input">
                  <option value="all">Any stage</option>
                  {workflow?.stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        }
      />
    </div>
  )
}
