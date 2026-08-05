import { useMemo, useState } from 'react';

import { Icon } from '../../components/Icon';
import { ReqBadge } from '../../components/ReqBadge';
import {
  Card,
  chipClass,
  Meta,
  Modal,
  PageHeader,
  SimBadge,
  Stat,
  Tabs,
} from '../../components/ui';
import { useClientName, useStore } from '../../lib/store';
import { type DigitizedDoc, type DocCategory } from '../../lib/types';

const CATEGORIES: DocCategory[] = ['lease', 'permit', 'id', 'report', 'correspondence', 'map'];

export function Documents() {
  const [tab, setTab] = useState<'repository' | 'migration'>('repository');
  return (
    <div>
      <PageHeader
        title="Document Repository"
        code="S13"
        icon="documents"
        subtitle="Digitized records and data-migration validation"
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'repository', label: 'Repository' },
          { key: 'migration', label: 'Migration report' },
        ]}
      />
      {tab === 'repository' ? <Repository /> : <Migration />}
    </div>
  );
}

function Repository() {
  const { db } = useStore();
  const clientName = useClientName();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.documents.filter((d) => {
      if (cat && d.category !== cat) return false;
      if (!q) return true;
      return `${d.title} ${d.fullText} ${d.tags.join(' ')}`.toLowerCase().includes(q);
    });
  }, [db.documents, query, cat]);
  const active = openId ? db.documents.find((d) => d.id === openId) : undefined;

  return (
    <div>
      <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Icon name="search" size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Full-text search (try: lease 2019, Hoareau)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="text-xs text-slate-400">
          <ReqBadge id={['xiv.4', 'xiv.6']} />
        </span>
      </Card>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setCat('')} className={chipClass(cat === '')}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={chipClass(cat === c)}>
            {c}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-400">No documents match.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setOpenId(d.id)}
              className="card p-4 text-left hover:border-primary-300"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded bg-primary-50 text-primary-700">
                  <Icon name="documents" size={16} />
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                  {d.category}
                </span>
                <span className="ml-auto text-xs text-slate-400">{d.year}</span>
              </div>
              <div className="font-medium text-slate-800">{d.title}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {d.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {d.source} · {d.clientId ? clientName(d.clientId) : '—'}
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!active} onClose={() => setOpenId(null)} title={active?.title ?? ''} wide>
        {active && <DocView doc={active} clientName={clientName} />}
      </Modal>
    </div>
  );
}

function DocView({ doc, clientName }: { doc: DigitizedDoc; clientName: (id: string) => string }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Meta label="Category" value={<span className="capitalize">{doc.category}</span>} />
        <Meta label="Year" value={doc.year} />
        <Meta label="Source" value={doc.source} />
        <Meta label="Owner" value={doc.clientId ? clientName(doc.clientId) : '—'} />
      </div>
      <div className="flex flex-wrap gap-1">
        {doc.tags.map((t) => (
          <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
            {t}
          </span>
        ))}
      </div>
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-6">
        <span className="pointer-events-none absolute right-3 top-3 rotate-12 rounded border border-amber-300 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-500">
          Scanned · simulated
        </span>
        <div className="mx-auto max-w-md space-y-2 bg-white p-6 shadow-sm">
          <div className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            Republic of Seychelles · Department of Agriculture
          </div>
          <div className="text-center font-semibold text-slate-700">{doc.title}</div>
          <p className="text-sm leading-relaxed text-slate-600">{doc.fullText}</p>
        </div>
      </div>
      <p className="flex items-center gap-1 text-xs text-slate-400">
        <Icon name="shield" size={13} /> Stored with AES-256 + RBAC on the real system <SimBadge />{' '}
        <ReqBadge id="xiv.5" />
      </p>
    </div>
  );
}

function Migration() {
  const { db } = useStore();

  const report = useMemo(() => {
    const active = db.clients.filter((c) => c.status !== 'merged');
    const ninGroups = new Map<string, number>();
    active.forEach((c) => ninGroups.set(c.nin, (ninGroups.get(c.nin) ?? 0) + 1));
    const dupNin = [...ninGroups.values()].filter((n) => n > 1).length;
    const badNin = active.filter((c) => !/^999-/.test(c.nin)).length;
    const farmsNoGps = db.farms.filter((f) => !f.lat || !f.lng).length;
    const orphanFarms = db.farms.filter((f) => !db.clients.some((c) => c.id === f.clientId)).length;
    const badLease = db.leases.filter((l) => new Date(l.endDate) <= new Date(l.startDate)).length;
    const unindexed = db.documents.filter((d) => !d.fullText).length;

    const counts = {
      clients: db.clients.filter((c) => c.source === 'migrated').length,
      farms: db.farms.filter((f) => f.source === 'migrated').length,
      documents: db.documents.filter((d) => d.source === 'migrated').length,
      leases: db.leases.length,
    };
    const checks = [
      {
        name: 'NIN format (999- prefix)',
        total: active.length,
        fails: badNin,
        tone: badNin ? 'fail' : 'pass',
      },
      {
        name: 'Duplicate NINs flagged for review',
        total: active.length,
        fails: dupNin,
        tone: dupNin ? 'review' : 'pass',
      },
      {
        name: 'Farm GPS coordinates present',
        total: db.farms.length,
        fails: farmsNoGps,
        tone: farmsNoGps ? 'fail' : 'pass',
      },
      {
        name: 'Farm owner resolves to a client',
        total: db.farms.length,
        fails: orphanFarms,
        tone: orphanFarms ? 'fail' : 'pass',
      },
      {
        name: 'Lease end after start',
        total: db.leases.length,
        fails: badLease,
        tone: badLease ? 'fail' : 'pass',
      },
      {
        name: 'Documents indexed for search',
        total: db.documents.length,
        fails: unindexed,
        tone: unindexed ? 'fail' : 'pass',
      },
    ];
    return { counts, checks };
  }, [db]);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Clients migrated" value={report.counts.clients} tone="primary" />
        <Stat label="Farms migrated" value={report.counts.farms} tone="primary" />
        <Stat label="Documents indexed" value={report.counts.documents} />
        <Stat label="Leases" value={report.counts.leases} />
      </div>
      <Card className="p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-800">
          Migration validation report <ReqBadge id={['xiv.1', 'xiv.3']} />
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Batch <span className="font-mono">MB-2026-001</span> · source: legacy paper registry +
          Excel (~5,000 records in the real migration).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2 font-medium">Check</th>
                <th className="px-3 py-2 font-medium">Records</th>
                <th className="px-3 py-2 font-medium">Exceptions</th>
                <th className="px-3 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {report.checks.map((c) => (
                <tr key={c.name} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2.5 text-slate-700">{c.name}</td>
                  <td className="px-3 py-2.5">{c.total}</td>
                  <td className="px-3 py-2.5">{c.fails}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={
                        chipClass(false) +
                        ' ' +
                        (c.tone === 'pass'
                          ? 'bg-green-100 text-green-700'
                          : c.tone === 'review'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700')
                      }
                    >
                      {c.tone === 'pass' ? 'Pass' : c.tone === 'review' ? 'Review' : 'Fail'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 flex items-center gap-1.5 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <Icon name="reset" size={14} /> Every batch is reversible — a rollback restores the
          pre-migration snapshot. Profiling → cleansing → mapping → migrate → verify → rollback.
        </p>
      </Card>
    </div>
  );
}
