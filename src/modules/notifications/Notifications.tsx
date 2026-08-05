import { type FormEvent, useMemo, useState } from 'react';

import { Icon } from '../../components/Icon';
import { ReqBadge } from '../../components/ReqBadge';
import { useToast } from '../../components/Toast';
import { Card, chipClass, Field, PageHeader, SimBadge, Stat } from '../../components/ui';
import { fmtDateTime } from '../../lib/format';
import { makeNotification } from '../../lib/sim';
import { useClientName, useStore } from '../../lib/store';
import type { NotificationChannel } from '../../lib/types';

const TEMPLATES = [
  { code: 'loan_status', name: 'Loan status update', channels: 'SMS · Email · In-app' },
  { code: 'lab_result', name: 'Laboratory result ready', channels: 'SMS · In-app' },
  { code: 'lease_expiry', name: 'Lease expiry reminder', channels: 'SMS · Email' },
  { code: 'lease_payment', name: 'Lease payment reminder', channels: 'SMS' },
  { code: 'welcome', name: 'Account created', channels: 'SMS' },
];

const CHANNEL_ICON: Record<NotificationChannel, 'notifications'> = {
  email: 'notifications',
  sms: 'notifications',
  in_app: 'notifications',
};

export function Notifications() {
  const { db, patch, upsert } = useStore();
  const { push } = useToast();
  const clientName = useClientName();
  const [channel, setChannel] = useState<'' | NotificationChannel>('');
  const [message, setMessage] = useState('');

  const rows = useMemo(
    () =>
      db.notifications
        .filter((n) => !channel || n.channel === channel)
        .slice()
        .reverse(),
    [db.notifications, channel],
  );

  const kpi = {
    total: db.notifications.length,
    sms: db.notifications.filter((n) => n.channel === 'sms').length,
    email: db.notifications.filter((n) => n.channel === 'email').length,
    unread: db.notifications.filter((n) => n.status !== 'read').length,
  };

  const markRead = (id: string) => patch('notifications', id, { status: 'read' });

  const sendFeedback = (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    upsert(
      'notifications',
      makeNotification({
        channel: 'in_app',
        to: 'support@demo',
        subject: 'Farmer feedback',
        body: message,
        template: 'feedback',
        event: 'feedback.submitted',
      }),
    );
    setMessage('');
    push('Feedback submitted (simulated)', 'success');
  };

  return (
    <div>
      <PageHeader
        title="Notifications & Communication"
        code="S13"
        icon="notifications"
        subtitle="Status and result notifications across channels"
        actions={<ReqBadge id={['xiii.1', 'xiii.2', 'xiii.3', 'xiii.4']} />}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Notifications" value={kpi.total} />
        <Stat label="SMS" value={kpi.sms} tone="primary" />
        <Stat label="Email" value={kpi.email} />
        <Stat label="Unread" value={kpi.unread} tone="warn" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="mb-3 flex flex-wrap items-center gap-2 p-3">
            <span className="text-xs font-medium text-slate-400">Channel</span>
            {(['', 'sms', 'email', 'in_app'] as const).map((c) => (
              <button
                key={c || 'all'}
                type="button"
                onClick={() => setChannel(c)}
                className={chipClass(channel === c)}
              >
                {c === '' ? 'All' : c === 'in_app' ? 'In-app' : c.toUpperCase()}
              </button>
            ))}
            <span className="ml-auto">
              <SimBadge label="SMS/email simulated" />
            </span>
          </Card>
          <Card className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">No notifications.</p>
            ) : (
              rows.slice(0, 30).map((n) => (
                <div key={n.id} className="flex items-start gap-3 p-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                    <Icon name={CHANNEL_ICON[n.channel]} size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{n.subject}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                        {n.channel === 'in_app' ? 'in-app' : n.channel}
                      </span>
                      {n.status !== 'read' && (
                        <span className="h-2 w-2 rounded-full bg-primary-500" />
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{n.body}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {fmtDateTime(n.createdAt)} · template {n.template}
                      {n.clientId ? ` · ${clientName(n.clientId)}` : ''}
                    </p>
                  </div>
                  {n.status !== 'read' && (
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-xs"
                      onClick={() => markRead(n.id)}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              Templates <ReqBadge id="xiii.3" />
            </h2>
            <ul className="space-y-2">
              {TEMPLATES.map((t) => (
                <li key={t.code} className="rounded-md border border-slate-100 p-2 text-sm">
                  <div className="font-medium text-slate-700">{t.name}</div>
                  <div className="text-xs text-slate-400">
                    {t.code} · {t.channels}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-400">
              Templates are configurable (i18n / Creole-ready).
            </p>
          </Card>
          <Card className="p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              Feedback <ReqBadge id="xiii.5" />
            </h2>
            <form onSubmit={sendFeedback} className="space-y-2">
              <Field label="Message">
                <textarea
                  className="input"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Send a message to the department…"
                />
              </Field>
              <button type="submit" className="btn-primary w-full">
                Send
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
