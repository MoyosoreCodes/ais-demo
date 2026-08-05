// S02 — client registry (officer view). Searchable/filterable/paginated master
// registry, officer-assisted registration with duplicate detection, and a merge tool.
import { type FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../app/auth';
import { DataTable } from '../../components/DataTable';
import { Icon } from '../../components/Icon';
import { ReqBadge } from '../../components/ReqBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { Card, cx, Field, Modal, PageHeader } from '../../components/ui';
import { fmtDate, nowIso } from '../../lib/format';
import { nextClientId, uid } from '../../lib/ids';
import { useStore } from '../../lib/store';
import {
  type AuditEntry,
  type Client,
  type District,
  DISTRICTS,
  type StakeholderType,
} from '../../lib/types';

const emptyForm = {
  firstName: '',
  lastName: '',
  nin: '999-',
  phone: '+248 2 000 0',
  email: '',
  district: 'Anse Boileau' as District,
  stakeholderType: 'farmer' as StakeholderType,
};

export function Clients() {
  const { db, upsert, patch } = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [dupWarning, setDupWarning] = useState<Client[]>([]);

  const audit = (action: string, detail: string, entityId?: string) => {
    const entry: AuditEntry = {
      id: uid('AUD'),
      at: nowIso(),
      actor: user?.name ?? 'system',
      actorRole: user?.role ?? 'system',
      action,
      category: 'data',
      detail,
      entity: 'client',
      entityId,
    };
    upsert('audit', entry);
  };

  const active = db.clients.filter((c) => c.status !== 'merged');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return active.filter((c) => {
      if (districtFilter && c.district !== districtFilter) return false;
      if (typeFilter && c.stakeholderType !== typeFilter) return false;
      if (!q) return true;
      return [c.id, c.firstName, c.lastName, c.nin, c.phone, c.email, c.district]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [active, query, districtFilter, typeFilter]);

  // Duplicate detection: clients sharing a NIN or phone (req ii.7).
  const duplicateGroups = useMemo(() => {
    const byKey = new Map<string, Client[]>();
    for (const c of active) {
      for (const key of [`nin:${c.nin}`, `phone:${c.phone}`]) {
        const list = byKey.get(key) ?? [];
        list.push(c);
        byKey.set(key, list);
      }
    }
    const groups: Client[][] = [];
    const seen = new Set<string>();
    for (const list of byKey.values()) {
      const unique = list.filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i);
      if (unique.length > 1) {
        const sig = unique
          .map((c) => c.id)
          .sort()
          .join('|');
        if (!seen.has(sig)) {
          seen.add(sig);
          groups.push(unique);
        }
      }
    }
    return groups;
  }, [active]);

  const findDuplicatesFor = (f: typeof form): Client[] =>
    active.filter(
      (c) =>
        c.nin === f.nin ||
        c.phone === f.phone ||
        (c.firstName.toLowerCase() === f.firstName.toLowerCase() &&
          c.lastName.toLowerCase() === f.lastName.toLowerCase()),
    );

  const saveClient = () => {
    const id = nextClientId(db.clients);
    const client: Client = {
      id,
      nin: form.nin,
      firstName: form.firstName,
      lastName: form.lastName,
      gender: 'F',
      dob: '1990-01-01',
      phone: form.phone,
      email: form.email,
      address: form.district,
      district: form.district,
      stakeholderType: form.stakeholderType,
      seyidVerified: false,
      status: 'active',
      source: 'officer',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      history: [
        {
          at: nowIso(),
          by: user?.name ?? 'Officer',
          field: 'record',
          from: '',
          to: 'officer-assisted registration',
        },
      ],
    };
    upsert('clients', client);
    audit('client.create', `Registered ${client.firstName} ${client.lastName}`, id);
    setAddOpen(false);
    setDupWarning([]);
    setForm(emptyForm);
    navigate(`/app/clients/${id}`);
  };

  const submitAdd = (e: FormEvent) => {
    e.preventDefault();
    const dups = findDuplicatesFor(form);
    if (dups.length > 0) {
      setDupWarning(dups);
      return;
    }
    saveClient();
  };

  const mergeInto = (keepId: string, dropId: string) => {
    db.farms
      .filter((f) => f.clientId === dropId)
      .forEach((f) => patch('farms', f.id, { clientId: keepId }));
    db.loans
      .filter((l) => l.clientId === dropId)
      .forEach((l) => patch('loans', l.id, { clientId: keepId }));
    db.samples
      .filter((s) => s.clientId === dropId)
      .forEach((s) => patch('samples', s.id, { clientId: keepId }));
    db.livestockVisits
      .filter((v) => v.clientId === dropId)
      .forEach((v) => patch('livestockVisits', v.id, { clientId: keepId }));
    db.surveillanceCases
      .filter((s) => s.clientId === dropId)
      .forEach((s) => patch('surveillanceCases', s.id, { clientId: keepId }));
    db.inspections
      .filter((i) => i.clientId === dropId)
      .forEach((i) => patch('inspections', i.id, { clientId: keepId }));
    patch('clients', dropId, { status: 'merged', mergedInto: keepId, updatedAt: nowIso() });
    audit('client.merge', `Merged ${dropId} into ${keepId}`, keepId);
  };

  return (
    <div>
      <PageHeader
        title="Client Registry"
        code="S02"
        icon="clients"
        subtitle="Centralised master registry of farmers and stakeholders"
        actions={
          <>
            <button
              type="button"
              className={cx('btn-secondary', duplicateGroups.length > 0 && 'ring-1 ring-amber-300')}
              onClick={() => setDupOpen(true)}
            >
              <Icon name="link" size={16} /> Duplicates
              {duplicateGroups.length > 0 && (
                <span className="rounded-full bg-amber-100 px-1.5 text-xs text-amber-700">
                  {duplicateGroups.length}
                </span>
              )}
              <ReqBadge id="ii.7" />
            </button>
            <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
              <Icon name="plus" size={16} /> Register client <ReqBadge id="i.5" />
            </button>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Icon name="search" size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search name, NIN, phone, email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="input sm:w-48"
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
          >
            <option value="">All districts</option>
            {DISTRICTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select
            className="input sm:w-40"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            <option value="farmer">Farmer</option>
            <option value="vendor">Vendor</option>
            <option value="both">Both</option>
          </select>
          <span className="flex items-center px-1 text-xs text-slate-400">
            <ReqBadge id={['ii.1', 'ii.6']} />
          </span>
        </div>
      </Card>

      <Card className="p-1 sm:p-2">
        <DataTable
          rows={filtered}
          pageSize={12}
          onRowClick={(c) => navigate(`/app/clients/${c.id}`)}
          columns={[
            {
              key: 'id',
              header: 'ID',
              render: (c) => <span className="font-mono text-xs text-slate-500">{c.id}</span>,
            },
            {
              key: 'name',
              header: 'Name',
              render: (c) => (
                <span className="font-medium text-slate-800">
                  {c.firstName} {c.lastName}
                  {c.seyidVerified && (
                    <Icon name="shield" size={13} className="ml-1 inline text-primary-600" />
                  )}
                </span>
              ),
            },
            {
              key: 'nin',
              header: 'NIN',
              hideOnMobile: true,
              render: (c) => <span className="font-mono text-xs">{c.nin}</span>,
            },
            { key: 'district', header: 'District', hideOnMobile: true, render: (c) => c.district },
            {
              key: 'type',
              header: 'Type',
              hideOnMobile: true,
              render: (c) => <span className="capitalize">{c.stakeholderType}</span>,
            },
            {
              key: 'source',
              header: 'Source',
              hideOnMobile: true,
              render: (c) => (
                <span className="text-xs text-slate-500">{c.source.replace('_', '-')}</span>
              ),
            },
            { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
          ]}
        />
      </Card>

      {/* Register client */}
      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setDupWarning([]);
        }}
        title="Officer-assisted registration"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="add-client" className="btn-primary">
              {dupWarning.length ? 'Review duplicates' : 'Register'}
            </button>
          </>
        }
      >
        <form id="add-client" onSubmit={submitAdd} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" required>
              <input
                className="input"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </Field>
            <Field label="Last name" required>
              <input
                className="input"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </Field>
          </div>
          <Field label="NIN" hint="Fictional — starts with 999-">
            <input
              className="input font-mono"
              value={form.nin}
              onChange={(e) => setForm({ ...form, nin: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="District">
              <select
                className="input"
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value as District })}
              >
                {DISTRICTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Email">
            <input
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>

          {dupWarning.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
                <Icon name="alert" size={16} /> Possible duplicate{dupWarning.length > 1 ? 's' : ''}{' '}
                found
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-800">
                {dupWarning.map((c) => (
                  <li key={c.id}>
                    {c.firstName} {c.lastName} · {c.id} · NIN {c.nin} · {c.phone}
                  </li>
                ))}
              </ul>
              <button type="button" className="btn-primary mt-3 py-1 text-xs" onClick={saveClient}>
                Register anyway
              </button>
            </div>
          )}
        </form>
      </Modal>

      {/* Duplicates tool */}
      <Modal
        open={dupOpen}
        onClose={() => setDupOpen(false)}
        title="Duplicate detection & merge"
        wide
      >
        {duplicateGroups.length === 0 ? (
          <p className="text-sm text-slate-500">No duplicates detected on NIN or phone.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Records sharing a NIN or phone number. Merging keeps the primary record and re-links
              all farms, loans, samples and cases to it.
            </p>
            {duplicateGroups.map((group) => {
              const primary =
                group.find((c) => c.source === 'self_service' || c.seyidVerified) ?? group[0];
              return (
                <div
                  key={group.map((c) => c.id).join('|')}
                  className="rounded-md border border-slate-200 p-3"
                >
                  {group.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-1 text-sm">
                      <span>
                        <span className="font-medium text-slate-800">
                          {c.firstName} {c.lastName}
                        </span>{' '}
                        <span className="text-xs text-slate-400">
                          {c.id} · {c.source} · {fmtDate(c.createdAt)}
                        </span>
                        {c.id === primary.id && (
                          <span className="ml-2 rounded bg-primary-100 px-1.5 text-[10px] text-primary-700">
                            primary
                          </span>
                        )}
                      </span>
                      {c.id !== primary.id && (
                        <button
                          type="button"
                          className="btn-secondary py-1 text-xs"
                          onClick={() => mergeInto(primary.id, c.id)}
                        >
                          Merge into primary
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
