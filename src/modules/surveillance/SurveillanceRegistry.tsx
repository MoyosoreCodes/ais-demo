import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { KpiCard } from '../../components/KpiCard'
import { MapView } from '../../components/MapPicker'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { StatusBadge } from '../../components/StatusBadge'
import { Tabs } from '../../components/Tabs'
import { exportTableExcel, exportTablePdf } from '../../lib/export'
import { clientName, formatDate } from '../../lib/format'
import { can } from '../../lib/rbac'
import { statusLabel } from '../../lib/workflow'
import type { SurveillanceCase } from '../../lib/types'

const OPEN_STATUSES = ['reported', 'assigned', 'investigating', 'sampled']

/**
 * S08 — passive surveillance registry (viii.2 ★, viii.3, viii.5).
 *
 * Passive surveillance depends on reports arriving and being closed out, so the
 * register leads with what is open and unassigned rather than with a total.
 */
export function SurveillanceRegistry() {
  const db = useDb()
  const { role } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [tab, setTab] = useState('register')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null)

  const clientById = useMemo(() => new Map(db.clients.map((c) => [c.id, c])), [db.clients])
  const farmById = useMemo(() => new Map(db.farms.map((f) => [f.id, f])), [db.farms])
  const userById = useMemo(() => new Map(db.users.map((u) => [u.id, u])), [db.users])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return db.surveillanceCases.filter((c) => {
      if (status === 'open' ? !OPEN_STATUSES.includes(c.status) : status !== 'all' && c.status !== status) {
        return false
      }
      if (!q) return true
      const owner = clientById.get(c.clientId)
      const farm = farmById.get(c.farmId)
      return [
        c.id, c.suspectedDisease, c.species, c.status, c.notes, c.reportedBy,
        farm?.name ?? '', farm?.district ?? '', owner ? `${owner.firstName} ${owner.lastName} ${owner.id}` : '',
      ].join(' ').toLowerCase().includes(q)
    })
  }, [db.surveillanceCases, clientById, farmById, status, query])

  const kpis = useMemo(() => {
    const open = db.surveillanceCases.filter((c) => OPEN_STATUSES.includes(c.status))
    return {
      total: db.surveillanceCases.length,
      open: open.length,
      unassigned: db.surveillanceCases.filter((c) => c.status === 'reported').length,
      confirmed: db.surveillanceCases.filter((c) => c.status === 'confirmed').length,
      affected: db.surveillanceCases.filter((c) => OPEN_STATUSES.includes(c.status)).reduce((s, c) => s + c.affectedCount, 0),
      mortality: db.surveillanceCases.reduce((s, c) => s + c.mortalityCount, 0),
    }
  }, [db.surveillanceCases])

  /** Diseases ranked by case count — the pattern a veterinary officer looks for. */
  const byDisease = useMemo(() => {
    const map = new Map<string, { disease: string; cases: number; affected: number; confirmed: number }>()
    for (const c of db.surveillanceCases) {
      const row = map.get(c.suspectedDisease) ?? { disease: c.suspectedDisease, cases: 0, affected: 0, confirmed: 0 }
      row.cases += 1
      row.affected += c.affectedCount
      if (c.status === 'confirmed') row.confirmed += 1
      map.set(c.suspectedDisease, row)
    }
    return [...map.values()].sort((a, b) => b.cases - a.cases)
  }, [db.surveillanceCases])

  const reportOptions = {
    title: 'Passive surveillance report',
    subtitle: 'Suspected animal disease cases and their investigation status',
    columns: [
      { header: 'Case', value: (c: SurveillanceCase) => c.id },
      { header: 'Suspected disease', value: (c: SurveillanceCase) => c.suspectedDisease },
      { header: 'Species', value: (c: SurveillanceCase) => c.species },
      { header: 'Farmer', value: (c: SurveillanceCase) => clientName(clientById.get(c.clientId)) },
      { header: 'Holding', value: (c: SurveillanceCase) => farmById.get(c.farmId)?.name ?? c.farmId },
      { header: 'District', value: (c: SurveillanceCase) => farmById.get(c.farmId)?.district ?? '—' },
      { header: 'Reported', value: (c: SurveillanceCase) => c.reportedOn },
      { header: 'Channel', value: (c: SurveillanceCase) => statusLabel(c.reportedVia) },
      { header: 'Assigned to', value: (c: SurveillanceCase) => (c.assignedOfficerUserId ? (userById.get(c.assignedOfficerUserId)?.fullName ?? c.assignedOfficerUserId) : 'Unassigned') },
      { header: 'Affected', value: (c: SurveillanceCase) => c.affectedCount, align: 'right' as const },
      { header: 'Mortality', value: (c: SurveillanceCase) => c.mortalityCount, align: 'right' as const },
      { header: 'Laboratory', value: (c: SurveillanceCase) => c.linkedSampleId ?? '—' },
      { header: 'Status', value: (c: SurveillanceCase) => statusLabel(c.status) },
    ],
    rows: filtered,
    meta: [
      { label: 'Cases in view', value: String(filtered.length) },
      { label: 'Open investigations', value: String(kpis.open) },
      { label: 'Confirmed', value: String(kpis.confirmed) },
    ],
    notes: [
      `${kpis.unassigned} reported case${kpis.unassigned === 1 ? '' : 's'} ${kpis.unassigned === 1 ? 'is' : 'are'} awaiting assignment to an officer.`,
      `Cumulative mortality across all recorded cases: ${kpis.mortality} animals.`,
    ],
    orientation: 'landscape' as const,
    fileStem: 'surveillance-report',
  }

  const runExport = async (kind: 'pdf' | 'excel') => {
    setBusy(kind)
    try {
      await (kind === 'pdf' ? exportTablePdf(reportOptions) : exportTableExcel(reportOptions))
      toast({ tone: 'success', title: `${kind === 'pdf' ? 'PDF' : 'Excel'} report generated`, body: `${filtered.length} cases exported.` })
    } finally {
      setBusy(null)
    }
  }

  const columns: Column<SurveillanceCase>[] = [
    {
      key: 'case',
      header: 'Case',
      sortValue: (c) => c.id,
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-900">{c.suspectedDisease}</p>
          <p className="font-mono text-xs text-ink-500">{c.id} · {c.species}</p>
        </div>
      ),
    },
    {
      key: 'holding',
      header: 'Holding',
      sortValue: (c) => farmById.get(c.farmId)?.name ?? '',
      render: (c) => {
        const farm = farmById.get(c.farmId)
        const owner = clientById.get(c.clientId)
        return (
          <span className="text-sm">
            {farm?.name ?? c.farmId}
            <span className="block text-xs text-ink-500">
              {clientName(owner)}{farm ? ` · ${farm.district}` : ''}
            </span>
          </span>
        )
      },
    },
    {
      key: 'impact',
      header: 'Impact',
      sortValue: (c) => c.affectedCount,
      render: (c) => (
        <span className="whitespace-nowrap text-sm tabular-nums">
          {c.affectedCount} affected
          <span className={`block text-xs ${c.mortalityCount > 0 ? 'text-danger-600' : 'text-ink-500'}`}>
            {c.mortalityCount} mortality
          </span>
        </span>
      ),
    },
    {
      key: 'reported',
      header: 'Reported',
      sortValue: (c) => c.reportedOn,
      render: (c) => (
        <span className="whitespace-nowrap text-sm">
          {formatDate(c.reportedOn)}
          <span className="block text-xs capitalize text-ink-500">{c.reportedVia.replace('-', ' ')}</span>
        </span>
      ),
    },
    {
      key: 'officer',
      header: 'Assigned',
      render: (c) =>
        c.assignedOfficerUserId ? (
          <span className="text-sm">{userById.get(c.assignedOfficerUserId)?.fullName ?? '—'}</span>
        ) : (
          <StatusBadge status="unassigned" tone="bad" label="Unassigned" />
        ),
      hideOnMobile: true,
    },
    {
      key: 'lab',
      header: 'Laboratory',
      render: (c) =>
        c.linkedSampleId ? (
          <Link
            to={`/lab/${c.linkedSampleId}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs text-brand-700 hover:underline"
          >
            {c.linkedSampleId}
          </Link>
        ) : (
          <span className="text-xs text-ink-400">Not linked</span>
        ),
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (c) => c.status,
      render: (c) => <StatusBadge status={c.status} />,
    },
  ]

  return (
    <div className="pb-6">
      <PageHeader
        screen="S08"
        title="Passive surveillance"
        description="Suspected animal disease cases reported by farmers, officers and the veterinary hotline, tracked from report to laboratory confirmation."
        refs={['viii.2', 'viii.3']}
        actions={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => void runExport('excel')} disabled={busy !== null || !filtered.length}>
              {busy === 'excel' ? 'Generating…' : 'Export Excel'}
            </button>
            <button type="button" className="ais-btn-secondary" onClick={() => void runExport('pdf')} disabled={busy !== null || !filtered.length}>
              {busy === 'pdf' ? 'Generating…' : 'Export PDF'}
              <ReqBadge refs="viii.5" screen="S08" />
            </button>
            {(can(role, 'surveillance.edit') || can(role, 'portal.self')) && (
              <Link to="/surveillance/report" className="ais-btn-primary">
                Report a suspected case
                <ReqBadge refs="viii.1" screen="S08" />
              </Link>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Cases on record" value={kpis.total} hint="Including historical" refs={['viii.2']} screen="S08" onClick={() => setStatus('all')} active={status === 'all'} />
        <KpiCard label="Open investigations" value={kpis.open} hint="Reported through to sampled" tone={kpis.open ? 'warn' : 'good'} onClick={() => setStatus('open')} active={status === 'open'} />
        <KpiCard label="Awaiting assignment" value={kpis.unassigned} hint="No officer allocated" tone={kpis.unassigned ? 'bad' : 'good'} onClick={() => setStatus('reported')} active={status === 'reported'} />
        <KpiCard label="Confirmed" value={kpis.confirmed} hint="Laboratory confirmed" tone={kpis.confirmed ? 'bad' : 'good'} onClick={() => setStatus('confirmed')} active={status === 'confirmed'} />
        <KpiCard label="Animals affected" value={kpis.affected} hint="Across open cases" />
      </div>

      <Tabs
        tabs={[
          { id: 'register', label: 'Case register', count: db.surveillanceCases.length },
          { id: 'map', label: 'Geographic spread' },
          { id: 'disease', label: 'By disease', count: byDisease.length },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-3"
      />

      {tab === 'register' && (
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(c) => c.id}
          onRowClick={(c) => navigate(`/surveillance/${c.id}`)}
          unit="cases"
          pageSize={12}
          initialSort={{ key: 'reported', direction: 'desc' }}
          caption="Surveillance case register"
          emptyTitle="No cases match this filter"
          toolbar={
            <div className="ais-card p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <label htmlFor="case-search" className="ais-label">Search</label>
                  <input
                    id="case-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Case, disease, species, holding or district…"
                    className="ais-input"
                  />
                </div>
                <div>
                  <label htmlFor="case-status" className="ais-label">Status</label>
                  <select id="case-status" value={status} onChange={(e) => setStatus(e.target.value)} className="ais-input">
                    <option value="all">All statuses</option>
                    <option value="open">Open investigations</option>
                    <option value="reported">Reported</option>
                    <option value="assigned">Assigned</option>
                    <option value="investigating">Investigating</option>
                    <option value="sampled">Sampled</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="negative">Negative</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
            </div>
          }
        />
      )}

      {tab === 'map' && (
        <div>
          <MapView
            markers={filtered
              .map((c) => {
                const farm = farmById.get(c.farmId)
                if (!farm) return null
                return {
                  id: c.id,
                  lat: farm.lat,
                  lng: farm.lng,
                  label: c.suspectedDisease,
                  detail: `${c.id} · ${farm.name} · ${c.affectedCount} affected · ${statusLabel(c.status)}`,
                  tone: c.status === 'confirmed' ? ('warning' as const) : OPEN_STATUSES.includes(c.status) ? ('primary' as const) : ('muted' as const),
                }
              })
              .filter((m): m is NonNullable<typeof m> => m !== null)}
            height={520}
            zoom={11}
          />
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-500">
            Cases plotted at the GPS location captured when the holding was registered. Amber
            confirmed, green under investigation, grey closed. Tiles © OpenStreetMap contributors.
            <ReqBadge refs="viii.4" screen="S08" />
          </p>
        </div>
      )}

      {tab === 'disease' && (
        <section className="ais-card overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <caption className="sr-only">Cases grouped by suspected disease</caption>
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-600">
                <th scope="col" className="px-3 py-2.5 font-semibold">Suspected disease</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Cases</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Animals affected</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {byDisease.map((d) => (
                <tr key={d.disease} className="border-b border-ink-100 last:border-0">
                  <th scope="row" className="px-3 py-2 text-left font-normal text-ink-900">{d.disease}</th>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-800">{d.cases}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-800">{d.affected}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {d.confirmed > 0 ? (
                      <span className="font-semibold text-danger-600">{d.confirmed}</span>
                    ) : (
                      <span className="text-ink-400">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
