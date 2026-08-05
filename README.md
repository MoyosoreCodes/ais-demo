# AIS Phase 1 — Demonstration Prototype

A front-end demonstration prototype for the **Agriculture Information System (AIS) – Phase 1** bid
(DICT, for the Department of Agriculture, Republic of Seychelles). It exercises the 14 functional
modules through one connected story so an evaluator can *see* each Appendix A6 requirement working.

> **Fictional demonstration data only.** Invented names, `999-` NINs, `+248 2 000 0xx` phones. Every
> integration (SeyID, SMS/email, payment, GPS, photo, offline sync) is **simulated and labelled**.
> No backend and no network calls except OpenStreetMap map tiles. Not an official record.

## Run

```bash
npm install
npm run seed     # (re)generate deterministic fixtures in src/data
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build  (must be clean)
npm run lint     # eslint  ·  npm run format  (prettier)
```

**Demo logins** (password `Demo2026!`): `admin@demo`, `officer@demo`, `supervisor@demo`,
`lab@demo`, `field@demo`, `farmer@demo`. SeyID / 2FA / OTP code: `824193`.
The login page also has quick sign-in chips.

## Docs

- **CLAUDE.md** — the build spec / standing instructions (constraints, screens, waves).
- **TRACEABILITY.md** — the 91 Appendix A6 rows → screen → demo step → status (generated from `src/lib/refs.ts`).
- **DEMO_SCRIPT.md** — the 10–15 min scripted walk-through.
- **TEST_PLAN.md** — what to test and the expected result, per module.

The module designs (lifecycles, entities, ★ features) follow the vault deliverable
*AIS_Module_Technical_Specifications.md*.

## Stack

Vite + React 18 + TypeScript (strict) · React Router · Tailwind · react-leaflet + OpenStreetMap ·
recharts · jsPDF + jspdf-autotable + xlsx · date-fns. State lives in one `store.ts` (React context +
reducer) persisted to `localStorage`, reseeded by **Reset Demo Data**.

## Layout

```
src/
  app/         shell, auth, RBAC guards, ReqBadge context
  components/  DataTable, StatusBadge, Timeline, MapPicker, DocUploader, Toast, ReqBadge, ui
  data/        generated seed JSON (see scripts/gen-seed.mjs)
  lib/         store, rbac, workflow, sim, export, ids, format, geo, refs, types
  modules/     auth · clients · farms · land · loans · lab · livestock ·
               surveillance · vendors · field-ops · admin · dashboard · notifications · documents
```

Requirement-badge mode (`?refs=1` or the footer toggle) overlays the Appendix A6 ref codes beside
the UI elements that evidence them — used for the bid-annex screenshots.
