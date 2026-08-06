/**
 * Session and authentication (i.1, i.6, i.8).
 *
 * The prototype verifies passwords against a stored PBKDF2-SHA256 salt+hash —
 * it never holds a password in clear. The lockout counter, password policy and
 * session timeout are all driven by the admin-editable `securityPolicy` record,
 * which is the ★ claim behind i.1.
 *
 * Second-factor delivery is simulated (see lib/sim.ts) and labelled as such
 * wherever it appears.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useDb, useDispatch } from './DataContext'
import { verifyPassword } from '../lib/hash'
import { issueOtp, verifyOtp } from '../lib/sim'
import type { OtpChallenge } from '../lib/sim'
import type { Role, SecurityPolicy, User } from '../lib/types'

const SESSION_KEY = 'ais-demo:session:v1'

interface StoredSession {
  userId: string
  startedAt: number
  lastActivityAt: number
}

export type SignInOutcome =
  | { status: 'ok' }
  | { status: 'needs-2fa' }
  | { status: 'invalid'; attemptsRemaining: number }
  | { status: 'locked'; until: string }
  | { status: 'deactivated' }
  | { status: 'unknown-user' }

interface AuthContextValue {
  user: User | null
  role: Role | undefined
  policy: SecurityPolicy
  /** Seconds until automatic sign-out; null when signed out. */
  secondsRemaining: number | null
  /** Pending second-factor challenge, if a sign-in is mid-flight. */
  pendingChallenge: OtpChallenge | null
  pendingUserName: string | null
  signIn: (email: string, password: string) => Promise<SignInOutcome>
  /** Resolves a SeyID (simulated) sign-in for a farmer, keyed on NIN. */
  signInWithSeyId: (clientId: string) => Promise<SignInOutcome>
  completeTwoFactor: (code: string) => 'ok' | 'expired' | 'mismatch'
  resendTwoFactor: () => Promise<void>
  cancelTwoFactor: () => void
  signOut: (reason?: 'user' | 'timeout') => void
  /** Signs a demo user straight in — used by the demo-user switcher. */
  switchTo: (userId: string) => void
  touch: () => void
  lastSignOutReason: 'user' | 'timeout' | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

const readSession = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useDb()
  const dispatch = useDispatch()
  const policy = db.securityPolicy

  const [session, setSession] = useState<StoredSession | null>(readSession)
  const [pendingChallenge, setPendingChallenge] = useState<OtpChallenge | null>(null)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [lastSignOutReason, setLastSignOutReason] = useState<'user' | 'timeout' | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const user = useMemo(
    () => (session ? (db.users.find((u) => u.id === session.userId) ?? null) : null),
    [session, db.users],
  )
  const pendingUser = useMemo(
    () => (pendingUserId ? (db.users.find((u) => u.id === pendingUserId) ?? null) : null),
    [pendingUserId, db.users],
  )

  const persistSession = useCallback((s: StoredSession | null) => {
    setSession(s)
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  }, [])

  const auditFor = useCallback(
    (u: User, action: string, detail: string) => ({
      actorUserId: u.id,
      actorName: u.fullName,
      actorRole: u.role,
      action,
      entityType: 'user',
      entityId: u.id,
      detail,
    }),
    [],
  )

  const establish = useCallback(
    (u: User) => {
      const at = Date.now()
      persistSession({ userId: u.id, startedAt: at, lastActivityAt: at })
      setPendingChallenge(null)
      setPendingUserId(null)
      setLastSignOutReason(null)
      dispatch({
        type: 'user/update',
        id: u.id,
        patch: { lastLoginOn: new Date(at).toISOString(), failedLoginCount: 0, lockedUntil: undefined },
        audit: auditFor(u, 'auth.login.success', `Signed in (${u.role})`),
      })
    },
    [dispatch, persistSession, auditFor],
  )

  const signOut = useCallback(
    (reason: 'user' | 'timeout' = 'user') => {
      if (user) {
        dispatch({
          type: 'audit/append',
          draft: auditFor(
            user,
            reason === 'timeout' ? 'auth.session.timeout' : 'auth.logout',
            reason === 'timeout'
              ? `Session expired after ${policy.sessionTimeoutMinutes} minutes of inactivity`
              : 'Signed out',
          ),
        })
      }
      persistSession(null)
      setPendingChallenge(null)
      setPendingUserId(null)
      setLastSignOutReason(reason)
    },
    [user, dispatch, persistSession, auditFor, policy.sessionTimeoutMinutes],
  )

  const startTwoFactor = useCallback(async (u: User) => {
    const channel = u.twoFactor.channel
    const sentTo = channel === 'email' ? u.email : channel === 'sms' ? u.phone : 'Authenticator app'
    const challenge = await issueOtp(channel, sentTo)
    setPendingChallenge(challenge)
    setPendingUserId(u.id)
  }, [])

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInOutcome> => {
      const target = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
      if (!target) return { status: 'unknown-user' }

      if (target.status === 'deactivated' || target.status === 'suspended') {
        return { status: 'deactivated' }
      }

      if (target.lockedUntil && new Date(target.lockedUntil).getTime() > Date.now()) {
        return { status: 'locked', until: target.lockedUntil }
      }

      const ok = await verifyPassword(password, target.salt, target.iterations, target.passwordHash)

      if (!ok) {
        const failed = target.failedLoginCount + 1
        const lock = failed >= policy.maxFailedLogins
        dispatch({
          type: 'user/update',
          id: target.id,
          patch: {
            failedLoginCount: failed,
            lockedUntil: lock
              ? new Date(Date.now() + policy.lockoutMinutes * 60_000).toISOString()
              : undefined,
          },
          audit: auditFor(
            target,
            lock ? 'auth.account.locked' : 'auth.login.failed',
            lock
              ? `Account locked after ${failed} failed attempts (${policy.lockoutMinutes} minute lockout)`
              : `Failed sign-in attempt ${failed} of ${policy.maxFailedLogins}`,
          ),
        })
        return lock
          ? { status: 'locked', until: new Date(Date.now() + policy.lockoutMinutes * 60_000).toISOString() }
          : { status: 'invalid', attemptsRemaining: Math.max(0, policy.maxFailedLogins - failed) }
      }

      if (target.twoFactor.enabled || policy.require2fa) {
        await startTwoFactor(target)
        return { status: 'needs-2fa' }
      }

      establish(target)
      return { status: 'ok' }
    },
    [db.users, policy, dispatch, auditFor, establish, startTwoFactor],
  )

  const signInWithSeyId = useCallback(
    async (clientId: string): Promise<SignInOutcome> => {
      const target = db.users.find((u) => u.clientId === clientId)
      if (!target) return { status: 'unknown-user' }
      if (target.status !== 'active') return { status: 'deactivated' }
      // SeyID always carries its own OTP step (i.8).
      const challenge = await issueOtp('sms', target.phone)
      setPendingChallenge(challenge)
      setPendingUserId(target.id)
      return { status: 'needs-2fa' }
    },
    [db.users],
  )

  const completeTwoFactor = useCallback(
    (code: string): 'ok' | 'expired' | 'mismatch' => {
      if (!pendingChallenge || !pendingUser) return 'expired'
      const result = verifyOtp(pendingChallenge, code)
      if (result === 'ok') establish(pendingUser)
      return result
    },
    [pendingChallenge, pendingUser, establish],
  )

  const resendTwoFactor = useCallback(async () => {
    if (pendingUser) await startTwoFactor(pendingUser)
  }, [pendingUser, startTwoFactor])

  const cancelTwoFactor = useCallback(() => {
    setPendingChallenge(null)
    setPendingUserId(null)
  }, [])

  const switchTo = useCallback(
    (userId: string) => {
      const target = db.users.find((u) => u.id === userId)
      if (target) establish(target)
    },
    [db.users, establish],
  )

  const touch = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev
      const at = Date.now()
      // Avoid a write (and a re-render) on every mousemove.
      if (at - prev.lastActivityAt < 5000) return prev
      const nextSession = { ...prev, lastActivityAt: at }
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession))
      return nextSession
    })
  }, [])

  /* --- session timeout (i.1) --- */
  const timeoutMs = policy.sessionTimeoutMinutes * 60_000
  const signOutRef = useRef(signOut)
  signOutRef.current = signOut

  useEffect(() => {
    if (!session) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [session])

  useEffect(() => {
    if (session && now - session.lastActivityAt >= timeoutMs) signOutRef.current('timeout')
  }, [now, session, timeoutMs])

  useEffect(() => {
    if (!session) return
    const handler = () => touch()
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel']
    for (const e of events) window.addEventListener(e, handler, { passive: true })
    return () => {
      for (const e of events) window.removeEventListener(e, handler)
    }
  }, [session, touch])

  const secondsRemaining = session
    ? Math.max(0, Math.ceil((session.lastActivityAt + timeoutMs - now) / 1000))
    : null

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role,
      policy,
      secondsRemaining,
      pendingChallenge,
      pendingUserName: pendingUser?.fullName ?? null,
      signIn,
      signInWithSeyId,
      completeTwoFactor,
      resendTwoFactor,
      cancelTwoFactor,
      signOut,
      switchTo,
      touch,
      lastSignOutReason,
    }),
    [
      user, policy, secondsRemaining, pendingChallenge, pendingUser, signIn, signInWithSeyId,
      completeTwoFactor, resendTwoFactor, cancelTwoFactor, signOut, switchTo, touch, lastSignOutReason,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/* ------------------------------------------------------------------ *
 * Password policy evaluation (i.1)
 * ------------------------------------------------------------------ */

export interface PolicyRule {
  id: string
  label: string
  met: boolean
}

export function evaluatePassword(password: string, policy: SecurityPolicy): PolicyRule[] {
  const rules: PolicyRule[] = [
    {
      id: 'length',
      label: `At least ${policy.minPasswordLength} characters`,
      met: password.length >= policy.minPasswordLength,
    },
  ]
  if (policy.requireUppercase) {
    rules.push({ id: 'upper', label: 'An upper-case letter', met: /[A-Z]/.test(password) })
  }
  if (policy.requireNumber) {
    rules.push({ id: 'number', label: 'A number', met: /\d/.test(password) })
  }
  if (policy.requireSymbol) {
    rules.push({ id: 'symbol', label: 'A symbol', met: /[^A-Za-z0-9]/.test(password) })
  }
  return rules
}

export const passwordMeetsPolicy = (password: string, policy: SecurityPolicy): boolean =>
  evaluatePassword(password, policy).every((r) => r.met)
