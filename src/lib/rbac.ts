// Role-based access control. The route guard (app/Guard.tsx) enforces this, and
// the S11 admin matrix renders it — so switching demo user actually changes what
// is visible/reachable.
import type { Role } from './types';

export const SCREEN_KEYS = [
  'dashboard',
  'clients',
  'farms',
  'land',
  'loans',
  'lab',
  'livestock',
  'surveillance',
  'vendors',
  'field-ops',
  'notifications',
  'documents',
  'admin',
] as const;
export type ScreenKey = (typeof SCREEN_KEYS)[number];

export interface ScreenMeta {
  key: ScreenKey;
  code: string; // S0x
  label: string;
  path: string;
  module: string;
  desc: string;
}

export const SCREENS: ScreenMeta[] = [
  {
    key: 'dashboard',
    code: 'S12',
    label: 'Dashboard',
    path: '/app/dashboard',
    module: 'xii',
    desc: 'KPIs, charts & report export',
  },
  {
    key: 'clients',
    code: 'S02',
    label: 'Client Registry',
    path: '/app/clients',
    module: 'ii',
    desc: 'Farmer & stakeholder master registry',
  },
  {
    key: 'farms',
    code: 'S03',
    label: 'Farm Registration',
    path: '/app/farms',
    module: 'iii',
    desc: 'Farm intake, GPS & duplicate checks',
  },
  {
    key: 'land',
    code: 'S04',
    label: 'Land Management',
    path: '/app/land',
    module: 'iv',
    desc: 'Allocation, leases & evictions',
  },
  {
    key: 'loans',
    code: 'S05',
    label: 'Loan Management',
    path: '/app/loans',
    module: 'v',
    desc: 'Applications & multi-stage approval',
  },
  {
    key: 'lab',
    code: 'S06',
    label: 'Sampling & Lab',
    path: '/app/lab',
    module: 'vi',
    desc: 'Soil/water/plant/compost samples',
  },
  {
    key: 'livestock',
    code: 'S07',
    label: 'Livestock Services',
    path: '/app/livestock',
    module: 'vii',
    desc: 'Complaint & routine visits',
  },
  {
    key: 'surveillance',
    code: 'S08',
    label: 'Passive Surveillance',
    path: '/app/surveillance',
    module: 'viii',
    desc: 'Suspected disease cases',
  },
  {
    key: 'vendors',
    code: 'S09',
    label: 'Vendor & Market',
    path: '/app/vendors',
    module: 'ix',
    desc: 'Vendor registry & stall allocation',
  },
  {
    key: 'field-ops',
    code: 'S10',
    label: 'Field Operations',
    path: '/app/field-ops',
    module: 'x',
    desc: 'Inspections, offline capture',
  },
  {
    key: 'notifications',
    code: 'S13',
    label: 'Notifications & Docs',
    path: '/app/notifications',
    module: 'xiii',
    desc: 'Messages & digitized documents',
  },
  {
    key: 'documents',
    code: 'S13',
    label: 'Document Repository',
    path: '/app/documents',
    module: 'xiv',
    desc: 'Searchable digitized records',
  },
  {
    key: 'admin',
    code: 'S11',
    label: 'Administration',
    path: '/app/admin',
    module: 'xi',
    desc: 'Users, RBAC, workflow, audit',
  },
];

// Which screens each role may reach. Admin sees everything; farmer uses the
// self-service portal only (not the back-office app).
export const ACCESS: Record<Role, ScreenKey[]> = {
  admin: [...SCREEN_KEYS],
  supervisor: [
    'dashboard',
    'clients',
    'farms',
    'land',
    'loans',
    'lab',
    'livestock',
    'surveillance',
    'vendors',
    'field-ops',
    'notifications',
    'documents',
  ],
  agriculture_officer: [
    'dashboard',
    'clients',
    'farms',
    'land',
    'loans',
    'lab',
    'livestock',
    'surveillance',
    'vendors',
    'field-ops',
    'notifications',
    'documents',
  ],
  field_officer: ['dashboard', 'farms', 'field-ops', 'notifications', 'documents'],
  lab_staff: ['dashboard', 'lab', 'notifications', 'documents'],
  farmer: [], // farmers are confined to /portal
};

export const canAccess = (role: Role, screen: ScreenKey): boolean => ACCESS[role].includes(screen);

export const screensFor = (role: Role): ScreenMeta[] =>
  SCREENS.filter((s) => canAccess(role, s.key));

// Landing route per role after login.
export const landingPath = (role: Role): string =>
  role === 'farmer' ? '/portal' : '/app/dashboard';
