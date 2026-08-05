import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useAuth } from '../../app/auth';
import { Icon } from '../../components/Icon';
import { ReqBadge } from '../../components/ReqBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { Card, Field, PageHeader, Stat } from '../../components/ui';
import { exportTableCsv, exportTableExcel, exportTablePdf } from '../../lib/export';
import { fmtDate, fmtDateTime, scr, titleCase } from '../../lib/format';
import { useClientName, useStore } from '../../lib/store';
import { brandHex } from '../../lib/theme';
import type { Database } from '../../lib/types';
import { DISTRICTS } from '../../lib/types';

const PIE_COLORS = ['#0f6b4f', '#2e9576', '#63b79a', '#9fd3bf', '#f59e0b', '#dc2626', '#64748b'];

type Cell = string | number;
interface DatasetSpec {
  key: string;
  label: string;
  columns: string[];
  build: (db: Database, district: string) => Cell[][];
}

const clientName = (db: Database, id: string) => {
  const c = db.clients.find((x) => x.id === id);
  return c ? `${c.firstName} ${c.lastName}` : id;
};

const DATASETS: DatasetSpec[] = [
  {
    key: 'clients',
    label: 'Farmers & stakeholders',
    columns: ['ID', 'Name', 'NIN', 'District', 'Type', 'Status'],
    build: (db, d) =>
      db.clients
        .filter((c) => c.status !== 'merged' && (!d || c.district === d))
        .map((c) => [
          c.id,
          `${c.firstName} ${c.lastName}`,
          c.nin,
          c.district,
          c.stakeholderType,
          c.status,
        ]),
  },
  {
    key: 'farms',
    label: 'Farms',
    columns: ['Farm ID', 'Name', 'Owner', 'District', 'Size (ha)', 'Verification'],
    build: (db, d) =>
      db.farms
        .filter((f) => f.status === 'active' && (!d || f.district === d))
        .map((f) => [
          f.id,
          f.name,
          clientName(db, f.clientId),
          f.district,
          f.sizeHa,
          f.verificationStatus,
        ]),
  },
  {
    key: 'loans',
    label: 'Loans',
    columns: ['Loan ID', 'Applicant', 'Amount (SCR)', 'Purpose', 'Status'],
    build: (db, d) =>
      db.loans
        .filter((l) => !d || db.farms.find((f) => f.id === l.farmId)?.district === d)
        .map((l) => [l.id, clientName(db, l.clientId), l.amountSCR, l.purpose, l.status]),
  },
  {
    key: 'samples',
    label: 'Laboratory samples',
    columns: ['Sample', 'Barcode', 'Type', 'Applicant', 'Status'],
    build: (db, d) =>
      db.samples
        .filter((s) => !d || db.farms.find((f) => f.id === s.farmId)?.district === d)
        .map((s) => [s.id, s.barcode, s.type, clientName(db, s.clientId), s.status]),
  },
  {
    key: 'leases',
    label: 'Leases',
    columns: ['Lease', 'Lessee', 'Parcel', 'District', 'Status', 'Payment'],
    build: (db, d) =>
      db.leases
        .filter((l) => !d || l.district === d)
        .map((l) => [
          l.id,
          clientName(db, l.clientId),
          l.parcelRef,
          l.district,
          l.status,
          l.paymentStatus,
        ]),
  },
];

export function Dashboard() {
  const { db } = useStore();
  const { user } = useAuth();
  const resolveName = useClientName();

  const kpi = {
    farmers: db.clients.filter((c) => c.status === 'active' && c.stakeholderType !== 'vendor')
      .length,
    farms: db.farms.filter((f) => f.status === 'active').length,
    loans: db.loans.filter((l) => !['rejected', 'draft'].includes(l.status)).length,
    samples: db.samples.filter((s) => s.status !== 'released').length,
    cases: db.surveillanceCases.filter((s) => !['closed', 'ruled_out'].includes(s.status)).length,
    inspections: db.inspections.filter(
      (i) => i.status === 'scheduled' || i.status === 'pending_sync',
    ).length,
  };

  const farmsByDistrict = useMemo(
    () =>
      DISTRICTS.map((d) => ({
        name: d.replace('Grand Anse ', 'GA '),
        full: d,
        value: db.farms.filter((f) => f.status === 'active' && f.district === d).length,
      })).filter((r) => r.value > 0),
    [db.farms],
  );
  const loansByStatus = useMemo(() => {
    const counts = new Map<string, number>();
    db.loans.forEach((l) => counts.set(l.status, (counts.get(l.status) ?? 0) + 1));
    return [...counts.entries()].map(([name, value]) => ({ name: titleCase(name), value }));
  }, [db.loans]);

  const [drill, setDrill] = useState<string | null>(null);
  const drillFarms = drill
    ? db.farms.filter((f) => f.status === 'active' && f.district === drill)
    : [];

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.name.split(' ')[0]}`}
        code="S12"
        icon="dashboard"
        subtitle="National overview of the Agriculture Information System"
        actions={<ReqBadge id={['xii.1', 'xii.2', 'xii.3', 'xii.4', 'xii.7']} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Farmers" value={kpi.farmers} tone="primary" />
        <Stat label="Farms" value={kpi.farms} tone="primary" />
        <Stat label="Active loans" value={kpi.loans} />
        <Stat label="Samples in progress" value={kpi.samples} />
        <Stat label="Open cases" value={kpi.cases} tone="warn" />
        <Stat label="Pending inspections" value={kpi.inspections} tone="warn" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Farms by district{' '}
            <span className="text-xs font-normal text-slate-400">(click a bar to drill down)</span>
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={farmsByDistrict}
              margin={{ top: 5, right: 10, bottom: 5, left: -20 }}
              onClick={(s) =>
                setDrill(farmsByDistrict.find((r) => r.name === s?.activeLabel)?.full ?? null)
              }
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar
                dataKey="value"
                fill={brandHex(600)}
                radius={[3, 3, 0, 0]}
                cursor="pointer"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
          {drill && (
            <div className="mt-2 rounded-md bg-slate-50 p-3">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">
                  {drill} — {drillFarms.length} farms
                </span>
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-slate-600"
                  onClick={() => setDrill(null)}
                >
                  clear
                </button>
              </div>
              <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-slate-600">
                {drillFarms.map((f) => (
                  <li key={f.id}>
                    {f.name} — {resolveName(f.clientId)} ({f.sizeHa} ha)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Loans by status</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={loansByStatus}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, value }) => `${name} (${value})`}
                labelLine={false}
                isAnimationActive={false}
              >
                {loansByStatus.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <ReportBuilder />

      <Card className="mt-5 p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
          <Icon name="reset" size={16} /> Recent activity
        </h2>
        <ul className="divide-y divide-slate-100">
          {db.audit
            .slice()
            .reverse()
            .slice(0, 8)
            .map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-2 text-sm">
                <span className="mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                  {a.category}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-slate-800">{titleCase(a.action)}</span>
                  <span className="text-slate-500"> — {a.detail}</span>
                  <span className="block text-xs text-slate-400">
                    {fmtDateTime(a.at)} · {a.actor}
                  </span>
                </span>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}

function ReportBuilder() {
  const { db } = useStore();
  const [datasetKey, setDatasetKey] = useState(DATASETS[0].key);
  const [district, setDistrict] = useState('');
  const [ran, setRan] = useState(false);

  const dataset = DATASETS.find((d) => d.key === datasetKey)!;
  const rows = useMemo(
    () => (ran ? dataset.build(db, district) : []),
    [ran, dataset, db, district],
  );
  const meta = district ? `${dataset.label} · ${district}` : dataset.label;

  return (
    <Card className="mt-5 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="documents" size={18} className="text-primary-700" />
        <h2 className="font-semibold text-slate-800">Ad-hoc report builder</h2>
        <ReqBadge id={['xii.5', 'xii.6']} />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Dataset">
          <select
            className="input sm:w-56"
            value={datasetKey}
            onChange={(e) => {
              setDatasetKey(e.target.value);
              setRan(false);
            }}
          >
            {DATASETS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="District filter">
          <select
            className="input sm:w-48"
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value);
              setRan(false);
            }}
          >
            <option value="">All districts</option>
            {DISTRICTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <button type="button" className="btn-primary" onClick={() => setRan(true)}>
          Run report
        </button>
      </div>

      {ran && (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">
              {rows.length} rows · {meta}
            </span>
            <span className="ml-auto flex gap-2">
              <button
                type="button"
                className="btn-secondary py-1 text-xs"
                onClick={() =>
                  exportTablePdf({
                    title: dataset.label,
                    subtitle: meta,
                    columns: dataset.columns,
                    rows,
                    filename: `${dataset.key}.pdf`,
                  })
                }
              >
                <Icon name="download" size={14} /> PDF
              </button>
              <button
                type="button"
                className="btn-secondary py-1 text-xs"
                onClick={() =>
                  exportTableExcel({
                    sheet: dataset.label,
                    columns: dataset.columns,
                    rows,
                    filename: `${dataset.key}.xlsx`,
                  })
                }
              >
                <Icon name="download" size={14} /> Excel
              </button>
              <button
                type="button"
                className="btn-secondary py-1 text-xs"
                onClick={() =>
                  exportTableCsv({ columns: dataset.columns, rows, filename: `${dataset.key}.csv` })
                }
              >
                <Icon name="download" size={14} /> CSV
              </button>
            </span>
          </div>
          <div className="max-h-72 overflow-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  {dataset.columns.map((c) => (
                    <th key={c} className="px-3 py-2 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {r.map((cell, j) => (
                      <td key={j} className="px-3 py-1.5">
                        {dataset.columns[j] === 'Status' ||
                        dataset.columns[j] === 'Verification' ||
                        dataset.columns[j] === 'Payment' ? (
                          <StatusBadge status={String(cell)} />
                        ) : dataset.columns[j] === 'Amount (SCR)' ? (
                          scr(Number(cell))
                        ) : (
                          String(cell)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            A user builds this without SQL; every query is scoped and parameterised on the real
            system. Generated {fmtDate(new Date().toISOString())}.
          </p>
        </div>
      )}
    </Card>
  );
}
