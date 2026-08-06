import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { DocUploader } from '../../components/DocUploader'
import { SelectField, TextAreaField, TextField } from '../../components/Field'
import { MapPicker } from '../../components/MapPicker'
import type { LatLng } from '../../components/MapPicker'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StatusBadge } from '../../components/StatusBadge'
import { findFarmDuplicates } from '../../lib/duplicates'
import {
  DEMO_TODAY, clientName, formatCoords, formatDate, formatHa, localId, nextFarmId,
} from '../../lib/format'
import { statusLabel } from '../../lib/workflow'
import { DISTRICTS } from '../../lib/types'
import type { Crop, District, DocRef, Farm, Island, LivestockType } from '../../lib/types'

/** District centroids — the starting pin and the simulated-fix anchor. */
const DISTRICT_CENTRES: Record<District, LatLng & { island: Island }> = {
  'Anse Boileau': { lat: -4.7185, lng: 55.4872, island: 'Mahé' },
  'Baie Lazare': { lat: -4.7455, lng: 55.4905, island: 'Mahé' },
  'Grand Anse Mahé': { lat: -4.6775, lng: 55.464, island: 'Mahé' },
  'Anse Royale': { lat: -4.748, lng: 55.508, island: 'Mahé' },
  'Anse Aux Pins': { lat: -4.689, lng: 55.511, island: 'Mahé' },
  'Baie Ste Anne Praslin': { lat: -4.323, lng: 55.748, island: 'Praslin' },
  'La Digue': { lat: -4.358, lng: 55.834, island: 'La Digue' },
}

/**
 * S03 — farm registration (iii.1–iii.7). Mobile-priority.
 *
 * Dual-channel intake, a draggable OSM map pin with a simulated device fix,
 * metadata-driven intake fields, simulated document upload, an auto-generated
 * Farm ID, a two-way client link, and a duplicate check on parcel, GPS
 * proximity and owner.
 */
export function FarmRegistration() {
  const db = useDb()
  const dispatch = useDispatch()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const enabledFields = useMemo(() => db.intakeFields.filter((f) => f.enabled), [db.intakeFields])
  const isEnabled = (id: string) => enabledFields.some((f) => f.id === id)
  const fieldOptions = (id: string) => db.intakeFields.find((f) => f.id === id)?.options ?? []

  const [channel, setChannel] = useState<'back-office' | 'online'>('back-office')
  const [clientId, setClientId] = useState(params.get('client') ?? '')
  const [clientQuery, setClientQuery] = useState('')
  const [district, setDistrict] = useState<District>('Anse Boileau')
  const [pin, setPin] = useState<LatLng>(DISTRICT_CENTRES['Anse Boileau'])
  const [gpsCaptured, setGpsCaptured] = useState(false)
  const [documents, setDocuments] = useState<DocRef[]>([])
  const [dismissedDuplicates, setDismissedDuplicates] = useState(false)

  const [values, setValues] = useState<Record<string, string>>({
    name: '', parcelRef: '', sizeHa: '', tenure: 'leased-state',
    waterSource: 'rainwater', irrigation: 'none', organic: 'none', notes: '',
  })
  const [crops, setCrops] = useState<Crop[]>([])
  const [livestock, setLivestock] = useState<{ type: LivestockType; headcount: number }[]>([])

  const setValue = (id: string, v: string) => setValues((s) => ({ ...s, [id]: v }))

  const activeClients = useMemo(
    () => db.clients.filter((c) => c.status !== 'merged'),
    [db.clients],
  )
  const clientMatches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase()
    if (!q) return activeClients.slice(0, 6)
    return activeClients
      .filter((c) =>
        [c.id, c.nin, c.firstName, c.lastName, `${c.firstName} ${c.lastName}`, c.phone, c.district]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 8)
  }, [activeClients, clientQuery])

  const selectedClient = db.clients.find((c) => c.id === clientId)

  /* --- duplicate detection on parcel / GPS proximity / owner (iii.7) --- */
  const duplicates = useMemo(() => {
    if (!clientId && !values.parcelRef) return []
    return findFarmDuplicates(
      { clientId, parcelRef: values.parcelRef, lat: pin.lat, lng: pin.lng, name: values.name },
      db.farms,
    )
  }, [db.farms, clientId, values.parcelRef, values.name, pin])

  const blocking = duplicates.filter((d) => d.confidence === 'high')

  const farmId = useMemo(() => nextFarmId(db.farms.map((f) => f.id)), [db.farms])

  const canSave =
    Boolean(clientId) &&
    values.name.trim().length > 1 &&
    values.parcelRef.trim().length > 3 &&
    Number(values.sizeHa) > 0 &&
    (blocking.length === 0 || dismissedDuplicates)

  const changeDistrict = (d: District) => {
    setDistrict(d)
    setPin(DISTRICT_CENTRES[d])
    setGpsCaptured(false)
  }

  const toggleCrop = (c: Crop) =>
    setCrops((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))

  const toggleLivestock = (t: LivestockType) =>
    setLivestock((prev) =>
      prev.some((l) => l.type === t) ? prev.filter((l) => l.type !== t) : [...prev, { type: t, headcount: 0 }],
    )

  const setHeadcount = (t: LivestockType, n: number) =>
    setLivestock((prev) => prev.map((l) => (l.type === t ? { ...l, headcount: n } : l)))

  const save = () => {
    if (!user || !selectedClient || !canSave) return
    const now = new Date().toISOString()

    const farm: Farm = {
      id: farmId,
      clientId: selectedClient.id,
      name: values.name.trim(),
      district,
      island: DISTRICT_CENTRES[district].island,
      lat: pin.lat,
      lng: pin.lng,
      parcelRef: values.parcelRef.trim().toUpperCase(),
      sizeHa: Number(values.sizeHa),
      tenure: values.tenure as Farm['tenure'],
      crops,
      livestock: livestock.filter((l) => l.headcount > 0),
      waterSource: (isEnabled('waterSource') ? values.waterSource : 'none') as Farm['waterSource'],
      status: 'registered',
      registeredOn: DEMO_TODAY.toISOString().slice(0, 10),
      registeredVia: channel,
      documents,
      history: [
        {
          id: localId('CH'), at: now, actorUserId: user.id, actorName: user.fullName,
          action: channel === 'online' ? 'Farm registered (online submission)' : 'Farm registered (back-office intake)',
        },
        {
          id: localId('CH'), at: now, actorUserId: user.id, actorName: user.fullName,
          action: gpsCaptured ? 'GPS location captured from device fix (simulated)' : 'GPS location captured from map pin',
          field: 'gps', to: formatCoords(pin.lat, pin.lng),
        },
        ...(blocking.length && dismissedDuplicates
          ? [{
              id: localId('CH'), at: now, actorUserId: user.id, actorName: user.fullName,
              action: 'Duplicate warning overridden by officer',
              note: `Candidates dismissed: ${blocking.map((b) => b.farm.id).join(', ')}`,
            }]
          : []),
        ...(isEnabled('notes') && values.notes.trim()
          ? [{
              id: localId('CH'), at: now, actorUserId: user.id, actorName: user.fullName,
              action: 'Officer note recorded', note: values.notes.trim(),
            }]
          : []),
      ],
    }

    dispatch({
      type: 'farm/create',
      farm,
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'farm.created', entityType: 'farm', entityId: farm.id,
        detail: `Farm registered — ${farm.name}, ${formatHa(farm.sizeHa)}, ${farm.district} (client ${farm.clientId})`,
      },
    })

    toast({ tone: 'success', title: 'Farm registered', body: `${farm.name} created as ${farm.id}.` })
    navigate(`/farms/${farm.id}`)
  }

  return (
    <div className="max-w-4xl pb-6">
      <PageHeader
        screen="S03"
        title="Register a farm"
        description="Capture a holding against an existing client record. Designed for a field officer's phone as well as the district office."
        refs={['iii.1', 'iii.5']}
        actions={<Link to="/farms" className="ais-btn-secondary">Cancel</Link>}
      />

      <div className="space-y-5">
        {/* ------------------------------------------------------- channel */}
        <section className="ais-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-900">Intake channel</h2>
            <ReqBadge refs="iii.1" screen="S03" />
          </div>
          <p className="mt-0.5 text-xs text-ink-500">
            The same registration reaches the registry whether the farmer submits it online or an
            officer captures it — the channel is recorded on the record.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(
              [
                { id: 'back-office', label: 'Back-office intake', detail: 'Officer captures the holding at the district office or on a field visit.' },
                { id: 'online', label: 'Online submission', detail: 'Farmer submitted through the self-service portal; officer confirms and registers.' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setChannel(opt.id)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  channel === opt.id ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-brand-300'
                }`}
              >
                <span className="block text-sm font-semibold text-ink-900">{opt.label}</span>
                <span className="mt-0.5 block text-xs text-ink-600">{opt.detail}</span>
              </button>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------- client link */}
        <section className="ais-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-900">Farmer</h2>
            <ReqBadge refs="iii.6" screen="S03" />
          </div>
          <p className="mt-0.5 text-xs text-ink-500">
            The farm links to an existing client record by Client ID. Personal details are never
            re-keyed here.
          </p>

          {selectedClient ? (
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-brand-300 bg-brand-50 p-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">{clientName(selectedClient)}</p>
                <p className="font-mono text-xs text-ink-600">
                  {selectedClient.id} · {selectedClient.nin}
                </p>
                <p className="mt-0.5 text-xs text-ink-600">
                  {selectedClient.district}, {selectedClient.island} · {selectedClient.phone}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedClient.seyIdVerified && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                    SeyID verified <SimChip />
                  </span>
                )}
                <button type="button" className="ais-btn-secondary px-3 py-1.5 text-xs" onClick={() => setClientId('')}>
                  Change
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <TextField
                label="Find the client"
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                placeholder="Name, NIN, Client ID or mobile"
              />
              <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                {clientMatches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setClientId(c.id)
                        changeDistrict(c.district)
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-ink-200 px-3 py-2 text-left hover:border-brand-300 hover:bg-brand-50/60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink-900">{clientName(c)}</span>
                        <span className="block font-mono text-xs text-ink-500">{c.id} · {c.nin}</span>
                      </span>
                      <span className="shrink-0 text-xs text-ink-500">{c.district}</span>
                    </button>
                  </li>
                ))}
                {clientMatches.length === 0 && (
                  <li className="rounded-lg border border-dashed border-ink-300 p-3 text-sm text-ink-500">
                    No client matches that search.{' '}
                    <Link to="/clients/new" className="ais-link">Register a new client</Link> first.
                  </li>
                )}
              </ul>
            </div>
          )}
        </section>

        {/* ----------------------------------------------------- location */}
        <section className="ais-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-900">Holding location</h2>
            <ReqBadge refs="iii.2" screen="S03" />
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <SelectField label="District" required value={district} onChange={(e) => changeDistrict(e.target.value as District)}>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </SelectField>
            <TextField
              label="Parcel reference"
              required
              value={values.parcelRef}
              onChange={(e) => setValue('parcelRef', e.target.value)}
              placeholder="PR/AB/1042"
              badge={<ReqBadge refs="iii.7" screen="S03" />}
              hint="Checked against the registry for an existing registration."
            />
          </div>

          <div className="mt-4">
            <MapPicker
              value={pin}
              onChange={(p) => {
                setPin(p)
                setGpsCaptured(false)
              }}
              onLocated={() => setGpsCaptured(true)}
              locateNear={DISTRICT_CENTRES[district]}
              markers={db.farms
                .filter((f) => f.district === district)
                .slice(0, 40)
                .map((f) => ({
                  id: f.id, lat: f.lat, lng: f.lng, label: f.name,
                  detail: `${f.id} · ${f.parcelRef}`,
                  tone: duplicates.some((d) => d.farm.id === f.id) ? ('warning' as const) : ('muted' as const),
                }))}
              height={300}
              helpText="Drag the pin, tap the map, or take a simulated device fix. Existing holdings in this district are shown for context; a candidate duplicate is highlighted in amber."
            />
          </div>
        </section>

        {/* --------------------------------------------- duplicate warning */}
        {duplicates.length > 0 && (
          <section
            className={`rounded-lg border p-4 ${
              blocking.length ? 'border-danger-300 bg-danger-50' : 'border-warn-300 bg-warn-50'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <svg viewBox="0 0 20 20" className={`h-5 w-5 ${blocking.length ? 'text-danger-600' : 'text-warn-600'}`} fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10 3l7.5 13h-15z" strokeLinejoin="round" />
                <path d="M10 8v3.5M10 14h.01" strokeLinecap="round" />
              </svg>
              <h2 className={`text-sm font-semibold ${blocking.length ? 'text-danger-900' : 'text-warn-900'}`}>
                {blocking.length
                  ? 'This holding may already be registered'
                  : `${duplicates.length} nearby registration${duplicates.length > 1 ? 's' : ''} to check`}
              </h2>
              <ReqBadge refs="iii.7" screen="S03" />
            </div>

            <ul className="mt-3 space-y-2">
              {duplicates.map((m) => {
                const owner = db.clients.find((c) => c.id === m.farm.clientId)
                return (
                  <li key={m.farm.id} className="rounded-md border border-ink-200 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-900">{m.farm.name}</p>
                        <p className="font-mono text-xs text-ink-500">
                          {m.farm.id} · {m.farm.parcelRef} · registered {formatDate(m.farm.registeredOn)} (
                          {m.farm.registeredVia})
                        </p>
                        {owner && (
                          <p className="text-xs text-ink-600">
                            Owner {clientName(owner)} (<span className="font-mono">{owner.id}</span>)
                          </p>
                        )}
                        <ul className="mt-1.5 space-y-0.5 text-xs text-ink-600">
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
                        <Link to={`/farms/${m.farm.id}`} className="ais-btn-secondary px-3 py-1.5 text-xs">
                          Open existing farm
                        </Link>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            {blocking.length > 0 && (
              <label className="mt-3 flex items-start gap-2.5 text-sm text-danger-900">
                <input
                  type="checkbox"
                  checked={dismissedDuplicates}
                  onChange={(e) => setDismissedDuplicates(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-danger-300 text-danger-600 focus:ring-danger-600"
                />
                <span>
                  I have reviewed the existing registration and confirm this is a separate holding.
                  The override is recorded in the farm history and the audit log.
                </span>
              </label>
            )}
          </section>
        )}

        {/* ------------------------------------------- configurable intake */}
        <section className="ais-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-ink-900">Holding details</h2>
              <ReqBadge refs="iii.3" screen="S03" />
            </div>
            <span className="rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[11px] text-ink-600">
              {enabledFields.length} of {db.intakeFields.length} intake fields enabled
            </span>
          </div>
          <p className="mt-0.5 text-xs text-ink-500">
            This form is rendered from the intake configuration, not from fixed markup. An
            administrator enables or disables optional fields on the Administration screen and the
            form changes without a redeployment.
          </p>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <TextField label="Holding name" required value={values.name} onChange={(e) => setValue('name', e.target.value)} placeholder="Rivière Doux Farm" />
            <TextField
              label="Farm size" required type="number" min="0.01" step="0.01"
              value={values.sizeHa} onChange={(e) => setValue('sizeHa', e.target.value)}
              hint="Hectares." placeholder="1.6"
            />
            <SelectField label="Tenure" required value={values.tenure} onChange={(e) => setValue('tenure', e.target.value)}>
              {fieldOptions('tenure').map((o) => (
                <option key={o} value={o}>{statusLabel(o)}</option>
              ))}
            </SelectField>
            {isEnabled('waterSource') && (
              <SelectField label="Water source" value={values.waterSource} onChange={(e) => setValue('waterSource', e.target.value)}>
                {fieldOptions('waterSource').map((o) => (
                  <option key={o} value={o}>{statusLabel(o)}</option>
                ))}
              </SelectField>
            )}
            {isEnabled('irrigation') && (
              <SelectField label="Irrigation method" value={values.irrigation} onChange={(e) => setValue('irrigation', e.target.value)}>
                {fieldOptions('irrigation').map((o) => (
                  <option key={o} value={o}>{statusLabel(o)}</option>
                ))}
              </SelectField>
            )}
            {isEnabled('organic') && (
              <SelectField label="Organic certification" value={values.organic} onChange={(e) => setValue('organic', e.target.value)}>
                {fieldOptions('organic').map((o) => (
                  <option key={o} value={o}>{statusLabel(o)}</option>
                ))}
              </SelectField>
            )}
          </div>

          {isEnabled('crops') && (
            <fieldset className="mt-4">
              <legend className="ais-label mb-1.5">Crop activity</legend>
              <div className="flex flex-wrap gap-2">
                {(fieldOptions('crops') as Crop[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCrop(c)}
                    aria-pressed={crops.includes(c)}
                    className={`rounded-full border px-3 py-1.5 text-sm capitalize transition-colors ${
                      crops.includes(c)
                        ? 'border-brand-500 bg-brand-600 text-white'
                        : 'border-ink-300 bg-white text-ink-700 hover:border-brand-400'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {isEnabled('livestock') && (
            <fieldset className="mt-4">
              <legend className="ais-label mb-1.5">Livestock activity</legend>
              <div className="flex flex-wrap gap-2">
                {(fieldOptions('livestock') as LivestockType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleLivestock(t)}
                    aria-pressed={livestock.some((l) => l.type === t)}
                    className={`rounded-full border px-3 py-1.5 text-sm capitalize transition-colors ${
                      livestock.some((l) => l.type === t)
                        ? 'border-brand-500 bg-brand-600 text-white'
                        : 'border-ink-300 bg-white text-ink-700 hover:border-brand-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {livestock.length > 0 && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {livestock.map((l) => (
                    <TextField
                      key={l.type}
                      label={`${l.type.charAt(0).toUpperCase()}${l.type.slice(1)} head count`}
                      type="number"
                      min="0"
                      value={l.headcount || ''}
                      onChange={(e) => setHeadcount(l.type, Number(e.target.value))}
                    />
                  ))}
                </div>
              )}
            </fieldset>
          )}

          {isEnabled('notes') && (
            <div className="mt-4">
              <TextAreaField label="Officer notes" rows={2} value={values.notes} onChange={(e) => setValue('notes', e.target.value)} />
            </div>
          )}
        </section>

        {/* ------------------------------------------------------ documents */}
        <section className="ais-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-900">Supporting documents</h2>
            <ReqBadge refs="iii.4" screen="S03" />
          </div>
          <div className="mt-3">
            <DocUploader
              documents={documents}
              onAdd={(d) => setDocuments((prev) => [...prev, d])}
              onRemove={(id) => setDocuments((prev) => prev.filter((d) => d.id !== id))}
              uploadedBy={user?.id ?? 'SYSTEM'}
              label="Attachments"
              hint="Tenure evidence, site plans and identity documents. Each attachment carries a verification status that a supervisor confirms."
            />
          </div>
        </section>

        {/* -------------------------------------------------------- summary */}
        <section className="ais-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-900">Farm identification</h2>
            <ReqBadge refs="iii.5" screen="S03" />
          </div>
          <p className="mt-1 text-sm text-ink-600">
            A unique Farm ID is generated on save:
          </p>
          <p className="mt-2 inline-block rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 font-mono text-lg font-bold text-brand-800">
            {farmId}
          </p>
          <p className="mt-2 text-xs text-ink-500">
            Sequential within the registration year. The identifier is what links this holding to the
            client record, and to every loan, sample, visit, case and inspection that follows.
          </p>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="ais-btn-primary" onClick={save} disabled={!canSave}>
            Register farm
          </button>
          <Link to="/farms" className="ais-btn-secondary">Cancel</Link>
          {!clientId && <p className="text-sm text-ink-500">Select the farmer first.</p>}
          {blocking.length > 0 && !dismissedDuplicates && (
            <p className="text-sm text-danger-700">Confirm the duplicate override above to continue.</p>
          )}
        </div>
      </div>
    </div>
  )
}
