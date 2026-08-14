import type { IntakeFieldConfig } from './intake'

/**
 * Domain model for the AIS Phase 1 demonstration prototype.
 *
 * Every entity below maps to one or more Appendix A6 requirement rows
 * (see CLAUDE.md §8 and TRACEABILITY.md). Identifiers are the demo's
 * linking currency: Client ID ties farms, loans, lab samples, livestock
 * services, surveillance cases, leases, inspections and documents to a
 * single farmer record (ii.5, iii.6, vi.6, vii.4, viii.4).
 */

/* ------------------------------------------------------------------ *
 * Reference values
 * ------------------------------------------------------------------ */

export const ROLES = [
  'admin',
  'agriculture_officer',
  'field_officer',
  'lab_staff',
  'supervisor',
  'farmer',
] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  agriculture_officer: 'Agriculture Officer',
  field_officer: 'Field Officer',
  lab_staff: 'Laboratory Staff',
  supervisor: 'Supervisor',
  farmer: 'Farmer',
}

export const ISLANDS = ['Mahé', 'Praslin', 'La Digue'] as const
export type Island = (typeof ISLANDS)[number]

export const DISTRICTS = [
  'Anse Boileau',
  'Baie Lazare',
  'Grand Anse Mahé',
  'Anse Royale',
  'Anse Aux Pins',
  'Baie Ste Anne Praslin',
  'La Digue',
] as const
export type District = (typeof DISTRICTS)[number]

export const CROPS = [
  'banana',
  'cassava',
  'sweet potato',
  'chilli',
  'lettuce',
  'papaya',
  'breadfruit',
] as const
export type Crop = (typeof CROPS)[number]

export const LIVESTOCK_TYPES = ['broiler', 'layer', 'pig', 'goat'] as const
export type LivestockType = (typeof LIVESTOCK_TYPES)[number]

export const SAMPLE_TYPES = ['soil', 'water', 'plant', 'compost', 'avian_tissue'] as const
export type SampleType = (typeof SAMPLE_TYPES)[number]

/* ------------------------------------------------------------------ *
 * Shared value objects
 * ------------------------------------------------------------------ */

/** One entry of an entity's change history (ii.4, iv.8, x.5). */
export interface ChangeEvent {
  id: string
  at: string
  actorUserId: string
  actorName: string
  action: string
  field?: string
  from?: string
  to?: string
  note?: string
}

/**
 * A simulated document attachment. `simulated: true` is rendered in the UI —
 * no real file is stored, per the honesty constraint in CLAUDE.md §2.
 */
export interface DocRef {
  id: string
  name: string
  category: string
  sizeKb: number
  uploadedOn: string
  uploadedBy: string
  verification: 'pending' | 'verified' | 'rejected'
  verifiedBy?: string
  verifiedOn?: string
  simulated: true
}

/** A simulated inspection photo (x.4). Rendered as a generated placeholder. */
export interface PhotoRef {
  id: string
  caption: string
  takenOn: string
  /** Deterministic seed for the generated placeholder image. */
  swatch: string
  simulated: true
}

/* ------------------------------------------------------------------ *
 * Module i — users, authentication, audit
 * ------------------------------------------------------------------ */

export interface User {
  id: string
  email: string
  fullName: string
  role: Role
  /** Present only for role === 'farmer'; ties the login to a client record. */
  clientId?: string
  status: 'active' | 'suspended' | 'deactivated'
  createdOn: string
  lastLoginOn?: string
  phone: string
  /** PBKDF2-SHA256 salt, hex. Passwords are never stored in clear (i.1). */
  salt: string
  /** PBKDF2-SHA256 derived key, hex. */
  passwordHash: string
  /** Iteration count used to derive `passwordHash`. */
  iterations: number
  /** Two-factor state (i.8). Channel is simulated in this prototype. */
  twoFactor: { enabled: boolean; channel: 'sms' | 'email' | 'totp'; simulated: true }
  /** True when the account was matched against SeyID (simulated). */
  seyIdLinked: boolean
  failedLoginCount: number
  lockedUntil?: string
  mustResetPassword: boolean
}

/** Append-only, hash-chained audit entry (i.7, v.5, xi.4). */
export interface AuditEntry {
  id: string
  seq: number
  at: string
  actorUserId: string
  actorName: string
  actorRole: Role
  action: string
  entityType: string
  entityId: string
  detail: string
  /** Hash of the previous entry — makes retro-editing detectable. */
  prevHash: string
  /** Hash over this entry's payload + prevHash. */
  hash: string
}

/* ------------------------------------------------------------------ *
 * Module ii — client management
 * ------------------------------------------------------------------ */

export interface Client {
  id: string
  /** Fictional NIN — always the obviously fake `999-` prefix (CLAUDE.md §2). */
  nin: string
  firstName: string
  lastName: string
  gender: 'F' | 'M'
  dateOfBirth: string
  phone: string
  email: string
  district: District
  island: Island
  address: string
  stakeholderType: 'farmer' | 'vendor' | 'cooperative'
  status: 'active' | 'inactive' | 'merged'
  registeredOn: string
  registeredVia: 'self-service' | 'officer-assisted' | 'migrated'
  /** True once SeyID (simulated) returned a match on the NIN (ii.3, i.8). */
  seyIdVerified: boolean
  /** Set when this record was merged away by duplicate resolution (ii.7). */
  mergedIntoId?: string
  notes?: string
  history: ChangeEvent[]
}

/* ------------------------------------------------------------------ *
 * Module iii — farm registration
 * ------------------------------------------------------------------ */

export interface FarmLivestock {
  type: LivestockType
  headcount: number
}

export interface Farm {
  id: string
  clientId: string
  name: string
  district: District
  island: Island
  lat: number
  lng: number
  parcelRef: string
  sizeHa: number
  tenure: 'owned' | 'leased-state' | 'leased-private' | 'family'
  crops: Crop[]
  livestock: FarmLivestock[]
  waterSource: 'rainwater' | 'borehole' | 'river' | 'mains' | 'none'
  status: 'pending' | 'registered' | 'rejected'
  registeredOn: string
  registeredVia: 'online' | 'back-office' | 'migrated'
  documents: DocRef[]
  history: ChangeEvent[]
}

/* ------------------------------------------------------------------ *
 * Module iv — land management
 * ------------------------------------------------------------------ */

export interface LandApplication {
  id: string
  clientId: string
  parcelRef: string
  district: District
  island: Island
  lat: number
  lng: number
  requestedAreaHa: number
  purpose: string
  status: WorkflowStatus
  submittedOn: string
  workflowId: string
  currentStageId: string | null
  stageInstances: StageInstance[]
  assessments: LandAssessment[]
  documents: DocRef[]
  history: ChangeEvent[]
}

export interface LandAssessment {
  id: string
  assessedOn: string
  assessorUserId: string
  soilSuitability: 'high' | 'moderate' | 'low'
  slope: 'flat' | 'gentle' | 'steep'
  waterAccess: boolean
  accessRoad: boolean
  recommendation: 'approve' | 'approve-with-conditions' | 'reject'
  notes: string
}

export interface Lease {
  id: string
  clientId: string
  farmId?: string
  parcelRef: string
  district: District
  areaHa: number
  startDate: string
  endDate: string
  annualRentScr: number
  status: 'pending' | 'active' | 'expired' | 'terminated'
  paymentStatus: 'current' | 'due' | 'overdue'
  lastPaymentOn?: string
  nextPaymentDue: string
  documents: DocRef[]
  history: ChangeEvent[]
}

export interface EnforcementAction {
  id: string
  leaseId: string
  clientId: string
  type: 'warning' | 'retraction-notice' | 'eviction-notice' | 'resolved'
  raisedOn: string
  raisedByUserId: string
  reason: string
  status: 'open' | 'under-review' | 'upheld' | 'withdrawn' | 'enforced'
  noticeServedOn?: string
  history: ChangeEvent[]
}

/* ------------------------------------------------------------------ *
 * Module v — loans
 * ------------------------------------------------------------------ */

export type WorkflowStatus =
  | 'draft'
  | 'submitted'
  | 'under-review'
  | 'approved'
  | 'rejected'
  | 'withdrawn'

export type LoanStatus = WorkflowStatus | 'disbursed' | 'repaying' | 'closed'

/** One stage of a running workflow instance (xi.1, xi.2, v.3). */
export interface StageInstance {
  stageId: string
  name: string
  actorRole: Role
  status: 'pending' | 'in-progress' | 'approved' | 'rejected' | 'skipped'
  decidedByUserId?: string
  decidedOn?: string
  comment?: string
}

export interface Loan {
  id: string
  clientId: string
  farmId: string
  purpose: string
  amountScr: number
  termMonths: number
  interestRatePct: number
  status: LoanStatus
  submittedOn: string
  workflowId: string
  currentStageId: string | null
  stageInstances: StageInstance[]
  documents: DocRef[]
  /** Per-application append-only trail (v.5). */
  history: ChangeEvent[]
  disbursedOn?: string
  balanceScr?: number
}

/* ------------------------------------------------------------------ *
 * Module vi — sampling & laboratory
 * ------------------------------------------------------------------ */

export type SampleStatus =
  | 'requested'
  | 'collected'
  | 'registered'
  | 'testing'
  | 'completed'
  | 'cancelled'

export interface LabResult {
  parameter: string
  value: number | string
  unit: string
  method: string
  referenceRange: string
  flag: 'normal' | 'low' | 'high'
}

export interface Sample {
  id: string
  type: SampleType
  clientId: string
  farmId: string
  requestedOn: string
  requestedVia: 'online' | 'back-office'
  requestedByUserId: string
  status: SampleStatus
  collectedOn?: string
  registeredOn?: string
  testingStartedOn?: string
  completedOn?: string
  labTechUserId?: string
  purpose: string
  results: LabResult[]
  interpretation?: string
  recommendation?: string
  /** Set when the "notify applicant" action fired (vi.8). */
  notifiedOn?: string
  history: ChangeEvent[]
}

/* ------------------------------------------------------------------ *
 * Module vii — livestock services
 * ------------------------------------------------------------------ */

export interface LivestockVisit {
  id: string
  type: 'routine' | 'complaint'
  clientId: string
  farmId: string
  species: LivestockType
  scheduledOn: string
  visitedOn?: string
  officerUserId: string
  status: 'registered' | 'assigned' | 'in-progress' | 'resolved' | 'closed'
  complaintSummary?: string
  observations: string
  findings: string
  actionTaken: string
  followUpOn?: string
  history: ChangeEvent[]
}

/* ------------------------------------------------------------------ *
 * Module viii — passive surveillance
 * ------------------------------------------------------------------ */

export interface SurveillanceCase {
  id: string
  clientId: string
  farmId: string
  suspectedDisease: string
  species: LivestockType
  reportedOn: string
  reportedBy: string
  reportedVia: 'farmer-portal' | 'officer' | 'hotline'
  assignedOfficerUserId?: string
  status:
    | 'reported'
    | 'assigned'
    | 'investigating'
    | 'sampled'
    | 'confirmed'
    | 'negative'
    | 'closed'
  /** Cross-module link to the laboratory result (viii.4). */
  linkedSampleId?: string
  affectedCount: number
  mortalityCount: number
  notes: string
  history: ChangeEvent[]
}

/* ------------------------------------------------------------------ *
 * Module ix — vendors & market
 * ------------------------------------------------------------------ */

export interface Vendor {
  id: string
  /** Present when the vendor is also a registered farmer (ii.5). */
  clientId?: string
  fullName: string
  tradeName: string
  category: 'produce' | 'fish' | 'value-added' | 'crafts'
  phone: string
  email: string
  market: string
  licenceNo: string
  stallId?: string
  registrationStatus: 'pending' | 'active' | 'suspended' | 'expired'
  registeredOn: string
  expiresOn: string
  history: ChangeEvent[]
}

export interface Stall {
  id: string
  market: string
  section: string
  row: string
  number: number
  status: 'vacant' | 'allocated' | 'reserved' | 'maintenance'
  vendorId?: string
  allocatedOn?: string
  monthlyFeeScr: number
}

/* ------------------------------------------------------------------ *
 * Module x — field operations & inspections
 * ------------------------------------------------------------------ */

export interface Inspection {
  id: string
  clientId: string
  farmId: string
  type: 'farm-compliance' | 'land-lease' | 'loan-verification' | 'biosecurity'
  scheduledOn: string
  officerUserId: string
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  completedOn?: string
  observations: string
  findings: string
  outcome: 'compliant' | 'minor-issues' | 'non-compliant' | 'not-assessed'
  photos: PhotoRef[]
  /** True when captured on a device with no connectivity (x.3, simulated). */
  capturedOffline: boolean
  syncedOn?: string
  history: ChangeEvent[]
}

/** A submission held in the device queue while offline (x.3, simulated). */
export interface QueuedSubmission {
  id: string
  queuedAt: string
  kind: 'inspection'
  label: string
  payload: Inspection
}

/* ------------------------------------------------------------------ *
 * Module xi — workflow definitions
 * ------------------------------------------------------------------ */

export interface WorkflowStage {
  id: string
  name: string
  actorRole: Role
  slaDays: number
  description: string
}

/** Admin-editable approval hierarchy — no redeploy required (xi.6). */
export interface WorkflowDef {
  id: string
  name: string
  entity: 'loan' | 'land'
  stages: WorkflowStage[]
  updatedOn: string
  updatedByUserId: string
}

/* ------------------------------------------------------------------ *
 * Module xiii — notifications
 * ------------------------------------------------------------------ */

export type NotificationChannel = 'email' | 'sms' | 'in-app'

export interface NotificationTemplate {
  id: string
  name: string
  channel: NotificationChannel
  event: string
  subject: string
  /** Body with `{{placeholder}}` tokens. */
  body: string
}

export interface AppNotification {
  id: string
  channel: NotificationChannel
  templateId: string
  event: string
  recipientClientId?: string
  recipientUserId?: string
  recipientAddress: string
  subject: string
  body: string
  sentOn: string
  read: boolean
  relatedType?: string
  relatedId?: string
  /** Email and SMS delivery is simulated; the UI labels it as such. */
  simulated: boolean
}

export interface FeedbackMessage {
  id: string
  fromClientId?: string
  fromUserId?: string
  fromName: string
  subject: string
  body: string
  category: 'question' | 'complaint' | 'suggestion' | 'support'
  sentOn: string
  status: 'new' | 'acknowledged' | 'resolved'
  response?: string
  respondedOn?: string
}

/* ------------------------------------------------------------------ *
 * Module xiv — digitized documents & migration
 * ------------------------------------------------------------------ */

export interface DigitizedDocument {
  id: string
  title: string
  category:
    | 'lease'
    | 'permit'
    | 'loan-file'
    | 'lab-report'
    | 'land-record'
    | 'registration-form'
    | 'correspondence'
  clientId?: string
  farmId?: string
  originalDate: string
  scannedOn: string
  scannedByUserId: string
  pages: number
  tags: string[]
  /** Indexed text backing the full-text search (xiv.4). */
  ocrText: string
  migrationBatch: string
  validation: 'pass' | 'warn' | 'fail'
  validationNote?: string
  /** Deterministic seed for the generated placeholder scan image. */
  swatch: string
  simulated: true
}

export interface MigrationBatch {
  id: string
  name: string
  source: string
  runOn: string
  recordsRead: number
  recordsMigrated: number
  recordsRejected: number
  checks: MigrationCheck[]
}

export interface MigrationCheck {
  id: string
  name: string
  description: string
  expected: number
  actual: number
  result: 'pass' | 'warn' | 'fail'
  note?: string
}

/* ------------------------------------------------------------------ *
 * Aggregate database
 * ------------------------------------------------------------------ */

export interface AisDatabase {
  schemaVersion: number
  seededOn: string
  users: User[]
  clients: Client[]
  farms: Farm[]
  landApplications: LandApplication[]
  leases: Lease[]
  enforcementActions: EnforcementAction[]
  loans: Loan[]
  samples: Sample[]
  livestockVisits: LivestockVisit[]
  surveillanceCases: SurveillanceCase[]
  vendors: Vendor[]
  stalls: Stall[]
  inspections: Inspection[]
  workflows: WorkflowDef[]
  notifications: AppNotification[]
  notificationTemplates: NotificationTemplate[]
  feedback: FeedbackMessage[]
  documents: DigitizedDocument[]
  migrationBatches: MigrationBatch[]
  audit: AuditEntry[]
  /** Device-side offline queue (x.3) — not part of the seed. */
  outbox: QueuedSubmission[]
  /** Admin-configurable security policy (i.1). */
  securityPolicy: SecurityPolicy
  /** Admin-configurable farm-registration intake fields (iii.3). */
  intakeFields: IntakeFieldConfig[]
}

export interface SecurityPolicy {
  minPasswordLength: number
  requireUppercase: boolean
  requireNumber: boolean
  requireSymbol: boolean
  maxFailedLogins: number
  lockoutMinutes: number
  sessionTimeoutMinutes: number
  require2fa: boolean
}
