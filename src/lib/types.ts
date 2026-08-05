// Domain model for the AIS demonstration prototype.
// NOTE: erasableSyntaxOnly is enabled, so we use `as const` arrays + union types
// instead of TS enums throughout.

export const ROLES = [
  'admin',
  'agriculture_officer',
  'field_officer',
  'lab_staff',
  'supervisor',
  'farmer',
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  agriculture_officer: 'Agriculture Officer',
  field_officer: 'Field Officer',
  lab_staff: 'Laboratory Staff',
  supervisor: 'Supervisor',
  farmer: 'Farmer',
};

// Seychelles districts used across registries, maps and dashboards.
export const DISTRICTS = [
  'Anse Boileau',
  'Baie Lazare',
  'Grand Anse Mahé',
  'Anse Royale',
  'Anse Aux Pins',
  'Takamaka',
  'Port Glaud',
  'Baie Ste Anne Praslin',
  'Grand Anse Praslin',
  'La Digue',
] as const;
export type District = (typeof DISTRICTS)[number];

export const CROPS = [
  'Banana',
  'Cassava',
  'Sweet potato',
  'Chilli',
  'Lettuce',
  'Papaya',
  'Breadfruit',
] as const;
export const LIVESTOCK = ['Broiler', 'Layer', 'Pig', 'Goat'] as const;

export interface ChangeLog {
  at: string;
  by: string;
  field: string;
  from: string;
  to: string;
}

export interface WorkflowEvent {
  at: string;
  by: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  note?: string;
}

export interface DocRef {
  id: string;
  name: string;
  category: string;
  uploadedAt: string;
  verified: boolean;
  sizeKb: number;
  simulated: true;
}

export interface User {
  id: string;
  username: string; // email-style login
  name: string;
  role: Role;
  active: boolean;
  phone?: string;
  clientId?: string; // farmers are linked to their client record
  password: string; // demo only — real system stores a salted hash
  lastLogin?: string;
  twoFactor: boolean;
}

export type ClientStatus = 'active' | 'inactive' | 'merged';
export type ClientSource = 'self_service' | 'officer' | 'migrated';
export type StakeholderType = 'farmer' | 'vendor' | 'both';

export interface Client {
  id: string;
  nin: string; // fictional, always 999- prefix
  firstName: string;
  lastName: string;
  gender: 'F' | 'M' | 'Other';
  dob: string;
  phone: string;
  email: string;
  address: string;
  district: District;
  stakeholderType: StakeholderType;
  seyidVerified: boolean;
  status: ClientStatus;
  source: ClientSource;
  mergedInto?: string;
  createdAt: string;
  updatedAt: string;
  history: ChangeLog[];
}

export type Tenure = 'owned' | 'leased' | 'state_land' | 'family';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type FarmSource = 'online' | 'officer' | 'migrated';

export interface Farm {
  id: string; // FRM-2026-00001
  clientId: string;
  name: string;
  district: District;
  lat: number;
  lng: number;
  sizeHa: number;
  tenure: Tenure;
  crops: string[];
  livestock: string[];
  docs: DocRef[];
  verificationStatus: VerificationStatus;
  status: 'active' | 'merged';
  source: FarmSource;
  createdAt: string;
}

export const LOAN_STATUSES = [
  'draft',
  'submitted',
  'screening',
  'assessment',
  'approval',
  'approved',
  'rejected',
  'disbursed',
] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export interface Loan {
  id: string; // LN-2026-001
  clientId: string;
  farmId: string;
  purpose: string;
  amountSCR: number;
  termMonths: number;
  status: LoanStatus;
  currentStageId: string;
  docs: DocRef[];
  history: WorkflowEvent[];
  createdAt: string;
  updatedAt: string;
}

export const SAMPLE_TYPES = ['soil', 'water', 'plant', 'compost'] as const;
export type SampleType = (typeof SAMPLE_TYPES)[number];
export const SAMPLE_STATUSES = [
  'requested',
  'collected',
  'registered',
  'testing',
  'result_entered',
  'verified',
  'released',
] as const;
export type SampleStatus = (typeof SAMPLE_STATUSES)[number];

export interface SampleResult {
  name: string;
  value: string;
  unit: string;
  reference: string;
}

// A chain-of-custody / lifecycle event for a laboratory sample.
export interface ChainEvent {
  at: string;
  by: string;
  action: string;
}

export interface Sample {
  id: string; // SMP-2026-001
  barcode: string;
  clientId: string;
  farmId: string;
  type: SampleType;
  status: SampleStatus;
  requestedBy: 'farmer' | 'officer';
  assignedTo?: string;
  requestedAt: string;
  collectedAt?: string;
  completedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  releasedAt?: string;
  results: SampleResult[];
  resultSummary?: string;
  notified: boolean;
  chain: ChainEvent[];
}

export type VisitKind = 'complaint' | 'routine';
export type VisitStatus = 'reported' | 'assigned' | 'in_progress' | 'resolved' | 'completed';

export interface LivestockVisit {
  id: string;
  clientId: string;
  farmId: string;
  kind: VisitKind;
  species: string;
  status: VisitStatus;
  assignedTo?: string;
  observations: string;
  findings: string;
  date: string;
}

export const SURVEILLANCE_STATUSES = [
  'reported',
  'assigned',
  'investigating',
  'confirmed',
  'ruled_out',
  'closed',
] as const;
export type SurveillanceStatus = (typeof SURVEILLANCE_STATUSES)[number];

export interface SurveillanceCase {
  id: string;
  clientId: string;
  farmId: string;
  suspectedDisease: string;
  species: string;
  status: SurveillanceStatus;
  assignedTo?: string;
  linkedSampleId?: string;
  reportedAt: string;
  history: WorkflowEvent[];
}

export type VendorStatus = 'pending' | 'active' | 'suspended' | 'expired';

export interface Vendor {
  id: string;
  clientId?: string;
  name: string;
  traderType: 'produce' | 'livestock' | 'processed' | 'mixed';
  phone: string;
  district: District;
  stallId?: string;
  registrationStatus: VendorStatus;
  registeredAt: string;
}

export interface Stall {
  id: string;
  section: string;
  number: number;
  status: 'vacant' | 'allocated';
  vendorId?: string;
}

export type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'pending_sync';

export interface Inspection {
  id: string;
  farmId: string;
  clientId: string;
  type: 'farm' | 'land' | 'compliance';
  scheduledFor: string;
  assignedTo: string;
  status: InspectionStatus;
  findings: string;
  photos: DocRef[];
  capturedOffline: boolean;
  completedAt?: string;
}

export type DocCategory = 'lease' | 'permit' | 'id' | 'report' | 'correspondence' | 'map';

export interface DigitizedDoc {
  id: string;
  title: string;
  category: DocCategory;
  clientId?: string;
  farmId?: string;
  tags: string[];
  fullText: string;
  year: number;
  source: 'migrated' | 'uploaded';
  addedAt: string;
}

export type NotificationChannel = 'email' | 'sms' | 'in_app';

export interface AppNotification {
  id: string;
  channel: NotificationChannel;
  to: string;
  clientId?: string;
  subject: string;
  body: string;
  template: string;
  event: string;
  status: 'queued' | 'sent' | 'read';
  simulated: true;
  createdAt: string;
}

export interface WorkflowStage {
  id: string;
  name: string;
  actorRole: Role;
  order: number;
}

export interface WorkflowDef {
  id: string; // 'loan' | 'land'
  name: string;
  stages: WorkflowStage[];
}

export type AuditCategory = 'auth' | 'workflow' | 'admin' | 'data';

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  actorRole: Role | 'system';
  action: string;
  category: AuditCategory;
  entity?: string;
  entityId?: string;
  detail: string;
}

// ── Land Management (S04) ──────────────────────────────────────────────────
export const LAND_STATUSES = [
  'submitted',
  'under_review',
  'assessment',
  'decision',
  'allocated',
  'rejected',
  'leased',
  'enforcement',
  'retracted',
  'expired',
] as const;
export type LandStatus = (typeof LAND_STATUSES)[number];

export interface LandAssessment {
  at: string;
  by: string;
  findings: string;
  recommendation: 'allocate' | 'reject';
  lat: number;
  lng: number;
}

export interface LandApplication {
  id: string; // LA-2026-001
  clientId: string;
  farmId?: string;
  parcelRef: string;
  district: District;
  purpose: string;
  areaHa: number;
  status: LandStatus;
  assignedTo?: string;
  assessment?: LandAssessment;
  history: WorkflowEvent[];
  createdAt: string;
}

export type LeaseStatus = 'active' | 'expired' | 'pending';
export type PaymentStatus = 'paid' | 'due' | 'overdue';

export interface Lease {
  id: string; // LSE-2026-001
  applicationId?: string;
  clientId: string;
  parcelRef: string;
  district: District;
  startDate: string;
  endDate: string;
  status: LeaseStatus;
  paymentStatus: PaymentStatus;
  annualRentSCR: number;
}

export type EnforcementType = 'retraction' | 'eviction';

export interface LandEnforcement {
  id: string; // ENF-2026-001
  leaseId?: string;
  clientId: string;
  parcelRef: string;
  type: EnforcementType;
  reason: string;
  noticeNo: string;
  status: 'open' | 'notice_served' | 'closed';
  issuedAt: string;
  history: WorkflowEvent[];
}

// The full in-memory database persisted behind store.ts
export interface Database {
  clients: Client[];
  farms: Farm[];
  loans: Loan[];
  samples: Sample[];
  landApplications: LandApplication[];
  leases: Lease[];
  enforcement: LandEnforcement[];
  livestockVisits: LivestockVisit[];
  surveillanceCases: SurveillanceCase[];
  vendors: Vendor[];
  stalls: Stall[];
  inspections: Inspection[];
  users: User[];
  documents: DigitizedDoc[];
  notifications: AppNotification[];
  workflows: WorkflowDef[];
  audit: AuditEntry[];
}

export type CollectionKey = keyof Database;
