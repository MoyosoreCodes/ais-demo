import { type FormEvent, type ReactNode, useState } from 'react';

import { useAuth } from '../../app/auth';
import { Icon } from '../../components/Icon';
import { MapPicker } from '../../components/MapPicker';
import { ReqBadge } from '../../components/ReqBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { Timeline } from '../../components/Timeline';
import { useToast } from '../../components/Toast';
import { Card, cx, Field, Modal, PageHeader, Stat } from '../../components/ui';
import { fmtDate, nowIso, titleCase } from '../../lib/format';
import { DISTRICT_CENTERS } from '../../lib/geo';
import { uid } from '../../lib/ids';
import { makeNotification } from '../../lib/sim';
import { useStore } from '../../lib/store';
import {
  type AuditEntry,
  type LandApplication,
  type LandStatus,
  type Lease,
  type Role,
  type WorkflowEvent,
} from '../../lib/types';

type Tab = 'applications' | 'leases' | 'enforcement';
const EXPIRY_WINDOW_DAYS = 45;

interface ActionDef {
  key: string;
  label: string;
  to: LandStatus;
  role: Role;
  needsAssessment?: boolean;
  createsLease?: boolean;
  createsEnforcement?: boolean;
}
const ACTIONS: Partial<Record<LandStatus, ActionDef[]>> = {
  submitted: [
    { key: 'assign', label: 'Assign for review', to: 'under_review', role: 'agriculture_officer' },
  ],
  under_review: [
    {
      key: 'schedule',
      label: 'Schedule assessment',
      to: 'assessment',
      role: 'agriculture_officer',
    },
  ],
  assessment: [
    {
      key: 'assess',
      label: 'Submit assessment',
      to: 'decision',
      role: 'field_officer',
      needsAssessment: true,
    },
  ],
  decision: [
    { key: 'approve', label: 'Allocate', to: 'allocated', role: 'supervisor' },
    { key: 'reject', label: 'Reject', to: 'rejected', role: 'supervisor' },
  ],
  allocated: [
    {
      key: 'lease',
      label: 'Create lease',
      to: 'leased',
      role: 'agriculture_officer',
      createsLease: true,
    },
  ],
  leased: [
    {
      key: 'flag',
      label: 'Flag non-compliance',
      to: 'enforcement',
      role: 'agriculture_officer',
      createsEnforcement: true,
    },
  ],
};

export function Land() {
  const [tab, setTab] = useState<Tab>('applications');
  return (
    <div>
      <PageHeader
        title="Land Management"
        code="S04"
        icon="land"
        subtitle="Allocation, assessment, leases and enforcement"
      />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {(['applications', 'leases', 'enforcement'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cx(
              'relative px-3 py-2 text-sm font-medium capitalize',
              tab === t ? 'text-primary-700' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t}
            {tab === t && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-primary-600" />
            )}
          </button>
        ))}
      </div>
      {tab === 'applications' && <Applications />}
      {tab === 'leases' && <Leases />}
      {tab === 'enforcement' && <Enforcement />}
    </div>
  );
}

// ── Applications ───────────────────────────────────────────────────────────
function Applications() {
  const { db, patch, upsert } = useStore();
  const { user } = useAuth();
  const { push } = useToast();
  const [openId, setOpenId] = useState<string | null>(null);

  const clientName = (id: string) => {
    const c = db.clients.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : id;
  };
  const active = openId ? db.landApplications.find((a) => a.id === openId) : undefined;
  const canRole = (role: Role) => user?.role === role || user?.role === 'admin';

  const audit = (action: string, detail: string, entityId: string) =>
    upsert('audit', {
      id: uid('AUD'),
      at: nowIso(),
      actor: user?.name ?? 'system',
      actorRole: user?.role ?? 'system',
      action,
      category: 'workflow',
      detail,
      entity: 'land',
      entityId,
    } satisfies AuditEntry);

  const run = (
    app: LandApplication,
    action: ActionDef,
    assessment?: LandApplication['assessment'],
  ) => {
    const event: WorkflowEvent = {
      at: nowIso(),
      by: user?.name ?? 'Officer',
      action: action.label,
      fromStatus: app.status,
      toStatus: action.to,
    };
    const patchData: Partial<LandApplication> = {
      status: action.to,
      history: [...app.history, event],
    };
    if (assessment) patchData.assessment = assessment;
    patch('landApplications', app.id, patchData);
    audit(`land.${action.key}`, `${app.id}: ${action.label}`, app.id);

    if (action.createsLease) {
      const lease: Lease = {
        id: `LSE-2026-${String(db.leases.length + 1).padStart(3, '0')}`,
        applicationId: app.id,
        clientId: app.clientId,
        parcelRef: app.parcelRef,
        district: app.district,
        startDate: nowIso(),
        endDate: new Date(Date.now() + 5 * 365 * 86400000).toISOString(),
        status: 'active',
        paymentStatus: 'due',
        annualRentSCR: 3000,
      };
      upsert('leases', lease);
      push(`Lease ${lease.id} created for ${app.parcelRef}`, 'success');
    } else if (action.createsEnforcement) {
      const noticeNo = `EN-2026-${String(db.enforcement.length + 10).padStart(4, '0')}`;
      upsert('enforcement', {
        id: uid('ENF'),
        clientId: app.clientId,
        parcelRef: app.parcelRef,
        type: 'retraction',
        reason: 'Non-compliance flagged from land application',
        noticeNo,
        status: 'open',
        issuedAt: nowIso(),
        history: [
          {
            at: nowIso(),
            by: user?.name ?? 'Officer',
            action: 'Non-compliance flagged',
            fromStatus: '',
            toStatus: 'open',
          },
        ],
      });
      push(`Enforcement case opened (${noticeNo})`, 'info');
    } else {
      push(`${app.id} → ${titleCase(action.to)}`, 'success');
    }
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Applications" value={db.landApplications.length} />
        <Stat
          label="In progress"
          value={
            db.landApplications.filter((a) =>
              ['submitted', 'under_review', 'assessment', 'decision'].includes(a.status),
            ).length
          }
          tone="warn"
        />
        <Stat
          label="Allocated"
          value={
            db.landApplications.filter((a) => ['allocated', 'leased'].includes(a.status)).length
          }
          tone="primary"
        />
        <Stat label="Active leases" value={db.leases.filter((l) => l.status === 'active').length} />
      </div>
      <Card className="p-1 sm:p-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2 font-medium">Application</th>
                <th className="px-3 py-2 font-medium">Applicant</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Parcel</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Purpose</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {db.landApplications.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setOpenId(a.id)}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{a.id}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-800">
                    {clientName(a.clientId)}
                  </td>
                  <td className="hidden px-3 py-2.5 font-mono text-xs sm:table-cell">
                    {a.parcelRef}
                  </td>
                  <td className="hidden px-3 py-2.5 sm:table-cell">{a.purpose}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!active}
        onClose={() => setOpenId(null)}
        title={active ? `${active.id} — ${active.parcelRef}` : ''}
        wide
      >
        {active && (
          <ApplicationDetail app={active} clientName={clientName} canRole={canRole} onRun={run} />
        )}
      </Modal>
    </div>
  );
}

function ApplicationDetail({
  app,
  clientName,
  canRole,
  onRun,
}: {
  app: LandApplication;
  clientName: (id: string) => string;
  canRole: (r: Role) => boolean;
  onRun: (
    app: LandApplication,
    action: ActionDef,
    assessment?: LandApplication['assessment'],
  ) => void;
}) {
  const actions = ACTIONS[app.status] ?? [];
  const center = DISTRICT_CENTERS[app.district];
  const [pin, setPin] = useState<[number, number]>(
    app.assessment ? [app.assessment.lat, app.assessment.lng] : center,
  );
  const [findings, setFindings] = useState('');
  const [reco, setReco] = useState<'allocate' | 'reject'>('allocate');
  const assessAction = actions.find((a) => a.needsAssessment);

  const submitAssessment = (e: FormEvent) => {
    e.preventDefault();
    if (!assessAction) return;
    onRun(app, assessAction, {
      at: nowIso(),
      by: 'Field Officer',
      findings: findings || 'Assessed on site',
      recommendation: reco,
      lat: pin[0],
      lng: pin[1],
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <M label="Applicant" v={clientName(app.clientId)} />
        <M label="District" v={app.district} />
        <M label="Area" v={`${app.areaHa} ha`} />
        <M label="Status" v={<StatusBadge status={app.status} />} />
      </div>
      <div>
        <span className="text-xs text-slate-400">Purpose</span>
        <p className="text-sm text-slate-700">{app.purpose}</p>
      </div>

      {/* GIS parcel view */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          GIS parcel view <ReqBadge id="iv.3" />
        </div>
        <MapPicker
          lat={pin[0]}
          lng={pin[1]}
          height={220}
          readOnly={!assessAction}
          onChange={assessAction ? (la, ln) => setPin([la, ln]) : undefined}
          simCenter={center}
        />
      </div>

      {app.assessment && (
        <div className="rounded-md bg-slate-50 p-3 text-sm">
          <span className="text-xs font-semibold text-slate-500">Assessment</span>
          <p className="text-slate-700">
            {app.assessment.findings} — recommendation:{' '}
            <strong>{app.assessment.recommendation}</strong>
          </p>
          <p className="text-xs text-slate-400">
            {fmtDate(app.assessment.at)} · {app.assessment.by}
          </p>
        </div>
      )}

      {/* actions (role-gated) */}
      {actions.length > 0 && (
        <div className="rounded-md border border-slate-200 p-3">
          {assessAction && canRole(assessAction.role) ? (
            <form onSubmit={submitAssessment} className="space-y-2">
              <Field label="Assessment findings">
                <input
                  className="input"
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder="Parcel suitable; access road present"
                />
              </Field>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    checked={reco === 'allocate'}
                    onChange={() => setReco('allocate')}
                  />{' '}
                  Recommend allocate
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    checked={reco === 'reject'}
                    onChange={() => setReco('reject')}
                  />{' '}
                  Recommend reject
                </label>
              </div>
              <button type="submit" className="btn-primary">
                Submit assessment
              </button>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              {actions.map((a) =>
                canRole(a.role) ? (
                  <button
                    key={a.key}
                    type="button"
                    className={cx(
                      'btn',
                      a.key === 'reject' ? 'btn-secondary text-red-600' : 'btn-primary',
                    )}
                    onClick={() => onRun(app, a)}
                  >
                    {a.label}
                  </button>
                ) : (
                  <span key={a.key} className="flex items-center gap-1 text-xs text-amber-700">
                    <Icon name="shield" size={13} /> {a.label} needs {titleCase(a.role)}
                  </span>
                ),
              )}
            </div>
          )}
        </div>
      )}

      {/* immutable history */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          History <ReqBadge id={['iv.1', 'iv.2', 'iv.8']} />
        </div>
        <Timeline
          items={app.history
            .slice()
            .reverse()
            .map((h) => ({ at: h.at, title: `${h.action} → ${titleCase(h.toStatus)}`, by: h.by }))}
        />
      </div>
    </div>
  );
}

// ── Leases ─────────────────────────────────────────────────────────────────
function Leases() {
  const { db, upsert } = useStore();
  const { user } = useAuth();
  const { push } = useToast();
  const clientName = (id: string) => {
    const c = db.clients.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : id;
  };
  const daysToExpiry = (endDate: string) =>
    Math.round((new Date(endDate).getTime() - Date.now()) / 86400000);

  const remind = (l: Lease, kind: 'expiry' | 'payment') => {
    const c = db.clients.find((x) => x.id === l.clientId);
    upsert(
      'notifications',
      makeNotification({
        channel: 'sms',
        to: c?.phone ?? '',
        clientId: l.clientId,
        subject: kind === 'expiry' ? 'Lease expiry reminder' : 'Lease payment reminder',
        body:
          kind === 'expiry'
            ? `Lease ${l.id} (${l.parcelRef}) expires on ${fmtDate(l.endDate)}.`
            : `Payment due on lease ${l.id} (${l.parcelRef}).`,
        template: kind === 'expiry' ? 'lease_expiry' : 'lease_payment',
        event: `lease.${kind}`,
      }),
    );
    upsert('audit', {
      id: uid('AUD'),
      at: nowIso(),
      actor: user?.name ?? 'system',
      actorRole: user?.role ?? 'system',
      action: 'lease.reminder',
      category: 'data',
      detail: `${kind} reminder for ${l.id}`,
      entity: 'lease',
      entityId: l.id,
    } satisfies AuditEntry);
    push(`${titleCase(kind)} reminder sent for ${l.id}`, 'sms');
  };

  const expiringSoon = db.leases.filter(
    (l) => l.status === 'active' && daysToExpiry(l.endDate) <= EXPIRY_WINDOW_DAYS,
  );

  return (
    <div>
      {expiringSoon.length > 0 && (
        <Card className="mb-4 border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <span className="flex items-center gap-1.5 font-medium">
            <Icon name="alert" size={16} /> {expiringSoon.length} lease(s) expiring within{' '}
            {EXPIRY_WINDOW_DAYS} days <ReqBadge id="iv.6" />
          </span>
        </Card>
      )}
      <Card className="p-1 sm:p-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2 font-medium">Lease</th>
                <th className="px-3 py-2 font-medium">Lessee</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Parcel</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Expiry</th>
                <th className="px-3 py-2 font-medium">Payment</th>
                <th className="px-3 py-2 font-medium">Reminders</th>
              </tr>
            </thead>
            <tbody>
              {db.leases.map((l) => {
                const d = daysToExpiry(l.endDate);
                return (
                  <tr key={l.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{l.id}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {clientName(l.clientId)}
                    </td>
                    <td className="hidden px-3 py-2.5 font-mono text-xs sm:table-cell">
                      {l.parcelRef}
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      {fmtDate(l.endDate)}{' '}
                      {d <= EXPIRY_WINDOW_DAYS && (
                        <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">
                          {d}d
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={l.paymentStatus} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="btn-secondary px-2 py-0.5 text-xs"
                          onClick={() => remind(l, 'expiry')}
                        >
                          Expiry
                        </button>
                        <button
                          type="button"
                          className="btn-secondary px-2 py-0.5 text-xs"
                          onClick={() => remind(l, 'payment')}
                        >
                          Payment
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Enforcement ────────────────────────────────────────────────────────────
function Enforcement() {
  const { db, patch } = useStore();
  const { user } = useAuth();
  const { push } = useToast();
  const clientName = (id: string) => {
    const c = db.clients.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : id;
  };
  const serve = (id: string) => {
    const c = db.enforcement.find((e) => e.id === id);
    if (!c) return;
    patch('enforcement', id, {
      status: 'notice_served',
      history: [
        ...c.history,
        {
          at: nowIso(),
          by: user?.name ?? 'Supervisor',
          action: 'Notice served',
          fromStatus: c.status,
          toStatus: 'notice_served',
        },
      ],
    });
    push(`Notice ${c.noticeNo} served`, 'info');
  };
  const close = (id: string) => {
    const c = db.enforcement.find((e) => e.id === id);
    if (!c) return;
    patch('enforcement', id, {
      status: 'closed',
      history: [
        ...c.history,
        {
          at: nowIso(),
          by: user?.name ?? 'Supervisor',
          action: 'Case closed',
          fromStatus: c.status,
          toStatus: 'closed',
        },
      ],
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Non-compliance → retraction/eviction with a numbered notice. <ReqBadge id="iv.7" />
      </p>
      {db.enforcement.length === 0 && (
        <Card className="p-6 text-center text-sm text-slate-400">No enforcement cases.</Card>
      )}
      {db.enforcement.map((e) => (
        <Card key={e.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-slate-800">
                {titleCase(e.type)} — {clientName(e.clientId)}
              </span>
              <span className="ml-2 font-mono text-xs text-slate-400">{e.parcelRef}</span>
              <div className="text-xs text-slate-500">
                Notice <span className="font-mono">{e.noticeNo}</span> · issued{' '}
                {fmtDate(e.issuedAt)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={e.status} />
              {e.status === 'open' && (
                <button
                  type="button"
                  className="btn-secondary py-1 text-xs"
                  onClick={() => serve(e.id)}
                >
                  Serve notice
                </button>
              )}
              {e.status === 'notice_served' && (
                <button
                  type="button"
                  className="btn-secondary py-1 text-xs"
                  onClick={() => close(e.id)}
                >
                  Close
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">{e.reason}</p>
        </Card>
      ))}
    </div>
  );
}

function M({ label, v }: { label: string; v: ReactNode }) {
  return (
    <div>
      <span className="block text-xs text-slate-400">{label}</span>
      <span className="font-medium text-slate-800">{v}</span>
    </div>
  );
}
