import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthShell } from './AuthShell'
import { OtpDialog } from './OtpDialog'
import { evaluatePassword, passwordMeetsPolicy, useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { SelectField, TextField } from '../../components/Field'
import { derivePasswordHash, randomSaltHex } from '../../lib/hash'
import { issueOtp, seyIdLookup, verifyOtp } from '../../lib/sim'
import type { OtpChallenge, SeyIdLookupResult } from '../../lib/sim'
import {
  DEMO_TODAY, isValidEmail, isValidNin, isValidPhone, localId, nextClientId,
} from '../../lib/format'
import { DISTRICTS } from '../../lib/types'
import type { Client, District, Island, User } from '../../lib/types'

const PBKDF2_ITERATIONS = 120000

const islandFor = (district: District): Island =>
  district === 'Baie Ste Anne Praslin' ? 'Praslin' : district === 'La Digue' ? 'La Digue' : 'Mahé'

type Step = 'identity' | 'details' | 'done'

/**
 * S01 — farmer self-registration (i.4, i.8 ★, ii.2, ii.3 ★).
 *
 * Two intake paths: SeyID (simulated) pre-fills a verified profile from the
 * NIN, or the applicant keys their own details and confirms an email/SMS
 * second factor instead.
 */
export function RegisterScreen() {
  const db = useDb()
  const dispatch = useDispatch()
  const { switchTo, policy } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('identity')
  const [path, setPath] = useState<'seyid' | 'manual' | null>(null)

  const [nin, setNin] = useState('')
  const [seyIdBusy, setSeyIdBusy] = useState(false)
  const [seyIdResult, setSeyIdResult] = useState<SeyIdLookupResult | null>(null)
  const [seyIdVerified, setSeyIdVerified] = useState(false)

  const [form, setForm] = useState({
    firstName: '', lastName: '', gender: 'F' as 'F' | 'M', dateOfBirth: '',
    phone: '', email: '', district: 'Anse Boileau' as District, address: '',
    password: '', confirm: '',
  })

  const [challenge, setChallenge] = useState<OtpChallenge | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdUserId, setCreatedUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const policyRules = evaluatePassword(form.password, policy)

  /** Light-touch duplicate signal; the full detection + merge flow lives on S02. */
  const ninClash = useMemo(
    () => db.clients.find((c) => c.nin === nin.trim() && c.status !== 'merged'),
    [db.clients, nin],
  )
  const emailClash = useMemo(
    () => db.users.find((u) => u.email.toLowerCase() === form.email.trim().toLowerCase()),
    [db.users, form.email],
  )

  const runLookup = async () => {
    setSeyIdBusy(true)
    setSeyIdResult(null)
    try {
      const result = await seyIdLookup(nin, db.clients)
      setSeyIdResult(result)
      if (result.profile) {
        const p = result.profile
        setForm((f) => ({
          ...f,
          firstName: p.firstName, lastName: p.lastName, gender: p.gender,
          dateOfBirth: p.dateOfBirth, phone: p.phone, district: p.district as District,
          address: p.address,
        }))
      }
    } finally {
      setSeyIdBusy(false)
    }
  }

  const confirmSeyId = async () => {
    setChallenge(await issueOtp('sms', form.phone || '+248 2 000 000'))
  }

  const detailsValid =
    form.firstName.trim().length > 1 &&
    form.lastName.trim().length > 1 &&
    isValidNin(nin) &&
    isValidPhone(form.phone) &&
    isValidEmail(form.email) &&
    !emailClash &&
    form.address.trim().length > 3 &&
    passwordMeetsPolicy(form.password, policy) &&
    form.password === form.confirm

  const beginSecondFactor = async () => {
    if (!detailsValid) return
    setChallenge(await issueOtp(path === 'seyid' ? 'sms' : 'email', path === 'seyid' ? form.phone : form.email))
  }

  const completeRegistration = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const clientId = nextClientId(db.clients.map((c) => c.id))
      const now = new Date().toISOString()
      const island = islandFor(form.district)

      const client: Client = {
        id: clientId,
        nin: nin.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        gender: form.gender,
        dateOfBirth: form.dateOfBirth,
        phone: form.phone.trim(),
        email: form.email.trim(),
        district: form.district,
        island,
        address: form.address.trim(),
        stakeholderType: 'farmer',
        status: 'active',
        registeredOn: DEMO_TODAY.toISOString().slice(0, 10),
        registeredVia: 'self-service',
        seyIdVerified,
        notes: seyIdVerified
          ? 'Self-registered via the online portal; identity confirmed against SeyID (simulated).'
          : 'Self-registered via the online portal; identity confirmed by email/SMS second factor (simulated).',
        history: [
          {
            id: localId('CH'), at: now, actorUserId: 'SELF',
            actorName: `${form.firstName.trim()} ${form.lastName.trim()}`,
            action: 'Self-registered via online portal',
          },
          ...(seyIdVerified
            ? [{
                id: localId('CH'), at: now, actorUserId: 'SELF',
                actorName: `${form.firstName.trim()} ${form.lastName.trim()}`,
                action: 'Identity verified via SeyID (simulated)',
                field: 'seyIdVerified', from: 'false', to: 'true',
              }]
            : []),
        ],
      }

      const salt = randomSaltHex()
      const user: User = {
        id: localId('USR'),
        email: form.email.trim().toLowerCase(),
        fullName: `${form.firstName.trim()} ${form.lastName.trim()}`,
        role: 'farmer',
        clientId,
        status: 'active',
        createdOn: DEMO_TODAY.toISOString().slice(0, 10),
        phone: form.phone.trim(),
        salt,
        passwordHash: await derivePasswordHash(form.password, salt, PBKDF2_ITERATIONS),
        iterations: PBKDF2_ITERATIONS,
        twoFactor: { enabled: true, channel: seyIdVerified ? 'sms' : 'email', simulated: true },
        seyIdLinked: seyIdVerified,
        failedLoginCount: 0,
        mustResetPassword: false,
      }

      dispatch({
        type: 'client/create',
        client,
        audit: {
          actorUserId: 'SELF', actorName: client.firstName + ' ' + client.lastName, actorRole: 'farmer',
          action: 'client.created', entityType: 'client', entityId: clientId,
          detail: `Self-registration completed via public portal${seyIdVerified ? ' (SeyID verified, simulated)' : ''}`,
        },
      })
      dispatch({
        type: 'user/create',
        user,
        audit: {
          actorUserId: 'SELF', actorName: user.fullName, actorRole: 'farmer',
          action: 'user.created', entityType: 'user', entityId: user.id,
          detail: `Farmer portal account created and linked to ${clientId}`,
        },
      })

      setCreatedUserId(user.id)
      setChallenge(null)
      setStep('done')
    } catch {
      setError('The account could not be created. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ---------------------------------------------------------- render */

  if (step === 'done') {
    return (
      <AuthShell title="Registration complete" refs={['i.4']}>
        <div className="ais-card p-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-full bg-brand-50 p-2 text-brand-600">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 13l4 4 10-11" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                Welcome, {form.firstName} {form.lastName}
              </h2>
              <p className="mt-1 text-sm text-ink-600">
                Your client record has been created in the central registry and a portal account has
                been linked to it. An agriculture officer can now register your farm against this
                record without re-keying your details.
              </p>
              {seyIdVerified && (
                <p className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
                  Identity verified via SeyID
                  <SimChip />
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="ais-btn-primary"
                  onClick={() => {
                    if (createdUserId) switchTo(createdUserId)
                    navigate('/portal', { replace: true })
                  }}
                >
                  Continue to my holding
                </button>
                <Link to="/signin" className="ais-btn-secondary">
                  Back to sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Register as a farmer"
      subtitle="Create a client record and portal account. Your details are captured once and reused across farm registration, loans, laboratory services and inspections."
      refs={['i.4', 'ii.2', 'ii.3']}
      aside={
        <div className="ais-card p-4">
          <h2 className="text-sm font-semibold text-ink-900">Entered once, reused everywhere</h2>
          <p className="mt-1 text-xs text-ink-600">
            Registration creates a single master client record. Farms, loans, laboratory samples,
            livestock visits, surveillance cases, leases and inspections all link back to it by
            Client ID.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['Farms', 'Loans', 'Laboratory', 'Livestock', 'Surveillance', 'Leases', 'Inspections'].map((m) => (
              <span key={m} className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                {m}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-500">
            Requirement <span className="font-mono font-semibold">ii.5</span> — relational linking by
            Client ID.
          </p>
        </div>
      }
    >
      {/* ------------------------------------------------- step: identity */}
      {step === 'identity' && (
        <div className="space-y-4">
          <div className="ais-card p-5">
            <h2 className="text-sm font-semibold text-ink-900">How would you like to verify your identity?</h2>

            <button
              type="button"
              onClick={() => setPath('seyid')}
              className={`mt-3 flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                path === 'seyid' ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-brand-300'
              }`}
            >
              <span className="mt-0.5 rounded bg-brand-100 p-1.5 text-brand-700">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="9" cy="11" r="2" />
                  <path d="M5.5 16c.7-1.5 2-2.2 3.5-2.2s2.8.7 3.5 2.2M15 10h4M15 13h3" strokeLinecap="round" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
                  Verify with SeyID
                  <SimChip />
                  <ReqBadge refs={['i.8', 'ii.3']} screen="S01" />
                </span>
                <span className="mt-0.5 block text-xs text-ink-600">
                  Enter your NIN and confirm a one-time passcode. Your name, district and contact
                  details are filled in for you and marked as verified.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPath('manual')
                setStep('details')
              }}
              className={`mt-2 flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                path === 'manual' ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-brand-300'
              }`}
            >
              <span className="mt-0.5 rounded bg-ink-100 p-1.5 text-ink-600">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M4 20h16M6 16l10-10 2 2L8 18l-4 1z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
                  Enter my details myself
                  <ReqBadge refs="i.8" screen="S01" />
                </span>
                <span className="mt-0.5 block text-xs text-ink-600">
                  For applicants without a SeyID record. Identity is confirmed with an email or SMS
                  second factor instead.
                </span>
              </span>
            </button>
          </div>

          {path === 'seyid' && (
            <div className="ais-card space-y-4 p-5">
              <TextField
                label="National Identification Number (NIN)"
                value={nin}
                onChange={(e) => {
                  setNin(e.target.value)
                  setSeyIdResult(null)
                }}
                placeholder="999-0000-0-0-00"
                required
                badge={<SimChip />}
                hint="Demonstration NINs always begin 999-. Try 999-0412-1-1-07."
                error={nin.length > 0 && !isValidNin(nin) ? 'Expected format 999-DDMM-S-C-YY.' : undefined}
              />

              {ninClash && (
                <div className="rounded-lg border border-warn-200 bg-warn-50 p-3 text-sm text-warn-800">
                  <p className="font-semibold">A client record already exists for this NIN</p>
                  <p className="mt-0.5">
                    {ninClash.firstName} {ninClash.lastName} ({ninClash.id}), registered{' '}
                    {ninClash.registeredOn}. Continuing would create a duplicate — an officer would
                    normally resolve this on the client registry. Use a different NIN to complete a
                    clean registration in the demonstration.
                  </p>
                </div>
              )}

              <button
                type="button"
                className="ais-btn-primary w-full"
                onClick={runLookup}
                disabled={seyIdBusy || !isValidNin(nin)}
              >
                {seyIdBusy ? 'Contacting SeyID…' : 'Verify with SeyID'}
              </button>

              {seyIdResult && (
                <div
                  className={`rounded-lg border p-3 text-sm ${
                    seyIdResult.matched
                      ? 'border-brand-200 bg-brand-50 text-brand-800'
                      : 'border-warn-200 bg-warn-50 text-warn-800'
                  }`}
                >
                  <p className="font-semibold">
                    {seyIdResult.matched ? 'SeyID returned a matching record' : 'No SeyID match'}
                  </p>
                  <p className="mt-0.5">{seyIdResult.message}</p>
                  {seyIdResult.matched && (
                    <button type="button" className="ais-btn-primary mt-3" onClick={confirmSeyId}>
                      Send one-time passcode
                    </button>
                  )}
                  {!seyIdResult.matched && (
                    <button
                      type="button"
                      className="ais-btn-secondary mt-3"
                      onClick={() => {
                        setPath('manual')
                        setStep('details')
                      }}
                    >
                      Continue with manual entry
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <p className="text-sm text-ink-600">
            Already registered?{' '}
            <Link to="/signin" className="ais-link">
              Sign in
            </Link>
          </p>
        </div>
      )}

      {/* -------------------------------------------------- step: details */}
      {step === 'details' && (
        <form
          className="ais-card space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault()
            void beginSecondFactor()
          }}
        >
          {seyIdVerified && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-semibold">Verified via SeyID</span>
              <SimChip />
              <span className="text-brand-700">Name, district and contact details pre-filled.</span>
              <ReqBadge refs={['i.8', 'ii.3']} screen="S01" />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="First name" required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} readOnly={seyIdVerified} />
            <TextField label="Surname" required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} readOnly={seyIdVerified} />
          </div>

          {!seyIdVerified && (
            <TextField
              label="National Identification Number (NIN)"
              required
              value={nin}
              onChange={(e) => setNin(e.target.value)}
              placeholder="999-0000-0-0-00"
              badge={<ReqBadge refs="ii.3" screen="S01" />}
              hint="Demonstration NINs always begin 999-."
              error={nin.length > 0 && !isValidNin(nin) ? 'Expected format 999-DDMM-S-C-YY.' : undefined}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Gender" value={form.gender} onChange={(e) => set('gender', e.target.value as 'F' | 'M')} disabled={seyIdVerified}>
              <option value="F">Female</option>
              <option value="M">Male</option>
            </SelectField>
            <TextField label="Date of birth" type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} readOnly={seyIdVerified} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Mobile number" required value={form.phone}
              onChange={(e) => set('phone', e.target.value)} readOnly={seyIdVerified}
              placeholder="+248 2 000 000"
              hint="Demonstration numbers use the pattern +248 2 000 0xx."
              error={form.phone.length > 0 && !isValidPhone(form.phone) ? 'Expected +248 2 000 0xx.' : undefined}
            />
            <TextField
              label="Email address" type="email" required value={form.email}
              onChange={(e) => set('email', e.target.value)}
              error={
                form.email.length > 0 && !isValidEmail(form.email)
                  ? 'Enter a valid email address.'
                  : emailClash
                    ? 'An account already uses this email address.'
                    : undefined
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="District" required value={form.district} onChange={(e) => set('district', e.target.value as District)} disabled={seyIdVerified}>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </SelectField>
            <TextField label="Address" required value={form.address} onChange={(e) => set('address', e.target.value)} readOnly={seyIdVerified} placeholder="Chemin …, district, island" />
          </div>

          <hr className="border-ink-200" />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Password" type="password" required autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} badge={<ReqBadge refs="i.1" screen="S01" />} />
            <TextField
              label="Confirm password" type="password" required autoComplete="new-password"
              value={form.confirm} onChange={(e) => set('confirm', e.target.value)}
              error={form.confirm.length > 0 && form.confirm !== form.password ? 'Passwords do not match.' : undefined}
            />
          </div>

          <ul className="grid gap-1 text-xs sm:grid-cols-2">
            {policyRules.map((r) => (
              <li key={r.id} className={`flex items-center gap-1.5 ${r.met ? 'text-brand-700' : 'text-ink-500'}`}>
                <span aria-hidden>{r.met ? '✓' : '○'}</span>
                {r.label}
              </li>
            ))}
          </ul>

          {error && <p className="ais-error">{error}</p>}

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" className="ais-btn-primary" disabled={!detailsValid || submitting}>
              Continue — verify with a passcode
            </button>
            <button
              type="button" className="ais-btn-secondary"
              onClick={() => {
                setStep('identity')
                setSeyIdVerified(false)
              }}
            >
              Back
            </button>
          </div>

          <p className="text-xs text-ink-500">
            A one-time passcode confirms the {path === 'seyid' ? 'mobile number' : 'email address'}{' '}
            before the account is created — this is the local second factor for applicants without
            SeyID. Delivery is simulated.
          </p>
        </form>
      )}

      <OtpDialog
        open={Boolean(challenge)}
        challenge={challenge}
        heading={step === 'identity' ? 'Confirm your SeyID passcode' : 'Confirm your contact details'}
        description={
          step === 'identity'
            ? 'SeyID sends a passcode to the mobile number held on your citizen record.'
            : 'Confirm the passcode to finish creating your account.'
        }
        userName={form.firstName ? `${form.firstName} ${form.lastName}` : null}
        onVerify={(code) => {
          if (!challenge) return 'expired'
          const result = verifyOtp(challenge, code)
          if (result === 'ok') {
            if (step === 'identity') {
              setSeyIdVerified(true)
              setChallenge(null)
              setStep('details')
            } else {
              void completeRegistration()
            }
          }
          return result
        }}
        onResend={async () => {
          setChallenge(await issueOtp(path === 'seyid' ? 'sms' : 'email', path === 'seyid' ? form.phone : form.email))
        }}
        onCancel={() => setChallenge(null)}
      />
    </AuthShell>
  )
}
