import { type FormEvent, useMemo, useState } from 'react';

import { useAuth } from '../../app/auth';
import { DataTable } from '../../components/DataTable';
import { DocUploader } from '../../components/DocUploader';
import { Icon } from '../../components/Icon';
import { ReqBadge } from '../../components/ReqBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { useToast } from '../../components/Toast';
import { Card, cx, Field, Meta, Modal, PageHeader, SimBadge, Stat } from '../../components/ui';
import { fmtDate, fmtDateTime, nowIso, titleCase } from '../../lib/format';
import { nextInspectionId, uid } from '../../lib/ids';
import { useClientName, useStore } from '../../lib/store';
import { type AuditEntry, type DocRef, type Inspection } from '../../lib/types';

export function FieldOps() {
  const { db, patch, upsert } = useStore();
  const { user } = useAuth();
  const { push } = useToast();
  const clientName = useClientName();
  const [online, setOnline] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const fieldOfficers = db.users.filter(
    (u) => ['field_officer', 'agriculture_officer'].includes(u.role) && u.active,
  );
  const officerName = (id: string) => db.users.find((u) => u.id === id)?.name ?? id;
  const active = openId ? db.inspections.find((i) => i.id === openId) : undefined;
  const pending = useMemo(
    () => db.inspections.filter((i) => i.status === 'pending_sync'),
    [db.inspections],
  );

  const kpi = {
    scheduled: db.inspections.filter((i) => i.status === 'scheduled').length,
    pending: pending.length,
    completed: db.inspections.filter((i) => i.status === 'completed').length,
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
      entity: 'inspection',
      entityId,
    } satisfies AuditEntry);

  const complete = (insp: Inspection, findings: string, photos: DocRef[]) => {
    if (online) {
      patch('inspections', insp.id, {
        status: 'completed',
        findings,
        photos,
        capturedOffline: false,
        completedAt: nowIso(),
      });
      audit('inspection.complete', `${insp.id} completed`, insp.id);
      push(`${insp.id} completed`, 'success');
    } else {
      patch('inspections', insp.id, {
        status: 'pending_sync',
        findings,
        photos,
        capturedOffline: true,
      });
      audit('inspection.queue', `${insp.id} captured offline (queued)`, insp.id);
      push(`${insp.id} captured offline — queued for sync`, 'info');
    }
    setOpenId(null);
  };

  const syncNow = () => {
    pending.forEach((i) =>
      patch('inspections', i.id, { status: 'completed', completedAt: nowIso() }),
    );
    if (pending.length)
      audit('inspection.sync', `Synced ${pending.length} offline inspection(s)`, pending[0].id);
    push(`Synced ${pending.length} inspection(s)`, 'success');
  };

  return (
    <div>
      <PageHeader
        title="Field Operations"
        code="S10"
        icon="field-ops"
        subtitle="Scheduling, inspections and offline capture with sync"
        actions={
          <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={16} /> Schedule
          </button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Connectivity</span>
          <button
            type="button"
            onClick={() => setOnline((o) => !o)}
            className={cx(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
              online ? 'bg-primary-100 text-primary-700' : 'bg-amber-100 text-amber-700',
            )}
          >
            <span
              className={cx('h-2 w-2 rounded-full', online ? 'bg-primary-500' : 'bg-amber-500')}
            />{' '}
            {online ? 'Online' : 'Offline'}
          </button>
          <SimBadge label="offline simulated" /> <ReqBadge id="x.3" />
        </div>
        {pending.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              Pending sync ({pending.length})
            </span>
            <button
              type="button"
              className="btn-primary py-1 text-xs disabled:opacity-50"
              disabled={!online}
              onClick={syncNow}
            >
              Sync now
            </button>
          </div>
        )}
      </Card>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Scheduled" value={kpi.scheduled} tone="warn" />
        <Stat label="Pending sync" value={kpi.pending} tone={kpi.pending ? 'warn' : 'default'} />
        <Stat label="Completed" value={kpi.completed} tone="primary" />
      </div>

      <Card className="p-1 sm:p-2">
        <DataTable
          rows={db.inspections}
          pageSize={12}
          onRowClick={(i) => setOpenId(i.id)}
          columns={[
            {
              key: 'id',
              header: 'Inspection',
              render: (i) => <span className="font-mono text-xs text-slate-500">{i.id}</span>,
            },
            {
              key: 'type',
              header: 'Type',
              render: (i) => (
                <span className="capitalize font-medium text-slate-800">{i.type}</span>
              ),
            },
            {
              key: 'farmer',
              header: 'Farmer',
              hideOnMobile: true,
              render: (i) => clientName(i.clientId),
            },
            {
              key: 'when',
              header: 'Scheduled',
              hideOnMobile: true,
              render: (i) => <span className="text-xs">{fmtDate(i.scheduledFor)}</span>,
            },
            {
              key: 'officer',
              header: 'Officer',
              hideOnMobile: true,
              render: (i) => <span className="text-xs">{officerName(i.assignedTo)}</span>,
            },
            {
              key: 'offline',
              header: '',
              render: (i) =>
                i.capturedOffline ? (
                  <Icon name="alert" size={13} className="text-amber-500" />
                ) : null,
            },
            { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
          ]}
        />
      </Card>

      <Modal
        open={!!active}
        onClose={() => setOpenId(null)}
        title={active ? `${active.id} — ${titleCase(active.type)} inspection` : ''}
        wide
      >
        {active && (
          <Detail
            insp={active}
            clientName={clientName}
            officerName={officerName}
            online={online}
            onComplete={complete}
          />
        )}
      </Modal>

      <NewInspection
        open={addOpen}
        onClose={() => setAddOpen(false)}
        officers={fieldOfficers}
        onCreate={(clientId, farmId, type, scheduledFor, assignedTo) => {
          const id = nextInspectionId(db.inspections);
          const insp: Inspection = {
            id,
            farmId,
            clientId,
            type,
            scheduledFor,
            assignedTo,
            status: 'scheduled',
            findings: '',
            photos: [],
            capturedOffline: false,
          };
          upsert('inspections', insp);
          audit('inspection.schedule', `${id} scheduled`, id);
          push(`${id} scheduled`, 'success');
          setAddOpen(false);
        }}
      />
    </div>
  );
}

function Detail({
  insp,
  clientName,
  officerName,
  online,
  onComplete,
}: {
  insp: Inspection;
  clientName: (id: string) => string;
  officerName: (id: string) => string;
  online: boolean;
  onComplete: (insp: Inspection, findings: string, photos: DocRef[]) => void;
}) {
  const [findings, setFindings] = useState(insp.findings);
  const [photos, setPhotos] = useState<DocRef[]>(insp.photos);
  const done = insp.status === 'completed';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Meta label="Farmer" value={clientName(insp.clientId)} />
        <Meta label="Farm" value={insp.farmId} />
        <Meta label="Officer" value={officerName(insp.assignedTo)} />
        <Meta label="Status" value={<StatusBadge status={insp.status} />} />
      </div>
      {insp.capturedOffline && (
        <p className="flex items-center gap-1.5 rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          <Icon name="alert" size={14} /> Captured offline{' '}
          {insp.status === 'pending_sync' ? '— awaiting sync' : '— synced'} <ReqBadge id="x.3" />
        </p>
      )}

      {done || insp.status === 'pending_sync' ? (
        <>
          <div>
            <span className="text-xs text-slate-400">Findings</span>
            <p className="text-sm text-slate-700">{insp.findings || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400">
              Photos <ReqBadge id="x.4" />
            </span>
            {insp.photos.length === 0 ? (
              <p className="text-sm text-slate-400">None.</p>
            ) : (
              <ul className="mt-1 text-sm text-slate-600">
                {insp.photos.map((p) => (
                  <li key={p.id} className="flex items-center gap-1">
                    <Icon name="documents" size={13} /> {p.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {done && insp.completedAt && (
            <p className="text-xs text-slate-400">
              Completed {fmtDateTime(insp.completedAt)} <ReqBadge id="x.5" />
            </p>
          )}
        </>
      ) : (
        <>
          <Field label="Findings">
            <input
              className="input"
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="Compliant with permit conditions…"
            />
          </Field>
          <DocUploader
            docs={photos}
            onChange={setPhotos}
            label="Photos"
            categories={['photo', 'report']}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => onComplete(insp, findings, photos)}
          >
            {online ? 'Complete inspection' : 'Capture offline (queue)'}
          </button>
        </>
      )}
    </div>
  );
}

function NewInspection({
  open,
  onClose,
  officers,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  officers: { id: string; name: string }[];
  onCreate: (
    clientId: string,
    farmId: string,
    type: Inspection['type'],
    scheduledFor: string,
    assignedTo: string,
  ) => void;
}) {
  const { db } = useStore();
  const [clientId, setClientId] = useState('CLT-0001');
  const [type, setType] = useState<Inspection['type']>('farm');
  const [assignedTo, setAssignedTo] = useState(officers[0]?.id ?? '');
  const clientFarms = db.farms.filter((f) => f.clientId === clientId && f.status === 'active');
  const [farmId, setFarmId] = useState(clientFarms[0]?.id ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const f = db.farms.find((x) => x.clientId === clientId && x.status === 'active');
    onCreate(
      clientId,
      farmId || f?.id || '',
      type,
      new Date(Date.now() + 3 * 86400000).toISOString(),
      assignedTo,
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule inspection"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="new-insp" className="btn-primary">
            Schedule
          </button>
        </>
      }
    >
      <form id="new-insp" onSubmit={submit} className="space-y-3">
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
              value={type}
              onChange={(e) => setType(e.target.value as Inspection['type'])}
            >
              <option value="farm">Farm</option>
              <option value="land">Land</option>
              <option value="compliance">Compliance</option>
            </select>
          </Field>
          <Field label="Officer">
            <select
              className="input"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            >
              {officers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}
