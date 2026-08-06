import { Fragment, useMemo, useState } from 'react'
import { useAuth } from '../../app/AuthContext'
import { useDb, useDispatch } from '../../app/DataContext'
import { useToast } from '../../app/ToastContext'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { CheckboxField, SelectField, TextField } from '../../components/Field'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { ReqBadge } from '../../components/ReqBadge'
import { SimChip } from '../../components/SimChip'
import { StatusBadge } from '../../components/StatusBadge'
import { Tabs } from '../../components/Tabs'
import { WorkflowConfigurator } from './WorkflowConfigurator'
import { derivePasswordHash, randomSaltHex } from '../../lib/hash'
import { DEMO_TODAY, formatDate, formatDateTime, isValidPhone, localId } from '../../lib/format'
import { PERMISSION_GROUPS, PERMISSION_LABELS, ROLE_PERMISSIONS, can } from '../../lib/rbac'
import { verifyAuditChain } from '../../lib/store'
import { ROLE_LABELS, ROLES } from '../../lib/types'
import type { AuditEntry, Role, SecurityPolicy, User } from '../../lib/types'

const PBKDF2_ITERATIONS = 120000
const TEMP_PASSWORD = 'Demo2026!'

/**
 * S11 — administration (i.2, i.3, i.6, i.7; xi.3, xi.5).
 *
 * User lifecycle, the enforced RBAC matrix, the admin-configurable approval
 * hierarchies (xi.6), the security policy that drives sign-in, the configurable
 * farm-intake fields, and the hash-chained audit log.
 */
export function AdminScreen() {
  const { role } = useAuth()
  const [tab, setTab] = useState('users')

  const tabs = [
    ...(can(role, 'admin.users') ? [{ id: 'users', label: 'User accounts' }] : []),
    { id: 'rbac', label: 'Roles & permissions' },
    ...(can(role, 'admin.policy') ? [{ id: 'policy', label: 'Security policy' }] : []),
    ...(can(role, 'admin.workflows') ? [{ id: 'workflows', label: 'Approval workflows' }] : []),
    ...(can(role, 'admin.policy') ? [{ id: 'intake', label: 'Farm intake fields' }] : []),
    ...(can(role, 'admin.audit') ? [{ id: 'audit', label: 'Audit log' }] : []),
  ]

  const active = tabs.some((t) => t.id === tab) ? tab : (tabs[0]?.id ?? 'rbac')

  return (
    <div className="pb-6">
      <PageHeader
        screen="S11"
        title="Administration"
        description="Account lifecycle, the role permission matrix the router actually enforces, the configurable approval hierarchies, the security policy behind sign-in, and the append-only audit log."
        refs={['i.2', 'i.3', 'xi.3', 'xi.5', 'xi.6']}
      />

      <Tabs tabs={tabs} active={active} onChange={setTab} className="mb-4" />

      {active === 'users' && <UsersTab />}
      {active === 'rbac' && <RbacTab />}
      {active === 'workflows' && <WorkflowConfigurator />}
      {active === 'policy' && <PolicyTab />}
      {active === 'intake' && <IntakeTab />}
      {active === 'audit' && <AuditTab />}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * User accounts (i.3, i.6)
 * ------------------------------------------------------------------ */

function UsersTab() {
  const db = useDb()
  const dispatch = useDispatch()
  const { user } = useAuth()
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)

  const audit = (action: string, target: User, detail: string) =>
    user
      ? {
          actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
          action, entityType: 'user', entityId: target.id, detail,
        }
      : undefined

  const setStatus = (target: User, status: User['status']) => {
    dispatch({
      type: 'user/update',
      id: target.id,
      patch: { status },
      audit: audit(`user.${status}`, target, `Account status set to ${status}`),
    })
    toast({ tone: 'success', title: `Account ${status}`, body: target.fullName })
  }

  const releaseLock = (target: User) => {
    dispatch({
      type: 'user/update',
      id: target.id,
      patch: { lockedUntil: undefined, failedLoginCount: 0 },
      audit: audit('user.unlocked', target, 'Administrator released the account lock'),
    })
    toast({ tone: 'success', title: 'Lock released', body: `${target.fullName} can sign in again.` })
  }

  const resetPassword = async (target: User) => {
    const salt = randomSaltHex()
    const passwordHash = await derivePasswordHash(TEMP_PASSWORD, salt, PBKDF2_ITERATIONS)
    dispatch({
      type: 'user/update',
      id: target.id,
      patch: { salt, passwordHash, iterations: PBKDF2_ITERATIONS, mustResetPassword: true, failedLoginCount: 0, lockedUntil: undefined },
      audit: audit('user.password.reset', target, 'Administrator issued a temporary credential; user must reset at next sign-in'),
    })
    toast({
      tone: 'success',
      title: 'Temporary credential issued',
      body: `${target.fullName} must change the password at next sign-in.`,
      simulated: true,
    })
  }

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'User',
      sortValue: (u) => u.fullName,
      render: (u) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-900">{u.fullName}</p>
          <p className="truncate font-mono text-xs text-ink-500">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortValue: (u) => u.role,
      render: (u) => <span className="text-sm">{ROLE_LABELS[u.role]}</span>,
    },
    {
      key: 'twofa',
      header: '2FA',
      render: (u) => (
        <span className="inline-flex items-center gap-1.5 text-xs">
          {u.twoFactor.enabled ? (
            <>
              <StatusBadge status="active" label={u.twoFactor.channel.toUpperCase()} />
              <SimChip />
            </>
          ) : (
            <span className="text-ink-400">Off</span>
          )}
        </span>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Last sign-in',
      sortValue: (u) => u.lastLoginOn ?? '',
      render: (u) => <span className="text-sm">{u.lastLoginOn ? formatDateTime(u.lastLoginOn) : 'Never'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (u) => u.status,
      render: (u) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StatusBadge status={u.status} />
          {u.lockedUntil && new Date(u.lockedUntil) > new Date() && (
            <StatusBadge status="locked" tone="bad" label="Locked" />
          )}
          {u.mustResetPassword && <StatusBadge status="reset" tone="warn" label="Must reset" />}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (u) => (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="ais-btn-secondary px-2.5 py-1 text-xs" onClick={() => setEditing(u)}>
            Modify
          </button>
          {u.lockedUntil && new Date(u.lockedUntil) > new Date() && (
            <button type="button" className="ais-btn-secondary px-2.5 py-1 text-xs" onClick={() => releaseLock(u)}>
              Release lock
            </button>
          )}
          <button type="button" className="ais-btn-secondary px-2.5 py-1 text-xs" onClick={() => void resetPassword(u)}>
            Reset password
          </button>
          {u.status === 'active' ? (
            <button
              type="button"
              className="ais-btn-secondary px-2.5 py-1 text-xs text-danger-700"
              onClick={() => setStatus(u, 'deactivated')}
              disabled={u.id === user?.id}
              title={u.id === user?.id ? 'You cannot deactivate the account you are signed in with' : undefined}
            >
              Deactivate
            </button>
          ) : (
            <button type="button" className="ais-btn-secondary px-2.5 py-1 text-xs" onClick={() => setStatus(u, 'active')}>
              Reactivate
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm text-ink-600">
          {db.users.length} accounts across {new Set(db.users.map((u) => u.role)).size} roles
          <ReqBadge refs={['i.3', 'i.6']} screen="S11" />
        </p>
        <button type="button" className="ais-btn-primary" onClick={() => setCreateOpen(true)}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 4v12M4 10h12" strokeLinecap="round" />
          </svg>
          Create account
        </button>
      </div>

      <DataTable
        rows={db.users}
        columns={columns}
        rowKey={(u) => u.id}
        unit="accounts"
        pageSize={10}
        caption="User accounts"
        dense
      />

      <p className="mt-3 text-xs text-ink-500">
        Passwords are never stored or displayed in clear. A reset generates a new random salt and a
        fresh PBKDF2-SHA256 derived key; the temporary credential for this demonstration build is{' '}
        <code className="rounded bg-ink-100 px-1 py-0.5 font-mono">{TEMP_PASSWORD}</code>.
      </p>

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditUserDialog user={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDb()
  const dispatch = useDispatch()
  const { user } = useAuth()
  const { toast } = useToast()
  const [form, setForm] = useState({ fullName: '', email: '', role: 'agriculture_officer' as Role, phone: '', twoFactor: true })
  const [busy, setBusy] = useState(false)

  const emailClash = db.users.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase())
  const valid =
    form.fullName.trim().length > 1 && form.email.includes('@') === false
      ? false
      : form.fullName.trim().length > 1 && form.email.trim().length > 2 && !emailClash && isValidPhone(form.phone)

  const create = async () => {
    if (!user || !valid) return
    setBusy(true)
    try {
      const salt = randomSaltHex()
      const newUser: User = {
        id: localId('USR'),
        email: form.email.trim().toLowerCase(),
        fullName: form.fullName.trim(),
        role: form.role,
        status: 'active',
        createdOn: DEMO_TODAY.toISOString().slice(0, 10),
        phone: form.phone.trim(),
        salt,
        passwordHash: await derivePasswordHash(TEMP_PASSWORD, salt, PBKDF2_ITERATIONS),
        iterations: PBKDF2_ITERATIONS,
        twoFactor: { enabled: form.twoFactor, channel: 'sms', simulated: true },
        seyIdLinked: false,
        failedLoginCount: 0,
        mustResetPassword: true,
      }
      dispatch({
        type: 'user/create',
        user: newUser,
        audit: {
          actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
          action: 'user.created', entityType: 'user', entityId: newUser.id,
          detail: `${ROLE_LABELS[newUser.role]} account created for ${newUser.fullName}`,
        },
      })
      toast({ tone: 'success', title: 'Account created', body: `${newUser.fullName} · temporary credential issued.` })
      setForm({ fullName: '', email: '', role: 'agriculture_officer', phone: '', twoFactor: true })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create user account"
      size="md"
      description="The new account receives a temporary credential and must set a password at first sign-in."
      footer={
        <>
          <button type="button" className="ais-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="ais-btn-primary" onClick={() => void create()} disabled={!valid || busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Full name" required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="M. Confait" />
        <TextField
          label="Email" type="email" required value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="officer3@demo"
          error={emailClash ? 'An account already uses this email address.' : undefined}
        />
        <TextField
          label="Mobile" required value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="+248 2 000 000"
          hint="Demonstration numbers use the pattern +248 2 000 0xx."
          error={form.phone.length > 0 && !isValidPhone(form.phone) ? 'Expected +248 2 000 0xx.' : undefined}
        />
        <SelectField label="Role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </SelectField>
        <CheckboxField
          label={
            <span className="inline-flex flex-wrap items-center gap-2">
              Require two-factor authentication <SimChip />
            </span>
          }
          checked={form.twoFactor}
          onChange={(e) => setForm((f) => ({ ...f, twoFactor: e.target.checked }))}
        />
      </div>
    </Modal>
  )
}

function EditUserDialog({ user: target, onClose }: { user: User | null; onClose: () => void }) {
  const dispatch = useDispatch()
  const { user } = useAuth()
  const { toast } = useToast()
  const [role, setRole] = useState<Role>('agriculture_officer')
  const [twoFactor, setTwoFactor] = useState(false)
  const [initialised, setInitialised] = useState<string | null>(null)

  if (target && initialised !== target.id) {
    setRole(target.role)
    setTwoFactor(target.twoFactor.enabled)
    setInitialised(target.id)
  }

  const save = () => {
    if (!target || !user) return
    const changes: string[] = []
    if (role !== target.role) changes.push(`role ${ROLE_LABELS[target.role]} → ${ROLE_LABELS[role]}`)
    if (twoFactor !== target.twoFactor.enabled) changes.push(`2FA ${twoFactor ? 'enabled' : 'disabled'}`)
    if (!changes.length) {
      onClose()
      return
    }
    dispatch({
      type: 'user/update',
      id: target.id,
      patch: { role, twoFactor: { ...target.twoFactor, enabled: twoFactor } },
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'user.modified', entityType: 'user', entityId: target.id,
        detail: `Account modified — ${changes.join('; ')}`,
      },
    })
    toast({ tone: 'success', title: 'Account updated', body: changes.join('; ') })
    onClose()
  }

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={`Modify ${target?.fullName ?? ''}`}
      size="sm"
      footer={
        <>
          <button type="button" className="ais-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="ais-btn-primary" onClick={save}>Save changes</button>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          hint="Changing the role immediately changes what this account can reach — the router enforces the matrix."
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </SelectField>
        <CheckboxField
          label={<span className="inline-flex flex-wrap items-center gap-2">Require two-factor authentication <SimChip /></span>}
          checked={twoFactor}
          onChange={(e) => setTwoFactor(e.target.checked)}
        />
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ *
 * RBAC matrix (i.2, xi.3, xi.5)
 * ------------------------------------------------------------------ */

function RbacTab() {
  const db = useDb()

  return (
    <div>
      <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
        <p className="inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-brand-900">
          This matrix is the enforcement point
          <ReqBadge refs={['i.2', 'xi.3', 'xi.5']} screen="S11" />
        </p>
        <p className="mt-1 text-sm text-brand-800">
          The router reads the same table. Switch to a farmer account and the officer routes return
          an access-denied page rather than merely hiding the menu item. Try{' '}
          <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">#/clients</code> while
          signed in as <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">farmer@demo</code>.
        </p>
      </div>

      <div className="ais-card overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <caption className="sr-only">Role permission matrix</caption>
          <thead>
            <tr className="border-b border-ink-200 bg-ink-50">
              <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-600">
                Permission
              </th>
              {ROLES.map((r) => (
                <th key={r} scope="col" className="px-2 py-2.5 text-center text-xs font-semibold text-ink-700">
                  {ROLE_LABELS[r]}
                  <span className="mt-0.5 block text-[10px] font-normal text-ink-400">
                    {db.users.filter((u) => u.role === r).length} account
                    {db.users.filter((u) => u.role === r).length === 1 ? '' : 's'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => (
              <Fragment key={group.group}>
                <tr className="bg-ink-50/60">
                  <th
                    scope="colgroup"
                    colSpan={ROLES.length + 1}
                    className="px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-ink-500"
                  >
                    {group.group}
                  </th>
                </tr>
                {group.permissions.map((p) => (
                  <tr key={p} className="border-b border-ink-100 last:border-0">
                    <th scope="row" className="px-3 py-2 text-left text-sm font-normal text-ink-800">
                      {PERMISSION_LABELS[p]}
                      <span className="ml-2 font-mono text-[10px] text-ink-400">{p}</span>
                    </th>
                    {ROLES.map((r) => {
                      const granted = ROLE_PERMISSIONS[r].includes(p)
                      return (
                        <td key={r} className="px-2 py-2 text-center">
                          {granted ? (
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700"
                              title={`${ROLE_LABELS[r]} — granted`}
                            >
                              ✓
                            </span>
                          ) : (
                            <span className="text-ink-300" title={`${ROLE_LABELS[r]} — denied`}>
                              ·
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Security policy (i.1)
 * ------------------------------------------------------------------ */

function PolicyTab() {
  const db = useDb()
  const dispatch = useDispatch()
  const { user } = useAuth()
  const { toast } = useToast()
  const [draft, setDraft] = useState<SecurityPolicy>(db.securityPolicy)

  const set = <K extends keyof SecurityPolicy>(k: K, v: SecurityPolicy[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))

  const dirty = JSON.stringify(draft) !== JSON.stringify(db.securityPolicy)

  const save = () => {
    if (!user) return
    const changed = (Object.keys(draft) as (keyof SecurityPolicy)[])
      .filter((k) => draft[k] !== db.securityPolicy[k])
      .map((k) => `${k}: ${String(db.securityPolicy[k])} → ${String(draft[k])}`)
    dispatch({
      type: 'policy/update',
      patch: draft,
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'policy.updated', entityType: 'security_policy', entityId: 'global',
        detail: `Security policy updated — ${changed.join('; ')}`,
      },
    })
    toast({ tone: 'success', title: 'Security policy updated', body: 'Applies to the next sign-in.' })
  }

  return (
    <div className="max-w-3xl">
      <div className="ais-card p-4">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
          Password, lockout and session policy
          <ReqBadge refs="i.1" screen="S11" />
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          These values drive the sign-in screen, the registration form and the session timer
          directly. Change one and sign out — the new rule applies immediately, with no redeployment.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField
            label="Minimum password length" type="number" min="6" max="32"
            value={draft.minPasswordLength}
            onChange={(e) => set('minPasswordLength', Number(e.target.value))}
          />
          <TextField
            label="Failed attempts before lockout" type="number" min="1" max="20"
            value={draft.maxFailedLogins}
            onChange={(e) => set('maxFailedLogins', Number(e.target.value))}
          />
          <TextField
            label="Lockout duration (minutes)" type="number" min="1" max="1440"
            value={draft.lockoutMinutes}
            onChange={(e) => set('lockoutMinutes', Number(e.target.value))}
          />
          <TextField
            label="Session timeout (minutes)" type="number" min="1" max="480"
            value={draft.sessionTimeoutMinutes}
            onChange={(e) => set('sessionTimeoutMinutes', Number(e.target.value))}
          />
        </div>

        <div className="mt-4 space-y-2.5">
          <CheckboxField label="Require an upper-case letter" checked={draft.requireUppercase} onChange={(e) => set('requireUppercase', e.target.checked)} />
          <CheckboxField label="Require a number" checked={draft.requireNumber} onChange={(e) => set('requireNumber', e.target.checked)} />
          <CheckboxField label="Require a symbol" checked={draft.requireSymbol} onChange={(e) => set('requireSymbol', e.target.checked)} />
          <CheckboxField
            label={<span className="inline-flex flex-wrap items-center gap-2">Require two-factor authentication for every account <SimChip /></span>}
            checked={draft.require2fa}
            onChange={(e) => set('require2fa', e.target.checked)}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="ais-btn-primary" onClick={save} disabled={!dirty}>
            Save policy
          </button>
          <button type="button" className="ais-btn-secondary" onClick={() => setDraft(db.securityPolicy)} disabled={!dirty}>
            Discard changes
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Configurable farm intake fields (iii.3 ★)
 * ------------------------------------------------------------------ */

function IntakeTab() {
  const db = useDb()
  const dispatch = useDispatch()
  const { user } = useAuth()
  const { toast } = useToast()

  const toggle = (id: string, enabled: boolean) => {
    if (!user) return
    const field = db.intakeFields.find((f) => f.id === id)
    if (!field || field.core) return
    dispatch({
      type: 'intake/update',
      id,
      patch: { enabled },
      audit: {
        actorUserId: user.id, actorName: user.fullName, actorRole: user.role,
        action: 'intake.field.toggled', entityType: 'intake_field', entityId: id,
        detail: `Farm intake field "${field.label}" ${enabled ? 'enabled' : 'disabled'}`,
      },
    })
    toast({
      tone: 'success',
      title: `Intake field ${enabled ? 'enabled' : 'disabled'}`,
      body: `“${field.label}” — the farm registration form updates immediately.`,
    })
  }

  return (
    <div className="max-w-3xl">
      <div className="ais-card p-4">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
          Farm registration intake fields
          <ReqBadge refs="iii.3" screen="S11" />
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          The S03 registration form renders from this configuration. Switch an optional field on or
          off and the form changes with no code deployment. Core fields carry Appendix A6
          requirements and cannot be removed.
        </p>

        <ul className="mt-4 space-y-2">
          {db.intakeFields.map((f) => (
            <li
              key={f.id}
              className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3 ${
                f.enabled ? 'border-brand-200 bg-brand-50/40' : 'border-ink-200'
              }`}
            >
              <div className="min-w-0">
                <p className="inline-flex flex-wrap items-center gap-2 text-sm font-medium text-ink-900">
                  {f.label}
                  <span className="font-mono text-[10px] text-ink-400">{f.id}</span>
                  {f.core && (
                    <span className="rounded border border-ink-300 px-1 py-0.5 text-[10px] font-bold uppercase text-ink-500">
                      core
                    </span>
                  )}
                  {f.refs && <ReqBadge refs={f.refs} screen="S11" />}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {f.kind}
                  {f.options ? ` · ${f.options.length} options` : ''}
                  {f.required ? ' · required' : ''}
                  {f.help ? ` · ${f.help}` : ''}
                </p>
              </div>
              <label className="inline-flex shrink-0 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={f.enabled}
                  disabled={f.core}
                  onChange={(e) => toggle(f.id, e.target.checked)}
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-600 disabled:opacity-40"
                />
                <span className={f.core ? 'text-ink-400' : 'text-ink-700'}>
                  {f.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Audit log (i.7, xi.4)
 * ------------------------------------------------------------------ */

function AuditTab() {
  const db = useDb()
  const [query, setQuery] = useState('')
  const [actor, setActor] = useState('all')
  const [kind, setKind] = useState('all')

  const verification = useMemo(() => verifyAuditChain(db.audit), [db.audit])

  const actionKinds = useMemo(
    () => [...new Set(db.audit.map((e) => e.action.split('.')[0]))].sort(),
    [db.audit],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...db.audit]
      .reverse()
      .filter((e) => {
        if (actor !== 'all' && e.actorUserId !== actor) return false
        if (kind !== 'all' && !e.action.startsWith(kind)) return false
        if (!q) return true
        return [e.id, e.actorName, e.action, e.entityType, e.entityId, e.detail]
          .join(' ')
          .toLowerCase()
          .includes(q)
      })
  }, [db.audit, query, actor, kind])

  const columns: Column<AuditEntry>[] = [
    {
      key: 'seq',
      header: '#',
      sortValue: (e) => e.seq,
      render: (e) => <span className="font-mono text-xs text-ink-500">{e.seq}</span>,
      headerClassName: 'w-12',
    },
    {
      key: 'at',
      header: 'Timestamp',
      sortValue: (e) => e.at,
      render: (e) => <span className="whitespace-nowrap text-sm">{formatDateTime(e.at)}</span>,
    },
    {
      key: 'actor',
      header: 'Actor',
      sortValue: (e) => e.actorName,
      render: (e) => (
        <span className="text-sm">
          {e.actorName}
          <span className="block text-xs text-ink-500">{ROLE_LABELS[e.actorRole]}</span>
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortValue: (e) => e.action,
      render: (e) => <code className="font-mono text-xs text-ink-800">{e.action}</code>,
    },
    {
      key: 'entity',
      header: 'Record',
      render: (e) => (
        <span className="text-xs">
          <span className="text-ink-500">{e.entityType}</span>
          <span className="block font-mono text-ink-700">{e.entityId}</span>
        </span>
      ),
    },
    {
      key: 'detail',
      header: 'Detail',
      render: (e) => <span className="text-sm text-ink-700">{e.detail}</span>,
    },
    {
      key: 'hash',
      header: 'Chain',
      render: (e) => (
        <code className="font-mono text-[10px] text-ink-400" title={`hash ${e.hash}\nprev ${e.prevHash}`}>
          {e.hash.slice(0, 10)}…
        </code>
      ),
      hideOnMobile: true,
    },
  ]

  return (
    <div>
      <div
        className={`mb-3 rounded-lg border p-3 ${
          verification.ok ? 'border-brand-200 bg-brand-50' : 'border-danger-300 bg-danger-50'
        }`}
      >
        <p className={`inline-flex flex-wrap items-center gap-2 text-sm font-semibold ${verification.ok ? 'text-brand-900' : 'text-danger-900'}`}>
          {verification.ok ? 'Audit chain verified' : 'Audit chain broken'}
          <ReqBadge refs={['i.7', 'xi.4']} screen="S11" />
        </p>
        <p className={`mt-1 text-sm ${verification.ok ? 'text-brand-800' : 'text-danger-800'}`}>
          {verification.ok ? (
            <>
              All {verification.checked} entries recomputed successfully. Each entry hashes its own
              contents together with the previous entry's hash (SHA-256), so altering or removing a
              historical entry breaks every hash after it — the log is append-only and tamper-evident.
            </>
          ) : (
            <>
              Verification failed at entry #{verification.brokenAtSeq} ({verification.reason}). The
              log has been altered outside the application.
            </>
          )}
        </p>
      </div>

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(e) => e.id}
        unit="audit entries"
        pageSize={15}
        dense
        caption="Audit log"
        emptyTitle="No audit entries match this filter"
        toolbar={
          <div className="ais-card p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label htmlFor="audit-search" className="ais-label">Search</label>
                <input
                  id="audit-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Actor, action, record ID or detail…"
                  className="ais-input"
                />
              </div>
              <div>
                <label htmlFor="audit-actor" className="ais-label">Actor</label>
                <select id="audit-actor" value={actor} onChange={(e) => setActor(e.target.value)} className="ais-input">
                  <option value="all">All actors</option>
                  {db.users.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="audit-kind" className="ais-label">Action type</label>
                <select id="audit-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="ais-input">
                  <option value="all">All actions</option>
                  {actionKinds.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-500">
              Seeded from {formatDate(db.audit[0]?.at)} · entries are appended by the application and
              never edited or deleted.
            </p>
          </div>
        }
      />
    </div>
  )
}
