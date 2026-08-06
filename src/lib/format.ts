/** Presentation helpers. Copy is kept in one place so a Creole locale could
 *  be layered on later without touching the screens (CLAUDE.md §2). */

import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'
import type { Client, Farm } from './types'

/** The demo runs against a fixed "today" so the seeded story never drifts. */
export const DEMO_TODAY = new Date('2026-04-01T08:00:00.000Z')

const toDate = (value: string | Date): Date =>
  value instanceof Date ? value : parseISO(value)

export const formatDate = (value?: string | Date, fallback = '—'): string => {
  if (!value) return fallback
  const d = toDate(value)
  return isValid(d) ? format(d, 'd MMM yyyy') : fallback
}

export const formatDateTime = (value?: string | Date, fallback = '—'): string => {
  if (!value) return fallback
  const d = toDate(value)
  return isValid(d) ? format(d, 'd MMM yyyy, HH:mm') : fallback
}

export const formatTime = (value?: string | Date, fallback = '—'): string => {
  if (!value) return fallback
  const d = toDate(value)
  return isValid(d) ? format(d, 'HH:mm') : fallback
}

export const formatRelative = (value?: string | Date, fallback = '—'): string => {
  if (!value) return fallback
  const d = toDate(value)
  return isValid(d) ? `${formatDistanceToNow(d)} ago` : fallback
}

/** Seychelles Rupees. The prototype never handles real money. */
export const formatScr = (amount?: number, fallback = '—'): string =>
  amount === undefined || amount === null
    ? fallback
    : `SCR ${amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`

export const formatHa = (ha?: number): string =>
  ha === undefined ? '—' : `${ha.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} ha`

export const formatCoords = (lat: number, lng: number): string =>
  `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`

export const clientName = (c?: Pick<Client, 'firstName' | 'lastName'>): string =>
  c ? `${c.firstName} ${c.lastName}` : 'Unknown client'

export const initials = (name: string): string =>
  name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

export const titleCase = (s: string): string =>
  s.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())

export const farmActivities = (f: Farm): string => {
  const parts: string[] = []
  if (f.crops.length) parts.push(f.crops.join(', '))
  if (f.livestock.length) parts.push(f.livestock.map((l) => `${l.headcount} ${l.type}`).join(', '))
  return parts.length ? parts.join(' · ') : 'No activity recorded'
}

/* ------------------------------------------------------------------ *
 * Identifier generation
 * ------------------------------------------------------------------ */

const nextNumber = (existing: string[], prefix: string, width: number): string => {
  const re = new RegExp(`^${prefix.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')}(\\d+)$`)
  const max = existing.reduce((acc, id) => {
    const m = re.exec(id)
    return m ? Math.max(acc, Number(m[1])) : acc
  }, 0)
  return `${prefix}${String(max + 1).padStart(width, '0')}`
}

/** `FRM-2026-00001` (iii.5). */
export const nextFarmId = (existingIds: string[], year = DEMO_TODAY.getUTCFullYear()): string =>
  nextNumber(existingIds, `FRM-${year}-`, 5)

/** `CLT-2026-0001`. */
export const nextClientId = (existingIds: string[], year = DEMO_TODAY.getUTCFullYear()): string =>
  nextNumber(existingIds, `CLT-${year}-`, 4)

/** `LN-2026-0001`. */
export const nextLoanId = (existingIds: string[], year = DEMO_TODAY.getUTCFullYear()): string =>
  nextNumber(existingIds, `LN-${year}-`, 4)

/** `LAB-2026-0001`. */
export const nextSampleId = (existingIds: string[], year = DEMO_TODAY.getUTCFullYear()): string =>
  nextNumber(existingIds, `LAB-${year}-`, 4)

/** `INS-2026-001`. */
export const nextInspectionId = (existingIds: string[], year = DEMO_TODAY.getUTCFullYear()): string =>
  nextNumber(existingIds, `INS-${year}-`, 3)

/** `SUR-2026-001`. */
export const nextCaseId = (existingIds: string[], year = DEMO_TODAY.getUTCFullYear()): string =>
  nextNumber(existingIds, `SUR-${year}-`, 3)

/** `LSV-2026-0001`. */
export const nextVisitId = (existingIds: string[], year = DEMO_TODAY.getUTCFullYear()): string =>
  nextNumber(existingIds, `LSV-${year}-`, 4)

/** `VND-2026-001`. */
export const nextVendorId = (existingIds: string[], year = DEMO_TODAY.getUTCFullYear()): string =>
  nextNumber(existingIds, `VND-${year}-`, 3)

/** Short opaque id for records that are not user-facing (history rows etc.). */
let localSeq = 0
export const localId = (prefix: string): string => {
  localSeq += 1
  return `${prefix}-${localSeq.toString(36)}${Math.floor(performance.now()).toString(36)}`
}

/* ------------------------------------------------------------------ *
 * Validation shared by the intake forms
 * ------------------------------------------------------------------ */

/** Fictional NIN shape: `999-DDMM-S-C-YY` (CLAUDE.md §2). */
export const NIN_PATTERN = /^999-\d{4}-[12]-\d-\d{2}$/
export const isValidNin = (nin: string): boolean => NIN_PATTERN.test(nin.trim())

/** Demo phone shape: `+248 2 000 0xx`. */
export const PHONE_PATTERN = /^\+248 2 000 0\d{2}$/
export const isValidPhone = (phone: string): boolean => PHONE_PATTERN.test(phone.trim())

export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

/** Great-circle distance in metres — backs the S03 GPS proximity check (iii.7). */
export const distanceMetres = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number => {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Normalised similarity in [0,1] — Dice coefficient over character bigrams. */
export const similarity = (a: string, b: string): number => {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const x = norm(a)
  const y = norm(b)
  if (!x.length || !y.length) return 0
  if (x === y) return 1
  const bigrams = (s: string) => {
    const out = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2)
      out.set(g, (out.get(g) ?? 0) + 1)
    }
    return out
  }
  const bx = bigrams(x)
  const by = bigrams(y)
  let hits = 0
  for (const [g, n] of bx) hits += Math.min(n, by.get(g) ?? 0)
  const total = x.length - 1 + (y.length - 1)
  return total > 0 ? (2 * hits) / total : 0
}
