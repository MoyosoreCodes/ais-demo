import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StatusBadge } from '../../components/StatusBadge'
import { StageTracker } from '../../components/StageTracker'
import { MapView } from '../../components/MapPicker'
import { EmptyState } from '../../components/EmptyState'
import {
  farmActivities, formatDate, formatDateTime, formatHa, formatScr,
} from '../../lib/format'
import { statusLabel } from '../../lib/workflow'

/**
 * S01 — farmer self-service home (i.4; touchpoints of v.4, vi.8, xiii.1).
 *
 * Everything on this screen is resolved from the signed-in user's Client ID,
 * which is the visible proof of the "entered once, reused everywhere" claim.
 */
export function FarmerPortal() {
  const { user } = useAuth()
  const db = useDb()
  const dispatch = useDispatch()

  const client = db.clients.find((c) => c.id === user?.clientId)

  const mine = useMemo(() => {
    const id = client?.id
    if (!id) {
      return {
        farms: [], loans: [], samples: [], notifications: [], cases: [], leases: [], inspections: [],
      }
    }
    return {
      farms: db.farms.filter((f) => f.clientId === id),
      loans: db.loans.filter((l) => l.clientId === id),
      samples: db.samples.filter((s) => s.clientId === id),
      notifications: db.notifications.filter((n) => n.recipientClientId === id),
      cases: db.surveillanceCases.filter((s) => s.clientId === id),
      leases: db.leases.filter((l) => l.clientId === id),
      inspections: db.inspections.filter((i) => i.clientId === id),
    }
  }, [db, client?.id])

  const actorNames = useMemo(
    () => Object.fromEntries(db.users.map((u) => [u.id, u.fullName])),
    [db.users],
  )

  if (!client) {
    return (
      <div className="ais-card">
        <EmptyState
          title="No client record linked to this account"
          body="This portal account is not yet linked to a client record in the registry. An agriculture officer can link it from the client registry."
        />
      </div>
    )
  }

  const activeLoan = mine.loans.find((l) => !['closed', 'rejected', 'withdrawn'].includes(l.status)) ?? mine.loans[0]
  const readySamples = mine.samples.filter((s) => s.status === 'completed')
  const unread = mine.notifications.filter((n) => !n.read)

  return (
    <div className="pb-6">
      <PageHeader
        screen="S01"
        title={`Good day, ${client.firstName}`}
        description="Your holding, applications and results in one place. Every record below is linked to your single client record — you never re-enter these details."
        refs={['i.4', 'ii.2']}
        actions={
          <>
            {unread.length > 0 && (
              <button
                type="button"
                className="ais-btn-secondary"
                onClick={() => dispatch({ type: 'notification/readAll', forClientId: client.id })}
              >
                Mark all as read
              </button>
            )}
            {mine.farms.length > 0 && (
              <>
                <Link to="/surveillance/report" className="ais-btn-secondary">
                  Report a sick animal
                  <ReqBadge refs="viii.1" screen="S01" />
                </Link>
                <Link to="/lab/request" className="ais-btn-secondary">
                  Request a sample analysis
                  <ReqBadge refs="vi.1" screen="S01" />
                </Link>
                <Link to="/loans/apply" className="ais-btn-primary">
                  Apply for a loan
                  <ReqBadge refs="v.1" screen="S01" />
                </Link>
              </>
            )}
          </>
        }
      />

      {/* ------------------------------------------------------- identity */}
      <section className="ais-card mb-5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Client ID</dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold text-ink-900">{client.id}</dd>
            </div>
            <div>
              <dt className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">
                NIN <ReqBadge refs="ii.3" screen="S01" />
              </dt>
              <dd className="mt-0.5 font-mono text-sm text-ink-900">{client.nin}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">District</dt>
              <dd className="mt-0.5 text-sm text-ink-900">{client.district}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">Mobile</dt>
              <dd className="mt-0.5 text-sm text-ink-900">{client.phone}</dd>
            </div>
          </dl>
          {client.seyIdVerified && (
            <span className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Verified via SeyID
              <SimChip />
            </span>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------- KPIs */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Registered holdings" value={String(mine.farms.length)} hint={mine.farms.map((f) => f.name).join(', ') || '—'} />
        <Kpi
          label="Loan application"
          value={activeLoan ? statusLabel(activeLoan.status) : 'None'}
          hint={activeLoan ? `${activeLoan.id} · ${formatScr(activeLoan.amountScr)}` : 'No application on file'}
          refs={['v.4']}
        />
        <Kpi
          label="Laboratory results ready"
          value={String(readySamples.length)}
          hint={readySamples[0] ? `Latest ${readySamples[0].id} · ${formatDate(readySamples[0].completedOn)}` : '—'}
          refs={['vi.8']}
        />
        <Kpi label="Unread notifications" value={String(unread.length)} hint={`${mine.notifications.length} in total`} refs={['xiii.1']} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.5fr),minmax(0,1fr)]">
        <div className="space-y-5">
          {/* ------------------------------------------------------ farms */}
          <section className="ais-card p-4">
            <h2 className="text-sm font-semibold text-ink-900">My holdings</h2>
            {mine.farms.length === 0 ? (
              <p className="mt-2 text-sm text-ink-600">
                No farm is registered against your record yet. An agriculture officer registers your
                holding at the district office or during a field visit.
              </p>
            ) : (
              <div className="mt-3 space-y-4">
                {mine.farms.map((f) => (
                  <div key={f.id} className="rounded-lg border border-ink-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{f.name}</p>
                        <p className="font-mono text-xs text-ink-500">{f.id} · parcel {f.parcelRef}</p>
                      </div>
                      <StatusBadge status={f.status} />
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-xs text-ink-500">Size</dt>
                        <dd className="text-ink-900">{formatHa(f.sizeHa)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink-500">District</dt>
                        <dd className="text-ink-900">{f.district}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink-500">Tenure</dt>
                        <dd className="text-ink-900">{statusLabel(f.tenure)}</dd>
                      </div>
                      <div className="col-span-2 sm:col-span-3">
                        <dt className="text-xs text-ink-500">Activity</dt>
                        <dd className="text-ink-900">{farmActivities(f)}</dd>
                      </div>
                    </dl>
                    <div className="mt-3">
                      <MapView
                        markers={[{ id: f.id, lat: f.lat, lng: f.lng, label: f.name, detail: `${f.parcelRef} · ${formatHa(f.sizeHa)}` }]}
                        center={{ lat: f.lat, lng: f.lng }}
                        zoom={15}
                        height={200}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ------------------------------------------------------ loans */}
          {activeLoan && (
            <section className="ais-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                  Loan application
                  <ReqBadge refs={['v.1', 'v.4']} screen="S01" />
                </h2>
                <StatusBadge status={activeLoan.status} />
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-ink-500">Reference</dt>
                  <dd className="font-mono text-ink-900">{activeLoan.id}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Amount</dt>
                  <dd className="font-semibold text-ink-900">{formatScr(activeLoan.amountScr)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Term</dt>
                  <dd className="text-ink-900">{activeLoan.termMonths} months</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Submitted</dt>
                  <dd className="text-ink-900">{formatDate(activeLoan.submittedOn)}</dd>
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <dt className="text-xs text-ink-500">Purpose</dt>
                  <dd className="text-ink-900">{activeLoan.purpose}</dd>
                </div>
              </dl>
              <div className="mt-4 border-t border-ink-100 pt-4">
                <StageTracker stages={activeLoan.stageInstances} actorNames={actorNames} />
              </div>
            </section>
          )}

          {/* ------------------------------------------- laboratory results */}
          <section className="ais-card p-4">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              Laboratory results
              <ReqBadge refs={['vi.6', 'vi.8']} screen="S01" />
            </h2>
            {mine.samples.length === 0 ? (
              <p className="mt-2 text-sm text-ink-600">No sampling requests on file.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {mine.samples.map((s) => (
                  <li key={s.id} className="rounded-lg border border-ink-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold capitalize text-ink-900">{s.type} sample</p>
                        <p className="font-mono text-xs text-ink-500">
                          {s.id} · requested {formatDate(s.requestedOn)}
                        </p>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>
                    {s.status === 'completed' && (
                      <>
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full min-w-[380px] text-sm">
                            <thead>
                              <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                                <th className="py-1.5 pr-3 font-semibold">Parameter</th>
                                <th className="py-1.5 pr-3 font-semibold">Result</th>
                                <th className="py-1.5 pr-3 font-semibold">Reference</th>
                                <th className="py-1.5 font-semibold">Flag</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.results.map((r) => (
                                <tr key={r.parameter} className="border-b border-ink-100 last:border-0">
                                  <td className="py-1.5 pr-3 text-ink-800">{r.parameter}</td>
                                  <td className="py-1.5 pr-3 font-medium text-ink-900">
                                    {r.value} {r.unit}
                                  </td>
                                  <td className="py-1.5 pr-3 text-ink-500">{r.referenceRange}</td>
                                  <td className="py-1.5">
                                    <StatusBadge status={r.flag} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {s.interpretation && (
                          <p className="mt-2 text-sm text-ink-700">
                            <strong className="text-ink-900">Interpretation. </strong>
                            {s.interpretation}
                          </p>
                        )}
                        {s.recommendation && (
                          <p className="mt-1 text-sm text-ink-700">
                            <strong className="text-ink-900">Recommendation. </strong>
                            {s.recommendation}
                          </p>
                        )}
                        {s.notifiedOn && (
                          <p className="mt-2 inline-flex flex-wrap items-center gap-2 text-xs text-ink-500">
                            You were notified on {formatDate(s.notifiedOn)} by SMS and email
                            <SimChip />
                          </p>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ------------------------------------------------------- sidebar */}
        <div className="space-y-5">
          <section className="ais-card p-4">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              Notifications
              <ReqBadge refs={['xiii.1', 'xiii.2', 'xiii.3', 'xiii.4']} screen="S01" />
            </h2>
            {mine.notifications.length === 0 ? (
              <p className="mt-2 text-sm text-ink-600">Nothing yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {mine.notifications.slice(0, 8).map((n) => (
                  <li
                    key={n.id}
                    className={`rounded-lg border p-3 ${n.read ? 'border-ink-200' : 'border-brand-200 bg-brand-50/50'}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-600">
                        {n.channel}
                      </span>
                      {n.simulated && <SimChip />}
                      {!n.read && <span className="ml-auto h-2 w-2 rounded-full bg-brand-600" aria-label="Unread" />}
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-ink-900">{n.subject}</p>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-ink-600">{n.body}</p>
                    <p className="mt-1 text-xs text-ink-400">{formatDateTime(n.sentOn)}</p>
                    {!n.read && (
                      <button
                        type="button"
                        className="mt-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
                        onClick={() => dispatch({ type: 'notification/read', id: n.id })}
                      >
                        Mark as read
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {mine.cases.length > 0 && (
            <section className="ais-card p-4">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Animal health cases
                <ReqBadge refs={['viii.1', 'viii.4']} screen="S01" />
              </h2>
              <ul className="mt-3 space-y-2">
                {mine.cases.map((c) => (
                  <li key={c.id} className="rounded-lg border border-ink-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink-900">{c.suspectedDisease}</p>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="font-mono text-xs text-ink-500">{c.id} · reported {formatDate(c.reportedOn)}</p>
                    <p className="mt-1 text-sm text-ink-600">
                      {c.affectedCount} affected · {c.mortalityCount} mortality
                    </p>
                    {c.linkedSampleId && (
                      <p className="mt-1 text-xs text-ink-500">
                        Laboratory submission <span className="font-mono">{c.linkedSampleId}</span> linked.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {mine.leases.length > 0 && (
            <section className="ais-card p-4">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Leases
                <ReqBadge refs={['iv.5', 'iv.6']} screen="S01" />
              </h2>
              <ul className="mt-3 space-y-2">
                {mine.leases.map((l) => (
                  <li key={l.id} className="rounded-lg border border-ink-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs text-ink-500">{l.id}</span>
                      <StatusBadge status={l.status} />
                    </div>
                    <p className="mt-1 text-ink-900">Parcel {l.parcelRef} · {formatHa(l.areaHa)}</p>
                    <p className="text-xs text-ink-600">
                      {formatDate(l.startDate)} – {formatDate(l.endDate)} · {formatScr(l.annualRentScr)}/year
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      Payment <StatusBadge status={l.paymentStatus} className="ml-1" /> · next due{' '}
                      {formatDate(l.nextPaymentDue)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {mine.inspections.length > 0 && (
            <section className="ais-card p-4">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Inspections
                <ReqBadge refs={['x.5']} screen="S01" />
              </h2>
              <ul className="mt-3 space-y-2">
                {mine.inspections.map((i) => (
                  <li key={i.id} className="rounded-lg border border-ink-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="capitalize text-ink-900">{i.type.replace(/-/g, ' ')}</span>
                      <StatusBadge status={i.outcome} />
                    </div>
                    <p className="font-mono text-xs text-ink-500">{i.id} · {formatDate(i.completedOn ?? i.scheduledOn)}</p>
                    {i.findings && <p className="mt-1 text-sm text-ink-600">{i.findings}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Kpi({
  label, value, hint, refs,
}: {
  label: string
  value: string
  hint?: string
  refs?: string[]
}) {
  return (
    <div className="ais-card p-4">
      <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">
        {label}
        {refs && <ReqBadge refs={refs} screen="S01" />}
      </p>
      <p className="mt-1 text-2xl font-semibold text-ink-900">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-ink-500">{hint}</p>}
    </div>
  )
}
