// Route guards that actually enforce RBAC (req xi.3/xi.5). Switching demo user
// changes which routes resolve and which redirect.
import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { canAccess, landingPath, type ScreenKey } from '../lib/rbac';
import { useAuth } from './auth';

export function RequireStaff({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role === 'farmer') return <Navigate to="/portal" replace />;
  return <>{children}</>;
}

export function RequireFarmer({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'farmer') return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}

export function RequireScreen({ screen, children }: { screen: ScreenKey; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccess(user.role, screen)) return <Forbidden />;
  return <>{children}</>;
}

function Forbidden() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-800">403 — Access restricted</h1>
      <p className="mt-2 text-sm text-slate-500">
        Your role ({user?.role}) does not have permission to view this area. This is RBAC being
        enforced, not a bug — switch the demo user to an authorised role.
      </p>
      <Link to={user ? landingPath(user.role) : '/login'} className="btn-primary mt-6">
        Back to my dashboard
      </Link>
    </div>
  );
}
