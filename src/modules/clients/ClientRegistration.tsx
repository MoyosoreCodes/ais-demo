import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { SelectField, TextAreaField, TextField } from '../../components/Field'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StatusBadge } from '../../components/StatusBadge'
import { findClientDuplicates } from '../../lib/duplicates'
import {
  DEMO_TODAY, clientName, formatDate, isValidEmail, isValidNin, isValidPhone, localId, nextClientId,
} from '../../lib/format'
import { seyIdLookup } from '../../lib/sim'
import type { SeyIdLookupResult } from '../../lib/sim'
import { DISTRICTS } from '../../lib/types'
import type { Client, District, Island } from '../../lib/types'

const islandFor = (district: District): Island =>
  district === 'Baie Ste Anne Praslin' ? 'Praslin' : district === 'La Digue' ? 'La Digue' : 'Mahé'

/**
 * S02 — officer-assisted registration (i.5, ii.2, ii.3 ★, ii.7 ★).
 *
 * The back-office counterpart to the public portal: an officer keys the
 * applicant's details, optionally verifies the NIN against SeyID, and is
 * blocked from creating a high-confidence duplicate.
 */
export function ClientRegistration() {
  const db = useDb()
  const dispatch = useDispatch()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    nin: '', firstName: '', lastName: '', gender: 'F' as 'F' | 'M', dateOfBirth: '',
    phone: '', email: '', district: 'Anse Boileau' as District, address: '',
    stakeholderType: 'farmer' as Client['stakeholderType'], notes: '',
  })
  const [seyIdBusy, setSeyIdBusy] = useState(false)
  const [seyIdResult, setSeyIdResult] = useState<SeyIdLookupResult | null>(null)
  const [seyIdVerified, setSeyIdVerified] = useState(false)
  const [dismissedDuplicates, setDismissedDuplicates] = useState(false)

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  /** Live duplicate check as the officer types (ii.7). */
  const duplicates = useMemo(() => {
    if (!form.nin && form.firstName.length < 2 && !form.phone) return []
    return findClientDuplicates(
      {
        nin: form.nin, firstName: form.firstName, lastName: form.lastName,
        phone: form.phone, email: form.email, dateOfBirth: form.dateOfBirth,
      },
      db.clients,
    )
  }, [db.clients, form])

  const blocking = duplicates.filter((d) => d.confidence === 'high')
  const canSave =
    form.firstName.trim().length > 1 &&
    form.lastName.trim().length > 1 &&
    isValidNin(form.nin) &&
    isValidPhone(form.phone) &&
    (!form.email || isValidEmail(form.email)) &&
    form.address.trim().length > 3 &&
    (blocking.length === 0 || dismissedDuplicates)

  const runLookup = async () => {
    setSeyIdBusy(true)
    setSeyIdResult(null)
    try {
      const result = await seyIdLookup(form.nin, db.clients)
      setSeyIdResult(result)
      if (result.profile) {
        const p = result.profile
        setForm((f) => ({
          ...f,
          firstName: p.firstName, lastName: p.lastName, gender: p.gender, dateOfBirth: p.dateOfBirth,
          phone: p.phone, district: p.district as District, address: p.address,
        }))
        setSeyIdVerified(true)
      } else {
        setSeyIdVerified(false)
      }
    } finally {
      setSeyIdBusy(false)
    }
  }

  const save = () => {
    if (!user || !canSave) return
    const id = nextClientId(db.clients.map((c) => c.id))
    const now = new Date().toISOString()

    const client: Client = {
      id,
      nin: form.nin.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      gender: form.gender,
      dateOfBirth: form.dateOfBirth,
      phone: form.phone.trim(),
      email: form.email.trim(),
      district: form.district,
      island: islandFor(form.district),
      address: form.address.trim(),
      stakeholderType: form.stakeholderType,
      status: 'active',
      registeredOn: DEMO_TODAY.toISOString().slice(0, 10),
      registeredVia: 'officer-assisted',
      seyIdVerified,
      notes: form.notes.trim(),
      history: [
        {
          id: localId('CH'), at: now, actorUserId: user.id, actorName: user.fullName,
          action: 'Registered by officer at district office',
        },
        ...(seyIdVerified
          ? [{
              id: localId('CH'), at: now, actorUserId: user.id, actorName: user.fullName,
              action: 'Identity verified via SeyID (simulated)', field: 'seyIdVerified', from: 'false', to: 'true',
            }]
          : []),
        ...(blocking.length && dismissedDuplicates
          ? [{
              id: localId('CH'), at: now, actorUserId: user.id, actorName: user.fullName,
              action: 'Duplicate warning overridden by officer',
              note: `Candidates dismissed: ${blocking.map((b) => b.client.id).join(', ')}`,
            }]
          : []),
      ],
    }

    dispatch({
      type: 'client/create',
      client,
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'client.created', entityType: 'client', entityId: id,
        detail: `Officer-assisted registration${seyIdVerified ? ' (SeyID verified, simulated)' : ''} — ${client.firstName} ${client.lastName}, ${client.district}`,
      },
    })

    toast({ tone: 'success', title: 'Client registered', body: `${clientName(client)} created as ${id}.` })
    navigate(`/clients/${id}`)
  }

  return (
    <div className="max-w-4xl pb-6">
      <PageHeader
        screen="S02"
        title="Register a client"
        description="Back-office registration for applicants who cannot use the online portal. Details captured here feed every other module."
        refs={['i.5', 'ii.2']}
        actions={<Link to="/clients" className="ais-btn-secondary">Cancel</Link>}
      />

      <div className="space-y-5">
        {/* ------------------------------------------------ identity block */}
        <section className="ais-card p-4">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
            Identity
            <ReqBadge refs="ii.3" screen="S02" />
          </h2>

          <div className="grid gap-4 sm:grid-cols-[1fr,auto] sm:items-end">
            <TextField
              label="National Identification Number (NIN)"
              required
              value={form.nin}
              onChange={(e) => {
                set('nin', e.target.value)
                setSeyIdResult(null)
                setSeyIdVerified(false)
              }}
              placeholder="999-0000-0-0-00"
              hint="Demonstration NINs always begin 999-."
              error={form.nin.length > 0 && !isValidNin(form.nin) ? 'Expected format 999-DDMM-S-C-YY.' : undefined}
            />
            <button
              type="button"
              className="ais-btn-secondary mb-[1px] h-[42px]"
              onClick={runLookup}
              disabled={seyIdBusy || !isValidNin(form.nin)}
            >
              {seyIdBusy ? 'Contacting SeyID…' : 'Verify with SeyID'}
              <SimChip />
            </button>
          </div>

          {seyIdResult && (
            <div
              className={`mt-3 rounded-lg border p-3 text-sm ${
                seyIdResult.matched
                  ? 'border-brand-200 bg-brand-50 text-brand-800'
                  : 'border-warn-200 bg-warn-50 text-warn-800'
              }`}
            >
              <p className="font-semibold">
                {seyIdResult.matched ? 'SeyID match — details pre-filled and marked verified' : 'No SeyID match'}
              </p>
              <p className="mt-0.5">{seyIdResult.message}</p>
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField label="First name" required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
            <TextField label="Surname" required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
            <SelectField label="Gender" value={form.gender} onChange={(e) => set('gender', e.target.value as 'F' | 'M')}>
              <option value="F">Female</option>
              <option value="M">Male</option>
            </SelectField>
            <TextField label="Date of birth" type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
          </div>
        </section>

        {/* ---------------------------------------------- duplicate warning */}
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
                  ? 'This looks like an existing client'
                  : `${duplicates.length} similar record${duplicates.length > 1 ? 's' : ''} found`}
              </h2>
              <ReqBadge refs="ii.7" screen="S02" />
            </div>

            <ul className="mt-3 space-y-2">
              {duplicates.map((m) => (
                <li key={m.client.id} className="rounded-md border border-ink-200 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{clientName(m.client)}</p>
                      <p className="font-mono text-xs text-ink-500">
                        {m.client.id} · {m.client.nin} · registered {formatDate(m.client.registeredOn)}
                      </p>
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
                      <Link to={`/clients/${m.client.id}`} className="ais-btn-secondary px-3 py-1.5 text-xs">
                        Open existing record
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
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
                  I have checked the existing record and confirm this is a different person. The
                  override will be recorded against my name in the change history and the audit log.
                </span>
              </label>
            )}
          </section>
        )}

        {/* --------------------------------------------------- contact block */}
        <section className="ais-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Contact and location</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Mobile" required value={form.phone} onChange={(e) => set('phone', e.target.value)}
              placeholder="+248 2 000 000"
              hint="Demonstration numbers use the pattern +248 2 000 0xx."
              error={form.phone.length > 0 && !isValidPhone(form.phone) ? 'Expected +248 2 000 0xx.' : undefined}
            />
            <TextField
              label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
              error={form.email.length > 0 && !isValidEmail(form.email) ? 'Enter a valid email address.' : undefined}
            />
            <SelectField label="District" required value={form.district} onChange={(e) => set('district', e.target.value as District)}>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </SelectField>
            <SelectField
              label="Stakeholder type" value={form.stakeholderType}
              onChange={(e) => set('stakeholderType', e.target.value as Client['stakeholderType'])}
            >
              <option value="farmer">Farmer</option>
              <option value="vendor">Vendor / trader</option>
              <option value="cooperative">Cooperative</option>
            </SelectField>
            <TextField label="Address" required value={form.address} onChange={(e) => set('address', e.target.value)} className="sm:col-span-2" />
          </div>
          <div className="mt-4">
            <TextAreaField label="Notes" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything the district office should know about this registration." />
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="ais-btn-primary" onClick={save} disabled={!canSave}>
            Register client
          </button>
          <Link to="/clients" className="ais-btn-secondary">Cancel</Link>
          {blocking.length > 0 && !dismissedDuplicates && (
            <p className="text-sm text-danger-700">
              Confirm the override above before this registration can be saved.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
