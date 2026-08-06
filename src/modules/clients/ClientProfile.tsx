import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { EmptyState } from '../../components/EmptyState'
import { ReadOnlyField, SelectField, TextAreaField, TextField } from '../../components/Field'
import { MapView } from '../../components/MapPicker'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StageTracker } from '../../components/StageTracker'
import { StatusBadge } from '../../components/StatusBadge'
import { Tabs } from '../../components/Tabs'
import { Timeline } from '../../components/Timeline'
import { findClientDuplicates, recommendSurvivor } from '../../lib/duplicates'
import type { ClientMatch } from '../../lib/duplicates'
import {
  clientName, farmActivities, formatDate, formatHa, formatScr, isValidEmail, isValidPhone, localId,
} from '../../lib/format'
import { can } from '../../lib/rbac'
import { statusLabel } from '../../lib/workflow'
import { DISTRICTS } from '../../lib/types'
import type { ChangeEvent, Client, District } from '../../lib/types'

/**
 * S02 — client profile (ii.2, ii.3 ★, ii.4, ii.5 ★, ii.7 ★).
 *
 * The tab strip is the demonstration of ii.5: every module's records for this
 * farmer are resolved by Client ID, with no re-keying anywhere.
 */
export function ClientProfile() {
  const { id } = useParams<{ id: string }>()
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [tab, setTab] = useState('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [mergeTarget, setMergeTarget] = useState<ClientMatch | null>(null)

  const client = db.clients.find((c) => c.id === id)

  const linked = useMemo(() => {
    if (!client) return null
    return {
      farms: db.farms.filter((f) => f.clientId === client.id),
      loans: db.loans.filter((l) => l.clientId === client.id),
      samples: db.samples.filter((s) => s.clientId === client.id),
      visits: db.livestockVisits.filter((v) => v.clientId === client.id),
      cases: db.surveillanceCases.filter((s) => s.clientId === client.id),
      leases: db.leases.filter((l) => l.clientId === client.id),
      landApps: db.landApplications.filter((l) => l.clientId === client.id),
      inspections: db.inspections.filter((i) => i.clientId === client.id),
      vendors: db.vendors.filter((v) => v.clientId === client.id),
      documents: db.documents.filter((d) => d.clientId === client.id),
      notifications: db.notifications.filter((n) => n.recipientClientId === client.id),
    }
  }, [db, client])

  const duplicates = useMemo(
    () =>
      client
        ? findClientDuplicates(
            { id: client.id, nin: client.nin, firstName: client.firstName, lastName: client.lastName, phone: client.phone, email: client.email, dateOfBirth: client.dateOfBirth },
            db.clients,
          )
        : [],
    [client, db.clients],
  )

  const actorNames = useMemo(
    () => Object.fromEntries(db.users.map((u) => [u.id, u.fullName])),
    [db.users],
  )

  if (!client || !linked) {
    return (
      <div className="ais-card">
        <EmptyState
          title="Client record not found"
          body="The record may have been merged into another registration."
          action={<Link to="/clients" className="ais-btn-secondary">Back to the registry</Link>}
        />
      </div>
    )
  }

  const mergedInto = client.mergedIntoId ? db.clients.find((c) => c.id === client.mergedIntoId) : null

  const doMerge = (match: ClientMatch) => {
    if (!user) return
    // The record being viewed survives; the candidate is retired into it.
    const change: ChangeEvent = {
      id: localId('CH'),
      at: new Date().toISOString(),
      actorUserId: user.id,
      actorName: user.fullName,
      action: 'Duplicate registration merged',
      note: `Legacy record ${match.client.id} (${clientName(match.client)}, registered ${formatDate(match.client.registeredOn)}) merged into this record. All linked farms, loans, laboratory, livestock, lease and inspection records were reassigned.`,
    }
    dispatch({
      type: 'client/merge',
      primaryId: client.id,
      duplicateId: match.client.id,
      change,
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'client.duplicate.merged',
        entityType: 'client',
        entityId: client.id,
        detail: `Legacy record ${match.client.id} merged into ${client.id}`,
      },
    })
    setMergeTarget(null)
    toast({
      tone: 'success',
      title: 'Duplicate merged',
      body: `${match.client.id} retired into ${client.id}. Linked records reassigned.`,
    })
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'farms', label: 'Farms', count: linked.farms.length },
    { id: 'loans', label: 'Loans', count: linked.loans.length },
    { id: 'lab', label: 'Laboratory', count: linked.samples.length },
    { id: 'livestock', label: 'Livestock & surveillance', count: linked.visits.length + linked.cases.length },
    { id: 'land', label: 'Land & leases', count: linked.leases.length + linked.landApps.length },
    { id: 'field', label: 'Inspections', count: linked.inspections.length },
    { id: 'documents', label: 'Documents', count: linked.documents.length },
    { id: 'history', label: 'Change history', count: client.history.length },
  ]

  return (
    <div className="pb-6">
      <PageHeader
        screen="S02"
        title={clientName(client)}
        description={`${client.stakeholderType === 'cooperative' ? 'Cooperative' : 'Farmer'} · ${client.district}, ${client.island}`}
        refs={['ii.2', 'ii.5']}
        actions={
          <>
            <Link to="/clients" className="ais-btn-secondary">Back to registry</Link>
            {can(role, 'clients.edit') && client.status !== 'merged' && (
              <button type="button" className="ais-btn-primary" onClick={() => setEditOpen(true)}>
                Edit profile
                <ReqBadge refs="ii.4" screen="S02" />
              </button>
            )}
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded bg-ink-100 px-2 py-1 font-mono text-xs font-semibold text-ink-700">
            {client.id}
          </span>
          <StatusBadge status={client.status} />
          {client.seyIdVerified && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800">
              SeyID verified <SimChip />
            </span>
          )}
          <span className="rounded-full border border-ink-200 bg-white px-2.5 py-0.5 text-xs text-ink-600 capitalize">
            {client.registeredVia.replace('-', ' ')}
          </span>
        </div>
      </PageHeader>

      {/* --------------------------------------------------- merged banner */}
      {client.status === 'merged' && mergedInto && (
        <div className="mb-5 rounded-lg border border-ink-300 bg-ink-100 p-4">
          <p className="text-sm font-semibold text-ink-900">This record has been merged</p>
          <p className="mt-1 text-sm text-ink-700">
            It was retired into{' '}
            <Link to={`/clients/${mergedInto.id}`} className="ais-link font-medium">
              {clientName(mergedInto)} ({mergedInto.id})
            </Link>
            . The record is retained rather than deleted so historical references keep resolving.
          </p>
        </div>
      )}

      {/* ------------------------------------------------ duplicate warning */}
      {client.status !== 'merged' && duplicates.length > 0 && (
        <section className="mb-5 rounded-lg border border-warn-300 bg-warn-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <svg viewBox="0 0 20 20" className="h-5 w-5 text-warn-600" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 3l7.5 13h-15z" strokeLinejoin="round" />
              <path d="M10 8v3.5M10 14h.01" strokeLinecap="round" />
            </svg>
            <h2 className="text-sm font-semibold text-warn-900">
              Possible duplicate registration detected
            </h2>
            <ReqBadge refs="ii.7" screen="S02" />
          </div>
          <ul className="mt-3 space-y-2">
            {duplicates.map((m) => (
              <li key={m.client.id} className="rounded-md border border-warn-200 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">{clientName(m.client)}</p>
                    <p className="font-mono text-xs text-ink-500">
                      {m.client.id} · {m.client.nin} · registered {formatDate(m.client.registeredOn)} (
                      {m.client.registeredVia})
                    </p>
                    <ul className="mt-2 space-y-0.5 text-xs text-ink-600">
                      {m.reasons.map((r) => (
                        <li key={r.field}>
                          <strong className="text-ink-800">{r.field}:</strong> {r.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge
                      status={m.confidence}
                      tone={m.confidence === 'high' ? 'bad' : 'warn'}
                      label={`${Math.round(m.score * 100)}% · ${m.confidence}`}
                    />
                    <div className="flex gap-2">
                      <Link to={`/clients/${m.client.id}`} className="ais-btn-secondary px-3 py-1.5 text-xs">
                        Open
                      </Link>
                      {can(role, 'clients.merge') && (
                        <button
                          type="button"
                          className="ais-btn-primary px-3 py-1.5 text-xs"
                          onClick={() => setMergeTarget(m)}
                        >
                          Merge…
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-4" />

      {/* ------------------------------------------------------- overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
          <section className="ais-card p-4">
            <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              Personal and contact information
              <ReqBadge refs="ii.2" screen="S02" />
            </h2>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
              <ReadOnlyField label="First name" value={client.firstName} />
              <ReadOnlyField label="Surname" value={client.lastName} />
              <ReadOnlyField
                label="NIN"
                value={<span className="font-mono">{client.nin}</span>}
                badge={<ReqBadge refs="ii.3" screen="S02" />}
              />
              <ReadOnlyField label="Date of birth" value={formatDate(client.dateOfBirth)} />
              <ReadOnlyField label="Gender" value={client.gender === 'F' ? 'Female' : 'Male'} />
              <ReadOnlyField label="Stakeholder type" value={statusLabel(client.stakeholderType)} />
              <ReadOnlyField label="Mobile" value={client.phone} />
              <ReadOnlyField label="Email" value={client.email} />
              <ReadOnlyField label="District" value={client.district} />
              <ReadOnlyField label="Island" value={client.island} />
              <ReadOnlyField label="Address" value={client.address} className="col-span-2" />
              {client.notes && <ReadOnlyField label="Notes" value={client.notes} className="col-span-2" />}
            </dl>
          </section>

          <section className="ais-card p-4">
            <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              Linked records across the system
              <ReqBadge refs="ii.5" screen="S02" />
            </h2>
            <ul className="grid grid-cols-2 gap-2">
              {[
                { label: 'Farms', n: linked.farms.length, tab: 'farms' },
                { label: 'Loan applications', n: linked.loans.length, tab: 'loans' },
                { label: 'Laboratory samples', n: linked.samples.length, tab: 'lab' },
                { label: 'Livestock visits', n: linked.visits.length, tab: 'livestock' },
                { label: 'Surveillance cases', n: linked.cases.length, tab: 'livestock' },
                { label: 'Leases', n: linked.leases.length, tab: 'land' },
                { label: 'Land applications', n: linked.landApps.length, tab: 'land' },
                { label: 'Inspections', n: linked.inspections.length, tab: 'field' },
                { label: 'Vendor registrations', n: linked.vendors.length, tab: 'overview' },
                { label: 'Digitized documents', n: linked.documents.length, tab: 'documents' },
              ].map((row) => (
                <li key={row.label}>
                  <button
                    type="button"
                    onClick={() => setTab(row.tab)}
                    className="flex w-full items-center justify-between rounded-lg border border-ink-200 px-3 py-2 text-left hover:border-brand-300 hover:bg-brand-50/50"
                  >
                    <span className="text-sm text-ink-700">{row.label}</span>
                    <span className={`text-sm font-semibold ${row.n ? 'text-brand-700' : 'text-ink-400'}`}>
                      {row.n}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-500">
              Each count is resolved by Client ID <span className="font-mono">{client.id}</span> — the
              record is entered once and reused by every module.
            </p>
          </section>
        </div>
      )}

      {/* ---------------------------------------------------------- farms */}
      {tab === 'farms' && (
        <div className="space-y-4">
          {linked.farms.length === 0 ? (
            <div className="ais-card"><EmptyState title="No farms registered against this client" /></div>
          ) : (
            <>
              <MapView
                markers={linked.farms.map((f) => ({
                  id: f.id, lat: f.lat, lng: f.lng, label: f.name,
                  detail: `${f.parcelRef} · ${formatHa(f.sizeHa)}`,
                }))}
                zoom={13}
                height={260}
              />
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
                {linked.farms.map((f) => (
                  <li key={f.id} className="ais-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link to={`/farms/${f.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                          {f.name}
                        </Link>
                        <p className="font-mono text-xs text-ink-500">{f.id} · {f.parcelRef}</p>
                      </div>
                      <StatusBadge status={f.status} />
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      <ReadOnlyField label="Size" value={formatHa(f.sizeHa)} />
                      <ReadOnlyField label="Tenure" value={statusLabel(f.tenure)} />
                      <ReadOnlyField label="Activity" value={farmActivities(f)} className="col-span-2" />
                    </dl>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------- loans */}
      {tab === 'loans' && (
        <div className="space-y-3">
          {linked.loans.length === 0 ? (
            <div className="ais-card"><EmptyState title="No loan applications on file" /></div>
          ) : (
            linked.loans.map((l) => (
              <section key={l.id} className="ais-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{l.purpose}</p>
                    <p className="font-mono text-xs text-ink-500">{l.id} · submitted {formatDate(l.submittedOn)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink-900">{formatScr(l.amountScr)}</span>
                    <StatusBadge status={l.status} />
                  </div>
                </div>
                <div className="mt-3 border-t border-ink-100 pt-3">
                  <StageTracker stages={l.stageInstances} actorNames={actorNames} />
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {/* ----------------------------------------------------- laboratory */}
      {tab === 'lab' && (
        <div className="space-y-3">
          {linked.samples.length === 0 ? (
            <div className="ais-card"><EmptyState title="No laboratory samples on file" /></div>
          ) : (
            linked.samples.map((s) => (
              <section key={s.id} className="ais-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold capitalize text-ink-900">{s.type} sample</p>
                    <p className="font-mono text-xs text-ink-500">
                      {s.id} · farm {s.farmId} · requested {formatDate(s.requestedOn)}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                {s.results.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {s.results.map((r) => (
                      <li key={r.parameter} className="rounded-md border border-ink-200 px-2 py-1 text-xs">
                        <span className="text-ink-600">{r.parameter}</span>{' '}
                        <span className="font-semibold text-ink-900">{r.value}{r.unit && ` ${r.unit}`}</span>{' '}
                        <StatusBadge status={r.flag} />
                      </li>
                    ))}
                  </ul>
                )}
                {s.interpretation && <p className="mt-2 text-sm text-ink-700">{s.interpretation}</p>}
              </section>
            ))
          )}
        </div>
      )}

      {/* ------------------------------------------ livestock & surveillance */}
      {tab === 'livestock' && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          <section>
            <h2 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              Livestock service visits
              <ReqBadge refs="vii.4" screen="S02" />
            </h2>
            {linked.visits.length === 0 ? (
              <div className="ais-card"><EmptyState title="No visits recorded" /></div>
            ) : (
              <ul className="space-y-2">
                {linked.visits.map((v) => (
                  <li key={v.id} className="ais-card p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium capitalize text-ink-900">{v.type} visit · {v.species}</span>
                      <StatusBadge status={v.status} />
                    </div>
                    <p className="font-mono text-xs text-ink-500">{v.id} · {formatDate(v.visitedOn ?? v.scheduledOn)}</p>
                    {v.findings && <p className="mt-1 text-sm text-ink-600">{v.findings}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              Surveillance cases
              <ReqBadge refs="viii.4" screen="S02" />
            </h2>
            {linked.cases.length === 0 ? (
              <div className="ais-card"><EmptyState title="No cases recorded" /></div>
            ) : (
              <ul className="space-y-2">
                {linked.cases.map((c) => (
                  <li key={c.id} className="ais-card p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink-900">{c.suspectedDisease}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="font-mono text-xs text-ink-500">{c.id} · reported {formatDate(c.reportedOn)}</p>
                    {c.linkedSampleId && (
                      <p className="mt-1 text-xs text-ink-600">
                        Linked laboratory submission <span className="font-mono">{c.linkedSampleId}</span>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* ------------------------------------------------- land and leases */}
      {tab === 'land' && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ink-900">Leases</h2>
            {linked.leases.length === 0 ? (
              <div className="ais-card"><EmptyState title="No leases recorded" /></div>
            ) : (
              <ul className="space-y-2">
                {linked.leases.map((l) => (
                  <li key={l.id} className="ais-card p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs text-ink-600">{l.id}</span>
                      <StatusBadge status={l.status} />
                    </div>
                    <p className="mt-1 text-sm text-ink-900">Parcel {l.parcelRef} · {formatHa(l.areaHa)}</p>
                    <p className="text-xs text-ink-600">
                      {formatDate(l.startDate)} – {formatDate(l.endDate)} · {formatScr(l.annualRentScr)}/year
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ink-900">Land applications</h2>
            {linked.landApps.length === 0 ? (
              <div className="ais-card"><EmptyState title="No land applications on file" /></div>
            ) : (
              <ul className="space-y-2">
                {linked.landApps.map((a) => (
                  <li key={a.id} className="ais-card p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink-900">{a.purpose}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="font-mono text-xs text-ink-500">
                      {a.id} · {a.parcelRef} · {formatHa(a.requestedAreaHa)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* ---------------------------------------------------- inspections */}
      {tab === 'field' && (
        <div className="space-y-2">
          {linked.inspections.length === 0 ? (
            <div className="ais-card"><EmptyState title="No inspections recorded" /></div>
          ) : (
            linked.inspections.map((i) => (
              <section key={i.id} className="ais-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium capitalize text-ink-900">{i.type.replace(/-/g, ' ')}</span>
                  <div className="flex items-center gap-2">
                    {i.capturedOffline && <SimChip label="captured offline" />}
                    <StatusBadge status={i.outcome} />
                  </div>
                </div>
                <p className="font-mono text-xs text-ink-500">
                  {i.id} · {formatDate(i.completedOn ?? i.scheduledOn)} · {i.photos.length} photo
                  {i.photos.length === 1 ? '' : 's'}
                </p>
                {i.findings && <p className="mt-1 text-sm text-ink-600">{i.findings}</p>}
              </section>
            ))
          )}
        </div>
      )}

      {/* ------------------------------------------------------ documents */}
      {tab === 'documents' && (
        <div className="space-y-2">
          {linked.documents.length === 0 ? (
            <div className="ais-card"><EmptyState title="No digitized documents indexed against this client" /></div>
          ) : (
            linked.documents.map((d) => (
              <section key={d.id} className="ais-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink-900">{d.title}</span>
                  <div className="flex items-center gap-2">
                    <SimChip label="scan placeholder" />
                    <StatusBadge status={d.validation} />
                  </div>
                </div>
                <p className="font-mono text-xs text-ink-500">
                  {d.id} · {d.category} · {d.pages} pages · original {formatDate(d.originalDate)}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1">
                  {d.tags.map((t) => (
                    <li key={t} className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-600">
                      {t}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      )}

      {/* -------------------------------------------------- change history */}
      {tab === 'history' && (
        <section className="ais-card p-4">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
            Change history
            <ReqBadge refs="ii.4" screen="S02" />
          </h2>
          <Timeline events={client.history} />
        </section>
      )}

      {/* ------------------------------------------------------ edit modal */}
      <EditClientDialog
        open={editOpen}
        client={client}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false)
          toast({ tone: 'success', title: 'Profile updated', body: 'Changes recorded in the change history.' })
        }}
      />

      {/* ----------------------------------------------------- merge modal */}
      <Modal
        open={Boolean(mergeTarget)}
        onClose={() => setMergeTarget(null)}
        title="Merge duplicate registration"
        tone="warning"
        size="lg"
        description="Review both records before merging. The retired record is retained, not deleted."
        footer={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => setMergeTarget(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="ais-btn-primary"
              onClick={() => mergeTarget && doMerge(mergeTarget)}
            >
              Merge into {client.id}
            </button>
          </>
        }
      >
        {mergeTarget && (
          <div className="space-y-4">
            {/* Merging in the wrong direction would retire the better record,
                so say so plainly before the officer commits. */}
            {recommendSurvivor(client, mergeTarget.client).primary.id !== client.id && (
              <div className="rounded-lg border border-danger-300 bg-danger-50 p-3">
                <p className="text-sm font-semibold text-danger-900">
                  This merge runs against the recommended direction
                </p>
                <p className="mt-1 text-sm text-danger-800">
                  {clientName(mergeTarget.client)} ({mergeTarget.client.id}) is the stronger record —
                  it is {mergeTarget.client.seyIdVerified ? 'SeyID verified and ' : ''}
                  {mergeTarget.client.registeredVia === 'migrated' ? 'migrated' : 'captured directly'}
                  , registered {formatDate(mergeTarget.client.registeredOn)}. Merging here would
                  retire it into the record you are viewing.
                </p>
                <Link
                  to={`/clients/${mergeTarget.client.id}`}
                  className="ais-btn-secondary mt-3 px-3 py-1.5 text-xs"
                  onClick={() => setMergeTarget(null)}
                >
                  Open {mergeTarget.client.id} and merge the other way
                </Link>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <MergeColumn title="Surviving record" client={client} tone="keep" />
              <MergeColumn title="Record to retire" client={mergeTarget.client} tone="retire" />
            </div>
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
              <p className="text-sm font-semibold text-ink-900">What the merge does</p>
              <ul className="mt-1.5 space-y-1 text-sm text-ink-700">
                <li>
                  · Reassigns every farm, loan, laboratory sample, livestock visit, surveillance case,
                  lease, land application, inspection, vendor registration and document from{' '}
                  <span className="font-mono">{mergeTarget.client.id}</span> to{' '}
                  <span className="font-mono">{client.id}</span>.
                </li>
                <li>· Marks the retired record as <em>merged</em> and points it at the survivor, so old references keep resolving.</li>
                <li>· Writes the merge to the change history and the append-only audit log.</li>
              </ul>
            </div>
          </div>
        )}
      </Modal>

      {/* Navigating away after merging a record you were viewing */}
      {client.status === 'merged' && mergedInto && (
        <div className="mt-5">
          <button
            type="button"
            className="ais-btn-secondary"
            onClick={() => navigate(`/clients/${mergedInto.id}`)}
          >
            Open the surviving record
          </button>
        </div>
      )}
    </div>
  )
}

function MergeColumn({
  title, client, tone,
}: {
  title: string
  client: Client
  tone: 'keep' | 'retire'
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        tone === 'keep' ? 'border-brand-300 bg-brand-50' : 'border-ink-300 bg-white'
      }`}
    >
      <p className={`text-xs font-bold uppercase tracking-wide ${tone === 'keep' ? 'text-brand-700' : 'text-ink-500'}`}>
        {title}
      </p>
      <p className="mt-1 text-sm font-semibold text-ink-900">{clientName(client)}</p>
      <dl className="mt-2 space-y-1 text-xs">
        {[
          ['Client ID', client.id],
          ['NIN', client.nin],
          ['Mobile', client.phone],
          ['Email', client.email || '—'],
          ['Address', client.address],
          ['Registered', `${formatDate(client.registeredOn)} (${client.registeredVia})`],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-20 shrink-0 text-ink-500">{k}</dt>
            <dd className="min-w-0 flex-1 break-words text-ink-800">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Edit dialog — records a change event per altered field (ii.4)
 * ------------------------------------------------------------------ */

function EditClientDialog({
  open, client, onClose, onSaved,
}: {
  open: boolean
  client: Client
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useDispatch()
  const { user } = useAuth()
  const [form, setForm] = useState({
    phone: client.phone,
    email: client.email,
    district: client.district,
    address: client.address,
    notes: client.notes ?? '',
    status: client.status,
  })

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const phoneError = form.phone && !isValidPhone(form.phone) ? 'Expected +248 2 000 0xx.' : undefined
  const emailError = form.email && !isValidEmail(form.email) ? 'Enter a valid email address.' : undefined

  const save = () => {
    if (!user || phoneError || emailError) return

    const now = new Date().toISOString()
    const changes: ChangeEvent[] = []
    const patch: Partial<Client> = {}

    const track = (field: keyof typeof form, label: string) => {
      const before = String(client[field as keyof Client] ?? '')
      const after = String(form[field])
      if (before === after) return
      changes.push({
        id: localId('CH'), at: now, actorUserId: user.id, actorName: user.fullName,
        action: `${label} updated`, field: label.toLowerCase(), from: before || '(empty)', to: after || '(empty)',
      })
      Object.assign(patch, { [field]: after })
    }

    track('phone', 'Mobile')
    track('email', 'Email')
    track('district', 'District')
    track('address', 'Address')
    track('notes', 'Notes')
    track('status', 'Status')

    if (!changes.length) {
      onClose()
      return
    }

    // One dispatch per change keeps each entry independently attributable.
    changes.forEach((change, i) => {
      dispatch({
        type: 'client/update',
        id: client.id,
        patch: i === changes.length - 1 ? patch : {},
        change,
        ...(i === 0
          ? {
              audit: {
                actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
                action: 'client.updated', entityType: 'client', entityId: client.id,
                detail: `Profile updated — ${changes.map((c) => c.field).join(', ')}`,
              },
            }
          : {}),
      })
    })

    onSaved()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit client profile"
      size="md"
      description="Every altered field is written to the change history with the officer's name and a timestamp."
      footer={
        <>
          <button type="button" className="ais-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="ais-btn-primary" onClick={save} disabled={Boolean(phoneError || emailError)}>
            Save changes
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-3 text-sm text-ink-600">
          Name, NIN and date of birth are identity fields and are not editable here — they are
          corrected through a SeyID re-verification, which is out of scope for this prototype.
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Mobile" value={form.phone} onChange={(e) => set('phone', e.target.value)} error={phoneError} />
          <TextField label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={emailError} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="District" value={form.district} onChange={(e) => set('district', e.target.value as District)}>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </SelectField>
          <SelectField label="Status" value={form.status} onChange={(e) => set('status', e.target.value as Client['status'])}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </SelectField>
        </div>
        <TextField label="Address" value={form.address} onChange={(e) => set('address', e.target.value)} />
        <TextAreaField label="Notes" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
    </Modal>
  )
}
