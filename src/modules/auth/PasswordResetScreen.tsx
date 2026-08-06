import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthShell } from './AuthShell'
import { OtpDialog } from './OtpDialog'
import { evaluatePassword, passwordMeetsPolicy, useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { TextField } from '../../components/Field'
import { derivePasswordHash, randomSaltHex } from '../../lib/hash'
import { issueOtp, verifyOtp } from '../../lib/sim'
import type { OtpChallenge } from '../../lib/sim'

/**
 * S01 — self-service password reset and account recovery (i.6).
 *
 * A locked account is released by the same flow, which is why the lockout
 * counter is cleared alongside the new credential.
 */
export function PasswordResetScreen() {
  const db = useDb()
  const dispatch = useDispatch()
  const { policy } = useAuth()

  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request')
  const [email, setEmail] = useState('')
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null)
  const [targetUserId, setTargetUserId] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const target = db.users.find((u) => u.id === targetUserId)
  const rules = evaluatePassword(password, policy)
  const canSubmit = passwordMeetsPolicy(password, policy) && password === confirm

  const request = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      const match = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
      // Never disclose whether an address is registered.
      if (!match) {
        setNotice(
          'If that email address matches an account, a recovery passcode has been sent to it. Check your inbox and SMS.',
        )
        return
      }
      setTargetUserId(match.id)
      setChallenge(await issueOtp('email', match.email))
    } finally {
      setBusy(false)
    }
  }

  const applyReset = async () => {
    if (!target || !canSubmit) return
    setBusy(true)
    try {
      const salt = randomSaltHex()
      const passwordHash = await derivePasswordHash(password, salt, target.iterations)
      dispatch({
        type: 'user/update',
        id: target.id,
        patch: {
          salt,
          passwordHash,
          failedLoginCount: 0,
          lockedUntil: undefined,
          mustResetPassword: false,
        },
        audit: {
          actorUserId: target.id,
          actorName: target.fullName,
          actorRole: target.role,
          action: 'auth.password.reset',
          entityType: 'user',
          entityId: target.id,
          detail: 'Password reset completed via self-service recovery; lockout counter cleared',
        },
      })
      setStep('done')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Recover access with a one-time passcode. The same flow releases an account that has been locked by failed sign-in attempts."
      refs={['i.6']}
      aside={
        <div className="ais-card p-4">
          <h2 className="text-sm font-semibold text-ink-900">Two recovery routes</h2>
          <ul className="mt-2 space-y-2 text-xs text-ink-600">
            <li>
              <strong className="text-ink-800">Self-service</strong> — this screen. A passcode is sent
              to the registered email address or mobile number.
            </li>
            <li>
              <strong className="text-ink-800">Administrator-assisted</strong> — an administrator can
              issue a temporary credential and release a lock from the Administration screen, for
              farmers who cannot receive a passcode.
            </li>
          </ul>
          <p className="mt-3 text-xs text-ink-500">
            Both routes write to the append-only audit log.
          </p>
        </div>
      }
    >
      {step === 'request' && (
        <form onSubmit={request} className="ais-card space-y-4 p-5">
          <TextField
            label="Email address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="farmer@demo"
            badge={<SimChip label="delivery simulated" />}
            hint="A six-digit passcode is generated locally and displayed on screen — no message is actually sent."
          />
          {notice && (
            <p className="rounded-lg border border-ink-200 bg-ink-50 p-3 text-sm text-ink-700" role="status">
              {notice}
            </p>
          )}
          <button type="submit" className="ais-btn-primary w-full" disabled={busy}>
            {busy ? 'Sending passcode…' : 'Send recovery passcode'}
          </button>
          <p className="text-sm text-ink-600">
            <Link to="/signin" className="ais-link">
              Back to sign in
            </Link>
          </p>
        </form>
      )}

      {step === 'reset' && target && (
        <div className="ais-card space-y-4 p-5">
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">
            Passcode confirmed for <strong>{target.fullName}</strong>. Choose a new password.
          </div>

          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            badge={<ReqBadge refs="i.1" screen="S01" />}
          />
          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={confirm.length > 0 && confirm !== password ? 'Passwords do not match.' : undefined}
          />

          <ul className="grid gap-1 text-xs sm:grid-cols-2">
            {rules.map((r) => (
              <li key={r.id} className={`flex items-center gap-1.5 ${r.met ? 'text-brand-700' : 'text-ink-500'}`}>
                <span aria-hidden>{r.met ? '✓' : '○'}</span>
                {r.label}
              </li>
            ))}
          </ul>

          <button type="button" className="ais-btn-primary w-full" onClick={applyReset} disabled={!canSubmit || busy}>
            {busy ? 'Updating…' : 'Set new password'}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="ais-card p-6">
          <h2 className="text-base font-semibold text-ink-900">Password updated</h2>
          <p className="mt-1 text-sm text-ink-600">
            The new password is stored as a fresh salted PBKDF2-SHA256 hash, and any lockout on the
            account has been cleared. The reset is recorded in the audit log.
          </p>
          <Link to="/signin" className="ais-btn-primary mt-5">
            Continue to sign in
          </Link>
        </div>
      )}

      <OtpDialog
        open={Boolean(challenge)}
        challenge={challenge}
        heading="Confirm recovery passcode"
        description="Enter the passcode to prove you control the registered address."
        userName={target?.fullName ?? null}
        onVerify={(code) => {
          if (!challenge) return 'expired'
          const result = verifyOtp(challenge, code)
          if (result === 'ok') {
            setChallenge(null)
            setStep('reset')
          }
          return result
        }}
        onResend={async () => {
          if (target) setChallenge(await issueOtp('email', target.email))
        }}
        onCancel={() => setChallenge(null)}
      />
    </AuthShell>
  )
}
