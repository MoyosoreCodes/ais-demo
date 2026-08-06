/**
 * The prototype's single persistence boundary (CLAUDE.md §2).
 *
 * Everything the app knows lives in one `AisDatabase` object. It is seeded
 * from `/src/data/*.json`, kept in a React reducer, and mirrored into
 * localStorage. `buildSeedDatabase()` is pure, so "Reset Demo Data" restores
 * exactly the scripted state (CLAUDE.md §10).
 *
 * No other module touches localStorage.
 */

import auditSeed from '../data/audit.json'
import clientsSeed from '../data/clients.json'
import documentsSeed from '../data/documents.json'
import enforcementSeed from '../data/enforcement_actions.json'
import farmsSeed from '../data/farms.json'
import feedbackSeed from '../data/feedback.json'
import inspectionsSeed from '../data/inspections.json'
import intakeFieldsSeed from '../data/intake_fields.json'
import landApplicationsSeed from '../data/land_applications.json'
import leasesSeed from '../data/leases.json'
import livestockSeed from '../data/livestock_visits.json'
import loansSeed from '../data/loans.json'
import migrationSeed from '../data/migration_batches.json'
import notificationTemplatesSeed from '../data/notification_templates.json'
import notificationsSeed from '../data/notifications.json'
import samplesSeed from '../data/samples.json'
import securityPolicySeed from '../data/security_policy.json'
import stallsSeed from '../data/stalls.json'
import surveillanceSeed from '../data/surveillance_cases.json'
import usersSeed from '../data/users.json'
import vendorsSeed from '../data/vendors.json'
import workflowsSeed from '../data/workflows.json'

import { sha256Hex } from './hash'
import type { IntakeFieldConfig } from './intake'
import type {
  AisDatabase,
  AppNotification,
  AuditEntry,
  ChangeEvent,
  Client,
  DigitizedDocument,
  EnforcementAction,
  Farm,
  FeedbackMessage,
  Inspection,
  LandApplication,
  Lease,
  LivestockVisit,
  Loan,
  MigrationBatch,
  NotificationTemplate,
  QueuedSubmission,
  Role,
  Sample,
  SecurityPolicy,
  Stall,
  SurveillanceCase,
  User,
  Vendor,
  WorkflowDef,
} from './types'

export const STORAGE_KEY = 'ais-demo:db:v1'
export const SCHEMA_VERSION = 1

/**
 * Seed JSON is typed as plain strings by `resolveJsonModule`; the generator
 * guarantees the union values, so a single explicit cast per collection keeps
 * the rest of the codebase strictly typed without reaching for `any`.
 */
const seeded = <T>(json: unknown): T[] => structuredClone(json) as T[]

export function buildSeedDatabase(): AisDatabase {
  return {
    schemaVersion: SCHEMA_VERSION,
    seededOn: new Date().toISOString(),
    users: seeded<User>(usersSeed),
    clients: seeded<Client>(clientsSeed),
    farms: seeded<Farm>(farmsSeed),
    landApplications: seeded<LandApplication>(landApplicationsSeed),
    leases: seeded<Lease>(leasesSeed),
    enforcementActions: seeded<EnforcementAction>(enforcementSeed),
    loans: seeded<Loan>(loansSeed),
    samples: seeded<Sample>(samplesSeed),
    livestockVisits: seeded<LivestockVisit>(livestockSeed),
    surveillanceCases: seeded<SurveillanceCase>(surveillanceSeed),
    vendors: seeded<Vendor>(vendorsSeed),
    stalls: seeded<Stall>(stallsSeed),
    inspections: seeded<Inspection>(inspectionsSeed),
    workflows: seeded<WorkflowDef>(workflowsSeed),
    notifications: seeded<AppNotification>(notificationsSeed),
    notificationTemplates: seeded<NotificationTemplate>(notificationTemplatesSeed),
    feedback: seeded<FeedbackMessage>(feedbackSeed),
    documents: seeded<DigitizedDocument>(documentsSeed),
    migrationBatches: seeded<MigrationBatch>(migrationSeed),
    audit: seeded<AuditEntry>(auditSeed),
    outbox: [],
    securityPolicy: structuredClone(securityPolicySeed) as SecurityPolicy,
    intakeFields: seeded<IntakeFieldConfig>(intakeFieldsSeed),
  }
}

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */

export function loadDatabase(): AisDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return buildSeedDatabase()
    const parsed = JSON.parse(raw) as Partial<AisDatabase>
    if (parsed.schemaVersion !== SCHEMA_VERSION) return buildSeedDatabase()
    // Merge over a fresh seed so a collection added in a later wave is present
    // even if the browser holds a database written before it existed.
    return { ...buildSeedDatabase(), ...parsed } as AisDatabase
  } catch {
    return buildSeedDatabase()
  }
}

export function persistDatabase(db: AisDatabase): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch (err) {
    // Quota exhaustion must not break the demo; the in-memory state stands.
    console.warn('AIS demo: could not persist to localStorage', err)
  }
}

export function clearPersisted(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ *
 * Append-only, hash-chained audit log (i.7, v.5, xi.4)
 * ------------------------------------------------------------------ */

const ZERO_HASH = '0'.repeat(64)

const auditPayload = (e: Omit<AuditEntry, 'hash' | 'id'>): string =>
  `${e.seq}|${e.at}|${e.actorUserId}|${e.actorRole}|${e.action}|${e.entityType}|${e.entityId}|${e.detail}|${e.prevHash}`

export interface AuditDraft {
  actorUserId: string
  actorName: string
  actorRole: Role
  action: string
  entityType: string
  entityId: string
  detail: string
  at?: string
}

/** Returns a new array; entries are never mutated or removed. */
export function appendAudit(entries: AuditEntry[], draft: AuditDraft): AuditEntry[] {
  const prev = entries[entries.length - 1]
  const seq = (prev?.seq ?? 0) + 1
  const body = {
    seq,
    at: draft.at ?? new Date().toISOString(),
    actorUserId: draft.actorUserId,
    actorName: draft.actorName,
    actorRole: draft.actorRole,
    action: draft.action,
    entityType: draft.entityType,
    entityId: draft.entityId,
    detail: draft.detail,
    prevHash: prev?.hash ?? ZERO_HASH,
  }
  return [...entries, { id: `AUD-${String(seq).padStart(5, '0')}`, ...body, hash: sha256Hex(auditPayload(body)) }]
}

export interface ChainVerification {
  ok: boolean
  checked: number
  /** Sequence number of the first entry that fails verification. */
  brokenAtSeq?: number
  reason?: string
}

/** Recomputes the whole chain — this is what makes the log tamper-evident. */
export function verifyAuditChain(entries: AuditEntry[]): ChainVerification {
  let prevHash = ZERO_HASH
  for (const e of entries) {
    if (e.prevHash !== prevHash) {
      return { ok: false, checked: entries.length, brokenAtSeq: e.seq, reason: 'previous-hash mismatch' }
    }
    if (e.hash !== sha256Hex(auditPayload(e))) {
      return { ok: false, checked: entries.length, brokenAtSeq: e.seq, reason: 'entry content altered' }
    }
    prevHash = e.hash
  }
  return { ok: true, checked: entries.length }
}

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

export type Action =
  | { type: 'db/reset' }
  | { type: 'db/replace'; db: AisDatabase }
  | { type: 'client/create'; client: Client; audit?: AuditDraft }
  | { type: 'client/update'; id: string; patch: Partial<Client>; change?: ChangeEvent; audit?: AuditDraft }
  | { type: 'client/merge'; primaryId: string; duplicateId: string; change: ChangeEvent; audit?: AuditDraft }
  | { type: 'farm/create'; farm: Farm; audit?: AuditDraft }
  | { type: 'farm/update'; id: string; patch: Partial<Farm>; change?: ChangeEvent; audit?: AuditDraft }
  | { type: 'user/create'; user: User; audit?: AuditDraft }
  | { type: 'user/update'; id: string; patch: Partial<User>; audit?: AuditDraft }
  | { type: 'loan/create'; loan: Loan; audit?: AuditDraft }
  | { type: 'loan/update'; id: string; patch: Partial<Loan>; change?: ChangeEvent; audit?: AuditDraft }
  | { type: 'sample/create'; sample: Sample; audit?: AuditDraft }
  | { type: 'sample/update'; id: string; patch: Partial<Sample>; change?: ChangeEvent; audit?: AuditDraft }
  | { type: 'visit/create'; visit: LivestockVisit; audit?: AuditDraft }
  | { type: 'visit/update'; id: string; patch: Partial<LivestockVisit>; change?: ChangeEvent; audit?: AuditDraft }
  | { type: 'case/create'; surveillanceCase: SurveillanceCase; audit?: AuditDraft }
  | { type: 'case/update'; id: string; patch: Partial<SurveillanceCase>; change?: ChangeEvent; audit?: AuditDraft }
  | { type: 'vendor/create'; vendor: Vendor; audit?: AuditDraft }
  | { type: 'vendor/update'; id: string; patch: Partial<Vendor>; change?: ChangeEvent; audit?: AuditDraft }
  | { type: 'stall/update'; id: string; patch: Partial<Stall>; audit?: AuditDraft }
  | { type: 'inspection/create'; inspection: Inspection; audit?: AuditDraft }
  | { type: 'inspection/update'; id: string; patch: Partial<Inspection>; change?: ChangeEvent; audit?: AuditDraft }
  | { type: 'land/create'; application: LandApplication; audit?: AuditDraft }
  | { type: 'land/update'; id: string; patch: Partial<LandApplication>; change?: ChangeEvent; audit?: AuditDraft }
  | { type: 'lease/create'; lease: Lease; audit?: AuditDraft }
  | { type: 'lease/update'; id: string; patch: Partial<Lease>; change?: ChangeEvent; audit?: AuditDraft }
  | { type: 'enforcement/create'; action: EnforcementAction; audit?: AuditDraft }
  | { type: 'enforcement/update'; id: string; patch: Partial<EnforcementAction>; change?: ChangeEvent; audit?: AuditDraft }
  | { type: 'workflow/update'; id: string; patch: Partial<WorkflowDef>; audit?: AuditDraft }
  | { type: 'document/create'; document: DigitizedDocument; audit?: AuditDraft }
  | { type: 'notification/add'; notification: AppNotification; audit?: AuditDraft }
  | { type: 'notification/read'; id: string }
  | { type: 'notification/readAll'; forClientId?: string }
  | { type: 'template/update'; id: string; patch: Partial<NotificationTemplate>; audit?: AuditDraft }
  | { type: 'feedback/add'; message: FeedbackMessage; audit?: AuditDraft }
  | { type: 'feedback/update'; id: string; patch: Partial<FeedbackMessage> }
  | { type: 'outbox/queue'; submission: QueuedSubmission }
  | { type: 'outbox/flush'; syncedOn: string; audit?: AuditDraft }
  | { type: 'policy/update'; patch: Partial<SecurityPolicy>; audit?: AuditDraft }
  | { type: 'intake/update'; id: string; patch: Partial<IntakeFieldConfig>; audit?: AuditDraft }
  | { type: 'audit/append'; draft: AuditDraft }

/* ------------------------------------------------------------------ *
 * Reducer
 * ------------------------------------------------------------------ */

const upsertPatch = <T extends { id: string; history?: ChangeEvent[] }>(
  list: T[],
  id: string,
  patch: Partial<T>,
  change?: ChangeEvent,
): T[] =>
  list.map((item) =>
    item.id === id
      ? {
          ...item,
          ...patch,
          ...(change ? { history: [...(item.history ?? []), change] } : {}),
        }
      : item,
  )

export function reducer(db: AisDatabase, action: Action): AisDatabase {
  const next = applyAction(db, action)
  if (next === db) return db
  const draft = 'audit' in action ? action.audit : undefined
  return draft ? { ...next, audit: appendAudit(next.audit, draft) } : next
}

function applyAction(db: AisDatabase, action: Action): AisDatabase {
  switch (action.type) {
    case 'db/reset':
      return buildSeedDatabase()

    case 'db/replace':
      return action.db

    /* --- clients --- */
    case 'client/create':
      return { ...db, clients: [action.client, ...db.clients] }

    case 'client/update':
      return { ...db, clients: upsertPatch(db.clients, action.id, action.patch, action.change) }

    case 'client/merge': {
      // The duplicate is retired, not deleted — its id keeps resolving (ii.7).
      const clients = db.clients.map((c) => {
        if (c.id === action.duplicateId) {
          return { ...c, status: 'merged' as const, mergedIntoId: action.primaryId }
        }
        if (c.id === action.primaryId) {
          return { ...c, history: [...c.history, action.change] }
        }
        return c
      })
      const reassign = <T extends { clientId: string }>(list: T[]): T[] =>
        list.map((r) => (r.clientId === action.duplicateId ? { ...r, clientId: action.primaryId } : r))
      return {
        ...db,
        clients,
        farms: reassign(db.farms),
        loans: reassign(db.loans),
        samples: reassign(db.samples),
        livestockVisits: reassign(db.livestockVisits),
        surveillanceCases: reassign(db.surveillanceCases),
        inspections: reassign(db.inspections),
        leases: reassign(db.leases),
        landApplications: reassign(db.landApplications),
        vendors: db.vendors.map((v) =>
          v.clientId === action.duplicateId ? { ...v, clientId: action.primaryId } : v,
        ),
        documents: db.documents.map((d) =>
          d.clientId === action.duplicateId ? { ...d, clientId: action.primaryId } : d,
        ),
      }
    }

    /* --- farms --- */
    case 'farm/create':
      return { ...db, farms: [action.farm, ...db.farms] }

    case 'farm/update':
      return { ...db, farms: upsertPatch(db.farms, action.id, action.patch, action.change) }

    /* --- users --- */
    case 'user/create':
      return { ...db, users: [...db.users, action.user] }

    case 'user/update':
      return { ...db, users: db.users.map((u) => (u.id === action.id ? { ...u, ...action.patch } : u)) }

    /* --- loans --- */
    case 'loan/create':
      return { ...db, loans: [action.loan, ...db.loans] }

    case 'loan/update':
      return { ...db, loans: upsertPatch(db.loans, action.id, action.patch, action.change) }

    /* --- laboratory --- */
    case 'sample/create':
      return { ...db, samples: [action.sample, ...db.samples] }

    case 'sample/update':
      return { ...db, samples: upsertPatch(db.samples, action.id, action.patch, action.change) }

    /* --- livestock --- */
    case 'visit/create':
      return { ...db, livestockVisits: [action.visit, ...db.livestockVisits] }

    case 'visit/update':
      return { ...db, livestockVisits: upsertPatch(db.livestockVisits, action.id, action.patch, action.change) }

    /* --- surveillance --- */
    case 'case/create':
      return { ...db, surveillanceCases: [action.surveillanceCase, ...db.surveillanceCases] }

    case 'case/update':
      return { ...db, surveillanceCases: upsertPatch(db.surveillanceCases, action.id, action.patch, action.change) }

    /* --- vendors & stalls --- */
    case 'vendor/create':
      return { ...db, vendors: [action.vendor, ...db.vendors] }

    case 'vendor/update':
      return { ...db, vendors: upsertPatch(db.vendors, action.id, action.patch, action.change) }

    case 'stall/update':
      return { ...db, stalls: db.stalls.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)) }

    /* --- field operations --- */
    case 'inspection/create':
      return { ...db, inspections: [action.inspection, ...db.inspections] }

    case 'inspection/update':
      return { ...db, inspections: upsertPatch(db.inspections, action.id, action.patch, action.change) }

    /* --- land --- */
    case 'land/create':
      return { ...db, landApplications: [action.application, ...db.landApplications] }

    case 'land/update':
      return { ...db, landApplications: upsertPatch(db.landApplications, action.id, action.patch, action.change) }

    case 'lease/create':
      return { ...db, leases: [action.lease, ...db.leases] }

    case 'lease/update':
      return { ...db, leases: upsertPatch(db.leases, action.id, action.patch, action.change) }

    case 'enforcement/create':
      return { ...db, enforcementActions: [action.action, ...db.enforcementActions] }

    case 'enforcement/update':
      return { ...db, enforcementActions: upsertPatch(db.enforcementActions, action.id, action.patch, action.change) }

    /* --- workflow definitions --- */
    case 'workflow/update':
      return { ...db, workflows: db.workflows.map((w) => (w.id === action.id ? { ...w, ...action.patch } : w)) }

    /* --- documents --- */
    case 'document/create':
      return { ...db, documents: [action.document, ...db.documents] }

    /* --- notifications --- */
    case 'notification/add':
      return { ...db, notifications: [action.notification, ...db.notifications] }

    case 'notification/read':
      return {
        ...db,
        notifications: db.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)),
      }

    case 'notification/readAll':
      return {
        ...db,
        notifications: db.notifications.map((n) =>
          action.forClientId === undefined || n.recipientClientId === action.forClientId
            ? { ...n, read: true }
            : n,
        ),
      }

    /* --- notification templates (xiii.1) --- */
    case 'template/update':
      return {
        ...db,
        notificationTemplates: db.notificationTemplates.map((t) =>
          t.id === action.id ? { ...t, ...action.patch } : t,
        ),
      }

    /* --- feedback --- */
    case 'feedback/add':
      return { ...db, feedback: [action.message, ...db.feedback] }

    case 'feedback/update':
      return { ...db, feedback: db.feedback.map((f) => (f.id === action.id ? { ...f, ...action.patch } : f)) }

    /* --- offline outbox (x.3) --- */
    case 'outbox/queue':
      return { ...db, outbox: [...db.outbox, action.submission] }

    case 'outbox/flush': {
      if (!db.outbox.length) return db
      const synced = db.outbox.map((q) => ({
        ...q.payload,
        status: 'completed' as const,
        capturedOffline: true,
        syncedOn: action.syncedOn,
      }))
      // A queued capture usually belongs to an inspection that was already
      // scheduled, so replace by id and only prepend the genuinely new ones —
      // otherwise syncing would leave two records with the same reference.
      const syncedById = new Map(synced.map((i) => [i.id, i]))
      const merged = db.inspections.map((i) => syncedById.get(i.id) ?? i)
      const fresh = synced.filter((i) => !db.inspections.some((existing) => existing.id === i.id))
      return { ...db, inspections: [...fresh, ...merged], outbox: [] }
    }

    /* --- security policy --- */
    case 'policy/update':
      return { ...db, securityPolicy: { ...db.securityPolicy, ...action.patch } }

    /* --- configurable farm intake fields (iii.3) --- */
    case 'intake/update':
      return {
        ...db,
        intakeFields: db.intakeFields.map((f) => (f.id === action.id ? { ...f, ...action.patch } : f)),
      }

    /* --- bare audit append --- */
    case 'audit/append':
      return { ...db, audit: appendAudit(db.audit, action.draft) }

    default:
      return db
  }
}
