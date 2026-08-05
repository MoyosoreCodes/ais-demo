import { type FormEvent, useState } from 'react';

import { useAuth } from '../../app/auth';
import { DataTable } from '../../components/DataTable';
import { Icon } from '../../components/Icon';
import { ReqBadge } from '../../components/ReqBadge';
import { useToast } from '../../components/Toast';
import { Card, cx, Field, Modal, PageHeader, Stat, Tabs } from '../../components/ui';
import { fmtDate, nowIso, titleCase } from '../../lib/format';
import { nextVendorId, uid } from '../../lib/ids';
import { useStore } from '../../lib/store';
import {
  type AuditEntry,
  type District,
  DISTRICTS,
  type Vendor,
  type VendorStatus,
} from '../../lib/types';

const TRADER_TYPES = ['produce', 'livestock', 'processed', 'mixed'] as const;

export function Vendors() {
  const [tab, setTab] = useState<'vendors' | 'market'>('vendors');
  return (
    <div>
      <PageHeader
        title="Vendor & Market"
        code="S09"
        icon="vendors"
        subtitle="Vendor registry and Victoria Market stall allocation"
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'vendors', label: 'Vendors' },
          { key: 'market', label: 'Market stalls' },
        ]}
      />
      {tab === 'vendors' ? <Registry /> : <Market />}
    </div>
  );
}

function Registry() {
  const { db, patch, upsert } = useStore();
  const { user } = useAuth();
  const { push } = useToast();
  const [addOpen, setAddOpen] = useState(false);

  const stallOf = (id?: string) => db.stalls.find((s) => s.vendorId === id)?.id;
  const audit = (action: string, detail: string, entityId: string) =>
    upsert('audit', {
      id: uid('AUD'),
      at: nowIso(),
      actor: user?.name ?? 'system',
      actorRole: user?.role ?? 'system',
      action,
      category: 'data',
      detail,
      entity: 'vendor',
      entityId,
    } satisfies AuditEntry);

  const setStatus = (v: Vendor, status: VendorStatus) => {
    patch('vendors', v.id, { registrationStatus: status });
    audit('vendor.status', `${v.id} → ${status}`, v.id);
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Vendors" value={db.vendors.length} />
        <Stat
          label="Active"
          value={db.vendors.filter((v) => v.registrationStatus === 'active').length}
          tone="primary"
        />
        <Stat
          label="Pending"
          value={db.vendors.filter((v) => v.registrationStatus === 'pending').length}
          tone="warn"
        />
        <Stat
          label="Allocated stalls"
          value={db.stalls.filter((s) => s.status === 'allocated').length}
        />
      </div>
      <div className="mb-3 flex justify-end">
        <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
          <Icon name="plus" size={16} /> Register vendor <ReqBadge id="ix.1" />
        </button>
      </div>
      <Card className="p-1 sm:p-2">
        <DataTable
          rows={db.vendors}
          pageSize={12}
          columns={[
            {
              key: 'id',
              header: 'Vendor',
              render: (v) => <span className="font-mono text-xs text-slate-500">{v.id}</span>,
            },
            {
              key: 'name',
              header: 'Name',
              render: (v) => <span className="font-medium text-slate-800">{v.name}</span>,
            },
            {
              key: 'type',
              header: 'Trade',
              hideOnMobile: true,
              render: (v) => <span className="capitalize">{v.traderType}</span>,
            },
            { key: 'district', header: 'District', hideOnMobile: true, render: (v) => v.district },
            {
              key: 'stall',
              header: 'Stall',
              render: (v) => stallOf(v.id) ?? <span className="text-slate-300">—</span>,
            },
            {
              key: 'registered',
              header: 'Registered',
              hideOnMobile: true,
              render: (v) => <span className="text-xs">{fmtDate(v.registeredAt)}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              render: (v) => (
                <select
                  className="rounded border border-slate-200 px-1.5 py-1 text-xs"
                  value={v.registrationStatus}
                  onChange={(e) => setStatus(v, e.target.value as VendorStatus)}
                >
                  {(['pending', 'active', 'suspended', 'expired'] as VendorStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {titleCase(s)}
                    </option>
                  ))}
                </select>
              ),
            },
          ]}
        />
      </Card>

      <NewVendor
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={(name, traderType, district, phone) => {
          const id = nextVendorId(db.vendors);
          const v: Vendor = {
            id,
            name,
            traderType,
            phone,
            district,
            registrationStatus: 'pending',
            registeredAt: nowIso(),
          };
          upsert('vendors', v);
          audit('vendor.create', `${id} (${name}) registered`, id);
          push(`${id} registered`, 'success');
          setAddOpen(false);
        }}
      />
    </div>
  );
}

function Market() {
  const { db, patch } = useStore();
  const { push } = useToast();
  const [allocate, setAllocate] = useState<string | null>(null);
  const sections = Array.from(new Set(db.stalls.map((s) => s.section)));
  const vendorName = (id?: string) => db.vendors.find((v) => v.id === id)?.name;
  const unallocated = db.vendors.filter((v) => !db.stalls.some((s) => s.vendorId === v.id));

  const vacate = (stallId: string) => {
    patch('stalls', stallId, { status: 'vacant', vendorId: undefined });
    push(`${stallId} vacated`, 'info');
  };
  const assign = (stallId: string, vendorId: string) => {
    patch('stalls', stallId, { status: 'allocated', vendorId });
    patch('vendors', vendorId, { stallId });
    setAllocate(null);
    push(`${stallId} allocated`, 'success');
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
        <Icon name="vendors" size={16} /> Victoria Market{' '}
        <span className="text-xs text-slate-400">(simulated layout)</span> <ReqBadge id="ix.3" />
      </div>
      <div className="space-y-4">
        {sections.map((sec) => (
          <Card key={sec} className="p-4">
            <div className="mb-2 text-sm font-semibold text-slate-700">Section {sec}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {db.stalls
                .filter((s) => s.section === sec)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => (s.status === 'allocated' ? vacate(s.id) : setAllocate(s.id))}
                    className={cx(
                      'rounded-md border p-2 text-left text-xs',
                      s.status === 'allocated'
                        ? 'border-primary-300 bg-primary-50'
                        : 'border-dashed border-slate-300 bg-white hover:border-slate-400',
                    )}
                  >
                    <div className="font-mono font-semibold text-slate-600">{s.id}</div>
                    <div
                      className={cx(
                        'truncate',
                        s.status === 'allocated' ? 'text-primary-700' : 'text-slate-400',
                      )}
                    >
                      {s.status === 'allocated' ? (vendorName(s.vendorId) ?? 'occupied') : 'vacant'}
                    </div>
                  </button>
                ))}
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Click a vacant stall to allocate, or an allocated stall to vacate. <ReqBadge id="ix.3" />
      </p>

      <Modal
        open={!!allocate}
        onClose={() => setAllocate(null)}
        title={`Allocate stall ${allocate ?? ''}`}
      >
        {unallocated.length === 0 ? (
          <p className="text-sm text-slate-400">All vendors already have a stall.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {unallocated.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {v.name}{' '}
                  <span className="text-xs text-slate-400">
                    {v.id} · {v.traderType}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn-primary py-1 text-xs"
                  onClick={() => allocate && assign(allocate, v.id)}
                >
                  Allocate
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

function NewVendor({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (
    name: string,
    traderType: Vendor['traderType'],
    district: District,
    phone: string,
  ) => void;
}) {
  const [name, setName] = useState('');
  const [traderType, setTraderType] = useState<Vendor['traderType']>('produce');
  const [district, setDistrict] = useState<District>('Anse Boileau');
  const [phone, setPhone] = useState('+248 2 000 0');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onCreate(name || 'New vendor', traderType, district, phone);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register vendor"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="new-vendor" className="btn-primary">
            Register
          </button>
        </>
      }
    >
      <form id="new-vendor" onSubmit={submit} className="space-y-3">
        <Field label="Name" required>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Trade">
            <select
              className="input"
              value={traderType}
              onChange={(e) => setTraderType(e.target.value as Vendor['traderType'])}
            >
              {TRADER_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {titleCase(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="District">
            <select
              className="input"
              value={district}
              onChange={(e) => setDistrict(e.target.value as District)}
            >
              {DISTRICTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Phone">
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
