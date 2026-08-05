// Central requirement map (Appendix A6, 91 rows). Drives the ReqBadge overlay
// (?refs=1) and is the source for TRACEABILITY.md. `exceeds` marks the rows the
// bid promised to go beyond (★) — those must be visibly demonstrated.
export interface ReqDef {
  module: string;
  text: string;
  screens: string[];
  exceeds?: boolean;
}

export const MODULES: Record<string, string> = {
  i: 'User Management & Authentication',
  ii: 'Client Management (CMS)',
  iii: 'Farm Registration',
  iv: 'Land Management',
  v: 'Loan Management',
  vi: 'Sampling & Laboratory',
  vii: 'Livestock Services',
  viii: 'Passive Surveillance',
  ix: 'Vendor & Market',
  x: 'Field Operations & Inspections',
  xi: 'Workflow & Access Control',
  xii: 'Dashboard & Reporting',
  xiii: 'Notifications & Communication',
  xiv: 'Data Digitization & Document Mgmt',
};

export const REFS: Record<string, ReqDef> = {
  'i.1': {
    module: 'i',
    text: 'Secure username/password login (hashed, policy, lockout, session timeout)',
    screens: ['S01'],
    exceeds: true,
  },
  'i.2': { module: 'i', text: 'Role-based access control for user groups', screens: ['S11'] },
  'i.3': {
    module: 'i',
    text: 'Admin can create, modify and deactivate accounts',
    screens: ['S11'],
  },
  'i.4': { module: 'i', text: 'Farmer self-registration (online)', screens: ['S01'] },
  'i.5': { module: 'i', text: 'Officer-assisted farmer registration', screens: ['S02'] },
  'i.6': {
    module: 'i',
    text: 'Password reset & account recovery (email/SMS OTP)',
    screens: ['S01', 'S11'],
  },
  'i.7': { module: 'i', text: 'User activity & login audit logs', screens: ['S11'] },
  'i.8': {
    module: 'i',
    text: 'Two-factor authentication + SeyID',
    screens: ['S01'],
    exceeds: true,
  },

  'ii.1': { module: 'ii', text: 'Centralized farmer & stakeholder registry', screens: ['S02'] },
  'ii.2': { module: 'ii', text: 'Capture personal & contact information', screens: ['S02'] },
  'ii.3': {
    module: 'ii',
    text: 'National ID (SeyID/NIN) recording & verification',
    screens: ['S02'],
    exceeds: true,
  },
  'ii.4': {
    module: 'ii',
    text: 'Update & manage farmer profiles (change history)',
    screens: ['S02'],
  },
  'ii.5': {
    module: 'ii',
    text: 'Link farmer to farms, loans, livestock, lab records',
    screens: ['S02'],
    exceeds: true,
  },
  'ii.6': { module: 'ii', text: 'Search & filter client records', screens: ['S02'] },
  'ii.7': {
    module: 'ii',
    text: 'Prevent duplicate client registrations',
    screens: ['S02'],
    exceeds: true,
  },

  'iii.1': {
    module: 'iii',
    text: 'Submit farm registration applications (dual-channel)',
    screens: ['S03'],
  },
  'iii.2': {
    module: 'iii',
    text: 'Capture farm GPS location (map)',
    screens: ['S03'],
    exceeds: true,
  },
  'iii.3': {
    module: 'iii',
    text: 'Capture farm size & agricultural activity',
    screens: ['S03'],
    exceeds: true,
  },
  'iii.4': { module: 'iii', text: 'Upload supporting documents', screens: ['S03'] },
  'iii.5': { module: 'iii', text: 'Generate unique Farm ID', screens: ['S03'] },
  'iii.6': { module: 'iii', text: 'Link farms to farmer records', screens: ['S03'] },
  'iii.7': {
    module: 'iii',
    text: 'Prevent duplicate farm registrations',
    screens: ['S03'],
    exceeds: true,
  },

  'iv.1': { module: 'iv', text: 'Land allocation application workflows', screens: ['S04'] },
  'iv.2': { module: 'iv', text: 'Review & approval of land applications', screens: ['S04'] },
  'iv.3': {
    module: 'iv',
    text: 'Capture land assessment/inspection (GIS parcel view)',
    screens: ['S04'],
    exceeds: true,
  },
  'iv.4': { module: 'iv', text: 'Upload assessment reports & documents', screens: ['S04'] },
  'iv.5': { module: 'iv', text: 'Record lease agreements & information', screens: ['S04'] },
  'iv.6': {
    module: 'iv',
    text: 'Track lease status + expiry/payment reminders',
    screens: ['S04'],
    exceeds: true,
  },
  'iv.7': { module: 'iv', text: 'Land retraction & eviction workflows', screens: ['S04'] },
  'iv.8': { module: 'iv', text: 'Maintain historical land records', screens: ['S04'] },

  'v.1': { module: 'v', text: 'Online loan application submission', screens: ['S05'] },
  'v.2': { module: 'v', text: 'Upload loan supporting documents', screens: ['S05'] },
  'v.3': { module: 'v', text: 'Workflow processing for review & approval', screens: ['S05'] },
  'v.4': { module: 'v', text: 'Track loan application status', screens: ['S05'] },
  'v.5': { module: 'v', text: 'Audit trails for loan activities', screens: ['S05'] },
  'v.6': { module: 'v', text: 'Loan monitoring reports', screens: ['S05', 'S12'] },
  'v.7': {
    module: 'v',
    text: 'Dashboards for loan monitoring',
    screens: ['S05', 'S12'],
    exceeds: true,
  },

  'vi.1': { module: 'vi', text: 'Submit sampling requests', screens: ['S06'] },
  'vi.2': { module: 'vi', text: 'Soil sample registration & tracking', screens: ['S06'] },
  'vi.3': { module: 'vi', text: 'Water sample registration & tracking', screens: ['S06'] },
  'vi.4': {
    module: 'vi',
    text: 'Plant & compost sample registration & tracking',
    screens: ['S06'],
  },
  'vi.5': { module: 'vi', text: 'Laboratory test result entry', screens: ['S06'] },
  'vi.6': {
    module: 'vi',
    text: 'Link lab results to farms & farmers',
    screens: ['S06'],
    exceeds: true,
  },
  'vi.7': { module: 'vi', text: 'Generate laboratory reports (PDF)', screens: ['S06'] },
  'vi.8': {
    module: 'vi',
    text: 'Notify applicants when results are available',
    screens: ['S06', 'S13'],
    exceeds: true,
  },

  'vii.1': {
    module: 'vii',
    text: 'Record complaint visits (register/assign/resolve)',
    screens: ['S07'],
    exceeds: true,
  },
  'vii.2': { module: 'vii', text: 'Record routine visits', screens: ['S07'] },
  'vii.3': { module: 'vii', text: 'Capture observations & findings', screens: ['S07'] },
  'vii.4': {
    module: 'vii',
    text: 'Link livestock services to farms/records',
    screens: ['S07'],
    exceeds: true,
  },
  'vii.5': { module: 'vii', text: 'Maintain livestock service history', screens: ['S07'] },
  'vii.6': { module: 'vii', text: 'Generate livestock service reports', screens: ['S07', 'S12'] },

  'viii.1': { module: 'viii', text: 'Report suspected animal disease cases', screens: ['S08'] },
  'viii.2': {
    module: 'viii',
    text: 'Register & track surveillance cases (history)',
    screens: ['S08'],
    exceeds: true,
  },
  'viii.3': { module: 'viii', text: 'Assign surveillance cases to officers', screens: ['S08'] },
  'viii.4': {
    module: 'viii',
    text: 'Link cases to farms & lab results',
    screens: ['S08'],
    exceeds: true,
  },
  'viii.5': { module: 'viii', text: 'Surveillance monitoring reports', screens: ['S08', 'S12'] },

  'ix.1': { module: 'ix', text: 'Register market vendors & traders', screens: ['S09'] },
  'ix.2': { module: 'ix', text: 'Maintain vendor profiles', screens: ['S09'] },
  'ix.3': { module: 'ix', text: 'Record market stall allocation', screens: ['S09'] },
  'ix.4': { module: 'ix', text: 'Track vendor registration status', screens: ['S09'] },
  'ix.5': { module: 'ix', text: 'Vendor & market reports', screens: ['S09', 'S12'] },

  'x.1': { module: 'x', text: 'Schedule field visits & inspections', screens: ['S10'] },
  'x.2': { module: 'x', text: 'Assign inspection tasks to officers', screens: ['S10'] },
  'x.3': {
    module: 'x',
    text: 'Capture findings (mobile/offline with sync)',
    screens: ['S10'],
    exceeds: true,
  },
  'x.4': { module: 'x', text: 'Upload inspection photos & documents', screens: ['S10'] },
  'x.5': { module: 'x', text: 'Maintain historical inspection records', screens: ['S10'] },
  'x.6': { module: 'x', text: 'Generate field inspection reports', screens: ['S10', 'S12'] },

  'xi.1': { module: 'xi', text: 'Workflow-based processing (metadata engine)', screens: ['S11'] },
  'xi.2': { module: 'xi', text: 'Status tracking for applications/approvals', screens: ['S11'] },
  'xi.3': { module: 'xi', text: 'Role-based permissions across modules', screens: ['S11'] },
  'xi.4': { module: 'xi', text: 'Workflow audit logs', screens: ['S11'] },
  'xi.5': { module: 'xi', text: 'Restrict unauthorized access', screens: ['S11'] },
  'xi.6': {
    module: 'xi',
    text: 'Configurable approval workflows (no redeploy)',
    screens: ['S11'],
    exceeds: true,
  },

  'xii.1': { module: 'xii', text: 'Operational dashboards', screens: ['S12'] },
  'xii.2': { module: 'xii', text: 'Farmer & farm statistics', screens: ['S12'] },
  'xii.3': { module: 'xii', text: 'Loan & livestock statistics', screens: ['S12'] },
  'xii.4': { module: 'xii', text: 'Laboratory & surveillance statistics', screens: ['S12'] },
  'xii.5': { module: 'xii', text: 'Generate operational reports', screens: ['S12'] },
  'xii.6': { module: 'xii', text: 'Export reports as PDF and Excel', screens: ['S12'] },
  'xii.7': {
    module: 'xii',
    text: 'Graphical charts & analytics (drill-down)',
    screens: ['S12'],
    exceeds: true,
  },

  'xiii.1': {
    module: 'xiii',
    text: 'Notify users of application status updates',
    screens: ['S13'],
  },
  'xiii.2': { module: 'xiii', text: 'Notify users of laboratory results', screens: ['S13'] },
  'xiii.3': { module: 'xiii', text: 'Email notifications', screens: ['S13'] },
  'xiii.4': { module: 'xiii', text: 'SMS notifications', screens: ['S13'], exceeds: true },
  'xiii.5': { module: 'xiii', text: 'Basic communication & feedback', screens: ['S13'] },

  'xiv.1': { module: 'xiv', text: 'Migrate existing records', screens: ['S13'] },
  'xiv.2': { module: 'xiv', text: 'Upload & index scanned documents', screens: ['S13'] },
  'xiv.3': {
    module: 'xiv',
    text: 'Validate migrated data (verification report)',
    screens: ['S13'],
    exceeds: true,
  },
  'xiv.4': { module: 'xiv', text: 'Searchable access to digitized records', screens: ['S13'] },
  'xiv.5': { module: 'xiv', text: 'Secure storage of digitized records', screens: ['S13'] },
  'xiv.6': {
    module: 'xiv',
    text: 'Document categorization & indexing',
    screens: ['S13'],
    exceeds: true,
  },
};

export const ALL_REFS = Object.keys(REFS);
