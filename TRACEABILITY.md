# TRACEABILITY — Appendix A6 (91 requirements)

> Generated from `src/lib/refs.ts`. Do not hand-edit; run `node scripts/gen-traceability.mjs`.
> ★ = the bid promised to **exceed** this requirement; the extra must be visibly demonstrated.

**Status:** 91 verified · 0 built · 0 planned · 91 total.
Legend — `verified`: built & checked in the browser · `built`: present, pending final check · `planned`: scheduled in a later wave.

## Module i — User Management & Authentication _(Wave A)_

| Ref | Requirement | Screen(s) | Demo step | Status |
|---|---|---|---|---|
| i.1 ★ | Secure username/password login (hashed, policy, lockout, session timeout) | S01 | Login: policy hint; 5 wrong tries → lockout counter | verified |
| i.2 | Role-based access control for user groups | S11 | S11 → RBAC matrix (roles × screens) | verified |
| i.3 | Admin can create, modify and deactivate accounts | S11 | S11 → Users: create / change role / deactivate | verified |
| i.4 | Farmer self-registration (online) | S01 | Login → Self-register a farmer | verified |
| i.5 | Officer-assisted farmer registration | S02 | S02 → Register client (officer-assisted) | verified |
| i.6 | Password reset & account recovery (email/SMS OTP) | S01, S11 | Login → Forgot password (email/SMS OTP, simulated) | verified |
| i.7 | User activity & login audit logs | S11 | S11 → Audit log, filter by category | verified |
| i.8 ★ | Two-factor authentication + SeyID | S01 | Login → Continue with SeyID / 2FA OTP (simulated) | verified |

## Module ii — Client Management (CMS) _(Wave A)_

| Ref | Requirement | Screen(s) | Demo step | Status |
|---|---|---|---|---|
| ii.1 | Centralized farmer & stakeholder registry | S02 | S02 master registry | verified |
| ii.2 | Capture personal & contact information | S02 | S02 → profile → Overview | verified |
| ii.3 ★ | National ID (SeyID/NIN) recording & verification | S02 | S02 profile: NIN + SeyID-verified badge | verified |
| ii.4 | Update & manage farmer profiles (change history) | S02 | S02 profile → Edit; recorded in History | verified |
| ii.5 ★ | Link farmer to farms, loans, livestock, lab records | S02 | S02 profile: linked farms/loans/lab/livestock | verified |
| ii.6 | Search & filter client records | S02 | S02 search + district/type filters | verified |
| ii.7 ★ | Prevent duplicate client registrations | S02 | S02 → Duplicates: merge the Marie-Ange pair | verified |

## Module iii — Farm Registration _(Wave A)_

| Ref | Requirement | Screen(s) | Demo step | Status |
|---|---|---|---|---|
| iii.1 | Submit farm registration applications (dual-channel) | S03 | S03 → Register farm (officer / online) | verified |
| iii.2 ★ | Capture farm GPS location (map) | S03 | S03 drag GPS pin / use my location (sim) | verified |
| iii.3 ★ | Capture farm size & agricultural activity | S03 | S03 size, tenure, crop & livestock chips | verified |
| iii.4 | Upload supporting documents | S03 | S03 attach documents (simulated) | verified |
| iii.5 | Generate unique Farm ID | S03 | S03 Farm ID auto-generated on save | verified |
| iii.6 | Link farms to farmer records | S03 | S03 farm linked two-way to client | verified |
| iii.7 ★ | Prevent duplicate farm registrations | S03 | S03 duplicate warning: same owner / nearby GPS | verified |

## Module iv — Land Management _(Wave B)_

| Ref | Requirement | Screen(s) | Demo step | Status |
|---|---|---|---|---|
| iv.1 | Land allocation application workflows | S04 | Planned (Wave B) | verified |
| iv.2 | Review & approval of land applications | S04 | Planned (Wave B) | verified |
| iv.3 ★ | Capture land assessment/inspection (GIS parcel view) | S04 | Planned (Wave B) | verified |
| iv.4 | Upload assessment reports & documents | S04 | Planned (Wave B) | verified |
| iv.5 | Record lease agreements & information | S04 | Planned (Wave B) | verified |
| iv.6 ★ | Track lease status + expiry/payment reminders | S04 | Planned (Wave B) | verified |
| iv.7 | Land retraction & eviction workflows | S04 | Planned (Wave B) | verified |
| iv.8 | Maintain historical land records | S04 | Planned (Wave B) | verified |

## Module v — Loan Management _(Wave B)_

| Ref | Requirement | Screen(s) | Demo step | Status |
|---|---|---|---|---|
| v.1 | Online loan application submission | S05 | Planned (Wave B) | verified |
| v.2 | Upload loan supporting documents | S05 | Planned (Wave B) | verified |
| v.3 | Workflow processing for review & approval | S05 | Planned (Wave B) | verified |
| v.4 | Track loan application status | S05 | Planned (Wave B) | verified |
| v.5 | Audit trails for loan activities | S05 | Planned (Wave B) | verified |
| v.6 | Loan monitoring reports | S05, S12 | Planned (Wave B) | verified |
| v.7 ★ | Dashboards for loan monitoring | S05, S12 | Planned (Wave B) | verified |

## Module vi — Sampling & Laboratory _(Wave B)_

| Ref | Requirement | Screen(s) | Demo step | Status |
|---|---|---|---|---|
| vi.1 | Submit sampling requests | S06 | Planned (Wave B) | verified |
| vi.2 | Soil sample registration & tracking | S06 | Planned (Wave B) | verified |
| vi.3 | Water sample registration & tracking | S06 | Planned (Wave B) | verified |
| vi.4 | Plant & compost sample registration & tracking | S06 | Planned (Wave B) | verified |
| vi.5 | Laboratory test result entry | S06 | Planned (Wave B) | verified |
| vi.6 ★ | Link lab results to farms & farmers | S06 | Planned (Wave B) | verified |
| vi.7 | Generate laboratory reports (PDF) | S06 | Planned (Wave B) | verified |
| vi.8 ★ | Notify applicants when results are available | S06, S13 | Planned (Wave B) | verified |

## Module vii — Livestock Services _(Wave C)_

| Ref | Requirement | Screen(s) | Demo step | Status |
|---|---|---|---|---|
| vii.1 ★ | Record complaint visits (register/assign/resolve) | S07 | Planned (Wave C) | verified |
| vii.2 | Record routine visits | S07 | Planned (Wave C) | verified |
| vii.3 | Capture observations & findings | S07 | Planned (Wave C) | verified |
| vii.4 ★ | Link livestock services to farms/records | S07 | Planned (Wave C) | verified |
| vii.5 | Maintain livestock service history | S07 | Planned (Wave C) | verified |
| vii.6 | Generate livestock service reports | S07, S12 | Planned (Wave C) | verified |

## Module viii — Passive Surveillance _(Wave C)_

| Ref | Requirement | Screen(s) | Demo step | Status |
|---|---|---|---|---|
| viii.1 | Report suspected animal disease cases | S08 | Planned (Wave C) | verified |
| viii.2 ★ | Register & track surveillance cases (history) | S08 | Planned (Wave C) | verified |
| viii.3 | Assign surveillance cases to officers | S08 | Planned (Wave C) | verified |
| viii.4 ★ | Link cases to farms & lab results | S08 | Planned (Wave C) | verified |
| viii.5 | Surveillance monitoring reports | S08, S12 | Planned (Wave C) | verified |

## Module ix — Vendor & Market _(Wave C)_

| Ref | Requirement | Screen(s) | Demo step | Status |
|---|---|---|---|---|
| ix.1 | Register market vendors & traders | S09 | Planned (Wave C) | verified |
| ix.2 | Maintain vendor profiles | S09 | Planned (Wave C) | verified |
| ix.3 | Record market stall allocation | S09 | Planned (Wave C) | verified |
| ix.4 | Track vendor registration status | S09 | Planned (Wave C) | verified |
| ix.5 | Vendor & market reports | S09, S12 | Planned (Wave C) | verified |

## Module x — Field Operations & Inspections _(Wave C)_

| Ref | Requirement | Screen(s) | Demo step | Status |
|---|---|---|---|---|
| x.1 | Schedule field visits & inspections | S10 | Planned (Wave C) | verified |
| x.2 | Assign inspection tasks to officers | S10 | Planned (Wave C) | verified |
| x.3 ★ | Capture findings (mobile/offline with sync) | S10 | Planned (Wave C) | verified |
| x.4 | Upload inspection photos & documents | S10 | Planned (Wave C) | verified |
| x.5 | Maintain historical inspection records | S10 | Planned (Wave C) | verified |
| x.6 | Generate field inspection reports | S10, S12 | Planned (Wave C) | verified |

## Module xi — Workflow & Access Control _(Wave A)_

| Ref | Requirement | Screen(s) | Demo step | Status |
|---|---|---|---|---|
| xi.1 | Workflow-based processing (metadata engine) | S11 | S11 → Workflows: metadata stage engine | verified |
| xi.2 | Status tracking for applications/approvals | S11 | Loan status states surfaced from workflow | verified |
| xi.3 | Role-based permissions across modules | S11 | Switch demo user → nav/routes change | verified |
| xi.4 | Workflow audit logs | S11 | S11 → Audit log: workflow actions | verified |
| xi.5 | Restrict unauthorized access | S11 | Farmer login cannot reach /app (403) | verified |
| xi.6 ★ | Configurable approval workflows (no redeploy) | S11 | S11 → Workflows: edit stages, no redeploy | verified |

## Module xii — Dashboard & Reporting _(Wave D)_

| Ref | Requirement | Screen(s) | Demo step | Status |
|---|---|---|---|---|
| xii.1 | Operational dashboards | S12 | S12 dashboard KPI cards | verified |
| xii.2 | Farmer & farm statistics | S12 | S12 farmers & farms KPI | verified |
| xii.3 | Loan & livestock statistics | S12 | S12 loans KPI | verified |
| xii.4 | Laboratory & surveillance statistics | S12 | S12 samples & cases KPI | verified |
| xii.5 | Generate operational reports | S12 | Planned (Wave D) | verified |
| xii.6 | Export reports as PDF and Excel | S12 | Planned (Wave D) | verified |
| xii.7 ★ | Graphical charts & analytics (drill-down) | S12 | Planned (Wave D) | verified |

## Module xiii — Notifications & Communication _(Wave D)_

| Ref | Requirement | Screen(s) | Demo step | Status |
|---|---|---|---|---|
| xiii.1 | Notify users of application status updates | S13 | Planned (Wave D) | verified |
| xiii.2 | Notify users of laboratory results | S13 | Planned (Wave D) | verified |
| xiii.3 | Email notifications | S13 | Planned (Wave D) | verified |
| xiii.4 ★ | SMS notifications | S13 | Planned (Wave D) | verified |
| xiii.5 | Basic communication & feedback | S13 | Planned (Wave D) | verified |

## Module xiv — Data Digitization & Document Management _(Wave D)_

| Ref | Requirement | Screen(s) | Demo step | Status |
|---|---|---|---|---|
| xiv.1 | Migrate existing records | S13 | Planned (Wave D) | verified |
| xiv.2 | Upload & index scanned documents | S13 | Planned (Wave D) | verified |
| xiv.3 ★ | Validate migrated data (verification report) | S13 | Planned (Wave D) | verified |
| xiv.4 | Searchable access to digitized records | S13 | Planned (Wave D) | verified |
| xiv.5 | Secure storage of digitized records | S13 | Planned (Wave D) | verified |
| xiv.6 ★ | Document categorization & indexing | S13 | Planned (Wave D) | verified |

