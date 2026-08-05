# DEMO_SCRIPT — AIS Phase 1 Prototype

A scripted walk-through, kept in sync with the build. **Wave A is live** (S01, S02, S03, S11, plus a KPI landing on S12); Waves B–D screens show a planned view listing the requirements they will evidence.

## 0. Setup

```bash
npm install
npm run seed      # (re)generate /src/data fixtures — deterministic
npm run dev       # http://localhost:5173
```

Turn on **requirement badges** for the annex screenshots: append `?refs=1` to any URL, or use the footer toggle. **Reset demo data** (footer) restores the exact scripted state.

**Demo logins** — password `Demo2026!` for all:

| Role | Username | Lands on |
|---|---|---|
| Administrator | `admin@demo` | Dashboard + Administration |
| Agriculture Officer | `officer@demo` | Back-office (J. Payet) |
| Laboratory Staff | `lab@demo` | Lab + dashboard |
| Field Officer | `field@demo` | Farms + field ops |
| Supervisor | `supervisor@demo` | Back-office |
| Farmer | `farmer@demo` | Farmer portal (Marie-Ange) |

The login page also has **quick sign-in chips** for each role.

## 1. One identity, entered once (S01)

1. On the sign-in page, note the **password policy hint**, the **session-timeout** notice, and (evidences `i.1`) type a wrong password five times to trip the **lockout counter**.
2. Click **Continue with SeyID (simulated)** → enter code `824193` → you are signed in as Marie-Ange and land on the **farmer portal** (`i.8`). The portal shows *her* farm, loan, lab result and notifications — all linked to one client record.
3. Sign out → **Self-register** → **Pre-fill with SeyID** fills Marie-Ange's details (`i.4`, `ii.3`); set a password (policy validated at the boundary) → account created and signed in.
4. Sign out → **Forgot password** → sends a reset link by email + SMS (simulated) (`i.6`).

## 2. Client registry, duplicates & merge (S02)

1. Quick sign-in as **Agriculture Officer**. Open **Client Registry**.
2. Search "Hoareau", filter by district/type (`ii.1`, `ii.6`).
3. Click **Duplicates** → one group: `CLT-0001` (self-service, SeyID) and `CLT-0002` (legacy migrated) share a NIN and phone → **Merge into primary** (`ii.7`). The migrated record's farm re-links to the primary.
4. **Register client** → fill a name that matches an existing record → the **possible-duplicate warning** appears before saving (`i.5`, `ii.7`).
5. Open a client → **Overview** shows NIN + SeyID badge and linked-record counts (`ii.2`, `ii.3`, `ii.5`) → **Edit** the phone → check the **History** tab records the change (`ii.4`).

## 3. Farm registration with GPS (S03)

1. Open **Farm Registration → Register farm**.
2. Choose the owner (links to CMS), set district (map recenters), size, tenure, and pick **crop/livestock** chips (`iii.1`, `iii.3`).
3. On the map, **drag the pin** or **Use my location (simulated)** (`iii.2`). Move the pin near an existing farm or pick an owner who already has one → the **duplicate-farm warning** and red proximity markers appear (`iii.7`).
4. **Attach documents (simulated)** (`iii.4`) → **Register farm** → a **Farm ID** (`FRM-2026-…`) is generated and the farm links two-way to the client (`iii.5`, `iii.6`).

## 4. Administration & access control (S11)

1. Quick sign-in as **Administrator** → **Administration**.
2. **Users**: change a role, **deactivate/reactivate**, **Create user** — each writes to the audit log (`i.3`).
3. **RBAC matrix**: roles × screens (`i.2`, `xi.3`). Now switch the **demo user** in the header to *Field Officer* — the sidebar shrinks to their permitted screens; as *Farmer* you are bounced out of `/app` with a **403** (`xi.5`).
4. **Workflows**: edit the Loan approval **stages** — rename, change the actor role, add/remove a stage — with no redeploy (`xi.6`). This drives the loan pipeline in Wave B.
5. **Audit log**: filter by category (`i.7`, `xi.4`).

## 5. Dashboard (S12 — KPIs now, charts in Wave D)

Any staff role lands on the dashboard: live KPI cards for farmers, farms, loans, samples, cases and inspections (`xii.1`–`xii.4`), plus recent activity. Charts, drill-down and the PDF/Excel report builder land in Wave D.

---

**Coming next:** Wave B — Land (S04), Loans (S05), Lab (S06). Wave C — Livestock (S07), Surveillance (S08), Vendor/Market (S09), Field Ops (S10). Wave D — full Dashboard/reporting (S12), Notifications & digitized documents (S13), screenshot capture.
