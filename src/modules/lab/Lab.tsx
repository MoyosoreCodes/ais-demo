import { type FormEvent, useMemo, useState } from 'react';

import { useAuth } from '../../app/auth';
import { DataTable } from '../../components/DataTable';
import { Icon } from '../../components/Icon';
import { ReqBadge } from '../../components/ReqBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { Timeline } from '../../components/Timeline';
import { useToast } from '../../components/Toast';
import {
  Card,
  chipClass,
  Field,
  Meta,
  Modal,
  PageHeader,
  SimBadge,
  Stat,
} from '../../components/ui';
import { labReportPdf } from '../../lib/export';
import { fmtDate, nowIso, titleCase } from '../../lib/format';
import { nextSampleId, uid } from '../../lib/ids';
import { makeNotification } from '../../lib/sim';
import { useClientName, useStore } from '../../lib/store';
import {
  type AuditEntry,
  type Role,
  type Sample,
  SAMPLE_TYPES,
  type SampleResult,
  type SampleStatus,
  type SampleType,
} from '../../lib/types';

const NEXT: Partial<Record<SampleStatus, SampleStatus>> = {
  requested: 'collected',
  collected: 'registered',
  registered: 'testing',
  testing: 'result_entered',
  result_entered: 'verified',
  verified: 'released',
};
const ACTION_LABEL: Record<string, string> = {
  collected: 'Collect',
  registered: 'Register in lab',
  testing: 'Start testing',
  verified: 'Verify results',
  released: 'Release result',
};
const CHAIN_LABEL: Record<string, string> = {
  collected: 'Sample collected',
  registered: 'Registered in lab',
  testing: 'Testing started',
  result_entered: 'Results entered',
  verified: 'Results verified',
  released: 'Result released',
};
const ANALYTES: Record<SampleType, { name: string; unit: string; reference: string }[]> = {
  soil: [
    { name: 'pH', unit: '', reference: '6.0 - 7.0' },
    { name: 'Nitrogen (N)', unit: '%', reference: '> 0.2' },
    { name: 'Phosphorus (P)', unit: 'ppm', reference: '15 - 30' },
    { name: 'Organic matter', unit: '%', reference: '> 3.0' },
  ],
  water: [
    { name: 'pH', unit: '', reference: '6.5 - 8.5' },
    { name: 'Turbidity', unit: 'NTU', reference: '< 5' },
    { name: 'E. coli', unit: 'CFU/100ml', reference: '0' },
  ],
  plant: [
    { name: 'Moisture', unit: '%', reference: '-' },
    { name: 'Pest presence', unit: '', reference: 'none' },
    { name: 'Deficiency', unit: '', reference: 'none' },
  ],
  compost: [
    { name: 'C:N ratio', unit: '', reference: '15 - 25' },
    { name: 'Moisture', unit: '%', reference: '40 - 60' },
    { name: 'Maturity', unit: '', reference: 'mature' },
  ],
};
const LAB_ROLES: Role[] = ['lab_staff', 'agriculture_officer', 'admin'];
const genBarcode = () => `SC-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')}`;

export function Lab() {
  const { db, patch, upsert } = useStore();
  const { user } = useAuth();
  const { push } = useToast();
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const canAct = !!user && LAB_ROLES.includes(user.role);
  const clientName = useClientName();

  const rows = useMemo(
    () =>
      db.samples.filter(
        (s) =>
          (!typeFilter || s.type === typeFilter) && (!statusFilter || s.status === statusFilter),
      ),
    [db.samples, typeFilter, statusFilter],
  );
  const active = openId ? db.samples.find((s) => s.id === openId) : undefined;

  const kpi = useMemo(
    () => ({
      total: db.samples.length,
      testing: db.samples.filter((s) => ['collected', 'registered', 'testing'].includes(s.status))
        .length,
      awaiting: db.samples.filter((s) => ['result_entered', 'verified'].includes(s.status)).length,
      released: db.samples.filter((s) => s.status === 'released').length,
    }),
    [db.samples],
  );

  const audit = (action: string, detail: string, entityId: string) =>
    upsert('audit', {
      id: uid('AUD'),
      at: nowIso(),
      actor: user?.name ?? 'system',
      actorRole: user?.role ?? 'system',
      action,
      category: 'data',
      detail,
      entity: 'sample',
      entityId,
    } satisfies AuditEntry);

  const advance = (s: Sample, extra: Partial<Sample> = {}) => {
    const next = NEXT[s.status];
    if (!next) return;
    const chain = [
      ...s.chain,
      { at: nowIso(), by: user?.name ?? 'Lab', action: CHAIN_LABEL[next] },
    ];
    const stamp: Partial<Sample> =
      next === 'collected'
        ? { collectedAt: nowIso() }
        : next === 'verified'
          ? { verifiedBy: user?.name, verifiedAt: nowIso() }
          : next === 'released'
            ? { releasedAt: nowIso() }
            : {};
    patch('samples', s.id, { status: next, chain, ...stamp, ...extra });
    audit(`sample.${next}`, `${s.id} → ${titleCase(next)}`, s.id);
    if (next === 'released') release(s);
  };

  const release = (s: Sample) => {
    const c = db.clients.find((x) => x.id === s.clientId);
    upsert(
      'notifications',
      makeNotification({
        channel: 'sms',
        to: c?.phone ?? '',
        clientId: s.clientId,
        subject: 'Laboratory result ready',
        body: `Your ${s.type} sample ${s.id} result is ready.`,
        template: 'lab_result',
        event: 'lab.released',
      }),
    );
    upsert(
      'notifications',
      makeNotification({
        channel: 'in_app',
        to: c?.email ?? '',
        clientId: s.clientId,
        subject: 'Lab result released',
        body: `${s.id} released.`,
        template: 'lab_result',
        event: 'lab.released',
      }),
    );
    patch('samples', s.id, { notified: true });
    push(`${s.id} released · SMS + in-app sent to applicant`, 'sms');
  };

  const saveResults = (s: Sample, results: SampleResult[], summary: string) =>
    advance(s, { results, resultSummary: summary, completedAt: nowIso() });

  return (
    <div>
      <PageHeader
        title="Sampling & Laboratory"
        code="S06"
        icon="lab"
        subtitle="Soil, water, plant and compost samples with chain of custody"
        actions={
          <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={16} /> New request
          </button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Samples" value={kpi.total} />
        <Stat label="In lab" value={kpi.testing} tone="warn" />
        <Stat label="Awaiting release" value={kpi.awaiting} tone="warn" />
        <Stat label="Released" value={kpi.released} tone="primary" />
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <span className="text-xs font-medium text-slate-400">Type</span>
        <button
          type="button"
          onClick={() => setTypeFilter('')}
          className={chipClass(typeFilter === '')}
        >
          All
        </button>
        {SAMPLE_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={chipClass(typeFilter === t)}
          >
            {titleCase(t)}
          </button>
        ))}
        <span className="mx-2 h-4 w-px bg-slate-200" />
        <select
          className="rounded border border-slate-200 px-2 py-1 text-xs"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {Object.keys(CHAIN_LABEL)
            .concat('requested')
            .map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
        </select>
        <span className="ml-auto">
          <ReqBadge id={['vi.1', 'vi.2', 'vi.3', 'vi.4']} />
        </span>
      </Card>

      <Card className="p-1 sm:p-2">
        <DataTable
          rows={rows}
          pageSize={12}
          onRowClick={(s) => setOpenId(s.id)}
          columns={[
            {
              key: 'barcode',
              header: 'Barcode',
              render: (s) => <span className="font-mono text-xs text-slate-500">{s.barcode}</span>,
            },
            {
              key: 'id',
              header: 'Sample',
              hideOnMobile: true,
              render: (s) => <span className="font-mono text-xs text-slate-400">{s.id}</span>,
            },
            {
              key: 'type',
              header: 'Type',
              render: (s) => (
                <span className="capitalize font-medium text-slate-800">{s.type}</span>
              ),
            },
            {
              key: 'applicant',
              header: 'Applicant',
              hideOnMobile: true,
              render: (s) => clientName(s.clientId),
            },
            {
              key: 'requested',
              header: 'Requested',
              hideOnMobile: true,
              render: (s) => <span className="text-xs">{fmtDate(s.requestedAt)}</span>,
            },
            { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
          ]}
        />
      </Card>

      <Modal
        open={!!active}
        onClose={() => setOpenId(null)}
        title={active ? `${active.type.toUpperCase()} · ${active.barcode}` : ''}
        wide
      >
        {active && (
          <SampleDetail
            sample={active}
            canAct={canAct}
            clientName={clientName}
            farm={db.farms.find((f) => f.id === active.farmId)}
            onAdvance={() => advance(active)}
            onSaveResults={(r, sum) => saveResults(active, r, sum)}
            onReport={() => {
              const c = db.clients.find((x) => x.id === active.clientId);
              const f = db.farms.find((x) => x.id === active.farmId);
              if (c && f) labReportPdf(active, c, f);
            }}
            onResend={() => release(active)}
          />
        )}
      </Modal>

      <NewRequest
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={(clientId, farmId, type, requestedBy) => {
          const id = nextSampleId(db.samples);
          const sample: Sample = {
            id,
            barcode: genBarcode(),
            clientId,
            farmId,
            type,
            status: 'requested',
            requestedBy,
            assignedTo: 'USR-LAB',
            requestedAt: nowIso(),
            results: [],
            notified: false,
            chain: [{ at: nowIso(), by: user?.name ?? 'Applicant', action: 'Request submitted' }],
          };
          upsert('samples', sample);
          audit('sample.request', `${id} (${type}) requested`, id);
          push(`Sampling request ${id} created`, 'success');
          setAddOpen(false);
          setOpenId(id);
        }}
      />
    </div>
  );
}

function SampleDetail({
  sample,
  canAct,
  clientName,
  farm,
  onAdvance,
  onSaveResults,
  onReport,
  onResend,
}: {
  sample: Sample;
  canAct: boolean;
  clientName: (id: string) => string;
  farm?: { id: string; name: string; district: string };
  onAdvance: () => void;
  onSaveResults: (r: SampleResult[], summary: string) => void;
  onReport: () => void;
  onResend: () => void;
}) {
  const analytes = ANALYTES[sample.type];
  const [values, setValues] = useState<string[]>(analytes.map(() => ''));
  const [summary, setSummary] = useState('');
  const next = NEXT[sample.status];
  const isEnterResults = sample.status === 'testing';
  const immutable = ['verified', 'released'].includes(sample.status);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Meta label="Applicant" value={clientName(sample.clientId)} />
        <Meta label="Farm" value={farm ? `${farm.name}` : sample.farmId} />
        <Meta label="Requested by" value={titleCase(sample.requestedBy)} />
        <Meta label="Status" value={<StatusBadge status={sample.status} />} />
      </div>
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Icon name="link" size={13} /> Linked to farm {sample.farmId} and client {sample.clientId}{' '}
        <ReqBadge id="vi.6" />
      </p>

      {/* results */}
      <div>
        <span className="text-xs font-semibold text-slate-600">
          Results <ReqBadge id="vi.5" />
        </span>
        {sample.results.length > 0 ? (
          <table className="mt-1 w-full text-sm">
            <tbody>
              {sample.results.map((r) => (
                <tr key={r.name} className="border-b border-slate-100 last:border-0">
                  <td className="py-1 text-slate-500">{r.name}</td>
                  <td className="py-1 font-medium text-slate-800">
                    {r.value} {r.unit}
                  </td>
                  <td className="py-1 text-right text-xs text-slate-400">ref {r.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : isEnterResults && canAct ? (
          <div className="mt-2 space-y-2">
            {analytes.map((a, i) => (
              <div key={a.name} className="flex items-center gap-2">
                <span className="w-40 text-sm text-slate-600">
                  {a.name} <span className="text-xs text-slate-400">{a.unit}</span>
                </span>
                <input
                  className="input py-1"
                  value={values[i]}
                  onChange={(e) => setValues(values.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder={`ref ${a.reference}`}
                />
              </div>
            ))}
            <input
              className="input"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Result summary / recommendation"
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                onSaveResults(
                  analytes.map((a, i) => ({
                    name: a.name,
                    value: values[i] || '—',
                    unit: a.unit,
                    reference: a.reference,
                  })),
                  summary || 'See values',
                )
              }
            >
              Save results
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No results yet.</p>
        )}
        {sample.resultSummary && (
          <p className="mt-1 text-sm text-slate-600">Summary: {sample.resultSummary}</p>
        )}
        {immutable && (
          <p className="mt-1 flex items-center gap-1 text-xs text-primary-700">
            <Icon name="shield" size={12} /> Locked after verification (immutable).
          </p>
        )}
      </div>

      {/* lifecycle actions */}
      {canAct ? (
        <div className="flex flex-wrap gap-2">
          {next && sample.status !== 'testing' && (
            <button type="button" className="btn-primary" onClick={onAdvance}>
              {ACTION_LABEL[next]}
            </button>
          )}
          {(sample.status === 'result_entered' ||
            sample.status === 'verified' ||
            sample.status === 'released') && (
            <button type="button" className="btn-secondary" onClick={onReport}>
              <Icon name="download" size={16} /> Lab report (PDF) <ReqBadge id="vi.7" />
            </button>
          )}
          {sample.status === 'released' && (
            <button type="button" className="btn-secondary" onClick={onResend}>
              <Icon name="notifications" size={16} /> Re-send notification
            </button>
          )}
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-amber-700">
          <Icon name="shield" size={15} /> Laboratory staff act on samples (RBAC).
        </p>
      )}

      {/* chain of custody */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          Chain of custody <ReqBadge id={['vi.2', 'vi.8']} />
        </div>
        <Timeline
          items={sample.chain
            .slice()
            .reverse()
            .map((c) => ({ at: c.at, title: c.action, by: c.by }))}
        />
      </div>
      <p className="flex items-center gap-1 text-xs text-slate-400">
        <SimBadge label="SMS/email simulated" /> Release notifies the applicant (S13).
      </p>
    </div>
  );
}

function NewRequest({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (
    clientId: string,
    farmId: string,
    type: SampleType,
    requestedBy: 'farmer' | 'officer',
  ) => void;
}) {
  const { db } = useStore();
  const [clientId, setClientId] = useState('CLT-0001');
  const [type, setType] = useState<SampleType>('soil');
  const clientFarms = db.farms.filter((f) => f.clientId === clientId && f.status === 'active');
  const [farmId, setFarmId] = useState(clientFarms[0]?.id ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const f = db.farms.find((x) => x.clientId === clientId && x.status === 'active');
    onCreate(clientId, farmId || f?.id || '', type, 'officer');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New sampling request"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="new-sample" className="btn-primary">
            Create
          </button>
        </>
      }
    >
      <form id="new-sample" onSubmit={submit} className="space-y-3">
        <Field label="Applicant">
          <select
            className="input"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              const nf = db.farms.find(
                (x) => x.clientId === e.target.value && x.status === 'active',
              );
              setFarmId(nf?.id ?? '');
            }}
          >
            {db.clients
              .filter((c) => c.status !== 'merged')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} — {c.id}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Farm">
          <select className="input" value={farmId} onChange={(e) => setFarmId(e.target.value)}>
            {clientFarms.length === 0 ? (
              <option value="">No farm on record</option>
            ) : (
              clientFarms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} — {f.id}
                </option>
              ))
            )}
          </select>
        </Field>
        <Field label="Sample type">
          <select
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as SampleType)}
          >
            {SAMPLE_TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">
                {titleCase(t)}
              </option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  );
}
