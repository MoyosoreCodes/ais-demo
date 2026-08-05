import { type FormEvent, useMemo, useState } from 'react';

import { useAuth } from '../../app/auth';
import { DataTable } from '../../components/DataTable';
import { Icon } from '../../components/Icon';
import { ReqBadge } from '../../components/ReqBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { Timeline } from '../../components/Timeline';
import { useToast } from '../../components/Toast';
import {
  Card,
  chipClass,
  cx,
  Field,
  Meta,
  Modal,
  PageHeader,
  SimBadge,
  Stat,
} from '../../components/ui';
import { exportTableExcel, exportTablePdf } from '../../lib/export';
import { nowIso, scr, titleCase } from '../../lib/format';
import { nextLoanId, uid } from '../../lib/ids';
import { makeNotification } from '../../lib/sim';
import { useClientName, useStore } from '../../lib/store';
import { type AuditEntry, type Loan, type Role } from '../../lib/types';
import { advanceLoan, getWorkflow, orderedStages } from '../../lib/workflow';

const PIPELINE: Loan['status'][] = [
  'submitted',
  'screening',
  'assessment',
  'approval',
  'approved',
  'disbursed',
  'rejected',
];

export function Loans() {
  const { db, patch, upsert } = useStore();
  const { user } = useAuth();
  const { push } = useToast();
  const [filter, setFilter] = useState<string>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const def = getWorkflow(db, 'loan');
  const clientName = useClientName();

  const rows = useMemo(
    () => (filter ? db.loans.filter((l) => l.status === filter) : db.loans),
    [db.loans, filter],
  );
  const active = openId ? db.loans.find((l) => l.id === openId) : undefined;

  const kpi = useMemo(() => {
    const by = (s: Loan['status']) => db.loans.filter((l) => l.status === s).length;
    const portfolio = db.loans
      .filter((l) => ['approved', 'disbursed'].includes(l.status))
      .reduce((sum, l) => sum + l.amountSCR, 0);
    return {
      total: db.loans.length,
      pending: by('submitted') + by('screening') + by('assessment') + by('approval'),
      approved: by('approved') + by('disbursed'),
      rejected: by('rejected'),
      portfolio,
    };
  }, [db.loans]);

  const audit = (action: string, detail: string, entityId: string) =>
    upsert('audit', {
      id: uid('AUD'),
      at: nowIso(),
      actor: user?.name ?? 'system',
      actorRole: user?.role ?? 'system',
      action,
      category: 'workflow',
      detail,
      entity: 'loan',
      entityId,
    } satisfies AuditEntry);

  // The role that may act at the loan's current stage (the role gate).
  const stageActor = (loan: Loan): Role | null => {
    const stage = def?.stages.find((s) => s.id === loan.currentStageId);
    if (stage) return stage.actorRole;
    if (loan.status === 'submitted') return def?.stages[0]?.actorRole ?? null;
    return null;
  };
  const canAct = (loan: Loan) => user?.role === 'admin' || user?.role === stageActor(loan);

  const notifyApplicant = (loan: Loan, subject: string, body: string) => {
    const c = db.clients.find((x) => x.id === loan.clientId);
    upsert(
      'notifications',
      makeNotification({
        channel: 'sms',
        to: c?.phone ?? '',
        clientId: loan.clientId,
        subject,
        body,
        template: 'loan_status',
        event: `loan.${loan.status}`,
      }),
    );
  };

  const act = (loan: Loan, action: 'advance' | 'reject' | 'disburse') => {
    if (!def) return;
    const t = advanceLoan(def, loan, action, user?.name ?? 'Officer');
    patch('loans', loan.id, {
      status: t.status,
      currentStageId: t.currentStageId,
      history: [...loan.history, t.event],
      updatedAt: nowIso(),
    });
    audit(`loan.${action}`, `${loan.id}: ${t.event.action}`, loan.id);
    notifyApplicant(
      { ...loan, status: t.status },
      'Loan application update',
      `${loan.id} is now ${titleCase(t.status)}.`,
    );
    push(`${loan.id} → ${titleCase(t.status)} · SMS sent to applicant`, 'sms');
  };

  const exportRows = () =>
    db.loans.map((l) => [
      l.id,
      clientName(l.clientId),
      l.purpose,
      l.amountSCR,
      l.termMonths,
      titleCase(l.status),
    ]);
  const exportCols = ['Loan ID', 'Applicant', 'Purpose', 'Amount (SCR)', 'Term (months)', 'Status'];

  return (
    <div>
      <PageHeader
        title="Loan Management"
        code="S05"
        icon="loans"
        subtitle="Agricultural loan applications and multi-stage approval"
        actions={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                exportTablePdf({
                  title: 'Loan Report',
                  subtitle: `${db.loans.length} applications`,
                  columns: exportCols,
                  rows: exportRows(),
                  filename: 'loans.pdf',
                })
              }
            >
              <Icon name="download" size={16} /> PDF
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                exportTableExcel({
                  sheet: 'Loans',
                  columns: exportCols,
                  rows: exportRows(),
                  filename: 'loans.xlsx',
                })
              }
            >
              <Icon name="download" size={16} /> Excel
            </button>
            <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
              <Icon name="plus" size={16} /> New application
            </button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <Stat label="Applications" value={kpi.total} />
        <Stat label="In pipeline" value={kpi.pending} tone="warn" />
        <Stat label="Approved" value={kpi.approved} tone="primary" />
        <Stat label="Rejected" value={kpi.rejected} tone="danger" />
        <Stat label="Portfolio" value={scr(kpi.portfolio)} sub="approved + disbursed" />
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <span className="text-xs font-medium text-slate-400">Status</span>
        <button type="button" onClick={() => setFilter('')} className={chipClass(filter === '')}>
          All
        </button>
        {PIPELINE.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={chipClass(filter === s)}
          >
            {titleCase(s)}
          </button>
        ))}
        <span className="ml-auto">
          <ReqBadge id={['v.1', 'v.3', 'v.7']} />
        </span>
      </Card>

      <Card className="p-1 sm:p-2">
        <DataTable
          rows={rows}
          pageSize={12}
          onRowClick={(l) => setOpenId(l.id)}
          columns={[
            {
              key: 'id',
              header: 'Loan ID',
              render: (l) => <span className="font-mono text-xs text-slate-500">{l.id}</span>,
            },
            {
              key: 'applicant',
              header: 'Applicant',
              render: (l) => (
                <span className="font-medium text-slate-800">{clientName(l.clientId)}</span>
              ),
            },
            { key: 'purpose', header: 'Purpose', hideOnMobile: true, render: (l) => l.purpose },
            { key: 'amount', header: 'Amount', render: (l) => scr(l.amountSCR) },
            {
              key: 'stage',
              header: 'Stage',
              hideOnMobile: true,
              render: (l) => def?.stages.find((s) => s.id === l.currentStageId)?.name ?? '—',
            },
            { key: 'status', header: 'Status', render: (l) => <StatusBadge status={l.status} /> },
          ]}
        />
      </Card>

      {/* Application detail */}
      <Modal
        open={!!active}
        onClose={() => setOpenId(null)}
        title={active ? `${active.id} — ${clientName(active.clientId)}` : ''}
        wide
      >
        {active && (
          <LoanDetail
            loan={active}
            stages={def ? orderedStages(def) : []}
            canAct={canAct(active)}
            stageActor={stageActor(active)}
            onAct={(a) => act(active, a)}
            farmName={db.farms.find((f) => f.id === active.farmId)?.name}
          />
        )}
      </Modal>

      {/* New application */}
      <NewLoan
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={(clientId, farmId, amount, purpose, term) => {
          const id = nextLoanId(db.loans);
          const loan: Loan = {
            id,
            clientId,
            farmId,
            purpose,
            amountSCR: amount,
            termMonths: term,
            status: 'submitted',
            currentStageId: def?.stages[0]?.id ?? 'screening',
            docs: [],
            history: [
              {
                at: nowIso(),
                by: user?.name ?? 'Applicant',
                action: 'Application submitted',
                fromStatus: 'draft',
                toStatus: 'submitted',
              },
            ],
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          upsert('loans', loan);
          audit('loan.create', `${id} submitted (${scr(amount)})`, id);
          notifyApplicant(
            loan,
            'Loan application received',
            `${id} received and is under screening.`,
          );
          push(`${id} submitted · SMS sent`, 'sms');
          setAddOpen(false);
          setOpenId(id);
        }}
      />
    </div>
  );
}

function LoanDetail({
  loan,
  stages,
  canAct,
  stageActor,
  onAct,
  farmName,
}: {
  loan: Loan;
  stages: { id: string; name: string; actorRole: Role }[];
  canAct: boolean;
  stageActor: Role | null;
  onAct: (a: 'advance' | 'reject' | 'disburse') => void;
  farmName?: string;
}) {
  const terminal = ['approved', 'rejected', 'disbursed'].includes(loan.status);
  const currentIdx = stages.findIndex((s) => s.id === loan.currentStageId);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Meta label="Amount" value={scr(loan.amountSCR)} />
        <Meta label="Term" value={`${loan.termMonths} months`} />
        <Meta label="Farm" value={farmName ?? loan.farmId} />
        <Meta label="Status" value={<StatusBadge status={loan.status} />} />
      </div>
      <div>
        <span className="text-xs text-slate-400">Purpose</span>
        <p className="text-sm text-slate-700">{loan.purpose}</p>
      </div>

      {/* stage tracker */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          Approval stages <ReqBadge id={['v.3', 'xi.6']} />
        </div>
        <ol className="flex flex-wrap gap-2">
          {stages.map((s, i) => (
            <li
              key={s.id}
              className={cx(
                'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs',
                loan.status === 'approved' || i < currentIdx
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : i === currentIdx
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-slate-200 text-slate-400',
              )}
            >
              <span className="font-semibold">
                {i + 1}. {s.name}
              </span>
              <span className="text-[10px] opacity-70">({titleCase(s.actorRole)})</span>
            </li>
          ))}
        </ol>
      </div>

      {/* document checklist */}
      <div>
        <span className="text-xs text-slate-400">
          Documents <ReqBadge id="v.2" />
        </span>
        {loan.docs.length === 0 ? (
          <p className="text-sm text-slate-400">No documents attached.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {loan.docs.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <Icon
                  name={d.verified ? 'check' : 'x'}
                  size={14}
                  className={d.verified ? 'text-primary-600' : 'text-slate-300'}
                />
                {d.name} <span className="text-xs text-slate-400">({d.category})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* actions with role gate */}
      {!terminal && (
        <div className="rounded-md border border-slate-200 p-3">
          {canAct ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => onAct('advance')}>
                <Icon name="check" size={16} /> Advance
              </button>
              <button
                type="button"
                className="btn-secondary text-red-600"
                onClick={() => onAct('reject')}
              >
                <Icon name="x" size={16} /> Reject
              </button>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-amber-700">
              <Icon name="shield" size={15} /> Requires the{' '}
              <strong>{stageActor ? titleCase(stageActor) : 'assigned'}</strong> role to act at this
              stage (RBAC role gate).
            </p>
          )}
        </div>
      )}
      {loan.status === 'approved' && canAct && (
        <button type="button" className="btn-primary" onClick={() => onAct('disburse')}>
          Mark disbursed
        </button>
      )}

      {/* audit trail */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          Audit trail <ReqBadge id="v.5" />
        </div>
        <Timeline
          items={loan.history
            .slice()
            .reverse()
            .map((h) => ({ at: h.at, title: h.action, by: h.by, note: h.note }))}
        />
      </div>
      <p className="flex items-center gap-1 text-xs text-slate-400">
        <SimBadge label="SMS simulated" /> Applicants are notified on each status change (S13).
      </p>
    </div>
  );
}

function NewLoan({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (
    clientId: string,
    farmId: string,
    amount: number,
    purpose: string,
    term: number,
  ) => void;
}) {
  const { db } = useStore();
  const [clientId, setClientId] = useState('CLT-0001');
  const [amount, setAmount] = useState('50000');
  const [purpose, setPurpose] = useState('');
  const [term, setTerm] = useState('24');
  const clientFarms = db.farms.filter((f) => f.clientId === clientId && f.status === 'active');
  const [farmId, setFarmId] = useState(clientFarms[0]?.id ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const f = db.farms.find((x) => x.clientId === clientId && x.status === 'active');
    onCreate(
      clientId,
      farmId || f?.id || '',
      Number(amount) || 0,
      purpose || 'Agricultural investment',
      Number(term) || 24,
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New loan application"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="new-loan" className="btn-primary">
            Submit
          </button>
        </>
      }
    >
      <form id="new-loan" onSubmit={submit} className="space-y-3">
        <Field label="Applicant">
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
        <Field label="Farm">
          <select className="input" value={farmId} onChange={(e) => setFarmId(e.target.value)}>
            {clientFarms.length === 0 ? (
              <option value="">No farm on record</option>
            ) : (
              clientFarms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} — {f.id}
                </option>
              ))
            )}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (SCR)">
            <input
              className="input"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Term (months)">
            <input
              className="input"
              type="number"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Purpose">
          <input
            className="input"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Poultry house construction"
          />
        </Field>
      </form>
    </Modal>
  );
}
