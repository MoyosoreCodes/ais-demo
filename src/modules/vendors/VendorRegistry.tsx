import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { SelectField, TextField } from '../../components/Field'
import { KpiCard } from '../../components/KpiCard'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { StatusBadge } from '../../components/StatusBadge'
import { Tabs } from '../../components/Tabs'
import { exportTableExcel, exportTablePdf } from '../../lib/export'
import { DEMO_TODAY, clientName, formatDate, formatScr, localId, nextVendorId } from '../../lib/format'
import { can } from '../../lib/rbac'
import { statusLabel } from '../../lib/workflow'
import type { Stall, Vendor } from '../../lib/types'

const daysUntil = (date: string): number => differenceInCalendarDays(parseISO(date), DEMO_TODAY)

const CATEGORIES: Vendor['category'][] = ['produce', 'fish', 'value-added', 'crafts']

/**
 * S09 — vendor and market management (ix.1–ix.5).
 *
 * The registry and the stall board are two views of one fact: who is licensed
 * to trade, and where they stand on market day.
 */
export function VendorRegistry() {
  const db = useDb()
  const { role } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [tab, setTab] = useState('vendors')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null)

  const stallById = useMemo(() => new Map(db.stalls.map((s) => [s.id, s])), [db.stalls])
  const vendorById = useMemo(() => new Map(db.vendors.map((v) => [v.id, v])), [db.vendors])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return db.vendors.filter((v) => {
      if (status === 'expiring') {
        const d = daysUntil(v.expiresOn)
        if (!(v.registrationStatus === 'active' && d >= 0 && d <= 60)) return false
      } else if (status !== 'all' && v.registrationStatus !== status) return false
      if (!q) return true
      return [v.id, v.fullName, v.tradeName, v.category, v.licenceNo, v.market, v.phone, v.email, v.stallId ?? '']
        .join(' ').toLowerCase().includes(q)
    })
  }, [db.vendors, status, query])

  const kpis = useMemo(() => {
    const active = db.vendors.filter((v) => v.registrationStatus === 'active')
    const expiring = active.filter((v) => daysUntil(v.expiresOn) >= 0 && daysUntil(v.expiresOn) <= 60)
    const allocated = db.stalls.filter((s) => s.status === 'allocated')
    const vacant = db.stalls.filter((s) => s.status === 'vacant')
    return {
      total: db.vendors.length,
      active: active.length,
      expiring: expiring.length,
      linked: db.vendors.filter((v) => v.clientId).length,
      allocated: allocated.length,
      vacant: vacant.length,
      stalls: db.stalls.length,
      monthlyFees: allocated.reduce((s, st) => s + st.monthlyFeeScr, 0),
    }
  }, [db.vendors, db.stalls])

  const reportOptions = {
    title: 'Vendor and market report',
    subtitle: 'Registered market vendors, licence status and stall allocation',
    columns: [
      { header: 'Vendor', value: (v: Vendor) => v.id },
      { header: 'Name', value: (v: Vendor) => v.fullName },
      { header: 'Trading as', value: (v: Vendor) => v.tradeName },
      { header: 'Category', value: (v: Vendor) => statusLabel(v.category) },
      { header: 'Client ID', value: (v: Vendor) => v.clientId ?? '—' },
      { header: 'Licence', value: (v: Vendor) => v.licenceNo },
      { header: 'Market', value: (v: Vendor) => v.market },
      { header: 'Stall', value: (v: Vendor) => v.stallId ?? 'Not allocated' },
      { header: 'Monthly fee (SCR)', value: (v: Vendor) => (v.stallId ? (stallById.get(v.stallId)?.monthlyFeeScr ?? 0) : 0), align: 'right' as const },
      { header: 'Registered', value: (v: Vendor) => v.registeredOn },
      { header: 'Expires', value: (v: Vendor) => v.expiresOn },
      { header: 'Status', value: (v: Vendor) => statusLabel(v.registrationStatus) },
    ],
    rows: filtered,
    meta: [
      { label: 'Vendors in view', value: String(filtered.length) },
      { label: 'Stalls allocated', value: `${kpis.allocated} of ${kpis.stalls}` },
      { label: 'Monthly stall fees', value: formatScr(kpis.monthlyFees) },
    ],
    notes: [
      `${kpis.expiring} active registrations expire within 60 days.`,
      `${kpis.linked} vendors are linked to a client record in the central registry, so their farm and market activity resolve together.`,
    ],
    orientation: 'landscape' as const,
    fileStem: 'vendor-market-report',
  }

  const runExport = async (kind: 'pdf' | 'excel') => {
    setBusy(kind)
    try {
      await (kind === 'pdf' ? exportTablePdf(reportOptions) : exportTableExcel(reportOptions))
      toast({ tone: 'success', title: `${kind === 'pdf' ? 'PDF' : 'Excel'} report generated`, body: `${filtered.length} vendors exported.` })
    } finally {
      setBusy(null)
    }
  }

  const columns: Column<Vendor>[] = [
    {
      key: 'vendor',
      header: 'Vendor',
      sortValue: (v) => v.tradeName,
      render: (v) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-900">{v.tradeName}</p>
          <p className="truncate text-xs text-ink-500">{v.fullName} · <span className="font-mono">{v.id}</span></p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortValue: (v) => v.category,
      render: (v) => <span className="text-sm capitalize">{v.category.replace('-', ' ')}</span>,
    },
    {
      key: 'client',
      header: 'Client record',
      render: (v) =>
        v.clientId ? (
          <Link
            to={`/clients/${v.clientId}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs text-brand-700 hover:underline"
          >
            {v.clientId}
          </Link>
        ) : (
          <span className="text-xs text-ink-400">Trader only</span>
        ),
      hideOnMobile: true,
    },
    {
      key: 'stall',
      header: 'Stall',
      sortValue: (v) => v.stallId ?? 'zzz',
      render: (v) =>
        v.stallId ? (
          <span className="text-sm">
            <span className="font-mono font-medium text-ink-900">{v.stallId}</span>
            <span className="block text-xs text-ink-500">{stallById.get(v.stallId)?.section ?? ''}</span>
          </span>
        ) : (
          <span className="text-xs text-ink-400">Not allocated</span>
        ),
    },
    {
      key: 'licence',
      header: 'Licence',
      sortValue: (v) => v.expiresOn,
      render: (v) => {
        const d = daysUntil(v.expiresOn)
        return (
          <span className="whitespace-nowrap text-sm">
            <span className="font-mono text-xs">{v.licenceNo}</span>
            <span className={`block text-xs ${d < 0 ? 'text-danger-600' : d <= 60 ? 'text-warn-600' : 'text-ink-500'}`}>
              {d < 0 ? `expired ${Math.abs(d)} days ago` : `expires in ${d} days`}
            </span>
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (v) => v.registrationStatus,
      render: (v) => <StatusBadge status={v.registrationStatus} />,
    },
  ]

  return (
    <div className="pb-6">
      <PageHeader
        screen="S09"
        title="Vendors & market"
        description="Registered market vendors and traders, their licence status, and stall allocation at Victoria Market."
        refs={['ix.1', 'ix.2', 'ix.4']}
        actions={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => void runExport('excel')} disabled={busy !== null || !filtered.length}>
              {busy === 'excel' ? 'Generating…' : 'Export Excel'}
            </button>
            <button type="button" className="ais-btn-secondary" onClick={() => void runExport('pdf')} disabled={busy !== null || !filtered.length}>
              {busy === 'pdf' ? 'Generating…' : 'Export PDF'}
              <ReqBadge refs="ix.5" screen="S09" />
            </button>
            {can(role, 'vendors.edit') && (
              <button type="button" className="ais-btn-primary" onClick={() => setRegisterOpen(true)}>
                Register a vendor
                <ReqBadge refs="ix.1" screen="S09" />
              </button>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Registered vendors" value={kpis.total} hint={`${kpis.active} active`} onClick={() => setStatus('all')} active={status === 'all'} />
        <KpiCard label="Licences expiring" value={kpis.expiring} hint="Within 60 days" tone={kpis.expiring ? 'warn' : 'good'} refs={['ix.4']} screen="S09" onClick={() => setStatus('expiring')} active={status === 'expiring'} />
        <KpiCard label="Stalls allocated" value={`${kpis.allocated}/${kpis.stalls}`} hint={`${kpis.vacant} vacant`} refs={['ix.3']} screen="S09" onClick={() => setTab('stalls')} />
        <KpiCard label="Monthly stall fees" value={formatScr(kpis.monthlyFees)} hint="Across allocated stalls" />
        <KpiCard label="Linked to a farmer" value={kpis.linked} hint="Also on the client registry" tone="good" />
      </div>

      <Tabs
        tabs={[
          { id: 'vendors', label: 'Vendor registry', count: db.vendors.length },
          { id: 'stalls', label: 'Victoria Market stalls', count: db.stalls.length },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-3"
      />

      {tab === 'vendors' && (
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(v) => v.id}
          onRowClick={(v) => navigate(`/vendors/${v.id}`)}
          unit="vendors"
          pageSize={12}
          initialSort={{ key: 'vendor', direction: 'asc' }}
          caption="Registered market vendors"
          emptyTitle="No vendors match this filter"
          toolbar={
            <div className="ais-card p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <label htmlFor="vendor-search" className="ais-label">Search</label>
                  <input
                    id="vendor-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Trading name, vendor, licence, stall or category…"
                    className="ais-input"
                  />
                </div>
                <div>
                  <label htmlFor="vendor-status" className="ais-label">Registration status</label>
                  <select id="vendor-status" value={status} onChange={(e) => setStatus(e.target.value)} className="ais-input">
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="expiring">Expiring within 60 days</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
            </div>
          }
        />
      )}

      {tab === 'stalls' && <StallBoard vendorById={vendorById} />}

      <RegisterVendorDialog open={registerOpen} onClose={() => setRegisterOpen(false)} />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Stall allocation board (ix.3)
 * ------------------------------------------------------------------ */

const STALL_TONE: Record<Stall['status'], string> = {
  vacant: 'border-ink-300 bg-white text-ink-600 hover:border-brand-400 hover:bg-brand-50',
  allocated: 'border-brand-400 bg-brand-100 text-brand-900',
  reserved: 'border-warn-300 bg-warn-50 text-warn-800',
  maintenance: 'border-ink-300 bg-ink-100 text-ink-500',
}

export function StallBoard({ vendorById }: { vendorById: Map<string, Vendor> }) {
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()
  const [selected, setSelected] = useState<Stall | null>(null)

  /** Grouped by section, then by row, to mirror the market's physical layout. */
  const sections = useMemo(() => {
    const bySection = new Map<string, Map<string, Stall[]>>()
    for (const stall of db.stalls) {
      const rows = bySection.get(stall.section) ?? new Map<string, Stall[]>()
      const row = rows.get(stall.row) ?? []
      row.push(stall)
      rows.set(stall.row, row)
      bySection.set(stall.section, rows)
    }
    for (const rows of bySection.values()) {
      for (const row of rows.values()) row.sort((a, b) => a.number - b.number)
    }
    return [...bySection.entries()]
  }, [db.stalls])

  const canAllocate = can(role, 'vendors.edit')

  const allocate = (stall: Stall, vendorId: string) => {
    if (!user) return
    const vendor = db.vendors.find((v) => v.id === vendorId)
    if (!vendor) return

    // Free whatever the vendor held before, so a vendor never occupies two stalls.
    const previous = db.stalls.find((s) => s.vendorId === vendorId)
    if (previous && previous.id !== stall.id) {
      dispatch({ type: 'stall/update', id: previous.id, patch: { status: 'vacant', vendorId: undefined, allocatedOn: undefined } })
    }

    dispatch({
      type: 'stall/update',
      id: stall.id,
      patch: { status: 'allocated', vendorId, allocatedOn: DEMO_TODAY.toISOString().slice(0, 10) },
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'stall.allocated', entityType: 'vendor', entityId: vendorId,
        detail: `Stall ${stall.id} (${stall.section}) allocated to ${vendor.tradeName} at ${stall.market}`,
      },
    })
    dispatch({
      type: 'vendor/update',
      id: vendorId,
      patch: { stallId: stall.id },
      change: {
        id: localId('VN'), at: new Date().toISOString(), actorUserId: user.id, actorName: user.fullName,
        action: `Stall ${stall.id} allocated`,
        field: 'stallId', from: vendor.stallId, to: stall.id,
      },
    })

    setSelected(null)
    toast({ tone: 'success', title: 'Stall allocated', body: `${stall.id} → ${vendor.tradeName}` })
  }

  const release = (stall: Stall) => {
    if (!user || !stall.vendorId) return
    const vendor = db.vendors.find((v) => v.id === stall.vendorId)
    dispatch({
      type: 'stall/update',
      id: stall.id,
      patch: { status: 'vacant', vendorId: undefined, allocatedOn: undefined },
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'stall.released', entityType: 'vendor', entityId: stall.vendorId,
        detail: `Stall ${stall.id} released from ${vendor?.tradeName ?? stall.vendorId}`,
      },
    })
    if (vendor) {
      dispatch({
        type: 'vendor/update',
        id: vendor.id,
        patch: { stallId: undefined },
        change: {
          id: localId('VN'), at: new Date().toISOString(), actorUserId: user.id, actorName: user.fullName,
          action: `Stall ${stall.id} released`, field: 'stallId', from: stall.id, to: '(none)',
        },
      })
    }
    setSelected(null)
    toast({ tone: 'success', title: 'Stall released', body: `${stall.id} is now vacant.` })
  }

  const unallocated = db.vendors.filter(
    (v) => v.registrationStatus === 'active' && !v.stallId,
  )

  return (
    <div>
      <div className="ais-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
            Victoria Market — stall allocation
            <ReqBadge refs="ix.3" screen="S09" />
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {(['allocated', 'vacant', 'reserved', 'maintenance'] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={`h-3 w-5 rounded border ${STALL_TONE[s].split(' ').slice(0, 2).join(' ')}`} aria-hidden />
                <span className="capitalize text-ink-600">{s}</span>
              </span>
            ))}
          </div>
        </div>
        <p className="mt-1 text-xs text-ink-500">
          A simplified representation of the market floor. Select a stall to allocate it to a
          registered vendor or to release it.
        </p>

        <div className="mt-4 space-y-5">
          {sections.map(([section, rows]) => (
            <div key={section}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">{section}</p>
              <div className="space-y-2">
                {[...rows.entries()].map(([row, stalls]) => (
                  <div key={row} className="flex flex-wrap items-center gap-2">
                    <span className="w-6 shrink-0 text-xs font-semibold text-ink-400">{row}</span>
                    {stalls.map((stall) => {
                      const vendor = stall.vendorId ? vendorById.get(stall.vendorId) : undefined
                      return (
                        <button
                          key={stall.id}
                          type="button"
                          onClick={() => setSelected(stall)}
                          title={vendor ? `${stall.id} — ${vendor.tradeName}` : `${stall.id} — ${statusLabel(stall.status)}`}
                          className={`w-24 rounded-lg border p-2 text-left transition-colors ${STALL_TONE[stall.status]}`}
                        >
                          <span className="block font-mono text-xs font-bold">{stall.id}</span>
                          <span className="mt-0.5 block truncate text-[11px]">
                            {vendor ? vendor.tradeName : statusLabel(stall.status)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `Stall ${selected.id}` : ''}
        size="md"
        description={selected ? `${selected.section} · row ${selected.row} · ${formatScr(selected.monthlyFeeScr)} per month` : undefined}
        footer={
          selected?.status === 'allocated' && canAllocate ? (
            <>
              <button type="button" className="ais-btn-secondary" onClick={() => setSelected(null)}>Close</button>
              <button type="button" className="ais-btn-danger" onClick={() => release(selected)}>
                Release stall
              </button>
            </>
          ) : (
            <button type="button" className="ais-btn-secondary" onClick={() => setSelected(null)}>Close</button>
          )
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} />
              {selected.allocatedOn && (
                <span className="text-xs text-ink-500">Allocated {formatDate(selected.allocatedOn)}</span>
              )}
            </div>

            {selected.vendorId ? (
              (() => {
                const vendor = vendorById.get(selected.vendorId)
                return vendor ? (
                  <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
                    <Link to={`/vendors/${vendor.id}`} className="text-sm font-semibold text-brand-800 hover:underline">
                      {vendor.tradeName}
                    </Link>
                    <p className="text-xs text-ink-600">{vendor.fullName} · {vendor.licenceNo}</p>
                    <p className="mt-0.5 text-xs text-ink-600">
                      {statusLabel(vendor.category)} · licence expires {formatDate(vendor.expiresOn)}
                    </p>
                  </div>
                ) : null
              })()
            ) : canAllocate ? (
              <div>
                <p className="ais-label mb-1.5">Allocate to an active vendor</p>
                {unallocated.length === 0 ? (
                  <p className="text-sm text-ink-500">
                    Every active vendor already holds a stall.
                  </p>
                ) : (
                  <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                    {unallocated.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => allocate(selected, v.id)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-ink-200 px-3 py-2 text-left hover:border-brand-300 hover:bg-brand-50/60"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink-900">{v.tradeName}</span>
                            <span className="block truncate text-xs text-ink-500">
                              {v.fullName} · {statusLabel(v.category)}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-xs text-ink-500">{v.id}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-600">
                This stall is {statusLabel(selected.status).toLowerCase()}. Allocation requires the
                vendor-management permission.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Vendor registration (ix.1, ix.2)
 * ------------------------------------------------------------------ */

function RegisterVendorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDb()
  const dispatch = useDispatch()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [clientId, setClientId] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [fullName, setFullName] = useState('')
  const [category, setCategory] = useState<Vendor['category']>('produce')

  const linkedClient = db.clients.find((c) => c.id === clientId)
  const canSave = tradeName.trim().length > 2 && (linkedClient !== undefined || fullName.trim().length > 2)

  const save = () => {
    if (!user || !canSave) return
    const id = nextVendorId(db.vendors.map((v) => v.id))
    const year = DEMO_TODAY.getUTCFullYear()
    const expires = new Date(DEMO_TODAY)
    expires.setUTCFullYear(expires.getUTCFullYear() + 1)

    const vendor: Vendor = {
      id,
      clientId: linkedClient?.id,
      fullName: linkedClient ? clientName(linkedClient) : fullName.trim(),
      tradeName: tradeName.trim(),
      category,
      phone: linkedClient?.phone ?? '+248 2 000 000',
      email: linkedClient?.email ?? '',
      market: 'Victoria Market',
      licenceNo: `VM/${year}/${String(db.vendors.length + 100).padStart(4, '0')}`,
      registrationStatus: 'active',
      registeredOn: DEMO_TODAY.toISOString().slice(0, 10),
      expiresOn: expires.toISOString().slice(0, 10),
      history: [
        {
          id: localId('VN'), at: new Date().toISOString(), actorUserId: user.id, actorName: user.fullName,
          action: linkedClient
            ? 'Vendor registered against existing client record'
            : 'Vendor registered (trader, no farm holding)',
        },
      ],
    }

    dispatch({
      type: 'vendor/create',
      vendor,
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'vendor.registered', entityType: 'vendor', entityId: id,
        detail: `${vendor.tradeName} registered at ${vendor.market}${linkedClient ? ` against client ${linkedClient.id}` : ''}`,
      },
    })

    toast({ tone: 'success', title: 'Vendor registered', body: `${vendor.tradeName} · ${id}` })
    onClose()
    navigate(`/vendors/${id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register a market vendor"
      size="md"
      description="A farmer who sells at market is registered against their existing client record rather than entered again."
      footer={
        <>
          <button type="button" className="ais-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="ais-btn-primary" onClick={save} disabled={!canSave}>
            Register vendor
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField
          label="Link to a client record"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          badge={<ReqBadge refs="ii.5" screen="S09" />}
          hint="Leave blank for a trader who is not a registered farmer."
        >
          <option value="">Not a registered farmer</option>
          {db.clients
            .filter((c) => c.status !== 'merged')
            .map((c) => (
              <option key={c.id} value={c.id}>{clientName(c)} · {c.id}</option>
            ))}
        </SelectField>

        {linkedClient ? (
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm">
            <p className="font-semibold text-ink-900">{clientName(linkedClient)}</p>
            <p className="font-mono text-xs text-ink-600">{linkedClient.id} · {linkedClient.nin}</p>
            <p className="mt-0.5 text-xs text-ink-600">
              Contact details come from the client record — {linkedClient.phone}
              {linkedClient.email ? `, ${linkedClient.email}` : ''}.
            </p>
          </div>
        ) : (
          <TextField
            label="Vendor name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Name of the trader"
          />
        )}

        <TextField
          label="Trading name"
          required
          value={tradeName}
          onChange={(e) => setTradeName(e.target.value)}
          placeholder="e.g. Rivière Doux Produce"
        />

        <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value as Vendor['category'])}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{statusLabel(c)}</option>
          ))}
        </SelectField>

        <p className="text-xs text-ink-500">
          A one-year licence is issued at Victoria Market. Allocate a stall from the stall board once
          the registration is active.
        </p>
      </div>
    </Modal>
  )
}
