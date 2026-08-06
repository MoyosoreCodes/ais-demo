/**
 * Metadata-driven workflow engine (xi.1, xi.2, xi.6).
 *
 * Stages are read from `WorkflowDef` records held in the store, not from code.
 * Editing a definition on S11 therefore changes how the next application is
 * routed without a redeploy — that is the ★ claim behind xi.6.
 */

import type { StageInstance, WorkflowDef, WorkflowStatus } from './types'

/** Materialise a fresh set of stage instances from a definition. */
export const instantiate = (wf: WorkflowDef): StageInstance[] =>
  wf.stages.map((s, i) => ({
    stageId: s.id,
    name: s.name,
    actorRole: s.actorRole,
    status: i === 0 ? 'in-progress' : 'pending',
  }))

export const currentStage = (stages: StageInstance[]): StageInstance | undefined =>
  stages.find((s) => s.status === 'in-progress') ?? stages.find((s) => s.status === 'pending')

export const stageIndex = (stages: StageInstance[], stageId: string): number =>
  stages.findIndex((s) => s.stageId === stageId)

export interface Decision {
  stageId: string
  outcome: 'approved' | 'rejected'
  byUserId: string
  on: string
  comment?: string
}

export interface AdvanceResult {
  stages: StageInstance[]
  status: WorkflowStatus
  currentStageId: string | null
  /** True when this decision closed the whole workflow. */
  final: boolean
}

/**
 * Apply a decision and route onwards. A rejection at any stage is terminal;
 * an approval either promotes the next stage or completes the workflow.
 */
export function advance(stages: StageInstance[], decision: Decision): AdvanceResult {
  const idx = stageIndex(stages, decision.stageId)
  if (idx === -1) {
    return {
      stages,
      status: 'under-review',
      currentStageId: currentStage(stages)?.stageId ?? null,
      final: false,
    }
  }

  const next = stages.map((s, i) => {
    if (i === idx) {
      return {
        ...s,
        status: decision.outcome,
        decidedByUserId: decision.byUserId,
        decidedOn: decision.on,
        comment: decision.comment,
      }
    }
    if (decision.outcome === 'rejected' && i > idx && s.status === 'pending') {
      return { ...s, status: 'skipped' as const }
    }
    if (decision.outcome === 'approved' && i === idx + 1) {
      return { ...s, status: 'in-progress' as const }
    }
    return s
  })

  if (decision.outcome === 'rejected') {
    return { stages: next, status: 'rejected', currentStageId: null, final: true }
  }

  const isLast = idx === stages.length - 1
  return isLast
    ? { stages: next, status: 'approved', currentStageId: null, final: true }
    : { stages: next, status: 'under-review', currentStageId: next[idx + 1].stageId, final: false }
}

/** Progress as a 0–1 fraction, for the status tracker bars. */
export const progress = (stages: StageInstance[]): number => {
  if (!stages.length) return 0
  const done = stages.filter((s) => s.status === 'approved' || s.status === 'rejected').length
  return done / stages.length
}

export const STATUS_ORDER: WorkflowStatus[] = [
  'draft',
  'submitted',
  'under-review',
  'approved',
  'rejected',
  'withdrawn',
]

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  'under-review': 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  disbursed: 'Disbursed',
  repaying: 'Repaying',
  closed: 'Closed',
  pending: 'Pending',
  'in-progress': 'In progress',
  skipped: 'Skipped',
  active: 'Active',
  expired: 'Expired',
  terminated: 'Terminated',
  requested: 'Requested',
  collected: 'Collected',
  registered: 'Registered',
  testing: 'Testing',
  completed: 'Completed',
  cancelled: 'Cancelled',
  reported: 'Reported',
  assigned: 'Assigned',
  investigating: 'Investigating',
  sampled: 'Sampled',
  confirmed: 'Confirmed',
  negative: 'Negative',
  resolved: 'Resolved',
  scheduled: 'Scheduled',
  suspended: 'Suspended',
  vacant: 'Vacant',
  allocated: 'Allocated',
  reserved: 'Reserved',
  maintenance: 'Maintenance',
  inactive: 'Inactive',
  merged: 'Merged',
  deactivated: 'Deactivated',
}

export const statusLabel = (status: string): string =>
  STATUS_LABELS[status] ?? status.replace(/-/g, ' ')
