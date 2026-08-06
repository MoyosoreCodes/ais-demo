# AIS — Phase 1 demonstration prototype

Demonstration prototype for the **Agriculture Information System (AIS) —
Phase 1: Foundation Systems** tender (DICT on behalf of the Department of
Agriculture, Republic of Seychelles), built by Cutting-Edge Consultancy.

> **This is a demonstration build containing fictional data only.** No real
> person, National Identification Number or telephone number appears anywhere in
> it. Every simulated integration is labelled `simulated` in the user interface.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:5173/?refs=1>. All demonstration accounts use the password
`Demo2026!` — the sign-in screen lists them.

`?refs=1` switches on the requirement badges used for the bid annex; the same
toggle is in the page footer.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and produce a production build |
| `npm run typecheck` | `tsc --noEmit` against the app config |
| `npm run seed` | Regenerate `src/data/*.json` from `scripts/generate-seed.mjs` |
| `npm run traceability` | Regenerate `TRACEABILITY.md` from `src/lib/refs.ts` |
| `npm run screenshots` | Capture the annex screenshots and generated reports (needs `npm run dev` running) |

## Documents

- **CLAUDE.md** — the build brief: mission, constraints, screen specs and the 91
  Appendix A6 requirement rows. Per the repository layout it belongs at
  `ais-demo/CLAUDE.md`; drop your copy in here so the brief travels with the code.
- **[TRACEABILITY.md](TRACEABILITY.md)** — generated requirement → screen →
  demo-step matrix with current status.
- **[DEMO_SCRIPT.md](DEMO_SCRIPT.md)** — the walk-through to perform or record.

## Stack

Vite · React 18 · TypeScript (`strict`) · Tailwind CSS · React Router ·
react-leaflet with OpenStreetMap tiles · recharts · jsPDF + jspdf-autotable ·
SheetJS (`xlsx`) · date-fns.

There is no backend. State lives in a React reducer and is mirrored to
`localStorage` behind `src/lib/store.ts`, with a **Reset demo data** action that
reseeds from `src/data/*.json`. The only network requests the application makes
are OpenStreetMap map tiles.

## Layout

```
src/
  app/         shell, routing, auth context, RBAC guards, refs mode
  components/  shared UI (DataTable, MapPicker, Timeline, ReqBadge, …)
  data/        generated seed JSON
  lib/         store, rbac, workflow, duplicates, hash, format, sim, refs
  modules/     one directory per functional module
scripts/       seed and traceability generators
screenshots/   annex captures (see CLAUDE.md §9)
```

## What is genuinely implemented vs simulated

Real, not mocked:

- **Password storage** — PBKDF2-SHA256 with a per-user random salt
  (`src/lib/hash.ts`). No password is stored or displayed in clear.
- **Audit log** — append-only and hash-chained with SHA-256; the Administration
  screen recomputes the whole chain on view (`src/lib/store.ts`).
- **RBAC** — one permission matrix (`src/lib/rbac.ts`) drives both the S11 display
  and the route guards, so a farmer session genuinely cannot open an officer
  route.
- **Duplicate detection** — deterministic, explainable scoring over NIN, name,
  contact, parcel reference, GPS proximity and owner (`src/lib/duplicates.ts`).

Simulated, and labelled as such on screen:

SeyID identity lookup · one-time passcode delivery · SMS and email dispatch ·
device GPS fix · document and photo upload · offline capture and sync.

## Build status

**Complete — all thirteen screens, all 91 Appendix A6 requirement rows verified.**

| Wave | Screens | State |
|---|---|---|
| A | Shell, S01 farmer portal & sign-in, S02 client registry, S03 farm registration, S11 RBAC skeleton | delivered |
| B | S04 land management, S05 loans, S06 sampling & laboratory | delivered |
| C | S07 livestock, S08 surveillance, S09 vendors, S10 field operations | delivered |
| D | S11 workflow configurator, S12 dashboard & reporting, S13 notifications & documents | delivered |

`TRACEABILITY.md` records all 91 rows at **verified**, each with the demo step
that shows it.

### Verified against the definition of done (CLAUDE.md §10)

- All 91 rows verified, each with a demo step.
- The Section 4 narrative walks start to finish in one seeded session.
- `tsc --noEmit` and `npm run build` clean; **39/39** route and role
  combinations render with no console output.
- RBAC enforced by the router — a farmer session cannot open an officer route,
  and approval stages are gated per stage, not only per screen.
- **Reset demo data** restores the scripted state exactly, including an edited
  approval hierarchy, a merged duplicate and a queued offline capture.
- PDF, Excel and CSV exports all open correctly; the templated laboratory report
  renders as a departmental certificate.
- Every simulated element is labelled `simulated` on screen.
- `?refs=1` annotates **91/91** rows across the built screens.
- **26/26** screens fit 390 px with no horizontal scroll; the footer carries the
  fictional-data notice throughout.
- `DEMO_SCRIPT.md` matches the built application — fifteen acts, 14–15 minutes.

### Dependency security position

`npm audit` is run against the pinned stack. Current position, and the reasoning
behind it — this is a deliberate set of choices, not an unreviewed result.

| Package | Version | Position |
|---|---|---|
| `jspdf` | 4.2.1 | Upgraded from 2.5.2. Clears a critical ReDoS plus eleven further advisories, and clears `dompurify` transitively. |
| `jspdf-autotable` | 5.0.8 | Upgraded from 3.8.4 — required for jspdf 4 compatibility. |
| `react-router-dom` | 7.18.2 | Upgraded from 6.30.4. Clears the open-redirect advisory affecting `<Link>` and `useNavigate`, which this application genuinely uses. |
| `xlsx` | 0.18.5 | **No fix exists on npm.** SheetJS publishes current releases off-registry; the npm package is frozen at 0.18.5. |

**One advisory remains open on `react-router` by choice.** Versions ≥7.12.0 carry
an RSC-mode CSRF advisory whose stated fix (8.3.0) is not published. npm suggests
downgrading to 7.11.0, which would clear it but sits back inside the
open-redirect range — trading an advisory this application *cannot* reach for one
it can. The RSC advisory requires React Server Components and a server; this is a
client-only SPA using `HashRouter` with no data router, no route loaders or
actions, no fetchers and no server, so the vulnerable surface does not exist
here. Revisit when react-router 8.3.0 ships.

**`xlsx` likewise remains open.** Its advisories concern parsing hostile
spreadsheets; this prototype only ever *writes* workbooks and never reads one, so
the vulnerable code path is not exercised. Replacing SheetJS would mean
substituting a package the brief pins, which is a decision for the bid team.

### Annex material

`screenshots/` holds **67 captures** plus `exports/`, containing ten documents
the application actually generated: the templated laboratory certificate; the
loan, livestock, surveillance, vendor, inspection and lease register reports; and
an ad-hoc client report from the report builder in PDF and CSV. Regenerate
everything with `npm run screenshots` while `npm run dev` is running — the
capture clears the database first, so the annex always reflects the seeded state.
