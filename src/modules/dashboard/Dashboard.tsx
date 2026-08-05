// S12 — dashboard landing. Wave A ships the KPI cards + recent activity; charts,
// the report builder and PDF/Excel export arrive in Wave D.
import { useAuth } from '../../app/auth';
import { Icon } from '../../components/Icon';
import { ReqBadge } from '../../components/ReqBadge';
import { Card, PageHeader, Stat } from '../../components/ui';
import { fmtDateTime, titleCase } from '../../lib/format';
import { useStore } from '../../lib/store';

export function Dashboard() {
  const { db } = useStore();
  const { user } = useAuth();

  const farmers = db.clients.filter(
    (c) => c.status === 'active' && c.stakeholderType !== 'vendor',
  ).length;
  const farms = db.farms.filter((f) => f.status === 'active').length;
  const activeLoans = db.loans.filter((l) => !['rejected', 'draft'].includes(l.status)).length;
  const openSamples = db.samples.filter((s) => s.status !== 'released').length;
  const openCases = db.surveillanceCases.filter(
    (s) => !['closed', 'ruled_out'].includes(s.status),
  ).length;
  const pendingInspections = db.inspections.filter(
    (i) => i.status === 'scheduled' || i.status === 'pending_sync',
  ).length;

  const recent = db.audit.slice().reverse().slice(0, 8);

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.name.split(' ')[0]}`}
        code="S12"
        icon="dashboard"
        subtitle="National overview of the Agriculture Information System"
        actions={<ReqBadge id={['xii.1', 'xii.2', 'xii.3', 'xii.4']} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Farmers" value={farmers} tone="primary" />
        <Stat label="Farms" value={farms} tone="primary" />
        <Stat label="Active loans" value={activeLoans} />
        <Stat label="Samples in progress" value={openSamples} />
        <Stat label="Open cases" value={openCases} tone="warn" />
        <Stat label="Pending inspections" value={pendingInspections} tone="warn" />
      </div>

      <Card className="mt-5 p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
          <Icon name="reset" size={16} /> Recent activity
        </h2>
        <ul className="divide-y divide-slate-100">
          {recent.map((a) => (
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

      <p className="mt-4 rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-500">
        Charts, drill-down and the PDF/Excel report builder are scheduled for Wave D (
        <span className="font-mono text-xs">xii.5–xii.7</span>).
      </p>
    </div>
  );
}
