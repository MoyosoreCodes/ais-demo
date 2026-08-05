// S01 — farmer home. Everything shown is the farmer's own linked records, proving
// the "one identity reused everywhere" theme from the farmer's side.
import { useMemo } from 'react';

import { useAuth } from '../../app/auth';
import { Icon } from '../../components/Icon';
import { ReqBadge } from '../../components/ReqBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { Card, SimBadge } from '../../components/ui';
import { fmtDate, scr } from '../../lib/format';
import { useStore } from '../../lib/store';

export function FarmerPortal() {
  const { user, logout } = useAuth();
  const { db } = useStore();
  const clientId = user?.clientId;

  const data = useMemo(() => {
    const client = db.clients.find((c) => c.id === clientId);
    return {
      client,
      farms: db.farms.filter((f) => f.clientId === clientId && f.status === 'active'),
      loans: db.loans.filter((l) => l.clientId === clientId),
      samples: db.samples.filter((s) => s.clientId === clientId),
      cases: db.surveillanceCases.filter((s) => s.clientId === clientId),
      notifications: db.notifications
        .filter((n) => n.clientId === clientId)
        .slice()
        .reverse(),
    };
  }, [db, clientId]);

  const { client, farms, loans, samples, cases, notifications } = data;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center gap-3 bg-primary-700 px-4 py-2.5 text-white shadow">
        <span className="text-lg">🌾</span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">My AIS account</div>
          <div className="text-[11px] text-primary-100">Republic of Seychelles · Farmer portal</div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-primary-600"
        >
          <Icon name="logout" size={16} /> Sign out
        </button>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6">
        <Card className="mb-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Welcome, {client?.firstName ?? user?.name}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                NIN <span className="font-mono">{client?.nin}</span> · {client?.district}
              </p>
            </div>
            {client?.seyidVerified && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">
                <Icon name="shield" size={16} /> Verified via SeyID <SimBadge />
              </span>
            )}
          </div>
        </Card>

        <div className="grid gap-5 sm:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
              <Icon name="farms" size={18} /> My farms <ReqBadge id="ii.5" />
            </h2>
            {farms.length === 0 ? (
              <p className="text-sm text-slate-400">No farms registered yet.</p>
            ) : (
              <ul className="space-y-2">
                {farms.map((f) => (
                  <li key={f.id} className="rounded-md border border-slate-100 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">{f.name}</span>
                      <StatusBadge status={f.verificationStatus} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {f.id} · {f.sizeHa} ha · {f.district} ·{' '}
                      {f.crops.concat(f.livestock).join(', ')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
              <Icon name="loans" size={18} /> My loans <ReqBadge id="v.4" />
            </h2>
            {loans.length === 0 ? (
              <p className="text-sm text-slate-400">No loan applications.</p>
            ) : (
              <ul className="space-y-2">
                {loans.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between rounded-md border border-slate-100 p-3"
                  >
                    <span>
                      <span className="block text-sm font-medium text-slate-800">
                        {scr(l.amountSCR)}
                      </span>
                      <span className="text-xs text-slate-500">{l.purpose}</span>
                    </span>
                    <StatusBadge status={l.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
              <Icon name="lab" size={18} /> Lab results <ReqBadge id="vi.8" />
            </h2>
            {samples.length === 0 ? (
              <p className="text-sm text-slate-400">No samples submitted.</p>
            ) : (
              <ul className="space-y-2">
                {samples.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-md border border-slate-100 p-3"
                  >
                    <span className="text-sm capitalize text-slate-700">
                      {s.type} sample{' '}
                      <span className="font-mono text-xs text-slate-400">{s.id}</span>
                    </span>
                    <StatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
              <Icon name="notifications" size={18} /> Notifications
            </h2>
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-400">No notifications.</p>
            ) : (
              <ul className="space-y-2">
                {notifications.slice(0, 5).map((n) => (
                  <li key={n.id} className="rounded-md border border-slate-100 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">{n.subject}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                        {n.channel}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{fmtDate(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {cases.length > 0 && (
            <Card className="p-5 sm:col-span-2">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
                <Icon name="surveillance" size={18} /> Animal health cases
              </h2>
              <ul className="space-y-2">
                {cases.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-md border border-slate-100 p-3"
                  >
                    <span className="text-sm text-slate-700">
                      {c.suspectedDisease} · {c.species}
                    </span>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-3 text-center text-xs font-medium text-amber-700">
        FICTIONAL DEMONSTRATION DATA — not an official record.
      </footer>
    </div>
  );
}
