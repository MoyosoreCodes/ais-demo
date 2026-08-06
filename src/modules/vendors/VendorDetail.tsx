import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { EmptyState } from '../../components/EmptyState'
import { ReadOnlyField } from '../../components/Field'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { StatusBadge } from '../../components/StatusBadge'
import { Timeline } from '../../components/Timeline'
import { DEMO_TODAY, clientName, formatDate, formatScr, localId } from '../../lib/format'
import { can } from '../../lib/rbac'
import { statusLabel } from '../../lib/workflow'
import type { Vendor } from '../../lib/types'

const daysUntil = (date: string): number => differenceInCalendarDays(parseISO(date), DEMO_TODAY)

/** S09 — vendor profile with licence status tracking (ix.2, ix.3, ix.4). */
export function VendorDetail() {
  const { id } = useParams<{ id: string }>()
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()
  const [statusOpen, setStatusOpen] = useState(false)

  const vendor = db.vendors.find((v) => v.id === id)
  const client = db.clients.find((c) => c.id === vendor?.clientId)
  const stall = db.stalls.find((s) => s.id === vendor?.stallId)

  /** What else this person has with the department, when they are a farmer too. */
  const linked = useMemo(() => {
    if (!client) return null
    return {
      farms: db.farms.filter((f) => f.clientId === client.id),
      loans: db.loans.filter((l) => l.clientId === client.id),
      samples: db.samples.filter((s) => s.clientId === client.id),
    }
  }, [db, client])

  if (!vendor) {
    return (
      <div className="ais-card">
        <EmptyState
          title="Vendor not found"
          action={<Link to="/vendors" className="ais-btn-secondary">Back to the vendor registry</Link>}
        />
      </div>
    )
  }

  const expiry = daysUntil(vendor.expiresOn)
  const canEdit = can(role, 'vendors.edit')

  const setStatus = (status: Vendor['registrationStatus']) => {
    if (!user) return
    dispatch({
      type: 'vendor/update',
      id: vendor.id,
      patch: { registrationStatus: status },
      change: {
        id: localId('VN'), at: new Date().toISOString(), actorUserId: user.id, actorName: user.fullName,
        action: 'Registration status changed',
        field: 'registrationStatus', from: statusLabel(vendor.registrationStatus), to: statusLabel(status),
      },
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'vendor.status.changed', entityType: 'vendor', entityId: vendor.id,
        detail: `${vendor.tradeName} registration set to ${status}`,
      },
    })
    setStatusOpen(false)
    toast({ tone: 'success', title: 'Registration updated', body: statusLabel(status) })
  }

  const renew = () => {
    if (!user) return
    const expires = new Date(DEMO_TODAY)
    expires.setUTCFullYear(expires.getUTCFullYear() + 1)
    dispatch({
      type: 'vendor/update',
      id: vendor.id,
      patch: { registrationStatus: 'active', expiresOn: expires.toISOString().slice(0, 10) },
      change: {
        id: localId('VN'), at: new Date().toISOString(), actorUserId: user.id, actorName: user.fullName,
        action: 'Licence renewed for one year',
        field: 'expiresOn', from: vendor.expiresOn, to: expires.toISOString().slice(0, 10),
      },
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'vendor.licence.renewed', entityType: 'vendor', entityId: vendor.id,
        detail: `${vendor.tradeName} licence renewed to ${expires.toISOString().slice(0, 10)}`,
      },
    })
    toast({ tone: 'success', title: 'Licence renewed', body: 'Valid for a further twelve months.' })
  }

  return (
    <div className="pb-6">
      <PageHeader
        screen="S09"
        title={vendor.tradeName}
        description={`${vendor.fullName} · ${statusLabel(vendor.category)} · ${vendor.market}`}
        refs={['ix.2', 'ix.4']}
        actions={
          <>
            <Link to="/vendors" className="ais-btn-secondary">Back to registry</Link>
            {canEdit && (
              <>
                <button type="button" className="ais-btn-secondary" onClick={() => setStatusOpen(true)}>
                  Change status
                </button>
                {(expiry <= 60 || vendor.registrationStatus === 'expired') && (
                  <button type="button" className="ais-btn-primary" onClick={renew}>
                    Renew licence
                  </button>
                )}
              </>
            )}
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded bg-ink-100 px-2 py-1 font-mono text-xs font-semibold text-ink-700">{vendor.id}</span>
          <StatusBadge status={vendor.registrationStatus} />
          <span className={`text-xs font-medium ${expiry < 0 ? 'text-danger-600' : expiry <= 60 ? 'text-warn-600' : 'text-ink-500'}`}>
            {expiry < 0 ? `Licence expired ${Math.abs(expiry)} days ago` : `Licence expires in ${expiry} days`}
          </span>
          {stall && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800">
              Stall {stall.id} · {stall.section}
              <ReqBadge refs="ix.3" screen="S09" />
            </span>
          )}
          {client && (
            <Link
              to={`/clients/${client.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-0.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
            >
              {clientName(client)} · {client.id}
            </Link>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        <section className="ais-card p-4">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
            Vendor profile
            <ReqBadge refs="ix.2" screen="S09" />
          </h2>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
            <ReadOnlyField label="Vendor reference" value={<span className="font-mono">{vendor.id}</span>} />
            <ReadOnlyField label="Licence number" value={<span className="font-mono">{vendor.licenceNo}</span>} />
            <ReadOnlyField label="Trading as" value={vendor.tradeName} />
            <ReadOnlyField label="Vendor" value={vendor.fullName} />
            <ReadOnlyField label="Category" value={statusLabel(vendor.category)} />
            <ReadOnlyField label="Market" value={vendor.market} />
            <ReadOnlyField label="Mobile" value={vendor.phone} />
            <ReadOnlyField label="Email" value={vendor.email} />
            <ReadOnlyField label="Registered" value={formatDate(vendor.registeredOn)} />
            <ReadOnlyField label="Licence expires" value={formatDate(vendor.expiresOn)} />
          </dl>
        </section>

        <div className="space-y-5">
          <section className="ais-card p-4">
            <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              Stall allocation
              <ReqBadge refs="ix.3" screen="S09" />
            </h2>
            {stall ? (
              <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
                <ReadOnlyField label="Stall" value={<span className="font-mono font-semibold">{stall.id}</span>} />
                <ReadOnlyField label="Section" value={stall.section} />
                <ReadOnlyField label="Row and number" value={`${stall.row}${stall.number}`} />
                <ReadOnlyField label="Monthly fee" value={formatScr(stall.monthlyFeeScr)} />
                <ReadOnlyField label="Allocated" value={stall.allocatedOn ? formatDate(stall.allocatedOn) : '—'} className="col-span-2" />
              </dl>
            ) : (
              <p className="text-sm text-ink-500">
                No stall is allocated to this vendor. Allocate one from the stall board on the
                vendor registry.
              </p>
            )}
            <Link to="/vendors" className="ais-btn-secondary mt-3 px-3 py-1.5 text-xs">
              Open the stall board
            </Link>
          </section>

          {client && linked && (
            <section className="ais-card p-4">
              <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                Also on the client registry
                <ReqBadge refs="ii.5" screen="S09" />
              </h2>
              <p className="mb-3 text-xs text-ink-600">
                This vendor is the same person as client{' '}
                <span className="font-mono">{client.id}</span>, so their farming and market activity
                resolve together.
              </p>
              <ul className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Farms', n: linked.farms.length },
                  { label: 'Loans', n: linked.loans.length },
                  { label: 'Lab samples', n: linked.samples.length },
                ].map((row) => (
                  <li key={row.label} className="rounded-lg border border-ink-200 p-2.5 text-center">
                    <p className={`text-lg font-semibold ${row.n ? 'text-brand-700' : 'text-ink-400'}`}>{row.n}</p>
                    <p className="text-[11px] text-ink-500">{row.label}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <section className="ais-card mt-5 p-4">
        <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
          Registration history
          <ReqBadge refs="ix.4" screen="S09" />
        </h2>
        <Timeline events={vendor.history} />
      </section>

      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Change registration status"
        size="sm"
        description="Status changes are recorded on the vendor's history and in the audit log."
      >
        <ul className="space-y-2">
          {(['active', 'pending', 'suspended', 'expired'] as const).map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => setStatus(s)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  s === vendor.registrationStatus ? 'border-brand-400 bg-brand-50' : 'border-ink-200 hover:border-brand-300 hover:bg-brand-50/50'
                }`}
              >
                <span className="text-sm font-medium text-ink-900">{statusLabel(s)}</span>
                {s === vendor.registrationStatus && <span className="text-xs font-semibold text-brand-700">Current</span>}
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}
