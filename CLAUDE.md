# CLAUDE.md — AIS Phase 1 Demonstration Prototype

Standing instructions. Read fully before writing code; re-read the relevant screen/module spec before each screen.

## 1. Mission

The demonstration prototype for the **Agriculture Information System (AIS) – Phase 1** bid (DICT, for the
Department of Agriculture, Republic of Seychelles). It is scored evidence: the tender's **Criterion 5
(50 pts)** grades a live product demonstration against the **Appendix A6 functional requirements (91 rows,
Criterion 4)**. Every screen exists to *visibly demonstrate* specific A6 rows. Outputs: a running React
prototype exercising all 14 modules through one connected story, annotated screenshots, `TRACEABILITY.md`,
and `DEMO_SCRIPT.md`.

Module designs (lifecycles, entities, ★ features) follow the vault deliverable
**AIS_Module_Technical_Specifications.md**; its per-module *Acceptance* lines are the pass/fail tests in
`TEST_PLAN.md`. Depth target: **enough for the client demo** — every A6 row demonstrable and every
Acceptance line passing — not gold-plated.

## 2. Non-negotiable constraints

- **Honesty.** Only build what a 5-person team can genuinely deliver in 9 months. No fabricated
  capabilities. Every simulated integration is **labelled "simulated"** in the UI.
- **Fictional data only.** Invented names; NINs use the fake `999-` prefix; phones `+248 2 000 0xx`.
  A `FICTIONAL DEMONSTRATION DATA` notice sits in the footer.
- **Stack (fixed):** Vite + React 18 + TypeScript (`strict`, no `any`) · React Router · Tailwind ·
  react-leaflet + OpenStreetMap · recharts · jsPDF + jspdf-autotable + xlsx · date-fns. State in one
  `store.ts` (context + reducer) persisted to `localStorage`, with **Reset Demo Data**. No backend, no
  network calls except OSM tiles.
- **Styling.** Government-service neutral; deep green/teal primary `#0F6B4F`; **no pink** (the pink bid
  template is not the product). Header carries a crest placeholder, the title, and a `PROTOTYPE` badge.
  Responsive: usable at 390 px and 1366 px; S03 and S10 are mobile-priority.
- **Terminology.** Use **"SeyID/NIN"** for the identity system (the client corrected "CID").

## 3. Coding standard (matches the owner's eslint-config, adapted for React)

Single quotes, semicolons, `simple-import-sort` groups (node → external → relative), no unused imports,
PascalCase types/components, camelCase vars, UPPER_CASE consts, `// ── Section ──` dividers, centralised
constants (no magic literals), validate at the boundary. `npm run lint` / `npm run format` enforce it;
`npm run build` (tsc + vite) must be clean before a wave is declared done.

## 4. Screens (14 modules → S01–S13)

S01 portal/auth · S02 client registry · S03 farm registration · S04 land · S05 loans · S06 lab ·
S07 livestock · S08 surveillance · S09 vendor/market · S10 field ops · S11 admin/RBAC/workflow/audit ·
S12 dashboard + report builder · S13 notifications + digitized documents/migration.

**Six roles (RBAC, enforced by route guards):** Administrator, Supervisor, Agriculture Officer,
Field Officer, Laboratory Staff, Farmer.

## 5. The demo narrative

One connected story — *one farmer identity, entered once, reused everywhere*. **Marie-Ange Hoareau**
(NIN `999-0412-1-1-07`, Anse Boileau) self-registers via SeyID; officer J. Payet registers her farm
(GPS pin, duplicate merge); she applies for an SCR 85,000 poultry loan through a configurable approval;
requests a soil test (lab → SMS on release); a routine livestock visit and a suspected Newcastle case
link to her farm and the lab work; a Victoria Market stall is allocated; a field inspection is captured
offline and synced; the admin shows users/RBAC/workflow/audit; the dashboard closes with KPIs, charts, a
PDF/Excel report, and a document search that finds her scanned 2019 lease.

## 6. Build order (waves)

- **Wave A (done):** shell, store, seed, S01, S02, S03, S11 (RBAC + workflow + audit), S12 KPIs.
- **Wave B:** S04 Land, S05 Loans, S06 Lab.
- **Wave C:** S07 Livestock, S08 Surveillance, S09 Vendor, S10 Field Ops.
- **Wave D:** S12 full (charts + ad-hoc report builder), S13 Notifications + Documents + migration report,
  ReqBadge coverage, screenshots.

Client concerns from the pre-proposal conference (20 Jul 2026) get first-class demo coverage: offline
capture+sync (S10), migration validation (S13), configurable workflows for loans/leases/vendor (S11→S05/S04/S09),
SeyID/NIN, notifications (S13/S06), GIS parcel view (S03/S04).

## 7. Working practices

After each screen: run `npm run dev`, verify at 390 px and 1366 px, tick its rows in `TRACEABILITY.md`
(`planned → built → verified`), update `DEMO_SCRIPT.md`, keep `TEST_PLAN.md` current, then a focused
Conventional Commit (`feat(S05): loan pipeline with configurable approval`). Regenerate fixtures with
`npm run seed`; regenerate the matrix with `node scripts/gen-traceability.mjs`. Do not gold-plate.

## 8. Definition of done

All 91 rows `verified` with a demo step · the narrative walks start-to-finish on seeded data · `tsc` +
`vite build` clean, no console errors · RBAC enforced (farmer cannot reach `/app`) · Reset restores the
scripted state · PDF + Excel exports open · every simulated element labelled · `?refs=1` covers every row ·
390 px responsive · footer shows the fictional-data notice · `DEMO_SCRIPT.md` matches the built app.
