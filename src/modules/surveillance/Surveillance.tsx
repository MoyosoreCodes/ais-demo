import { type FormEvent, useMemo, useState } from 'react';

import { useAuth } from '../../app/auth';
import { DataTable } from '../../components/DataTable';
import { Icon } from '../../components/Icon';
import { ReqBadge } from '../../components/ReqBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { Timeline } from '../../components/Timeline';
import { useToast } from '../../components/Toast';
import { Card, chipClass, Field, Meta, Modal, PageHeader, Stat } from '../../components/ui';
import { fmtDate, nowIso, titleCase } from '../../lib/format';
import { nextCaseId, uid } from '../../lib/ids';
import { useClientName, useStore } from '../../lib/store';
import {
  type AuditEntry,
  LIVESTOCK,
  type SurveillanceCase,
  type SurveillanceStatus,
  type WorkflowEvent,
} from '../../lib/types';

const DISEASES = [
  'Newcastle disease',
  'Avian influenza (suspected)',
  'African swine fever (suspected)',
  'Foot rot',
  'Coccidiosis',
];

export function Surveillance() {
  const { db, patch, upsert } = useStore();
  const { user } = useAuth();
  const { push } = useToast();
  const clientName = useClientName();
  const [statusFilter, setStatusFilter] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const officers = db.users.filter(
    (u) => ['agriculture_officer', 'field_officer'].includes(u.role) && u.active,
  );
  const rows = useMemo(
    () =>
      statusFilter
        ? db.surveillanceCases.filter((c) => c.status === statusFilter)
        : db.surveillanceCases,
    [db.surveillanceCases, statusFilter],
  );
  const active = openId ? db.surveillanceCases.find((c) => c.id === openId) : undefined;

  const kpi = {
    total: db.surveillanceCases.length,
    open: db.surveillanceCases.filter((c) => !['closed', 'ruled_out'].includes(c.status)).length,
    confirmed: db.surveillanceCases.filter((c) => c.status === 'confirmed').length,
  };

  const audit = (action: string, detail: string, entityId: string) =>
    upsert('audit', {
      id: uid('AUD'),
      at: nowIso(),
      actor: user?.name ?? 'system',
      actorRole: user?.role ?? 'system',
      action,
      category: 'data',
      detail,
      entity: 'surveillance',
      entityId,
    } satisfies AuditEntry);

  const transition = (
    c: SurveillanceCase,
    to: SurveillanceStatus,
    label: string,
    extra: Partial<SurveillanceCase> = {},
  ) => {
    const event: WorkflowEvent = {
      at: nowIso(),
      by: user?.name ?? 'Officer',
      action: label,
      fromStatus: c.status,
      toStatus: to,
    };
    patch('surveillanceCases', c.id, { status: to, history: [...c.history, event], ...extra });
    audit(`surveillance.${to}`, `${c.id}: ${label}`, c.id);
    push(`${c.id} → ${titleCase(to)}`, 'success');
  };

  return (
    <div>
      <PageHeader
        title="Passive Surveillance"
        code="S08"
        icon="surveillance"
        subtitle="Suspected animal disease cases linked to farms and lab results"
        actions={
          <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={16} /> Report case
          </button>
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Cases" value={kpi.total} />
        <Stat label="Open" value={kpi.open} tone="warn" />
        <Stat label="Confirmed" value={kpi.confirmed} tone="danger" />
      </div>
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <span className="text-xs font-medium text-slate-400">Status</span>
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={chipClass(statusFilter === '')}
        >
          All
        </button>
        {(
          [
            'reported',
            'assigned',
            'investigating',
            'confirmed',
            'ruled_out',
            'closed',
          ] as SurveillanceStatus[]
        ).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={chipClass(statusFilter === s)}
          >
            {titleCase(s)}
          </button>
        ))}
        <span className="ml-auto">
          <ReqBadge id={['viii.1', 'viii.2', 'viii.4']} />
        </span>
      </Card>
      <Card className="p-1 sm:p-2">
        <DataTable
          rows={rows}
          pageSize={12}
          onRowClick={(c) => setOpenId(c.id)}
          columns={[
            {
              key: 'id',
              header: 'Case',
              render: (c) => <span className="font-mono text-xs text-slate-500">{c.id}</span>,
            },
            {
              key: 'disease',
              header: 'Suspected',
              render: (c) => (
                <span className="font-medium text-slate-800">{c.suspectedDisease}</span>
              ),
            },
            { key: 'species', header: 'Species', hideOnMobile: true, render: (c) => c.species },
            {
              key: 'farmer',
              header: 'Farmer',
              hideOnMobile: true,
              render: (c) => clientName(c.clientId),
            },
            {
              key: 'reported',
              header: 'Reported',
              hideOnMobile: true,
              render: (c) => <span className="text-xs">{fmtDate(c.reportedAt)}</span>,
            },
            { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
          ]}
        />
      </Card>

      <Modal
        open={!!active}
        onClose={() => setOpenId(null)}
        title={active ? `${active.id} — ${active.suspectedDisease}` : ''}
        wide
      >
        {active && (
          <Detail
            c={active}
            clientName={clientName}
            officers={officers}
            samples={db.samples.filter((s) => s.farmId === active.farmId)}
            onTransition={transition}
          />
        )}
      </Modal>

      <NewCase
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={(clientId, farmId, disease, species) => {
          const id = nextCaseId(db.surveillanceCases);
          const c: SurveillanceCase = {
            id,
            clientId,
            farmId,
            suspectedDisease: disease,
            species,
            status: 'reported',
            reportedAt: nowIso(),
            history: [
              {
                at: nowIso(),
                by: user?.name ?? 'Reporter',
                action: 'Reported suspected case',
                fromStatus: '',
                toStatus: 'reported',
              },
            ],
          };
          upsert('surveillanceCases', c);
          audit('surveillance.reported', `${id} reported`, id);
          push(`${id} reported`, 'success');
          setAddOpen(false);
          setOpenId(id);
        }}
      />
    </div>
  );
}

function Detail({
  c,
  clientName,
  officers,
  samples,
  onTransition,
}: {
  c: SurveillanceCase;
  clientName: (id: string) => string;
  officers: { id: string; name: string }[];
  samples: { id: string; type: string; status: string }[];
  onTransition: (
    c: SurveillanceCase,
    to: SurveillanceStatus,
    label: string,
    extra?: Partial<SurveillanceCase>,
  ) => void;
}) {
  const [assignee, setAssignee] = useState(officers[0]?.id ?? '');
  const [sampleId, setSampleId] = useState(c.linkedSampleId ?? samples[0]?.id ?? '');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Meta label="Farmer" value={clientName(c.clientId)} />
        <Meta label="Farm" value={c.farmId} />
        <Meta label="Species" value={c.species} />
        <Meta label="Status" value={<StatusBadge status={c.status} />} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-3 text-sm">
        <Icon name="link" size={14} className="text-slate-400" />
        <span>
          Linked lab result <ReqBadge id="viii.4" />:
        </span>
        {c.linkedSampleId ? (
          <span className="font-mono text-primary-700">{c.linkedSampleId}</span>
        ) : (
          <span className="text-slate-400">none</span>
        )}
        {samples.length > 0 && (
          <span className="ml-auto flex items-center gap-1">
            <select
              className="rounded border border-slate-200 px-1.5 py-1 text-xs"
              value={sampleId}
              onChange={(e) => setSampleId(e.target.value)}
            >
              {samples.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} ({s.type})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary px-2 py-1 text-xs"
              onClick={() =>
                onTransition(c, c.status, 'Linked lab result', { linkedSampleId: sampleId })
              }
            >
              Link
            </button>
          </span>
        )}
      </div>

      <div className="rounded-md border border-slate-200 p-3">
        {c.status === 'reported' && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <span className="text-xs text-slate-400">Assign to</span>
              <select
                className="input"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                {officers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                onTransition(c, 'assigned', 'Assigned to officer', { assignedTo: assignee })
              }
            >
              Assign
            </button>
          </div>
        )}
        {c.status === 'assigned' && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => onTransition(c, 'investigating', 'Investigation started')}
          >
            Start investigation
          </button>
        )}
        {c.status === 'investigating' && (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => onTransition(c, 'confirmed', 'Case confirmed')}
            >
              Confirm
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onTransition(c, 'ruled_out', 'Ruled out')}
            >
              Rule out
            </button>
          </div>
        )}
        {(c.status === 'confirmed' || c.status === 'ruled_out') && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onTransition(c, 'closed', 'Case closed')}
          >
            Close case
          </button>
        )}
        {c.status === 'closed' && <p className="text-sm text-slate-500">Case closed.</p>}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          History <ReqBadge id="viii.2" />
        </div>
        <Timeline
          items={c.history
            .slice()
            .reverse()
            .map((h) => ({ at: h.at, title: `${h.action} → ${titleCase(h.toStatus)}`, by: h.by }))}
        />
      </div>
    </div>
  );
}

function NewCase({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (clientId: string, farmId: string, disease: string, species: string) => void;
}) {
  const { db } = useStore();
  const [clientId, setClientId] = useState('CLT-0001');
  const [disease, setDisease] = useState(DISEASES[0]);
  const [species, setSpecies] = useState<string>(LIVESTOCK[0]);
  const clientFarms = db.farms.filter((f) => f.clientId === clientId && f.status === 'active');
  const [farmId, setFarmId] = useState(clientFarms[0]?.id ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const f = db.farms.find((x) => x.clientId === clientId && x.status === 'active');
    onCreate(clientId, farmId || f?.id || '', disease, species);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report suspected case"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="new-case" className="btn-primary">
            Report
          </button>
        </>
      }
    >
      <form id="new-case" onSubmit={submit} className="space-y-3">
        <Field label="Farmer">
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Suspected disease">
            <select className="input" value={disease} onChange={(e) => setDisease(e.target.value)}>
              {DISEASES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Species">
            <select className="input" value={species} onChange={(e) => setSpecies(e.target.value)}>
              {LIVESTOCK.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}
