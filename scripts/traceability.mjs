/**
 * Regenerates TRACEABILITY.md from src/lib/refs.ts.
 *
 *   node --experimental-strip-types scripts/traceability.mjs
 *
 * The 91 requirement rows live in exactly one place (refs.ts, which also drives
 * the in-app `?refs=1` badges), so the matrix cannot drift from the build.
 * Only the demo step and status columns are maintained here.
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MODULES, REQUIREMENTS, compareRefs } from '../src/lib/refs.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'TRACEABILITY.md')

/**
 * status: planned → built → verified (CLAUDE.md §7.2).
 *   verified — walked in the browser at 390 px and 1366 px, behaves as described
 *   built    — code and data present, owning screen not yet delivered
 *   planned  — scheduled for a later wave
 */
const STATUS = {
  /* ---- Wave A — delivered and verified -------------------------------- */
  'i.1': ['verified', 'A', 'S01 sign-in: enter a wrong password → live "N attempts remaining" counter; Account-security panel states the salted-PBKDF2 storage, lockout and 20-minute session timeout. S11 → Security policy edits all four values.'],
  'i.2': ['verified', 'A', 'S11 → Roles & permissions: the six-role matrix. It is the same table the router reads.'],
  'i.3': ['verified', 'A', 'S11 → User accounts: Create account, Modify (role / 2FA), Deactivate, Reactivate.'],
  'i.4': ['verified', 'A', 'S01 → Register as a farmer: SeyID path or manual path, ending in a new client + portal account.'],
  'i.5': ['verified', 'A', 'S02 → Register a client: back-office intake with SeyID verify and live duplicate check.'],
  'i.6': ['verified', 'A', 'S01 → Forgotten your password: passcode → new password → lockout cleared. S11 → Reset password issues a temporary credential.'],
  'i.7': ['verified', 'A', 'S11 → Audit log: "Audit chain verified — all N entries recomputed". Filter by actor and action type.'],
  'i.8': ['verified', 'A', 'S01 → Sign in with SeyID (NIN 999-0412-1-1-07) → OTP dialog. Any 2FA-enabled account shows the same step after its password.'],

  'ii.1': ['verified', 'A', 'S02 client registry — 72 seeded clients across seven districts.'],
  'ii.2': ['verified', 'A', 'S02 → open a client → Overview → Personal and contact information.'],
  'ii.3': ['verified', 'A', 'S02 profile shows the NIN with a SeyID-verified chip; S02 registration and S01 both verify against SeyID (simulated).'],
  'ii.4': ['verified', 'A', 'S02 → Edit profile → change the mobile number → Change history tab records field, old value, new value, officer and timestamp.'],
  'ii.5': ['verified', 'A', 'S02 → Overview → "Linked records across the system": farms, loans, laboratory, livestock, surveillance, leases, land, inspections, vendor, documents — all resolved by Client ID.'],
  'ii.6': ['verified', 'A', 'S02 search box (name, NIN, Client ID, mobile, email, address) plus district / channel / status / SeyID facets.'],
  'ii.7': ['verified', 'A', 'S02 banner flags CLT-2019-0311 against CLT-2026-0001 (NIN exact, name identical, DOB same) → Review → Merge → linked records reassigned, legacy record retired not deleted.'],

  'iii.1': ['verified', 'A', 'S03 → Register a farm → Intake channel: back-office or online submission, recorded on the record.'],
  'iii.2': ['verified', 'A', 'S03 map: drag the pin, tap the map, or "Use my location" (simulated fix). Coordinates shown; S03 Map tab plots the whole registry.'],
  'iii.3': ['verified', 'A', 'S03 → Holding details, rendered from the intake configuration ("8 of 10 intake fields enabled"). Toggle a field in S11 → Farm intake fields and the form changes.'],
  'iii.4': ['verified', 'A', 'S03 → Supporting documents (upload simulated); S03 farm profile → Documents → Mark as verified.'],
  'iii.5': ['verified', 'A', 'S03 → Farm identification panel shows the next Farm ID (FRM-2026-000NN) before saving.'],
  'iii.6': ['verified', 'A', 'S03 → Farmer panel links by Client ID; the saved farm carries a link back to the client, and the client profile lists the farm.'],
  'iii.7': ['verified', 'A', 'S03 → set the pin near Rivière Doux Farm → "nearby registration to check" with parcel / GPS distance / owner reasons. A high-confidence match blocks saving until the officer records an override.'],

  'xi.3': ['verified', 'A', 'S11 → Roles & permissions, enforced by RequirePermission on every route.'],
  'xi.4': ['verified', 'A', 'S11 → Audit log includes workflow and record actions alongside sign-ins; the hash chain is recomputed on view.'],
  'xi.5': ['verified', 'A', 'Sign in as farmer@demo and open #/clients → Access denied page naming the role and the path.'],

  /* ---- Workflow engine — proven once S04 and S05 exercised it ---------- */
  'xi.1': ['verified', 'B', 'One engine (src/lib/workflow.ts) drives both the two-stage loan approval and the three-stage land allocation from stored definitions — S05 and S04 decisions run through it.'],
  'xi.2': ['verified', 'B', 'Pending / under-review / approved / rejected tracked and displayed on S04, S05, S01 and S02, with stage-level status inside each application.'],

  /* ---- Wave B — delivered and verified -------------------------------- */
  'iv.1': ['verified', 'B', 'S04 → Allocation applications → open one → the three-stage workflow (eligibility screening → site assessment → allocation decision) with its status tracker.'],
  'iv.2': ['verified', 'B', 'S04 application → the decision panel appears only for the role the current stage names; approving routes to the next stage and notifies the applicant.'],
  'iv.3': ['verified', 'B', 'S04 application → Assessments → "Record an assessment": soil suitability, slope, water access, access road and recommendation. Overview carries the parcel map with neighbouring holdings in grey.'],
  'iv.4': ['verified', 'B', 'S04 application → Documents: assessment reports and site plans, upload simulated, with verification status.'],
  'iv.5': ['verified', 'B', 'S04 → Lease register; open a lease for its terms, or approve an allocation and use "Issue lease" to create one.'],
  'iv.6': ['verified', 'B', 'S04 KPI tiles show leases expiring within 90 days and payments overdue; the banner issues bulk expiry and payment reminders (SMS/email, simulated) and writes one audit entry. Export PDF/Excel produces the lease register report.'],
  'iv.7': ['verified', 'B', 'S04 lease → Enforcement: the three-step ladder — written warning → retraction notice → eviction notice. Raising a notice serves it, notifies the lessee, and an eviction terminates the lease while retaining the record.'],
  'iv.8': ['verified', 'B', 'S04 application → History, and S04 lease → History and Enforcement history: append-only timelines with actor and timestamp.'],

  'v.1': ['verified', 'B', 'S01 portal → "Apply for a loan" → S05 application form. Identity and holdings resolve from the client record; only the borrowing is asked for.'],
  'v.2': ['verified', 'B', 'S05 application → Supporting documents (upload simulated); S05 detail → Document checklist marks Identity, Business plan and Financial as present, pending or missing.'],
  'v.3': ['verified', 'B', 'S05 detail → Approval workflow. Sign in as officer@demo on LN-2026-0014 and the controls are withheld with an explanation; sign in as supervisor@demo and the committee decision is available — per-stage actors, from the workflow definition.'],
  'v.4': ['verified', 'B', 'S05 status tracker end to end, mirrored on S01 and on the client profile; the pipeline can be filtered by status or by awaiting stage.'],
  'v.5': ['verified', 'B', 'S05 detail → Audit trail: the per-application timeline beside the hash-chained central audit entries that reference the application.'],
  'v.6': ['verified', 'B', 'S05 → Export PDF / Export Excel produce the loan monitoring report over the current filter, with the fictional-data notice on every page.'],
  'v.7': ['verified', 'B', 'S05 KPI tiles (applications, open value, approved value, outstanding, approval rate) plus the value-by-status bar chart and submissions-per-month line chart. Tiles and bars filter the pipeline.'],

  'vi.1': ['verified', 'B', 'S01 portal → "Request a sample analysis", or S06 → "New sampling request". The channel (online or back-office) is recorded on the sample.'],
  'vi.2': ['verified', 'B', 'S06 → Soil tab; open a sample for the collected → registered → testing → completed lifecycle, each step naming the role that performs it.'],
  'vi.3': ['verified', 'B', 'S06 → Water tab; same lifecycle and a water-specific analysis panel (pH, turbidity, nitrate, E. coli, TDS).'],
  'vi.4': ['verified', 'B', 'S06 → Plant and Compost tabs; each carries its own panel of parameters and reference ranges.'],
  'vi.5': ['verified', 'B', 'S06 sample in testing → "Enter results". Each parameter is assessed against its reference range as it is typed, and every parameter must be present before the analysis can be validated.'],
  'vi.6': ['verified', 'B', 'S06 sample header links to the client and the holding by ID, and the holding map is shown on the sample itself.'],
  'vi.7': ['verified', 'B', 'S06 completed sample → "Laboratory report (PDF)": a departmental certificate with letterhead, chain of custody, results table with out-of-range rows tinted, interpretation, recommendation and signature block.'],
  'vi.8': ['verified', 'B', 'S06 completed sample → "Notify applicant": previews every configured channel, then records SMS, email and in-app messages against the client and stamps the sample as notified.'],

  /* ---- Wave C — delivered and verified -------------------------------- */
  'vii.1': ['verified', 'C', 'S07 → Register a visit → Complaint visit. The detail screen shows the handling ladder — registered → assigned → visit made → resolved → closed — with Assign officer and Record findings driving it.'],
  'vii.2': ['verified', 'C', 'S07 → Register a visit → Routine visit, scheduled from the extension programme. Same record, different origin.'],
  'vii.3': ['verified', 'C', 'S07 visit → Record findings: observations on site, findings, action taken and an optional follow-up date.'],
  'vii.4': ['verified', 'C', 'S07 visit header links to the client and holding by ID; the holding selector only offers farms with livestock on the farm registry.'],
  'vii.5': ['verified', 'C', 'S07 visit → "Service history at this holding" lists every other visit at the same Farm ID, and S02 → Livestock & surveillance lists them by client.'],
  'vii.6': ['verified', 'C', 'S07 → Export PDF / Excel produces the livestock service report over the current filter.'],

  'viii.1': ['verified', 'C', 'S01 portal → "Report a sick animal", or S08 → "Report a suspected case". Sign prompts let a farmer report what they see without naming a disease.'],
  'viii.2': ['verified', 'C', 'S08 case register with the reported → assigned → investigating → sampled → closed lifecycle; the case detail lists historical cases at the same holding.'],
  'viii.3': ['verified', 'C', 'S08 case → Assign officer (supervisor permission). Unassigned cases surface on the awaiting-assignment tile.'],
  'viii.4': ['verified', 'C', 'S08 case → "Link laboratory submission" offers only samples from the same holding, then the result decides Confirm disease or Record negative. SUR-2026-004 ↔ LAB-2026-0044 is seeded.'],
  'viii.5': ['verified', 'C', 'S08 → Export PDF / Excel, plus the geographic-spread map and the by-disease breakdown.'],

  'ix.1': ['verified', 'C', 'S09 → Register a vendor. A farmer who trades is registered against their existing client record rather than keyed again.'],
  'ix.2': ['verified', 'C', 'S09 → open a vendor: profile, licence, contact and — where the vendor is also a farmer — their farms, loans and lab samples.'],
  'ix.3': ['verified', 'C', 'S09 → Victoria Market stalls: the floor laid out by section and row. Select a stall to allocate it to an active vendor or release it.'],
  'ix.4': ['verified', 'C', 'S09 vendor → Change status / Renew licence; the registry flags licences expiring within 60 days.'],
  'ix.5': ['verified', 'C', 'S09 → Export PDF / Excel produces the vendor and market report including stall and fee position.'],

  'x.1': ['verified', 'C', 'S10 → Schedule tab: month calendar of scheduled and completed inspections; "Schedule an inspection" adds one.'],
  'x.2': ['verified', 'C', 'S10 scheduling dialog lists officers with their existing load on the chosen date; the holder is notified on assignment.'],
  'x.3': ['verified', 'C', 'S10 → open an assigned inspection → "Go offline" → capture → "Save to device queue". The register still shows it scheduled, the navigation badge counts the queue, and "Sync now" on reconnect completes the record with both the capture and synchronisation times.'],
  'x.4': ['verified', 'C', 'S10 capture → "Take photograph": generated placeholder images, captioned, thumbnailed and viewable full size.'],
  'x.5': ['verified', 'C', 'S10 inspection → "Inspection history at this holding" plus the append-only entry timeline on the record itself.'],
  'x.6': ['verified', 'C', 'S10 → Export PDF / Excel produces the field inspection report, including which inspections were captured offline.'],

  /* ---- Wave D — delivered and verified -------------------------------- */
  'xi.6': ['verified', 'D', 'S11 → Approval workflows: rename a stage, change its acting role or service standard, reorder, add or remove. Add "Director\'s endorsement" to the loan hierarchy, save, then submit a new application from S01 — it routes through three stages while an application already in flight keeps its original two. No redeployment.'],

  'xii.1': ['verified', 'D', 'S12 is the landing screen for every staff role. Panels are gated on the same permission as the underlying registry, so lab@demo sees laboratory statistics and not the loan book.'],
  'xii.2': ['verified', 'D', 'S12 KPI tiles for registered farmers and farms with total hectares, plus the farmers-and-farms-by-district chart.'],
  'xii.3': ['verified', 'D', 'S12 KPI tiles for approved loan value, open applications and livestock visits, plus the loan-value-by-status chart.'],
  'xii.4': ['verified', 'D', 'S12 KPI tiles for laboratory samples and surveillance cases, plus the samples-by-type and cases-by-disease charts.'],
  'xii.5': ['verified', 'D', 'S12 → Report builder: ten datasets, faceted filters, date range and free-text search, with a live preview and computed totals.'],
  'xii.6': ['verified', 'D', 'S12 → Report builder exports the filtered set to PDF, Excel and CSV. Every module screen also exports its own register.'],
  'xii.7': ['verified', 'D', 'S12 charts are drill-down surfaces — select a district bar, a loan status, a sample type or a disease slice and the records behind it are listed with links into the registries.'],

  'xiii.1': ['verified', 'D', 'S13 → Templates: each template belongs to an event and a channel and is editable, so the wording of a status update changes without a redeployment. S04, S05, S08 and S10 raise the events.'],
  'xiii.2': ['verified', 'D', 'S13 → Messages issued, filtered to lab.results.ready; raised by the S06 "Notify applicant" action and visible on the recipient portal.'],
  'xiii.3': ['verified', 'D', 'S13 email channel with full detail; the KPI tile filters the register to it.'],
  'xiii.4': ['verified', 'D', 'S13 SMS channel for low-connectivity reach, with a character count on the template editor; labelled simulated throughout.'],
  'xiii.5': ['verified', 'D', 'S13 → Feedback & messages: farmers send questions, complaints and suggestions; officers respond in-thread. A farmer sees only their own thread.'],

  'xiv.1': ['verified', 'D', 'S13 → Migration validation: three batches with what was read, migrated and rejected from each source system.'],
  'xiv.2': ['verified', 'D', 'S13 → "Index a scanned document" records the index entry — title, category, tags and extracted text — which is what makes a scan findable.'],
  'xiv.3': ['verified', 'D', 'S13 → Migration validation lists each automated check with expected against actual and a pass, warning or failure. Failures are reported and the affected records named, not absorbed.'],
  'xiv.4': ['verified', 'D', 'S13 → Repository: search "fifteen metres" — a phrase that appears only inside the scanned text — and Marie-Ange\'s 2019 lease is the single result, with the term highlighted in the extract.'],
  'xiv.5': ['verified', 'D', 'S13 → Storage & access states what the delivered system does (AES-256 at rest, RBAC, audited retrieval, backup) beside what this prototype does instead, and says plainly that encryption and backup are not demonstrated here.'],
  'xiv.6': ['verified', 'D', 'S13 → Repository: category filter plus the index-tag cloud; both the categorisation and the metadata tags are set when a document is indexed.'],
}

const BADGE = {
  verified: '`verified`',
  built: '`built`',
  planned: '`planned`',
}

const rows = [...REQUIREMENTS].sort((a, b) => compareRefs(a.ref, b.ref))
const missing = rows.filter((r) => !STATUS[r.ref])
if (missing.length) {
  console.error(`Missing status for: ${missing.map((r) => r.ref).join(', ')}`)
  process.exit(1)
}

const counts = { verified: 0, built: 0, planned: 0 }
for (const r of rows) counts[STATUS[r.ref][0]] += 1

const esc = (s) => s.replace(/\|/g, '\\|')

let md = `# TRACEABILITY.md — Appendix A6 requirement matrix

Agriculture Information System (AIS) — Phase 1: Foundation Systems
Demonstration prototype · Cutting-Edge Consultancy

**Generated file — do not edit by hand.** The 91 requirement rows come from
\`src/lib/refs.ts\`, which also drives the in-app \`?refs=1\` requirement badges, so
this matrix cannot drift from the build. Demo steps and statuses are maintained
in \`scripts/traceability.mjs\`; regenerate with:

\`\`\`bash
npm run traceability
\`\`\`

## Status summary

| Status | Rows | Meaning |
|---|---|---|
| ${BADGE.verified} | ${counts.verified} | Walked in the browser at 390 px and 1366 px; behaves as the demo step describes |
| ${BADGE.built} | ${counts.built} | Code and data present and visible, owning screen still to be delivered |
| ${BADGE.planned} | ${counts.planned} | Scheduled for a later build wave |
| **Total** | **${rows.length}** | |

★ marks the ${rows.filter((r) => r.exceeds).length} rows where the proposal promised to **exceed** the requirement.
Those extras must be visibly demonstrated, not implied.

**Build waves** (CLAUDE.md §7.1) — A: shell, S01, S02, S03, S11 RBAC skeleton ·
B: S04, S05, S06 · C: S07–S10 · D: S11 complete, S12, S13, polish.

`

for (const key of Object.keys(MODULES)) {
  const moduleRows = rows.filter((r) => r.module === key)
  if (!moduleRows.length) continue
  md += `\n## Module ${key} — ${MODULES[key].toUpperCase()}\n\n`
  md += '| Ref | Requirement (Appendix A6) | Promised in the proposal | Screen(s) | Demo step | Wave | Status |\n'
  md += '|---|---|---|---|---|---|---|\n'
  for (const r of moduleRows) {
    const [status, wave, step] = STATUS[r.ref]
    md += `| ${r.ref}${r.exceeds ? ' ★' : ''} | ${esc(r.requirement)} | ${esc(r.promised)} | ${r.screens.join(', ')} | ${esc(step)} | ${wave} | ${BADGE[status]} |\n`
  }
}

md += `
---

## How to verify a row yourself

1. \`npm run dev\` and open the app with \`?refs=1\` — for example
   \`http://localhost:5173/?refs=1#/clients\`.
2. Every annotated control renders a small badge such as \`iii.2\`; hover it for the
   requirement text.
3. **Traceability coverage** (in the footer) lists all 91 rows and marks each one
   annotated as soon as a badge for it has rendered in the session.
4. Sign in with any account from the sign-in screen; all use the password
   \`Demo2026!\`.

## Honesty notes

- Every simulated integration is labelled \`simulated\` in the UI: SeyID, one-time
  passcodes, SMS and email delivery, device GPS, document and photo upload, and
  offline sync. Nothing contacts an external service; the only network requests
  the prototype makes are OpenStreetMap map tiles.
- All data is fictional. Every National Identification Number carries the
  obviously fake \`999-\` prefix and every telephone number matches
  \`+248 2 000 0xx\`. No real person is represented.
- Password storage, the audit hash chain and the duplicate-detection scoring are
  genuinely implemented, not mocked — see \`src/lib/hash.ts\`, \`src/lib/store.ts\`
  and \`src/lib/duplicates.ts\`.
`

writeFileSync(OUT, md, 'utf8')
console.log(`TRACEABILITY.md written — ${rows.length} rows (${counts.verified} verified, ${counts.built} built, ${counts.planned} planned).`)
