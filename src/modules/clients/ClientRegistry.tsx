import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb } from '../../app/DataContext'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { StatusBadge } from '../../components/StatusBadge'
import { SimChip } from '../../components/SimChip'
import { scanRegistryForDuplicates } from '../../lib/duplicates'
import { clientName, formatDate } from '../../lib/format'
import { can } from '../../lib/rbac'
import { DISTRICTS } from '../../lib/types'
import type { Client } from '../../lib/types'

/**
 * S02 — central client registry (ii.1, ii.6 and the entry point to ii.2–ii.7).
 *
 * One master registry, searched across every indexed field, with the
 * cross-module link counts visible on each row so ii.5 is legible at a glance.
 */
export function ClientRegistry() {
  const db = useDb()
  const { role } = useAuth()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [district, setDistrict] = useState('all')
  const [channel, setChannel] = useState('all')
  const [status, setStatus] = useState('active')
  const [seyIdOnly, setSeyIdOnly] = useState(false)

  /** Link counts per client — the visible evidence for ii.5. */
  const linkCounts = useMemo(() => {
    const counts = new Map<string, { farms: number; loans: number; lab: number; livestock: number }>()
    const bump = (id: string, key: 'farms' | 'loans' | 'lab' | 'livestock') => {
      const c = counts.get(id) ?? { farms: 0, loans: 0, lab: 0, livestock: 0 }
      c[key] += 1
      counts.set(id, c)
    }
    for (const f of db.farms) bump(f.clientId, 'farms')
    for (const l of db.loans) bump(l.clientId, 'loans')
    for (const s of db.samples) bump(s.clientId, 'lab')
    for (const v of db.livestockVisits) bump(v.clientId, 'livestock')
    return counts
  }, [db.farms, db.loans, db.samples, db.livestockVisits])

  const duplicates = useMemo(() => scanRegistryForDuplicates(db.clients), [db.clients])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return db.clients.filter((c) => {
      if (status !== 'all' && c.status !== status) return false
      if (district !== 'all' && c.district !== district) return false
      if (channel !== 'all' && c.registeredVia !== channel) return false
      if (seyIdOnly && !c.seyIdVerified) return false
      if (!q) return true
      // Full-text across every indexed field (ii.6).
      return [
        c.id, c.nin, c.firstName, c.lastName, `${c.firstName} ${c.lastName}`,
        c.phone, c.email, c.district, c.island, c.address, c.stakeholderType, c.notes ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [db.clients, query, district, channel, status, seyIdOnly])

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Client',
      sortValue: (c) => `${c.lastName} ${c.firstName}`,
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-900">{clientName(c)}</p>
          <p className="font-mono text-xs text-ink-500">{c.id}</p>
        </div>
      ),
    },
    {
      key: 'nin',
      header: 'NIN',
      sortValue: (c) => c.nin,
      render: (c) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono text-xs text-ink-700">{c.nin}</span>
          {c.seyIdVerified && (
            <span
              title="Verified against SeyID (simulated)"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700"
            >
              ✓
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'district',
      header: 'District',
      sortValue: (c) => c.district,
      render: (c) => (
        <span className="text-sm">
          {c.district}
          <span className="block text-xs text-ink-500">{c.island}</span>
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (c) => (
        <span className="text-sm">
          {c.phone}
          {c.email && <span className="block truncate text-xs text-ink-500">{c.email}</span>}
        </span>
      ),
    },
    {
      key: 'links',
      header: 'Linked records',
      render: (c) => {
        const l = linkCounts.get(c.id)
        if (!l) return <span className="text-xs text-ink-400">None</span>
        const chips: string[] = []
        if (l.farms) chips.push(`${l.farms} farm${l.farms > 1 ? 's' : ''}`)
        if (l.loans) chips.push(`${l.loans} loan${l.loans > 1 ? 's' : ''}`)
        if (l.lab) chips.push(`${l.lab} lab`)
        if (l.livestock) chips.push(`${l.livestock} visit${l.livestock > 1 ? 's' : ''}`)
        return (
          <span className="flex flex-wrap gap-1">
            {chips.map((c2) => (
              <span key={c2} className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-600">
                {c2}
              </span>
            ))}
          </span>
        )
      },
    },
    {
      key: 'registered',
      header: 'Registered',
      sortValue: (c) => c.registeredOn,
      render: (c) => (
        <span className="text-sm">
          {formatDate(c.registeredOn)}
          <span className="block text-xs capitalize text-ink-500">{c.registeredVia.replace('-', ' ')}</span>
        </span>
      ),
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
        screen="S02"
        title="Client registry"
        description="The single master record for every farmer and stakeholder. Farms, loans, laboratory samples, livestock services, leases and inspections all resolve back to a Client ID."
        refs={['ii.1', 'ii.5', 'ii.6']}
        actions={
          can(role, 'clients.edit') ? (
            <Link to="/clients/new" className="ais-btn-primary">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 4v12M4 10h12" strokeLinecap="round" />
              </svg>
              Register a client
              <ReqBadge refs="i.5" screen="S02" />
            </Link>
          ) : undefined
        }
      />

      {/* --------------------------------------------- duplicate candidates */}
      {duplicates.length > 0 && (
        <section className="mb-5 rounded-lg border border-warn-300 bg-warn-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <svg viewBox="0 0 20 20" className="h-5 w-5 text-warn-600" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 3l7.5 13h-15z" strokeLinejoin="round" />
              <path d="M10 8v3.5M10 14h.01" strokeLinecap="round" />
            </svg>
            <h2 className="text-sm font-semibold text-warn-900">
              {duplicates.length} possible duplicate registration
              {duplicates.length > 1 ? 's' : ''} awaiting review
            </h2>
            <ReqBadge refs="ii.7" screen="S02" />
          </div>
          <p className="mt-1 text-sm text-warn-800">
            Candidates are flagged, never merged automatically. Open a record to review the evidence
            and merge or dismiss.
          </p>
          <ul className="mt-3 space-y-2">
            {duplicates.slice(0, 4).map((m) => (
              <li key={`${m.primary.id}|${m.duplicate.id}`} className="rounded-md border border-warn-200 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">
                      {clientName(m.duplicate)}{' '}
                      <span className="font-normal text-ink-500">may duplicate</span>{' '}
                      {clientName(m.primary)}
                    </p>
                    <p className="font-mono text-xs text-ink-500">
                      {m.duplicate.id} ({formatDate(m.duplicate.registeredOn)}, {m.duplicate.registeredVia})
                      {' → '}
                      {m.primary.id} ({formatDate(m.primary.registeredOn)}, {m.primary.registeredVia})
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge
                      status={m.confidence}
                      tone={m.confidence === 'high' ? 'bad' : 'warn'}
                      label={`${m.confidence} confidence`}
                    />
                    {/* Opens the record the system recommends keeping, so the
                        merge on that page runs in the safe direction. */}
                    <Link to={`/clients/${m.primary.id}`} className="ais-btn-secondary px-3 py-1.5 text-xs">
                      Review
                    </Link>
                  </div>
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
                  {m.reasons.map((r) => (
                    <li key={r.field}>
                      <strong className="text-ink-800">{r.field}:</strong> {r.detail}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --------------------------------------------------------- registry */}
      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(c) => c.id}
        onRowClick={(c) => navigate(`/clients/${c.id}`)}
        unit="clients"
        pageSize={12}
        initialSort={{ key: 'registered', direction: 'desc' }}
        caption="Registered clients"
        emptyTitle="No clients match this search"
        emptyBody="Clear the search box or widen the district and channel filters."
        toolbar={
          <div className="ais-card p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label htmlFor="client-search" className="ais-label">
                  <span className="inline-flex items-center gap-1.5">
                    Search
                    <ReqBadge refs="ii.6" screen="S02" />
                  </span>
                </label>
                <input
                  id="client-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, NIN, Client ID, mobile, email, address…"
                  className="ais-input"
                />
              </div>

              <div>
                <label htmlFor="f-district" className="ais-label">District</label>
                <select id="f-district" value={district} onChange={(e) => setDistrict(e.target.value)} className="ais-input">
                  <option value="all">All districts</option>
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="f-channel" className="ais-label">Registered via</label>
                <select id="f-channel" value={channel} onChange={(e) => setChannel(e.target.value)} className="ais-input">
                  <option value="all">Any channel</option>
                  <option value="self-service">Self-service</option>
                  <option value="officer-assisted">Officer-assisted</option>
                  <option value="migrated">Migrated</option>
                </select>
              </div>

              <div>
                <label htmlFor="f-status" className="ais-label">Status</label>
                <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)} className="ais-input">
                  <option value="active">Active</option>
                  <option value="merged">Merged</option>
                  <option value="inactive">Inactive</option>
                  <option value="all">All</option>
                </select>
              </div>

              <label className="mb-2 inline-flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={seyIdOnly}
                  onChange={(e) => setSeyIdOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-600"
                />
                <span className="inline-flex items-center gap-1.5">
                  SeyID verified only
                  <SimChip />
                  <ReqBadge refs="ii.3" screen="S02" />
                </span>
              </label>
            </div>
          </div>
        }
      />
    </div>
  )
}
