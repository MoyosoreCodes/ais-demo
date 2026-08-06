import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useAuth } from '../../app/AuthContext'
import { useDb } from '../../app/DataContext'
import { KpiCard } from '../../components/KpiCard'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { StatusBadge } from '../../components/StatusBadge'
import { Tabs } from '../../components/Tabs'
import { ReportBuilder } from './ReportBuilder'
import { clientName, formatDate, formatScr } from '../../lib/format'
import { can } from '../../lib/rbac'
import { totalHectares } from '../../lib/reports'
import { statusLabel } from '../../lib/workflow'
import { DISTRICTS, ROLE_LABELS } from '../../lib/types'

const CHART_COLOURS = ['#0F6B4F', '#1B7D62', '#3F9A80', '#6FB8A2', '#A2D2C2', '#C77700', '#C62828']

/** A record the user drilled into from a chart. */
interface DrillRow {
  id: string
  primary: string
  secondary: string
  status?: string
  href: string
}

interface Drill {
  title: string
  description: string
  rows: DrillRow[]
}

/**
 * S12 — dashboard and reporting (xii.1–xii.7).
 *
 * Role-based: each panel is gated on the same permission that gates the
 * underlying screen, so a laboratory user sees laboratory statistics and not the
 * loan book. Charts are drill-down surfaces, not decoration — selecting a
 * segment lists the records behind it with links into the registries.
 */
export function Dashboard() {
  const db = useDb()
  const { user, role } = useAuth()
  const [tab, setTab] = useState('overview')
  const [drill, setDrill] = useState<Drill | null>(null)

  const clientById = useMemo(() => new Map(db.clients.map((c) => [c.id, c])), [db.clients])
  const farmById = useMemo(() => new Map(db.farms.map((f) => [f.id, f])), [db.farms])

  /* ------------------------------------------------------------ KPIs */
  const kpis = useMemo(() => {
    const activeClients = db.clients.filter((c) => c.status === 'active')
    const registeredFarms = db.farms.filter((f) => f.status === 'registered')
    const openLoans = db.loans.filter((l) => ['submitted', 'under-review'].includes(l.status))
    const approvedLoans = db.loans.filter((l) => ['approved', 'disbursed', 'repaying', 'closed'].includes(l.status))
    const openSamples = db.samples.filter((s) => !['completed', 'cancelled'].includes(s.status))
    const openCases = db.surveillanceCases.filter((c) => !['confirmed', 'negative', 'closed'].includes(c.status))
    const openVisits = db.livestockVisits.filter((v) => !['resolved', 'closed'].includes(v.status))
    return {
      farmers: activeClients.length,
      farms: registeredFarms.length,
      hectares: totalHectares(db),
      loanValue: approvedLoans.reduce((s, l) => s + l.amountScr, 0),
      openLoans: openLoans.length,
      samples: db.samples.length,
      openSamples: openSamples.length,
      visits: db.livestockVisits.length,
      openVisits: openVisits.length,
      cases: db.surveillanceCases.length,
      openCases: openCases.length,
      vendors: db.vendors.filter((v) => v.registrationStatus === 'active').length,
      inspections: db.inspections.length,
      dueInspections: db.inspections.filter((i) => i.status === 'scheduled').length,
      activeLeases: db.leases.filter((l) => l.status === 'active').length,
      documents: db.documents.length,
    }
  }, [db])

  /* ------------------------------------------------------ chart data */
  const byDistrict = useMemo(
    () =>
      DISTRICTS.map((d) => ({
        district: d.replace('Baie Ste Anne Praslin', 'Baie Ste Anne').replace('Grand Anse Mahé', 'Grand Anse'),
        full: d,
        farmers: db.clients.filter((c) => c.district === d && c.status === 'active').length,
        farms: db.farms.filter((f) => f.district === d && f.status === 'registered').length,
      })),
    [db.clients, db.farms],
  )

  const loansByStatus = useMemo(() => {
    const order = ['submitted', 'under-review', 'approved', 'rejected', 'disbursed', 'repaying', 'closed']
    return order
      .map((s) => ({
        key: s,
        status: statusLabel(s),
        count: db.loans.filter((l) => l.status === s).length,
        value: db.loans.filter((l) => l.status === s).reduce((a, l) => a + l.amountScr, 0),
      }))
      .filter((r) => r.count > 0)
  }, [db.loans])

  const samplesByType = useMemo(
    () =>
      (['soil', 'water', 'plant', 'compost'] as const).map((t) => ({
        key: t,
        type: statusLabel(t),
        completed: db.samples.filter((s) => s.type === t && s.status === 'completed').length,
        inProgress: db.samples.filter((s) => s.type === t && !['completed', 'cancelled'].includes(s.status)).length,
      })),
    [db.samples],
  )

  const casesByDisease = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of db.surveillanceCases) map.set(c.suspectedDisease, (map.get(c.suspectedDisease) ?? 0) + 1)
    return [...map.entries()].map(([disease, count]) => ({ disease, count })).sort((a, b) => b.count - a.count)
  }, [db.surveillanceCases])

  const registrationsByMonth = useMemo(() => {
    const map = new Map<string, { month: string; clients: number; farms: number }>()
    const bump = (date: string, key: 'clients' | 'farms') => {
      const m = date.slice(0, 7)
      const row = map.get(m) ?? { month: m, clients: 0, farms: 0 }
      row[key] += 1
      map.set(m, row)
    }
    for (const c of db.clients) bump(c.registeredOn, 'clients')
    for (const f of db.farms) bump(f.registeredOn, 'farms')
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-14)
  }, [db.clients, db.farms])

  /* -------------------------------------------------- drill handlers */
  const drillClients = (district: string) =>
    setDrill({
      title: `Farmers in ${district}`,
      description: 'Active client records registered in this district.',
      rows: db.clients
        .filter((c) => c.district === district && c.status === 'active')
        .map((c) => ({
          id: c.id,
          primary: clientName(c),
          secondary: `${c.id} · ${c.nin} · registered ${formatDate(c.registeredOn)}`,
          status: c.registeredVia,
          href: `/clients/${c.id}`,
        })),
    })

  const drillLoans = (statusKey: string) =>
    setDrill({
      title: `Loan applications — ${statusLabel(statusKey)}`,
      description: 'Every application currently at this status.',
      rows: db.loans
        .filter((l) => l.status === statusKey)
        .map((l) => ({
          id: l.id,
          primary: l.purpose,
          secondary: `${l.id} · ${clientName(clientById.get(l.clientId))} · ${formatScr(l.amountScr)}`,
          status: l.status,
          href: `/loans/${l.id}`,
        })),
    })

  const drillSamples = (typeKey: string) =>
    setDrill({
      title: `${statusLabel(typeKey)} samples`,
      description: 'All analyses of this sample type.',
      rows: db.samples
        .filter((s) => s.type === typeKey)
        .map((s) => ({
          id: s.id,
          primary: `${statusLabel(s.type)} — ${s.purpose}`,
          secondary: `${s.id} · ${farmById.get(s.farmId)?.name ?? s.farmId} · requested ${formatDate(s.requestedOn)}`,
          status: s.status,
          href: `/lab/${s.id}`,
        })),
    })

  const drillCases = (disease: string) =>
    setDrill({
      title: `Surveillance — ${disease}`,
      description: 'Cases recorded against this suspected condition.',
      rows: db.surveillanceCases
        .filter((c) => c.suspectedDisease === disease)
        .map((c) => ({
          id: c.id,
          primary: `${c.species} · ${c.affectedCount} affected`,
          secondary: `${c.id} · ${farmById.get(c.farmId)?.name ?? c.farmId} · reported ${formatDate(c.reportedOn)}`,
          status: c.status,
          href: `/surveillance/${c.id}`,
        })),
    })

  /* --------------------------------------------------------- render */
  const show = {
    clients: can(role, 'clients.view'),
    farms: can(role, 'farms.view'),
    loans: can(role, 'loans.view'),
    lab: can(role, 'lab.view'),
    livestock: can(role, 'livestock.view'),
    surveillance: can(role, 'surveillance.view'),
    vendors: can(role, 'vendors.view'),
    fieldops: can(role, 'fieldops.view'),
    land: can(role, 'land.view'),
  }

  return (
    <div className="pb-6">
      <PageHeader
        screen="S12"
        title="National dashboard"
        description={`Operational picture for ${user?.fullName ?? 'this account'} — panels follow the same permissions as the underlying registries, so you see the statistics your role is entitled to.`}
        refs={['xii.1', 'xii.2', 'xii.3', 'xii.4']}
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status="role" tone="progress" label={role ? ROLE_LABELS[role] : 'Unknown role'} />
          <span className="text-xs text-ink-500">
            Live from the demonstration data — every figure recalculates as records change.
          </span>
        </div>
      </PageHeader>

      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'reports', label: 'Report builder' },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-4"
      />

      {tab === 'overview' && (
        <>
          {/* ------------------------------------------------------ KPIs */}
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {show.clients && (
              <KpiCard label="Registered farmers" value={kpis.farmers} hint="Active client records" refs={['xii.2']} screen="S12" />
            )}
            {show.farms && (
              <KpiCard label="Registered farms" value={kpis.farms} hint={`${kpis.hectares} under registration`} refs={['xii.2']} screen="S12" tone="good" />
            )}
            {show.loans && (
              <KpiCard label="Approved loan value" value={formatScr(kpis.loanValue)} hint={`${kpis.openLoans} applications open`} refs={['xii.3']} screen="S12" />
            )}
            {show.livestock && (
              <KpiCard label="Livestock visits" value={kpis.visits} hint={`${kpis.openVisits} open`} refs={['xii.3']} screen="S12" />
            )}
            {show.lab && (
              <KpiCard label="Laboratory samples" value={kpis.samples} hint={`${kpis.openSamples} in progress`} refs={['xii.4']} screen="S12" />
            )}
            {show.surveillance && (
              <KpiCard
                label="Surveillance cases"
                value={kpis.cases}
                hint={`${kpis.openCases} under investigation`}
                refs={['xii.4']}
                screen="S12"
                tone={kpis.openCases ? 'warn' : 'good'}
              />
            )}
            {show.fieldops && (
              <KpiCard label="Inspections" value={kpis.inspections} hint={`${kpis.dueInspections} scheduled`} screen="S12" />
            )}
            {show.land && (
              <KpiCard label="Active leases" value={kpis.activeLeases} hint={`${db.leases.length} on the register`} screen="S12" />
            )}
            {show.vendors && (
              <KpiCard label="Active vendors" value={kpis.vendors} hint="Licensed to trade" screen="S12" />
            )}
          </div>

          {/* ---------------------------------------------------- charts */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
            {(show.clients || show.farms) && (
              <ChartCard
                title="Farmers and farms by district"
                hint="Select a bar to list the farmers in that district."
                refs={['xii.2', 'xii.7']}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDistrict} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDEFEF" vertical={false} />
                    <XAxis dataKey="district" tick={{ fontSize: 10, fill: '#68716F' }} interval={0} angle={-22} textAnchor="end" height={62} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#68716F' }} width={30} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #DCE0E0' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="farmers" name="Farmers" fill="#0F6B4F" radius={[4, 4, 0, 0]} cursor="pointer"
                      onClick={(d: { full?: string }) => d.full && drillClients(d.full)} />
                    <Bar dataKey="farms" name="Farms" fill="#6FB8A2" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {show.loans && (
              <ChartCard
                title="Loan value by status"
                hint="Select a bar to list those applications."
                refs={['xii.3', 'xii.7']}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={loansByStatus} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDEFEF" vertical={false} />
                    <XAxis dataKey="status" tick={{ fontSize: 10, fill: '#68716F' }} interval={0} angle={-22} textAnchor="end" height={62} />
                    <YAxis tick={{ fontSize: 11, fill: '#68716F' }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={44} />
                    <Tooltip
                      formatter={(value: number) => [formatScr(value), 'Value']}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #DCE0E0' }}
                    />
                    <Bar dataKey="value" name="Value" radius={[4, 4, 0, 0]} cursor="pointer"
                      onClick={(d: { key?: string }) => d.key && drillLoans(d.key)}>
                      {loansByStatus.map((entry, i) => (
                        <Cell key={entry.key} fill={CHART_COLOURS[i % CHART_COLOURS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {show.lab && (
              <ChartCard
                title="Laboratory samples by type"
                hint="Select a bar to list the analyses of that type."
                refs={['xii.4', 'xii.7']}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={samplesByType} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDEFEF" vertical={false} />
                    <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#68716F' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#68716F' }} width={30} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #DCE0E0' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="completed" name="Completed" stackId="a" fill="#0F6B4F" cursor="pointer"
                      onClick={(d: { key?: string }) => d.key && drillSamples(d.key)} />
                    <Bar dataKey="inProgress" name="In progress" stackId="a" fill="#C77700" radius={[4, 4, 0, 0]} cursor="pointer"
                      onClick={(d: { key?: string }) => d.key && drillSamples(d.key)} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {show.surveillance && casesByDisease.length > 0 && (
              <ChartCard
                title="Surveillance cases by suspected disease"
                hint="Select a slice to list those cases."
                refs={['xii.4', 'xii.7']}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={casesByDisease}
                      dataKey="count"
                      nameKey="disease"
                      cx="50%"
                      cy="50%"
                      outerRadius={78}
                      innerRadius={42}
                      paddingAngle={2}
                      cursor="pointer"
                      onClick={(d: { disease?: string }) => d.disease && drillCases(d.disease)}
                    >
                      {casesByDisease.map((entry, i) => (
                        <Cell key={entry.disease} fill={CHART_COLOURS[i % CHART_COLOURS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #DCE0E0' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {(show.clients || show.farms) && (
              <ChartCard
                title="Registrations per month"
                hint="Clients and farms entering the registry."
                refs={['xii.7']}
                wide
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={registrationsByMonth} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDEFEF" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#68716F' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#68716F' }} width={30} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #DCE0E0' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="clients" name="Clients" stroke="#0F6B4F" strokeWidth={2} dot={{ r: 2.5 }} />
                    <Line type="monotone" dataKey="farms" name="Farms" stroke="#C77700" strokeWidth={2} dot={{ r: 2.5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* ------------------------------------------------ drill-down */}
          {drill && (
            <section className="ais-card mt-5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                    {drill.title}
                    <ReqBadge refs="xii.7" screen="S12" />
                    <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">
                      {drill.rows.length}
                    </span>
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-500">{drill.description}</p>
                </div>
                <button type="button" className="ais-btn-secondary px-3 py-1.5 text-xs" onClick={() => setDrill(null)}>
                  Close
                </button>
              </div>

              {drill.rows.length === 0 ? (
                <p className="mt-3 text-sm text-ink-500">No records behind this segment.</p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {drill.rows.slice(0, 40).map((r) => (
                    <li key={r.id}>
                      <Link
                        to={r.href}
                        className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink-900">{r.primary}</span>
                          <span className="block truncate font-mono text-xs text-ink-500">{r.secondary}</span>
                        </span>
                        {r.status && <StatusBadge status={r.status} />}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {drill.rows.length > 40 && (
                <p className="mt-2 text-xs text-ink-500">
                  Showing the first 40 of {drill.rows.length}. Use the report builder for the full set.
                </p>
              )}
            </section>
          )}
        </>
      )}

      {tab === 'reports' && <ReportBuilder />}
    </div>
  )
}

function ChartCard({
  title, hint, refs, children, wide = false,
}: {
  title: string
  hint: string
  refs: string[]
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <section className={`ais-card p-4 ${wide ? 'lg:col-span-2' : ''}`}>
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
        {title}
        <ReqBadge refs={refs} screen="S12" />
      </h2>
      <p className="mt-0.5 text-xs text-ink-500">{hint}</p>
      <div className="mt-3 h-64">{children}</div>
    </section>
  )
}
