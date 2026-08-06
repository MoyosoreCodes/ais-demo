/**
 * Central registry of the 91 Appendix A6 requirement rows (CLAUDE.md §8).
 *
 * This is the single source of truth behind:
 *   - `<ReqBadge refs="iii.2" />` annotations shown in `?refs=1` mode,
 *   - the coverage view that proves every row is annotated somewhere,
 *   - TRACEABILITY.md (generated from this file by scripts/traceability.mjs).
 */

export interface RequirementRow {
  ref: string
  module: string
  moduleName: string
  /** True where the bid promised to exceed the requirement (★). */
  exceeds: boolean
  requirement: string
  promised: string
  screens: string[]
}

export const MODULES: Record<string, string> = {
  i: 'User Management & Authentication',
  ii: 'Client Management (CMS)',
  iii: 'Farm Registration',
  iv: 'Land Management',
  v: 'Loan Management',
  vi: 'Sampling & Laboratory Management',
  vii: 'Livestock Services Management',
  viii: 'Passive Surveillance',
  ix: 'Vendor & Market Management',
  x: 'Field Operations & Inspections',
  xi: 'Workflow & Access Control',
  xii: 'Dashboard & Reporting',
  xiii: 'Notifications & Communication',
  xiv: 'Data Digitization & Document Management',
}

const row = (
  ref: string,
  exceeds: boolean,
  requirement: string,
  promised: string,
  screens: string[],
): RequirementRow => {
  const module = ref.split('.')[0]
  return { ref, module, moduleName: MODULES[module], exceeds, requirement, promised, screens }
}

export const REQUIREMENTS: RequirementRow[] = [
  /* --- i — User management & authentication --------------------- */
  row('i.1', true, 'Secure user authentication through username and password login', 'Hardened login; encrypted password storage (salted hash); ★ configurable password policy, lockout, session timeout', ['S01']),
  row('i.2', false, 'Role-based access control for different user groups', 'Granular RBAC — Admin, Agriculture Officer, Field Officer, Laboratory Staff, Supervisor, Farmer', ['S11']),
  row('i.3', false, 'Administrators can create, modify, and deactivate user accounts', 'Admin console for full account lifecycle', ['S11']),
  row('i.4', false, 'Farmer self-registration through online access', 'Public self-service registration portal', ['S01']),
  row('i.5', false, 'Officer-assisted farmer registration', 'Back-office registration workflow', ['S02']),
  row('i.6', false, 'Password reset and account recovery functionality', 'Self-service reset + admin recovery, email/SMS OTP', ['S01', 'S11']),
  row('i.7', false, 'Maintain user activity and login audit logs', 'Append-only, tamper-evident audit log', ['S11']),
  row('i.8', true, 'Support two-factor authentication (2FA)', '★ MFA/2FA (TOTP); ★ SeyID (OTP/QR) integration keyed on NIN with local-MFA fallback for non-SeyID users', ['S01']),

  /* --- ii — Client management ----------------------------------- */
  row('ii.1', false, 'Maintain a centralized farmer and stakeholder database', 'Single master client registry (source of truth)', ['S02']),
  row('ii.2', false, 'Capture farmer personal and contact information', 'Structured client profile', ['S02']),
  row('ii.3', true, 'Support National Identification (SeyID/NIN) recording', '★ NIN capture with SeyID verification', ['S02']),
  row('ii.4', false, 'Support updating and management of farmer profiles', 'Full profile lifecycle with change history', ['S02']),
  row('ii.5', true, 'Link farmer records with farms, loans, livestock services, and laboratory records', '★ Relational linking across all modules by Client ID', ['S02']),
  row('ii.6', false, 'Support searching and filtering of client records', 'Indexed search + faceted filters + full-text', ['S02']),
  row('ii.7', true, 'Prevent duplicate client registrations', '★ Duplicate detection on NIN / name / contact', ['S02']),

  /* --- iii — Farm registration ----------------------------------- */
  row('iii.1', false, 'Allow submission of farm registration applications', 'Dual-channel (online + back-office) registration workflow', ['S03']),
  row('iii.2', true, 'Capture farm GPS location information', '★ GIS-enabled GPS capture + map view', ['S03']),
  row('iii.3', true, 'Capture farm size and agricultural activity information', 'Structured intake; ★ configurable intake fields; crop/livestock activity', ['S03']),
  row('iii.4', false, 'Support upload of supporting documents', 'Document upload with verification workflow', ['S03']),
  row('iii.5', false, 'Generate unique Farm Identification Numbers (Farm ID)', 'Auto-generated Farm ID', ['S03']),
  row('iii.6', false, 'Link farms to farmer records', 'Two-way link to CMS by Client ID', ['S03']),
  row('iii.7', true, 'Prevent duplicate farm registrations', '★ Duplicate detection on parcel / GPS / owner', ['S03']),

  /* --- iv — Land management -------------------------------------- */
  row('iv.1', false, 'Support land allocation application workflows', 'Configurable submission → review → decision workflow', ['S04']),
  row('iv.2', false, 'Support review and approval of land applications', 'Routed, role-based approvals with status tracking', ['S04']),
  row('iv.3', true, 'Capture land assessment and inspection information', 'Structured assessment/inspection capture; ★ GIS parcel view', ['S04']),
  row('iv.4', false, 'Support upload of assessment reports and supporting documents', 'Document uploads with metadata/versioning', ['S04']),
  row('iv.5', false, 'Record lease agreements and lease information', 'Lease register with terms', ['S04']),
  row('iv.6', true, 'Track lease status (active/expired/pending)', 'Status tracking; ★ lease-expiry + ★ lease-payment reminders and reports', ['S04']),
  row('iv.7', false, 'Support land retraction and eviction workflows', 'Non-compliance → retraction → eviction workflow with approvals and notices', ['S04']),
  row('iv.8', false, 'Maintain historical land management records', 'Immutable land enforcement/allocation history', ['S04']),

  /* --- v — Loan management --------------------------------------- */
  row('v.1', false, 'Support online loan application submission', 'Farmer-facing application form', ['S05']),
  row('v.2', false, 'Support upload of loan supporting documents', 'Document upload with validation', ['S05']),
  row('v.3', false, 'Support workflow processing for review and approval', 'Configurable multi-stage approval workflow', ['S05']),
  row('v.4', false, 'Track loan application status', 'End-to-end status tracking', ['S05']),
  row('v.5', false, 'Maintain audit trails for loan activities', 'Append-only audit of all decisions/actions', ['S05']),
  row('v.6', false, 'Generate loan monitoring reports', 'Standard + ad-hoc loan reports', ['S05', 'S12']),
  row('v.7', true, 'Provide dashboards for loan monitoring', '★ Real-time loan dashboards/KPIs', ['S05', 'S12']),

  /* --- vi — Sampling & laboratory --------------------------------- */
  row('vi.1', false, 'Support submission of sampling requests', 'Online/back-office sampling request', ['S06']),
  row('vi.2', false, 'Support soil sample registration and tracking', 'Sample registry + lifecycle tracking', ['S06']),
  row('vi.3', false, 'Support water sample registration and tracking', 'Sample registry + lifecycle tracking', ['S06']),
  row('vi.4', false, 'Support plant and compost sample registration and tracking', 'Sample registry + lifecycle tracking', ['S06']),
  row('vi.5', false, 'Support laboratory test result entry', 'Structured result capture', ['S06']),
  row('vi.6', true, 'Link laboratory results to farms and farmers', '★ Auto-link to Farm/Client by ID', ['S06']),
  row('vi.7', false, 'Generate laboratory reports', 'Templated lab reports (PDF/Excel)', ['S06']),
  row('vi.8', true, 'Notify applicants when results are available', '★ Email/SMS/in-app result notifications', ['S06', 'S13']),

  /* --- vii — Livestock services ----------------------------------- */
  row('vii.1', true, 'Support recording of complaint visits', 'Complaint-visit capture; ★ complaint registration, assignment & resolution tracking', ['S07']),
  row('vii.2', false, 'Support recording of routine visits', 'Routine-visit capture with details', ['S07']),
  row('vii.3', false, 'Capture livestock service observations and findings', 'Structured observations/findings', ['S07']),
  row('vii.4', true, 'Link livestock services to farms and farmer records', '★ Link by Farm/Client ID', ['S07']),
  row('vii.5', false, 'Maintain livestock service history records', 'Full service history per farm/client', ['S07']),
  row('vii.6', false, 'Generate livestock service reports', 'Service reports + monitoring', ['S07', 'S12']),

  /* --- viii — Passive surveillance --------------------------------- */
  row('viii.1', false, 'Support reporting of suspected animal disease cases', 'Case reporting intake', ['S08']),
  row('viii.2', true, 'Register and track surveillance cases', 'Case registry + lifecycle tracking; ★ historical records', ['S08']),
  row('viii.3', false, 'Assign surveillance cases to officers', 'Role-based case assignment', ['S08']),
  row('viii.4', true, 'Link surveillance cases to farms and laboratory results', '★ Link to Farm and Lab result by ID', ['S08']),
  row('viii.5', false, 'Generate surveillance monitoring reports', 'Surveillance reports/dashboards', ['S08', 'S12']),

  /* --- ix — Vendor & market ---------------------------------------- */
  row('ix.1', false, 'Support registration of market vendors and traders', 'Vendor/trader registry', ['S09']),
  row('ix.2', false, 'Maintain vendor profiles and records', 'Vendor profile with contact/credentials', ['S09']),
  row('ix.3', false, 'Record market stall allocation information', 'Stall allocation records', ['S09']),
  row('ix.4', false, 'Track vendor registration status', 'Status tracking', ['S09']),
  row('ix.5', false, 'Generate vendor and market reports', 'Vendor/market reports', ['S09', 'S12']),

  /* --- x — Field operations ---------------------------------------- */
  row('x.1', false, 'Support scheduling of field visits and inspections', 'Scheduling with calendar/assignment', ['S10']),
  row('x.2', false, 'Assign inspection tasks to officers', 'Task assignment to field officers', ['S10']),
  row('x.3', true, 'Capture inspection findings and observations', 'Structured findings; ★ mobile/offline capture with sync', ['S10']),
  row('x.4', false, 'Support upload of inspection photos and documents', 'Photo/document upload from device', ['S10']),
  row('x.5', false, 'Maintain historical field inspection records', 'Immutable inspection history', ['S10']),
  row('x.6', false, 'Generate field inspection reports', 'Inspection reports/summaries', ['S10', 'S12']),

  /* --- xi — Workflow & access control ------------------------------ */
  row('xi.1', false, 'Support workflow-based processing', 'Central metadata-driven workflow engine', ['S11']),
  row('xi.2', false, 'Support status tracking for applications and approvals', 'Pending / Under-Review / Approved / Rejected states', ['S11']),
  row('xi.3', false, 'Support role-based permissions', 'Granular RBAC across all modules', ['S11']),
  row('xi.4', false, 'Maintain workflow audit logs', 'Append-only workflow/action audit', ['S11']),
  row('xi.5', false, 'Restrict unauthorized access to sensitive information', 'Enforced RBAC + record-level controls', ['S11']),
  row('xi.6', true, 'Support configurable approval workflows', '★ Admin-configurable approval hierarchies (no redeploy)', ['S11']),

  /* --- xii — Dashboard & reporting ---------------------------------- */
  row('xii.1', false, 'Provide operational dashboards', 'Role-based real-time dashboards', ['S12']),
  row('xii.2', false, 'Display statistics for farmers and farms', 'Registered farmers/farms KPIs', ['S12']),
  row('xii.3', false, 'Display loan and livestock service statistics', 'Loan/livestock KPIs', ['S12']),
  row('xii.4', false, 'Display laboratory and surveillance statistics', 'Lab/surveillance KPIs', ['S12']),
  row('xii.5', false, 'Generate operational reports', 'Standard + ad-hoc report builder', ['S12']),
  row('xii.6', false, 'Support report export in PDF and Excel formats', 'Multi-format export (PDF/Excel/CSV)', ['S12']),
  row('xii.7', true, 'Support graphical charts and analytics', '★ Charts, drill-down, analytics', ['S12']),

  /* --- xiii — Notifications ----------------------------------------- */
  row('xiii.1', false, 'Notify users regarding application status updates', 'Configurable status notifications', ['S13']),
  row('xiii.2', false, 'Notify users regarding laboratory results', 'Result-ready notifications', ['S13']),
  row('xiii.3', false, 'Support email notifications', 'Email channel', ['S13']),
  row('xiii.4', true, 'Support SMS notifications', '★ SMS channel (low-literacy/low-connectivity reach)', ['S13']),
  row('xiii.5', false, 'Provide basic communication and feedback functionality', 'In-app messaging/feedback', ['S13']),

  /* --- xiv — Digitization & documents -------------------------------- */
  row('xiv.1', false, 'Support migration of existing records', 'Profiling → cleansing → migration of farmer/farm/land/loan records', ['S13']),
  row('xiv.2', false, 'Support upload and indexing of scanned documents', 'Bulk scan upload with indexing', ['S13']),
  row('xiv.3', true, 'Validate migrated data', '★ Automated validation + verification report', ['S13']),
  row('xiv.4', false, 'Provide searchable access to digitized records', 'Full-text searchable repository', ['S13']),
  row('xiv.5', false, 'Support secure storage of digitized records', 'AES-256 at rest; RBAC; backup', ['S13']),
  row('xiv.6', true, 'Support document categorization and indexing', '★ Metadata tagging + categorization', ['S13']),
]

export const REQUIREMENT_BY_REF: Record<string, RequirementRow> = Object.fromEntries(
  REQUIREMENTS.map((r) => [r.ref, r]),
)

/** Ordering key so `iii.2` sorts after `ii.7` and before `iv.1`. */
const MODULE_ORDER = Object.keys(MODULES)
export const compareRefs = (a: string, b: string): number => {
  const [ma, na] = a.split('.')
  const [mb, nb] = b.split('.')
  const d = MODULE_ORDER.indexOf(ma) - MODULE_ORDER.indexOf(mb)
  return d !== 0 ? d : Number(na) - Number(nb)
}
