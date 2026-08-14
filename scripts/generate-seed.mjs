/**
 * Deterministic seed generator for the AIS demonstration prototype.
 *
 *   node scripts/generate-seed.mjs
 *
 * Writes src/data/*.json. Everything is derived from a fixed PRNG seed so the
 * same records come out every run — that is what makes "Reset Demo Data"
 * restore the exact scripted state (CLAUDE.md §10).
 *
 * HONESTY / DATA RULES (CLAUDE.md §2):
 *   - Every person is invented. No real individual is represented.
 *   - Every NIN carries the obviously fake `999-` prefix.
 *   - Every phone number is of the form +248 2 000 0xx.
 *   - Document "scans" are generated placeholders, not real documents.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { createHash, pbkdf2Sync, randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'src', 'data')
mkdirSync(OUT, { recursive: true })

/* ------------------------------------------------------------------ *
 * Deterministic PRNG
 * ------------------------------------------------------------------ */

function mulberry32(a) {
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(20260401)

const rand = (min, max) => min + rng() * (max - min)
const randInt = (min, max) => Math.floor(rand(min, max + 1))
const pick = (arr) => arr[randInt(0, arr.length - 1)]
const pickSome = (arr, min, max) => {
  const n = randInt(min, max)
  const pool = [...arr]
  const out = []
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(randInt(0, pool.length - 1), 1)[0])
  return out
}
const chance = (p) => rng() < p
const round = (n, dp = 2) => Number(n.toFixed(dp))
const pad = (n, w) => String(n).padStart(w, '0')

/* ------------------------------------------------------------------ *
 * Calendar helpers — the demo "today" is fixed so the story never drifts
 * ------------------------------------------------------------------ */

const TODAY = new Date('2026-04-01T08:00:00.000Z')
const iso = (d) => d.toISOString()
const day = (d) => d.toISOString().slice(0, 10)
const addDays = (d, n) => new Date(d.getTime() + n * 86400000)
const daysAgo = (n) => addDays(TODAY, -n)
const atHour = (d, h, m = 0) => {
  const c = new Date(d)
  c.setUTCHours(h, m, 0, 0)
  return c
}

/* ------------------------------------------------------------------ *
 * Reference data
 * ------------------------------------------------------------------ */

const DISTRICTS = [
  { name: 'Anse Boileau', island: 'Mahé', lat: -4.7185, lng: 55.4872, jitter: 0.0042 },
  { name: 'Baie Lazare', island: 'Mahé', lat: -4.7455, lng: 55.4905, jitter: 0.0038 },
  { name: 'Grand Anse Mahé', island: 'Mahé', lat: -4.6775, lng: 55.464, jitter: 0.004 },
  { name: 'Anse Royale', island: 'Mahé', lat: -4.748, lng: 55.508, jitter: 0.004 },
  { name: 'Anse Aux Pins', island: 'Mahé', lat: -4.689, lng: 55.511, jitter: 0.004 },
  { name: 'Baie Ste Anne Praslin', island: 'Praslin', lat: -4.323, lng: 55.748, jitter: 0.005 },
  { name: 'La Digue', island: 'La Digue', lat: -4.358, lng: 55.834, jitter: 0.0035 },
]
const districtByName = Object.fromEntries(DISTRICTS.map((d) => [d.name, d]))

const CROPS = ['banana', 'cassava', 'sweet potato', 'chilli', 'lettuce', 'papaya', 'breadfruit']
const LIVESTOCK = ['broiler', 'layer', 'pig', 'goat']
const TENURES = ['owned', 'leased-state', 'leased-private', 'family']
const WATER = ['rainwater', 'borehole', 'river', 'mains', 'none']

// Invented individuals. Given names and surnames are drawn from the
// French/Creole/Anglophone naming conventions common in Seychelles so the
// registry reads plausibly; the combinations are fictional.
const GIVEN_F = [
  'Marie-Ange','Nadege','Sylvianne','Jeanine','Marielle','Clarisse','Dominique','Anne-Marie',
  'Genevieve','Rosita','Bernadette','Lucienne','Marguerite','Yolande','Simone','Odette',
  'Christiane','Vivianne','Josianne','Lisette','Therese','Angeline','Marthe','Celine',
]
const GIVEN_M = [
  'Jean-Claude','Bernard','Antoine','Gerard','Michel','Placide','Emmanuel','Raymond',
  'Fabien','Terence','Wilfred','Norbert','Damien','Clement','Roland','Hubert',
  'Sylvain','Maxime','Egbert','Cyril','Lucien','Barnabe','Alcide','Ferdinand',
]
const SURNAMES = [
  'Hoareau','Payet','Confait','Adrienne','Dogley','Rassool','Bonnelame','Larue',
  'Servina','Vidot','Belmont','Melanie','Quatre','Nourrice','Pillay','Esparon',
  'Rosalie','Freminot','Labiche','Marengo','Sinon','Zialor','Bristol','Camille',
  'Denousse','Fanchette','Gappy','Hollanda','Isaac','Julienne','Kilindo','Lespoir',
]

/* ------------------------------------------------------------------ *
 * Unique-value allocators
 * ------------------------------------------------------------------ */

let phoneSeq = 10
const nextPhone = () => {
  if (phoneSeq > 99) throw new Error('Exhausted the +248 2 000 0xx range')
  return `+248 2 000 0${pad(phoneSeq++, 2)}`
}

const usedNin = new Set()
/** Fictional NIN: 999-DDMM-S-C-YY. The 999- prefix marks it as non-real. */
const makeNin = (birth, gender) => {
  for (;;) {
    const dd = pad(randInt(1, 28), 2)
    const mm = pad(randInt(1, 12), 2)
    const s = gender === 'F' ? 1 : 2
    const c = randInt(1, 9)
    const yy = pad(Number(birth.slice(2, 4)), 2)
    const nin = `999-${dd}${mm}-${s}-${c}-${yy}`
    if (!usedNin.has(nin)) {
      usedNin.add(nin)
      return nin
    }
  }
}

const usedNames = new Set()
const makeName = (gender) => {
  for (;;) {
    const first = pick(gender === 'F' ? GIVEN_F : GIVEN_M)
    const last = pick(SURNAMES)
    const key = `${first} ${last}`
    if (!usedNames.has(key)) {
      usedNames.add(key)
      return { firstName: first, lastName: last }
    }
  }
}

const slugEmail = (first, last, n) =>
  `${first.toLowerCase().replace(/[^a-z]/g, '')}.${last.toLowerCase()}${n}@example.sc`

const jitterPin = (d) => ({
  lat: round(d.lat + rand(-d.jitter, d.jitter), 5),
  lng: round(d.lng + rand(-d.jitter, d.jitter), 5),
})

const hist = (id, at, actorUserId, actorName, action, extra = {}) => ({
  id,
  at: iso(at),
  actorUserId,
  actorName,
  action,
  ...extra,
})

/* ------------------------------------------------------------------ *
 * Module i — users
 * ------------------------------------------------------------------ */

const DEMO_PASSWORD = 'Demo2026!'
const PBKDF2_ITERATIONS = 120000

/** Salted PBKDF2-SHA256. The prototype never stores a password in clear (i.1). */
function hashPassword(password, salt) {
  return pbkdf2Sync(password, Buffer.from(salt, 'hex'), PBKDF2_ITERATIONS, 32, 'sha256').toString('hex')
}

const USER_SPECS = [
  { id: 'USR-001', email: 'admin@demo', fullName: 'A. Vidot', role: 'admin' },
  { id: 'USR-002', email: 'officer@demo', fullName: 'J. Payet', role: 'agriculture_officer' },
  { id: 'USR-003', email: 'field@demo', fullName: 'R. Confait', role: 'field_officer' },
  { id: 'USR-004', email: 'lab@demo', fullName: 'S. Dogley', role: 'lab_staff' },
  { id: 'USR-005', email: 'supervisor@demo', fullName: 'B. Adrienne', role: 'supervisor' },
  { id: 'USR-006', email: 'farmer@demo', fullName: 'Marie-Ange Hoareau', role: 'farmer', clientId: 'CLT-2026-0001' },
  { id: 'USR-007', email: 'officer2@demo', fullName: 'N. Servina', role: 'agriculture_officer' },
  { id: 'USR-008', email: 'field2@demo', fullName: 'T. Larue', role: 'field_officer' },
]

const users = USER_SPECS.map((u, i) => {
  const salt = randomBytes(16).toString('hex')
  return {
    ...u,
    status: 'active',
    createdOn: day(daysAgo(420 - i * 9)),
    lastLoginOn: iso(atHour(daysAgo(randInt(0, 3)), randInt(7, 16), randInt(0, 59))),
    phone: nextPhone(),
    salt,
    passwordHash: hashPassword(DEMO_PASSWORD, salt),
    iterations: PBKDF2_ITERATIONS,
    twoFactor: {
      enabled: u.role === 'admin' || u.role === 'supervisor',
      channel: u.role === 'admin' ? 'totp' : 'sms',
      simulated: true,
    },
    seyIdLinked: u.role === 'farmer',
    failedLoginCount: 0,
    mustResetPassword: false,
  }
})
const userName = (id) => users.find((u) => u.id === id)?.fullName ?? 'System'
const OFFICER = 'USR-002'
const FIELD = 'USR-003'
const LAB = 'USR-004'
const SUPERVISOR = 'USR-005'
const ADMIN = 'USR-001'

/* ------------------------------------------------------------------ *
 * Module ii — clients
 * ------------------------------------------------------------------ */

const clients = []

/* --- The story's protagonist (CLAUDE.md §4) ----------------------- */
const MARIE = {
  id: 'CLT-2026-0001',
  nin: '999-0412-1-1-07',
  firstName: 'Marie-Ange',
  lastName: 'Hoareau',
  gender: 'F',
  dateOfBirth: '1987-04-12',
  phone: '+248 2 000 001',
  email: 'marie-ange.hoareau@example.sc',
  district: 'Anse Boileau',
  island: 'Mahé',
  address: 'Chemin Rivière Doux, Anse Boileau, Mahé',
  stakeholderType: 'farmer',
  status: 'active',
  registeredOn: day(daysAgo(58)),
  registeredVia: 'self-service',
  seyIdVerified: true,
  notes: 'Self-registered via the online portal; identity confirmed against SeyID (simulated).',
  history: [
    hist('CH-M-1', atHour(daysAgo(58), 9, 12), 'SELF', 'Marie-Ange Hoareau', 'Self-registered via online portal'),
    hist('CH-M-2', atHour(daysAgo(58), 9, 13), 'SELF', 'Marie-Ange Hoareau', 'Identity verified via SeyID (simulated)', {
      field: 'seyIdVerified', from: 'false', to: 'true',
    }),
    hist('CH-M-3', atHour(daysAgo(51), 11, 40), OFFICER, userName(OFFICER), 'Contact number updated', {
      field: 'phone', from: '+248 2 000 099', to: '+248 2 000 001',
      note: 'Corrected at counter — farmer presented handset.',
    }),
  ],
}
usedNames.add('Marie-Ange Hoareau')
usedNin.add(MARIE.nin)
clients.push(MARIE)

/* --- Her legacy duplicate: the migrated 2019 paper record (ii.7) --- */
const MARIE_DUP = {
  id: 'CLT-2019-0311',
  nin: '999-0412-1-1-07',
  firstName: 'Marie Ange',
  lastName: 'Hoareau',
  gender: 'F',
  dateOfBirth: '1987-04-12',
  phone: '+248 2 000 099',
  email: '',
  district: 'Anse Boileau',
  island: 'Mahé',
  address: 'Riviere Doux, Anse Boileau',
  stakeholderType: 'farmer',
  status: 'active',
  registeredOn: '2019-06-14',
  registeredVia: 'migrated',
  seyIdVerified: false,
  notes: 'Migrated from the 2019 paper smallholder register (batch MIG-2019-A). Unverified contact details.',
  history: [
    hist('CH-D-1', new Date('2019-06-14T10:00:00Z'), 'MIGRATION', 'Data migration (batch MIG-2019-A)', 'Record migrated from paper register'),
  ],
}
clients.push(MARIE_DUP)

/* --- The rest of the national registry ---------------------------- */
const TARGET_CLIENTS = 72
for (let i = clients.length; i < TARGET_CLIENTS; i++) {
  const seq = i + 1
  const gender = chance(0.46) ? 'F' : 'M'
  const { firstName, lastName } = makeName(gender)
  const d = pick(DISTRICTS)
  const birthYear = randInt(1955, 1998)
  const dateOfBirth = `${birthYear}-${pad(randInt(1, 12), 2)}-${pad(randInt(1, 28), 2)}`
  const migrated = chance(0.34)
  const via = migrated ? 'migrated' : chance(0.45) ? 'self-service' : 'officer-assisted'
  const registeredOn = migrated
    ? day(new Date(`${randInt(2016, 2021)}-${pad(randInt(1, 12), 2)}-${pad(randInt(1, 28), 2)}`))
    : day(daysAgo(randInt(20, 900)))
  const id = migrated ? `CLT-${registeredOn.slice(0, 4)}-${pad(200 + seq, 4)}` : `CLT-2026-${pad(seq, 4)}`
  const seyId = !migrated && chance(0.72)

  clients.push({
    id,
    nin: makeNin(dateOfBirth, gender),
    firstName,
    lastName,
    gender,
    dateOfBirth,
    phone: nextPhone(),
    email: chance(migrated ? 0.35 : 0.9) ? slugEmail(firstName, lastName, seq) : '',
    district: d.name,
    island: d.island,
    address: `${pick(['Chemin', 'Route', 'La Route', 'Sentier'])} ${pick(['Cascade', 'Montagne Posée', 'Val d’Endor', 'Les Canelles', 'Barbarons', 'Fond Ferdinand', 'Anse Kerlan', 'Belle Vue'])}, ${d.name}, ${d.island}`,
    stakeholderType: chance(0.06) ? 'cooperative' : 'farmer',
    status: 'active',
    registeredOn,
    registeredVia: via,
    seyIdVerified: seyId,
    notes: migrated ? 'Migrated from legacy paper register.' : '',
    history: [
      hist(
        `CH-${id}-1`,
        new Date(`${registeredOn}T09:00:00Z`),
        migrated ? 'MIGRATION' : via === 'self-service' ? 'SELF' : OFFICER,
        migrated ? 'Data migration' : via === 'self-service' ? `${firstName} ${lastName}` : userName(OFFICER),
        migrated ? 'Record migrated from paper register' : via === 'self-service' ? 'Self-registered via online portal' : 'Registered by officer at district office',
      ),
    ],
  })
}

const farmerClients = clients.filter((c) => c.status === 'active')

/* ------------------------------------------------------------------ *
 * Module iii — farms
 * ------------------------------------------------------------------ */

const farms = []

const MARIE_FARM = {
  id: 'FRM-2026-00001',
  clientId: MARIE.id,
  name: 'Rivière Doux Farm',
  district: 'Anse Boileau',
  island: 'Mahé',
  lat: -4.71924,
  lng: 55.48693,
  parcelRef: 'PR/AB/1042',
  sizeHa: 1.6,
  tenure: 'leased-state',
  crops: ['banana'],
  livestock: [{ type: 'broiler', headcount: 240 }],
  waterSource: 'river',
  status: 'registered',
  registeredOn: day(daysAgo(54)),
  registeredVia: 'back-office',
  documents: [
    {
      id: 'DOCREF-F1-1', name: 'Lease agreement PR-AB-1042.pdf', category: 'Tenure evidence',
      sizeKb: 412, uploadedOn: day(daysAgo(54)), uploadedBy: OFFICER,
      verification: 'verified', verifiedBy: SUPERVISOR, verifiedOn: day(daysAgo(52)), simulated: true,
    },
    {
      id: 'DOCREF-F1-2', name: 'Parcel sketch plan.jpg', category: 'Site plan',
      sizeKb: 986, uploadedOn: day(daysAgo(54)), uploadedBy: OFFICER,
      verification: 'verified', verifiedBy: SUPERVISOR, verifiedOn: day(daysAgo(52)), simulated: true,
    },
  ],
  history: [
    hist('CH-F1-1', atHour(daysAgo(54), 10, 20), OFFICER, userName(OFFICER), 'Farm registered (back-office intake)'),
    hist('CH-F1-2', atHour(daysAgo(54), 10, 21), OFFICER, userName(OFFICER), 'GPS location captured from map pin', {
      field: 'gps', to: '-4.71924, 55.48693',
    }),
    hist('CH-F1-3', atHour(daysAgo(54), 10, 26), OFFICER, userName(OFFICER), 'Possible duplicate reviewed and merged', {
      note: 'Legacy record FRM-2019-00287 merged into this registration.',
    }),
  ],
}
farms.push(MARIE_FARM)

/* Legacy migrated farm ~70 m away — trips the S03 proximity check (iii.7). */
farms.push({
  id: 'FRM-2019-00287',
  clientId: MARIE_DUP.id,
  name: 'Hoareau Smallholding',
  district: 'Anse Boileau',
  island: 'Mahé',
  lat: -4.71987,
  lng: 55.48671,
  parcelRef: 'PR/AB/1042',
  sizeHa: 1.5,
  tenure: 'leased-state',
  crops: ['banana', 'cassava'],
  livestock: [{ type: 'broiler', headcount: 180 }],
  waterSource: 'river',
  status: 'registered',
  registeredOn: '2019-06-14',
  registeredVia: 'migrated',
  documents: [],
  history: [
    hist('CH-F2-1', new Date('2019-06-14T10:05:00Z'), 'MIGRATION', 'Data migration (batch MIG-2019-A)', 'Farm migrated from paper register'),
  ],
})

const FARM_WORDS_A = ['Belle', 'Grand', 'Petit', 'Haut', 'Bon', 'Val', 'Mont', 'Clair']
const FARM_WORDS_B = ['Vue', 'Terre', 'Jardin', 'Colline', 'Ruisseau', 'Plaine', 'Verger', 'Domaine']
const TARGET_FARMS = 62
let farmSeq = 1
for (let i = farms.length; i < TARGET_FARMS; i++) {
  const owner = pick(farmerClients.filter((c) => c.id !== MARIE_DUP.id))
  const d = districtByName[owner.district]
  const pin = jitterPin(d)
  const migrated = owner.registeredVia === 'migrated' && chance(0.7)
  const year = migrated ? owner.registeredOn.slice(0, 4) : '2026'
  farmSeq += 1
  const crops = pickSome(CROPS, 1, 3)
  const hasLivestock = chance(0.55)
  farms.push({
    id: `FRM-${year}-${pad(farmSeq + (migrated ? 200 : 0), 5)}`,
    clientId: owner.id,
    name: `${pick(FARM_WORDS_A)} ${pick(FARM_WORDS_B)}`,
    district: owner.district,
    island: owner.island,
    lat: pin.lat,
    lng: pin.lng,
    parcelRef: `PR/${owner.district.split(' ').map((w) => w[0]).join('').toUpperCase()}/${randInt(1000, 4999)}`,
    sizeHa: round(rand(0.2, 9.5), 2),
    tenure: pick(TENURES),
    crops,
    livestock: hasLivestock
      ? pickSome(LIVESTOCK, 1, 2).map((t) => ({
          type: t,
          headcount: t === 'broiler' || t === 'layer' ? randInt(60, 900) : randInt(3, 45),
        }))
      : [],
    waterSource: pick(WATER),
    status: chance(0.9) ? 'registered' : 'pending',
    registeredOn: migrated ? owner.registeredOn : day(daysAgo(randInt(10, 800))),
    registeredVia: migrated ? 'migrated' : chance(0.5) ? 'online' : 'back-office',
    documents: chance(0.6)
      ? [
          {
            id: `DOCREF-${farmSeq}-1`, name: pick(['Tenure letter.pdf', 'Lease agreement.pdf', 'Title extract.pdf']),
            category: 'Tenure evidence', sizeKb: randInt(180, 1400), uploadedOn: day(daysAgo(randInt(10, 400))),
            uploadedBy: OFFICER, verification: chance(0.75) ? 'verified' : 'pending', simulated: true,
          },
        ]
      : [],
    history: [
      hist(`CH-${farmSeq}-1`, new Date(`${migrated ? owner.registeredOn : day(daysAgo(randInt(10, 800)))}T09:30:00Z`),
        migrated ? 'MIGRATION' : OFFICER, migrated ? 'Data migration' : userName(OFFICER),
        migrated ? 'Farm migrated from paper register' : 'Farm registered'),
    ],
  })
}

const registeredFarms = farms.filter((f) => f.status === 'registered' && f.clientId !== MARIE_DUP.id)
const farmOf = (f) => clients.find((c) => c.id === f.clientId)

/* ------------------------------------------------------------------ *
 * Module xi — workflow definitions (admin-configurable, xi.6)
 * ------------------------------------------------------------------ */

const workflows = [
  {
    id: 'loan-approval',
    name: 'Agricultural loan approval',
    entity: 'loan',
    stages: [
      { id: 'stg-assess', name: 'Technical assessment', actorRole: 'agriculture_officer', slaDays: 10, description: 'Officer verifies the farm, documents and repayment capacity.' },
      { id: 'stg-committee', name: 'Loan committee decision', actorRole: 'supervisor', slaDays: 14, description: 'Committee approves, rejects or refers the application.' },
    ],
    updatedOn: day(daysAgo(120)),
    updatedByUserId: ADMIN,
  },
  {
    id: 'land-allocation',
    name: 'State land allocation',
    entity: 'land',
    stages: [
      { id: 'stg-screen', name: 'Eligibility screening', actorRole: 'agriculture_officer', slaDays: 7, description: 'Confirm applicant eligibility and completeness of the file.' },
      { id: 'stg-site', name: 'Site assessment', actorRole: 'field_officer', slaDays: 14, description: 'Physical assessment of the parcel and access.' },
      { id: 'stg-decision', name: 'Allocation decision', actorRole: 'supervisor', slaDays: 21, description: 'Final allocation decision and lease issuance.' },
    ],
    updatedOn: day(daysAgo(120)),
    updatedByUserId: ADMIN,
  },
]
const loanWf = workflows[0]
const landWf = workflows[1]

/* ------------------------------------------------------------------ *
 * Module v — loans
 * ------------------------------------------------------------------ */

const LOAN_PURPOSES = [
  'Poultry house construction', 'Irrigation system', 'Greenhouse tunnel', 'Seed and fertiliser inputs',
  'Fencing and land preparation', 'Cold storage unit', 'Piggery upgrade', 'Farm vehicle',
  'Drip irrigation and water tank', 'Shade netting',
]

const loanDocs = (uploadedOn) => [
  { id: `LD-${randInt(1000, 9999)}`, name: 'National ID copy.pdf', category: 'Identity', sizeKb: randInt(90, 400), uploadedOn, uploadedBy: 'SELF', verification: 'verified', simulated: true },
  { id: `LD-${randInt(1000, 9999)}`, name: 'Farm business plan.pdf', category: 'Business plan', sizeKb: randInt(300, 2200), uploadedOn, uploadedBy: 'SELF', verification: 'verified', simulated: true },
  { id: `LD-${randInt(1000, 9999)}`, name: 'Bank statement 3 months.pdf', category: 'Financial', sizeKb: randInt(150, 900), uploadedOn, uploadedBy: 'SELF', verification: chance(0.8) ? 'verified' : 'pending', simulated: true },
]

const stageInstancesFor = (wf, decidedStages) =>
  wf.stages.map((s, idx) => {
    const d = decidedStages[idx]
    return {
      stageId: s.id,
      name: s.name,
      actorRole: s.actorRole,
      status: d?.status ?? 'pending',
      decidedByUserId: d?.by,
      decidedOn: d?.on,
      comment: d?.comment,
    }
  })

const loans = []

/* The story's loan: SCR 85,000 poultry house, mid-way through stage 2 (v.3). */
const MARIE_LOAN_SUBMITTED = daysAgo(32)
loans.push({
  id: 'LN-2026-0014',
  clientId: MARIE.id,
  farmId: MARIE_FARM.id,
  purpose: 'Poultry house construction',
  amountScr: 85000,
  termMonths: 48,
  interestRatePct: 4.5,
  status: 'under-review',
  submittedOn: day(MARIE_LOAN_SUBMITTED),
  workflowId: loanWf.id,
  currentStageId: 'stg-committee',
  stageInstances: stageInstancesFor(loanWf, [
    { status: 'approved', by: OFFICER, on: day(daysAgo(19)), comment: 'Farm verified on site. Broiler capacity and repayment plan are realistic. Recommend approval.' },
    { status: 'in-progress' },
  ]),
  documents: loanDocs(day(MARIE_LOAN_SUBMITTED)),
  history: [
    hist('LH-1', atHour(MARIE_LOAN_SUBMITTED, 14, 5), 'SELF', 'Marie-Ange Hoareau', 'Application submitted via farmer portal', { note: 'SCR 85,000 over 48 months.' }),
    hist('LH-2', atHour(MARIE_LOAN_SUBMITTED, 14, 8), 'SELF', 'Marie-Ange Hoareau', 'Supporting documents uploaded', { note: '3 documents attached.' }),
    hist('LH-3', atHour(daysAgo(28), 9, 30), OFFICER, userName(OFFICER), 'Status changed', { field: 'status', from: 'submitted', to: 'under-review' }),
    hist('LH-4', atHour(daysAgo(19), 15, 12), OFFICER, userName(OFFICER), 'Stage "Technical assessment" approved', { note: 'Recommend approval.' }),
    hist('LH-5', atHour(daysAgo(19), 15, 13), 'SYSTEM', 'Workflow engine', 'Routed to stage "Loan committee decision"'),
  ],
})

const LOAN_STATES = [
  { status: 'submitted', stages: [] },
  { status: 'under-review', stages: [{ status: 'in-progress' }] },
  { status: 'approved', stages: [{ status: 'approved' }, { status: 'approved' }] },
  { status: 'rejected', stages: [{ status: 'approved' }, { status: 'rejected' }] },
  { status: 'disbursed', stages: [{ status: 'approved' }, { status: 'approved' }] },
  { status: 'repaying', stages: [{ status: 'approved' }, { status: 'approved' }] },
  { status: 'closed', stages: [{ status: 'approved' }, { status: 'approved' }] },
]

for (let i = 1; i < 26; i++) {
  const farm = pick(registeredFarms)
  const submitted = daysAgo(randInt(15, 700))
  const state = pick(LOAN_STATES)
  const decided = state.stages.map((s, idx) => ({
    status: s.status,
    by: idx === 0 ? OFFICER : SUPERVISOR,
    on: s.status === 'in-progress' ? undefined : day(addDays(submitted, 8 + idx * 9)),
    comment: s.status === 'rejected' ? 'Insufficient repayment capacity evidenced.' : s.status === 'approved' ? 'Assessment satisfactory.' : undefined,
  }))
  const amount = randInt(3, 60) * 5000
  const id = `LN-${day(submitted).slice(0, 4)}-${pad(100 + i, 4)}`
  loans.push({
    id,
    clientId: farm.clientId,
    farmId: farm.id,
    purpose: pick(LOAN_PURPOSES),
    amountScr: amount,
    termMonths: pick([24, 36, 48, 60]),
    interestRatePct: pick([3.5, 4.0, 4.5, 5.0]),
    status: state.status,
    submittedOn: day(submitted),
    workflowId: loanWf.id,
    currentStageId: state.status === 'under-review' ? 'stg-assess' : state.status === 'submitted' ? 'stg-assess' : null,
    stageInstances: stageInstancesFor(loanWf, decided),
    documents: loanDocs(day(submitted)),
    disbursedOn: ['disbursed', 'repaying', 'closed'].includes(state.status) ? day(addDays(submitted, 40)) : undefined,
    balanceScr: state.status === 'repaying' ? round(amount * rand(0.25, 0.8), 0) : state.status === 'closed' ? 0 : undefined,
    history: [
      hist(`LH-${id}-1`, atHour(submitted, 11, 0), 'SELF', `${farmOf(farm).firstName} ${farmOf(farm).lastName}`, 'Application submitted via farmer portal'),
      ...decided
        .filter((d) => d.on)
        .map((d, idx) => hist(`LH-${id}-${idx + 2}`, atHour(new Date(d.on), 10, 15), d.by, userName(d.by), `Stage "${loanWf.stages[idx].name}" ${d.status}`, { note: d.comment })),
    ],
  })
}

/* ------------------------------------------------------------------ *
 * Module vi — laboratory samples
 * ------------------------------------------------------------------ */

const SOIL_PANEL = () => [
  { parameter: 'pH (H₂O)', value: round(rand(4.6, 7.4), 1), unit: '', method: 'SM-4500-H', referenceRange: '5.5 – 7.0' },
  { parameter: 'Organic matter', value: round(rand(1.1, 6.4), 1), unit: '%', method: 'Walkley-Black', referenceRange: '> 3.0' },
  { parameter: 'Nitrogen (total)', value: round(rand(0.04, 0.31), 2), unit: '%', method: 'Kjeldahl', referenceRange: '0.15 – 0.30' },
  { parameter: 'Phosphorus (available)', value: round(rand(4, 42), 1), unit: 'mg/kg', method: 'Olsen', referenceRange: '15 – 40' },
  { parameter: 'Potassium (exchangeable)', value: round(rand(60, 340), 0), unit: 'mg/kg', method: 'NH₄OAc', referenceRange: '120 – 300' },
  { parameter: 'Electrical conductivity', value: round(rand(0.1, 1.4), 2), unit: 'dS/m', method: 'SM-2510-B', referenceRange: '< 1.0' },
]
const WATER_PANEL = () => [
  { parameter: 'pH', value: round(rand(5.8, 8.6), 1), unit: '', method: 'SM-4500-H', referenceRange: '6.5 – 8.5' },
  { parameter: 'Turbidity', value: round(rand(0.3, 12), 1), unit: 'NTU', method: 'SM-2130-B', referenceRange: '< 5' },
  { parameter: 'Nitrate (NO₃-N)', value: round(rand(0.2, 14), 1), unit: 'mg/L', method: 'SM-4500-NO₃', referenceRange: '< 10' },
  { parameter: 'E. coli', value: randInt(0, 40), unit: 'CFU/100 mL', method: 'SM-9223-B', referenceRange: '0' },
  { parameter: 'Total dissolved solids', value: randInt(90, 900), unit: 'mg/L', method: 'SM-2540-C', referenceRange: '< 600' },
]
const PLANT_PANEL = () => [
  { parameter: 'Leaf nitrogen', value: round(rand(1.4, 4.2), 2), unit: '%', method: 'Kjeldahl', referenceRange: '2.5 – 3.5' },
  { parameter: 'Leaf phosphorus', value: round(rand(0.08, 0.42), 2), unit: '%', method: 'ICP-OES', referenceRange: '0.15 – 0.30' },
  { parameter: 'Leaf potassium', value: round(rand(1.1, 4.6), 2), unit: '%', method: 'ICP-OES', referenceRange: '2.0 – 4.0' },
  { parameter: 'Pathogen screen', value: pick(['Not detected', 'Not detected', 'Fusarium spp. detected']), unit: '', method: 'Culture + microscopy', referenceRange: 'Not detected' },
]
const COMPOST_PANEL = () => [
  { parameter: 'pH', value: round(rand(6.0, 8.8), 1), unit: '', method: 'SM-4500-H', referenceRange: '6.5 – 8.0' },
  { parameter: 'Moisture', value: randInt(25, 68), unit: '%', method: 'Gravimetric', referenceRange: '40 – 60' },
  { parameter: 'C:N ratio', value: round(rand(9, 34), 1), unit: '', method: 'Dry combustion', referenceRange: '15 – 25' },
  { parameter: 'Maturity (Solvita)', value: randInt(4, 8), unit: 'index', method: 'Solvita', referenceRange: '≥ 6' },
]
/* Veterinary diagnostic panel — a poultry diagnosis, not an agronomic one. */
const AVIAN_PANEL = () => [
  { parameter: 'Newcastle disease virus (RT-PCR)', value: 'Not detected', unit: '', method: 'RT-PCR', referenceRange: 'Not detected' },
  { parameter: 'Haemagglutination inhibition titre', value: 'log2 2', unit: '', method: 'HI test', referenceRange: '< log2 4' },
  { parameter: 'Avian influenza virus type A', value: 'Not detected', unit: '', method: 'RT-PCR', referenceRange: 'Not detected' },
  { parameter: 'Post-mortem findings', value: 'No significant findings', unit: '', method: 'Gross pathology', referenceRange: '—' },
]
const PANELS = { soil: SOIL_PANEL, water: WATER_PANEL, plant: PLANT_PANEL, compost: COMPOST_PANEL, avian_tissue: AVIAN_PANEL }

/** Flag a numeric result against a "a – b", "< a" or "> a" reference range. */
function flagResult(r) {
  const v = typeof r.value === 'number' ? r.value : null
  if (v === null) {
    // Mirrors src/lib/labPanels.ts: "log2 N" titres compare numerically.
    const refTitre = /log2\s*(-?\d+(?:\.\d+)?)/i.exec(r.referenceRange)
    const valueTitre = /log2\s*(-?\d+(?:\.\d+)?)/i.exec(String(r.value))
    if (refTitre && valueTitre) {
      return flagResult({
        ...r,
        value: Number(valueTitre[1]),
        referenceRange: r.referenceRange.replace(/log2\s*(-?\d+(?:\.\d+)?)/i, refTitre[1]),
      })
    }
    return { ...r, flag: String(r.value) === r.referenceRange ? 'normal' : 'high' }
  }
  const range = r.referenceRange.replace(/[≥≤]/g, '').trim()
  let lo = null
  let hi = null
  if (range.includes('–')) {
    const [a, b] = range.split('–').map((s) => parseFloat(s))
    lo = a; hi = b
  } else if (range.startsWith('<')) hi = parseFloat(range.slice(1))
  else if (range.startsWith('>')) lo = parseFloat(range.slice(1))
  else if (range === '0') hi = 0
  if (lo !== null && v < lo) return { ...r, flag: 'low' }
  if (hi !== null && v > hi) return { ...r, flag: 'high' }
  return { ...r, flag: 'normal' }
}

const samples = []

/* The story's soil test — completed, and the applicant has been notified. */
const MARIE_SAMPLE_REQ = daysAgo(24)
samples.push({
  id: 'LAB-2026-0031',
  type: 'soil',
  clientId: MARIE.id,
  farmId: MARIE_FARM.id,
  requestedOn: day(MARIE_SAMPLE_REQ),
  requestedVia: 'online',
  requestedByUserId: 'SELF',
  status: 'completed',
  collectedOn: day(daysAgo(21)),
  registeredOn: day(daysAgo(20)),
  testingStartedOn: day(daysAgo(18)),
  completedOn: day(daysAgo(12)),
  labTechUserId: LAB,
  purpose: 'Soil fertility assessment ahead of poultry-house siting and banana block replanting.',
  results: [
    { parameter: 'pH (H₂O)', value: 5.2, unit: '', method: 'SM-4500-H', referenceRange: '5.5 – 7.0' },
    { parameter: 'Organic matter', value: 4.1, unit: '%', method: 'Walkley-Black', referenceRange: '> 3.0' },
    { parameter: 'Nitrogen (total)', value: 0.18, unit: '%', method: 'Kjeldahl', referenceRange: '0.15 – 0.30' },
    { parameter: 'Phosphorus (available)', value: 11.4, unit: 'mg/kg', method: 'Olsen', referenceRange: '15 – 40' },
    { parameter: 'Potassium (exchangeable)', value: 168, unit: 'mg/kg', method: 'NH₄OAc', referenceRange: '120 – 300' },
    { parameter: 'Electrical conductivity', value: 0.34, unit: 'dS/m', method: 'SM-2510-B', referenceRange: '< 1.0' },
  ].map(flagResult),
  interpretation:
    'Moderately acidic soil with good organic matter. Available phosphorus is below the target range and pH is marginally low for banana.',
  recommendation:
    'Apply agricultural lime at 1.5 t/ha to raise pH toward 6.0. Correct phosphorus with a basal rock-phosphate dressing before replanting. Re-test in 9 months.',
  notifiedOn: day(daysAgo(12)),
  history: [
    hist('SH-1', atHour(MARIE_SAMPLE_REQ, 8, 40), 'SELF', 'Marie-Ange Hoareau', 'Sampling request submitted via farmer portal'),
    hist('SH-2', atHour(daysAgo(21), 9, 15), FIELD, userName(FIELD), 'Sample collected on farm', { note: '4 sub-samples, 0–20 cm, composited.' }),
    hist('SH-3', atHour(daysAgo(20), 10, 5), LAB, userName(LAB), 'Sample registered at laboratory'),
    hist('SH-4', atHour(daysAgo(18), 8, 30), LAB, userName(LAB), 'Testing started'),
    hist('SH-5', atHour(daysAgo(12), 14, 20), LAB, userName(LAB), 'Results entered and validated'),
    hist('SH-6', atHour(daysAgo(12), 14, 25), LAB, userName(LAB), 'Applicant notified (SMS + email, simulated)'),
  ],
})

const SAMPLE_STATES = ['requested', 'collected', 'registered', 'testing', 'completed', 'completed', 'completed']
for (let i = 1; i < 31; i++) {
  const farm = pick(registeredFarms)
  const type = pick(['soil', 'soil', 'water', 'plant', 'compost'])
  const status = pick(SAMPLE_STATES)
  const requested = daysAgo(randInt(3, 500))
  const completed = status === 'completed'
  const id = `LAB-${day(requested).slice(0, 4)}-${pad(100 + i, 4)}`
  samples.push({
    id,
    type,
    clientId: farm.clientId,
    farmId: farm.id,
    requestedOn: day(requested),
    requestedVia: chance(0.4) ? 'online' : 'back-office',
    requestedByUserId: chance(0.4) ? 'SELF' : OFFICER,
    status,
    collectedOn: status !== 'requested' ? day(addDays(requested, 3)) : undefined,
    registeredOn: ['registered', 'testing', 'completed'].includes(status) ? day(addDays(requested, 4)) : undefined,
    testingStartedOn: ['testing', 'completed'].includes(status) ? day(addDays(requested, 6)) : undefined,
    completedOn: completed ? day(addDays(requested, 12)) : undefined,
    labTechUserId: ['registered', 'testing', 'completed'].includes(status) ? LAB : undefined,
    purpose: pick([
      'Routine fertility monitoring', 'Pre-planting assessment', 'Irrigation water quality check',
      'Suspected nutrient deficiency', 'Compost maturity verification', 'Disease investigation support',
    ]),
    results: completed ? PANELS[type]().map(flagResult) : [],
    interpretation: completed ? pick([
      'All measured parameters fall within the reference ranges.',
      'One parameter falls outside the reference range; corrective action advised.',
      'Results consistent with the reported field symptoms.',
    ]) : undefined,
    recommendation: completed ? pick([
      'Maintain the current fertiliser programme and re-test in 12 months.',
      'Apply corrective amendment and re-test in 6 months.',
      'Refer to the extension officer for a follow-up field visit.',
    ]) : undefined,
    notifiedOn: completed && chance(0.85) ? day(addDays(requested, 12)) : undefined,
    history: [
      hist(`SH-${id}-1`, atHour(requested, 9, 0), OFFICER, userName(OFFICER), 'Sampling request registered'),
      ...(completed ? [hist(`SH-${id}-2`, atHour(addDays(requested, 12), 15, 0), LAB, userName(LAB), 'Results entered and validated')] : []),
    ],
  })
}

/* ------------------------------------------------------------------ *
 * Module vii — livestock services
 * ------------------------------------------------------------------ */

const livestockFarms = registeredFarms.filter((f) => f.livestock.length > 0)
const livestockVisits = []

livestockVisits.push({
  id: 'LSV-2026-0018',
  type: 'routine',
  clientId: MARIE.id,
  farmId: MARIE_FARM.id,
  species: 'broiler',
  scheduledOn: day(daysAgo(9)),
  visitedOn: day(daysAgo(9)),
  officerUserId: OFFICER,
  status: 'closed',
  observations:
    'Flock of 240 broilers at 28 days. Housing dry and well ventilated. Feed and water lines clean. Litter depth adequate. Two birds showing mild respiratory rales isolated in the sick pen.',
  findings:
    'Flock condition generally good. Mild respiratory signs in 2 of 240 birds. Vaccination record for Newcastle disease is up to date (last dose day 18).',
  actionTaken:
    'Advised on ventilation at night and increased litter turning. Isolated birds to be monitored daily; report any spread within 48 hours.',
  followUpOn: day(daysAgo(2)),
  history: [
    hist('VH-1', atHour(daysAgo(12), 9, 0), OFFICER, userName(OFFICER), 'Routine visit scheduled'),
    hist('VH-2', atHour(daysAgo(9), 10, 30), OFFICER, userName(OFFICER), 'Visit completed; observations recorded'),
    hist('VH-3', atHour(daysAgo(2), 8, 15), OFFICER, userName(OFFICER), 'Follow-up recorded; visit closed'),
  ],
})

const COMPLAINTS = [
  'Sudden drop in egg production reported by the farmer.',
  'Two goats showing lameness and reluctance to feed.',
  'Neighbour complaint regarding odour from the piggery.',
  'Unexplained mortality of 6 broilers overnight.',
  'Suspected feed contamination — birds off feed for two days.',
  'Layer flock showing pale combs and reduced water intake.',
]
const VISIT_STATES = ['registered', 'assigned', 'in-progress', 'resolved', 'closed', 'closed']
for (let i = 1; i < 21; i++) {
  const farm = pick(livestockFarms)
  const isComplaint = chance(0.45)
  const scheduled = daysAgo(randInt(2, 400))
  const status = pick(VISIT_STATES)
  const done = ['resolved', 'closed', 'in-progress'].includes(status)
  const id = `LSV-${day(scheduled).slice(0, 4)}-${pad(100 + i, 4)}`
  livestockVisits.push({
    id,
    type: isComplaint ? 'complaint' : 'routine',
    clientId: farm.clientId,
    farmId: farm.id,
    species: farm.livestock[0].type,
    scheduledOn: day(scheduled),
    visitedOn: done ? day(addDays(scheduled, 1)) : undefined,
    officerUserId: pick([OFFICER, 'USR-007']),
    status,
    complaintSummary: isComplaint ? pick(COMPLAINTS) : undefined,
    observations: done ? pick([
      'Housing in fair condition; ventilation adequate. Stock alert and feeding normally.',
      'Water source clean. Minor overcrowding observed in the rear pen.',
      'Body condition scores within normal range across the sampled animals.',
      'Bedding damp in two sections; drainage channel partially blocked.',
    ]) : '',
    findings: done ? pick([
      'No notifiable disease signs observed.',
      'Sub-clinical parasitism suspected; faecal sample taken.',
      'Management-related issue rather than disease.',
      'Nutritional deficiency likely; ration reviewed with the farmer.',
    ]) : '',
    actionTaken: done ? pick([
      'Advice given on housing and biosecurity. No treatment required.',
      'Anthelmintic treatment administered; follow-up in 21 days.',
      'Ration adjustment advised; follow-up visit scheduled.',
      'Referred for laboratory sampling.',
    ]) : '',
    followUpOn: done && chance(0.4) ? day(addDays(scheduled, 21)) : undefined,
    history: [
      hist(`VH-${id}-1`, atHour(scheduled, 9, 0), OFFICER, userName(OFFICER), isComplaint ? 'Complaint registered' : 'Routine visit scheduled'),
      ...(done ? [hist(`VH-${id}-2`, atHour(addDays(scheduled, 1), 11, 0), OFFICER, userName(OFFICER), 'Visit completed; observations recorded')] : []),
    ],
  })
}

/* ------------------------------------------------------------------ *
 * Module viii — passive surveillance
 * ------------------------------------------------------------------ */

/* A companion sample carrying the Newcastle-disease submission (viii.4). */
const NCD_SAMPLE_ID = 'LAB-2026-0044'
samples.push({
  id: NCD_SAMPLE_ID,
  type: 'avian_tissue',
  clientId: MARIE.id,
  farmId: MARIE_FARM.id,
  requestedOn: day(daysAgo(5)),
  requestedVia: 'back-office',
  requestedByUserId: OFFICER,
  status: 'testing',
  collectedOn: day(daysAgo(5)),
  registeredOn: day(daysAgo(4)),
  testingStartedOn: day(daysAgo(4)),
  labTechUserId: LAB,
  purpose: 'Diagnostic submission supporting surveillance case SUR-2026-004 (suspected Newcastle disease).',
  results: [],
  history: [
    hist('SH-N-1', atHour(daysAgo(5), 13, 20), OFFICER, userName(OFFICER), 'Diagnostic samples collected and submitted'),
    hist('SH-N-2', atHour(daysAgo(4), 9, 5), LAB, userName(LAB), 'Sample registered; testing started'),
  ],
})

const surveillanceCases = []
surveillanceCases.push({
  id: 'SUR-2026-004',
  clientId: MARIE.id,
  farmId: MARIE_FARM.id,
  suspectedDisease: 'Newcastle disease',
  species: 'broiler',
  reportedOn: day(daysAgo(6)),
  reportedBy: 'Marie-Ange Hoareau',
  reportedVia: 'farmer-portal',
  assignedOfficerUserId: OFFICER,
  status: 'sampled',
  linkedSampleId: NCD_SAMPLE_ID,
  affectedCount: 14,
  mortalityCount: 3,
  notes:
    'Farmer reported sudden respiratory distress and greenish diarrhoea in the broiler flock, with three overnight deaths. Follows the mild respiratory signs noted at the routine visit LSV-2026-0018.',
  history: [
    hist('CH-S-1', atHour(daysAgo(6), 7, 55), 'SELF', 'Marie-Ange Hoareau', 'Suspected case reported via farmer portal'),
    hist('CH-S-2', atHour(daysAgo(6), 9, 10), SUPERVISOR, userName(SUPERVISOR), 'Case assigned to officer', { field: 'assignedOfficerUserId', to: userName(OFFICER) }),
    hist('CH-S-3', atHour(daysAgo(5), 13, 20), OFFICER, userName(OFFICER), 'Farm visited; diagnostic samples collected'),
    hist('CH-S-4', atHour(daysAgo(5), 13, 40), OFFICER, userName(OFFICER), `Laboratory submission linked (${NCD_SAMPLE_ID})`),
    hist('CH-S-5', atHour(daysAgo(4), 9, 5), 'SYSTEM', 'Workflow engine', 'Status changed', { field: 'status', from: 'investigating', to: 'sampled' }),
  ],
})

const DISEASES = [
  { name: 'Newcastle disease', species: 'broiler' },
  { name: 'Infectious bronchitis', species: 'layer' },
  { name: 'African swine fever (rule-out)', species: 'pig' },
  { name: 'Contagious ecthyma (orf)', species: 'goat' },
  { name: 'Fowl pox', species: 'layer' },
  { name: 'Coccidiosis outbreak', species: 'broiler' },
  { name: 'Foot rot', species: 'goat' },
]
const SUR_STATES = ['reported', 'assigned', 'investigating', 'confirmed', 'negative', 'closed', 'closed']
for (let i = 1; i < 8; i++) {
  const farm = pick(livestockFarms)
  const d = pick(DISEASES)
  const reported = daysAgo(randInt(10, 500))
  const status = pick(SUR_STATES)
  const id = `SUR-${day(reported).slice(0, 4)}-${pad(100 + i, 3)}`
  const linked = ['confirmed', 'negative', 'closed'].includes(status) ? pick(samples).id : undefined
  surveillanceCases.push({
    id,
    clientId: farm.clientId,
    farmId: farm.id,
    suspectedDisease: d.name,
    species: farm.livestock[0].type,
    reportedOn: day(reported),
    reportedBy: `${farmOf(farm).firstName} ${farmOf(farm).lastName}`,
    reportedVia: pick(['farmer-portal', 'officer', 'hotline']),
    assignedOfficerUserId: status === 'reported' ? undefined : pick([OFFICER, 'USR-007']),
    status,
    linkedSampleId: linked,
    affectedCount: randInt(2, 60),
    mortalityCount: randInt(0, 12),
    notes: pick([
      'Reported by the farmer following unusual mortality in the flock.',
      'Detected during a routine extension visit.',
      'Reported via the veterinary hotline by a neighbouring smallholder.',
      'Follow-up on a previously closed case at the same holding.',
    ]),
    history: [
      hist(`CH-${id}-1`, atHour(reported, 8, 0), 'SELF', 'Reporter', 'Suspected case reported'),
      ...(status !== 'reported' ? [hist(`CH-${id}-2`, atHour(addDays(reported, 1), 9, 0), SUPERVISOR, userName(SUPERVISOR), 'Case assigned to officer')] : []),
    ],
  })
}

/* ------------------------------------------------------------------ *
 * Module ix — vendors & Victoria Market stalls
 * ------------------------------------------------------------------ */

const stalls = []
const SECTIONS = [
  { section: 'Produce Hall', rows: ['A', 'B'], perRow: 8, fee: 900 },
  { section: 'Fish Market', rows: ['C'], perRow: 6, fee: 1200 },
  { section: 'Craft & Value-added', rows: ['D'], perRow: 6, fee: 750 },
]
for (const s of SECTIONS) {
  for (const row of s.rows) {
    for (let n = 1; n <= s.perRow; n++) {
      stalls.push({
        id: `VM-${row}${pad(n, 2)}`,
        market: 'Victoria Market',
        section: s.section,
        row,
        number: n,
        status: 'vacant',
        monthlyFeeScr: s.fee,
      })
    }
  }
}

const vendors = []
const TRADE_WORDS = ['Fresh', 'Island', 'Green', 'Sunrise', 'Coral', 'Bamboo', 'Takamaka', 'Cascade']
const TRADE_TAIL = ['Produce', 'Growers', 'Market Stall', 'Traders', 'Harvest', 'Provisions']

vendors.push({
  id: 'VND-2026-009',
  clientId: MARIE.id,
  fullName: 'Marie-Ange Hoareau',
  tradeName: 'Rivière Doux Produce',
  category: 'produce',
  phone: MARIE.phone,
  email: MARIE.email,
  market: 'Victoria Market',
  licenceNo: 'VM/2026/0091',
  stallId: 'VM-A04',
  registrationStatus: 'active',
  registeredOn: day(daysAgo(16)),
  expiresOn: day(addDays(TODAY, 349)),
  history: [
    hist('VN-1', atHour(daysAgo(16), 10, 0), OFFICER, userName(OFFICER), 'Vendor registered against existing client record'),
    hist('VN-2', atHour(daysAgo(16), 10, 6), OFFICER, userName(OFFICER), 'Stall VM-A04 allocated', { field: 'stallId', to: 'VM-A04' }),
  ],
})

const vendorClients = pickSome(farmerClients.filter((c) => c.id !== MARIE.id && c.id !== MARIE_DUP.id), 8, 8)
for (let i = 1; i < 15; i++) {
  const linked = i <= 8 ? vendorClients[i - 1] : null
  const gender = chance(0.5) ? 'F' : 'M'
  const nm = linked
    ? { firstName: linked.firstName, lastName: linked.lastName }
    : makeName(gender)
  const registered = daysAgo(randInt(20, 700))
  const status = pick(['active', 'active', 'active', 'pending', 'suspended', 'expired'])
  vendors.push({
    id: `VND-${day(registered).slice(0, 4)}-${pad(100 + i, 3)}`,
    clientId: linked?.id,
    fullName: `${nm.firstName} ${nm.lastName}`,
    tradeName: `${pick(TRADE_WORDS)} ${pick(TRADE_TAIL)}`,
    category: pick(['produce', 'produce', 'fish', 'value-added', 'crafts']),
    phone: linked ? linked.phone : nextPhone(),
    email: linked?.email || slugEmail(nm.firstName, nm.lastName, 900 + i),
    market: 'Victoria Market',
    licenceNo: `VM/${day(registered).slice(0, 4)}/${pad(100 + i, 4)}`,
    registrationStatus: status,
    registeredOn: day(registered),
    expiresOn: day(addDays(registered, 365)),
    history: [hist(`VN-${i}-1`, atHour(registered, 9, 30), OFFICER, userName(OFFICER), 'Vendor registered')],
  })
}

/* Allocate stalls to the active vendors. */
const allocatable = stalls.filter((s) => s.id !== 'VM-A04')
for (const v of vendors) {
  if (v.stallId || v.registrationStatus !== 'active') continue
  const free = allocatable.filter((s) => s.status === 'vacant')
  if (!free.length) break
  const stall = pick(free)
  stall.status = 'allocated'
  stall.vendorId = v.id
  stall.allocatedOn = v.registeredOn
  v.stallId = stall.id
}
const marieStall = stalls.find((s) => s.id === 'VM-A04')
marieStall.status = 'allocated'
marieStall.vendorId = 'VND-2026-009'
marieStall.allocatedOn = day(daysAgo(16))
for (const s of stalls) {
  if (s.status === 'vacant' && chance(0.18)) s.status = chance(0.5) ? 'reserved' : 'maintenance'
}

/* ------------------------------------------------------------------ *
 * Module x — field inspections
 * ------------------------------------------------------------------ */

const inspections = []
inspections.push({
  id: 'INS-2026-012',
  clientId: MARIE.id,
  farmId: MARIE_FARM.id,
  type: 'loan-verification',
  scheduledOn: day(daysAgo(20)),
  officerUserId: FIELD,
  status: 'completed',
  completedOn: day(daysAgo(19)),
  observations:
    'Proposed poultry-house footprint pegged out on the upper terrace, clear of the river buffer. Existing broiler shed in sound condition. Access track passable by pickup in dry weather.',
  findings:
    'Site is suitable for the proposed 200 m² poultry house. Setback from the watercourse measured at 22 m, above the 15 m minimum. No drainage concerns observed.',
  outcome: 'compliant',
  photos: [
    { id: 'PH-1', caption: 'Proposed poultry-house footprint, upper terrace', takenOn: day(daysAgo(19)), swatch: 'a1', simulated: true },
    { id: 'PH-2', caption: 'Existing broiler shed — south elevation', takenOn: day(daysAgo(19)), swatch: 'b3', simulated: true },
    { id: 'PH-3', caption: 'Watercourse setback measurement', takenOn: day(daysAgo(19)), swatch: 'c2', simulated: true },
  ],
  capturedOffline: true,
  syncedOn: iso(atHour(daysAgo(19), 16, 42)),
  history: [
    hist('IH-1', atHour(daysAgo(24), 8, 0), SUPERVISOR, userName(SUPERVISOR), 'Inspection scheduled and assigned', { field: 'officer', to: userName(FIELD) }),
    hist('IH-2', atHour(daysAgo(19), 11, 5), FIELD, userName(FIELD), 'Captured on device while offline (simulated)'),
    hist('IH-3', atHour(daysAgo(19), 16, 42), FIELD, userName(FIELD), 'Queued submission synchronised on reconnect'),
  ],
})

const INS_TYPES = ['farm-compliance', 'land-lease', 'loan-verification', 'biosecurity']
for (let i = 1; i < 16; i++) {
  const farm = pick(registeredFarms)
  const scheduled = daysAgo(randInt(-14, 420))
  const future = scheduled > TODAY
  const status = future ? 'scheduled' : pick(['completed', 'completed', 'completed', 'in-progress', 'cancelled'])
  const done = status === 'completed'
  const offline = done && chance(0.35)
  const id = `INS-${day(scheduled).slice(0, 4)}-${pad(100 + i, 3)}`
  inspections.push({
    id,
    clientId: farm.clientId,
    farmId: farm.id,
    type: pick(INS_TYPES),
    scheduledOn: day(scheduled),
    officerUserId: pick([FIELD, 'USR-008']),
    status,
    completedOn: done ? day(scheduled) : undefined,
    observations: done ? pick([
      'Holding boundaries consistent with the registered parcel. Crop stands healthy.',
      'Irrigation lines in service. Minor leak at the header tank noted.',
      'Storage shed clean and pest-free. Chemical store locked and labelled.',
      'Boundary fence damaged along the northern edge; livestock straying risk.',
    ]) : '',
    findings: done ? pick([
      'Holding is compliant with the registration conditions.',
      'Minor issues noted; farmer advised, no formal action required.',
      'Non-compliance with fencing condition; remedial notice issued.',
      'Loan-funded assets verified present and in use.',
    ]) : '',
    outcome: done ? pick(['compliant', 'compliant', 'minor-issues', 'non-compliant']) : 'not-assessed',
    photos: done
      ? Array.from({ length: randInt(1, 3) }, (_, k) => ({
          id: `PH-${id}-${k}`,
          caption: pick(['General view of the holding', 'Crop stand detail', 'Boundary and access', 'Livestock housing', 'Irrigation infrastructure']),
          takenOn: day(scheduled),
          swatch: `${pick(['a', 'b', 'c', 'd'])}${randInt(1, 4)}`,
          simulated: true,
        }))
      : [],
    capturedOffline: offline,
    syncedOn: offline ? iso(atHour(scheduled, 17, 5)) : undefined,
    history: [
      hist(`IH-${id}-1`, atHour(addDays(scheduled, -4), 8, 0), SUPERVISOR, userName(SUPERVISOR), 'Inspection scheduled and assigned'),
      ...(done ? [hist(`IH-${id}-2`, atHour(scheduled, 12, 0), FIELD, userName(FIELD), 'Findings recorded')] : []),
    ],
  })
}

/* --- Upcoming inspections -------------------------------------------
 * The random pass above only looks backwards in practice, which left the S10
 * scheduling calendar empty on the demo date. These are appended with fixed
 * values and consume no PRNG draws, so every previously generated record — and
 * every id referenced by TRACEABILITY.md — is unchanged.
 */
const UPCOMING = [
  { offset: 2, farm: MARIE_FARM.id, client: MARIE.id, type: 'farm-compliance', officer: FIELD },
  { offset: 5, farm: null, client: null, type: 'biosecurity', officer: 'USR-008' },
  { offset: 9, farm: null, client: null, type: 'land-lease', officer: FIELD },
  { offset: 14, farm: null, client: null, type: 'loan-verification', officer: 'USR-008' },
  { offset: 21, farm: null, client: null, type: 'farm-compliance', officer: FIELD },
]
UPCOMING.forEach((u, k) => {
  // Deterministic spread across the registry rather than a random pick.
  const farm = u.farm ? farms.find((f) => f.id === u.farm) : registeredFarms[(k * 7 + 3) % registeredFarms.length]
  const id = `INS-2026-${pad(120 + k, 3)}`
  const on = day(addDays(TODAY, u.offset))
  inspections.push({
    id,
    clientId: u.client ?? farm.clientId,
    farmId: farm.id,
    type: u.type,
    scheduledOn: on,
    officerUserId: u.officer,
    status: 'scheduled',
    observations: '',
    findings: '',
    outcome: 'not-assessed',
    photos: [],
    capturedOffline: false,
    history: [
      hist(`IH-${id}-1`, atHour(addDays(TODAY, -3), 8, 30), SUPERVISOR, userName(SUPERVISOR),
        'Inspection scheduled and assigned', { field: 'officer', to: userName(u.officer) }),
    ],
  })
})

/* ------------------------------------------------------------------ *
 * Module iv — land applications, leases, enforcement
 * ------------------------------------------------------------------ */

const leases = []
leases.push({
  id: 'LSE-2019-0044',
  clientId: MARIE.id,
  farmId: MARIE_FARM.id,
  parcelRef: 'PR/AB/1042',
  district: 'Anse Boileau',
  areaHa: 1.6,
  startDate: '2019-07-01',
  endDate: '2029-06-30',
  annualRentScr: 2400,
  status: 'active',
  paymentStatus: 'current',
  lastPaymentOn: day(daysAgo(96)),
  nextPaymentDue: day(addDays(TODAY, 269)),
  documents: [
    { id: 'LSD-1', name: 'Lease agreement PR-AB-1042 (2019).pdf', category: 'Lease', sizeKb: 720, uploadedOn: '2019-07-02', uploadedBy: 'MIGRATION', verification: 'verified', simulated: true },
  ],
  history: [
    hist('LSH-1', new Date('2019-07-01T09:00:00Z'), 'MIGRATION', 'Data migration', 'Lease recorded from paper agreement'),
    hist('LSH-2', atHour(daysAgo(96), 11, 0), OFFICER, userName(OFFICER), 'Annual rent payment recorded', { field: 'paymentStatus', from: 'due', to: 'current' }),
  ],
})

const LEASE_STATES = ['active', 'active', 'active', 'active', 'expired', 'pending', 'terminated']
for (let i = 1; i < 25; i++) {
  const farm = pick(registeredFarms)
  const status = pick(LEASE_STATES)
  const start = daysAgo(randInt(200, 2600))
  const end = addDays(start, 365 * pick([5, 10, 15]))
  const expiringSoon = status === 'active' && chance(0.3)
  const realEnd = expiringSoon ? addDays(TODAY, randInt(9, 75)) : end
  const payment = pick(['current', 'current', 'due', 'overdue'])
  const id = `LSE-${day(start).slice(0, 4)}-${pad(100 + i, 4)}`
  leases.push({
    id,
    clientId: farm.clientId,
    farmId: farm.id,
    parcelRef: farm.parcelRef,
    district: farm.district,
    areaHa: farm.sizeHa,
    startDate: day(start),
    endDate: day(status === 'expired' ? daysAgo(randInt(10, 300)) : realEnd),
    annualRentScr: randInt(6, 40) * 250,
    status,
    paymentStatus: payment,
    lastPaymentOn: payment === 'current' ? day(daysAgo(randInt(20, 300))) : day(daysAgo(randInt(370, 700))),
    nextPaymentDue: payment === 'overdue' ? day(daysAgo(randInt(15, 120))) : day(addDays(TODAY, randInt(5, 330))),
    documents: [
      { id: `LSD-${i}`, name: 'Lease agreement.pdf', category: 'Lease', sizeKb: randInt(400, 1200), uploadedOn: day(start), uploadedBy: OFFICER, verification: 'verified', simulated: true },
    ],
    history: [hist(`LSH-${id}-1`, atHour(start, 9, 0), OFFICER, userName(OFFICER), 'Lease recorded')],
  })
}

const landApplications = []
const LAND_PURPOSES = [
  'Expansion of vegetable production', 'New poultry unit', 'Fruit orchard establishment',
  'Fodder production for goats', 'Nursery and propagation unit', 'Agro-processing shed',
]
const LAND_STATES = ['submitted', 'under-review', 'approved', 'approved', 'rejected']
for (let i = 1; i < 15; i++) {
  const c = pick(farmerClients.filter((x) => x.id !== MARIE_DUP.id))
  const d = districtByName[c.district]
  const pin = jitterPin(d)
  const submitted = daysAgo(randInt(20, 600))
  const status = pick(LAND_STATES)
  const decidedCount = status === 'submitted' ? 0 : status === 'under-review' ? 1 : 3
  const decided = landWf.stages.slice(0, decidedCount).map((s, idx) => ({
    status: status === 'rejected' && idx === 2 ? 'rejected' : 'approved',
    by: s.actorRole === 'supervisor' ? SUPERVISOR : s.actorRole === 'field_officer' ? FIELD : OFFICER,
    on: day(addDays(submitted, 7 + idx * 12)),
    comment: idx === 2 && status === 'rejected' ? 'Parcel required for a competing public purpose.' : 'Cleared at this stage.',
  }))
  if (status === 'under-review') decided[0] = { ...decided[0], status: 'approved' }
  const id = `LA-${day(submitted).slice(0, 4)}-${pad(100 + i, 3)}`
  landApplications.push({
    id,
    clientId: c.id,
    parcelRef: `PR/${c.district.split(' ').map((w) => w[0]).join('').toUpperCase()}/${randInt(5000, 8999)}`,
    district: c.district,
    island: c.island,
    lat: pin.lat,
    lng: pin.lng,
    requestedAreaHa: round(rand(0.3, 4.5), 2),
    purpose: pick(LAND_PURPOSES),
    status,
    submittedOn: day(submitted),
    workflowId: landWf.id,
    currentStageId: status === 'submitted' ? 'stg-screen' : status === 'under-review' ? 'stg-site' : null,
    stageInstances: stageInstancesFor(landWf, decided),
    assessments: decidedCount >= 2 ? [{
      id: `LAS-${i}`,
      assessedOn: day(addDays(submitted, 19)),
      assessorUserId: FIELD,
      soilSuitability: pick(['high', 'moderate', 'low']),
      slope: pick(['flat', 'gentle', 'steep']),
      waterAccess: chance(0.7),
      accessRoad: chance(0.8),
      recommendation: status === 'rejected' ? 'reject' : pick(['approve', 'approve-with-conditions']),
      notes: pick([
        'Parcel is workable with modest clearing. Access adequate for light vehicles.',
        'Slope will require terracing before cultivation.',
        'Water access limited in the dry season; rainwater harvesting recommended.',
      ]),
    }] : [],
    documents: [
      { id: `LAD-${i}`, name: 'Application form.pdf', category: 'Application', sizeKb: randInt(120, 500), uploadedOn: day(submitted), uploadedBy: 'SELF', verification: 'verified', simulated: true },
      ...(decidedCount >= 2 ? [{ id: `LAD-${i}-b`, name: 'Site assessment report.pdf', category: 'Assessment', sizeKb: randInt(400, 1500), uploadedOn: day(addDays(submitted, 19)), uploadedBy: FIELD, verification: 'verified', simulated: true }] : []),
    ],
    history: [
      hist(`LAH-${id}-1`, atHour(submitted, 10, 0), 'SELF', `${c.firstName} ${c.lastName}`, 'Land allocation application submitted'),
      ...decided.map((d2, idx) => hist(`LAH-${id}-${idx + 2}`, atHour(new Date(d2.on), 11, 0), d2.by, userName(d2.by), `Stage "${landWf.stages[idx].name}" ${d2.status}`, { note: d2.comment })),
    ],
  })
}

const enforcementActions = []
const overdueLeases = leases.filter((l) => l.paymentStatus === 'overdue' || l.status === 'terminated').slice(0, 4)
overdueLeases.forEach((l, i) => {
  const raised = daysAgo(randInt(20, 200))
  enforcementActions.push({
    id: `ENF-2026-${pad(100 + i, 3)}`,
    leaseId: l.id,
    clientId: l.clientId,
    type: l.status === 'terminated' ? 'eviction-notice' : pick(['warning', 'retraction-notice']),
    raisedOn: day(raised),
    raisedByUserId: SUPERVISOR,
    reason: l.status === 'terminated'
      ? 'Sustained non-compliance with lease conditions following two written warnings.'
      : pick(['Annual rent unpaid for more than 12 months.', 'Parcel left uncultivated contrary to lease condition 4(b).', 'Unauthorised sub-letting of the leased parcel.']),
    status: l.status === 'terminated' ? 'enforced' : pick(['open', 'under-review', 'upheld']),
    noticeServedOn: day(addDays(raised, 5)),
    history: [
      hist(`ENH-${i}-1`, atHour(raised, 9, 0), SUPERVISOR, userName(SUPERVISOR), 'Enforcement action raised'),
      hist(`ENH-${i}-2`, atHour(addDays(raised, 5), 9, 0), OFFICER, userName(OFFICER), 'Notice served to lessee'),
    ],
  })
})

/* ------------------------------------------------------------------ *
 * Module xiii — notification templates & notifications
 * ------------------------------------------------------------------ */

const notificationTemplates = [
  { id: 'TPL-STATUS-SMS', name: 'Application status update (SMS)', channel: 'sms', event: 'application.status.changed', subject: 'AIS status update', body: 'AIS: Your {{applicationType}} {{applicationId}} is now {{status}}. Check the portal for details.' },
  { id: 'TPL-STATUS-EMAIL', name: 'Application status update (Email)', channel: 'email', event: 'application.status.changed', subject: 'Your {{applicationType}} {{applicationId}} — status update', body: 'Dear {{firstName}},\n\nThe status of your {{applicationType}} {{applicationId}} has changed to {{status}}.\n\n{{detail}}\n\nAgriculture Information System\nDepartment of Agriculture' },
  { id: 'TPL-LAB-SMS', name: 'Laboratory results ready (SMS)', channel: 'sms', event: 'lab.results.ready', subject: 'AIS lab results', body: 'AIS: Results for sample {{sampleId}} ({{sampleType}}) are ready. Sign in to view your report.' },
  { id: 'TPL-LAB-EMAIL', name: 'Laboratory results ready (Email)', channel: 'email', event: 'lab.results.ready', subject: 'Laboratory results for sample {{sampleId}}', body: 'Dear {{firstName}},\n\nThe laboratory has completed testing on sample {{sampleId}} ({{sampleType}}) collected from {{farmName}}.\n\n{{interpretation}}\n\nThe full report is available in the portal.\n\nAgriculture Information System' },
  { id: 'TPL-LEASE-EXPIRY', name: 'Lease expiry reminder (SMS)', channel: 'sms', event: 'lease.expiring', subject: 'AIS lease reminder', body: 'AIS: Lease {{leaseId}} for parcel {{parcelRef}} expires on {{endDate}}. Contact your district office to renew.' },
  { id: 'TPL-LEASE-PAYMENT', name: 'Lease payment reminder (Email)', channel: 'email', event: 'lease.payment.due', subject: 'Lease payment due — {{leaseId}}', body: 'Dear {{firstName}},\n\nThe annual rent of SCR {{amount}} for lease {{leaseId}} is due on {{dueDate}}.\n\nAgriculture Information System' },
  { id: 'TPL-INSPECTION', name: 'Inspection scheduled (In-app)', channel: 'in-app', event: 'inspection.scheduled', subject: 'Inspection scheduled', body: 'A {{inspectionType}} inspection of {{farmName}} is scheduled for {{scheduledOn}}.' },
  { id: 'TPL-CASE', name: 'Surveillance case update (In-app)', channel: 'in-app', event: 'surveillance.case.updated', subject: 'Surveillance case {{caseId}}', body: 'Case {{caseId}} ({{disease}}) is now {{status}}.' },
]

const notifications = []
let notifSeq = 0
const notify = (n) => {
  notifSeq += 1
  notifications.push({ id: `NTF-${pad(notifSeq, 4)}`, read: false, simulated: n.channel !== 'in-app', ...n })
}

/* Marie-Ange's notification trail — the story's touchpoints. */
notify({ channel: 'sms', templateId: 'TPL-LAB-SMS', event: 'lab.results.ready', recipientClientId: MARIE.id, recipientAddress: MARIE.phone, subject: 'AIS lab results', body: 'AIS: Results for sample LAB-2026-0031 (soil) are ready. Sign in to view your report.', sentOn: iso(atHour(daysAgo(12), 14, 25)), relatedType: 'sample', relatedId: 'LAB-2026-0031' })
notify({ channel: 'email', templateId: 'TPL-LAB-EMAIL', event: 'lab.results.ready', recipientClientId: MARIE.id, recipientAddress: MARIE.email, subject: 'Laboratory results for sample LAB-2026-0031', body: 'Dear Marie-Ange,\n\nThe laboratory has completed testing on sample LAB-2026-0031 (soil) collected from Rivière Doux Farm.\n\nModerately acidic soil with good organic matter. Available phosphorus is below the target range and pH is marginally low for banana.\n\nThe full report is available in the portal.\n\nAgriculture Information System', sentOn: iso(atHour(daysAgo(12), 14, 25)), relatedType: 'sample', relatedId: 'LAB-2026-0031' })
notify({ channel: 'in-app', templateId: 'TPL-STATUS-SMS', event: 'application.status.changed', recipientClientId: MARIE.id, recipientAddress: 'In-app', subject: 'Loan application LN-2026-0014', body: 'Your loan application LN-2026-0014 has passed technical assessment and is now with the loan committee.', sentOn: iso(atHour(daysAgo(19), 15, 14)), relatedType: 'loan', relatedId: 'LN-2026-0014' })
notify({ channel: 'sms', templateId: 'TPL-STATUS-SMS', event: 'application.status.changed', recipientClientId: MARIE.id, recipientAddress: MARIE.phone, subject: 'AIS status update', body: 'AIS: Your loan application LN-2026-0014 is now under review. Check the portal for details.', sentOn: iso(atHour(daysAgo(28), 9, 31)), relatedType: 'loan', relatedId: 'LN-2026-0014' })
notify({ channel: 'in-app', templateId: 'TPL-INSPECTION', event: 'inspection.scheduled', recipientClientId: MARIE.id, recipientAddress: 'In-app', subject: 'Inspection scheduled', body: 'A loan-verification inspection of Rivière Doux Farm is scheduled for ' + day(daysAgo(20)) + '.', sentOn: iso(atHour(daysAgo(24), 8, 5)), relatedType: 'inspection', relatedId: 'INS-2026-012' })
notify({ channel: 'in-app', templateId: 'TPL-CASE', event: 'surveillance.case.updated', recipientClientId: MARIE.id, recipientAddress: 'In-app', subject: 'Surveillance case SUR-2026-004', body: 'Case SUR-2026-004 (Newcastle disease) is now sampled. Laboratory testing is in progress.', sentOn: iso(atHour(daysAgo(4), 9, 6)), relatedType: 'surveillance', relatedId: 'SUR-2026-004' })

/* Lease reminders across the registry (iv.6). */
const expiringLeases = leases.filter((l) => l.status === 'active' && new Date(l.endDate) < addDays(TODAY, 90)).slice(0, 6)
for (const l of expiringLeases) {
  const c = clients.find((x) => x.id === l.clientId)
  if (!c) continue
  notify({ channel: 'sms', templateId: 'TPL-LEASE-EXPIRY', event: 'lease.expiring', recipientClientId: c.id, recipientAddress: c.phone, subject: 'AIS lease reminder', body: `AIS: Lease ${l.id} for parcel ${l.parcelRef} expires on ${l.endDate}. Contact your district office to renew.`, sentOn: iso(atHour(daysAgo(randInt(1, 20)), 8, 0)), relatedType: 'lease', relatedId: l.id })
}
for (const l of leases.filter((x) => x.paymentStatus === 'overdue').slice(0, 5)) {
  const c = clients.find((x) => x.id === l.clientId)
  if (!c || !c.email) continue
  notify({ channel: 'email', templateId: 'TPL-LEASE-PAYMENT', event: 'lease.payment.due', recipientClientId: c.id, recipientAddress: c.email, subject: `Lease payment due — ${l.id}`, body: `Dear ${c.firstName},\n\nThe annual rent of SCR ${l.annualRentScr.toLocaleString('en-GB')} for lease ${l.id} is due on ${l.nextPaymentDue}.\n\nAgriculture Information System`, sentOn: iso(atHour(daysAgo(randInt(1, 30)), 8, 0)), relatedType: 'lease', relatedId: l.id })
}

/* Result-ready notifications for the wider registry. */
for (const s of samples.filter((x) => x.notifiedOn && x.clientId !== MARIE.id).slice(0, 10)) {
  const c = clients.find((x) => x.id === s.clientId)
  if (!c) continue
  notify({ channel: 'sms', templateId: 'TPL-LAB-SMS', event: 'lab.results.ready', recipientClientId: c.id, recipientAddress: c.phone, subject: 'AIS lab results', body: `AIS: Results for sample ${s.id} (${s.type}) are ready. Sign in to view your report.`, sentOn: iso(atHour(new Date(s.notifiedOn), 15, 0)), relatedType: 'sample', relatedId: s.id })
}

notifications.sort((a, b) => (a.sentOn < b.sentOn ? 1 : -1))
notifications.forEach((n, i) => { n.read = i > 5 })

const feedback = [
  { id: 'FB-0001', fromClientId: MARIE.id, fromName: 'Marie-Ange Hoareau', subject: 'Question about my soil test recommendation', body: 'Thank you for the results. Where can I obtain agricultural lime, and is there any subsidy available for it?', category: 'question', sentOn: iso(atHour(daysAgo(10), 19, 12)), status: 'acknowledged', response: 'Agricultural lime is available from the Grand Anse depot. A 40% input subsidy applies to smallholders under 2 ha — your district officer can process the form.', respondedOn: iso(atHour(daysAgo(9), 10, 30)) },
  { id: 'FB-0002', fromClientId: clients[6].id, fromName: `${clients[6].firstName} ${clients[6].lastName}`, subject: 'Portal login on mobile', body: 'The registration page is difficult to complete on a small phone screen. Could the form be simplified?', category: 'suggestion', sentOn: iso(atHour(daysAgo(22), 12, 0)), status: 'new' },
  { id: 'FB-0003', fromClientId: clients[11].id, fromName: `${clients[11].firstName} ${clients[11].lastName}`, subject: 'Delay on lease renewal', body: 'I submitted my renewal two months ago and have not had a response from the district office.', category: 'complaint', sentOn: iso(atHour(daysAgo(35), 9, 45)), status: 'resolved', response: 'Apologies for the delay. Your renewal was completed and the updated lease is now visible in your portal.', respondedOn: iso(atHour(daysAgo(30), 14, 0)) },
  { id: 'FB-0004', fromClientId: clients[19].id, fromName: `${clients[19].firstName} ${clients[19].lastName}`, subject: 'Requesting a water sample test', body: 'How long does a water quality test usually take once the sample is collected?', category: 'question', sentOn: iso(atHour(daysAgo(6), 16, 20)), status: 'new' },
]

/* ------------------------------------------------------------------ *
 * Module xiv — digitized documents & migration validation
 * ------------------------------------------------------------------ */

const documents = []
const SWATCHES = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'd1', 'd2']

documents.push({
  id: 'DOC-2019-0044',
  title: 'Lease Agreement — Parcel PR/AB/1042 — M. Hoareau (2019)',
  category: 'lease',
  clientId: MARIE.id,
  farmId: MARIE_FARM.id,
  originalDate: '2019-07-01',
  scannedOn: day(daysAgo(140)),
  scannedByUserId: ADMIN,
  pages: 6,
  tags: ['lease', 'Anse Boileau', 'PR/AB/1042', 'state land', 'Hoareau', '2019'],
  ocrText:
    'REPUBLIC OF SEYCHELLES DEPARTMENT OF AGRICULTURE AGRICULTURAL LEASE AGREEMENT made this first day of July two thousand and nineteen BETWEEN the Government of Seychelles (the Lessor) AND Marie Ange Hoareau of Riviere Doux, Anse Boileau, Mahe (the Lessee) WHEREAS the Lessor is desirous of leasing the parcel known as PR/AB/1042 measuring one point six hectares situated at Anse Boileau on the island of Mahe for agricultural purposes TERM ten years commencing 1 July 2019 and expiring 30 June 2029 ANNUAL RENT two thousand four hundred Seychelles Rupees payable in advance CONDITIONS the Lessee shall cultivate the parcel continuously shall not sub-let without written consent and shall maintain the watercourse buffer of not less than fifteen metres SIGNED for and on behalf of the Department of Agriculture',
  migrationBatch: 'MIG-2019-A',
  validation: 'pass',
  swatch: 'a1',
  simulated: true,
})

const DOC_SPECS = [
  { title: 'Smallholder Register — Anse Boileau (1998 volume 3)', category: 'land-record', tags: ['register', 'Anse Boileau', '1998'], text: 'SMALLHOLDER REGISTER ANSE BOILEAU DISTRICT VOLUME THREE entries numbered two hundred and eleven to three hundred and forty holdings recorded by the district agricultural assistant parcel references acreage in arpents and names of occupiers as at thirty first December nineteen ninety eight' },
  { title: 'Farm Registration Form — Grand Anse Mahé (2016)', category: 'registration-form', tags: ['registration', 'Grand Anse Mahé', '2016'], text: 'DEPARTMENT OF AGRICULTURE FARM REGISTRATION FORM applicant details holding name area under cultivation principal crops banana cassava sweet potato livestock kept number of head water source rainwater tank declaration signed by applicant and countersigned by the district officer' },
  { title: 'Agricultural Loan File — Ledger 7 (2014–2017)', category: 'loan-file', tags: ['loan', 'ledger', '2014', '2017'], text: 'AGRICULTURAL CREDIT SCHEME LEDGER SEVEN advances to smallholders for irrigation equipment poultry housing and planting material amounts in Seychelles Rupees repayment schedules and arrears noted in the right hand column certified correct by the scheme accountant' },
  { title: 'Water Sample Report — Baie Lazare Borehole (2018)', category: 'lab-report', tags: ['laboratory', 'water', 'Baie Lazare', '2018'], text: 'LABORATORY REPORT WATER SAMPLE borehole at Baie Lazare pH seven point one turbidity one point four NTU nitrate two point three milligrams per litre E coli not detected total dissolved solids three hundred and twelve milligrams per litre sample fit for irrigation use analyst signature' },
  { title: 'Lease Agreement — Parcel PR/AR/2210 (2012)', category: 'lease', tags: ['lease', 'Anse Royale', 'PR/AR/2210', '2012'], text: 'AGRICULTURAL LEASE AGREEMENT parcel PR AR 2210 Anse Royale measuring two point four hectares term fifteen years commencing first March two thousand and twelve annual rent three thousand six hundred rupees lessee shall maintain boundary markers and shall permit inspection by authorised officers' },
  { title: 'Livestock Movement Permit — Praslin (2020)', category: 'permit', tags: ['permit', 'livestock', 'Praslin', '2020'], text: 'LIVESTOCK MOVEMENT PERMIT authorising the movement of twelve goats from Baie Ste Anne Praslin to Mahe subject to veterinary inspection at the point of embarkation permit valid for seven days from date of issue veterinary officer signature and stamp' },
  { title: 'Land Allocation Minute — Allocation Committee (2015)', category: 'land-record', tags: ['land', 'committee', 'minute', '2015'], text: 'MINUTES OF THE LAND ALLOCATION COMMITTEE meeting held at the Department of Agriculture present the chairman the district officers and the land surveyor eleven applications considered six approved three deferred pending site assessment two rejected on grounds of competing public purpose' },
  { title: 'Soil Survey Extract — Anse Aux Pins (2009)', category: 'lab-report', tags: ['soil', 'survey', 'Anse Aux Pins', '2009'], text: 'SOIL SURVEY OF MAHE EXTRACT ANSE AUX PINS soils of the coastal plateau are predominantly sandy clay loams of moderate fertility with pH between five point two and six point one organic matter content declining under continuous cultivation liming recommended on the more acid phases' },
  { title: 'Correspondence — Irrigation Scheme Enquiry (2017)', category: 'correspondence', tags: ['correspondence', 'irrigation', '2017'], text: 'letter from the district agricultural officer to the principal secretary concerning the extension of the irrigation main to serve seven smallholdings at Val d Endor estimated cost and proposed timetable attached for consideration' },
  { title: 'Farm Registration Form — La Digue (2013)', category: 'registration-form', tags: ['registration', 'La Digue', '2013'], text: 'FARM REGISTRATION FORM La Digue district holding of zero point eight hectares principal crops breadfruit papaya and chilli six goats kept water source rainwater collection declaration signed thirteenth of May two thousand and thirteen' },
  { title: 'Pesticide Import Permit — Cooperative (2021)', category: 'permit', tags: ['permit', 'pesticide', 'cooperative', '2021'], text: 'PERMIT TO IMPORT PLANT PROTECTION PRODUCTS issued to the growers cooperative for the importation of approved fungicide formulations quantities and active ingredients as scheduled overleaf permit subject to the conditions of the plant protection act' },
  { title: 'Lease Payment Register — 2011 to 2015', category: 'land-record', tags: ['lease', 'payments', 'register', '2011'], text: 'LEASE PAYMENT REGISTER annual rents received in respect of agricultural leases receipt numbers dates and amounts entered chronologically arrears carried forward and noted in red certified by the revenue clerk' },
  { title: 'Loan Application — Poultry Housing (2016)', category: 'loan-file', tags: ['loan', 'poultry', '2016'], text: 'APPLICATION FOR AGRICULTURAL CREDIT purpose construction of a poultry house of one hundred and fifty square metres amount requested sixty thousand rupees term thirty six months security the applicant holding and the proposed structure supporting quotations attached' },
  { title: 'Plant Health Certificate — Banana Suckers (2019)', category: 'permit', tags: ['plant health', 'banana', '2019'], text: 'PHYTOSANITARY CERTIFICATE certifying that the banana planting material described below has been inspected and is considered free from quarantine pests and conforms with the current phytosanitary requirements of the importing country' },
  { title: 'Correspondence — Newcastle Disease Advisory (2022)', category: 'correspondence', tags: ['correspondence', 'newcastle', 'veterinary', '2022'], text: 'circular to all registered poultry keepers advising on the signs of newcastle disease respiratory distress greenish diarrhoea nervous signs and sudden mortality keepers are reminded of the vaccination schedule and are required to report suspected cases to the veterinary services without delay' },
]

DOC_SPECS.forEach((spec, i) => {
  const c = pick(farmerClients)
  const year = Number((spec.tags.find((t) => /^\d{4}$/.test(t))) ?? 2016)
  const validation = i === 4 ? 'warn' : i === 10 ? 'fail' : 'pass'
  documents.push({
    id: `DOC-${year}-${pad(100 + i, 4)}`,
    title: spec.title,
    category: spec.category,
    clientId: chance(0.6) ? c.id : undefined,
    farmId: undefined,
    originalDate: `${year}-${pad(randInt(1, 12), 2)}-${pad(randInt(1, 28), 2)}`,
    scannedOn: day(daysAgo(randInt(120, 260))),
    scannedByUserId: ADMIN,
    pages: randInt(1, 24),
    tags: spec.tags,
    ocrText: spec.text,
    migrationBatch: year < 2015 ? 'MIG-2019-A' : year < 2020 ? 'MIG-2019-B' : 'MIG-2026-C',
    validation,
    validationNote: validation === 'warn' ? 'Parcel reference could not be matched to a registered farm.'
      : validation === 'fail' ? 'Scanned pages 3–4 illegible; document flagged for re-scanning.' : undefined,
    swatch: SWATCHES[i % SWATCHES.length],
    simulated: true,
  })
})

const migratedClients = clients.filter((c) => c.registeredVia === 'migrated').length
const migratedFarms = farms.filter((f) => f.registeredVia === 'migrated').length

const migrationBatches = [
  {
    id: 'MIG-2019-A',
    name: 'Legacy smallholder register (1998–2014)',
    source: 'Paper district registers, volumes 1–7',
    runOn: day(daysAgo(150)),
    recordsRead: migratedClients + migratedFarms + 18,
    recordsMigrated: migratedClients + migratedFarms + 15,
    recordsRejected: 3,
    checks: [
      { id: 'CHK-A1', name: 'Client record count', description: 'Migrated client records equal the source register count.', expected: migratedClients, actual: migratedClients, result: 'pass' },
      { id: 'CHK-A2', name: 'NIN format', description: 'Every migrated NIN matches the national format.', expected: migratedClients, actual: migratedClients, result: 'pass' },
      { id: 'CHK-A3', name: 'Duplicate detection', description: 'Candidate duplicates flagged for officer review rather than auto-merged.', expected: 1, actual: 1, result: 'warn', note: 'CLT-2019-0311 flagged as a candidate duplicate of CLT-2026-0001; awaiting officer confirmation.' },
      { id: 'CHK-A4', name: 'Orphan farm records', description: 'Every migrated farm resolves to a client record.', expected: 0, actual: 0, result: 'pass' },
      { id: 'CHK-A5', name: 'Illegible source pages', description: 'Source pages that could not be transcribed.', expected: 0, actual: 3, result: 'fail', note: '3 register entries illegible; originals retained for manual re-keying.' },
    ],
  },
  {
    id: 'MIG-2019-B',
    name: 'Lease and land allocation files (2015–2019)',
    source: 'District land files and allocation minutes',
    runOn: day(daysAgo(146)),
    recordsRead: leases.length + landApplications.length,
    recordsMigrated: leases.length + landApplications.length - 1,
    recordsRejected: 1,
    checks: [
      { id: 'CHK-B1', name: 'Lease term validity', description: 'Every lease has a start date earlier than its end date.', expected: leases.length, actual: leases.length, result: 'pass' },
      { id: 'CHK-B2', name: 'Parcel reference format', description: 'Parcel references match the PR/DD/NNNN pattern.', expected: leases.length, actual: leases.length, result: 'pass' },
      { id: 'CHK-B3', name: 'Rent amount present', description: 'Annual rent recorded for every lease.', expected: leases.length, actual: leases.length - 1, result: 'warn', note: '1 legacy lease carried no legible rent figure; defaulted and flagged.' },
    ],
  },
  {
    id: 'MIG-2026-C',
    name: 'Scanned document backlog (2020–2025)',
    source: 'Departmental scanning programme',
    runOn: day(daysAgo(38)),
    recordsRead: documents.length,
    recordsMigrated: documents.filter((d) => d.validation !== 'fail').length,
    recordsRejected: documents.filter((d) => d.validation === 'fail').length,
    checks: [
      { id: 'CHK-C1', name: 'Index metadata complete', description: 'Category and at least three tags on every document.', expected: documents.length, actual: documents.length, result: 'pass' },
      { id: 'CHK-C2', name: 'Full-text extraction', description: 'Searchable text extracted for every scanned document.', expected: documents.length, actual: documents.length, result: 'pass' },
      { id: 'CHK-C3', name: 'Page legibility', description: 'All scanned pages legible at 300 dpi.', expected: documents.length, actual: documents.filter((d) => d.validation !== 'fail').length, result: 'fail', note: '1 document flagged for re-scanning.' },
    ],
  },
]

/* ------------------------------------------------------------------ *
 * Module i / xi — hash-chained audit log
 * ------------------------------------------------------------------ */

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex')
const auditPayload = (e) =>
  `${e.seq}|${e.at}|${e.actorUserId}|${e.actorRole}|${e.action}|${e.entityType}|${e.entityId}|${e.detail}|${e.prevHash}`

const auditDrafts = []
const pushAudit = (at, actorUserId, action, entityType, entityId, detail) => {
  const u = users.find((x) => x.id === actorUserId)
  auditDrafts.push({
    at: iso(at),
    actorUserId,
    actorName: u?.fullName ?? 'System',
    actorRole: u?.role ?? 'admin',
    action,
    entityType,
    entityId,
    detail,
  })
}

/* Logins across the last fortnight (i.7). */
for (let d = 14; d >= 0; d--) {
  for (const u of users) {
    if (chance(0.55)) {
      pushAudit(atHour(daysAgo(d), randInt(7, 17), randInt(0, 59)), u.id, 'auth.login.success', 'user', u.id, `Signed in (${u.role})`)
    }
  }
  if (chance(0.4)) {
    const u = pick(users)
    pushAudit(atHour(daysAgo(d), randInt(7, 17), randInt(0, 59)), u.id, 'auth.login.failed', 'user', u.id, 'Failed sign-in attempt — incorrect password')
  }
}

/* Workflow and record actions matching the story (xi.4). */
pushAudit(atHour(daysAgo(58), 9, 12), 'USR-006', 'client.created', 'client', MARIE.id, 'Self-registration completed via public portal')
pushAudit(atHour(daysAgo(58), 9, 13), 'USR-006', 'client.verified', 'client', MARIE.id, 'NIN verified against SeyID (simulated)')
pushAudit(atHour(daysAgo(54), 10, 20), OFFICER, 'farm.created', 'farm', MARIE_FARM.id, 'Farm registered — Rivière Doux Farm, 1.6 ha, Anse Boileau')
pushAudit(atHour(daysAgo(54), 10, 26), OFFICER, 'client.duplicate.merged', 'client', MARIE.id, 'Legacy record CLT-2019-0311 merged into CLT-2026-0001')
pushAudit(atHour(daysAgo(32), 14, 5), 'USR-006', 'loan.submitted', 'loan', 'LN-2026-0014', 'Loan application submitted — SCR 85,000 over 48 months')
pushAudit(atHour(daysAgo(28), 9, 30), OFFICER, 'loan.status.changed', 'loan', 'LN-2026-0014', 'Status changed from submitted to under-review')
pushAudit(atHour(daysAgo(24), 8, 40), 'USR-006', 'sample.requested', 'sample', 'LAB-2026-0031', 'Soil sampling requested via farmer portal')
pushAudit(atHour(daysAgo(24), 8, 0), SUPERVISOR, 'inspection.scheduled', 'inspection', 'INS-2026-012', 'Loan-verification inspection assigned to R. Confait')
pushAudit(atHour(daysAgo(20), 10, 5), LAB, 'sample.registered', 'sample', 'LAB-2026-0031', 'Sample registered at laboratory')
pushAudit(atHour(daysAgo(19), 15, 12), OFFICER, 'workflow.stage.approved', 'loan', 'LN-2026-0014', 'Stage "Technical assessment" approved — routed to loan committee')
pushAudit(atHour(daysAgo(19), 16, 42), FIELD, 'inspection.synced', 'inspection', 'INS-2026-012', 'Offline submission synchronised from device (simulated)')
pushAudit(atHour(daysAgo(16), 10, 6), OFFICER, 'stall.allocated', 'vendor', 'VND-2026-009', 'Stall VM-A04 allocated at Victoria Market')
pushAudit(atHour(daysAgo(12), 14, 20), LAB, 'sample.results.entered', 'sample', 'LAB-2026-0031', 'Results entered and validated (6 parameters)')
pushAudit(atHour(daysAgo(12), 14, 25), LAB, 'notification.sent', 'sample', 'LAB-2026-0031', 'Applicant notified by SMS and email (simulated)')
pushAudit(atHour(daysAgo(9), 10, 30), OFFICER, 'livestock.visit.recorded', 'livestock_visit', 'LSV-2026-0018', 'Routine broiler visit recorded at Rivière Doux Farm')
pushAudit(atHour(daysAgo(6), 7, 55), 'USR-006', 'surveillance.case.reported', 'surveillance', 'SUR-2026-004', 'Suspected Newcastle disease reported via farmer portal')
pushAudit(atHour(daysAgo(6), 9, 10), SUPERVISOR, 'surveillance.case.assigned', 'surveillance', 'SUR-2026-004', 'Case assigned to J. Payet')
pushAudit(atHour(daysAgo(5), 13, 40), OFFICER, 'surveillance.case.linked', 'surveillance', 'SUR-2026-004', `Laboratory submission ${NCD_SAMPLE_ID} linked to case`)
pushAudit(atHour(daysAgo(120), 11, 0), ADMIN, 'workflow.definition.updated', 'workflow', 'loan-approval', 'Approval hierarchy updated — 2 stages configured')
pushAudit(atHour(daysAgo(3), 9, 0), ADMIN, 'user.created', 'user', 'USR-008', 'Field officer account created for T. Larue')
pushAudit(atHour(daysAgo(2), 15, 30), ADMIN, 'user.role.changed', 'user', 'USR-007', 'Role set to Agriculture Officer')

auditDrafts.sort((a, b) => (a.at < b.at ? -1 : 1))
const audit = []
let prevHash = '0'.repeat(64)
auditDrafts.forEach((d, i) => {
  const e = { id: `AUD-${pad(i + 1, 5)}`, seq: i + 1, ...d, prevHash }
  e.hash = sha256(auditPayload(e))
  prevHash = e.hash
  audit.push(e)
})

/* ------------------------------------------------------------------ *
 * Security policy (i.1)
 * ------------------------------------------------------------------ */

const securityPolicy = {
  minPasswordLength: 10,
  requireUppercase: true,
  requireNumber: true,
  requireSymbol: true,
  maxFailedLogins: 5,
  lockoutMinutes: 15,
  sessionTimeoutMinutes: 20,
  require2fa: false,
}

/* ------------------------------------------------------------------ *
 * Configurable farm-registration intake fields (iii.3)
 * ------------------------------------------------------------------ */

const intakeFields = [
  { id: 'name', label: 'Holding name', kind: 'text', core: true, enabled: true, required: true, help: 'The name the farmer uses for the holding.' },
  { id: 'parcelRef', label: 'Parcel reference', kind: 'text', core: true, enabled: true, required: true, help: 'Format PR/DD/NNNN. Used by the duplicate check.', refs: ['iii.7'] },
  { id: 'sizeHa', label: 'Farm size', kind: 'number', core: true, enabled: true, required: true, unit: 'ha', refs: ['iii.3'] },
  { id: 'tenure', label: 'Tenure', kind: 'select', core: true, enabled: true, required: true, options: TENURES, refs: ['iii.3'] },
  { id: 'crops', label: 'Crop activity', kind: 'multiselect', core: true, enabled: true, required: false, options: CROPS, refs: ['iii.3'] },
  { id: 'livestock', label: 'Livestock activity', kind: 'multiselect', core: true, enabled: true, required: false, options: LIVESTOCK, refs: ['iii.3'] },
  { id: 'waterSource', label: 'Water source', kind: 'select', core: false, enabled: true, required: false, options: WATER },
  { id: 'irrigation', label: 'Irrigation method', kind: 'select', core: false, enabled: false, required: false, options: ['none', 'drip', 'sprinkler', 'furrow', 'manual'], help: 'Optional — switched off by default.' },
  { id: 'organic', label: 'Organic certification', kind: 'select', core: false, enabled: false, required: false, options: ['none', 'in conversion', 'certified'], help: 'Optional — switched off by default.' },
  { id: 'notes', label: 'Officer notes', kind: 'textarea', core: false, enabled: true, required: false },
]

/* ------------------------------------------------------------------ *
 * Write
 * ------------------------------------------------------------------ */

const write = (name, data) => {
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2) + '\n', 'utf8')
  const n = Array.isArray(data) ? data.length : Object.keys(data).length
  console.log(`  ${name.padEnd(28)} ${String(n).padStart(4)} ${Array.isArray(data) ? 'records' : 'keys'}`)
}

console.log('Generating fictional demonstration data…')
write('users.json', users)
write('clients.json', clients)
write('farms.json', farms)
write('land_applications.json', landApplications)
write('leases.json', leases)
write('enforcement_actions.json', enforcementActions)
write('loans.json', loans)
write('samples.json', samples)
write('livestock_visits.json', livestockVisits)
write('surveillance_cases.json', surveillanceCases)
write('vendors.json', vendors)
write('stalls.json', stalls)
write('inspections.json', inspections)
write('workflows.json', workflows)
write('notifications.json', notifications)
write('notification_templates.json', notificationTemplates)
write('feedback.json', feedback)
write('documents.json', documents)
write('migration_batches.json', migrationBatches)
write('audit.json', audit)
write('security_policy.json', securityPolicy)
write('intake_fields.json', intakeFields)

/* --------------------------- assertions --------------------------- */

const problems = []
const check = (cond, msg) => { if (!cond) problems.push(msg) }

check(clients.length >= 60 && clients.length <= 80, `clients out of range: ${clients.length}`)
check(farms.length >= 50 && farms.length <= 70, `farms out of range: ${farms.length}`)
check(clients.every((c) => c.nin.startsWith('999-')), 'a NIN is missing the 999- prefix')
check(clients.every((c) => /^\+248 2 000 0\d{2}$/.test(c.phone)), 'a client phone breaks the +248 2 000 0xx pattern')
check(users.every((u) => /^\+248 2 000 0\d{2}$/.test(u.phone)), 'a user phone breaks the +248 2 000 0xx pattern')
check(vendors.every((v) => /^\+248 2 000 0\d{2}$/.test(v.phone)), 'a vendor phone breaks the +248 2 000 0xx pattern')
check(new Set(clients.map((c) => c.id)).size === clients.length, 'duplicate client id')
check(new Set(farms.map((f) => f.id)).size === farms.length, 'duplicate farm id')
check(farms.every((f) => clients.some((c) => c.id === f.clientId)), 'orphan farm (no client)')
check(loans.every((l) => farms.some((f) => f.id === l.farmId)), 'orphan loan (no farm)')
check(samples.every((s) => farms.some((f) => f.id === s.farmId)), 'orphan sample (no farm)')
check(livestockVisits.every((v) => farms.some((f) => f.id === v.farmId)), 'orphan livestock visit')
check(surveillanceCases.every((s) => farms.some((f) => f.id === s.farmId)), 'orphan surveillance case')
check(inspections.every((i2) => farms.some((f) => f.id === i2.farmId)), 'orphan inspection')
check(leases.every((l) => clients.some((c) => c.id === l.clientId)), 'orphan lease')
check(farms.every((f) => f.lat < -4.2 && f.lat > -4.85 && f.lng > 55.3 && f.lng < 55.9), 'a farm pin is outside the Seychelles bounding box')
check(audit.length > 0 && audit[0].prevHash === '0'.repeat(64), 'audit chain does not start from the zero hash')
let chainOk = true
let ph = '0'.repeat(64)
for (const e of audit) {
  if (e.prevHash !== ph || e.hash !== sha256(auditPayload(e))) { chainOk = false; break }
  ph = e.hash
}
check(chainOk, 'audit hash chain does not verify')
check(samples.some((s) => s.id === 'LAB-2026-0031' && s.status === 'completed'), 'story sample missing')
check(loans.some((l) => l.id === 'LN-2026-0014' && l.amountScr === 85000), 'story loan missing')
check(stalls.some((s) => s.id === 'VM-A04' && s.vendorId === 'VND-2026-009'), 'story stall allocation missing')
check(documents.some((d) => d.id === 'DOC-2019-0044'), 'story lease scan missing')

console.log('')
if (problems.length) {
  console.error('Seed validation FAILED:')
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log(`✓ Seed validated — ${clients.length} clients, ${farms.length} farms, ${loans.length} loans, ${samples.length} samples, ${audit.length} audit entries.`)
console.log('✓ All NINs use the fictional 999- prefix; all phones use +248 2 000 0xx.')
