# TRACEABILITY.md — Appendix A6 requirement matrix

Agriculture Information System (AIS) — Phase 1: Foundation Systems
Demonstration prototype · Cutting-Edge Consultancy

**Generated file — do not edit by hand.** The 91 requirement rows come from
`src/lib/refs.ts`, which also drives the in-app `?refs=1` requirement badges, so
this matrix cannot drift from the build. Demo steps and statuses are maintained
in `scripts/traceability.mjs`; regenerate with:

```bash
npm run traceability
```

## Status summary

| Status | Rows | Meaning |
|---|---|---|
| `verified` | 91 | Walked in the browser at 390 px and 1366 px; behaves as the demo step describes |
| `built` | 0 | Code and data present and visible, owning screen still to be delivered |
| `planned` | 0 | Scheduled for a later build wave |
| **Total** | **91** | |

★ marks the 23 rows where the proposal promised to **exceed** the requirement.
Those extras must be visibly demonstrated, not implied.

**Build waves** (CLAUDE.md §7.1) — A: shell, S01, S02, S03, S11 RBAC skeleton ·
B: S04, S05, S06 · C: S07–S10 · D: S11 complete, S12, S13, polish.


## Module i — USER MANAGEMENT & AUTHENTICATION

| Ref | Requirement (Appendix A6) | Promised in the proposal | Screen(s) | Demo step | Wave | Status |
|---|---|---|---|---|---|---|
| i.1 ★ | Secure user authentication through username and password login | Hardened login; encrypted password storage (salted hash); ★ configurable password policy, lockout, session timeout | S01 | S01 sign-in: enter a wrong password → live "N attempts remaining" counter; Account-security panel states the salted-PBKDF2 storage, lockout and 20-minute session timeout. S11 → Security policy edits all four values. | A | `verified` |
| i.2 | Role-based access control for different user groups | Granular RBAC — Admin, Agriculture Officer, Field Officer, Laboratory Staff, Supervisor, Farmer | S11 | S11 → Roles & permissions: the six-role matrix. It is the same table the router reads. | A | `verified` |
| i.3 | Administrators can create, modify, and deactivate user accounts | Admin console for full account lifecycle | S11 | S11 → User accounts: Create account, Modify (role / 2FA), Deactivate, Reactivate. | A | `verified` |
| i.4 | Farmer self-registration through online access | Public self-service registration portal | S01 | S01 → Register as a farmer: SeyID path or manual path, ending in a new client + portal account. | A | `verified` |
| i.5 | Officer-assisted farmer registration | Back-office registration workflow | S02 | S02 → Register a client: back-office intake with SeyID verify and live duplicate check. | A | `verified` |
| i.6 | Password reset and account recovery functionality | Self-service reset + admin recovery, email/SMS OTP | S01, S11 | S01 → Forgotten your password: passcode → new password → lockout cleared. S11 → Reset password issues a temporary credential. | A | `verified` |
| i.7 | Maintain user activity and login audit logs | Append-only, tamper-evident audit log | S11 | S11 → Audit log: "Audit chain verified — all N entries recomputed". Filter by actor and action type. | A | `verified` |
| i.8 ★ | Support two-factor authentication (2FA) | ★ MFA/2FA (TOTP); ★ SeyID (OTP/QR) integration keyed on NIN with local-MFA fallback for non-SeyID users | S01 | S01 → Sign in with SeyID (NIN 999-0412-1-1-07) → OTP dialog. Any 2FA-enabled account shows the same step after its password. | A | `verified` |

## Module ii — CLIENT MANAGEMENT (CMS)

| Ref | Requirement (Appendix A6) | Promised in the proposal | Screen(s) | Demo step | Wave | Status |
|---|---|---|---|---|---|---|
| ii.1 | Maintain a centralized farmer and stakeholder database | Single master client registry (source of truth) | S02 | S02 client registry — 72 seeded clients across seven districts. | A | `verified` |
| ii.2 | Capture farmer personal and contact information | Structured client profile | S02 | S02 → open a client → Overview → Personal and contact information. | A | `verified` |
| ii.3 ★ | Support National Identification (SeyID/NIN) recording | ★ NIN capture with SeyID verification | S02 | S02 profile shows the NIN with a SeyID-verified chip; S02 registration and S01 both verify against SeyID (simulated). | A | `verified` |
| ii.4 | Support updating and management of farmer profiles | Full profile lifecycle with change history | S02 | S02 → Edit profile → change the mobile number → Change history tab records field, old value, new value, officer and timestamp. | A | `verified` |
| ii.5 ★ | Link farmer records with farms, loans, livestock services, and laboratory records | ★ Relational linking across all modules by Client ID | S02 | S02 → Overview → "Linked records across the system": farms, loans, laboratory, livestock, surveillance, leases, land, inspections, vendor, documents — all resolved by Client ID. | A | `verified` |
| ii.6 | Support searching and filtering of client records | Indexed search + faceted filters + full-text | S02 | S02 search box (name, NIN, Client ID, mobile, email, address) plus district / channel / status / SeyID facets. | A | `verified` |
| ii.7 ★ | Prevent duplicate client registrations | ★ Duplicate detection on NIN / name / contact | S02 | S02 banner flags CLT-2019-0311 against CLT-2026-0001 (NIN exact, name identical, DOB same) → Review → Merge → linked records reassigned, legacy record retired not deleted. | A | `verified` |

## Module iii — FARM REGISTRATION

| Ref | Requirement (Appendix A6) | Promised in the proposal | Screen(s) | Demo step | Wave | Status |
|---|---|---|---|---|---|---|
| iii.1 | Allow submission of farm registration applications | Dual-channel (online + back-office) registration workflow | S03 | S03 → Register a farm → Intake channel: back-office or online submission, recorded on the record. | A | `verified` |
| iii.2 ★ | Capture farm GPS location information | ★ GIS-enabled GPS capture + map view | S03 | S03 map: drag the pin, tap the map, or "Use my location" (simulated fix). Coordinates shown; S03 Map tab plots the whole registry. | A | `verified` |
| iii.3 ★ | Capture farm size and agricultural activity information | Structured intake; ★ configurable intake fields; crop/livestock activity | S03 | S03 → Holding details, rendered from the intake configuration ("8 of 10 intake fields enabled"). Toggle a field in S11 → Farm intake fields and the form changes. | A | `verified` |
| iii.4 | Support upload of supporting documents | Document upload with verification workflow | S03 | S03 → Supporting documents (upload simulated); S03 farm profile → Documents → Mark as verified. | A | `verified` |
| iii.5 | Generate unique Farm Identification Numbers (Farm ID) | Auto-generated Farm ID | S03 | S03 → Farm identification panel shows the next Farm ID (FRM-2026-000NN) before saving. | A | `verified` |
| iii.6 | Link farms to farmer records | Two-way link to CMS by Client ID | S03 | S03 → Farmer panel links by Client ID; the saved farm carries a link back to the client, and the client profile lists the farm. | A | `verified` |
| iii.7 ★ | Prevent duplicate farm registrations | ★ Duplicate detection on parcel / GPS / owner | S03 | S03 → set the pin near Rivière Doux Farm → "nearby registration to check" with parcel / GPS distance / owner reasons. A high-confidence match blocks saving until the officer records an override. | A | `verified` |

## Module iv — LAND MANAGEMENT

| Ref | Requirement (Appendix A6) | Promised in the proposal | Screen(s) | Demo step | Wave | Status |
|---|---|---|---|---|---|---|
| iv.1 | Support land allocation application workflows | Configurable submission → review → decision workflow | S04 | S04 → Allocation applications → open one → the three-stage workflow (eligibility screening → site assessment → allocation decision) with its status tracker. | B | `verified` |
| iv.2 | Support review and approval of land applications | Routed, role-based approvals with status tracking | S04 | S04 application → the decision panel appears only for the role the current stage names; approving routes to the next stage and notifies the applicant. | B | `verified` |
| iv.3 ★ | Capture land assessment and inspection information | Structured assessment/inspection capture; ★ GIS parcel view | S04 | S04 application → Assessments → "Record an assessment": soil suitability, slope, water access, access road and recommendation. Overview carries the parcel map with neighbouring holdings in grey. | B | `verified` |
| iv.4 | Support upload of assessment reports and supporting documents | Document uploads with metadata/versioning | S04 | S04 application → Documents: assessment reports and site plans, upload simulated, with verification status. | B | `verified` |
| iv.5 | Record lease agreements and lease information | Lease register with terms | S04 | S04 → Lease register; open a lease for its terms, or approve an allocation and use "Issue lease" to create one. | B | `verified` |
| iv.6 ★ | Track lease status (active/expired/pending) | Status tracking; ★ lease-expiry + ★ lease-payment reminders and reports | S04 | S04 KPI tiles show leases expiring within 90 days and payments overdue; the banner issues bulk expiry and payment reminders (SMS/email, simulated) and writes one audit entry. Export PDF/Excel produces the lease register report. | B | `verified` |
| iv.7 | Support land retraction and eviction workflows | Non-compliance → retraction → eviction workflow with approvals and notices | S04 | S04 lease → Enforcement: the three-step ladder — written warning → retraction notice → eviction notice. Raising a notice serves it, notifies the lessee, and an eviction terminates the lease while retaining the record. | B | `verified` |
| iv.8 | Maintain historical land management records | Immutable land enforcement/allocation history | S04 | S04 application → History, and S04 lease → History and Enforcement history: append-only timelines with actor and timestamp. | B | `verified` |

## Module v — LOAN MANAGEMENT

| Ref | Requirement (Appendix A6) | Promised in the proposal | Screen(s) | Demo step | Wave | Status |
|---|---|---|---|---|---|---|
| v.1 | Support online loan application submission | Farmer-facing application form | S05 | S01 portal → "Apply for a loan" → S05 application form. Identity and holdings resolve from the client record; only the borrowing is asked for. | B | `verified` |
| v.2 | Support upload of loan supporting documents | Document upload with validation | S05 | S05 application → Supporting documents (upload simulated); S05 detail → Document checklist marks Identity, Business plan and Financial as present, pending or missing. | B | `verified` |
| v.3 | Support workflow processing for review and approval | Configurable multi-stage approval workflow | S05 | S05 detail → Approval workflow. Sign in as officer@demo on LN-2026-0014 and the controls are withheld with an explanation; sign in as supervisor@demo and the committee decision is available — per-stage actors, from the workflow definition. | B | `verified` |
| v.4 | Track loan application status | End-to-end status tracking | S05 | S05 status tracker end to end, mirrored on S01 and on the client profile; the pipeline can be filtered by status or by awaiting stage. | B | `verified` |
| v.5 | Maintain audit trails for loan activities | Append-only audit of all decisions/actions | S05 | S05 detail → Audit trail: the per-application timeline beside the hash-chained central audit entries that reference the application. | B | `verified` |
| v.6 | Generate loan monitoring reports | Standard + ad-hoc loan reports | S05, S12 | S05 → Export PDF / Export Excel produce the loan monitoring report over the current filter, with the fictional-data notice on every page. | B | `verified` |
| v.7 ★ | Provide dashboards for loan monitoring | ★ Real-time loan dashboards/KPIs | S05, S12 | S05 KPI tiles (applications, open value, approved value, outstanding, approval rate) plus the value-by-status bar chart and submissions-per-month line chart. Tiles and bars filter the pipeline. | B | `verified` |

## Module vi — SAMPLING & LABORATORY MANAGEMENT

| Ref | Requirement (Appendix A6) | Promised in the proposal | Screen(s) | Demo step | Wave | Status |
|---|---|---|---|---|---|---|
| vi.1 | Support submission of sampling requests | Online/back-office sampling request | S06 | S01 portal → "Request a sample analysis", or S06 → "New sampling request". The channel (online or back-office) is recorded on the sample. | B | `verified` |
| vi.2 | Support soil sample registration and tracking | Sample registry + lifecycle tracking | S06 | S06 → Soil tab; open a sample for the collected → registered → testing → completed lifecycle, each step naming the role that performs it. | B | `verified` |
| vi.3 | Support water sample registration and tracking | Sample registry + lifecycle tracking | S06 | S06 → Water tab; same lifecycle and a water-specific analysis panel (pH, turbidity, nitrate, E. coli, TDS). | B | `verified` |
| vi.4 | Support plant and compost sample registration and tracking | Sample registry + lifecycle tracking | S06 | S06 → Plant and Compost tabs; each carries its own panel of parameters and reference ranges. | B | `verified` |
| vi.5 | Support laboratory test result entry | Structured result capture | S06 | S06 sample in testing → "Enter results". Each parameter is assessed against its reference range as it is typed, and every parameter must be present before the analysis can be validated. | B | `verified` |
| vi.6 ★ | Link laboratory results to farms and farmers | ★ Auto-link to Farm/Client by ID | S06 | S06 sample header links to the client and the holding by ID, and the holding map is shown on the sample itself. | B | `verified` |
| vi.7 | Generate laboratory reports | Templated lab reports (PDF/Excel) | S06 | S06 completed sample → "Laboratory report (PDF)": a departmental certificate with letterhead, chain of custody, results table with out-of-range rows tinted, interpretation, recommendation and signature block. | B | `verified` |
| vi.8 ★ | Notify applicants when results are available | ★ Email/SMS/in-app result notifications | S06, S13 | S06 completed sample → "Notify applicant": previews every configured channel, then records SMS, email and in-app messages against the client and stamps the sample as notified. | B | `verified` |

## Module vii — LIVESTOCK SERVICES MANAGEMENT

| Ref | Requirement (Appendix A6) | Promised in the proposal | Screen(s) | Demo step | Wave | Status |
|---|---|---|---|---|---|---|
| vii.1 ★ | Support recording of complaint visits | Complaint-visit capture; ★ complaint registration, assignment & resolution tracking | S07 | S07 → Register a visit → Complaint visit. The detail screen shows the handling ladder — registered → assigned → visit made → resolved → closed — with Assign officer and Record findings driving it. | C | `verified` |
| vii.2 | Support recording of routine visits | Routine-visit capture with details | S07 | S07 → Register a visit → Routine visit, scheduled from the extension programme. Same record, different origin. | C | `verified` |
| vii.3 | Capture livestock service observations and findings | Structured observations/findings | S07 | S07 visit → Record findings: observations on site, findings, action taken and an optional follow-up date. | C | `verified` |
| vii.4 ★ | Link livestock services to farms and farmer records | ★ Link by Farm/Client ID | S07 | S07 visit header links to the client and holding by ID; the holding selector only offers farms with livestock on the farm registry. | C | `verified` |
| vii.5 | Maintain livestock service history records | Full service history per farm/client | S07 | S07 visit → "Service history at this holding" lists every other visit at the same Farm ID, and S02 → Livestock & surveillance lists them by client. | C | `verified` |
| vii.6 | Generate livestock service reports | Service reports + monitoring | S07, S12 | S07 → Export PDF / Excel produces the livestock service report over the current filter. | C | `verified` |

## Module viii — PASSIVE SURVEILLANCE

| Ref | Requirement (Appendix A6) | Promised in the proposal | Screen(s) | Demo step | Wave | Status |
|---|---|---|---|---|---|---|
| viii.1 | Support reporting of suspected animal disease cases | Case reporting intake | S08 | S01 portal → "Report a sick animal", or S08 → "Report a suspected case". Sign prompts let a farmer report what they see without naming a disease. | C | `verified` |
| viii.2 ★ | Register and track surveillance cases | Case registry + lifecycle tracking; ★ historical records | S08 | S08 case register with the reported → assigned → investigating → sampled → closed lifecycle; the case detail lists historical cases at the same holding. | C | `verified` |
| viii.3 | Assign surveillance cases to officers | Role-based case assignment | S08 | S08 case → Assign officer (supervisor permission). Unassigned cases surface on the awaiting-assignment tile. | C | `verified` |
| viii.4 ★ | Link surveillance cases to farms and laboratory results | ★ Link to Farm and Lab result by ID | S08 | S08 case → "Link laboratory submission" offers only samples from the same holding, then the result decides Confirm disease or Record negative. SUR-2026-004 ↔ LAB-2026-0044 is seeded. | C | `verified` |
| viii.5 | Generate surveillance monitoring reports | Surveillance reports/dashboards | S08, S12 | S08 → Export PDF / Excel, plus the geographic-spread map and the by-disease breakdown. | C | `verified` |

## Module ix — VENDOR & MARKET MANAGEMENT

| Ref | Requirement (Appendix A6) | Promised in the proposal | Screen(s) | Demo step | Wave | Status |
|---|---|---|---|---|---|---|
| ix.1 | Support registration of market vendors and traders | Vendor/trader registry | S09 | S09 → Register a vendor. A farmer who trades is registered against their existing client record rather than keyed again. | C | `verified` |
| ix.2 | Maintain vendor profiles and records | Vendor profile with contact/credentials | S09 | S09 → open a vendor: profile, licence, contact and — where the vendor is also a farmer — their farms, loans and lab samples. | C | `verified` |
| ix.3 | Record market stall allocation information | Stall allocation records | S09 | S09 → Victoria Market stalls: the floor laid out by section and row. Select a stall to allocate it to an active vendor or release it. | C | `verified` |
| ix.4 | Track vendor registration status | Status tracking | S09 | S09 vendor → Change status / Renew licence; the registry flags licences expiring within 60 days. | C | `verified` |
| ix.5 | Generate vendor and market reports | Vendor/market reports | S09, S12 | S09 → Export PDF / Excel produces the vendor and market report including stall and fee position. | C | `verified` |

## Module x — FIELD OPERATIONS & INSPECTIONS

| Ref | Requirement (Appendix A6) | Promised in the proposal | Screen(s) | Demo step | Wave | Status |
|---|---|---|---|---|---|---|
| x.1 | Support scheduling of field visits and inspections | Scheduling with calendar/assignment | S10 | S10 → Schedule tab: month calendar of scheduled and completed inspections; "Schedule an inspection" adds one. | C | `verified` |
| x.2 | Assign inspection tasks to officers | Task assignment to field officers | S10 | S10 scheduling dialog lists officers with their existing load on the chosen date; the holder is notified on assignment. | C | `verified` |
| x.3 ★ | Capture inspection findings and observations | Structured findings; ★ mobile/offline capture with sync | S10 | S10 → open an assigned inspection → "Go offline" → capture → "Save to device queue". The register still shows it scheduled, the navigation badge counts the queue, and "Sync now" on reconnect completes the record with both the capture and synchronisation times. | C | `verified` |
| x.4 | Support upload of inspection photos and documents | Photo/document upload from device | S10 | S10 capture → "Take photograph": generated placeholder images, captioned, thumbnailed and viewable full size. | C | `verified` |
| x.5 | Maintain historical field inspection records | Immutable inspection history | S10 | S10 inspection → "Inspection history at this holding" plus the append-only entry timeline on the record itself. | C | `verified` |
| x.6 | Generate field inspection reports | Inspection reports/summaries | S10, S12 | S10 → Export PDF / Excel produces the field inspection report, including which inspections were captured offline. | C | `verified` |

## Module xi — WORKFLOW & ACCESS CONTROL

| Ref | Requirement (Appendix A6) | Promised in the proposal | Screen(s) | Demo step | Wave | Status |
|---|---|---|---|---|---|---|
| xi.1 | Support workflow-based processing | Central metadata-driven workflow engine | S11 | One engine (src/lib/workflow.ts) drives both the two-stage loan approval and the three-stage land allocation from stored definitions — S05 and S04 decisions run through it. | B | `verified` |
| xi.2 | Support status tracking for applications and approvals | Pending / Under-Review / Approved / Rejected states | S11 | Pending / under-review / approved / rejected tracked and displayed on S04, S05, S01 and S02, with stage-level status inside each application. | B | `verified` |
| xi.3 | Support role-based permissions | Granular RBAC across all modules | S11 | S11 → Roles & permissions, enforced by RequirePermission on every route. | A | `verified` |
| xi.4 | Maintain workflow audit logs | Append-only workflow/action audit | S11 | S11 → Audit log includes workflow and record actions alongside sign-ins; the hash chain is recomputed on view. | A | `verified` |
| xi.5 | Restrict unauthorized access to sensitive information | Enforced RBAC + record-level controls | S11 | Sign in as farmer@demo and open #/clients → Access denied page naming the role and the path. | A | `verified` |
| xi.6 ★ | Support configurable approval workflows | ★ Admin-configurable approval hierarchies (no redeploy) | S11 | S11 → Approval workflows: rename a stage, change its acting role or service standard, reorder, add or remove. Add "Director's endorsement" to the loan hierarchy, save, then submit a new application from S01 — it routes through three stages while an application already in flight keeps its original two. No redeployment. | D | `verified` |

## Module xii — DASHBOARD & REPORTING

| Ref | Requirement (Appendix A6) | Promised in the proposal | Screen(s) | Demo step | Wave | Status |
|---|---|---|---|---|---|---|
| xii.1 | Provide operational dashboards | Role-based real-time dashboards | S12 | S12 is the landing screen for every staff role. Panels are gated on the same permission as the underlying registry, so lab@demo sees laboratory statistics and not the loan book. | D | `verified` |
| xii.2 | Display statistics for farmers and farms | Registered farmers/farms KPIs | S12 | S12 KPI tiles for registered farmers and farms with total hectares, plus the farmers-and-farms-by-district chart. | D | `verified` |
| xii.3 | Display loan and livestock service statistics | Loan/livestock KPIs | S12 | S12 KPI tiles for approved loan value, open applications and livestock visits, plus the loan-value-by-status chart. | D | `verified` |
| xii.4 | Display laboratory and surveillance statistics | Lab/surveillance KPIs | S12 | S12 KPI tiles for laboratory samples and surveillance cases, plus the samples-by-type and cases-by-disease charts. | D | `verified` |
| xii.5 | Generate operational reports | Standard + ad-hoc report builder | S12 | S12 → Report builder: ten datasets, faceted filters, date range and free-text search, with a live preview and computed totals. | D | `verified` |
| xii.6 | Support report export in PDF and Excel formats | Multi-format export (PDF/Excel/CSV) | S12 | S12 → Report builder exports the filtered set to PDF, Excel and CSV. Every module screen also exports its own register. | D | `verified` |
| xii.7 ★ | Support graphical charts and analytics | ★ Charts, drill-down, analytics | S12 | S12 charts are drill-down surfaces — select a district bar, a loan status, a sample type or a disease slice and the records behind it are listed with links into the registries. | D | `verified` |

## Module xiii — NOTIFICATIONS & COMMUNICATION

| Ref | Requirement (Appendix A6) | Promised in the proposal | Screen(s) | Demo step | Wave | Status |
|---|---|---|---|---|---|---|
| xiii.1 | Notify users regarding application status updates | Configurable status notifications | S13 | S13 → Templates: each template belongs to an event and a channel and is editable, so the wording of a status update changes without a redeployment. S04, S05, S08 and S10 raise the events. | D | `verified` |
| xiii.2 | Notify users regarding laboratory results | Result-ready notifications | S13 | S13 → Messages issued, filtered to lab.results.ready; raised by the S06 "Notify applicant" action and visible on the recipient portal. | D | `verified` |
| xiii.3 | Support email notifications | Email channel | S13 | S13 email channel with full detail; the KPI tile filters the register to it. | D | `verified` |
| xiii.4 ★ | Support SMS notifications | ★ SMS channel (low-literacy/low-connectivity reach) | S13 | S13 SMS channel for low-connectivity reach, with a character count on the template editor; labelled simulated throughout. | D | `verified` |
| xiii.5 | Provide basic communication and feedback functionality | In-app messaging/feedback | S13 | S13 → Feedback & messages: farmers send questions, complaints and suggestions; officers respond in-thread. A farmer sees only their own thread. | D | `verified` |

## Module xiv — DATA DIGITIZATION & DOCUMENT MANAGEMENT

| Ref | Requirement (Appendix A6) | Promised in the proposal | Screen(s) | Demo step | Wave | Status |
|---|---|---|---|---|---|---|
| xiv.1 | Support migration of existing records | Profiling → cleansing → migration of farmer/farm/land/loan records | S13 | S13 → Migration validation: three batches with what was read, migrated and rejected from each source system. | D | `verified` |
| xiv.2 | Support upload and indexing of scanned documents | Bulk scan upload with indexing | S13 | S13 → "Index a scanned document" records the index entry — title, category, tags and extracted text — which is what makes a scan findable. | D | `verified` |
| xiv.3 ★ | Validate migrated data | ★ Automated validation + verification report | S13 | S13 → Migration validation lists each automated check with expected against actual and a pass, warning or failure. Failures are reported and the affected records named, not absorbed. | D | `verified` |
| xiv.4 | Provide searchable access to digitized records | Full-text searchable repository | S13 | S13 → Repository: search "fifteen metres" — a phrase that appears only inside the scanned text — and Marie-Ange's 2019 lease is the single result, with the term highlighted in the extract. | D | `verified` |
| xiv.5 | Support secure storage of digitized records | AES-256 at rest; RBAC; backup | S13 | S13 → Storage & access states what the delivered system does (AES-256 at rest, RBAC, audited retrieval, backup) beside what this prototype does instead, and says plainly that encryption and backup are not demonstrated here. | D | `verified` |
| xiv.6 ★ | Support document categorization and indexing | ★ Metadata tagging + categorization | S13 | S13 → Repository: category filter plus the index-tag cloud; both the categorisation and the metadata tags are set when a document is indexed. | D | `verified` |

---

## How to verify a row yourself

1. `npm run dev` and open the app with `?refs=1` — for example
   `http://localhost:5173/?refs=1#/clients`.
2. Every annotated control renders a small badge such as `iii.2`; hover it for the
   requirement text.
3. **Traceability coverage** (in the footer) lists all 91 rows and marks each one
   annotated as soon as a badge for it has rendered in the session.
4. Sign in with any account from the sign-in screen; all use the password
   `Demo2026!`.

## Honesty notes

- Every simulated integration is labelled `simulated` in the UI: SeyID, one-time
  passcodes, SMS and email delivery, device GPS, document and photo upload, and
  offline sync. Nothing contacts an external service; the only network requests
  the prototype makes are OpenStreetMap map tiles.
- All data is fictional. Every National Identification Number carries the
  obviously fake `999-` prefix and every telephone number matches
  `+248 2 000 0xx`. No real person is represented.
- Password storage, the audit hash chain and the duplicate-detection scoring are
  genuinely implemented, not mocked — see `src/lib/hash.ts`, `src/lib/store.ts`
  and `src/lib/duplicates.ts`.
