/**
 * Report datasets (xii.5, xii.6).
 *
 * Each dataset flattens one registry into plain rows, declares its columns and
 * says which columns are worth filtering on. The report builder is rendered from
 * this metadata, so adding a dataset is a data change rather than a new screen —
 * and every dataset exports through the same PDF, Excel and CSV path.
 */

import { clientName, formatHa } from './format'
import { statusLabel } from './workflow'
import type { AisDatabase } from './types'
import type { Permission } from './rbac'

export type ReportValue = string | number
export type ReportRow = Record<string, ReportValue>

export interface DatasetColumn {
  key: string
  header: string
  align?: 'left' | 'right'
}

export interface DatasetDef {
  id: string
  label: string
  description: string
  /** Permission required to run the report at all. */
  permission: Permission
  refs: string[]
  columns: DatasetColumn[]
  /** Column keys offered as faceted filters. */
  filterKeys: string[]
  /** Column key holding an ISO date, used by the date-range filter. */
  dateKey?: string
  build: (db: AisDatabase) => ReportRow[]
}

const yesNo = (value: boolean): string => (value ? 'Yes' : 'No')

export const DATASETS: DatasetDef[] = [
  {
    id: 'clients',
    label: 'Clients',
    description: 'Every farmer and stakeholder on the central registry.',
    permission: 'clients.view',
    refs: ['xii.2'],
    columns: [
      { key: 'id', header: 'Client ID' },
      { key: 'name', header: 'Name' },
      { key: 'nin', header: 'NIN' },
      { key: 'district', header: 'District' },
      { key: 'island', header: 'Island' },
      { key: 'type', header: 'Stakeholder type' },
      { key: 'channel', header: 'Registered via' },
      { key: 'seyId', header: 'SeyID verified' },
      { key: 'status', header: 'Status' },
      { key: 'registeredOn', header: 'Registered' },
      { key: 'farms', header: 'Farms', align: 'right' },
    ],
    filterKeys: ['district', 'island', 'type', 'channel', 'seyId', 'status'],
    dateKey: 'registeredOn',
    build: (db) =>
      db.clients.map((c) => ({
        id: c.id,
        name: clientName(c),
        nin: c.nin,
        district: c.district,
        island: c.island,
        type: statusLabel(c.stakeholderType),
        channel: statusLabel(c.registeredVia),
        seyId: yesNo(c.seyIdVerified),
        status: statusLabel(c.status),
        registeredOn: c.registeredOn,
        farms: db.farms.filter((f) => f.clientId === c.id).length,
      })),
  },
  {
    id: 'farms',
    label: 'Farms',
    description: 'Registered holdings with size, tenure and agricultural activity.',
    permission: 'farms.view',
    refs: ['xii.2'],
    columns: [
      { key: 'id', header: 'Farm ID' },
      { key: 'name', header: 'Holding' },
      { key: 'farmer', header: 'Farmer' },
      { key: 'clientId', header: 'Client ID' },
      { key: 'parcelRef', header: 'Parcel' },
      { key: 'district', header: 'District' },
      { key: 'island', header: 'Island' },
      { key: 'sizeHa', header: 'Size (ha)', align: 'right' },
      { key: 'tenure', header: 'Tenure' },
      { key: 'crops', header: 'Crops' },
      { key: 'livestock', header: 'Livestock' },
      { key: 'water', header: 'Water source' },
      { key: 'status', header: 'Status' },
      { key: 'registeredOn', header: 'Registered' },
    ],
    filterKeys: ['district', 'island', 'tenure', 'status', 'water'],
    dateKey: 'registeredOn',
    build: (db) =>
      db.farms.map((f) => ({
        id: f.id,
        name: f.name,
        farmer: clientName(db.clients.find((c) => c.id === f.clientId)),
        clientId: f.clientId,
        parcelRef: f.parcelRef,
        district: f.district,
        island: f.island,
        sizeHa: f.sizeHa,
        tenure: statusLabel(f.tenure),
        crops: f.crops.join(', ') || '—',
        livestock: f.livestock.map((l) => `${l.headcount} ${l.type}`).join(', ') || '—',
        water: statusLabel(f.waterSource),
        status: statusLabel(f.status),
        registeredOn: f.registeredOn,
      })),
  },
  {
    id: 'loans',
    label: 'Loan applications',
    description: 'The agricultural credit pipeline with amounts and decisions.',
    permission: 'loans.view',
    refs: ['xii.3', 'v.6'],
    columns: [
      { key: 'id', header: 'Reference' },
      { key: 'farmer', header: 'Farmer' },
      { key: 'clientId', header: 'Client ID' },
      { key: 'holding', header: 'Holding' },
      { key: 'district', header: 'District' },
      { key: 'purpose', header: 'Purpose' },
      { key: 'amountScr', header: 'Amount (SCR)', align: 'right' },
      { key: 'termMonths', header: 'Term (months)', align: 'right' },
      { key: 'ratePct', header: 'Rate (%)', align: 'right' },
      { key: 'status', header: 'Status' },
      { key: 'submittedOn', header: 'Submitted' },
    ],
    filterKeys: ['district', 'status', 'purpose'],
    dateKey: 'submittedOn',
    build: (db) =>
      db.loans.map((l) => {
        const farm = db.farms.find((f) => f.id === l.farmId)
        return {
          id: l.id,
          farmer: clientName(db.clients.find((c) => c.id === l.clientId)),
          clientId: l.clientId,
          holding: farm?.name ?? l.farmId,
          district: farm?.district ?? '—',
          purpose: l.purpose,
          amountScr: l.amountScr,
          termMonths: l.termMonths,
          ratePct: l.interestRatePct,
          status: statusLabel(l.status),
          submittedOn: l.submittedOn,
        }
      }),
  },
  {
    id: 'samples',
    label: 'Laboratory samples',
    description: 'Soil, water, plant, compost and veterinary analyses and their results.',
    permission: 'lab.view',
    refs: ['xii.4', 'vi.7'],
    columns: [
      { key: 'id', header: 'Reference' },
      { key: 'type', header: 'Type' },
      { key: 'farmer', header: 'Applicant' },
      { key: 'holding', header: 'Holding' },
      { key: 'district', header: 'District' },
      { key: 'purpose', header: 'Purpose' },
      { key: 'status', header: 'Status' },
      { key: 'requestedOn', header: 'Requested' },
      { key: 'completedOn', header: 'Completed' },
      { key: 'outOfRange', header: 'Out of range', align: 'right' },
      { key: 'notified', header: 'Applicant notified' },
    ],
    filterKeys: ['type', 'status', 'district', 'notified'],
    dateKey: 'requestedOn',
    build: (db) =>
      db.samples.map((s) => {
        const farm = db.farms.find((f) => f.id === s.farmId)
        return {
          id: s.id,
          type: statusLabel(s.type),
          farmer: clientName(db.clients.find((c) => c.id === s.clientId)),
          holding: farm?.name ?? s.farmId,
          district: farm?.district ?? '—',
          purpose: s.purpose,
          status: statusLabel(s.status),
          requestedOn: s.requestedOn,
          completedOn: s.completedOn ?? '—',
          outOfRange: s.results.filter((r) => r.flag !== 'normal').length,
          notified: s.notifiedOn ? 'Yes' : 'No',
        }
      }),
  },
  {
    id: 'livestock',
    label: 'Livestock service visits',
    description: 'Complaint and routine visits with their findings.',
    permission: 'livestock.view',
    refs: ['xii.3', 'vii.6'],
    columns: [
      { key: 'id', header: 'Reference' },
      { key: 'type', header: 'Visit type' },
      { key: 'species', header: 'Species' },
      { key: 'farmer', header: 'Farmer' },
      { key: 'holding', header: 'Holding' },
      { key: 'district', header: 'District' },
      { key: 'officer', header: 'Officer' },
      { key: 'status', header: 'Status' },
      { key: 'scheduledOn', header: 'Scheduled' },
      { key: 'visitedOn', header: 'Visited' },
      { key: 'findings', header: 'Findings' },
    ],
    filterKeys: ['type', 'species', 'status', 'district', 'officer'],
    dateKey: 'scheduledOn',
    build: (db) =>
      db.livestockVisits.map((v) => {
        const farm = db.farms.find((f) => f.id === v.farmId)
        return {
          id: v.id,
          type: statusLabel(v.type),
          species: v.species,
          farmer: clientName(db.clients.find((c) => c.id === v.clientId)),
          holding: farm?.name ?? v.farmId,
          district: farm?.district ?? '—',
          officer: db.users.find((u) => u.id === v.officerUserId)?.fullName ?? v.officerUserId,
          status: statusLabel(v.status),
          scheduledOn: v.scheduledOn,
          visitedOn: v.visitedOn ?? '—',
          findings: v.findings || '—',
        }
      }),
  },
  {
    id: 'surveillance',
    label: 'Surveillance cases',
    description: 'Suspected animal disease cases and their outcomes.',
    permission: 'surveillance.view',
    refs: ['xii.4', 'viii.5'],
    columns: [
      { key: 'id', header: 'Case' },
      { key: 'disease', header: 'Suspected disease' },
      { key: 'species', header: 'Species' },
      { key: 'farmer', header: 'Farmer' },
      { key: 'holding', header: 'Holding' },
      { key: 'district', header: 'District' },
      { key: 'channel', header: 'Reported via' },
      { key: 'affected', header: 'Affected', align: 'right' },
      { key: 'mortality', header: 'Mortality', align: 'right' },
      { key: 'lab', header: 'Laboratory' },
      { key: 'status', header: 'Status' },
      { key: 'reportedOn', header: 'Reported' },
    ],
    filterKeys: ['disease', 'species', 'status', 'district', 'channel'],
    dateKey: 'reportedOn',
    build: (db) =>
      db.surveillanceCases.map((c) => {
        const farm = db.farms.find((f) => f.id === c.farmId)
        return {
          id: c.id,
          disease: c.suspectedDisease,
          species: c.species,
          farmer: clientName(db.clients.find((x) => x.id === c.clientId)),
          holding: farm?.name ?? c.farmId,
          district: farm?.district ?? '—',
          channel: statusLabel(c.reportedVia),
          affected: c.affectedCount,
          mortality: c.mortalityCount,
          lab: c.linkedSampleId ?? '—',
          status: statusLabel(c.status),
          reportedOn: c.reportedOn,
        }
      }),
  },
  {
    id: 'inspections',
    label: 'Field inspections',
    description: 'Scheduled and completed inspections, including offline captures.',
    permission: 'fieldops.view',
    refs: ['xii.3', 'x.6'],
    columns: [
      { key: 'id', header: 'Reference' },
      { key: 'type', header: 'Type' },
      { key: 'farmer', header: 'Farmer' },
      { key: 'holding', header: 'Holding' },
      { key: 'district', header: 'District' },
      { key: 'officer', header: 'Officer' },
      { key: 'status', header: 'Status' },
      { key: 'outcome', header: 'Outcome' },
      { key: 'scheduledOn', header: 'Scheduled' },
      { key: 'completedOn', header: 'Completed' },
      { key: 'photos', header: 'Photographs', align: 'right' },
      { key: 'offline', header: 'Captured offline' },
    ],
    filterKeys: ['type', 'status', 'outcome', 'district', 'officer', 'offline'],
    dateKey: 'scheduledOn',
    build: (db) =>
      db.inspections.map((i) => {
        const farm = db.farms.find((f) => f.id === i.farmId)
        return {
          id: i.id,
          type: statusLabel(i.type),
          farmer: clientName(db.clients.find((c) => c.id === i.clientId)),
          holding: farm?.name ?? i.farmId,
          district: farm?.district ?? '—',
          officer: db.users.find((u) => u.id === i.officerUserId)?.fullName ?? i.officerUserId,
          status: statusLabel(i.status),
          outcome: statusLabel(i.outcome),
          scheduledOn: i.scheduledOn,
          completedOn: i.completedOn ?? '—',
          photos: i.photos.length,
          offline: yesNo(i.capturedOffline),
        }
      }),
  },
  {
    id: 'leases',
    label: 'Leases',
    description: 'The lease register with term, rent and payment position.',
    permission: 'land.view',
    refs: ['xii.5', 'iv.6'],
    columns: [
      { key: 'id', header: 'Lease' },
      { key: 'lessee', header: 'Lessee' },
      { key: 'clientId', header: 'Client ID' },
      { key: 'parcelRef', header: 'Parcel' },
      { key: 'district', header: 'District' },
      { key: 'areaHa', header: 'Area (ha)', align: 'right' },
      { key: 'startDate', header: 'Start' },
      { key: 'endDate', header: 'End' },
      { key: 'rentScr', header: 'Annual rent (SCR)', align: 'right' },
      { key: 'status', header: 'Status' },
      { key: 'payment', header: 'Payment' },
      { key: 'nextDue', header: 'Next payment due' },
    ],
    filterKeys: ['district', 'status', 'payment'],
    dateKey: 'endDate',
    build: (db) =>
      db.leases.map((l) => ({
        id: l.id,
        lessee: clientName(db.clients.find((c) => c.id === l.clientId)),
        clientId: l.clientId,
        parcelRef: l.parcelRef,
        district: l.district,
        areaHa: l.areaHa,
        startDate: l.startDate,
        endDate: l.endDate,
        rentScr: l.annualRentScr,
        status: statusLabel(l.status),
        payment: statusLabel(l.paymentStatus),
        nextDue: l.nextPaymentDue,
      })),
  },
  {
    id: 'vendors',
    label: 'Market vendors',
    description: 'Vendor registrations, licences and stall allocation.',
    permission: 'vendors.view',
    refs: ['xii.5', 'ix.5'],
    columns: [
      { key: 'id', header: 'Vendor' },
      { key: 'tradeName', header: 'Trading as' },
      { key: 'name', header: 'Vendor name' },
      { key: 'category', header: 'Category' },
      { key: 'clientId', header: 'Client ID' },
      { key: 'market', header: 'Market' },
      { key: 'stall', header: 'Stall' },
      { key: 'licenceNo', header: 'Licence' },
      { key: 'registeredOn', header: 'Registered' },
      { key: 'expiresOn', header: 'Expires' },
      { key: 'status', header: 'Status' },
    ],
    filterKeys: ['category', 'status', 'market'],
    dateKey: 'expiresOn',
    build: (db) =>
      db.vendors.map((v) => ({
        id: v.id,
        tradeName: v.tradeName,
        name: v.fullName,
        category: statusLabel(v.category),
        clientId: v.clientId ?? '—',
        market: v.market,
        stall: v.stallId ?? 'Not allocated',
        licenceNo: v.licenceNo,
        registeredOn: v.registeredOn,
        expiresOn: v.expiresOn,
        status: statusLabel(v.registrationStatus),
      })),
  },
  {
    id: 'land',
    label: 'Land allocation applications',
    description: 'State land applications and their decisions.',
    permission: 'land.view',
    refs: ['xii.5', 'iv.2'],
    columns: [
      { key: 'id', header: 'Application' },
      { key: 'applicant', header: 'Applicant' },
      { key: 'clientId', header: 'Client ID' },
      { key: 'parcelRef', header: 'Parcel' },
      { key: 'district', header: 'District' },
      { key: 'areaHa', header: 'Area requested (ha)', align: 'right' },
      { key: 'purpose', header: 'Purpose' },
      { key: 'assessments', header: 'Assessments', align: 'right' },
      { key: 'status', header: 'Status' },
      { key: 'submittedOn', header: 'Submitted' },
    ],
    filterKeys: ['district', 'status', 'purpose'],
    dateKey: 'submittedOn',
    build: (db) =>
      db.landApplications.map((a) => ({
        id: a.id,
        applicant: clientName(db.clients.find((c) => c.id === a.clientId)),
        clientId: a.clientId,
        parcelRef: a.parcelRef,
        district: a.district,
        areaHa: a.requestedAreaHa,
        purpose: a.purpose,
        assessments: a.assessments.length,
        status: statusLabel(a.status),
        submittedOn: a.submittedOn,
      })),
  },
]

/** Distinct values for a column, for the facet dropdowns. */
export const distinctValues = (rows: ReportRow[], key: string): string[] =>
  [...new Set(rows.map((r) => String(r[key] ?? '')).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'en', { numeric: true }),
  )

export interface ReportFilterState {
  facets: Record<string, string>
  from: string
  to: string
  search: string
}

export function applyFilters(
  dataset: DatasetDef,
  rows: ReportRow[],
  state: ReportFilterState,
): ReportRow[] {
  const q = state.search.trim().toLowerCase()
  return rows.filter((row) => {
    for (const [key, value] of Object.entries(state.facets)) {
      if (value && String(row[key] ?? '') !== value) return false
    }
    if (dataset.dateKey) {
      const d = String(row[dataset.dateKey] ?? '')
      if (state.from && d && d < state.from) return false
      if (state.to && d && d > state.to) return false
    }
    if (!q) return true
    return Object.values(row).join(' ').toLowerCase().includes(q)
  })
}

/** Totals for the numeric columns, shown under the preview and in the export. */
export function summarise(dataset: DatasetDef, rows: ReportRow[]): string[] {
  const notes: string[] = [`${rows.length} records in this report.`]
  for (const col of dataset.columns) {
    if (col.align !== 'right') continue
    const values = rows.map((r) => Number(r[col.key])).filter((n) => Number.isFinite(n))
    if (values.length < 2) continue
    const total = values.reduce((a, b) => a + b, 0)
    const mean = total / values.length
    notes.push(
      `${col.header}: total ${total.toLocaleString('en-GB', { maximumFractionDigits: 2 })}, ` +
        `average ${mean.toLocaleString('en-GB', { maximumFractionDigits: 2 })}.`,
    )
  }
  return notes
}

/** Used by the dashboard's area summary. */
export const totalHectares = (db: AisDatabase): string =>
  formatHa(db.farms.filter((f) => f.status === 'registered').reduce((s, f) => s + f.sizeHa, 0))
