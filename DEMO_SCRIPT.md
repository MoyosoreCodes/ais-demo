# DEMO_SCRIPT.md — Agriculture Information System (AIS)

**Phase 1: Foundation Systems — demonstration prototype**
Cutting-Edge Consultancy · for DICT on behalf of the Department of Agriculture,
Republic of Seychelles

> **Complete — all thirteen screens, all 91 Appendix A6 rows.** The Section 4
> narrative runs end to end, from Marie-Ange's self-registration to the search
> that finds her scanned 2019 lease.
>
> **Running time: 14–15 minutes.** For a 10-minute cut, drop Acts 7 and 9 and
> shorten Act 11 to the RBAC proof and the audit chain. Acts marked ★ are the
> ones evaluators reward — do not cut those.

---

## Before you start

```bash
npm install
npm run dev
```

Open **`http://localhost:5173/?refs=1`**.

- `?refs=1` switches on the requirement badges (e.g. `iii.2`) beside each control
  that evidences an Appendix A6 row. Hover a badge for the requirement text. The
  same toggle sits in the page footer.
- Click **Reset demo data** in the footer before every run. It restores the exact
  scripted state, so the walk-through is repeatable.
- Every account uses the password **`Demo2026!`**.
- The footer carries the **FICTIONAL DEMONSTRATION DATA** notice. Say this out
  loud once: every person, NIN (`999-` prefix) and phone number (`+248 2 000 0xx`)
  is invented, and every simulated integration is labelled `simulated` on screen.

**The one-line theme:** *one farmer identity, entered once, reused everywhere.*

---

## Act 1 — Marie-Ange signs in (S01) · ~90 seconds

**Evidences i.1 ★, i.4, i.6, i.8 ★**

1. **Land on the sign-in screen.** Point out the badges `i.1 ★` and `i.8 ★` beside
   the title, and the **PROTOTYPE — DEMONSTRATION BUILD** chip in the header.

2. **Show the lockout counter working.** Type `officer@demo` with a deliberately
   wrong password and sign in.
   > *"Passwords are verified against a stored salted PBKDF2-SHA256 hash — the
   > prototype never holds one in clear. Five failures locks the account for
   > fifteen minutes, and every attempt is written to the audit log."*

   The message reads **"4 attempts remaining before the account is locked."** The
   Account-security panel below mirrors the count.

3. **Show that the policy is configurable, not hard-coded.** Note the four
   statements in the panel — length and complexity, lockout, session timeout,
   audit — and say all four are edited by an administrator on S11, which you will
   show at the end.

4. **Sign in with SeyID.** Click **Sign in with SeyID** — note the `simulated`
   chip. Enter the NIN **`999-0412-1-1-07`** and click **Verify with SeyID**.
   > *"SeyID is simulated here — we resolve the NIN against our own seeded
   > records and nothing leaves the browser. In production this is a
   > server-to-server call to the national identity service."*

   The panel returns **Marie-Ange Hoareau**. Click **Continue — send passcode**.

5. **The one-time passcode step.** The dialog shows the generated code precisely
   *because* delivery is simulated. Type it in and verify.

---

## Act 2 — Her portal: entered once, reused everywhere (S01) · ~60 seconds

**Evidences i.4, ii.2; touchpoints of v.4, vi.6 ★, vi.8 ★, xiii.1–xiii.4, viii.4 ★**

6. You land on **My holding**. Walk the four KPI cards left to right:
   **1 registered holding · loan Under review · 1 laboratory result ready ·
   unread notifications**.

7. Scroll to **Rivière Doux Farm** — 1.6 ha, Anse Boileau, banana and 240 broiler,
   with its GPS pin on an OpenStreetMap map.

8. Scroll to the **loan application**: `LN-2026-0014`, SCR 85,000 over 48 months,
   and the two-stage tracker showing *Technical assessment approved* → *Loan
   committee decision awaiting decision*.

9. Scroll to **Laboratory results**: sample `LAB-2026-0031`, six soil parameters
   with reference ranges, two flagged, plus the interpretation and the
   recommendation. Underneath: *"You were notified on 20 Mar 2026 by SMS and
   email"* with the `simulated` chip.

10. In the right column, the **notification centre** and the **Newcastle-disease
    surveillance case** `SUR-2026-004`, already linked to a laboratory
    submission.

    > *"Every record on this page resolved from one Client ID. She entered her
    > details once, at registration."*

---

## Act 3 — The officer's registry and the duplicate merge (S02) · ~2 minutes

**Evidences i.5, ii.1, ii.3 ★, ii.4, ii.5 ★, ii.6, ii.7 ★**

11. **Switch user.** Click the account chip in the header → **J. Payet
    (Agriculture Officer)**.
    > *"Same application, different role. Watch the navigation change."*

12. You land on the **client registry** — 72 clients across seven districts.
    Demonstrate the search: type `Hoareau`, then `999-0412`, then `Anse Boileau`.
    Point out the **Linked records** column — *1 farm · 1 loan · 2 lab · 2 visits*
    — and the district / channel / status / SeyID facets.

13. **The duplicate banner.** At the top: *"1 possible duplicate registration
    awaiting review"* with badge `ii.7 ★`. It names the legacy record and the
    evidence: **NIN exact match**, **name identical**, **date of birth same**.
    > *"The migration flagged it. It did not merge it — a person decides."*

14. Click **Review** to open **Marie-Ange Hoareau (CLT-2026-0001)**.
    > *"The link opens the record the system recommends keeping — the verified,
    > self-registered one — so the merge runs in the safe direction."*

15. **Walk the tabs**: Farms 1 · Loans 1 · Laboratory 2 · Livestock &
    surveillance 3 · Land & leases · Inspections · Documents · Change history.
    On **Overview**, show the *Linked records across the system* panel with badge
    `ii.5 ★`.

16. **Merge the duplicate.** Back on Overview, click **Merge…** in the banner.
    The dialog puts the two records side by side — surviving vs to retire — and
    states exactly what will happen.
    Click **Merge into CLT-2026-0001**.

    The banner clears, **Farms goes 1 → 2**, and a toast confirms the reassignment.
    > *"The legacy record is retired, not deleted, so historical references keep
    > resolving. The merge is in her change history and in the audit log."*

17. **Show the change history.** Open the **Change history** tab — the merge sits
    on the timeline with the officer's name and timestamp (`ii.4`).

---

## Act 4 — Registering a farm on a phone (S03) · ~2 minutes

**Evidences iii.1–iii.7**

> Resize the browser to **390 px wide** (or use a phone) for this act — S03 is
> mobile-priority.

18. From the client profile go to **Farm registry → Register a farm**, or open
    `#/farms/new?client=CLT-2026-0001` directly.

19. **Intake channel** (`iii.1`): back-office or online submission — the same
    registration, with the channel recorded on the record.

20. **Farmer** (`iii.6`): Marie-Ange is already attached by Client ID, showing her
    NIN and the SeyID-verified chip.
    > *"No personal details are re-keyed. This is the link, not a copy."*

21. **Holding location** (`iii.2 ★`): drag the pin, tap the map, then press
    **Use my location** — note the `GPS simulated` chip and the accuracy readout.
    Existing holdings in the district are shown in grey for context.

22. **The duplicate check fires** (`iii.7 ★`). Type parcel reference
    **`PR/AB/1042`**. The panel escalates to a high-confidence match on
    *Rivière Doux Farm* with three reasons: **same parcel reference**, **pin N
    metres away (threshold 150 m)**, **same client record**. The candidate pin
    turns amber on the map.
    > *"Saving is blocked until the officer explicitly records an override, and
    > that override is written to the farm history and the audit log."*

23. **Holding details** (`iii.3 ★`): note the chip **"8 of 10 intake fields
    enabled"**.
    > *"This form is rendered from configuration, not from fixed markup. I will
    > switch a field on from the admin console in a moment and this form will
    > change — with no redeployment."*

24. **Supporting documents** (`iii.4`) — attach one; note the `upload simulated`
    chip and the *pending → verified* status.

25. **Farm identification** (`iii.5`): the next Farm ID, e.g. **`FRM-2026-00002`**,
    is shown before you save.

---

## Act 5 — Her loan reaches the committee (S05) · ~2 minutes

**Evidences v.1, v.2, v.3, v.4, v.5, v.6, v.7 ★**

26. **Start from the farmer's side.** Switch user to **Marie-Ange Hoareau**, and
    on her portal press **Apply for a loan**.
    > *"Her identity and her holding are already known. The form asks only about
    > the borrowing."*

    Show the purpose, amount and term, the indicative monthly repayment, the
    document uploader, and **What happens next** — the two stages with their
    acting roles and service standards, read from the workflow definition.
    You can submit a second application here, or cancel and follow the seeded one.

27. **Switch to J. Payet (Agriculture Officer)** and open **Loans**. Walk the
    mini-dashboard: applications, open value, approved value, outstanding
    balance and approval rate, then the **value-by-status** chart and the
    **submissions per month** trend. Click a KPI tile or a bar — the pipeline
    below filters to match (`v.7 ★`).

28. Open **LN-2026-0014** — Marie-Ange's SCR 85,000 poultry house.
    Show the **status tracker**: *Technical assessment approved* → *Loan
    committee decision awaiting*. Show the **document checklist** (`v.2`):
    Identity, Business plan and Financial, each present and verified.

29. **The key moment.** Scroll to the current stage.
    > *"I am signed in as an Agriculture Officer. This stage names the
    > Supervisor, so I have no approve button — and this is the message the
    > system gives me."*

    Read it aloud: *"This stage is awaiting a decision from a Supervisor… role-based
    access control is enforced per stage, not only per screen."*

30. **Switch to B. Adrienne (Supervisor)** and refresh. The controls appear.
    Press **Approve this stage**, add a committee note, and record the approval.

    The tracker completes, the status becomes **Approved**, and a toast confirms
    the applicant was notified. Open the **Audit trail** tab: the per-application
    timeline beside the hash-chained central audit entries (`v.5`).

31. **Reports** (`v.6`). Back on the pipeline, press **Export PDF**. The
    generated report carries the departmental letterhead, the filter summary and
    the **FICTIONAL DEMONSTRATION DATA** notice on every page. **Export Excel**
    produces the same data as a workbook.

---

## Act 6 — The laboratory closes the loop (S06) · ~2 minutes

**Evidences vi.1, vi.2, vi.3, vi.4, vi.5, vi.6 ★, vi.7, vi.8 ★**

32. **Switch to S. Dogley (Laboratory Staff)** and open **Sampling &
    laboratory**. Show the KPI row — in progress, in testing, results out of
    range, and **awaiting notification** — then the type tabs: **Soil, Water,
    Plant, Compost**, one register, one lifecycle (`vi.2`–`vi.4`).

33. Open **LAB-2026-0031**, Marie-Ange's completed soil test. Walk the
    **lifecycle**: requested → collected → registered → testing → completed,
    each step naming the role that performed it and carrying its date.
    Point at the header links to her client record and her holding (`vi.6 ★`).

34. **Enter a result live.** Open **LAB-2026-0044** — the diagnostic submission
    behind the Newcastle-disease case, still in **testing**. Press
    **Enter results** (`vi.5`).

    Type a leaf nitrogen of `1.9` — it flags **low** as you type. Set the
    **pathogen screen** to *Newcastle disease virus detected* — it flags too, and
    a banner names every parameter outside its range.
    Write the interpretation and recommendation, then **Validate and complete**.

35. **The report** (`vi.7`). Press **Laboratory report (PDF)**. Open it: the
    departmental certificate with letterhead, chain of custody, the results table
    with out-of-range rows tinted amber, the interpretation, the recommendation
    and the analyst signature block.

36. **Notify the applicant** (`vi.8 ★`). Press **Notify applicant**. The dialog
    previews each configured channel — SMS to her mobile, email to her address —
    and says plainly that nothing leaves the browser. Send.

    Switch to **Marie-Ange** and open her portal: the messages are there, and the
    result is on her holding. The loop is closed without her re-entering
    anything.

---

## Act 7 — Land: leases, reminders and enforcement (S04) · ~2 minutes

**Evidences iv.1–iv.8**

37. **Switch to J. Payet** and open **Land management**. Five KPI tiles: open
    applications, active leases, **expiring within 90 days**, **payments
    overdue**, and open enforcement.

38. **The reminder banner** (`iv.6 ★`). Press **Issue expiry reminders**. The
    dialog lists every affected lessee with the channels each will receive.
    Send — one audit entry records the batch, and each lessee's portal gains the
    message.

39. **An allocation application** (`iv.1`–`iv.4`). Open the **Allocation
    applications** tab and pick one under review. Show the **three-stage**
    workflow — eligibility screening, site assessment, allocation decision — and
    note it is the *same engine* as loans, with a different stored definition.

    Open **Assessments → Record an assessment**: soil suitability, slope, water
    access, access road, recommendation (`iv.3 ★`). On the Overview, the
    **parcel map** shows the requested parcel with neighbouring registered
    holdings in grey.

40. **The lease register** (`iv.5`). Open the **Lease register** tab, then
    Marie-Ange's **LSE-2019-0044** — terms, area, annual rent, payment position
    and days to expiry.

41. **Enforcement** (`iv.7`). Open a lease with overdue rent → **Enforcement**.
    Show the three-step ladder: **written warning → retraction notice → eviction
    notice**, each with its own grounds and served date.
    > *"Escalation is explicit. An eviction notice terminates the lease on the
    > register but keeps the record, so the enforcement history stays auditable."*

    Raise a written warning and show it recorded, served, and notified.

42. **History** (`iv.8`). Open the **History** tab on the lease — append-only,
    with actor and timestamp on every entry.

---

## Act 8 — The livestock visit and the disease case (S07, S08) · ~2 minutes

**Evidences vii.1 ★, vii.3, vii.4 ★, vii.5, viii.1, viii.2 ★, viii.3, viii.4 ★**

43. **Switch to J. Payet** and open **Livestock services**. The KPI row leads with
    complaint visits and what is still open or unassigned.

44. Open **LSV-2026-0018** — the routine broiler visit at Rivière Doux Farm.
    Walk the **complaint-handling ladder** (registered → assigned → visit made →
    resolved → closed), then the structured **observations, findings and action
    taken** (`vii.3`).
    > *"Two birds with mild respiratory signs. Remember that — it is where the
    > next act starts."*

    Scroll to **Service history at this holding** (`vii.5`) and the
    **Surveillance at this holding** panel linking straight to the case.

45. **Report a case as the farmer.** Switch to **Marie-Ange** and press
    **Report a sick animal** on her portal. Show that the form asks for *signs*,
    not a diagnosis — sudden mortality, respiratory distress, greenish diarrhoea
    — because passive surveillance depends on people reporting what they see
    (`viii.1`). Cancel, or submit a second case.

46. **Switch to J. Payet → Passive surveillance.** Open **SUR-2026-004**
    (Newcastle disease). Walk the **investigation lifecycle** and the case
    detail: 14 affected, 3 mortality, reported through the farmer portal.

47. **The linkage** (`viii.4 ★`). Show the **Laboratory submission** panel — the
    case resolves to `LAB-2026-0044` *and* to the holding. Press **Link
    laboratory submission** to show that only samples from this holding are
    offered, so a case cannot be attached to the wrong farm's result.
    > *"If you entered the plant-sample result in Act 6, the pathogen screen now
    > reads Newcastle disease virus detected. Press Confirm disease and the
    > holder is notified."*

48. Show the **Geographic spread** tab and the **By disease** breakdown
    (`viii.5`).

---

## Act 9 — Market day (S09) · ~60 seconds

**Evidences ix.1–ix.5**

49. Open **Vendors & market**. Note the KPI row: registered vendors, licences
    expiring within 60 days, stalls allocated, monthly fees, and how many
    vendors are **also on the client registry**.

50. Open **Victoria Market stalls** (`ix.3`). The floor is laid out by section
    and row — Produce Hall, Fish Market, Craft & value-added — colour-coded
    allocated, vacant, reserved and under maintenance.

51. Select **VM-A04**: Marie-Ange's stall, *Rivière Doux Produce*.
    > *"Same person, same Client ID. Her farm, her loan, her soil test and her
    > market stall are one record, not four."*

    Select a **vacant** stall to show the allocation list, then open her vendor
    profile for the licence position and the *Also on the client registry* panel.

---

## Act 10 — The offline inspection (S10) · ~2 minutes

**Evidences x.1–x.6 — the ★ moment of this wave**

> Resize to **390 px** for this act. S10 is mobile-priority.

52. **Switch to B. Adrienne (Supervisor)** → **Field operations**. Show the
    **Schedule** calendar (`x.1`), then **Schedule an inspection**: pick
    *Rivière Doux Farm*, and note the officer list shows **each officer's load on
    that date** before you assign (`x.2`). Assign it to **R. Confait** and save —
    the holder is notified.

53. **Switch to R. Confait (Field Officer)** and open the inspection. This is the
    screen a field officer actually uses, on a phone.

54. **Lose the signal.** Press **Go offline**. The bar turns amber:
    *"Captures are held on the device and sent when the signal returns."*
    > *"This is a switch rather than a detection, so I can show you the behaviour
    > on demand. Everything past this point is what happens in a valley with no
    > coverage."*

55. **Capture the inspection.** Type the observations and findings, set the
    outcome, then press **Take photograph** three times (`x.4`) — generated
    placeholders, labelled as such, because we will not ship photographs of real
    holdings.

56. Press **Save to device queue**. Note three things at once:
    - the toast says the capture is **held on the device**;
    - the header shows **pending sync (1)**;
    - the **navigation badge** shows 1 from anywhere in the application.

    Open the inspection register: the record still reads **Scheduled**. Nothing
    has reached the central register yet — which is the honest behaviour.

57. **Reconnect.** Press **Go online**, then **Sync 1 now**.
    The queue drains, the record becomes **Completed**, and the detail screen
    now carries **both** the capture time and the synchronisation time, plus the
    `captured offline` chip (`x.3 ★`).
    > *"One record, not two. The inspection was scheduled before the officer left
    > and completed by the same reference when the device came back."*

58. Show **Inspection history at this holding** (`x.5`) and **Export PDF**,
    which flags which inspections were captured offline (`x.6`).

---

## Act 11 — The workflow configurator (S11) · ~90 seconds ★

**Evidences xi.6 ★ — the strongest single claim in the demonstration**

59. **Switch to A. Vidot (Administrator)** → **Administration → Approval
    workflows**. Read the banner aloud:
    > *"These definitions are what the router actually executes."*

60. On the **Agricultural loan approval** workflow, press **Add a stage** and
    name it **Director's endorsement**. Note the panel warns how many
    applications are already in flight. Save.

    The live preview updates: *Technical assessment → Loan committee decision →
    Director's endorsement*, with the total service standard recalculated.

61. **Prove it changed the system, not a picture of it.** Switch to
    **Marie-Ange**, press **Apply for a loan**, and scroll to **What happens
    next** — three stages now, including the one you just invented. Submit it.

62. Open **Loans** and compare:
    - the application you just submitted routes through **three** stages;
    - **LN-2026-0014**, already in flight, still has its original **two**.

    > *"No code change, no redeployment, no downtime — and applications already
    > under way are not disturbed. That is what configurable approval hierarchies
    > has to mean to be worth anything."*

---

## Act 12 — The national picture (S12) · ~2 minutes

**Evidences xii.1–xii.7 ★**

63. **Switch to A. Vidot** → **Dashboard**. This is the landing screen for every
    staff role. Walk the KPI row: farmers, farms and hectares, approved loan
    value, livestock visits, laboratory samples, surveillance cases, inspections,
    leases, vendors (`xii.2`–`xii.4`).

64. **Show that it is role-based** (`xii.1`). Switch to **S. Dogley (Laboratory
    Staff)** — the loan and vendor panels are gone, because the dashboard is
    gated on the same permissions as the registries. Switch back.

65. **Drill down** (`xii.7 ★`). Select the **Anse Boileau** bar on *Farmers and
    farms by district*. A panel opens listing the nine farmers in that district —
    Marie-Ange at the top — each linking to their record. Try the loan-status
    chart and the disease pie as well.

66. **The report builder** (`xii.5`, `xii.6`). Open the **Report builder** tab.
    Ten datasets; pick **Clients**, filter **District: Anse Boileau**, and watch
    the preview and the record count narrow. Then press **Export PDF**,
    **Export Excel** and **Export CSV** in turn.
    > *"The same filtered set, in whichever format the recipient needs. Every
    > page carries the fictional-data notice."*

---

## Act 13 — Notifications and the paper trail (S13) · ~2 minutes

**Evidences xiii.1–xiii.5, xiv.1–xiv.6 ★**

67. **Notifications.** Open **Notifications**. Every message the system has
    issued, across SMS, email and in-app, with the KPI row splitting them by
    channel (`xiii.3`, `xiii.4 ★`). Open one to read it as the recipient did.

68. **Templates** (`xiii.1`). Open the **Templates** tab.
    > *"The wording is configuration, not code. Each template belongs to an event
    > and a channel, and the `{{tokens}}` are filled from the record that
    > triggered it."*

    Edit one and show the live preview with sample values.

69. **Feedback** (`xiii.5`). Open **Feedback & messages** — Marie-Ange's question
    about agricultural lime and the district office's reply, in thread.

70. **The digitized records** (`xiv.2`, `xiv.6 ★`). Open **Digitized records**.
    Show the category filter and the index-tag cloud.

71. **The closing beat** (`xiv.4`). In the search box type **`fifteen metres`**.
    > *"That phrase is not in any title or tag. It is in the body of a lease
    > signed on paper in 2019."*

    One result: **Lease Agreement — Parcel PR/AB/1042 — M. Hoareau (2019)**,
    with the phrase highlighted in the extracted text. Open it to show the scan,
    the metadata and the full extract.

72. **Migration validation** (`xiv.1`, `xiv.3 ★`). Open the **Migration
    validation** tab. Three batches, each with records read, migrated and
    rejected, and every automated check showing expected against actual.
    > *"One check failed and two raised warnings. We report that rather than
    > absorb it, and we name the records — three illegible register entries held
    > for manual re-keying, and one document flagged for re-scanning."*

73. **Storage & access** (`xiv.5`). Open the last tab.
    > *"This is what the delivered system does — AES-256 at rest, RBAC, audited
    > retrieval, nightly backup — beside what this prototype does instead. We say
    > plainly that encryption and backup are not demonstrated here, because a
    > browser-only prototype cannot demonstrate them."*

---

## Act 14 — Administration: roles, policy, audit (S11) · ~90 seconds

**Evidences i.2, i.3, i.6, i.7, xi.3, xi.4, xi.5**

26. Switch user to **A. Vidot (Administrator)**. The **Administration** item
    appears in the navigation — it was absent for both previous roles.

27. **User accounts** (`i.3`, `i.6`): create, modify, deactivate, release a lock,
    reset a password. Note the 2FA column and its `simulated` chips.
    > *"A reset generates a new random salt and a fresh derived key. No password
    > is ever stored or displayed in clear."*

28. **Roles & permissions** (`i.2`, `xi.3`): the six-role matrix.
    > *"This is not a picture of our intentions — the router reads this table."*

29. **Prove it** (`xi.5`). Switch to **Marie-Ange Hoareau (Farmer)** and type
    `#/clients` in the address bar. You get an **Access denied** page naming the
    role and the path, not a hidden menu item. Switch back to the administrator.

30. **Farm intake fields** (`iii.3 ★`): switch **Irrigation method** on. Return to
    S03 → the field is now in the form and the chip reads *9 of 10*.

31. **Security policy** (`i.1 ★`): change **Session timeout** to 1 minute, save,
    and point at the countdown chip that appears in the header. Change it back.

32. **Audit log** (`i.7`, `xi.4`). Open it and read the green banner:
    **"Audit chain verified — all N entries recomputed successfully."**
    > *"Each entry hashes its own contents together with the previous entry's
    > hash. Altering or removing a historical entry breaks every hash after it —
    > the log is append-only and tamper-evident, and this page recomputes the
    > whole chain in front of you."*

    Filter by actor **J. Payet** and action type **client** to surface the merge
    you performed in Act 3.

---

## Act 15 — Traceability (closing) · ~30 seconds

74. Click **Traceability coverage** in the footer. Show the 91 Appendix A6 rows,
    the per-module counters, and the rows annotated during this walk-through.
    > *"Every screen we built exists to demonstrate specific requirement rows.
    > This page is generated from the same registry that drives the badges, so it
    > cannot drift from the build."*

---

## Closing statement

> *"Ninety-one requirement rows, thirteen screens, one farmer identity. Every
> screen you have seen is annotated against the Appendix A6 row it evidences, and
> the coverage page is generated from the same registry that drives those badges —
> so it cannot drift from what we just showed you.*
>
> *Everything simulated is labelled simulated. Everything else — the salted
> password hashes, the tamper-evident audit chain, the enforced role matrix, the
> duplicate scoring, the configurable workflows — is really running."*

---

## Reset between runs

Footer → **Reset demo data** → confirm. Every record returns to the scripted
starting state: the duplicate is un-merged, the loan is back with the committee,
the laboratory result is un-entered, the workflow returns to two stages, the
offline queue is empty, and the audit log returns to its seeded 88 entries.
