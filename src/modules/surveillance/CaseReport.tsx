import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { EmptyState } from '../../components/EmptyState'
import { SelectField, TextAreaField, TextField } from '../../components/Field'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { DEMO_TODAY, clientName, localId, nextCaseId } from '../../lib/format'
import { DISEASES_BY_SPECIES, LIVESTOCK_TYPES } from '../../lib/types'
import type { LivestockType, SurveillanceCase } from '../../lib/types'

/**
 * Kept as the last option for every species, because passive surveillance
 * depends on people reporting what they *see*, not on them knowing the right
 * name for it. The conditions offered above it are those the selected species
 * can actually contract (DISEASES_BY_SPECIES).
 */
const UNIDENTIFIED = 'Unidentified — signs described below'

const SIGN_PROMPTS = [
  'Sudden or unusual mortality',
  'Respiratory distress, gasping or nasal discharge',
  'Greenish or bloody diarrhoea',
  'Nervous signs — twisted neck, paralysis, tremors',
  'Skin lesions, scabs or swelling',
  'Sudden drop in production',
  'Lameness or reluctance to move',
]

/**
 * S08 — suspected case intake (viii.1).
 *
 * Reachable by a farmer from their portal and by an officer taking a hotline
 * call, so the same structured record results either way.
 */
export function CaseReport() {
  const db = useDb()
  const dispatch = useDispatch()
  const { user, role } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const isFarmer = role === 'farmer'
  const [clientId, setClientId] = useState(user?.clientId ?? '')
  const [farmId, setFarmId] = useState('')
  const [disease, setDisease] = useState<string>(DISEASES_BY_SPECIES.broiler[0])
  const [species, setSpecies] = useState<LivestockType>('broiler')

  /* Only conditions of the selected species are offered, and the value is
   * derived rather than stored, so changing the species can never leave a
   * disease selected that the animal cannot contract. */
  const conditions = useMemo(() => [...DISEASES_BY_SPECIES[species], UNIDENTIFIED], [species])
  const suspectedCondition = conditions.includes(disease) ? disease : conditions[0]
  const [affected, setAffected] = useState('')
  const [mortality, setMortality] = useState('')
  const [signs, setSigns] = useState<string[]>([])
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

  const affectedCount = Number(affected)
  const mortalityCount = Number(mortality || 0)
  const canSubmit =
    Boolean(client && farm) &&
    affectedCount > 0 &&
    mortalityCount <= affectedCount &&
    (signs.length > 0 || notes.trim().length > 5)

  const toggleSign = (s: string) =>
    setSigns((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const submit = () => {
    if (!user || !client || !farm || !canSubmit) return
    const id = nextCaseId(db.surveillanceCases.map((c) => c.id))
    const now = new Date().toISOString()

    const described = [
      signs.length ? `Signs reported: ${signs.join('; ')}.` : '',
      notes.trim(),
    ].filter(Boolean).join(' ')

    const newCase: SurveillanceCase = {
      id,
      clientId: client.id,
      farmId: farm.id,
      suspectedDisease: suspectedCondition,
      species,
      reportedOn: DEMO_TODAY.toISOString().slice(0, 10),
      reportedBy: isFarmer ? clientName(client) : user.fullName,
      reportedVia: isFarmer ? 'farmer-portal' : 'hotline',
      status: 'reported',
      affectedCount,
      mortalityCount,
      notes: described,
      history: [
        {
          id: localId('CH'), at: now,
          actorUserId: isFarmer ? 'SELF' : user.id,
          actorName: isFarmer ? clientName(client) : user.fullName,
          action: isFarmer ? 'Suspected case reported via farmer portal' : 'Suspected case reported via hotline',
          note: described,
        },
      ],
    }

    dispatch({
      type: 'case/create',
      surveillanceCase: newCase,
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'surveillance.case.reported', entityType: 'surveillance', entityId: id,
        detail: `Suspected ${suspectedCondition} reported at ${farm.name} (${farm.id}) — ${affectedCount} affected, ${mortalityCount} mortality`,
      },
    })

    toast({
      tone: 'warning',
      title: 'Suspected case reported',
      body: `${id} raised. Veterinary services will assign an officer.`,
    })
    navigate(`/surveillance/${id}`)
  }

  return (
    <div className="max-w-3xl pb-6">
      <PageHeader
        screen="S08"
        title="Report a suspected disease case"
        description="Report unusual illness or mortality in livestock. You do not need to know what the disease is — describe what you can see."
        refs={['viii.1']}
        actions={<Link to={isFarmer ? '/portal' : '/surveillance'} className="ais-btn-secondary">Cancel</Link>}
      />

      <div className="mb-5 rounded-lg border border-warn-300 bg-warn-50 p-4">
        <p className="text-sm font-semibold text-warn-900">If this is an emergency</p>
        <p className="mt-1 text-sm text-warn-800">
          For sudden mass mortality, telephone the veterinary hotline immediately rather than waiting
          for this report to be picked up. Isolate affected animals and stop all movement off the
          holding until an officer has attended.
        </p>
      </div>

      <div className="space-y-5">
        <section className="ais-card p-4">
          <h2 className="text-sm font-semibold text-ink-900">Holding affected</h2>

          {!isFarmer && (
            <div className="mt-3">
              <SelectField
                label="Holder"
                required
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value)
                  setFarmId('')
                }}
                hint="Officers taking a hotline call select the holder here."
              >
                <option value="">Select a client…</option>
                {eligibleClients.map((c) => (
                  <option key={c.id} value={c.id}>{clientName(c)} · {c.id}</option>
                ))}
              </SelectField>
            </div>
          )}

          {farms.length > 0 ? (
            <div className="mt-3">
              <SelectField
                label="Holding"
                required
                value={farm?.id ?? ''}
                onChange={(e) => {
                  setFarmId(e.target.value)
                  const f = farms.find((x) => x.id === e.target.value)
                  if (f?.livestock[0]) setSpecies(f.livestock[0].type)
                }}
                badge={<ReqBadge refs="viii.4" screen="S08" />}
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} · {f.id}</option>
                ))}
              </SelectField>
            </div>
          ) : (
            clientId && (
              <p className="mt-3 rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-sm text-warn-800">
                No registered holding found for this client.
              </p>
            )
          )}

          {farm && farm.livestock.length > 0 && (
            <p className="mt-2 text-xs text-ink-600">
              Livestock on record at this holding:{' '}
              {farm.livestock.map((l) => `${l.headcount} ${l.type}`).join(', ')}.
            </p>
          )}
        </section>

        <section className="ais-card p-4">
          <h2 className="text-sm font-semibold text-ink-900">What you have seen</h2>

          <fieldset className="mt-3">
            <legend className="ais-label mb-1.5">Signs observed</legend>
            <div className="flex flex-wrap gap-2">
              {SIGN_PROMPTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSign(s)}
                  aria-pressed={signs.includes(s)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    signs.includes(s)
                      ? 'border-warn-500 bg-warn-500 text-white'
                      : 'border-ink-300 bg-white text-ink-700 hover:border-warn-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SelectField label="Species affected" value={species} onChange={(e) => setSpecies(e.target.value as LivestockType)}>
              {LIVESTOCK_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </SelectField>
            <SelectField
              label="Suspected condition"
              value={suspectedCondition}
              onChange={(e) => setDisease(e.target.value)}
              hint="Choose the last option if you are unsure — describe the signs instead."
            >
              {conditions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </SelectField>
            <TextField
              label="Animals affected"
              required
              type="number"
              min="1"
              value={affected}
              onChange={(e) => setAffected(e.target.value)}
              placeholder="14"
            />
            <TextField
              label="Deaths so far"
              type="number"
              min="0"
              value={mortality}
              onChange={(e) => setMortality(e.target.value)}
              placeholder="3"
              error={
                mortality !== '' && affected !== '' && mortalityCount > affectedCount
                  ? 'Deaths cannot exceed the number affected.'
                  : undefined
              }
            />
          </div>

          <div className="mt-4">
            <TextAreaField
              label="Describe what you have seen"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Three birds died overnight. The rest are gasping and have greenish droppings. It started two days ago after the weather changed."
              hint="When it started, how quickly it spread, and anything that changed on the holding recently."
            />
          </div>
        </section>

        <section className="ais-card p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink-900">What happens next</h2>
          <ol className="space-y-2 text-sm text-ink-700">
            <li>1. Veterinary services assign the case to an officer.</li>
            <li>2. The officer visits and may take diagnostic samples.</li>
            <li>3. Samples go to the laboratory and the result is linked to this case.</li>
            <li>4. You are notified at each change of status.</li>
          </ol>
          <p className="mt-3 inline-flex flex-wrap items-center gap-2 text-xs text-ink-500">
            Status updates arrive in your portal and by SMS. <SimChip />
          </p>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="ais-btn-primary" onClick={submit} disabled={!canSubmit}>
            Report suspected case
          </button>
          <Link to={isFarmer ? '/portal' : '/surveillance'} className="ais-btn-secondary">Cancel</Link>
          {!canSubmit && (
            <p className="text-sm text-ink-500">
              Select the holding, enter how many animals are affected, and tick at least one sign or
              describe what you have seen.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
