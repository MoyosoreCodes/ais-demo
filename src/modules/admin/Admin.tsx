// S11 — administration. User lifecycle, the enforced RBAC matrix, the metadata
// workflow configurator (edit approval stages with no code change), and the
// append-only audit log.
import { type FormEvent, useState } from 'react';

import { useAuth } from '../../app/auth';
import { Icon } from '../../components/Icon';
import { ReqBadge } from '../../components/ReqBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { Card, cx, Field, Modal, PageHeader } from '../../components/ui';
import { fmtDateTime, nowIso, titleCase } from '../../lib/format';
import { uid } from '../../lib/ids';
import { ACCESS, SCREENS } from '../../lib/rbac';
import { useStore } from '../../lib/store';
import {
  type AuditCategory,
  type AuditEntry,
  type Role,
  ROLE_LABELS,
  ROLES,
  type User,
  type WorkflowStage,
} from '../../lib/types';

type Tab = 'users' | 'roles' | 'workflows' | 'audit';

const TABS: { key: Tab; label: string; ref: string }[] = [
  { key: 'users', label: 'Users', ref: 'i.3' },
  { key: 'roles', label: 'RBAC matrix', ref: 'i.2' },
  { key: 'workflows', label: 'Workflows', ref: 'xi.6' },
  { key: 'audit', label: 'Audit log', ref: 'i.7' },
];

export function Admin() {
  const [tab, setTab] = useState<Tab>('users');
  return (
    <div>
      <PageHeader
        title="Administration"
        code="S11"
        icon="admin"
        subtitle="Users, access control, workflows and the audit trail"
      />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cx(
              'relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium',
              tab === t.key ? 'text-primary-700' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label} <ReqBadge id={t.ref} />
            {tab === t.key && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-primary-600" />
            )}
          </button>
        ))}
      </div>
      {tab === 'users' && <Users />}
      {tab === 'roles' && <RoleMatrix />}
      {tab === 'workflows' && <Workflows />}
      {tab === 'audit' && <AuditLog />}
    </div>
  );
}

// ── Users ────────────────────────────────────────────────────────────────
function Users() {
  const { db, upsert, patch } = useStore();
  const { user } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', role: 'agriculture_officer' as Role });

  const audit = (action: string, detail: string, entityId?: string) =>
    upsert('audit', {
      id: uid('AUD'),
      at: nowIso(),
      actor: user?.name ?? 'system',
      actorRole: user?.role ?? 'system',
      action,
      category: 'admin',
      detail,
      entity: 'user',
      entityId,
    } satisfies AuditEntry);

  const toggleActive = (u: User) => {
    patch('users', u.id, { active: !u.active });
    audit(
      u.active ? 'user.deactivate' : 'user.activate',
      `${u.active ? 'Deactivated' : 'Reactivated'} ${u.name}`,
      u.id,
    );
  };
  const changeRole = (u: User, role: Role) => {
    patch('users', u.id, { role });
    audit('user.modify', `Changed ${u.name} role to ${ROLE_LABELS[role]}`, u.id);
  };
  const create = (e: FormEvent) => {
    e.preventDefault();
    const newUser: User = {
      id: uid('USR'),
      username: form.username || `${form.name.split(' ')[0]?.toLowerCase()}@demo`,
      name: form.name,
      role: form.role,
      active: true,
      password: 'Demo2026!',
      twoFactor: false,
    };
    upsert('users', newUser);
    audit('user.create', `Created ${newUser.name} (${ROLE_LABELS[newUser.role]})`, newUser.id);
    setForm({ name: '', username: '', role: 'agriculture_officer' });
    setAddOpen(false);
  };

  return (
    <Card className="p-1 sm:p-2">
      <div className="flex justify-end p-2">
        <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
          <Icon name="plus" size={16} /> Create user
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Username</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">2FA</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {db.users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2.5 font-medium text-slate-800">{u.name}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{u.username}</td>
                <td className="px-3 py-2.5">
                  <select
                    className="rounded border border-slate-200 px-1.5 py-1 text-xs"
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value as Role)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  {u.twoFactor ? (
                    <span className="text-primary-600">on</span>
                  ) : (
                    <span className="text-slate-400">off</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={u.active ? 'active' : 'inactive'} />
                </td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    className="btn-secondary py-1 text-xs"
                    onClick={() => toggleActive(u)}
                  >
                    {u.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Create user account"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="add-user" className="btn-primary">
              Create
            </button>
          </>
        }
      >
        <form id="add-user" onSubmit={create} className="space-y-3">
          <Field label="Full name" required>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Username / email">
            <input
              className="input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </Field>
          <Field label="Role">
            <select
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-slate-400">
            Default password Demo2026! — the user is prompted to change it at first login
            (simulated).
          </p>
        </form>
      </Modal>
    </Card>
  );
}

// ── RBAC matrix ──────────────────────────────────────────────────────────
function RoleMatrix() {
  return (
    <Card className="p-4">
      <p className="mb-3 text-sm text-slate-500">
        Access is enforced by route guards — switch the demo user in the header and the sidebar and
        reachable routes change. A farmer login cannot reach any of these back-office screens.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2 font-medium">Screen</th>
              {ROLES.filter((r) => r !== 'farmer').map((r) => (
                <th key={r} className="px-2 py-2 text-center font-medium">
                  {ROLE_LABELS[r].split(' ')[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCREENS.map((s) => (
              <tr key={s.key} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2">
                  <span className="font-medium text-slate-700">{s.label}</span>{' '}
                  <span className="font-mono text-[10px] text-slate-400">{s.code}</span>
                </td>
                {ROLES.filter((r) => r !== 'farmer').map((r) => (
                  <td key={r} className="px-2 py-2 text-center">
                    {ACCESS[r].includes(s.key) ? (
                      <Icon name="check" size={15} className="mx-auto text-primary-600" />
                    ) : (
                      <span className="text-slate-300">–</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Workflow configurator ────────────────────────────────────────────────
function Workflows() {
  const { db, patch, upsert } = useStore();
  const { user } = useAuth();

  const save = (id: string, stages: WorkflowStage[]) => {
    const reordered = stages.map((s, i) => ({ ...s, order: i + 1 }));
    patch('workflows', id, { stages: reordered });
    upsert('audit', {
      id: uid('AUD'),
      at: nowIso(),
      actor: user?.name ?? 'system',
      actorRole: user?.role ?? 'system',
      action: 'workflow.configure',
      category: 'workflow',
      detail: `Updated ${id} approval stages (${reordered.length} stages)`,
      entity: 'workflow',
      entityId: id,
    } satisfies AuditEntry);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {db.workflows.map((wf) => (
        <Card key={wf.id} className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">{wf.name}</h3>
            <span className="font-mono text-xs text-slate-400">{wf.id}</span>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Approval stages are metadata — edits take effect immediately with no redeploy.
          </p>
          <ol className="space-y-2">
            {wf.stages.map((st, i) => (
              <li
                key={st.id}
                className="flex items-center gap-2 rounded-md border border-slate-200 p-2"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
                  {i + 1}
                </span>
                <input
                  className="input flex-1 py-1"
                  value={st.name}
                  onChange={(e) =>
                    save(
                      wf.id,
                      wf.stages.map((s) => (s.id === st.id ? { ...s, name: e.target.value } : s)),
                    )
                  }
                />
                <select
                  className="rounded border border-slate-200 px-1.5 py-1 text-xs"
                  value={st.actorRole}
                  onChange={(e) =>
                    save(
                      wf.id,
                      wf.stages.map((s) =>
                        s.id === st.id ? { ...s, actorRole: e.target.value as Role } : s,
                      ),
                    )
                  }
                >
                  {ROLES.filter((r) => r !== 'farmer').map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-ghost px-1 py-1"
                  aria-label="Remove stage"
                  onClick={() =>
                    save(
                      wf.id,
                      wf.stages.filter((s) => s.id !== st.id),
                    )
                  }
                >
                  <Icon name="x" size={14} />
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="btn-secondary mt-3 py-1 text-xs"
            onClick={() =>
              save(wf.id, [
                ...wf.stages,
                {
                  id: uid('stage'),
                  name: 'New stage',
                  actorRole: 'supervisor',
                  order: wf.stages.length + 1,
                },
              ])
            }
          >
            <Icon name="plus" size={14} /> Add stage
          </button>
        </Card>
      ))}
    </div>
  );
}

// ── Audit log ────────────────────────────────────────────────────────────
function AuditLog() {
  const { db } = useStore();
  const [filter, setFilter] = useState<AuditCategory | ''>('');
  const rows = db.audit
    .filter((a) => !filter || a.category === filter)
    .slice()
    .reverse();

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-slate-500">Append-only activity & login trail.</span>
        <select
          className="ml-auto rounded border border-slate-200 px-2 py-1 text-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value as AuditCategory | '')}
        >
          <option value="">All categories</option>
          <option value="auth">Auth</option>
          <option value="workflow">Workflow</option>
          <option value="admin">Admin</option>
          <option value="data">Data</option>
        </select>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((a) => (
          <li key={a.id} className="flex items-start gap-3 py-2 text-sm">
            <span className="mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">
              {a.category}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-medium text-slate-800">{titleCase(a.action)}</span>
              <span className="text-slate-500"> — {a.detail}</span>
              <span className="block text-xs text-slate-400">
                {fmtDateTime(a.at)} · {a.actor}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
