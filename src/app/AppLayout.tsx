import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useDb, useDispatch } from './DataContext'
import { useRefsMode } from './RefsContext'
import { useToast } from './ToastContext'
import { NAV_GROUP_ORDER, NAV_ITEMS } from './nav'
import { Modal } from '../components/Modal'
import { canAny } from '../lib/rbac'
import { ROLE_LABELS } from '../lib/types'

export function AppLayout() {
  const { user, role, signOut, secondsRemaining, switchTo, policy } = useAuth()
  const db = useDb()
  const dispatch = useDispatch()
  const { enabled: refsOn, setEnabled: setRefsOn, seen } = useRefsMode()
  const { toast } = useToast()
  const location = useLocation()

  const [menuOpen, setMenuOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const visibleNav = NAV_ITEMS.filter((item) => canAny(role, item.permissions))
  const unread = db.notifications.filter(
    (n) => !n.read && (!user?.clientId || n.recipientClientId === user.clientId),
  ).length

  const doReset = () => {
    dispatch({ type: 'db/reset' })
    setResetOpen(false)
    toast({
      tone: 'success',
      title: 'Demo data reset',
      body: 'All records have been reseeded to the scripted starting state.',
    })
  }

  const timeoutWarning =
    secondsRemaining !== null && secondsRemaining <= 120 ? secondsRemaining : null

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      {/* ---------------------------------------------------------- Header */}
      <header className="sticky top-0 z-[500] border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-3 py-2.5 sm:px-5">
          <button
            type="button"
            className="rounded-md p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>

          <Link to={role === 'farmer' ? '/portal' : '/dashboard'} className="flex min-w-0 items-center gap-2.5">
            <img src="./crest.svg" alt="" className="h-9 w-9 shrink-0" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight text-ink-900 sm:text-base">
                Agriculture Information System
              </span>
              <span className="block truncate text-[11px] leading-tight text-ink-500 sm:text-xs">
                Republic of Seychelles · Department of Agriculture
              </span>
            </span>
          </Link>

          <span className="ml-1 hidden shrink-0 rounded border border-warn-300 bg-warn-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-warn-700 sm:inline-block">
            Prototype — demonstration build
          </span>

          <div className="ml-auto flex items-center gap-2">
            {timeoutWarning !== null && (
              <span
                className="hidden rounded border border-warn-300 bg-warn-50 px-2 py-1 text-xs font-semibold text-warn-700 sm:inline-block"
                role="status"
              >
                Session expires in {timeoutWarning}s
              </span>
            )}

            {user && (
              <>
                <button
                  type="button"
                  onClick={() => setSwitcherOpen(true)}
                  className="flex items-center gap-2 rounded-md border border-ink-300 px-2 py-1.5 text-left hover:bg-ink-50"
                  title="Switch demonstration user"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                    {user.fullName.split(/[\s.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('')}
                  </span>
                  <span className="hidden leading-tight sm:block">
                    <span className="block text-xs font-semibold text-ink-900">{user.fullName}</span>
                    <span className="block text-[11px] text-ink-500">{role ? ROLE_LABELS[role] : ''}</span>
                  </span>
                  <svg viewBox="0 0 20 20" className="h-4 w-4 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M6 8l4 4 4-4" strokeLinecap="round" />
                  </svg>
                </button>
                <button type="button" onClick={() => signOut('user')} className="ais-btn-secondary px-3 py-1.5 text-xs">
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-0">
        {/* ------------------------------------------------------ Sidebar */}
        <nav
          aria-label="Main"
          className={`${
            menuOpen ? 'block' : 'hidden'
          } w-full shrink-0 border-b border-ink-200 bg-white lg:sticky lg:top-[57px] lg:block lg:h-[calc(100vh-57px)] lg:w-64 lg:overflow-y-auto lg:border-b-0 lg:border-r`}
        >
          <div className="space-y-4 p-3">
            {NAV_GROUP_ORDER.map((group) => {
              const items = visibleNav.filter((i) => i.group === group)
              if (!items.length) return null
              return (
                <div key={group}>
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                    {group}
                  </p>
                  <ul className="space-y-0.5">
                    {items.map((item) => (
                      <li key={item.to}>
                        {item.ready ? (
                          <NavLink
                            to={item.to}
                            className={({ isActive }) =>
                              `flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium ${
                                isActive
                                  ? 'bg-brand-50 text-brand-800'
                                  : 'text-ink-700 hover:bg-ink-100 hover:text-ink-900'
                              }`
                            }
                          >
                            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                              <path d={item.icon} />
                            </svg>
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.to === '/notifications' && unread > 0 && (
                              <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {unread}
                              </span>
                            )}
                            {/* The offline queue has to be visible from
                                anywhere, not only on S10 (x.3). */}
                            {item.to === '/field-ops' && db.outbox.length > 0 && (
                              <span
                                title={`${db.outbox.length} capture(s) waiting on the device`}
                                className="rounded-full bg-warn-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
                              >
                                {db.outbox.length}
                              </span>
                            )}
                            {refsOn && (
                              <span className="font-mono text-[10px] font-bold text-ink-400">{item.screen}</span>
                            )}
                          </NavLink>
                        ) : (
                          <span
                            className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium text-ink-300"
                            title="Scheduled for a later build wave"
                          >
                            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                              <path d={item.icon} />
                            </svg>
                            <span className="flex-1 truncate">{item.label}</span>
                            <span className="rounded border border-ink-200 px-1 py-0.5 text-[9px] font-bold uppercase text-ink-400">
                              soon
                            </span>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </nav>

        {/* --------------------------------------------------------- Main */}
        <main className={`min-w-0 flex-1 px-4 py-5 sm:px-6 ${menuOpen ? 'hidden lg:block' : ''}`}>
          <Outlet />
        </main>
      </div>

      {/* ---------------------------------------------------------- Footer */}
      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-4 text-xs text-ink-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="rounded border border-danger-200 bg-danger-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-danger-700">
              Fictional demonstration data
            </span>
            <span>
              No real person, National Identification Number or telephone number appears in this
              prototype.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={refsOn}
                onChange={(e) => setRefsOn(e.target.checked)}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-600"
              />
              <span className="font-medium text-ink-700">
                Requirement badges
                {refsOn && <span className="ml-1 text-ink-400">({seen.length}/91 seen)</span>}
              </span>
            </label>
            <Link to="/coverage" className="ais-link">
              Traceability coverage
            </Link>
            <button type="button" onClick={() => setResetOpen(true)} className="ais-link">
              Reset demo data
            </button>
            <span className="text-ink-400">
              Session timeout {policy.sessionTimeoutMinutes} min
            </span>
          </div>
        </div>
      </footer>

      {/* ------------------------------------------------------- Dialogs */}
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset demonstration data"
        tone="warning"
        size="sm"
        description="Restores every record to the scripted starting state."
        footer={
          <>
            <button type="button" className="ais-btn-secondary" onClick={() => setResetOpen(false)}>
              Cancel
            </button>
            <button type="button" className="ais-btn-primary" onClick={doReset}>
              Reset demo data
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          Any client, farm, loan or laboratory record created during this walk-through will be
          discarded, and the seeded story records restored exactly as scripted. Nothing outside this
          browser is affected.
        </p>
      </Modal>

      <Modal
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        title="Switch demonstration user"
        size="md"
        description="Signing in as a different role changes what the navigation shows and what the router will open — role-based access control is enforced, not simulated."
      >
        <ul className="space-y-2">
          {db.users.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => {
                  switchTo(u.id)
                  setSwitcherOpen(false)
                }}
                disabled={u.status !== 'active'}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  u.id === user?.id
                    ? 'border-brand-400 bg-brand-50'
                    : 'border-ink-200 hover:border-brand-300 hover:bg-brand-50/50'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {u.fullName.split(/[\s.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-900">{u.fullName}</span>
                  <span className="block text-xs text-ink-500">
                    {ROLE_LABELS[u.role]} · {u.email}
                  </span>
                </span>
                {u.id === user?.id && (
                  <span className="text-xs font-semibold text-brand-700">Current</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ink-500">
          All demonstration accounts share the password <code className="rounded bg-ink-100 px-1 py-0.5 font-mono">Demo2026!</code>.
          Switching here bypasses the sign-in form so the walk-through stays brisk; the full
          authentication path — including lockout and second factor — is on the sign-in screen.
        </p>
      </Modal>
    </div>
  )
}
