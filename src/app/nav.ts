import type { Permission } from '../lib/rbac'

export interface NavItem {
  to: string
  label: string
  /** Screen code from CLAUDE.md §5 — shown in the nav in refs mode. */
  screen: string
  /** Any one of these permissions grants visibility (and reachability). */
  permissions: Permission[]
  icon: string
  group: 'Registries' | 'Services' | 'Oversight' | 'Self-service'
  /** Screens not yet built are listed but disabled, so the shell is honest
   *  about what the current wave delivers. */
  ready: boolean
}

/** Heroicons-style 24px stroke paths. */
const ICONS = {
  portal: 'M3 12l9-9 9 9M5 10v10h14V10',
  clients: 'M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 8a3 3 0 100-6 3 3 0 000 6M21 20v-2a4 4 0 00-3-3.87',
  farms: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
  land: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
  loans: 'M12 3v18M8 7h6a3 3 0 010 6H9a3 3 0 000 6h7',
  lab: 'M9 3v6l-5 9a2 2 0 001.8 3h12.4a2 2 0 001.8-3l-5-9V3M8 3h8M7.5 15h9',
  livestock: 'M5 11a3 3 0 016 0v6H5zM13 11a3 3 0 016 0v6h-6zM6 8V6M18 8V6',
  surveillance: 'M12 3l8 4v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7zM12 9v4M12 16h.01',
  vendors: 'M3 9l1.5-5h15L21 9M3 9h18v11H3zM3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0',
  fieldops: 'M9 11l3 3 5-6M5 4h14v16H5z',
  dashboard: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z',
  notifications: 'M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1',
  documents: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5M9 13h6M9 17h4',
  admin: 'M10.3 3.3a1 1 0 011.4 0l1 1a1 1 0 00.9.3l1.4-.2a1 1 0 011.1.7l.4 1.3a1 1 0 00.6.7l1.3.5a1 1 0 01.6 1.2l-.3 1.4a1 1 0 00.2.9l.9 1.1a1 1 0 010 1.3l-.9 1.1a1 1 0 00-.2.9l.3 1.4a1 1 0 01-.6 1.2l-1.3.5a1 1 0 00-.6.7l-.4 1.3a1 1 0 01-1.1.7l-1.4-.2a1 1 0 00-.9.3l-1 1a1 1 0 01-1.4 0l-1-1a1 1 0 00-.9-.3l-1.4.2a1 1 0 01-1.1-.7l-.4-1.3a1 1 0 00-.6-.7l-1.3-.5a1 1 0 01-.6-1.2l.3-1.4a1 1 0 00-.2-.9l-.9-1.1a1 1 0 010-1.3l.9-1.1a1 1 0 00.2-.9l-.3-1.4a1 1 0 01.6-1.2l1.3-.5a1 1 0 00.6-.7l.4-1.3a1 1 0 011.1-.7l1.4.2a1 1 0 00.9-.3zM12 15a3 3 0 100-6 3 3 0 000 6z',
} as const

export const NAV_ITEMS: NavItem[] = [
  { to: '/portal', label: 'My holding', screen: 'S01', permissions: ['portal.self'], icon: ICONS.portal, group: 'Self-service', ready: true },

  { to: '/dashboard', label: 'Dashboard', screen: 'S12', permissions: ['dashboard.national'], icon: ICONS.dashboard, group: 'Oversight', ready: true },

  { to: '/clients', label: 'Client registry', screen: 'S02', permissions: ['clients.view'], icon: ICONS.clients, group: 'Registries', ready: true },
  { to: '/farms', label: 'Farm registry', screen: 'S03', permissions: ['farms.view'], icon: ICONS.farms, group: 'Registries', ready: true },
  { to: '/land', label: 'Land management', screen: 'S04', permissions: ['land.view'], icon: ICONS.land, group: 'Registries', ready: true },

  { to: '/loans', label: 'Loans', screen: 'S05', permissions: ['loans.view'], icon: ICONS.loans, group: 'Services', ready: true },
  { to: '/lab', label: 'Sampling & laboratory', screen: 'S06', permissions: ['lab.view'], icon: ICONS.lab, group: 'Services', ready: true },
  { to: '/livestock', label: 'Livestock services', screen: 'S07', permissions: ['livestock.view'], icon: ICONS.livestock, group: 'Services', ready: true },
  { to: '/surveillance', label: 'Passive surveillance', screen: 'S08', permissions: ['surveillance.view'], icon: ICONS.surveillance, group: 'Services', ready: true },
  { to: '/vendors', label: 'Vendors & market', screen: 'S09', permissions: ['vendors.view'], icon: ICONS.vendors, group: 'Services', ready: true },
  { to: '/field-ops', label: 'Field operations', screen: 'S10', permissions: ['fieldops.view'], icon: ICONS.fieldops, group: 'Services', ready: true },

  { to: '/notifications', label: 'Notifications', screen: 'S13', permissions: ['notifications.manage'], icon: ICONS.notifications, group: 'Oversight', ready: true },
  { to: '/documents', label: 'Digitized records', screen: 'S13', permissions: ['documents.view'], icon: ICONS.documents, group: 'Oversight', ready: true },
  { to: '/admin', label: 'Administration', screen: 'S11', permissions: ['admin.users', 'admin.audit', 'admin.workflows'], icon: ICONS.admin, group: 'Oversight', ready: true },
]

export const NAV_GROUP_ORDER: NavItem['group'][] = ['Self-service', 'Registries', 'Services', 'Oversight']
