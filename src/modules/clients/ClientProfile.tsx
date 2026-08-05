// S02 — client profile. Tabbed linked records (farms, loans, lab, livestock),
// edit with an automatic change-history timeline, and merged-record handling.
import { type FormEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../app/auth';
import { Icon } from '../../components/Icon';
import { ReqBadge } from '../../components/ReqBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { Timeline } from '../../components/Timeline';
import { Card, Field, Modal, PageHeader, SimBadge } from '../../components/ui';
import { fmtDate, nowIso, scr } from '../../lib/format';
import { useStore } from '../../lib/store';
import type { ChangeLog, Client, District } from '../../lib/types';
import { DISTRICTS } from '../../lib/types';

type Tab = 'overview' | 'farms' | 'loans' | 'lab' | 'livestock' | 'history';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'farms', label: 'Farms' },
  { key: 'loans', label: 'Loans' },
  { key: 'lab', label: 'Lab' },
  { key: 'livestock', label: 'Livestock' },
  { key: 'history', label: 'History' },
];

export function ClientProfile() {
  const { id } = useParams();
  const { db, patch } = useStore();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);

  const client = db.clients.find((c) => c.id === id);
  const linked = useMemo(
    () => ({
      farms: db.farms.filter((f) => f.clientId === id),
      loans: db.loans.filter((l) => l.clientId === id),
      samples: db.samples.filter((s) => s.clientId === id),
      visits: db.livestockVisits.filter((v) => v.clientId === id),
      cases: db.surveillanceCases.filter((s) => s.clientId === id),
    }),
    [db, id],
  );

  const [edit, setEdit] = useState({
    phone: '',
    email: '',
    address: '',
    district: 'Anse Boileau' as District,
  });

  if (!client) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-500">Client not found.</p>
        <Link to="/app/clients" className="btn-secondary mt-4">
          Back to registry
        </Link>
      </div>
    );
  }

  const openEdit = () => {
    setEdit({
      phone: client.phone,
      email: client.email,
      address: client.address,
      district: client.district,
    });
    setEditOpen(true);
  };

  const saveEdit = (e: FormEvent) => {
    e.preventDefault();
    const changes: ChangeLog[] = [];
    const fields: (keyof typeof edit)[] = ['phone', 'email', 'address', 'district'];
    for (const f of fields) {
      if (edit[f] !== client[f]) {
        changes.push({
          at: nowIso(),
          by: user?.name ?? 'Officer',
          field: f,
          from: String(client[f]),
          to: String(edit[f]),
        });
      }
    }
    patch('clients', client.id, {
      ...edit,
      updatedAt: nowIso(),
      history: [...client.history, ...changes],
    } as Partial<Client>);
    setEditOpen(false);
  };

  const mergedInto = client.status === 'merged' ? client.mergedInto : undefined;

  return (
    <div>
      <Link
        to="/app/clients"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <Icon name="chevron" size={14} className="rotate-180" /> Registry
      </Link>

      <PageHeader
        title={`${client.firstName} ${client.lastName}`}
        code={client.id}
        icon="clients"
        subtitle={`${client.district} · ${client.stakeholderType}`}
        actions={
          <button
            type="button"
            className="btn-secondary"
            onClick={openEdit}
            disabled={!!mergedInto}
          >
            <Icon name="user" size={16} /> Edit profile <ReqBadge id="ii.4" />
          </button>
        }
      />

      {mergedInto && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          This record has been merged into{' '}
          <Link to={`/app/clients/${mergedInto}`} className="font-semibold underline">
            {mergedInto}
          </Link>
          .
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              'relative px-3 py-2 text-sm font-medium ' +
              (tab === t.key ? 'text-primary-700' : 'text-slate-500 hover:text-slate-700')
            }
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-primary-600" />
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
              Personal & contact <ReqBadge id={['ii.2', 'ii.3']} />
            </h3>
            <dl className="grid grid-cols-3 gap-y-2 text-sm">
              <dt className="text-slate-400">NIN</dt>
              <dd className="col-span-2 font-mono">
                {client.nin}{' '}
                {client.seyidVerified ? (
                  <span className="ml-1 inline-flex items-center gap-1 text-xs text-primary-700">
                    <Icon name="shield" size={12} /> SeyID <SimBadge />
                  </span>
                ) : (
                  <span className="ml-1 text-xs text-slate-400">not SeyID-verified</span>
                )}
              </dd>
              <dt className="text-slate-400">Phone</dt>
              <dd className="col-span-2">{client.phone}</dd>
              <dt className="text-slate-400">Email</dt>
              <dd className="col-span-2 break-all">{client.email}</dd>
              <dt className="text-slate-400">Address</dt>
              <dd className="col-span-2">{client.address}</dd>
              <dt className="text-slate-400">Registered</dt>
              <dd className="col-span-2">
                {fmtDate(client.createdAt)} · {client.source.replace('_', '-')}
              </dd>
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
              Linked records <ReqBadge id="ii.5" />
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <LinkStat label="Farms" value={linked.farms.length} icon="farms" />
              <LinkStat label="Loans" value={linked.loans.length} icon="loans" />
              <LinkStat label="Samples" value={linked.samples.length} icon="lab" />
              <LinkStat label="Livestock visits" value={linked.visits.length} icon="livestock" />
              <LinkStat label="Surveillance" value={linked.cases.length} icon="surveillance" />
            </div>
          </Card>
        </div>
      )}

      {tab === 'farms' && (
        <Card className="divide-y divide-slate-100">
          {linked.farms.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">No farms linked.</p>
          ) : (
            linked.farms.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium text-slate-800">{f.name}</div>
                  <div className="text-xs text-slate-500">
                    {f.id} · {f.sizeHa} ha · {f.district} · {f.crops.concat(f.livestock).join(', ')}
                  </div>
                </div>
                <StatusBadge status={f.verificationStatus} />
              </div>
            ))
          )}
        </Card>
      )}

      {tab === 'loans' && (
        <Card className="divide-y divide-slate-100">
          {linked.loans.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">No loans linked.</p>
          ) : (
            linked.loans.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium text-slate-800">
                    {scr(l.amountSCR)} · {l.purpose}
                  </div>
                  <div className="text-xs text-slate-500">
                    {l.id} · {l.termMonths} months
                  </div>
                </div>
                <StatusBadge status={l.status} />
              </div>
            ))
          )}
        </Card>
      )}

      {tab === 'lab' && (
        <Card className="divide-y divide-slate-100">
          {linked.samples.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">No samples linked.</p>
          ) : (
            linked.samples.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium capitalize text-slate-800">{s.type} sample</div>
                  <div className="text-xs text-slate-500">
                    {s.id} · requested {fmtDate(s.requestedAt)}
                  </div>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))
          )}
        </Card>
      )}

      {tab === 'livestock' && (
        <Card className="divide-y divide-slate-100">
          {linked.visits.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">No livestock visits linked.</p>
          ) : (
            linked.visits.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium capitalize text-slate-800">
                    {v.kind} visit · {v.species}
                  </div>
                  <div className="text-xs text-slate-500">
                    {v.id} · {fmtDate(v.date)} · {v.findings}
                  </div>
                </div>
                <StatusBadge status={v.status} />
              </div>
            ))
          )}
        </Card>
      )}

      {tab === 'history' && (
        <Card className="p-5">
          <h3 className="mb-3 font-semibold text-slate-800">Change history</h3>
          <Timeline
            items={client.history
              .slice()
              .reverse()
              .map((h) => ({
                at: h.at,
                title: h.field === 'record' ? h.to : `${h.field}: ${h.from || '—'} → ${h.to}`,
                by: h.by,
              }))}
          />
        </Card>
      )}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit contact details"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="edit-client" className="btn-primary">
              Save changes
            </button>
          </>
        }
      >
        <form id="edit-client" onSubmit={saveEdit} className="space-y-3">
          <p className="text-xs text-slate-400">
            Edits are recorded in the change-history timeline.
          </p>
          <Field label="Phone">
            <input
              className="input"
              value={edit.phone}
              onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              className="input"
              value={edit.email}
              onChange={(e) => setEdit({ ...edit, email: e.target.value })}
            />
          </Field>
          <Field label="Address">
            <input
              className="input"
              value={edit.address}
              onChange={(e) => setEdit({ ...edit, address: e.target.value })}
            />
          </Field>
          <Field label="District">
            <select
              className="input"
              value={edit.district}
              onChange={(e) => setEdit({ ...edit, district: e.target.value as District })}
            >
              {DISTRICTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
        </form>
      </Modal>
    </div>
  );
}

function LinkStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: 'farms' | 'loans' | 'lab' | 'livestock' | 'surveillance';
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded bg-primary-50 text-primary-700">
        <Icon name={icon} size={16} />
      </span>
      <span>
        <span className="block text-lg font-bold leading-none text-slate-800">{value}</span>
        <span className="text-xs text-slate-500">{label}</span>
      </span>
    </div>
  );
}
