import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb } from '../../app/DataContext'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { MapView } from '../../components/MapPicker'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { StatusBadge } from '../../components/StatusBadge'
import { Tabs } from '../../components/Tabs'
import { clientName, farmActivities, formatDate, formatHa } from '../../lib/format'
import { can } from '../../lib/rbac'
import { statusLabel } from '../../lib/workflow'
import { CROPS, DISTRICTS, LIVESTOCK_TYPES } from '../../lib/types'
import type { Farm } from '../../lib/types'

/** S03 — farm registry: the list and map view over registered holdings. */
export function FarmRegistry() {
  const db = useDb()
  const { role } = useAuth()
  const navigate = useNavigate()

  const [view, setView] = useState('table')
  const [query, setQuery] = useState('')
  const [district, setDistrict] = useState('all')
  const [activity, setActivity] = useState('all')
  const [status, setStatus] = useState('all')

  const clientById = useMemo(
    () => new Map(db.clients.map((c) => [c.id, c])),
    [db.clients],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return db.farms.filter((f) => {
      if (status !== 'all' && f.status !== status) return false
      if (district !== 'all' && f.district !== district) return false
      if (activity !== 'all') {
        const hasCrop = f.crops.includes(activity as (typeof CROPS)[number])
        const hasStock = f.livestock.some((l) => l.type === activity)
        if (!hasCrop && !hasStock) return false
      }
      if (!q) return true
      const owner = clientById.get(f.clientId)
      return [
        f.id, f.name, f.parcelRef, f.district, f.island, f.tenure,
        f.crops.join(' '), f.livestock.map((l) => l.type).join(' '),
        owner ? `${owner.firstName} ${owner.lastName} ${owner.id} ${owner.nin}` : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [db.farms, clientById, query, district, activity, status])

  const totalHa = filtered.reduce((s, f) => s + f.sizeHa, 0)

  const columns: Column<Farm>[] = [
    {
      key: 'farm',
      header: 'Holding',
      sortValue: (f) => f.name,
      render: (f) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-900">{f.name}</p>
          <p className="font-mono text-xs text-ink-500">{f.id}</p>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Farmer',
      sortValue: (f) => clientName(clientById.get(f.clientId)),
      render: (f) => {
        const owner = clientById.get(f.clientId)
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
          <span className="text-xs text-ink-400">Unlinked</span>
        )
      },
    },
    {
      key: 'parcel',
      header: 'Parcel',
      sortValue: (f) => f.parcelRef,
      render: (f) => <span className="font-mono text-xs text-ink-700">{f.parcelRef}</span>,
    },
    {
      key: 'district',
      header: 'District',
      sortValue: (f) => f.district,
      render: (f) => (
        <span className="text-sm">
          {f.district}
          <span className="block text-xs text-ink-500">{f.island}</span>
        </span>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      sortValue: (f) => f.sizeHa,
      render: (f) => <span className="text-sm tabular-nums">{formatHa(f.sizeHa)}</span>,
    },
    {
      key: 'activity',
      header: 'Activity',
      render: (f) => <span className="text-sm capitalize text-ink-700">{farmActivities(f)}</span>,
    },
    {
      key: 'tenure',
      header: 'Tenure',
      sortValue: (f) => f.tenure,
      render: (f) => <span className="text-sm">{statusLabel(f.tenure)}</span>,
      hideOnMobile: true,
    },
    {
      key: 'registered',
      header: 'Registered',
      sortValue: (f) => f.registeredOn,
      render: (f) => (
        <span className="text-sm">
          {formatDate(f.registeredOn)}
          <span className="block text-xs capitalize text-ink-500">{f.registeredVia.replace('-', ' ')}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (f) => f.status,
      render: (f) => <StatusBadge status={f.status} />,
    },
  ]

  return (
    <div className="pb-6">
      <PageHeader
        screen="S03"
        title="Farm registry"
        description="Every registered holding, with its GPS location, size, activity and the client record it belongs to."
        refs={['iii.1', 'iii.2', 'iii.6']}
        actions={
          can(role, 'farms.edit') ? (
            <Link to="/farms/new" className="ais-btn-primary">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 4v12M4 10h12" strokeLinecap="round" />
              </svg>
              Register a farm
            </Link>
          ) : undefined
        }
      />

      <div className="ais-card mb-3 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="farm-search" className="ais-label">Search</label>
            <input
              id="farm-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Holding, Farm ID, parcel, farmer name or NIN…"
              className="ais-input"
            />
          </div>
          <div>
            <label htmlFor="farm-district" className="ais-label">District</label>
            <select id="farm-district" value={district} onChange={(e) => setDistrict(e.target.value)} className="ais-input">
              <option value="all">All districts</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="farm-activity" className="ais-label">Activity</label>
            <select id="farm-activity" value={activity} onChange={(e) => setActivity(e.target.value)} className="ais-input">
              <option value="all">Any activity</option>
              <optgroup label="Crops">
                {CROPS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </optgroup>
              <optgroup label="Livestock">
                {LIVESTOCK_TYPES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div>
            <label htmlFor="farm-status" className="ais-label">Status</label>
            <select id="farm-status" value={status} onChange={(e) => setStatus(e.target.value)} className="ais-input">
              <option value="all">All</option>
              <option value="registered">Registered</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          {filtered.length} holdings · {formatHa(totalHa)} under registration in this view
        </p>
      </div>

      <Tabs
        tabs={[
          { id: 'table', label: 'Register' },
          { id: 'map', label: 'Map' },
        ]}
        active={view}
        onChange={setView}
        className="mb-3"
      />

      {view === 'map' ? (
        <div>
          <MapView
            markers={filtered.map((f) => ({
              id: f.id,
              lat: f.lat,
              lng: f.lng,
              label: f.name,
              detail: `${f.id} · ${f.parcelRef} · ${formatHa(f.sizeHa)} · ${clientName(clientById.get(f.clientId))}`,
            }))}
            height={520}
            zoom={11}
          />
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-500">
            {filtered.length} holdings plotted from captured GPS coordinates. Tiles © OpenStreetMap
            contributors.
            <ReqBadge refs="iii.2" screen="S03" />
          </p>
        </div>
      ) : (
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(f) => f.id}
          onRowClick={(f) => navigate(`/farms/${f.id}`)}
          unit="holdings"
          pageSize={12}
          initialSort={{ key: 'registered', direction: 'desc' }}
          caption="Registered farms"
          emptyTitle="No holdings match this search"
          emptyBody="Clear the search box or widen the district and activity filters."
        />
      )}
    </div>
  )
}
