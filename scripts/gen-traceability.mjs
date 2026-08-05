// Generates TRACEABILITY.md from src/lib/refs.ts (single source of truth for the
// 91 Appendix A6 rows). Run: node scripts/gen-traceability.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = readFileSync(join(root, 'src', 'lib', 'refs.ts'), 'utf8');

const MODULES = {
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
  xiv: 'Data Digitization & Document Management',
};
const MODULE_ORDER = Object.keys(MODULES);
const WAVE = { i: 'A', ii: 'A', iii: 'A', xi: 'A', iv: 'B', v: 'B', vi: 'B', vii: 'C', viii: 'C', ix: 'C', x: 'C', xii: 'D', xiii: 'D', xiv: 'D' };

const VERIFIED_MODULES = new Set(['i', 'ii', 'iii', 'xi']);
const BUILT_REFS = new Set(['xii.1', 'xii.2', 'xii.3', 'xii.4']);

const DEMO = {
  'i.1': 'Login: policy hint; 5 wrong tries → lockout counter',
  'i.2': 'S11 → RBAC matrix (roles × screens)',
  'i.3': 'S11 → Users: create / change role / deactivate',
  'i.4': 'Login → Self-register a farmer',
  'i.5': 'S02 → Register client (officer-assisted)',
  'i.6': 'Login → Forgot password (email/SMS OTP, simulated)',
  'i.7': 'S11 → Audit log, filter by category',
  'i.8': 'Login → Continue with SeyID / 2FA OTP (simulated)',
  'ii.1': 'S02 master registry',
  'ii.2': 'S02 → profile → Overview',
  'ii.3': 'S02 profile: NIN + SeyID-verified badge',
  'ii.4': 'S02 profile → Edit; recorded in History',
  'ii.5': 'S02 profile: linked farms/loans/lab/livestock',
  'ii.6': 'S02 search + district/type filters',
  'ii.7': 'S02 → Duplicates: merge the Marie-Ange pair',
  'iii.1': 'S03 → Register farm (officer / online)',
  'iii.2': 'S03 drag GPS pin / use my location (sim)',
  'iii.3': 'S03 size, tenure, crop & livestock chips',
  'iii.4': 'S03 attach documents (simulated)',
  'iii.5': 'S03 Farm ID auto-generated on save',
  'iii.6': 'S03 farm linked two-way to client',
  'iii.7': 'S03 duplicate warning: same owner / nearby GPS',
  'xi.1': 'S11 → Workflows: metadata stage engine',
  'xi.2': 'Loan status states surfaced from workflow',
  'xi.3': 'Switch demo user → nav/routes change',
  'xi.4': 'S11 → Audit log: workflow actions',
  'xi.5': 'Farmer login cannot reach /app (403)',
  'xi.6': 'S11 → Workflows: edit stages, no redeploy',
  'xii.1': 'S12 dashboard KPI cards',
  'xii.2': 'S12 farmers & farms KPI',
  'xii.3': 'S12 loans KPI',
  'xii.4': 'S12 samples & cases KPI',
};

// Parse each `'ref': { ... }` block (entries contain no nested braces).
const re = /'([ivx]+\.\d+)':\s*\{([\s\S]*?)\}/g;
const rows = [];
let m;
while ((m = re.exec(src))) {
  const ref = m[1];
  const block = m[2];
  const module = /module:\s*'(\w+)'/.exec(block)?.[1] ?? '';
  const text = /text:\s*'((?:[^'\\]|\\.)*)'/.exec(block)?.[1] ?? '';
  const screens = (/screens:\s*\[([^\]]*)\]/.exec(block)?.[1] ?? '')
    .split(',')
    .map((s) => s.trim().replace(/'/g, ''))
    .filter(Boolean);
  const exceeds = /exceeds:\s*true/.test(block);
  rows.push({ ref, module, text, screens, exceeds });
}

const statusOf = (r) =>
  VERIFIED_MODULES.has(r.module) ? 'verified' : BUILT_REFS.has(r.ref) ? 'built' : 'planned';

const counts = { verified: 0, built: 0, planned: 0 };
rows.forEach((r) => (counts[statusOf(r)] += 1));

let out = `# TRACEABILITY — Appendix A6 (91 requirements)

> Generated from \`src/lib/refs.ts\`. Do not hand-edit; run \`node scripts/gen-traceability.mjs\`.
> ★ = the bid promised to **exceed** this requirement; the extra must be visibly demonstrated.

**Status:** ${counts.verified} verified · ${counts.built} built · ${counts.planned} planned · ${rows.length} total.
Legend — \`verified\`: built & checked in the browser · \`built\`: present, pending final check · \`planned\`: scheduled in a later wave.

`;

for (const key of MODULE_ORDER) {
  const modRows = rows.filter((r) => r.module === key);
  if (!modRows.length) continue;
  out += `## Module ${key} — ${MODULES[key]} _(Wave ${WAVE[key]})_\n\n`;
  out += `| Ref | Requirement | Screen(s) | Demo step | Status |\n|---|---|---|---|---|\n`;
  for (const r of modRows) {
    const demo = DEMO[r.ref] ?? `Planned (Wave ${WAVE[r.module]})`;
    out += `| ${r.ref}${r.exceeds ? ' ★' : ''} | ${r.text} | ${r.screens.join(', ')} | ${demo} | ${statusOf(r)} |\n`;
  }
  out += '\n';
}

writeFileSync(join(root, 'TRACEABILITY.md'), out);
console.log(`TRACEABILITY.md written: ${rows.length} rows (${counts.verified} verified, ${counts.built} built, ${counts.planned} planned)`);
