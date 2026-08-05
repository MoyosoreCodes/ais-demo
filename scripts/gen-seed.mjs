// Deterministic seed generator for the AIS demonstration prototype.
// Run:  node scripts/gen-seed.mjs   -> writes src/data/*.json
// Seeded RNG => identical output every run => "Reset Demo Data" restores the exact scripted state.
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'src', 'data')
mkdirSync(DATA, { recursive: true })

// ---- seeded RNG (mulberry32) --------------------------------------------
let s = 0x9e3779b9
const rnd = () => {
  s |= 0
  s = (s + 0x6d2b79f5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = (a) => a[Math.floor(rnd() * a.length)]
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))
const chance = (p) => rnd() < p
const pad = (n, w) => String(n).padStart(w, '0')

// fixed reference date so everything is reproducible (no Date.now at runtime)
const BASE = new Date('2026-07-15T09:00:00Z').getTime()
const DAY = 86400000
const daysAgo = (d) => new Date(BASE - d * DAY).toISOString()
const daysAhead = (d) => new Date(BASE + d * DAY).toISOString()

// ---- reference data ------------------------------------------------------
const DISTRICTS = [
  'Anse Boileau', 'Baie Lazare', 'Grand Anse Mahé', 'Anse Royale', 'Anse Aux Pins',
  'Takamaka', 'Port Glaud', 'Baie Ste Anne Praslin', 'Grand Anse Praslin', 'La Digue',
]
const CENTER = {
  'Anse Boileau': [-4.728, 55.485], 'Baie Lazare': [-4.748, 55.487],
  'Grand Anse Mahé': [-4.678, 55.462], 'Anse Royale': [-4.742, 55.514],
  'Anse Aux Pins': [-4.690, 55.514], 'Takamaka': [-4.769, 55.505],
  'Port Glaud': [-4.660, 55.423], 'Baie Ste Anne Praslin': [-4.353, 55.760],
  'Grand Anse Praslin': [-4.318, 55.708], 'La Digue': [-4.357, 55.837],
}
const CROPS = ['Banana', 'Cassava', 'Sweet potato', 'Chilli', 'Lettuce', 'Papaya', 'Breadfruit']
const LIVE = ['Broiler', 'Layer', 'Pig', 'Goat']
const FIRST = ['Marie', 'Jean', 'Danny', 'Roselyne', 'Bernard', 'Sylvia', 'Ronny', 'Nadege',
  'Terence', 'Cynthia', 'Vincent', 'Josephine', 'Gilbert', 'Marguerite', 'Christelle', 'Wilna',
  'Andy', 'Jenny', 'Kevin', 'Sabrina', 'Georges', 'Antoinette', 'Michel', 'Lucie', 'Patrick',
  'Chantal', 'Robert', 'Emmanuelle', 'Steve', 'Murielle', 'Brian', 'Yolande', 'Egbert', 'Doris']
const LAST = ['Hoareau', 'Payet', 'Rose', 'Servina', 'Confait', 'Adrienne', 'Bristol', 'Dugasse',
  'Larue', 'Morel', 'Nourrice', 'Pool', 'Quatre', 'Radegonde', 'Souffe', 'Vidot', 'Zialor',
  'Bonne', 'Camille', 'Esparon', 'Faure', 'Gappy', 'Julienne', 'Labrosse', 'Mancienne',
  'Nibourette', 'Onezime', 'Rassool', 'Sinon', 'Tirant', 'Uranie', 'Valentin']

const geo = (district) => {
  const [la, ln] = CENTER[district]
  return [ +(la + (rnd() - 0.5) * 0.02).toFixed(5), +(ln + (rnd() - 0.5) * 0.02).toFixed(5) ]
}
const nin = () => `999-${pad(int(0, 9999), 4)}-${int(1, 2)}-${int(1, 9)}-${pad(int(1, 12), 2)}`
const phone = () => `+248 2 000 0${pad(int(10, 99), 2)}`
const doc = (id, name, category, day, verified) => ({
  id, name, category, uploadedAt: daysAgo(day), verified, sizeKb: int(120, 2400), simulated: true,
})

// ---- users (one per role + demo logins) ----------------------------------
const users = [
  { id: 'USR-ADMIN', username: 'admin@demo', name: 'A. Melanie (Admin)', role: 'admin', active: true, phone: phone(), password: 'Demo2026!', twoFactor: true, lastLogin: daysAgo(0) },
  { id: 'USR-OFFICER', username: 'officer@demo', name: 'J. Payet', role: 'agriculture_officer', active: true, phone: phone(), password: 'Demo2026!', twoFactor: true, lastLogin: daysAgo(0) },
  { id: 'USR-FIELD', username: 'field@demo', name: 'R. Confait', role: 'field_officer', active: true, phone: phone(), password: 'Demo2026!', twoFactor: false, lastLogin: daysAgo(1) },
  { id: 'USR-LAB', username: 'lab@demo', name: 'S. Rose', role: 'lab_staff', active: true, phone: phone(), password: 'Demo2026!', twoFactor: false, lastLogin: daysAgo(1) },
  { id: 'USR-SUP', username: 'supervisor@demo', name: 'G. Vidot (Supervisor)', role: 'supervisor', active: true, phone: phone(), password: 'Demo2026!', twoFactor: true, lastLogin: daysAgo(2) },
  { id: 'USR-FARMER', username: 'farmer@demo', name: 'Marie-Ange Hoareau', role: 'farmer', active: true, phone: '+248 2 000 012', clientId: 'CLT-0001', password: 'Demo2026!', twoFactor: true, lastLogin: daysAgo(0) },
  { id: 'USR-OFFICER2', username: 'd.rose@demo', name: 'D. Servina', role: 'agriculture_officer', active: true, phone: phone(), password: 'Demo2026!', twoFactor: false, lastLogin: daysAgo(3) },
  { id: 'USR-FIELD2', username: 'k.bonne@demo', name: 'K. Bonne', role: 'field_officer', active: false, phone: phone(), password: 'Demo2026!', twoFactor: false },
]

// ---- clients -------------------------------------------------------------
const clients = []
// Fixed narrative record: Marie-Ange Hoareau
clients.push({
  id: 'CLT-0001', nin: '999-0412-1-1-07', firstName: 'Marie-Ange', lastName: 'Hoareau',
  gender: 'F', dob: '1988-04-12', phone: '+248 2 000 012', email: 'marieange.h@example.sc',
  address: 'Chemin Val d’Endor, Anse Boileau', district: 'Anse Boileau',
  stakeholderType: 'both', seyidVerified: true, status: 'active', source: 'self_service',
  createdAt: daysAgo(9), updatedAt: daysAgo(2),
  history: [
    { at: daysAgo(9), by: 'Self-service (SeyID)', field: 'record', from: '', to: 'created via SeyID self-registration' },
    { at: daysAgo(2), by: 'J. Payet', field: 'phone', from: '+248 2 000 011', to: '+248 2 000 012' },
  ],
})
// Legacy migrated near-duplicate of Marie-Ange (drives duplicate detection + merge on S02)
clients.push({
  id: 'CLT-0002', nin: '999-0412-1-1-07', firstName: 'Marieange', lastName: 'Hoareau',
  gender: 'F', dob: '1988-04-12', phone: '+248 2 000 012', email: 'm.hoareau@legacy.sc',
  address: 'Val d Endor, Anse Boileau', district: 'Anse Boileau',
  stakeholderType: 'farmer', seyidVerified: false, status: 'active', source: 'migrated',
  createdAt: daysAgo(300), updatedAt: daysAgo(300),
  history: [{ at: daysAgo(300), by: 'Data migration (2024 registry)', field: 'record', from: '', to: 'imported from legacy paper registry' }],
})
let phoneSeq = 13 // 012 is reserved for Marie-Ange; keep the rest unique so duplicate detection is meaningful
for (let i = 3; i <= 74; i++) {
  const d = pick(DISTRICTS)
  const f = pick(FIRST), l = pick(LAST)
  const created = int(5, 340)
  clients.push({
    id: `CLT-${pad(i, 4)}`, nin: nin(), firstName: f, lastName: l,
    gender: chance(0.5) ? 'F' : 'M', dob: `19${int(55, 99)}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`,
    phone: `+248 2 000 0${pad(phoneSeq++, 2)}`, email: `${f.toLowerCase()}.${l.toLowerCase()}@example.sc`,
    address: `${pick(['Chemin', 'La Route', 'Mont', 'Val'])} ${pick(LAST)}, ${d}`, district: d,
    stakeholderType: chance(0.2) ? 'vendor' : chance(0.15) ? 'both' : 'farmer',
    seyidVerified: chance(0.6), status: 'active', source: chance(0.35) ? 'migrated' : chance(0.4) ? 'officer' : 'self_service',
    createdAt: daysAgo(created), updatedAt: daysAgo(int(0, created)),
    history: [{ at: daysAgo(created), by: 'Registration', field: 'record', from: '', to: 'created' }],
  })
}

// ---- farms ---------------------------------------------------------------
const farms = []
let farmSeq = 0
const nextFarmId = () => `FRM-2026-${pad(++farmSeq, 5)}`
// Marie-Ange's farm (fixed)
farms.push({
  id: nextFarmId(), clientId: 'CLT-0001', name: 'Rivière Doux Farm', district: 'Anse Boileau',
  lat: -4.7291, lng: 55.4863, sizeHa: 1.6, tenure: 'leased', crops: ['Banana'], livestock: ['Broiler'],
  docs: [doc('D-F1', 'Lease agreement 2019.pdf', 'lease', 8, true), doc('D-F2', 'ID card.jpg', 'id', 8, true)],
  verificationStatus: 'verified', status: 'active', source: 'officer', createdAt: daysAgo(8),
})
// Legacy migrated duplicate farm near her GPS (drives S03 duplicate warning)
farms.push({
  id: nextFarmId(), clientId: 'CLT-0002', name: 'Riviere Doux (legacy)', district: 'Anse Boileau',
  lat: -4.7292, lng: 55.4861, sizeHa: 1.6, tenure: 'leased', crops: ['Banana'], livestock: [],
  docs: [], verificationStatus: 'pending', status: 'active', source: 'migrated', createdAt: daysAgo(300),
})
// clients that are farmers get 1 farm each (cap ~60)
for (const c of clients) {
  if (c.id === 'CLT-0001' || c.id === 'CLT-0002') continue
  if (c.stakeholderType === 'vendor') continue
  if (farms.length >= 62) break
  const [la, ln] = geo(c.district)
  const created = int(3, 320)
  farms.push({
    id: nextFarmId(), clientId: c.id, name: `${pick(['Anse', 'Mont', 'Val', 'Beau', 'Grand'])} ${pick(LAST)} Farm`,
    district: c.district, lat: la, lng: ln, sizeHa: +(0.3 + rnd() * 4.5).toFixed(2),
    tenure: pick(['owned', 'leased', 'state_land', 'family']),
    crops: Array.from(new Set(Array.from({ length: int(1, 3) }, () => pick(CROPS)))),
    livestock: chance(0.5) ? Array.from(new Set(Array.from({ length: int(1, 2) }, () => pick(LIVE)))) : [],
    docs: chance(0.7) ? [doc(`D-${farmSeq}`, 'Supporting document.pdf', pick(['lease', 'permit', 'id']), int(1, created), chance(0.7))] : [],
    verificationStatus: pick(['verified', 'verified', 'pending', 'rejected']),
    status: 'active', source: pick(['online', 'officer', 'migrated']), createdAt: daysAgo(created),
  })
}
const farmerFarms = farms.filter((f) => f.clientId !== 'CLT-0002')

// ---- workflows (metadata-driven, admin-configurable on S11) ---------------
const workflows = [
  { id: 'loan', name: 'Loan Approval', stages: [
    { id: 'assessment', name: 'Technical Assessment', actorRole: 'agriculture_officer', order: 1 },
    { id: 'committee', name: 'Loan Committee', actorRole: 'supervisor', order: 2 },
  ] },
  { id: 'land', name: 'Land Allocation', stages: [
    { id: 'review', name: 'Application Review', actorRole: 'agriculture_officer', order: 1 },
    { id: 'decision', name: 'Allocation Decision', actorRole: 'supervisor', order: 2 },
  ] },
]

// ---- loans ---------------------------------------------------------------
const loans = []
let loanSeq = 0
const nextLoanId = () => `LN-2026-${pad(++loanSeq, 3)}`
// Marie-Ange's poultry-house loan (fixed, mid-workflow at assessment)
loans.push({
  id: nextLoanId(), clientId: 'CLT-0001', farmId: 'FRM-2026-00001', purpose: 'Poultry house construction (broiler)',
  amountSCR: 85000, termMonths: 36, status: 'assessment', currentStageId: 'assessment',
  docs: [doc('D-L1', 'Quotation - poultry house.pdf', 'report', 4, true), doc('D-L2', 'Farm lease.pdf', 'lease', 4, true)],
  history: [
    { at: daysAgo(4), by: 'Marie-Ange Hoareau', action: 'Submitted application', fromStatus: 'draft', toStatus: 'submitted' },
    { at: daysAgo(3), by: 'J. Payet', action: 'Moved to technical assessment', fromStatus: 'submitted', toStatus: 'assessment' },
  ],
  createdAt: daysAgo(4), updatedAt: daysAgo(3),
})
const loanPurposes = ['Drip irrigation kit', 'Greenhouse tunnel', 'Layer cages', 'Piggery expansion',
  'Cassava processing', 'Cold storage unit', 'Tractor implement', 'Banana sucker stock', 'Fencing & security']
for (let i = 0; i < 24; i++) {
  const f = pick(farmerFarms)
  const status = pick(['submitted', 'assessment', 'assessment', 'committee', 'approved', 'approved', 'disbursed', 'rejected'])
  const stage = status === 'assessment' ? 'assessment' : status === 'committee' ? 'committee' : status === 'submitted' ? 'assessment' : 'done'
  const created = int(2, 200)
  loans.push({
    id: nextLoanId(), clientId: f.clientId, farmId: f.id, purpose: pick(loanPurposes),
    amountSCR: int(8, 240) * 1000, termMonths: pick([12, 24, 36, 48]), status, currentStageId: stage,
    docs: [doc(`D-L${i + 3}`, 'Quotation.pdf', 'report', created, chance(0.8))],
    history: [{ at: daysAgo(created), by: 'Applicant', action: 'Submitted application', fromStatus: 'draft', toStatus: 'submitted' }],
    createdAt: daysAgo(created), updatedAt: daysAgo(int(0, created)),
  })
}

// ---- samples -------------------------------------------------------------
const samples = []
let smpSeq = 0
const nextSmpId = () => `SMP-2026-${pad(++smpSeq, 3)}`
const soilResults = () => ([
  { name: 'pH', value: (5 + rnd() * 3).toFixed(1), unit: '', reference: '6.0 - 7.0' },
  { name: 'Nitrogen (N)', value: (0.1 + rnd()).toFixed(2), unit: '%', reference: '> 0.2' },
  { name: 'Phosphorus (P)', value: int(5, 40) + '', unit: 'ppm', reference: '15 - 30' },
  { name: 'Organic matter', value: (1 + rnd() * 4).toFixed(1), unit: '%', reference: '> 3.0' },
])
// Marie-Ange's soil test (fixed, in testing -> demo completes it)
samples.push({
  id: nextSmpId(), clientId: 'CLT-0001', farmId: 'FRM-2026-00001', type: 'soil', status: 'testing',
  requestedBy: 'farmer', assignedTo: 'USR-LAB', requestedAt: daysAgo(3), collectedAt: daysAgo(2),
  results: [], resultSummary: '', notified: false,
})
for (let i = 0; i < 29; i++) {
  const f = pick(farmerFarms)
  const type = pick(['soil', 'soil', 'water', 'plant', 'compost'])
  const status = pick(['collected', 'registered', 'testing', 'completed', 'completed'])
  const req = int(2, 180)
  const done = status === 'completed'
  samples.push({
    id: nextSmpId(), clientId: f.clientId, farmId: f.id, type, status,
    requestedBy: chance(0.5) ? 'farmer' : 'officer', assignedTo: 'USR-LAB',
    requestedAt: daysAgo(req), collectedAt: status === 'collected' ? undefined : daysAgo(req - 1),
    completedAt: done ? daysAgo(int(0, req - 2 < 1 ? 1 : req - 2)) : undefined,
    results: done && type === 'soil' ? soilResults() : done ? [{ name: 'Result', value: pick(['Within range', 'Elevated', 'Trace detected']), unit: '', reference: '' }] : [],
    resultSummary: done ? pick(['Suitable for cultivation', 'Amend with lime', 'Monitor nitrogen levels']) : '',
    notified: done && chance(0.7),
  })
}

// ---- livestock visits ----------------------------------------------------
const livestockVisits = []
let lvSeq = 0
const nextLv = () => `LV-2026-${pad(++lvSeq, 3)}`
livestockVisits.push({
  id: nextLv(), clientId: 'CLT-0001', farmId: 'FRM-2026-00001', kind: 'routine', species: 'Broiler',
  status: 'completed', assignedTo: 'USR-OFFICER', observations: 'Flock of 120 broilers, week 4. Housing clean, water clean.',
  findings: 'Healthy. Advised vaccination schedule.', date: daysAgo(2),
})
for (let i = 0; i < 19; i++) {
  const f = pick(farmerFarms.filter((x) => x.livestock.length))
  if (!f) continue
  const kind = chance(0.4) ? 'complaint' : 'routine'
  livestockVisits.push({
    id: nextLv(), clientId: f.clientId, farmId: f.id, species: pick(f.livestock),
    kind, status: kind === 'complaint' ? pick(['reported', 'assigned', 'in_progress', 'resolved']) : pick(['completed', 'completed', 'assigned']),
    assignedTo: pick(['USR-OFFICER', 'USR-OFFICER2', 'USR-FIELD']),
    observations: pick(['Reduced feed intake', 'Routine health check', 'Lameness reported', 'Egg drop observed']),
    findings: pick(['No pathology found', 'Nutritional advice given', 'Treated for parasites', 'Referred to lab']),
    date: daysAgo(int(1, 160)),
  })
}

// ---- surveillance --------------------------------------------------------
const surveillanceCases = []
let svSeq = 0
const nextSv = () => `SV-2026-${pad(++svSeq, 3)}`
surveillanceCases.push({
  id: nextSv(), clientId: 'CLT-0001', farmId: 'FRM-2026-00001', suspectedDisease: 'Newcastle disease',
  species: 'Broiler', status: 'investigating', assignedTo: 'USR-OFFICER', linkedSampleId: 'SMP-2026-001',
  reportedAt: daysAgo(1),
  history: [
    { at: daysAgo(1), by: 'Marie-Ange Hoareau', action: 'Reported suspected case', fromStatus: '', toStatus: 'reported' },
    { at: daysAgo(1), by: 'J. Payet', action: 'Assigned & sampling requested', fromStatus: 'reported', toStatus: 'investigating' },
  ],
})
const diseases = ['Newcastle disease', 'Avian influenza (suspected)', 'African swine fever (suspected)', 'Foot rot', 'Coccidiosis']
for (let i = 0; i < 7; i++) {
  const f = pick(farmerFarms.filter((x) => x.livestock.length))
  if (!f) continue
  const st = pick(['reported', 'assigned', 'investigating', 'ruled_out', 'closed'])
  surveillanceCases.push({
    id: nextSv(), clientId: f.clientId, farmId: f.id, suspectedDisease: pick(diseases),
    species: pick(f.livestock), status: st, assignedTo: pick(['USR-OFFICER', 'USR-OFFICER2']),
    reportedAt: daysAgo(int(2, 150)),
    history: [{ at: daysAgo(int(2, 150)), by: 'Reporter', action: 'Reported suspected case', fromStatus: '', toStatus: 'reported' }],
  })
}

// ---- vendors & Victoria Market stalls ------------------------------------
const stalls = []
const sections = ['A', 'B', 'C', 'D']
for (const sec of sections) for (let n = 1; n <= 8; n++) stalls.push({ id: `ST-${sec}${pad(n, 2)}`, section: sec, number: n, status: 'vacant' })
const vendors = []
let vdSeq = 0
const nextVd = () => `VD-2026-${pad(++vdSeq, 3)}`
// Marie-Ange gets a produce stall (fixed)
const maStall = stalls[0]
maStall.status = 'allocated'
vendors.push({
  id: nextVd(), clientId: 'CLT-0001', name: 'Marie-Ange Hoareau', traderType: 'produce',
  phone: '+248 2 000 012', district: 'Anse Boileau', stallId: maStall.id, registrationStatus: 'active', registeredAt: daysAgo(1),
})
maStall.vendorId = vendors[0].id
const vendorClients = clients.filter((c) => c.stakeholderType === 'vendor' || c.stakeholderType === 'both').slice(0, 14)
for (const c of vendorClients) {
  const allocate = chance(0.6)
  const free = stalls.find((s) => s.status === 'vacant')
  const v = {
    id: nextVd(), clientId: c.id, name: `${c.firstName} ${c.lastName}`,
    traderType: pick(['produce', 'livestock', 'processed', 'mixed']), phone: c.phone, district: c.district,
    stallId: allocate && free ? free.id : undefined,
    registrationStatus: pick(['active', 'active', 'pending', 'expired', 'suspended']), registeredAt: daysAgo(int(5, 220)),
  }
  if (allocate && free) { free.status = 'allocated'; free.vendorId = v.id }
  vendors.push(v)
}

// ---- inspections ---------------------------------------------------------
const inspections = []
let insSeq = 0
const nextIns = () => `INS-2026-${pad(++insSeq, 3)}`
inspections.push({
  id: nextIns(), farmId: 'FRM-2026-00001', clientId: 'CLT-0001', type: 'farm', scheduledFor: daysAhead(1),
  assignedTo: 'USR-FIELD', status: 'scheduled', findings: '', photos: [], capturedOffline: false,
})
for (let i = 0; i < 15; i++) {
  const f = pick(farmerFarms)
  const st = pick(['scheduled', 'completed', 'completed', 'in_progress', 'pending_sync'])
  const done = st === 'completed' || st === 'pending_sync'
  inspections.push({
    id: nextIns(), farmId: f.id, clientId: f.clientId, type: pick(['farm', 'land', 'compliance']),
    scheduledFor: st === 'scheduled' ? daysAhead(int(1, 20)) : daysAgo(int(1, 120)),
    assignedTo: pick(['USR-FIELD', 'USR-FIELD2', 'USR-OFFICER']), status: st,
    findings: done ? pick(['Compliant with permit conditions', 'Minor irrigation issue noted', 'Boundary matches lease', 'Follow-up required']) : '',
    photos: done ? [doc(`P-${i}`, 'field-photo-1.jpg', 'report', int(1, 30), true)] : [],
    capturedOffline: st === 'pending_sync' || (done && chance(0.3)),
    completedAt: done ? daysAgo(int(0, 30)) : undefined,
  })
}

// ---- digitized documents -------------------------------------------------
const documents = []
let dcSeq = 0
const nextDc = () => `DOC-2026-${pad(++dcSeq, 3)}`
documents.push({
  id: nextDc(), title: 'Lease agreement — Rivière Doux (2019)', category: 'lease', clientId: 'CLT-0001',
  farmId: 'FRM-2026-00001', tags: ['lease', 'Anse Boileau', 'Hoareau', '2019'],
  fullText: 'STATE LAND LEASE AGREEMENT between the Department of Agriculture and Marie-Ange Hoareau for parcel at Val d Endor, Anse Boileau, area 1.6 hectares, term 15 years from 2019, purpose agriculture (banana and poultry).',
  year: 2019, source: 'migrated', addedAt: daysAgo(6),
})
const docTitles = [
  ['Farm permit — poultry', 'permit'], ['National ID scan', 'id'], ['Soil survey report 2021', 'report'],
  ['Correspondence — irrigation request', 'correspondence'], ['Parcel sketch map', 'map'],
  ['Lease renewal notice', 'lease'], ['Livestock movement permit', 'permit'], ['Inspection report 2022', 'report'],
  ['Loan disbursement letter', 'correspondence'], ['Land allocation certificate', 'permit'],
  ['Water sampling report', 'report'], ['Vendor registration form', 'correspondence'],
  ['Boundary survey', 'map'], ['Old paper registry card', 'id'],
]
for (const [title, cat] of docTitles) {
  const c = pick(clients)
  documents.push({
    id: nextDc(), title, category: cat, clientId: c.id,
    tags: [cat, c.district, c.lastName], fullText: `${title} for ${c.firstName} ${c.lastName}, ${c.district}. Migrated from paper archive.`,
    year: int(2015, 2024), source: chance(0.7) ? 'migrated' : 'uploaded', addedAt: daysAgo(int(3, 120)),
  })
}

// ---- notifications -------------------------------------------------------
const notifications = []
let ntSeq = 0
const nextNt = () => `NT-${pad(++ntSeq, 4)}`
const pushNt = (channel, to, clientId, subject, body, template, event, day, status = 'sent') =>
  notifications.push({ id: nextNt(), channel, to, clientId, subject, body, template, event, status, simulated: true, createdAt: daysAgo(day) })
pushNt('sms', '+248 2 000 012', 'CLT-0001', 'AIS: application received', 'Your loan application LN-2026-001 has been received and is under assessment.', 'loan_status', 'loan.submitted', 4)
pushNt('email', 'marieange.h@example.sc', 'CLT-0001', 'Loan under assessment', 'Application LN-2026-001 moved to Technical Assessment.', 'loan_status', 'loan.assessment', 3)
pushNt('sms', '+248 2 000 012', 'CLT-0001', 'AIS: surveillance case logged', 'Suspected Newcastle case SV-2026-001 logged; an officer will visit.', 'surveillance', 'surveillance.reported', 1, 'read')
for (let i = 0; i < 16; i++) {
  const c = pick(clients)
  pushNt(pick(['sms', 'email', 'in_app']), c.phone, c.id, pick(['Lab result ready', 'Application update', 'Lease reminder', 'Inspection scheduled']),
    'Status update from the Agriculture Information System.', pick(['lab_result', 'loan_status', 'lease_reminder', 'inspection']),
    pick(['lab.completed', 'loan.approved', 'lease.expiry', 'inspection.scheduled']), int(1, 90), pick(['sent', 'sent', 'read', 'queued']))
}

// ---- audit ---------------------------------------------------------------
const audit = []
let auSeq = 0
const nextAu = () => `AUD-${pad(++auSeq, 4)}`
const pushAu = (actor, actorRole, action, category, detail, day, entity, entityId) =>
  audit.push({ id: nextAu(), at: daysAgo(day), actor, actorRole, action, category, detail, entity, entityId })
pushAu('J. Payet', 'agriculture_officer', 'login', 'auth', 'Successful login (2FA)', 0)
pushAu('J. Payet', 'agriculture_officer', 'loan.stage_advance', 'workflow', 'LN-2026-001 submitted -> assessment', 3, 'loan', 'LN-2026-001')
pushAu('A. Melanie (Admin)', 'admin', 'user.create', 'admin', 'Created field officer account K. Bonne', 40, 'user', 'USR-FIELD2')
pushAu('A. Melanie (Admin)', 'admin', 'user.deactivate', 'admin', 'Deactivated K. Bonne', 10, 'user', 'USR-FIELD2')
pushAu('S. Rose', 'lab_staff', 'sample.register', 'data', 'Registered soil sample SMP-2026-001', 2, 'sample', 'SMP-2026-001')
pushAu('Marie-Ange Hoareau', 'farmer', 'login', 'auth', 'Successful login (SeyID simulated)', 0)
pushAu('system', 'system', 'auth.lockout', 'auth', 'Account temporarily locked after 5 failed attempts (demo)', 5)
for (let i = 0; i < 22; i++) {
  const u = pick(users)
  pushAu(u.name, u.role, pick(['login', 'record.view', 'record.update', 'report.export', 'workflow.action']),
    pick(['auth', 'data', 'workflow', 'admin']), 'Routine activity captured in audit log', int(1, 120))
}

// ---- write ---------------------------------------------------------------
const files = {
  users, clients, farms, loans, samples, livestockVisits, surveillanceCases,
  vendors, stalls, inspections, documents, notifications, workflows, audit,
}
for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(DATA, `${name}.json`), JSON.stringify(data, null, 2))
}
const counts = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length]))
console.log('Seed written to src/data:', JSON.stringify(counts))
