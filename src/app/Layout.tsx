// Application shell: neutral government header, RBAC-filtered sidebar, and the
// mandatory fictional-data footer (with Reset Demo Data + ReqBadge toggle).
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Icon, type IconName } from '../components/Icon';
import { cx } from '../components/ui';
import { landingPath, screensFor } from '../lib/rbac';
import { useStore } from '../lib/store';
import { ROLE_LABELS } from '../lib/types';
import { useAuth } from './auth';
import { useRefs } from './RefsContext';

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-md bg-white/15 text-lg"
        aria-hidden
      >
        🌾
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-white">Agriculture Information System</div>
        <div className="text-[11px] text-primary-100">Republic of Seychelles</div>
      </div>
    </div>
  );
}

export function Layout() {
  const { user, logout, switchUser } = useAuth();
  const { db, reset } = useStore();
  const { enabled, toggle } = useRefs();
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();

  if (!user) return null;
  const nav = screensFor(user.role);

  const onReset = () => {
    if (window.confirm('Reset all demo data back to the seeded state?')) {
      reset();
      navigate(landingPath(user.role));
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 bg-primary-700 px-4 py-2.5 shadow">
        <button
          type="button"
          className="rounded p-1 text-white lg:hidden"
          onClick={() => setNavOpen((o) => !o)}
          aria-label="Toggle navigation"
        >
          <Icon name="menu" size={22} />
        </button>
        <Brand />
        <span className="ml-1 hidden rounded bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 sm:inline">
          Prototype · Demonstration build
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="hidden items-center gap-1.5 sm:flex">
            <span className="text-[11px] uppercase tracking-wide text-primary-100">Demo user</span>
            <select
              value={user.id}
              onChange={(e) => switchUser(e.target.value)}
              className="rounded border border-primary-500 bg-primary-600 px-2 py-1 text-xs text-white focus:outline-none"
            >
              {db.users.map((u) => (
                <option key={u.id} value={u.id} disabled={!u.active}>
                  {u.name} — {ROLE_LABELS[u.role]}
                  {u.active ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-white hover:bg-primary-600"
          >
            <Icon name="logout" size={16} /> <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={cx(
            'fixed inset-y-0 left-0 top-[52px] z-30 w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-3 py-4 transition-transform lg:static lg:top-0 lg:translate-x-0',
            navOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {ROLE_LABELS[user.role]}
          </div>
          <nav className="flex flex-col gap-0.5">
            {nav.map((s) => (
              <NavLink
                key={s.key}
                to={s.path}
                onClick={() => setNavOpen(false)}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600 hover:bg-slate-100',
                  )
                }
              >
                <Icon name={s.key as IconName} size={18} />
                <span className="flex-1">{s.label}</span>
                <span className="font-mono text-[10px] text-slate-400">{s.code}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        {navOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 top-[52px] z-20 bg-slate-900/30 lg:hidden"
            onClick={() => setNavOpen(false)}
          />
        )}

        {/* Main */}
        <main className="min-w-0 flex-1 bg-slate-50 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium text-amber-700">
            FICTIONAL DEMONSTRATION DATA — invented names, 999- NINs, simulated integrations. Not an
            official record.
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              className="flex items-center gap-1 hover:text-slate-700"
            >
              <Icon name="shield" size={14} /> Requirement badges: {enabled ? 'on' : 'off'}
            </button>
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 hover:text-slate-700"
            >
              <Icon name="reset" size={14} /> Reset demo data
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
