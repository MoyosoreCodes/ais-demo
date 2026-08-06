import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthShell } from './AuthShell'
import { OtpDialog } from './OtpDialog'
import { useAuth } from '../../app/AuthContext'
import { useDb } from '../../app/DataContext'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { TextField } from '../../components/Field'
import { Modal } from '../../components/Modal'
import { seyIdLookup } from '../../lib/sim'
import type { SeyIdLookupResult } from '../../lib/sim'
import { formatDateTime, isValidNin } from '../../lib/format'
import { ROLE_LABELS } from '../../lib/types'

/**
 * S01 — sign-in (i.1 ★, i.8 ★).
 *
 * Demonstrates: password verified against a stored PBKDF2 salt+hash, the
 * configurable password policy, a live lockout counter, the session-timeout
 * notice, local 2FA, and the SeyID (simulated) path keyed on NIN.
 */
export function SignInScreen() {
  const { user, signIn, signInWithSeyId, pendingChallenge, pendingUserName, completeTwoFactor, resendTwoFactor, cancelTwoFactor, policy, lastSignOutReason } = useAuth()
  const db = useDb()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'warn'; text: string } | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)

  const [seyIdOpen, setSeyIdOpen] = useState(false)
  const [nin, setNin] = useState('999-0412-1-1-07')
  const [seyIdBusy, setSeyIdBusy] = useState(false)
  const [seyIdResult, setSeyIdResult] = useState<SeyIdLookupResult | null>(null)

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/'

  if (user && !pendingChallenge) return <Navigate to={redirectTo} replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const outcome = await signIn(email, password)
      switch (outcome.status) {
        case 'ok':
          navigate(redirectTo, { replace: true })
          break
        case 'needs-2fa':
          break
        case 'invalid':
          setAttemptsRemaining(outcome.attemptsRemaining)
          setMessage({
            tone: 'error',
            text: `Incorrect email or password. ${outcome.attemptsRemaining} attempt${outcome.attemptsRemaining === 1 ? '' : 's'} remaining before the account is locked.`,
          })
          break
        case 'locked':
          setAttemptsRemaining(0)
          setMessage({
            tone: 'error',
            text: `This account is locked until ${formatDateTime(outcome.until)} after ${policy.maxFailedLogins} failed attempts. An administrator can release it immediately.`,
          })
          break
        case 'deactivated':
          setMessage({ tone: 'error', text: 'This account is not active. Contact an administrator.' })
          break
        case 'unknown-user':
          setMessage({ tone: 'error', text: 'Incorrect email or password.' })
          break
      }
    } finally {
      setBusy(false)
    }
  }

  const runSeyIdLookup = async () => {
    setSeyIdBusy(true)
    setSeyIdResult(null)
    try {
      setSeyIdResult(await seyIdLookup(nin, db.clients))
    } finally {
      setSeyIdBusy(false)
    }
  }

  const continueWithSeyId = async () => {
    const match = db.clients.find((c) => c.nin === nin.trim() && c.status !== 'merged')
    if (!match) return
    const outcome = await signInWithSeyId(match.id)
    setSeyIdOpen(false)
    if (outcome.status === 'unknown-user') {
      setMessage({
        tone: 'warn',
        text: 'SeyID matched a citizen record, but no portal account is linked to it yet. Register to create one.',
      })
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Farmers, officers and administrators sign in here. Access to each module is decided by the role attached to the account."
      refs={['i.1', 'i.8']}
      aside={<DemoAccountsPanel />}
    >
      {lastSignOutReason === 'timeout' && (
        <div className="mb-4 rounded-lg border border-warn-200 bg-warn-50 p-3 text-sm text-warn-800" role="status">
          You were signed out automatically after {policy.sessionTimeoutMinutes} minutes of
          inactivity. Sign in again to continue.
        </div>
      )}

      <form onSubmit={submit} className="ais-card space-y-4 p-5">
        <TextField
          label="Email address"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setMessage(null)
          }}
          placeholder="officer@demo"
        />

        <div>
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setMessage(null)
            }}
            placeholder="••••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="mt-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            {showPassword ? 'Hide password' : 'Show password'}
          </button>
        </div>

        {message && (
          <div
            role="alert"
            className={`rounded-lg border p-3 text-sm ${
              message.tone === 'error'
                ? 'border-danger-200 bg-danger-50 text-danger-700'
                : 'border-warn-200 bg-warn-50 text-warn-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <button type="submit" className="ais-btn-primary w-full" disabled={busy}>
          {busy ? 'Verifying…' : 'Sign in'}
        </button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-ink-200" />
          <span className="text-xs uppercase tracking-wide text-ink-400">or</span>
          <span className="h-px flex-1 bg-ink-200" />
        </div>

        <button
          type="button"
          onClick={() => setSeyIdOpen(true)}
          className="ais-btn-secondary w-full justify-between"
        >
          <span className="inline-flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-brand-600" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="11" r="2" />
              <path d="M5.5 16c.7-1.5 2-2.2 3.5-2.2s2.8.7 3.5 2.2M15 10h4M15 13h3" strokeLinecap="round" />
            </svg>
            Sign in with SeyID
          </span>
          <span className="inline-flex items-center gap-1.5">
            <SimChip />
            <ReqBadge refs="i.8" screen="S01" />
          </span>
        </button>

        <div className="flex flex-wrap justify-between gap-3 pt-1 text-sm">
          <Link to="/forgot-password" className="ais-link inline-flex items-center gap-1.5">
            Forgotten your password?
            <ReqBadge refs="i.6" screen="S01" />
          </Link>
          <Link to="/register" className="ais-link inline-flex items-center gap-1.5">
            Register as a farmer
            <ReqBadge refs="i.4" screen="S01" />
          </Link>
        </div>
      </form>

      <SecurityNotice attemptsRemaining={attemptsRemaining} />

      {/* ------------------------------------------------ SeyID (simulated) */}
      <Modal
        open={seyIdOpen}
        onClose={() => {
          setSeyIdOpen(false)
          setSeyIdResult(null)
        }}
        title="Sign in with SeyID"
        size="sm"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            National identity verification keyed on your NIN.
            <SimChip />
          </span>
        }
        footer={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => setSeyIdOpen(false)}>
              Cancel
            </button>
            {seyIdResult?.matched ? (
              <button type="button" className="ais-btn-primary" onClick={continueWithSeyId}>
                Continue — send passcode
              </button>
            ) : (
              <button
                type="button"
                className="ais-btn-primary"
                onClick={runSeyIdLookup}
                disabled={seyIdBusy || !isValidNin(nin)}
              >
                {seyIdBusy ? 'Contacting SeyID…' : 'Verify with SeyID'}
              </button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <TextField
            label="National Identification Number (NIN)"
            value={nin}
            onChange={(e) => {
              setNin(e.target.value)
              setSeyIdResult(null)
            }}
            placeholder="999-0000-0-0-00"
            hint={
              isValidNin(nin)
                ? 'Format accepted. All demonstration NINs use the fictional 999- prefix.'
                : 'Expected format 999-DDMM-S-C-YY. Demonstration NINs always begin 999-.'
            }
            error={nin.length > 0 && !isValidNin(nin) ? 'Not a valid NIN format.' : undefined}
          />

          {seyIdResult && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                seyIdResult.matched
                  ? 'border-brand-200 bg-brand-50 text-brand-800'
                  : 'border-warn-200 bg-warn-50 text-warn-800'
              }`}
            >
              <p className="font-semibold">{seyIdResult.matched ? 'SeyID match found' : 'No SeyID match'}</p>
              <p className="mt-0.5">{seyIdResult.message}</p>
              {seyIdResult.profile && (
                <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs">
                  <dt className="text-brand-700">Name</dt>
                  <dd className="font-medium">
                    {seyIdResult.profile.firstName} {seyIdResult.profile.lastName}
                  </dd>
                  <dt className="text-brand-700">District</dt>
                  <dd className="font-medium">{seyIdResult.profile.district}</dd>
                  <dt className="text-brand-700">Mobile</dt>
                  <dd className="font-medium">{seyIdResult.profile.phone}</dd>
                </dl>
              )}
            </div>
          )}

          <p className="text-xs text-ink-500">
            The prototype resolves the NIN against its own seeded records. No request leaves the
            browser. Accounts without a SeyID record fall back to email/SMS second-factor sign-in.
          </p>
        </div>
      </Modal>

      {/* ------------------------------------------------------ 2FA step */}
      <OtpDialog
        open={Boolean(pendingChallenge)}
        challenge={pendingChallenge}
        heading="Two-factor authentication"
        description="A second factor is required for this account."
        userName={pendingUserName}
        onVerify={(code) => {
          const result = completeTwoFactor(code)
          if (result === 'ok') navigate(redirectTo, { replace: true })
          return result
        }}
        onResend={resendTwoFactor}
        onCancel={cancelTwoFactor}
      />
    </AuthShell>
  )
}

function SecurityNotice({ attemptsRemaining }: { attemptsRemaining: number | null }) {
  const { policy } = useAuth()
  return (
    <section className="ais-card mt-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-ink-900">Account security</h2>
        <ReqBadge refs="i.1" screen="S01" />
      </div>
      <ul className="mt-2 space-y-1.5 text-xs text-ink-600">
        <li className="flex gap-2">
          <Tick />
          Passwords are stored as a salted PBKDF2-SHA256 hash ({policy.minPasswordLength}+ characters,
          upper case, number and symbol required). The prototype never holds a password in clear.
        </li>
        <li className="flex gap-2">
          <Tick />
          Accounts lock for {policy.lockoutMinutes} minutes after {policy.maxFailedLogins} failed
          attempts.
          {attemptsRemaining !== null && (
            <strong className="text-danger-700"> {attemptsRemaining} remaining on this account.</strong>
          )}
        </li>
        <li className="flex gap-2">
          <Tick />
          Sessions end automatically after {policy.sessionTimeoutMinutes} minutes of inactivity.
        </li>
        <li className="flex gap-2">
          <Tick />
          Every sign-in, failure and lockout is written to the append-only audit log.
        </li>
      </ul>
      <p className="mt-2 text-xs text-ink-500">
        All four values are configurable by an administrator on the Administration screen — no
        redeployment is required.
      </p>
    </section>
  )
}

function Tick() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DemoAccountsPanel() {
  const db = useDb()
  return (
    <div className="ais-card p-4">
      <h2 className="text-sm font-semibold text-ink-900">Demonstration accounts</h2>
      <p className="mt-1 text-xs text-ink-600">
        Every account below uses the password{' '}
        <code className="rounded bg-ink-100 px-1 py-0.5 font-mono font-semibold">Demo2026!</code>.
      </p>
      <ul className="mt-3 space-y-1.5">
        {db.users.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 text-xs">
            <code className="font-mono text-ink-800">{u.email}</code>
            <span className="shrink-0 text-ink-500">{ROLE_LABELS[u.role]}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-500">
        Marie-Ange Hoareau (<code className="font-mono">farmer@demo</code>) is the farmer the
        walk-through follows. Her SeyID NIN is{' '}
        <code className="font-mono">999-0412-1-1-07</code>.
      </p>
    </div>
  )
}
