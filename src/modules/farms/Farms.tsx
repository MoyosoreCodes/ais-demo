// S03 — farm registration (mobile-priority). Dual-channel intake, Leaflet GPS
// picker, configurable activity fields, simulated document upload, auto Farm ID,
// two-way link to the client, and duplicate detection on GPS proximity / owner.
import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../app/auth';
import { DataTable } from '../../components/DataTable';
import { DocUploader } from '../../components/DocUploader';
import { Icon } from '../../components/Icon';
import { MapPicker } from '../../components/MapPicker';
import { ReqBadge } from '../../components/ReqBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { Card, cx, Field, PageHeader, SimBadge } from '../../components/ui';
import { fmtDate, nowIso } from '../../lib/format';
import { degDistance, DISTRICT_CENTERS } from '../../lib/geo';
import { nextFarmId, uid } from '../../lib/ids';
import { useStore } from '../../lib/store';
import {
  type AuditEntry,
  CROPS,
  type District,
  DISTRICTS,
  type DocRef,
  type Farm,
  LIVESTOCK,
  type Tenure,
} from '../../lib/types';

const TENURES: Tenure[] = ['owned', 'leased', 'state_land', 'family'];
const DUP_THRESHOLD = 0.0025; // ~250 m

export function Farms() {
  const { db, upsert } = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [mode, setMode] = useState<'list' | 'new'>('list');
  const [query, setQuery] = useState('');

  const activeFarms = db.farms.filter((f) => f.status === 'active');
  const clientName = (clientId: string) => {
    const c = db.clients.find((x) => x.id === clientId);
    return c ? `${c.firstName} ${c.lastName}` : clientId;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeFarms;
    return activeFarms.filter((f) =>
      [f.id, f.name, f.district, clientName(f.clientId)].join(' ').toLowerCase().includes(q),
    );
  }, [activeFarms, query]);

  // ---- registration form state ----
  const preselect = params.get('client') ?? db.clients[0]?.id ?? '';
  const [clientId, setClientId] = useState(preselect);
  const [name, setName] = useState('');
  const [district, setDistrict] = useState<District>('Anse Boileau');
  const [size, setSize] = useState('1.0');
  const [tenure, setTenure] = useState<Tenure>('leased');
  const [crops, setCrops] = useState<string[]>([]);
  const [livestock, setLivestock] = useState<string[]>([]);
  const [pin, setPin] = useState<[number, number]>(DISTRICT_CENTERS['Anse Boileau']);
  const [docs, setDocs] = useState<DocRef[]>([]);
  const [channel, setChannel] = useState<'online' | 'officer'>('officer');

  const setDistrictAndCenter = (d: District) => {
    setDistrict(d);
    setPin(DISTRICT_CENTERS[d]);
  };

  const toggle = (list: string[], value: string, set: (v: string[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  // duplicate detection: same owner, or another farm within ~250 m of the pin
  const duplicates = useMemo(
    () =>
      activeFarms.filter(
        (f) => f.clientId === clientId || degDistance([f.lat, f.lng], pin) < DUP_THRESHOLD,
      ),
    [activeFarms, clientId, pin],
  );

  const resetForm = () => {
    setName('');
    setCrops([]);
    setLivestock([]);
    setDocs([]);
    setSize('1.0');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = nextFarmId(db.farms);
    const farm: Farm = {
      id,
      clientId,
      name: name || `${clientName(clientId)} Farm`,
      district,
      lat: pin[0],
      lng: pin[1],
      sizeHa: Number(size) || 0,
      tenure,
      crops,
      livestock,
      docs,
      verificationStatus: 'pending',
      status: 'active',
      source: channel,
      createdAt: nowIso(),
    };
    upsert('farms', farm);
    const entry: AuditEntry = {
      id: uid('AUD'),
      at: nowIso(),
      actor: user?.name ?? 'system',
      actorRole: user?.role ?? 'system',
      action: 'farm.create',
      category: 'data',
      detail: `Registered ${id} for ${clientName(clientId)}`,
      entity: 'farm',
      entityId: id,
    };
    upsert('audit', entry);
    resetForm();
    setMode('list');
  };

  if (mode === 'new') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setMode('list')}
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <Icon name="chevron" size={14} className="rotate-180" /> Farm register
        </button>
        <PageHeader
          title="Register a farm"
          code="S03"
          icon="farms"
          subtitle="Links to a client record and gets an auto Farm ID"
        />

        <form onSubmit={submit} className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <Card className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">Intake channel</span>
                <ReqBadge id="iii.1" />
              </div>
              <div className="flex gap-2">
                {(['officer', 'online'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChannel(c)}
                    className={cx(
                      'flex-1 rounded-md border px-3 py-2 text-sm capitalize',
                      channel === c
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-slate-300 text-slate-600',
                    )}
                  >
                    {c === 'officer' ? 'Back-office' : 'Online'}
                  </button>
                ))}
              </div>

              <Field label="Client (owner)" required>
                <select
                  className="input"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
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
              <Field label="Farm name">
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rivière Doux Farm"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="District">
                  <select
                    className="input"
                    value={district}
                    onChange={(e) => setDistrictAndCenter(e.target.value as District)}
                  >
                    {DISTRICTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Size (ha)">
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    min="0"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Tenure">
                <select
                  className="input"
                  value={tenure}
                  onChange={(e) => setTenure(e.target.value as Tenure)}
                >
                  {TENURES.map((t) => (
                    <option key={t} value={t} className="capitalize">
                      {t.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </Field>
            </Card>

            <Card className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">Agricultural activity</span>
                <ReqBadge id="iii.3" />
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Crops</span>
                <div className="flex flex-wrap gap-1.5">
                  {CROPS.map((c) => (
                    <Chip
                      key={c}
                      active={crops.includes(c)}
                      onClick={() => toggle(crops, c, setCrops)}
                    >
                      {c}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Livestock</span>
                <div className="flex flex-wrap gap-1.5">
                  {LIVESTOCK.map((l) => (
                    <Chip
                      key={l}
                      active={livestock.includes(l)}
                      onClick={() => toggle(livestock, l, setLivestock)}
                    >
                      {l}
                    </Chip>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <DocUploader docs={docs} onChange={setDocs} label="Supporting documents" />
              <div className="mt-1">
                <ReqBadge id="iii.4" />
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">GPS location</span>
                <ReqBadge id="iii.2" />
              </div>
              <MapPicker
                lat={pin[0]}
                lng={pin[1]}
                onChange={(lat, lng) => setPin([lat, lng])}
                simCenter={DISTRICT_CENTERS[district]}
                others={duplicates.map((f) => ({
                  lat: f.lat,
                  lng: f.lng,
                  label: `${f.name} (${f.id})`,
                  tone: 'danger',
                }))}
                height={280}
              />
            </Card>

            {duplicates.length > 0 && (
              <Card className="border-amber-300 bg-amber-50 p-4">
                <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
                  <Icon name="alert" size={16} /> Possible duplicate farm <ReqBadge id="iii.7" />
                </p>
                <ul className="mt-2 space-y-1 text-xs text-amber-800">
                  {duplicates.slice(0, 4).map((f) => (
                    <li key={f.id}>
                      {f.name} · {f.id} · {clientName(f.clientId)} ·{' '}
                      {f.clientId === clientId ? 'same owner' : 'nearby GPS'}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <div className="flex items-center justify-end gap-2">
              <span className="mr-auto text-xs text-slate-400">
                Farm ID auto-generated on save <ReqBadge id="iii.5" />
              </span>
              <button type="button" className="btn-secondary" onClick={() => setMode('list')}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Register farm
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Farm Registration"
        code="S03"
        icon="farms"
        subtitle="Registered farms, GPS-located and linked to their owners"
        actions={
          <button type="button" className="btn-primary" onClick={() => setMode('new')}>
            <Icon name="plus" size={16} /> Register farm
          </button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="relative">
          <Icon name="search" size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search farm name, ID, owner, district…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </Card>

      <Card className="p-1 sm:p-2">
        <DataTable
          rows={filtered}
          pageSize={12}
          onRowClick={(f) => navigate(`/app/clients/${f.clientId}`)}
          columns={[
            {
              key: 'id',
              header: 'Farm ID',
              render: (f) => <span className="font-mono text-xs text-slate-500">{f.id}</span>,
            },
            {
              key: 'name',
              header: 'Name',
              render: (f) => <span className="font-medium text-slate-800">{f.name}</span>,
            },
            { key: 'owner', header: 'Owner', render: (f) => clientName(f.clientId) },
            { key: 'district', header: 'District', hideOnMobile: true, render: (f) => f.district },
            { key: 'size', header: 'Size', hideOnMobile: true, render: (f) => `${f.sizeHa} ha` },
            {
              key: 'activity',
              header: 'Activity',
              hideOnMobile: true,
              render: (f) => (
                <span className="text-xs text-slate-500">
                  {f.crops.concat(f.livestock).join(', ') || '—'}
                </span>
              ),
            },
            {
              key: 'created',
              header: 'Added',
              hideOnMobile: true,
              render: (f) => <span className="text-xs">{fmtDate(f.createdAt)}</span>,
            },
            {
              key: 'status',
              header: 'Verification',
              render: (f) => <StatusBadge status={f.verificationStatus} />,
            },
          ]}
        />
      </Card>

      <p className="mt-3 flex items-center gap-1 text-xs text-slate-400">
        <SimBadge label="GPS / uploads simulated" /> Farms link two-way to the client registry
        (S02).
        <ReqBadge id={['iii.6', 'iii.5']} />
      </p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-full border px-2.5 py-1 text-xs',
        active
          ? 'border-primary-500 bg-primary-50 text-primary-700'
          : 'border-slate-300 text-slate-600 hover:border-slate-400',
      )}
    >
      {children}
    </button>
  );
}
