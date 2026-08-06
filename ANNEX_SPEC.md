# ANNEX_SPEC — the rule book

**Source of truth:** `Annex TECH-8(6) — System Demonstration & Concept Document` (AIS Phase 1, 78 pp,
67 annotated captures, 91 Appendix A6 rows). The annex has already been submitted. **The build must
match the annex, not the other way round.** Where this repo and the annex disagree, the annex wins.

Everything below is extracted from the annex text and its captures. It is the acceptance spec for the
prototype: design system, per-role navigation, seed inventory, the story records with their exact
identifiers, and the per-screen feature list with the exact on-screen copy the annex quotes.

---

## 1. Non-negotiables

- **13 screens** (S01–S13) covering **14 modules**, **91 Appendix A6 rows**, **23 ★ rows**.
- **One connected narrative:** _one farmer identity, entered once, reused everywhere._
- **Honesty.** Ninety of ninety-one rows are demonstrated as working features. **xiv.5 alone is an
  honest engineering statement** (S13 → Storage & access), never a faked indicator.
- Genuinely running: salted **PBKDF2-SHA256** password verification with configurable policy, lockout
  and session timeout · RBAC enforced by the router · append-only **hash-chained audit log recomputed
  and verified on view** · duplicate detection with scoring on NIN/name/contact and parcel/GPS/owner ·
  metadata-driven **workflow configurator** · **full-text search over digitized document content** ·
  working PDF/Excel/CSV export.
- Simulated **and labelled `● SIMULATED` on screen**: SeyID lookup and OTP delivery · SMS and email
  delivery (composed and logged, never transmitted) · payment gateway · camera/photo capture and
  document scanning · device connectivity for the offline queue (an on-screen toggle).
- **Fictional data only.** NINs use the `999-` prefix, phones `+248 2 000 0xx`. The footer carries a
  permanent fictional-data notice that appears in every capture.
- Verified at **390 px and 1366 px**. **S03 and S10 are mobile-priority.**
- `?refs=1` turns on the requirement-badge overlay; the same toggle sits in the footer.
- Every account uses the password `Demo2026!`.

---

## 2. Design system (from the captures)

### Header — white, not green

Sticky, 56 px, white, bottom border `slate-200`.

| Slot      | Content                                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Left      | Circular dark-green emblem (30 px)                                                                                                |
|           | `Agriculture Information System` — 13 px semibold `slate-900`                                                                     |
|           | `Republic of Seychelles · Department of Agriculture` — 10.5 px `slate-500`                                                        |
| Then      | Amber pill `PROTOTYPE — DEMONSTRATION BUILD`, uppercase 9 px bold                                                                 |
| Right     | Account chip: circular green avatar with initials (`JP`), name 12 px semibold, role 10 px `slate-500`, caret = demo-user switcher |
| Far right | `Sign out` secondary button                                                                                                       |

### Sidebar

White, ~200 px, right border `slate-200`. Group labels are 10 px uppercase tracking-wide `slate-400`.
Items are 13 px with an 18 px `slate-400` icon, the label, then the **screen code right-aligned in
mono 9 px**. Active item: `primary-50` fill, `primary-700` text, `primary-600` icon. **Notifications**
carries a green circular unread count before its code.

### Content

Page header is `S02` code chip (mono 10 px, `slate-100`) → **title** (22 px semibold sans — _not_
serif) → requirement badges. Subtitle 12.5 px `slate-500` on its own line. Actions top-right.

- **KPI tile:** 10 px uppercase `slate-400` label (+ badge), value 22 px bold tabular-nums, 11 px
  `slate-400` sub. The **leading total tile on a register screen is tinted** `primary-50` with a
  `primary-200` border; the rest are white.
- **Requirement badge:** mono 9 px in a rounded bordered box, `★` suffix on exceed rows, requirement
  text on hover. Rendered only when refs are on.
- **`● SIMULATED` chip:** amber, uppercase, leading dot.
- **Status pills** (rounded-full, 10–11 px): primary tint for Active / Registered / Approved /
  Completed / Closed / Disbursed · slate for Under review / Pending / Requested / Registered ·
  amber for Reserved / Maintenance / warn / Suspended / Sampled · red for Expired / Rejected /
  Overdue / Confirmed / high-confidence duplicates.
- **Fonts:** IBM Plex Sans for UI, **IBM Plex Mono for every identifier, reference and requirement
  code**. Primary `#0F6B4F`.

### Footer

White, top border. Left: rose chip `FICTIONAL DEMONSTRATION DATA` then `slate-500` —
_"No real person, National Identification Number or telephone number appears in this prototype."_
Right, in order: `Requirement badges (N/91 seen)` checkbox · `Traceability coverage` link ·
`Reset demo data` · `Session timeout NN min`.

---

## 3. Navigation per role (captures are definitive)

Groups are **SELF-SERVICE**, **REGISTRIES**, **SERVICES**, **OVERSIGHT**.

| Role                               | Navigation                                                                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Farmer** — Marie-Ange Hoareau    | SELF-SERVICE: My holding `S01`                                                                                                                                                                                                       |
| **Laboratory Staff** — S. Dogley   | REGISTRIES: Client registry `S02`, Farm registry `S03` · SERVICES: Sampling & laboratory `S06`, Passive surveillance `S08` · OVERSIGHT: Dashboard `S12`, Digitized records `S13`                                                     |
| **Field Officer** — R. Confait     | REGISTRIES: Client registry, Farm registry, Land management · SERVICES: Sampling & laboratory, Livestock services, Passive surveillance, Vendors & market, Field operations · OVERSIGHT: Dashboard, Notifications, Digitized records |
| **Agriculture Officer** — J. Payet | Field Officer's list **+ Loans `S05`**                                                                                                                                                                                               |
| **Supervisor** — B. Adrienne       | Agriculture Officer's list **+ Administration `S11`**                                                                                                                                                                                |
| **Administrator** — A. Vidot       | Everything                                                                                                                                                                                                                           |

A farmer session that opens `#/clients` gets the **Access denied** page naming the role and the path —
not a hidden menu item.

### Permission matrix (S11 → Roles & permissions, grouped as captured)

`clients.view` · `clients.edit` · `clients.merge` · `farms.view` · `farms.edit` ·
`land.view` · `land.edit` · `land.decide` ·
`loans.view` · `loans.assess` · `loans.decide` ·
`lab.view` · `lab.register` · `lab.results` ·
`livestock.view` · `livestock.edit` ·
`surveillance.view` · `surveillance.assign` ·
`vendors.view` · `vendors.edit` ·
`fieldops.view` · `fieldops.capture` · `fieldops.schedule` ·
`notifications.view` · `documents.view` · `documents.manage` · `admin.manage`

The banner reads: _"This matrix is the enforcement point. The router reads the same table."_

---

## 4. Accounts — 8 across 6 roles, password `Demo2026!`

| Username          | Name               | Role                | 2FA              | Last sign-in       |
| ----------------- | ------------------ | ------------------- | ---------------- | ------------------ |
| `admin@demo`      | A. Vidot           | Administrator       | TOTP ● SIMULATED | 31 Mar 2026, 08:11 |
| `officer@demo`    | J. Payet           | Agriculture Officer | Off              | 31 Mar 2026, 01:35 |
| `fieldop@demo`    | R. Confait         | Field Officer       | Off              | 30 Mar 2026, 00:28 |
| `lab@demo`        | S. Dogley          | Laboratory Staff    | Off              | 1 Apr 2026, 02:04  |
| `supervisor@demo` | B. Adrienne        | Supervisor          | SMS ● SIMULATED  | 29 Mar 2026, 06:26 |
| `farmer@demo`     | Marie-Ange Hoareau | Farmer              | Off              | 31 Mar 2026, 06:34 |
| `officer2@demo`   | N. Servina         | Agriculture Officer | Off              | 29 Mar 2026, 08:09 |
| `fieldop2@demo`   | T. Larue           | Field Officer       | Off              | 29 Mar 2026, 01:49 |

Footer of the users tab: _"Passwords are never stored or displayed in clear. A reset generates a new
random salt and a fresh PBKDF2-SHA256 derived key; the temporary credential for this demonstration
build is `Demo2026!`."_

---

## 5. Seed inventory (the counts the captures show)

| Collection        | Count and detail                                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clients           | **72** across **7** districts                                                                                                                                  |
| Farms             | **62** holdings · **291.52 ha** in the registry view · **54** registered · **258.73 ha** registered                                                            |
| Loans             | **26** applications · **9** open (SCR 1,290,000) · approved value **SCR 2,475,000** · outstanding **SCR 394,037** · approval rate **76 %**                     |
| Samples           | **32** — soil 14, water 5, plant 7, compost 6 · 24 in progress · 3 in testing · 8 out of range · 0 awaiting notification                                       |
| Livestock visits  | **21** — 7 complaint, 14 routine · 4 open complaints · 9 open · 5 awaiting assignment                                                                          |
| Surveillance      | **8** cases · 4 open investigations · 1 awaiting assignment · 1 confirmed · **144** animals affected · 3 diseases                                              |
| Vendors           | **15** (8 active) · 1 licence expiring within 60 days · **8/28** stalls allocated (18 vacant) · **SCR 7,500** monthly fees · **9** also on the client registry |
| Stalls            | **28** — Produce Hall A01–A08, B01–B08 · Fish Market C01–C06 · Craft & value-added D01–D06                                                                     |
| Inspections       | **21** · 5 scheduled · 4 non-compliant · **6** captured offline                                                                                                |
| Leases            | **25** on the register · 16 active · 5 expiring within 90 days · 5 payments overdue · 1 open enforcement                                                       |
| Land applications | **56** · 5 open                                                                                                                                                |
| Documents         | **16** documents / **204** pages · 16 full-text indexed · 8 linked to a client · 2 flagged in validation · **3** migration batches                             |
| Notifications     | **22** issued — 14 SMS, 5 email, 3 in-app · 8 templates · 4 feedback threads (2 new)                                                                           |
| Audit             | **88** seeded entries, hash-chained                                                                                                                            |

### Workflows

- **Agricultural loan approval (2 stages)** — last changed 2 Dec 2025 by A. Vidot,
  **9 applications currently in flight**.
  1. `Technical assessment` — Agriculture Officer — 10 days — _"Officer verifies the farm, documents and repayment capacity."_
  2. `Loan committee decision` — Supervisor — 14 days — _"Committee approves, rejects or refers the application."_
- **State land allocation (3 stages)** — `Eligibility screening` → `Site assessment` → `Allocation decision`.

Editing a definition changes how the **next** application routes. **Applications already in flight keep
the hierarchy they started under** — this is the single strongest claim in the demonstration (xi.6 ★).

### Security policy (S11 → Security policy)

Minimum password length **10** · failed attempts before lockout **5** · lockout **15 minutes** ·
session timeout **20 minutes** · require upper-case ✓ · require a number ✓ · require a symbol ✓ ·
require 2FA for every account ☐ ● SIMULATED.

### Farm intake fields (S11 → Farm intake fields) — "8 of 10 intake fields enabled"

Core, always enabled and not removable: `name` (Holding name), `parcelRef` (Parcel reference,
format PR/DD/NNNN, used by the duplicate check), `sizeHa` (Farm size), `tenure` (4 options),
`crops` (multiselect, 7 options), `livestock` (multiselect, 4 options).
Optional: `waterSource` (5 options) **enabled**, `irrigation` (5 options) **disabled**,
`organic` (3 options) **disabled**, `notes` (Officer notes) **enabled**.

---

## 6. The story records — exact identifiers

- **Marie-Ange Hoareau** — `CLT-2026-0001` · NIN `999-0412-1-1-07` · DOB 12 Apr 1987 · F · farmer ·
  `+248 2 000 001` · `marie-ange.hoareau@example.sc` · Chemin Rivière Doux, Anse Boileau, Mahé ·
  SeyID verified · self-service · registered 2 Feb 2026.
  Notes: _"Self-registered via the online portal; identity confirmed against SeyID (simulated)."_
- **The duplicate** — `CLT-2019-0311` "Marie Ange Hoareau", same NIN, `+248 2 000 099`,
  Rivière Doux, Anse Boileau, registered 14 Jun 2019 (migrated). **95 % · high.** Evidence:
  NIN _"Exact match on 999-0412-1-1-07"_ · Name _"Identical to 'Marie Ange Hoareau'"_ ·
  Date of birth _"Same date 1987-04-12"_.
- **Rivière Doux Farm** — `FRM-2026-00001` · parcel `PR/AB/1042` · Anse Boileau, Mahé · 1.6 ha ·
  leased state · water source river · banana · 240 broiler · registered 6 Feb 2026 (Back Office) ·
  GPS `-4.71924°, 55.48693°`.
- **Hoareau Smallholding** — `FRM-2019-00287` · same parcel · registered 14 Jun 2019 (migrated) ·
  owner `CLT-2019-0311`. Drives the S03 duplicate check (50 % · medium).
- **Loan `LN-2026-0014`** — Poultry house construction · SCR 85,000 · 48 months · 4.5 % ·
  submitted 28 Feb 2026 · Under review · awaiting the Supervisor at _Loan committee decision_.
  Stage 1 approved 13 Mar 2026 by J. Payet: _"Farm verified on site. Broiler capacity and repayment
  plan are realistic. Recommend approval."_ Checklist: Identity `National ID copy.pdf`, Business plan
  `Farm business plan.pdf`, Financial `Bank statement 3 months.pdf` — all **verified**.
- **Sample `LAB-2026-0031`** — soil · online · requested 8 Mar → collected 11 Mar → registered 12 Mar
  → testing 14 Mar → completed 20 Mar 2026 · analyst S. Dogley · applicant notified 20 Mar 2026 ·
  **2 outside reference range**. Purpose: _"Soil fertility assessment ahead of poultry-house siting
  and banana block replanting."_

  | Parameter                | Result     | Reference   | Method        | Flag   |
  | ------------------------ | ---------- | ----------- | ------------- | ------ |
  | pH (H₂O)                 | 5.2        | 5.5 – 7.0   | SM-4500-H     | low    |
  | Organic matter           | 4.1 %      | > 3.0       | Walkley-Black | normal |
  | Nitrogen (total)         | 0.18 %     | 0.15 – 0.30 | Kjeldahl      | normal |
  | Phosphorus (available)   | 11.4 mg/kg | 15 – 40     | Olsen         | low    |
  | Potassium (exchangeable) | 168 mg/kg  | 120 – 300   | NH₄OAc        | normal |
  | Electrical conductivity  | 0.34 dS/m  | < 1.0       | SM-2510-B     | normal |

  Interpretation: _"Moderately acidic soil with good organic matter. Available phosphorus is below the
  target range and pH is marginally low for banana."_ Recommendation: _"Apply agricultural lime at
  1.5 t/ha to raise pH toward 6.0. Correct phosphorus with a basal rock-phosphate dressing before
  replanting. Re-test in 9 months."_

- **Sample `LAB-2026-0044`** — plant · requested 27 Mar 2026 · **Testing**, results un-entered.
  _"Diagnostic submission supporting surveillance case SUR-2026-004 (suspected Newcastle disease)."_
  Parameters: Leaf nitrogen (%) 2.5–3.5 Kjeldahl · Leaf phosphorus (%) 0.16–0.30 ICP-OES ·
  Leaf potassium (%) 2.0–4.0 ICP-OES · Pathogen screen "Not detected" Culture + microscopy.
- **Case `SUR-2026-004`** — Newcastle disease · broiler · reported 26 Mar 2026 through the **farmer
  portal** · 14 affected · 3 mortality · assigned J. Payet · **Sampled** · linked `LAB-2026-0044`.
  Notes: _"Farmer reported sudden respiratory distress and greenish diarrhoea in the broiler flock,
  with three overnight deaths. Follows the mild respiratory signs noted at the routine visit
  LSV-2026-0018."_
- **Visit `LSV-2026-0018`** — routine visit, broiler · scheduled and visited 23 Mar 2026 ·
  J. Payet · **Closed** · follow-up due 30 Mar 2026. Observations, findings and action taken are quoted
  verbatim in §7 (S07). Earlier at the same holding: `LSV-2025-0119` complaint visit, 19 Apr 2025,
  _"No notifiable disease signs observed."_
- **Lease `LSE-2019-0044`** — `PR/AB/1042` · 1.6 ha · 1 Jul 2019 – 30 Jun 2029 · SCR 2,400/year ·
  payment current, next due 26 Dec 2026 · Active · 1 186 days to expiry.
- **Lease `LSE-2023-0119`** — `PR/AB/1042` · 1.6 ha · 5 Sep 2023 – 11 Apr 2026 · SCR 4,750/year ·
  payment current, next due 5 Jan 2027 · Active · **10 days remaining** (drives the expiry reminder).
- **Vendor `VND-2026-009`** — "Rivière Doux Produce" · produce · Victoria Market · stall **`VM-A04`**
  (Produce Hall, A4, SCR 900/month, allocated 16 Mar 2026) · licence `VM/2026/0091` expiring
  16 Mar 2027 · Active · registered 16 Mar 2026 against the existing client record.
- **Inspection `INS-2026-012`** — loan verification inspection · Rivière Doux Farm · **Completed**,
  **compliant**, **CAPTURED OFFLINE**.
- **Document `DOC-2019-0044`** — "Lease Agreement — Parcel PR/AB/1042 — M. Hoareau (2019)" · lease ·
  6 pages · original 1 Jul 2019 · `CLT-2026-0001` · tags lease, Anse Boileau, PR/AB/1042, state land,
  Hoareau, 2019. **Its body — and nothing else — contains the phrase `fifteen metres`.**

---

## 7. Per-screen feature list

### S01 — sign-in, registration, farmer portal

- Sign-in: `S01` `Sign in` + `i.1★` `i.8★`. _"Farmers, officers and administrators sign in here.
  Access to each module is decided by the role attached to the account."_
- Wrong password → **"4 attempts remaining before the account is locked."** The counter decrements and
  the Account-security panel mirrors it. Five failures lock the account for 15 minutes; every attempt
  is written to the audit log.
- **Account security** panel (`i.1★`), four ticked statements: salted PBKDF2-SHA256 hash (10+
  characters, upper case, number and symbol required; the prototype never holds a password in clear) ·
  accounts lock for 15 minutes after 5 failed attempts · sessions end automatically after 20 minutes of
  inactivity · every sign-in, failure and lockout is written to the append-only audit log. Then:
  _"All four values are configurable by an administrator on the Administration screen — no
  redeployment is required."_
- `Sign in with SeyID` + `● SIMULATED` + `i.8★` → dialog _"National identity verification keyed on your
  NIN."_ → NIN `999-0412-1-1-07` → **SeyID match found** returning Name / District / Mobile →
  `Continue — send passcode` → OTP dialog **showing the generated code** because delivery is simulated.
  Dialog small print: _"The prototype resolves the NIN against its own seeded records. No request
  leaves the browser. Accounts without a SeyID record fall back to email/SMS second-factor sign-in."_
- `Forgotten your password? i.6` · `Register as a farmer i.4`.
- **Demonstration accounts** panel: _"Every account below uses the password `Demo2026!`"_, the eight
  accounts with roles, then _"Marie-Ange Hoareau (farmer@demo) is the farmer the walk-through follows.
  Her SeyID NIN is 999-0412-1-1-07."_
- **Register as a farmer** (`i.4`, `ii.3★`, `xi.5`): two paths — `Verify with SeyID ● SIMULATED` or
  `Enter my details myself`. Side panel "Entered once, reused everywhere" lists Farms · Loans ·
  Laboratory · Livestock · Surveillance · Leases · Inspections and cites _"Requirement ii.5 —
  relational linking by Client ID."_
- **Farmer portal** — `Good day, Marie-Ange` `i.4` `ii.2`; _"Your holding, applications and results in
  one place. Every record below is linked to your single client record — you never re-enter these
  details."_ Actions: `Mark all as read` · `Report a sick animal viii.1` ·
  `Request a sample analysis vi.1` · **`Apply for a loan v.1`** (primary). Identity strip: Client ID ·
  NIN `ii.3★` · District · Mobile · `✓ Verified via SeyID ● SIMULATED`.
  Four KPI cards: `REGISTERED HOLDINGS 1` · `LOAN APPLICATION v.4 Under review` ·
  `LABORATORY RESULTS READY vi.8★ 1` · `UNREAD NOTIFICATIONS xiii.3 1 / 7 in total`.
  Panels: My holdings (with the OSM map) · Loan application · Laboratory results (parameters,
  references, flags, interpretation, recommendation, and _"You were notified on 20 Mar 2026 by SMS and
  email ● SIMULATED"_) · Notifications · Animal health cases · Leases · Inspections.

### S02 — client registry

- Duplicate banner: **"1 possible duplicate registration awaiting review"** `ii.7★` and
  _"Candidates are flagged, never merged automatically. Open a record to review the evidence and merge
  or dismiss."_ → `Review`.
- Search `ii.6` over name, NIN, Client ID, mobile, email, address + District / Registered via / Status
  facets + `SeyID verified only ● SIMULATED ii.3★`.
- Table: Client · NIN (with a verified tick) · District · Contact · **Linked records** (`1 farm`,
  `1 loan`, `2 lab`, `2 visits`) · Registered (date + channel) · Status.
- Profile tabs: **Overview · Farms · Loans · Laboratory · Livestock & surveillance · Land & leases ·
  Inspections · Documents · Change history**. Overview carries _Personal and contact information_
  `ii.2` and **Linked records across the system** `ii.5★` — Farms, Loan applications, Laboratory
  samples, Livestock visits, Surveillance cases, Leases, Land applications, Inspections, Vendor
  registrations, Digitized documents — with _"Each count is resolved by Client ID … the record is
  entered once and reused by every module."_
- **Merge dialog** `ii.7★`: _"Review both records before merging. The retired record is retained, not
  deleted."_ Side-by-side **SURVIVING RECORD** vs **RECORD TO RETIRE**, then _What the merge does_ —
  reassigns every farm, loan, laboratory sample, livestock visit, surveillance case, lease, land
  application, inspection, vendor registration and document from `CLT-2019-0311` to `CLT-2026-0001` ·
  marks the retired record as merged and points it at the survivor so old references keep resolving ·
  writes the merge to the change history and the append-only audit log. Button:
  **`Merge into CLT-2026-0001`**. After merging, Farms goes **1 → 2**.
- Change history `ii.4`: per-field entries with actor and timestamp, e.g. _"Contact number updated —
  phone: +248 2 000 090 → +248 2 000 001 — Corrected at counter — farmer presented handset —
  9 Feb 2026, 03:45 · J. Payet"_.

### S03 — farm registration (mobile-priority)

Sections in order, each badged: **Intake channel** `iii.1` (Back-office intake / Online submission) →
**Farmer** `iii.6` (linked by Client ID; _"Personal details are never re-keyed here."_) →
**Holding location** `iii.2★` (drag the pin, tap the map, `Use my location` + `● GPS SIMULATED`,
coordinate readout; existing holdings in grey, a candidate duplicate highlighted **amber**) →
**duplicate panel** `iii.7★` **"This holding may already be registered"** →
**Holding details** `iii.3★` (rendered from the intake configuration, chip _"8 of 10 intake fields
enabled"_) → **Supporting documents** `iii.4` (upload simulated, pending → verified) →
**Farm identification** `iii.5` (next Farm ID shown before saving).

Duplicate candidates for parcel `PR/AB/1042`:

- **Rivière Doux Farm** `FRM-2026-00001` — **90 % · high** — Parcel: _Same parcel reference PR/AB/1042_ ·
  GPS: _Registered pin is 88 m away (threshold 150 m)_ · Owner: _Registered to the same client record_.
- **Hoareau Smallholding** `FRM-2019-00287` — **50 % · medium** — Parcel: _Same parcel reference_.

A high-confidence match **blocks saving** until the officer ticks _"I have reviewed the existing
registration and confirm this is a separate holding. The override is recorded in the farm history and
the audit log."_

Registry: search + District / Activity / Status facets, `62 holdings · 291.52 ha under registration in
this view`, **Register / Map** tabs (map plots every holding over OSM). Farm profile tabs: Overview ·
Documents · Linked activity · History.

### S04 — land management

Five KPI tiles: Open applications `iv.1` · Active leases · **Expiring in 90 days** `iv.6★` ·
**Payments overdue** · Open enforcement `iv.7`.
Reminder banner `iv.6★ ● SIMULATED`: _"5 leases expire within 90 days and 5 rent payments are overdue.
Reminders go out by SMS and email and appear in the lessee's portal."_ → `Issue 5 expiry reminders` /
`Issue 5 payment reminders`; the dialog previews **one message per configured channel, per lessee**,
and sending writes **one** audit entry.
Tabs: **Allocation applications 56 · Lease register 25 · Enforcement 4 · Parcel map**.
Application detail: three-stage tracker (Eligibility screening → Site assessment → Allocation
decision) with actor, date and note per stage; tabs Overview · Assessments · Documents · History;
**Record a site assessment** `iv.3★` — Soil suitability, Slope, Water access available, Vehicle access
road present, Recommendation (_"Carried to the allocation decision stage."_), Assessment notes; parcel
map with neighbouring holdings in grey.
Lease detail: Overview · **Enforcement** · Documents · History. Enforcement ladder `iv.7`:
1 **Written warning** _"First formal notice of non-compliance, with a period to remedy."_ →
2 **Retraction notice** _"Notice of intent to retract the allocation, subject to appeal."_ →
3 **Eviction notice** _"Final notice to vacate the parcel. Requires supervisor approval."_
Each shows _Not raised_ until served. An eviction terminates the lease on the register but retains the
record.

### S05 — loans

KPI row `v.7★`: Applications (26) · Open (9, SCR 1,290,000) · Approved value (SCR 2,475,000) ·
Outstanding (SCR 394,037) · Approval rate (76 %). Charts: **Value by status** (_"Select a bar to filter
the pipeline below."_) and **Applications submitted per month** (last 12 months). Tiles and bars filter
the pipeline. Pipeline columns: Application · Farmer · Holding · Amount · Current stage · Submitted ·
Status.
Application form `v.1`: _"Your identity and holdings come from your client record — this form only asks
about the borrowing itself."_ Applicant and holding resolved · Purpose · Amount requested (SCR 5,000 –
SCR 500,000) · Repayment term (indicative 4.5 %) · **Indicative monthly repayment** (_"Simple interest,
for guidance only. The committee sets the final terms."_) · Additional detail · Supporting documents
`v.2 ● UPLOAD SIMULATED` (_"No file is transferred or stored. The prototype records the document
reference and its verification status so the review workflow can be demonstrated end-to-end."_) ·
**What happens next** read from the workflow definition.
Detail tabs: Overview · Documents · **Audit trail**. Overview shows the stage tracker
(_"Stages and their acting roles come from the workflow definition held in the system, not from code.
An administrator can change the hierarchy without a redeployment."_), the current-stage panel and the
**Document checklist** `v.2`.
**Per-stage RBAC** `v.3`/`xi.5`: as Agriculture Officer the controls are withheld with
_"This stage is awaiting a decision from a Supervisor. You are signed in as Agriculture Officer, so the
controls are not available — role-based access control is enforced per stage, not only per screen."_
As Supervisor, `Approve this stage` / `Reject application` appear. The approval dialog states
_"The application moves to the next stage, or is approved outright if this is the final stage."_,
takes a decision note (_"The note is stored on the stage, shown in the status tracker, and written to
the audit trail."_) and notes _"The applicant is notified by SMS and email when the decision is
recorded. ● SIMULATED"_.
Audit trail `v.5`: the append-only per-application timeline beside the hash-chained **System audit
entries** that reference the application.

### S06 — sampling & laboratory

KPI row: Samples (32) · In progress (24) · In testing (3) · **Results out of range** (8) ·
Awaiting notification (0) `vi.8★`. Type tabs **All types · Soil · Water · Plant · Compost**
(`vi.2`–`vi.4`), one register, one lifecycle. Columns: Sample · Applicant · Holding · Lifecycle
(5-dot) · Requested · Analyst · Status.
Sample detail: `Back to register` · `Laboratory report (PDF) vi.7` · `Notify again vi.8★`; chips for
status, _N outside reference range_, _Applicant notified … ● SIMULATED_, client `vi.6★` and holding.
**Sample lifecycle** `vi.2 vi.3 vi.4`: Requested (Applicant or officer) → Collected (Field officer) →
Registered (Laboratory) → Testing (Laboratory) → Completed (Laboratory), each with its date.
Results table `vi.5` with method under each parameter name and a low/normal/high assessment, then the
interpretation and recommendation. Submission panel `vi.1` and **Holding sampled** `vi.6★` with the map.
**Enter results** `vi.5`: _"Each parameter is assessed against its reference range as you type."_,
a banner _"2 parameters fall outside the reference range: … Explain the implication in the
interpretation below — it is reproduced on the report the applicant receives."_, and
_"All 4 parameters must be entered before the analysis can be validated — 3 recorded so far."_ →
`Validate and complete`.
**Notify the applicant** `vi.8★`: _"Result-ready messages across every configured channel. ● SIMULATED"_
— previews the SMS and the email, states _"Nothing leaves the browser — each message is recorded
against the client record and appears in their portal."_, and if already notified,
_"The applicant was already notified on 20 Mar 2026, 00:00. Sending again adds new messages rather than
replacing the originals."_

### S07 — livestock services

KPI row: Service visits (21) · **Complaint visits** (7) `vii.1★` · Open complaints (4) · Open visits (9)
· Awaiting assignment (5). Tabs All visits · Complaint visits · Routine visits.
Visit detail: **Visit progress** `vii.1★` — Registered (Officer at the district office) → Assigned
(Named officer) → Visit made (Attending officer) → Resolved (Attending officer) → Closed (Supervising
officer). **Observations and findings** `vii.3` (Observations on site / Findings / Action taken /
Follow-up due), **Visit details**, **Surveillance at this holding** `viii.4★`,
**Service history at this holding** `vii.5`, and an append-only **Visit history**.
Verbatim seeded text for `LSV-2026-0018`:

- Observations: _"Flock of 240 broilers at 28 days. Housing dry and well ventilated. Feed and water
  lines clean. Litter depth adequate. Two birds showing mild respiratory rales isolated in the sick pen."_
- Findings: _"Flock condition generally good. Mild respiratory signs in 2 of 240 birds. Vaccination
  record for Newcastle disease is up to date (last dose day 18)."_
- Action taken: _"Advised on ventilation at night and increased litter turning. Isolated birds to be
  monitored daily; report any spread within 48 hours."_
  **Register a livestock service visit**: _"Complaint visits start from a report; routine visits from the
  extension schedule. Both produce the same structured record."_ — Visit type, Holding `vii.4★`
  (_"Only holdings with livestock recorded on the farm registry are listed."_), Species concerned,
  Scheduled for, Assign to officer (_"Optional at registration. An unassigned visit shows on the
  awaiting-assignment tile."_), Complaint reported (_"What the farmer or complainant described. Recorded
  verbatim on the visit."_).

### S08 — passive surveillance

KPI row: Cases on record (8) `viii.2★` · Open investigations (4) · Awaiting assignment (1) ·
Confirmed (1) · Animals affected (144). Tabs **Case register · Geographic spread · By disease**.
Actions on a case: `Back to register` · `Change laboratory link viii.4★` · `Record negative` ·
**`Confirm disease`** (red).
**Investigation lifecycle** `viii.2★`: Reported (Farmer, officer or hotline) → Assigned (Supervisor) →
Investigating (Assigned officer) → Sampled (Assigned officer) → Closed (Supervisor).
Case detail, Holding panel with map, **Laboratory submission** `viii.4★`, **Livestock services at this
holding** `vii.4★`, append-only **Case history**.
`Link a laboratory submission` dialog: _"Only samples taken from this holding are offered, so a case
cannot be linked to the wrong farm's result."_
**Report a suspected disease case** `viii.1`: _"Report unusual illness or mortality in livestock. You do
not need to know what the disease is — describe what you can see."_ Emergency callout:
_"For sudden mass mortality, telephone the veterinary hotline immediately rather than waiting for this
report to be picked up. Isolate affected animals and stop all movement off the holding until an officer
has attended."_ Sign chips: Sudden or unusual mortality · Respiratory distress, gasping or nasal
discharge · Greenish or bloody diarrhoea · Nervous signs — twisted neck, paralysis, tremors ·
Skin lesions, scabs or swelling · Sudden drop in production · Lameness or reluctance to move.
Suspected condition hint: _"Choose the last option if you are unsure — describe the signs instead."_
Geographic spread: _"Cases plotted at the GPS location captured when the holding was registered. Amber
confirmed, green under investigation, grey closed."_

### S09 — vendors & market

KPI row: Registered vendors (15, 8 active) · Licences expiring `ix.4` (1, within 60 days) ·
Stalls allocated `ix.3` (8/28, 18 vacant) · Monthly stall fees (SCR 7,500) · Linked to a farmer (9).
Tabs **Vendor registry 15 · Victoria Market stalls 28**.
Stall board `ix.3`: _"A simplified representation of the market floor. Select a stall to allocate it to
a registered vendor or to release it."_ Legend: Allocated · Vacant · Reserved · Maintenance. Sections
**PRODUCE HALL** (rows A, B), **FISH MARKET** (row C), **CRAFT & VALUE-ADDED** (row D).
Vendor profile: Vendor profile `ix.2` · **Stall allocation** `ix.3` (with `Open the stall board`) ·
**Also on the client registry** `ii.5★` (_"This vendor is the same person as client CLT-2026-0001, so
their farming and market activity resolve together."_ with Farms / Loans / Lab samples counts) ·
**Registration history** `ix.4`.

### S10 — field operations (mobile-priority)

Connectivity bar `x.3★ ● CONNECTIVITY SIMULATED`: online — _"Captures are saved to the central register
immediately."_ with a `Go offline` switch; offline — _"Captures are held on the device and sent when the
signal returns."_ plus the toast _"Device offline ● SIMULATED — Captures will be queued until the signal
returns."_
KPI row: Inspections (21) · Scheduled (5) · Assigned to me `x.2` (3) · Non-compliant (4) ·
**Captured offline** `x.3★` (6).
Tabs **Schedule · Inspection register 21**. Calendar legend: _"Amber scheduled, green completed, struck
through cancelled. Select an entry to open the inspection."_
`Schedule a field inspection` `x.2`: _"Assigning an officer puts the inspection on their list and
notifies the holder."_ — Holding to inspect, Inspection type, Scheduled for, **Assign to officer listing
every officer with their existing load on the chosen date**, and _"The holder is notified that an
inspection has been scheduled. ● SIMULATED"_.
Capture: Findings `x.3★` (Observations on site / Findings / Outcome) · `Take photograph` `x.4`
(generated placeholders) · **`Save to device queue`** while offline → the register still reads
**Scheduled**, the header shows **pending sync (1)** and the navigation badge counts the queue →
`Go online` → **`Sync 1 now`** → the record becomes **Completed** and carries **both** the capture time
and the synchronisation time plus the `● CAPTURED OFFLINE` chip. One record, not two.
`Inspection history at this holding` `x.5`; `Export PDF` `x.6` flags which inspections were captured
offline.

### S11 — administration

Header `S11 Administration i.2 i.3 xi.3 xi.4 xi.6★` — _"Account lifecycle, the role permission matrix
the router actually enforces, the configurable approval hierarchies, the security policy behind sign-in,
and the append-only audit log."_
Tabs **User accounts · Roles & permissions · Security policy · Approval workflows · Farm intake fields ·
Audit log**.

- **User accounts** `i.3 i.6`: "8 accounts across 6 roles", columns User · Role · 2FA · Last sign-in ·
  Status · Actions (`Modify`, `Reset password`, `Deactivate`), and `+ Create account`.
- **Roles & permissions** `i.2 xi.3 xi.5`: the six-role matrix, banner _"This matrix is the enforcement
  point. The router reads the same table. Switch to a farmer account and the officer routes return an
  access-denied page rather than merely hiding the menu item. Try `#/clients` while signed in as
  `farmer@demo`."_
- **Security policy** `i.1★`: _"These values drive the sign-in screen, the registration form and the
  session timer directly. Change one and sign out — the new rule applies immediately, with no
  redeployment."_
- **Approval workflows** `xi.1 xi.6★`: _"These definitions are what the router actually executes. S04
  and S05 read the stages below when they route an application. Change one and submit a new application
  — it follows the new hierarchy immediately, with no code change and no redeployment. Applications
  already in flight keep the hierarchy they started under."_ Per stage: Stage name, Decided by
  (_"Only a user holding this role sees the decision controls."_), Service standard (days), Description,
  reorder ↑↓ and `Remove`; then `+ Add a stage`, `Save hierarchy`, `Discard changes`, an in-flight
  warning, and a **How the next application will route** live preview with the total service standard.
- **Farm intake fields** `iii.3★`: _"The S03 registration form renders from this configuration. Switch
  an optional field on or off and the form changes with no code deployment. Core fields carry Appendix
  A6 requirements and cannot be removed."_
- **Audit log** `i.7 xi.4`: green banner **"Audit chain verified"** — _"All 88 entries recomputed
  successfully. Each entry hashes its own contents together with the previous entry's hash (SHA-256),
  so altering or removing a historical entry breaks every hash after it — the log is append-only and
  tamper-evident."_ Filter by Actor and Action type; columns # · Timestamp · Actor · Action · Record ·
  Detail · **Chain** (truncated hash). Footnote: _"Seeded from 2 Dec 2025 · entries are appended by the
  application and never edited or deleted."_

### S12 — dashboard & reporting

`S12 National dashboard xii.1 xii.2 xii.3 xii.4` — _"Operational picture for {name} — panels follow the
same permissions as the underlying registries, so you see the statistics your role is entitled to."_
plus a role chip and _"Live from the demonstration data — every figure recalculates as records change."_
Tabs **Overview · Report builder**.
KPI tiles: Registered farmers (72) · Registered farms (54, 258.73 ha under registration) · Approved loan
value (SCR 2,475,000, 9 applications open) · Livestock visits (21, 9 open) · Laboratory samples (32, 24
in progress) · Surveillance cases (8, 4 under investigation) · Inspections (21, 5 scheduled) ·
Active leases (16, 25 on the register) · Active vendors (8, licensed to trade).
Charts, every one a drill-down surface `xii.7★` (_"Select a bar to list the …"_): **Farmers and farms by
district** (grouped bars) · **Loan value by status** · **Laboratory samples by type** (completed vs in
progress) · **Surveillance cases by suspected disease** (donut) · **Registrations per month** (clients
vs farms lines). Drill-down opens a titled panel — e.g. _"Farmers in Anse Boileau"_ — listing each
record with its Client ID, NIN, registration date and channel chip, linking into the registry.
Laboratory Staff sees the same screen **without** the loan and vendor panels.
**Report builder** `xii.5 xii.6`: _"Choose a dataset, narrow it, and export what you see. Only datasets
your role may read are offered — the builder cannot be used to read around access control."_
Ten datasets, free-text search, faceted filters, date range, `Clear filters`, a live preview with a
record count (_"9 of 72 clients match · District: Anse Boileau"_), the demonstration data date, and
`Export CSV` / `Export Excel` / `Export PDF xii.6`.

### S13 — notifications, communication and digitized records

**Notifications** `S13 Notifications & communication xiii.1 xiii.2 xiii.3 xiii.4★` — _"Every message the
system has issued — status updates, laboratory results, lease reminders and case updates — across SMS,
email and in-app, with the templates behind them."_ KPI row: Messages issued (22) · SMS `xiii.4★` (14,
low-connectivity reach) · Email `xiii.3` (5) · In-app (3) · New feedback `xiii.5` (2).
Tabs **Messages issued 22 · Templates 8 · Feedback & messages 4**, and `Mark all as read`.
Banner: _"SMS and email delivery is simulated — nothing leaves the browser. In-app messages are
genuinely delivered and appear in the recipient's portal. Every row says which it is."_
Templates `xiii.1`: _"Message wording is configuration, not code. Each template belongs to an event and
a channel. When S04, S05, S06, S08 or S10 raise that event, these are the words that go out — edit one
and the next message changes, with no redeployment. `{{tokens}}` are filled from the record that
triggered it."_ with `Edit wording` and a sample-value preview.
Feedback `xiii.5`: _"Two-way messaging between farmers and the department"_ with `Send a message`,
kind + status chips and threaded department responses.

**Digitized records** `S13 Digitized records xiv.2 xiv.4 xiv.6★` — _"The scanning and migration
programme: departmental paper records indexed, categorised and searchable by their content."_
KPI row: Documents `xiv.2` (16, 204 pages scanned) · Full-text indexed `xiv.4` (16, searchable by
content) · Linked to a client (8, resolve from the client profile) · Flagged in validation `xiv.3★` (2,
warning or failure) · Migration batches `xiv.1` (3, profiled, cleansed, migrated).
Tabs **Repository 16 · Migration validation 3 · Storage & access**, and `Index a scanned document xiv.2`.
Repository `xiv.4`: search box (_"Try 'Rivière Doux', 'lease', 'Hoareau' or 'fifteen metres'…"_ /
_"Searches the title, category, tags and the text extracted from the scan itself."_), Category /
Migration batch / Validation facets, an **index-tag cloud** `xiv.6★` with counts, then result cards with
the validation chip, `DOC-…`, category, page count, original date, linked client, tags and a snippet
**with the matched phrase highlighted**.
Migration validation `xiv.1 xiv.3★`: green banner **"Migration is verified, not asserted"** — _"Each
batch was profiled, cleansed and migrated, then checked automatically. The checks below compare what the
source held against what the system now holds. A failure is reported rather than absorbed — 2 checks
failed and 2 raised a warning across 11 checks, and the affected records are named."_ Totals: Records
read 120 · Records migrated 115 · Rejected 5 (held for manual re-keying) · Checks failed 2 of 11.
Per batch: reference, run date, source, Read / Migrated / Rejected, and a check table with **Expected ·
Actual · Result** (pass / warn / fail) — including _Duplicate detection_ → _"CLT-2019-0311 flagged as a
candidate duplicate of CLT-2026-0001; awaiting officer confirmation."_
**Storage & access** `xiv.5` — _"How digitized records are stored and reached. What the delivered system
does, and what this prototype does instead. Stating the difference is deliberate — the security controls
below are a design commitment, not something a browser-only prototype can demonstrate."_
Two columns:

- **IN THE DELIVERED SYSTEM** — Scanned files encrypted at rest with AES-256 · Access mediated by the
  same role matrix as every other module · Every retrieval written to the append-only audit log ·
  Nightly backup with off-site retention and restore testing.
- **IN THIS PROTOTYPE ● SIMULATED** — No real document is stored; every "scan" is a generated
  placeholder · Records live in browser storage only, and never leave the machine · Repository access is
  gated by the real permission matrix · **Encryption at rest and backup are not demonstrated here.**

Then **Who may reach the repository** — Search and read: every staff role holding `documents.view` ·
Index and manage: administrators only (`documents.manage`) · Farmers: no direct repository access;
documents relating to them surface on their own record.

---

## 8. Traceability coverage page

Reached from the footer link. `Requirement traceability coverage` — _"The 91 Appendix A6 rows, and where
each is annotated in the built prototype. Turn on requirement badges and walk the screens to populate
the 'annotated' column."_ Three tiles: **Requirement rows 91** (across 14 modules) ·
**Annotated this session N / 91** with a progress bar · **Rows the bid promised to exceed 23 ★**.
Note: _"Coverage is measured live: a row counts as annotated once a `<ReqBadge>` for it has rendered in
this browser session. Reloading the page resets the count."_ Module filter chips (`i· 0/8`, `ii· 0/7`, …)
and a table of Ref · Requirement (+ the promise beneath) · Screen(s) · Annotated. `Turn badges off`.

---

## 9. The ten generated documents

`lab-report_LAB-2026-0031.pdf` (vi.7) · `loan-monitoring-report.pdf` (v.6) ·
`loan-monitoring-report.xlsx` (v.6, xii.6) · `livestock-service-report.pdf` (vii.6) ·
`surveillance-report.pdf` (viii.5) · `vendor-market-report.pdf` (ix.5) ·
`field-inspection-report.pdf` (x.6) · `clients-report-anse-boileau.pdf` (xii.5, xii.6) ·
`clients-report-anse-boileau.csv` (xii.6) · `lease-register-report.pdf` (iv.6).

Every page carries the departmental letterhead, the filter summary and the **FICTIONAL DEMONSTRATION
DATA** notice.

---

## 10. Reset between runs

Footer → `Reset demo data` → confirm. Every record returns to the scripted starting state: the duplicate
is un-merged, the loan is back with the committee, the laboratory result is un-entered, the workflow
returns to two stages, the offline queue is empty, and the audit log returns to its seeded 88 entries.

---

## 11. The fifteen acts (running time 14–15 minutes)

| Act | Title (screens)                                      | Duration | Rows evidenced                                                      |
| --- | ---------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| 1   | Marie-Ange signs in (S01)                            | ~90 s    | i.1★, i.4, i.6, i.8★                                                |
| 2   | Her portal: entered once, reused everywhere (S01)    | ~60 s    | i.4, ii.2; touchpoints of v.4, vi.6★, vi.8★, xiii.1–xiii.4, viii.4★ |
| 3   | The officer's registry and the duplicate merge (S02) | ~2 min   | i.5, ii.1, ii.3★, ii.4, ii.5★, ii.6, ii.7★                          |
| 4   | Registering a farm on a phone (S03)                  | ~2 min   | iii.1–iii.7                                                         |
| 5   | Her loan reaches the committee (S05)                 | ~2 min   | v.1–v.7★                                                            |
| 6   | The laboratory closes the loop (S06)                 | ~2 min   | vi.1–vi.8★                                                          |
| 7   | Land: leases, reminders and enforcement (S04)        | ~2 min   | iv.1–iv.8                                                           |
| 8   | The livestock visit and the disease case (S07, S08)  | ~2 min   | vii.1★, vii.3, vii.4★, vii.5, viii.1, viii.2★, viii.3, viii.4★      |
| 9   | Market day (S09)                                     | ~60 s    | ix.1–ix.5                                                           |
| 10  | The offline inspection (S10)                         | ~2 min   | x.1–x.6                                                             |
| 11  | The workflow configurator (S11) ★                    | ~90 s    | xi.6★                                                               |
| 12  | The national picture (S12)                           | ~2 min   | xii.1–xii.7★                                                        |
| 13  | Notifications and the paper trail (S13)              | ~2 min   | xiii.1–xiii.5, xiv.1–xiv.6★                                         |
| 14  | Administration: roles, policy, audit (S11)           | ~90 s    | i.2, i.3, i.6, i.7, xi.3, xi.4, xi.5                                |
| 15  | Traceability (closing)                               | ~30 s    | —                                                                   |

For a 10-minute cut, drop Acts 7 and 9 and shorten Act 11 to the RBAC proof and the audit chain. Acts
whose evidence includes ★ rows are never cut.
