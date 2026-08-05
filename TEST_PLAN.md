# TEST PLAN — AIS Phase 1 Prototype

What to test and the expected result. Use it before every demo so nothing breaks in front of the client.
Status per item: **[A]** live now (Wave A) · **[B/C/D]** built in that wave.

- Password for all demo logins: `Demo2026!`. SeyID / 2FA / SMS code: `824193`.
- Reset first: footer → **Reset demo data** restores the exact scripted state.
- Toggle **requirement badges** with `?refs=1` or the footer.

---

## 0. Cross-cutting (run these every time) — [A]

| # | Test | Expected |
|---|---|---|
| 0.1 | `npm install && npm run build` | `tsc` + Vite build pass, no type errors |
| 0.2 | `npm run dev`, open the app | No console errors; redirects to `/login` |
| 0.3 | Load every screen in the sidebar | No blank screens, no crashes |
| 0.4 | Resize to 390 px and 1366 px | No horizontal page scroll; tables drop non-essential columns; sidebar becomes a hamburger drawer |
| 0.5 | Reset demo data | Registry counts, Marie-Ange records and workflows return to seed |
| 0.6 | Reload the page after edits | Changes persist (localStorage) until reset |
| 0.7 | Footer on every screen | Shows the `FICTIONAL DEMONSTRATION DATA` notice |
| 0.8 | Theme | Deep green/teal government theme; no pink anywhere; `PROTOTYPE` badge in header |

## 1. Identity & Authentication (S01/S11) — [A]

| # | Test | Expected |
|---|---|---|
| 1.1 | Wrong password 5× on `/login` | Error each time; a lockout counter appears; after 5 the account locks |
| 1.2 | Quick sign-in chips (each role) | Signs in and lands on that role's home |
| 1.3 | Sign in as a 2FA user (admin/officer/supervisor/farmer) | A simulated 2FA step asks for `824193` before entry |
| 1.4 | **Continue with SeyID** → `824193` | Signs in as Marie-Ange, lands on the farmer portal |
| 1.5 | **Self-register** → Pre-fill with SeyID → weak password | Boundary validation blocks weak passwords; a valid one creates the account and signs in |
| 1.6 | **Forgot password** | Simulated email+SMS reset toast; no crash |
| 1.7 | Admin → Users → create / change role / deactivate | Row updates; an audit entry is written; a deactivated user cannot be selected to sign in |
| 1.8 | Password policy hint + session-timeout notice | Both visible on the sign-in form |

**Spec acceptance:** SeyID login verifies NIN & creates the user; officer can register a non-SeyID farmer; 5 failed logins lock the account.

## 2. Client Management / CMS (S02) — [A]

| # | Test | Expected |
|---|---|---|
| 2.1 | Search "Hoareau"; filter by district/type | List narrows correctly; paging works |
| 2.2 | **Duplicates** button | Exactly one group: CLT-0001 + CLT-0002 (shared NIN & phone) |
| 2.3 | Merge the duplicate into the primary | Duplicate marked `merged`; its farm re-links to the primary; audit entry written |
| 2.4 | **Register client** with a name/NIN matching an existing one | Possible-duplicate warning shows before save; "Register anyway" still works |
| 2.5 | Open a client → Overview | NIN + SeyID badge; linked farms/loans/lab/livestock counts |
| 2.6 | Edit a client's phone → History tab | Change recorded with old→new value, actor and time |

**Spec acceptance:** blocks/ warns on duplicate NIN; a client shows all linked records; search returns fast.

## 3. Farm Registration (S03) — [A]

| # | Test | Expected |
|---|---|---|
| 3.1 | Register farm → choose owner, district | Map recenters to the district |
| 3.2 | Drag the pin / **Use my location** | Coordinates update; "GPS simulated" label shown |
| 3.3 | Pick an owner who already has a farm, or move the pin near one | Duplicate-farm warning + red proximity markers on the map |
| 3.4 | Add crop/livestock chips, attach documents | Selections persist; documents listed with verify toggle (upload simulated) |
| 3.5 | Save | A `FRM-2026-…` ID is generated; the farm appears in the list linked to its owner |
| 3.6 | Open a farm row | Navigates to the owner's client profile (two-way link) |

**Spec acceptance:** unique Farm ID; farm shows on the map; no second farm within the threshold for the same owner.

## 4. Workflow & Access Control (S11) — [A]

| # | Test | Expected |
|---|---|---|
| 4.1 | RBAC matrix tab | Roles × screens; ticks match each role's real access |
| 4.2 | Switch demo user to Field Officer / Lab | Sidebar shrinks to that role's permitted screens |
| 4.3 | Sign in as Farmer then visit `/app/clients` | Redirected / 403 — farmers cannot reach the back office |
| 4.4 | Workflows tab → rename a stage, change its actor role, add/remove a stage | Saved immediately (no reload); audit entry written; drives the loan pipeline |
| 4.5 | Audit log → filter by category | Rows filter; newest first |

**Spec acceptance:** an admin adds a state/transition with no release; a bad-role transition returns 403 + audit; every transition writes immutable history.

## 5. Dashboard (S12) — [A KPIs · full in D]

| # | Test | Expected |
|---|---|---|
| 5.1 | Land on the dashboard as any staff role | KPI cards for farmers, farms, loans, samples, cases, inspections |
| 5.2 | Recent activity | Shows the latest audit entries |
| 5.3 | **[D]** Charts + drill-down; report builder; PDF/Excel/CSV export | Renders charts; builds a report without SQL; exports open correctly |

---

## Domain modules — acceptance criteria to test as each wave lands

### 6. Land Management (S04) — [B]
- Application moves Submitted → Under Review → Assessment → Decision → Allocated → Leased; each step audited.
- GIS parcel shown on the map during assessment.
- Lease register tracks active/expired/pending; a lease near expiry raises a reminder into S13.
- Retraction/eviction workflow produces a numbered notice; history is immutable.

### 7. Loan Management (S05) — [B]
- Application runs the configurable multi-stage approval (Screening → Assessment → Approval); each stage gated by the role set in S11.
- End-to-end status tracking; append-only audit per decision (officer + time).
- Loan mini-dashboard shows counts by status in real time.

### 8. Sampling & Laboratory (S06) — [B]
- Sample tracked by barcode through Requested → Collected → Registered → Testing → Result Entered → Verified → Released (chain of custody).
- Result links to farm + client; result is immutable after verification.
- Lab report exports to PDF; release sends an SMS + in-app notification (simulated) into S13.

### 9. Livestock Services (S07) — [C]
- Complaint visit logged, assigned to an officer, tracked to resolution; routine visit captured with findings.
- Per-farm service history; linked to farm + client.

### 10. Passive Surveillance (S08) — [C]
- Suspected case reported → registered → assigned → investigating → linked to a lab result → closed; history kept.
- Case links to the farm and the lab result; appears on the surveillance dashboard tile.

### 11. Vendor & Market (S09) — [C]
- Vendor registered with a profile; stall allocated on the Victoria Market board; registration status tracked.

### 12. Field Operations (S10) — [C]
- Visit scheduled + assigned; inspection captured while **offline** (toggle) queues with a "pending sync (n)" badge and syncs on reconnect with no data loss.
- Photos attach (simulated); inspection history immutable.

### 13. Notifications & Digitization (S13) — [D]
- In-app + email + SMS (simulated) notifications from configurable templates for status/lab/lease events.
- Document repository: full-text search finds Marie-Ange's 2019 lease; documents categorised/tagged.
- Migration validation report shows record counts and pass/fail checks with a rollback note.

---

## Known simulation boundaries (say these if asked)
SeyID, SMS/email, payment, device GPS, camera/photo upload and offline sync are **simulated** and labelled in the UI. No real network calls are made except OpenStreetMap map tiles. All people, NINs (`999-…`) and phone numbers are fictional.
