import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { EmptyState } from '../../components/EmptyState'
import { SelectField, TextAreaField } from '../../components/Field'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { StatusBadge } from '../../components/StatusBadge'
import { LAB_PANELS, SAMPLE_LIFECYCLE, SAMPLE_PURPOSES, SAMPLE_TYPE_LABELS } from '../../lib/labPanels'
import { DEMO_TODAY, clientName, formatHa, localId, nextSampleId } from '../../lib/format'
import { SAMPLE_TYPES } from '../../lib/types'
import type { Sample, SampleType } from '../../lib/types'

/**
 * S06 — sampling request (vi.1).
 *
 * The same form serves a farmer submitting online and an officer capturing a
 * request at the counter; the channel is recorded on the sample.
 */
export function SampleRequest() {
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const isFarmer = role === 'farmer'
  const [clientId, setClientId] = useState(user?.clientId ?? '')
  const [farmId, setFarmId] = useState('')
  const [type, setType] = useState<SampleType>('soil')
  const [purpose, setPurpose] = useState<string>(SAMPLE_PURPOSES[0])
  const [notes, setNotes] = useState('')

  const client = db.clients.find((c) => c.id === clientId)
  const farms = useMemo(
    () => db.farms.filter((f) => f.clientId === clientId && f.status === 'registered'),
    [db.farms, clientId],
  )
  const farm = farms.find((f) => f.id === farmId) ?? farms[0]

  const eligibleClients = useMemo(
    () => db.clients.filter((c) => c.status !== 'merged' && db.farms.some((f) => f.clientId === c.id)),
    [db.clients, db.farms],
  )

  if (isFarmer && !client) {
    return (
      <div className="ais-card">
        <EmptyState
          title="No client record linked to this account"
          action={<Link to="/portal" className="ais-btn-secondary">Back to my holding</Link>}
        />
      </div>
    )
  }

  const canSubmit = Boolean(client && farm)

  const submit = () => {
    if (!user || !client || !farm) return
    const id = nextSampleId(db.samples.map((s) => s.id))
    const now = new Date().toISOString()

    const sample: Sample = {
      id,
      type,
      clientId: client.id,
      farmId: farm.id,
      requestedOn: DEMO_TODAY.toISOString().slice(0, 10),
      requestedVia: isFarmer ? 'online' : 'back-office',
      requestedByUserId: isFarmer ? 'SELF' : user.id,
      status: 'requested',
      purpose: notes.trim() ? `${purpose} — ${notes.trim()}` : purpose,
      results: [],
      history: [
        {
          id: localId('SH'),
          at: now,
          actorUserId: isFarmer ? 'SELF' : user.id,
          actorName: isFarmer ? clientName(client) : user.fullName,
          action: isFarmer
            ? 'Sampling request submitted via farmer portal'
            : 'Sampling request registered at the district office',
          note: `${SAMPLE_TYPE_LABELS[type]} sample for ${farm.name}.`,
        },
      ],
    }

    dispatch({
      type: 'sample/create',
      sample,
      audit: {
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'sample.requested',
        entityType: 'sample',
        entityId: id,
        detail: `${SAMPLE_TYPE_LABELS[type]} sampling requested for ${farm.name} (${farm.id})`,
      },
    })

    toast({
      tone: 'success',
      title: 'Sampling request submitted',
      body: `${id} queued for collection.`,
    })
    navigate(`/lab/${id}`)
  }

  return (
    <div className="max-w-3xl pb-6">
      <PageHeader
        screen="S06"
        title="Request a sample analysis"
        description="Soil, water, plant and compost analysis. The request is linked to your holding, so results attach to the right farm automatically."
        refs={['vi.1']}
        actions={<Link to={isFarmer ? '/portal' : '/lab'} className="ais-btn-secondary">Cancel</Link>}
      />

      <div className="space-y-5">
        <section className="ais-card p-4">
          <h2 className="text-sm font-semibold text-ink-900">Applicant and holding</h2>

          {!isFarmer && (
            <div className="mt-3">
              <SelectField
                label="Applicant"
                required
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value)
                  setFarmId('')
                }}
              >
                <option value="">Select a client…</option>
                {eligibleClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {clientName(c)} · {c.id}
                  </option>
                ))}
              </SelectField>
            </div>
          )}

          {client && (
            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
              <p className="text-sm font-semibold text-ink-900">{clientName(client)}</p>
              <p className="font-mono text-xs text-ink-600">{client.id} · {client.nin}</p>
            </div>
          )}

          {farms.length > 0 ? (
            <div className="mt-4">
              <SelectField
                label="Holding to sample"
                required
                value={farm?.id ?? ''}
                onChange={(e) => setFarmId(e.target.value)}
                badge={<ReqBadge refs="vi.6" screen="S06" />}
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} · {f.id} · {formatHa(f.sizeHa)}
                  </option>
                ))}
              </SelectField>
            </div>
          ) : (
            clientId && (
              <p className="mt-3 rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-sm text-warn-800">
                This client has no registered holding to sample.
              </p>
            )
          )}
        </section>

        <section className="ais-card p-4">
          <h2 className="text-sm font-semibold text-ink-900">Analysis requested</h2>

          <fieldset className="mt-3">
            <legend className="ais-label mb-1.5">Sample type</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {SAMPLE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  aria-pressed={type === t}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    type === t ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-brand-300'
                  }`}
                >
                  <span className="block text-sm font-semibold text-ink-900">
                    {SAMPLE_TYPE_LABELS[t]}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-600">
                    {LAB_PANELS[t].length} parameters · {LAB_PANELS[t].slice(0, 3).map((p) => p.parameter).join(', ')}
                    {LAB_PANELS[t].length > 3 ? '…' : ''}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-4">
            <SelectField label="Purpose" required value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              {SAMPLE_PURPOSES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </SelectField>
          </div>

          <div className="mt-4">
            <TextAreaField
              label="Additional detail"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Banana block on the upper terrace showing yellowing on older leaves."
            />
          </div>
        </section>

        <section className="ais-card p-4">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
            What happens next
            <ReqBadge refs={['vi.2', 'vi.8']} screen="S06" />
          </h2>
          <ol className="space-y-2">
            {SAMPLE_LIFECYCLE.map((s, i) => (
              <li key={s.status} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-600">
                  {i + 1}
                </span>
                <span className="text-sm">
                  <span className="font-medium text-ink-900">{s.label}</span>
                  <span className="block text-xs text-ink-500">{s.actor}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t border-ink-100 pt-3 text-sm text-ink-600">
            You are notified by SMS and email as soon as the results are validated, and the full
            report is available in your portal.
          </p>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="ais-btn-primary" onClick={submit} disabled={!canSubmit}>
            Submit request
          </button>
          <Link to={isFarmer ? '/portal' : '/lab'} className="ais-btn-secondary">Cancel</Link>
          <StatusBadge status="requested" label="Will be created as: Requested" />
        </div>
      </div>
    </div>
  )
}
