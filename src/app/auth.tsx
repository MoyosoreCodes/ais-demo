// Auth context. Login validates against the seed users; the current user id is
// kept in localStorage so a refresh preserves the session. Logins are audited.
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { nowIso } from '../lib/format';
import { uid } from '../lib/ids';
import { useStore } from '../lib/store';
import type { AuditEntry, User } from '../lib/types';

const SESSION_KEY = 'ais-demo-user-v1';

interface AuthApi {
  user: User | null;
  login: (username: string, password: string) => User | null;
  logout: () => void;
  switchUser: (userId: string) => void;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { db, upsert } = useStore();
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem(SESSION_KEY));

  const user = useMemo(() => db.users.find((u) => u.id === userId) ?? null, [db.users, userId]);

  const setSession = useCallback((id: string | null) => {
    setUserId(id);
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  }, []);

  const auditLogin = useCallback(
    (u: User, detail: string) => {
      const entry: AuditEntry = {
        id: uid('AUD'),
        at: nowIso(),
        actor: u.name,
        actorRole: u.role,
        action: 'login',
        category: 'auth',
        detail,
      };
      upsert('audit', entry);
    },
    [upsert],
  );

  const login = useCallback<AuthApi['login']>(
    (username, password) => {
      const u = db.users.find(
        (x) => x.username.toLowerCase() === username.toLowerCase() && x.active,
      );
      if (!u || u.password !== password) return null;
      setSession(u.id);
      auditLogin(u, u.twoFactor ? 'Successful login (2FA)' : 'Successful login');
      return u;
    },
    [db.users, setSession, auditLogin],
  );

  const switchUser = useCallback<AuthApi['switchUser']>(
    (id) => {
      const u = db.users.find((x) => x.id === id);
      if (!u) return;
      setSession(id);
      auditLogin(u, 'Demo user switch');
    },
    [db.users, setSession, auditLogin],
  );

  const logout = useCallback(() => setSession(null), [setSession]);

  const api = useMemo<AuthApi>(
    () => ({ user, login, logout, switchUser }),
    [user, login, logout, switchUser],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
