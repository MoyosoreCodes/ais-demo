/**
 * Route guards (i.2, xi.3, xi.5).
 *
 * These are the enforcement point, not a decoration: a farmer session cannot
 * reach an officer or admin route even by typing the URL. The same
 * `ROLE_PERMISSIONS` matrix backs both this guard and the S11 display.
 */

import { Link, Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { canAny } from '../lib/rbac'
import type { Permission } from '../lib/rbac'
import { ROLE_LABELS } from '../lib/types'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />
  }
  return <>{children}</>
}

export function RequirePermission({
  permissions,
  children,
}: {
  permissions: Permission[]
  children: ReactNode
}) {
  const { user, role } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />
  }

  if (!canAny(role, permissions)) {
    return <AccessDenied path={location.pathname} />
  }

  return <>{children}</>
}

export function AccessDenied({ path }: { path: string }) {
  const { user, role } = useAuth()
  const home = role === 'farmer' ? '/portal' : '/dashboard'

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="ais-card border-danger-200 p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-full bg-danger-50 p-2 text-danger-600">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3l8 4v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7z" />
              <path d="M12 9v4M12 16h.01" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <h1 className="text-lg font-semibold text-ink-900">Access denied</h1>
            <p className="mt-1 text-sm text-ink-600">
              Your role does not carry permission to open{' '}
              <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-xs">{path}</code>.
            </p>
            <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-ink-500">Signed in as</dt>
              <dd className="font-medium text-ink-900">{user?.fullName}</dd>
              <dt className="text-ink-500">Role</dt>
              <dd className="font-medium text-ink-900">{role ? ROLE_LABELS[role] : '—'}</dd>
            </dl>
            <p className="mt-4 text-sm text-ink-600">
              Role-based access control is enforced by the router, not only hidden in the menu — this
              is requirement <span className="font-mono text-xs font-semibold">xi.5</span> in effect.
              An administrator can review the permission matrix on the Administration screen.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to={home} className="ais-btn-primary">
                Return to my home screen
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
