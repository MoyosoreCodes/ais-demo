import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { DocUploader } from '../../components/DocUploader'
import { EmptyState } from '../../components/EmptyState'
import { ReadOnlyField } from '../../components/Field'
import { MapView } from '../../components/MapPicker'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StatusBadge } from '../../components/StatusBadge'
import { Tabs } from '../../components/Tabs'
import { Timeline } from '../../components/Timeline'
import {
  clientName, farmActivities, formatCoords, formatDate, formatHa, formatScr, localId,
} from '../../lib/format'
import { can } from '../../lib/rbac'
import { statusLabel } from '../../lib/workflow'
import type { DocRef } from '../../lib/types'

/** S03 — a single holding, its linked records and its immutable history. */
export function FarmProfile() {
  const { id } = useParams<{ id: string }>()
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = useState('overview')

  const farm = db.farms.find((f) => f.id === id)
  const owner = db.clients.find((c) => c.id === farm?.clientId)

  const linked = useMemo(() => {
    if (!farm) return null
    return {
      loans: db.loans.filter((l) => l.farmId === farm.id),
      samples: db.samples.filter((s) => s.farmId === farm.id),
      visits: db.livestockVisits.filter((v) => v.farmId === farm.id),
      cases: db.surveillanceCases.filter((c) => c.farmId === farm.id),
      inspections: db.inspections.filter((i) => i.farmId === farm.id),
      leases: db.leases.filter((l) => l.farmId === farm.id),
    }
  }, [db, farm])

  if (!farm || !linked) {
    return (
      <div className="ais-card">
        <EmptyState
          title="Farm record not found"
          action={<Link to="/farms" className="ais-btn-secondary">Back to the farm registry</Link>}
        />
      </div>
    )
  }

  const addDocument = (doc: DocRef) => {
    if (!user) return
    dispatch({
      type: 'farm/update',
      id: farm.id,
      patch: { documents: [...farm.documents, doc] },
      change: {
        id: localId('CH'), at: new Date().toISOString(), actorUserId: user.id, actorName: user.fullName,
        action: 'Supporting document attached', note: `${doc.name} (${doc.category})`,
      },
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'farm.document.added', entityType: 'farm', entityId: farm.id,
        detail: `Document "${doc.name}" attached (verification pending)`,
      },
    })
    toast({ tone: 'success', title: 'Document attached', body: 'Awaiting supervisor verification.', simulated: true })
  }

  const verifyDocument = (docId: string) => {
    if (!user) return
    const doc = farm.documents.find((d) => d.id === docId)
    if (!doc) return
    dispatch({
      type: 'farm/update',
      id: farm.id,
      patch: {
        documents: farm.documents.map((d) =>
          d.id === docId
            ? { ...d, verification: 'verified' as const, verifiedBy: user.id, verifiedOn: new Date().toISOString().slice(0, 10) }
            : d,
        ),
      },
      change: {
        id: localId('CH'), at: new Date().toISOString(), actorUserId: user.id, actorName: user.fullName,
        action: 'Document verified', note: doc.name,
      },
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'farm.document.verified', entityType: 'farm', entityId: farm.id,
        detail: `Document "${doc.name}" verified`,
      },
    })
    toast({ tone: 'success', title: 'Document verified' })
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'documents', label: 'Documents', count: farm.documents.length },
    {
      id: 'linked',
      label: 'Linked activity',
      count:
        linked.loans.length + linked.samples.length + linked.visits.length +
        linked.cases.length + linked.inspections.length + linked.leases.length,
    },
    { id: 'history', label: 'History', count: farm.history.length },
  ]

  return (
    <div className="pb-6">
      <PageHeader
        screen="S03"
        title={farm.name}
        description={`${farm.district}, ${farm.island} · parcel ${farm.parcelRef}`}
        refs={['iii.2', 'iii.5', 'iii.6']}
        actions={<Link to="/farms" className="ais-btn-secondary">Back to registry</Link>}
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded bg-ink-100 px-2 py-1 font-mono text-xs font-semibold text-ink-700">
            {farm.id}
          </span>
          <StatusBadge status={farm.status} />
          <span className="rounded-full border border-ink-200 bg-white px-2.5 py-0.5 text-xs capitalize text-ink-600">
            {farm.registeredVia.replace('-', ' ')}
          </span>
          {owner && (
            <Link
              to={`/clients/${owner.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800 hover:bg-brand-100"
            >
              {clientName(owner)} · {owner.id}
              <ReqBadge refs="iii.6" screen="S03" />
            </Link>
          )}
        </div>
      </PageHeader>

      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-4" />

      {tab === 'overview' && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
          <section className="ais-card p-4">
            <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              Holding details
              <ReqBadge refs="iii.3" screen="S03" />
            </h2>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
              <ReadOnlyField label="Farm ID" value={<span className="font-mono">{farm.id}</span>} badge={<ReqBadge refs="iii.5" screen="S03" />} />
              <ReadOnlyField label="Parcel reference" value={<span className="font-mono">{farm.parcelRef}</span>} />
              <ReadOnlyField label="Size" value={formatHa(farm.sizeHa)} />
              <ReadOnlyField label="Tenure" value={statusLabel(farm.tenure)} />
              <ReadOnlyField label="Water source" value={statusLabel(farm.waterSource)} />
              <ReadOnlyField label="Registered" value={formatDate(farm.registeredOn)} />
              <ReadOnlyField label="Crops" value={farm.crops.length ? farm.crops.join(', ') : '—'} className="col-span-2" />
              <ReadOnlyField
                label="Livestock"
                value={farm.livestock.length ? farm.livestock.map((l) => `${l.headcount} ${l.type}`).join(', ') : '—'}
                className="col-span-2"
              />
              <ReadOnlyField
                label="GPS coordinates"
                value={<span className="font-mono">{formatCoords(farm.lat, farm.lng)}</span>}
                badge={<ReqBadge refs="iii.2" screen="S03" />}
                className="col-span-2"
              />
            </dl>
          </section>

          <section className="ais-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Location</h2>
            <MapView
              markers={[{
                id: farm.id, lat: farm.lat, lng: farm.lng, label: farm.name,
                detail: `${farm.parcelRef} · ${formatHa(farm.sizeHa)} · ${farmActivities(farm)}`,
              }]}
              center={{ lat: farm.lat, lng: farm.lng }}
              zoom={16}
              height={300}
            />
          </section>
        </div>
      )}

      {tab === 'documents' && (
        <section className="ais-card p-4">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
            Supporting documents
            <ReqBadge refs="iii.4" screen="S03" />
          </h2>
          <DocUploader
            documents={farm.documents}
            onAdd={can(role, 'farms.edit') ? addDocument : undefined}
            readOnly={!can(role, 'farms.edit')}
            uploadedBy={user?.id ?? 'SYSTEM'}
          />
          {can(role, 'farms.edit') && farm.documents.some((d) => d.verification === 'pending') && (
            <div className="mt-4 rounded-lg border border-warn-200 bg-warn-50 p-3">
              <p className="text-sm font-semibold text-warn-900">Documents awaiting verification</p>
              <ul className="mt-2 space-y-1.5">
                {farm.documents
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

      {tab === 'linked' && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          <LinkedList
            title="Loan applications"
            refs={['v.4']}
            items={linked.loans.map((l) => ({
              id: l.id,
              primary: l.purpose,
              secondary: `${l.id} · ${formatScr(l.amountScr)} · submitted ${formatDate(l.submittedOn)}`,
              status: l.status,
            }))}
          />
          <LinkedList
            title="Laboratory samples"
            refs={['vi.6']}
            items={linked.samples.map((s) => ({
              id: s.id,
              primary: `${s.type.charAt(0).toUpperCase()}${s.type.slice(1)} sample`,
              secondary: `${s.id} · requested ${formatDate(s.requestedOn)}`,
              status: s.status,
            }))}
          />
          <LinkedList
            title="Livestock service visits"
            refs={['vii.4']}
            items={linked.visits.map((v) => ({
              id: v.id,
              primary: `${v.type} visit · ${v.species}`,
              secondary: `${v.id} · ${formatDate(v.visitedOn ?? v.scheduledOn)}`,
              status: v.status,
            }))}
          />
          <LinkedList
            title="Surveillance cases"
            refs={['viii.4']}
            items={linked.cases.map((c) => ({
              id: c.id,
              primary: c.suspectedDisease,
              secondary: `${c.id} · reported ${formatDate(c.reportedOn)}${c.linkedSampleId ? ` · lab ${c.linkedSampleId}` : ''}`,
              status: c.status,
            }))}
          />
          <LinkedList
            title="Field inspections"
            refs={['x.5']}
            items={linked.inspections.map((i) => ({
              id: i.id,
              primary: i.type.replace(/-/g, ' '),
              secondary: `${i.id} · ${formatDate(i.completedOn ?? i.scheduledOn)}${i.capturedOffline ? ' · captured offline' : ''}`,
              status: i.outcome,
            }))}
          />
          <LinkedList
            title="Leases"
            refs={['iv.5']}
            items={linked.leases.map((l) => ({
              id: l.id,
              primary: `Parcel ${l.parcelRef}`,
              secondary: `${l.id} · ${formatDate(l.startDate)} – ${formatDate(l.endDate)} · ${formatScr(l.annualRentScr)}/yr`,
              status: l.status,
            }))}
          />
        </div>
      )}

      {tab === 'history' && (
        <section className="ais-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-900">Registration history</h2>
            <SimChip label="append-only" title="History entries are appended, never edited or removed." />
          </div>
          <Timeline events={farm.history} />
        </section>
      )}
    </div>
  )
}

function LinkedList({
  title, items, refs,
}: {
  title: string
  refs?: string[]
  items: { id: string; primary: string; secondary: string; status: string }[]
}) {
  return (
    <section className="ais-card p-4">
      <h2 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
        {title}
        {refs && <ReqBadge refs={refs} screen="S03" />}
        <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">
          {items.length}
        </span>
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-ink-500">None recorded against this holding.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="rounded-lg border border-ink-200 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium capitalize text-ink-900">{i.primary}</span>
                <StatusBadge status={i.status} />
              </div>
              <p className="font-mono text-xs text-ink-500">{i.secondary}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
