import { type FormEvent, useMemo, useState } from 'react';

import { useAuth } from '../../app/auth';
import { DataTable } from '../../components/DataTable';
import { Icon } from '../../components/Icon';
import { ReqBadge } from '../../components/ReqBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { useToast } from '../../components/Toast';
import { Card, chipClass, Field, Meta, Modal, PageHeader, Stat } from '../../components/ui';
import { fmtDate, nowIso, titleCase } from '../../lib/format';
import { nextVisitId, uid } from '../../lib/ids';
import { useClientName, useStore } from '../../lib/store';
import { type AuditEntry, LIVESTOCK, type LivestockVisit, type VisitStatus } from '../../lib/types';

const COMPLAINT_NEXT: Partial<Record<VisitStatus, VisitStatus>> = {
  reported: 'assigned',
  assigned: 'in_progress',
  in_progress: 'resolved',
};
const ACTION_LABEL: Record<string, string> = {
  assigned: 'Assign officer',
  in_progress: 'Start visit',
  resolved: 'Mark resolved',
};

export function Livestock() {
  const { db, patch, upsert } = useStore();
  const { user } = useAuth();
  const { push } = useToast();
  const clientName = useClientName();
  const [kind, setKind] = useState<'' | 'complaint' | 'routine'>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const officers = db.users.filter(
    (u) => ['agriculture_officer', 'field_officer'].includes(u.role) && u.active,
  );
  const officerName = (id?: string) => db.users.find((u) => u.id === id)?.name ?? 'Unassigned';

  const rows = useMemo(
    () => (kind ? db.livestockVisits.filter((v) => v.kind === kind) : db.livestockVisits),
    [db.livestockVisits, kind],
  );
  const active = openId ? db.livestockVisits.find((v) => v.id === openId) : undefined;

  const kpi = {
    complaints: db.livestockVisits.filter((v) => v.kind === 'complaint').length,
    open: db.livestockVisits.filter((v) => v.kind === 'complaint' && v.status !== 'resolved')
      .length,
    routine: db.livestockVisits.filter((v) => v.kind === 'routine').length,
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
      entity: 'livestock',
      entityId,
    } satisfies AuditEntry);

  const advance = (v: LivestockVisit, extra: Partial<LivestockVisit> = {}) => {
    const next = COMPLAINT_NEXT[v.status];
    if (!next) return;
    patch('livestockVisits', v.id, { status: next, ...extra });
    audit(`livestock.${next}`, `${v.id} → ${titleCase(next)}`, v.id);
    push(`${v.id} → ${titleCase(next)}`, 'success');
  };

  return (
    <div>
      <PageHeader
        title="Livestock Services"
        code="S07"
        icon="livestock"
        subtitle="Complaint and routine visits with structured findings"
        actions={
          <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={16} /> Record visit
          </button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Complaint visits" value={kpi.complaints} />
        <Stat label="Open complaints" value={kpi.open} tone="warn" />
        <Stat label="Routine visits" value={kpi.routine} tone="primary" />
      </div>
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <span className="text-xs font-medium text-slate-400">Type</span>
        {(['', 'complaint', 'routine'] as const).map((k) => (
          <button
            key={k || 'all'}
            type="button"
            onClick={() => setKind(k)}
            className={chipClass(kind === k)}
          >
            {k === '' ? 'All' : titleCase(k)}
          </button>
        ))}
        <span className="ml-auto">
          <ReqBadge id={['vii.1', 'vii.2', 'vii.4']} />
        </span>
      </Card>
      <Card className="p-1 sm:p-2">
        <DataTable
          rows={rows}
          pageSize={12}
          onRowClick={(v) => setOpenId(v.id)}
          columns={[
            {
              key: 'id',
              header: 'Visit',
              render: (v) => <span className="font-mono text-xs text-slate-500">{v.id}</span>,
            },
            {
              key: 'kind',
              header: 'Type',
              render: (v) => (
                <span className="capitalize font-medium text-slate-800">{v.kind}</span>
              ),
            },
            { key: 'client', header: 'Farmer', render: (v) => clientName(v.clientId) },
            { key: 'species', header: 'Species', hideOnMobile: true, render: (v) => v.species },
            {
              key: 'date',
              header: 'Date',
              hideOnMobile: true,
              render: (v) => <span className="text-xs">{fmtDate(v.date)}</span>,
            },
            {
              key: 'assignee',
              header: 'Officer',
              hideOnMobile: true,
              render: (v) => <span className="text-xs">{officerName(v.assignedTo)}</span>,
            },
            { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v.status} /> },
          ]}
        />
      </Card>

      <Modal
        open={!!active}
        onClose={() => setOpenId(null)}
        title={active ? `${active.id} — ${titleCase(active.kind)} visit` : ''}
        wide
      >
        {active && (
          <Detail
            visit={active}
            clientName={clientName}
            officers={officers}
            officerName={officerName}
            onAdvance={advance}
          />
        )}
      </Modal>

      <NewVisit
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={(clientId, farmId, vkind, species, observations) => {
          const id = nextVisitId(db.livestockVisits);
          const visit: LivestockVisit = {
            id,
            clientId,
            farmId,
            kind: vkind,
            species,
            status: vkind === 'complaint' ? 'reported' : 'completed',
            observations,
            findings: '',
            date: nowIso(),
          };
          upsert('livestockVisits', visit);
          audit('livestock.create', `${id} (${vkind}) recorded`, id);
          push(`${id} recorded`, 'success');
          setAddOpen(false);
          setOpenId(id);
        }}
      />
    </div>
  );
}

function Detail({
  visit,
  clientName,
  officers,
  officerName,
  onAdvance,
}: {
  visit: LivestockVisit;
  clientName: (id: string) => string;
  officers: { id: string; name: string }[];
  officerName: (id?: string) => string;
  onAdvance: (v: LivestockVisit, extra?: Partial<LivestockVisit>) => void;
}) {
  const [assignee, setAssignee] = useState(officers[0]?.id ?? '');
  const [findings, setFindings] = useState(visit.findings);
  const next = COMPLAINT_NEXT[visit.status];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Meta label="Farmer" value={clientName(visit.clientId)} />
        <Meta label="Farm" value={visit.farmId} />
        <Meta label="Species" value={visit.species} />
        <Meta label="Status" value={<StatusBadge status={visit.status} />} />
      </div>
      <div>
        <span className="text-xs text-slate-400">
          Observations <ReqBadge id="vii.3" />
        </span>
        <p className="text-sm text-slate-700">{visit.observations}</p>
      </div>
      <Field label="Findings">
        <input
          className="input"
          value={findings}
          onChange={(e) => setFindings(e.target.value)}
          placeholder="Structured findings / advice"
        />
      </Field>

      {visit.kind === 'complaint' && next && (
        <div className="rounded-md border border-slate-200 p-3">
          {visit.status === 'reported' && (
            <div className="mb-2">
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
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              onAdvance(visit, {
                findings,
                ...(visit.status === 'reported' ? { assignedTo: assignee } : {}),
              })
            }
          >
            {ACTION_LABEL[next]}
          </button>
        </div>
      )}
      {visit.assignedTo && (
        <p className="text-xs text-slate-500">
          Assigned to {officerName(visit.assignedTo)} <ReqBadge id="vii.5" />
        </p>
      )}
    </div>
  );
}

function NewVisit({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (
    clientId: string,
    farmId: string,
    kind: 'complaint' | 'routine',
    species: string,
    observations: string,
  ) => void;
}) {
  const { db } = useStore();
  const [clientId, setClientId] = useState('CLT-0001');
  const [kind, setKind] = useState<'complaint' | 'routine'>('complaint');
  const [species, setSpecies] = useState<string>(LIVESTOCK[0]);
  const [observations, setObservations] = useState('');
  const clientFarms = db.farms.filter((f) => f.clientId === clientId && f.status === 'active');
  const [farmId, setFarmId] = useState(clientFarms[0]?.id ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const f = db.farms.find((x) => x.clientId === clientId && x.status === 'active');
    onCreate(clientId, farmId || f?.id || '', kind, species, observations || 'Recorded on site');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record livestock visit"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="new-visit" className="btn-primary">
            Save
          </button>
        </>
      }
    >
      <form id="new-visit" onSubmit={submit} className="space-y-3">
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
          <Field label="Type">
            <select
              className="input"
              value={kind}
              onChange={(e) => setKind(e.target.value as 'complaint' | 'routine')}
            >
              <option value="complaint">Complaint</option>
              <option value="routine">Routine</option>
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
        <Field label="Observations">
          <input
            className="input"
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Reduced feed intake, lameness…"
          />
        </Field>
      </form>
    </Modal>
  );
}
