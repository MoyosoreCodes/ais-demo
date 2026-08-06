/**
 * Role-based access control (i.2, xi.3, xi.5).
 *
 * The matrix below is the one the S11 screen renders and the one the route
 * guards enforce — there is no second, decorative copy. Switching demo user
 * therefore genuinely changes what is reachable.
 */

import type { Role } from './types'

export const PERMISSIONS = [
  // Client & farm registries
  'clients.view',
  'clients.edit',
  'clients.merge',
  'farms.view',
  'farms.edit',
  // Land
  'land.view',
  'land.edit',
  'land.decide',
  // Loans
  'loans.view',
  'loans.assess',
  'loans.decide',
  // Laboratory
  'lab.view',
  'lab.register',
  'lab.results',
  // Livestock & surveillance
  'livestock.view',
  'livestock.edit',
  'surveillance.view',
  'surveillance.edit',
  'surveillance.assign',
  // Vendors & market
  'vendors.view',
  'vendors.edit',
  // Field operations
  'fieldops.view',
  'fieldops.capture',
  'fieldops.schedule',
  // Dashboard, notifications, documents
  'dashboard.national',
  'notifications.manage',
  'documents.view',
  'documents.manage',
  // Administration
  'admin.users',
  'admin.workflows',
  'admin.audit',
  'admin.policy',
  // Farmer self-service
  'portal.self',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const ALL_STAFF_READ: Permission[] = [
  'clients.view',
  'farms.view',
  'land.view',
  'loans.view',
  'lab.view',
  'livestock.view',
  'surveillance.view',
  'vendors.view',
  'fieldops.view',
  'dashboard.national',
  'documents.view',
]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Everything except the farmer self-service view: an administrator has no
  // client record behind it, so granting it would only surface an empty screen.
  admin: PERMISSIONS.filter((p) => p !== 'portal.self'),

  agriculture_officer: [
    ...ALL_STAFF_READ,
    'clients.edit',
    'clients.merge',
    'farms.edit',
    'land.edit',
    'loans.assess',
    'lab.register',
    'livestock.edit',
    'surveillance.edit',
    'vendors.edit',
    'fieldops.schedule',
    'notifications.manage',
  ],

  field_officer: [
    'clients.view',
    'farms.view',
    'land.view',
    'lab.view',
    'livestock.view',
    'surveillance.view',
    'fieldops.view',
    'fieldops.capture',
    'documents.view',
    'dashboard.national',
  ],

  lab_staff: [
    'clients.view',
    'farms.view',
    'lab.view',
    'lab.register',
    'lab.results',
    'surveillance.view',
    'documents.view',
    'dashboard.national',
  ],

  supervisor: [
    ...ALL_STAFF_READ,
    'land.decide',
    'loans.decide',
    'surveillance.assign',
    'fieldops.schedule',
    'notifications.manage',
    'admin.audit',
  ],

  farmer: ['portal.self'],
}

export const can = (role: Role | undefined, permission: Permission): boolean =>
  role !== undefined && ROLE_PERMISSIONS[role].includes(permission)

export const canAny = (role: Role | undefined, permissions: Permission[]): boolean =>
  permissions.some((p) => can(role, p))

/** Human-readable grouping used by the S11 matrix. */
export const PERMISSION_GROUPS: { group: string; permissions: Permission[] }[] = [
  { group: 'Client & farm registries', permissions: ['clients.view', 'clients.edit', 'clients.merge', 'farms.view', 'farms.edit'] },
  { group: 'Land management', permissions: ['land.view', 'land.edit', 'land.decide'] },
  { group: 'Loan management', permissions: ['loans.view', 'loans.assess', 'loans.decide'] },
  { group: 'Laboratory', permissions: ['lab.view', 'lab.register', 'lab.results'] },
  { group: 'Livestock & surveillance', permissions: ['livestock.view', 'livestock.edit', 'surveillance.view', 'surveillance.edit', 'surveillance.assign'] },
  { group: 'Vendors & market', permissions: ['vendors.view', 'vendors.edit'] },
  { group: 'Field operations', permissions: ['fieldops.view', 'fieldops.capture', 'fieldops.schedule'] },
  { group: 'Dashboard & records', permissions: ['dashboard.national', 'notifications.manage', 'documents.view', 'documents.manage'] },
  { group: 'Administration', permissions: ['admin.users', 'admin.workflows', 'admin.audit', 'admin.policy'] },
  { group: 'Farmer self-service', permissions: ['portal.self'] },
]

export const PERMISSION_LABELS: Record<Permission, string> = {
  'clients.view': 'View client registry',
  'clients.edit': 'Create / edit clients',
  'clients.merge': 'Merge duplicate clients',
  'farms.view': 'View farm registry',
  'farms.edit': 'Register / edit farms',
  'land.view': 'View land records',
  'land.edit': 'Capture assessments & leases',
  'land.decide': 'Decide land applications',
  'loans.view': 'View loan pipeline',
  'loans.assess': 'Perform technical assessment',
  'loans.decide': 'Committee decision',
  'lab.view': 'View sample registry',
  'lab.register': 'Register samples',
  'lab.results': 'Enter & validate results',
  'livestock.view': 'View livestock services',
  'livestock.edit': 'Record visits',
  'surveillance.view': 'View surveillance cases',
  'surveillance.edit': 'Update cases',
  'surveillance.assign': 'Assign cases to officers',
  'vendors.view': 'View vendor registry',
  'vendors.edit': 'Register vendors & allocate stalls',
  'fieldops.view': 'View inspections',
  'fieldops.capture': 'Capture inspection findings',
  'fieldops.schedule': 'Schedule & assign inspections',
  'dashboard.national': 'National dashboard',
  'notifications.manage': 'Send & manage notifications',
  'documents.view': 'Search digitized documents',
  'documents.manage': 'Index & manage documents',
  'admin.users': 'User account lifecycle',
  'admin.workflows': 'Configure approval workflows',
  'admin.audit': 'View audit log',
  'admin.policy': 'Edit security policy',
  'portal.self': 'Own records (farmer portal)',
}
