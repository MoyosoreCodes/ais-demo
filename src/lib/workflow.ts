// Metadata-driven workflow engine (loan/land). Stage definitions live in the DB
// (db.workflows) and are editable from S11 without a code change (req xi.6).
import { nowIso } from './format';
import type {
  Database,
  Loan,
  LoanStatus,
  WorkflowDef,
  WorkflowEvent,
  WorkflowStage,
} from './types';

export const getWorkflow = (db: Database, id: string): WorkflowDef | undefined =>
  db.workflows.find((w) => w.id === id);

export const orderedStages = (def: WorkflowDef): WorkflowStage[] =>
  [...def.stages].sort((a, b) => a.order - b.order);

export const currentStage = (def: WorkflowDef, loan: Loan): WorkflowStage | undefined =>
  def.stages.find((s) => s.id === loan.currentStageId);

export type LoanAction = 'advance' | 'reject' | 'disburse';

export interface LoanTransition {
  status: LoanStatus;
  currentStageId: string;
  event: WorkflowEvent;
}

// The pipeline is derived from the configured stages, so adding/removing a stage
// on S11 changes the approval path immediately.
export function advanceLoan(
  def: WorkflowDef,
  loan: Loan,
  action: LoanAction,
  by: string,
  note?: string,
): LoanTransition {
  const at = nowIso();
  if (action === 'reject') {
    return {
      status: 'rejected',
      currentStageId: 'done',
      event: { at, by, action: 'Rejected', fromStatus: loan.status, toStatus: 'rejected', note },
    };
  }
  if (action === 'disburse') {
    return {
      status: 'disbursed',
      currentStageId: 'done',
      event: { at, by, action: 'Disbursed', fromStatus: loan.status, toStatus: 'disbursed', note },
    };
  }
  const pipe = ['submitted', ...orderedStages(def).map((s) => s.id), 'approved'];
  const idx = pipe.indexOf(loan.status);
  const nextStatus = (idx < 0 ? pipe[1] : pipe[Math.min(idx + 1, pipe.length - 1)]) as LoanStatus;
  const currentStageId = def.stages.some((s) => s.id === nextStatus) ? nextStatus : 'done';
  const stageName =
    def.stages.find((s) => s.id === nextStatus)?.name ??
    (nextStatus === 'approved' ? 'Approved' : nextStatus);
  return {
    status: nextStatus,
    currentStageId,
    event: {
      at,
      by,
      action: `Advanced to ${stageName}`,
      fromStatus: loan.status,
      toStatus: nextStatus,
      note,
    },
  };
}
