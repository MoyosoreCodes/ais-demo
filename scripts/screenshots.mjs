/**
 * Annex TECH-8(6) screenshot capture (CLAUDE.md §9).
 *
 *   npm run dev            # in another terminal
 *   npm run screenshots
 *
 * Drives an installed Chrome over the DevTools Protocol using Node's built-in
 * WebSocket — no extra npm dependency, which the fixed stack in CLAUDE.md §2
 * would otherwise require asking about.
 *
 * Captures every Wave A screen in its story state (Marie-Ange Hoareau's records
 * on screen) with `?refs=1` requirement badges switched on, at 1920×1080, plus
 * the 390-px-wide mobile captures and the duplicate-warning states that §9
 * calls out specifically.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'screenshots')
const ORIGIN = process.env.AIS_ORIGIN ?? 'http://localhost:5173'
const PORT = 9222

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]

const DESKTOP = { width: 1920, height: 1080 }
const MOBILE = { width: 390, height: 844 }

/** Demo user ids, matching src/data/users.json. */
const USER = {
  admin: 'USR-001',
  officer: 'USR-002',
  field: 'USR-003',
  lab: 'USR-004',
  supervisor: 'USR-005',
  farmer: 'USR-006',
}

/**
 * Helpers injected into the page before each interaction script. React
 * controlled inputs ignore a plain `.value =`, so the native setter has to be
 * called and an input event dispatched.
 */
const PAGE_HELPERS = `
window.__ais = {
  set(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement
      : el instanceof HTMLSelectElement ? HTMLSelectElement
      : HTMLInputElement
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  },
  byText(selector, text) {
    return [...document.querySelectorAll(selector)].find((e) => e.textContent.includes(text))
  },
  click(selector, text) {
    const el = text ? window.__ais.byText(selector, text) : document.querySelector(selector)
    if (el) el.click()
    return Boolean(el)
  },
  label(text) {
    const l = [...document.querySelectorAll('label')].find((e) => e.textContent.includes(text))
    if (!l) return null
    return l.control ?? document.getElementById(l.htmlFor) ?? l.parentElement.querySelector('input,select,textarea')
  },
}
`

/* ------------------------------------------------------------------ *
 * The shot list
 * ------------------------------------------------------------------ */

const SHOTS = [
  {
    file: 'S01_signin.png',
    route: '/signin',
    user: null,
    viewport: DESKTOP,
    note: 'Sign-in with the account-security panel and the SeyID entry point.',
  },
  {
    file: 'S01_signin_seyid_simulated.png',
    route: '/signin',
    user: null,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('button', 'Sign in with SeyID');
      await new Promise(r => setTimeout(r, 300));
      const nin = document.querySelector('[role="dialog"] input');
      if (nin) window.__ais.set(nin, '999-0412-1-1-07');
      await new Promise(r => setTimeout(r, 200));
      window.__ais.click('[role="dialog"] button', 'Verify with SeyID');
      await new Promise(r => setTimeout(r, 1400));
    `,
    note: 'SeyID lookup returning a match — labelled simulated (i.8).',
  },
  {
    file: 'S01_register.png',
    route: '/register',
    user: null,
    viewport: DESKTOP,
    note: 'Public self-registration, SeyID and manual paths (i.4).',
  },
  {
    file: 'S01_farmer_portal.png',
    route: '/portal',
    user: USER.farmer,
    viewport: DESKTOP,
    note: "Marie-Ange's portal: holding, loan status, lab results, notifications.",
  },
  {
    file: 'S01_farmer_portal_lab_results.png',
    route: '/portal',
    user: USER.farmer,
    viewport: DESKTOP,
    scrollToText: 'Laboratory results',
    note: 'Soil result LAB-2026-0031 with reference ranges and the notification trail (vi.8).',
  },
  {
    file: 'S02_client_registry.png',
    route: '/clients',
    user: USER.officer,
    viewport: DESKTOP,
    note: 'Registry with the duplicate banner and cross-module link counts (ii.1, ii.5, ii.6, ii.7).',
  },
  {
    file: 'S02_client_profile.png',
    route: '/clients/CLT-2026-0001',
    user: USER.officer,
    viewport: DESKTOP,
    note: 'Client profile — linked records across every module (ii.2, ii.3, ii.5).',
  },
  {
    file: 'S02_duplicate_merge_modal.png',
    route: '/clients/CLT-2026-0001',
    user: USER.officer,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('button', 'Merge…');
      await new Promise(r => setTimeout(r, 400));
    `,
    note: '★ Duplicate merge dialog, side-by-side with the reassignment summary (ii.7).',
  },
  {
    file: 'S02_client_change_history.png',
    route: '/clients/CLT-2026-0001',
    user: USER.officer,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Change history');
      await new Promise(r => setTimeout(r, 300));
    `,
    note: 'Per-field change history with actor and timestamp (ii.4).',
  },
  {
    file: 'S03_farm_registry.png',
    route: '/farms',
    user: USER.officer,
    viewport: DESKTOP,
    note: 'Farm register with owner links, size and activity (iii.1, iii.6).',
  },
  {
    file: 'S03_farm_registry_map.png',
    route: '/farms',
    user: USER.officer,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Map');
      await new Promise(r => setTimeout(r, 2500));
    `,
    note: 'GIS view of every captured holding over OpenStreetMap (iii.2).',
  },
  {
    file: 'S03_farm_profile.png',
    route: '/farms/FRM-2026-00001',
    user: USER.officer,
    viewport: DESKTOP,
    note: 'Rivière Doux Farm — details, GPS and its two-way client link.',
  },
  {
    file: 'S03_farm_registration_mobile.png',
    route: '/farms/new?client=CLT-2026-0001',
    user: USER.officer,
    viewport: MOBILE,
    note: 'Mobile-priority intake at 390 px: channel, farmer link, map pin (iii.1–iii.3).',
  },
  {
    file: 'S03_duplicate_warning_mobile.png',
    route: '/farms/new?client=CLT-2026-0001',
    user: USER.officer,
    viewport: MOBILE,
    interact: `
      const parcel = window.__ais.label('Parcel reference');
      if (parcel) window.__ais.set(parcel, 'PR/AB/1042');
      await new Promise(r => setTimeout(r, 600));
      const el = window.__ais.byText('h2', 'may already be registered')
        || window.__ais.byText('h2', 'nearby registration');
      if (el) el.scrollIntoView({ block: 'center' });
      await new Promise(r => setTimeout(r, 800));
    `,
    note: '★ Duplicate warning blocking a save: parcel, GPS proximity and owner (iii.7).',
  },
  {
    file: 'S03_duplicate_warning_desktop.png',
    route: '/farms/new?client=CLT-2026-0001',
    user: USER.officer,
    viewport: DESKTOP,
    interact: `
      const parcel = window.__ais.label('Parcel reference');
      if (parcel) window.__ais.set(parcel, 'PR/AB/1042');
      await new Promise(r => setTimeout(r, 600));
      const el = window.__ais.byText('h2', 'may already be registered')
        || window.__ais.byText('h2', 'nearby registration');
      if (el) el.scrollIntoView({ block: 'center' });
      await new Promise(r => setTimeout(r, 1200));
    `,
    note: '★ The same duplicate check at desk width, with the candidate pin in amber (iii.7).',
  },
  /* ------------------------------- Wave B — S04 land management -------- */
  {
    file: 'S04_land_overview.png',
    route: '/land',
    user: USER.officer,
    viewport: DESKTOP,
    note: 'Land KPIs and the ★ lease-expiry / payment reminder banner (iv.1, iv.5, iv.6).',
  },
  {
    file: 'S04_lease_reminders.png',
    route: '/land',
    user: USER.officer,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('button', 'expiry reminder');
      await new Promise(r => setTimeout(r, 500));
    `,
    note: '★ Bulk lease-expiry reminders, previewing each lessee and channel (iv.6).',
  },
  {
    file: 'S04_lease_register.png',
    route: '/land',
    user: USER.officer,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Lease register');
      await new Promise(r => setTimeout(r, 400));
    `,
    note: 'Lease register with term, days to expiry and payment position (iv.5, iv.6).',
  },
  {
    file: 'S04_land_application.png',
    route: '/land/applications/LA-2025-101',
    user: USER.officer,
    viewport: DESKTOP,
    note: 'Three-stage allocation workflow and the GIS parcel view (iv.1, iv.2, iv.3).',
  },
  {
    file: 'S04_land_assessment.png',
    route: '/land/applications/LA-2025-101',
    user: USER.officer,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Assessments');
      await new Promise(r => setTimeout(r, 300));
      window.__ais.click('button', 'Record an assessment');
      await new Promise(r => setTimeout(r, 400));
    `,
    note: '★ Structured site-assessment capture (iv.3).',
  },
  {
    file: 'S04_lease_enforcement.png',
    route: '/land/leases/LSE-2019-0044',
    user: USER.supervisor,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Enforcement');
      await new Promise(r => setTimeout(r, 400));
    `,
    note: 'The retraction → eviction ladder, with each step and its grounds (iv.7).',
  },

  /* ------------------------------- Wave B — S05 loans ------------------ */
  {
    file: 'S05_loan_pipeline.png',
    route: '/loans',
    user: USER.officer,
    viewport: DESKTOP,
    note: '★ Loan monitoring dashboard: KPI tiles that filter, value-by-status and submissions-per-month charts (v.4, v.7).',
  },
  {
    file: 'S05_loan_application_form.png',
    route: '/loans/apply',
    user: USER.farmer,
    viewport: DESKTOP,
    note: 'Farmer-facing application; identity and holdings resolve from the client record (v.1, v.2).',
  },
  {
    file: 'S05_loan_detail_stage_denied.png',
    route: '/loans/LN-2026-0014',
    user: USER.officer,
    viewport: DESKTOP,
    note: '★ Per-stage RBAC: an Agriculture Officer gets no controls on a Supervisor stage, and is told why (v.3, xi.5).',
  },
  {
    file: 'S05_loan_detail_supervisor.png',
    route: '/loans/LN-2026-0014',
    user: USER.supervisor,
    viewport: DESKTOP,
    note: 'The same application as Supervisor — the committee decision controls appear (v.3, v.4).',
  },
  {
    file: 'S05_loan_decision_dialog.png',
    route: '/loans/LN-2026-0014',
    user: USER.supervisor,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('button', 'Approve this stage');
      await new Promise(r => setTimeout(r, 400));
    `,
    note: 'Recording a committee decision, attributed to the deciding role (v.3, v.5).',
  },
  {
    file: 'S05_loan_audit_trail.png',
    route: '/loans/LN-2026-0014',
    user: USER.supervisor,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Audit trail');
      await new Promise(r => setTimeout(r, 400));
    `,
    note: 'Per-application trail beside the hash-chained central audit entries (v.5).',
  },

  /* ------------------------------- Wave B — S06 laboratory ------------- */
  {
    file: 'S06_sample_registry.png',
    route: '/lab',
    user: USER.lab,
    viewport: DESKTOP,
    note: 'One register for soil, water, plant and compost, with lifecycle indicators (vi.2–vi.4).',
  },
  {
    file: 'S06_sample_detail.png',
    route: '/lab/LAB-2026-0031',
    user: USER.lab,
    viewport: DESKTOP,
    note: "Marie-Ange's completed soil test: custody lifecycle, results against reference ranges, client and holding links (vi.5, vi.6).",
  },
  {
    file: 'S06_result_entry.png',
    route: '/lab/LAB-2026-0044',
    user: USER.lab,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('button', 'Enter results');
      await new Promise(r => setTimeout(r, 400));
      const dlg = document.querySelector('[role="dialog"]');
      const nums = [...dlg.querySelectorAll('input[type=number]')];
      ['1.9','0.11','2.4'].forEach((v,i) => nums[i] && window.__ais.set(nums[i], v));
      await new Promise(r => setTimeout(r, 500));
    `,
    note: 'Structured result entry with live assessment against each reference range (vi.5).',
  },
  {
    file: 'S06_notify_applicant.png',
    route: '/lab/LAB-2026-0031',
    user: USER.lab,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('button', 'Notify');
      await new Promise(r => setTimeout(r, 500));
    `,
    note: '★ Result-ready notification preview across every configured channel (vi.8).',
  },
  {
    file: 'S06_sample_detail_mobile.png',
    route: '/lab/LAB-2026-0031',
    user: USER.lab,
    viewport: MOBILE,
    note: 'The laboratory record at 390 px, for a technician working away from a desk.',
  },

  /* ------------------------------- Wave C — S07 livestock -------------- */
  {
    file: 'S07_livestock_services.png',
    route: '/livestock',
    user: USER.officer,
    viewport: DESKTOP,
    note: 'Complaint and routine visits in one register, led by what is open and unassigned (vii.1, vii.2).',
  },
  {
    file: 'S07_visit_detail.png',
    route: '/livestock/LSV-2026-0018',
    user: USER.officer,
    viewport: DESKTOP,
    note: '★ Complaint-handling ladder, structured findings and the per-holding service history (vii.1, vii.3, vii.5).',
  },
  {
    file: 'S07_register_visit.png',
    route: '/livestock',
    user: USER.officer,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('button', 'Register a visit');
      await new Promise(r => setTimeout(r, 400));
    `,
    note: 'Registering a complaint visit against a holding with livestock on record (vii.1, vii.4).',
  },

  /* ------------------------------- Wave C — S08 surveillance ----------- */
  {
    file: 'S08_surveillance_register.png',
    route: '/surveillance',
    user: USER.officer,
    viewport: DESKTOP,
    note: 'Case register with open investigations, awaiting assignment and confirmed counts (viii.2, viii.3).',
  },
  {
    file: 'S08_case_detail.png',
    route: '/surveillance/SUR-2026-004',
    user: USER.officer,
    viewport: DESKTOP,
    note: "★ Newcastle-disease case linked to both the holding and laboratory submission LAB-2026-0044 (viii.2, viii.4).",
  },
  {
    file: 'S08_case_lab_link.png',
    route: '/surveillance/SUR-2026-004',
    user: USER.officer,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('button', 'laboratory link') || window.__ais.click('button', 'Link laboratory');
      await new Promise(r => setTimeout(r, 400));
    `,
    note: '★ Only samples from the same holding can be linked, so a case cannot attach to the wrong result (viii.4).',
  },
  {
    file: 'S08_case_report_form.png',
    route: '/surveillance/report',
    user: USER.farmer,
    viewport: DESKTOP,
    note: 'Farmer intake asking for signs rather than a diagnosis (viii.1).',
  },
  {
    file: 'S08_surveillance_map.png',
    route: '/surveillance',
    user: USER.officer,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Geographic spread');
      await new Promise(r => setTimeout(r, 2500));
    `,
    note: 'Geographic spread of cases over OpenStreetMap (viii.5).',
  },

  /* ------------------------------- Wave C — S09 vendors ---------------- */
  {
    file: 'S09_vendor_registry.png',
    route: '/vendors',
    user: USER.officer,
    viewport: DESKTOP,
    note: 'Vendor registry with licence expiry tracking and stall position (ix.1, ix.2, ix.4).',
  },
  {
    file: 'S09_stall_board.png',
    route: '/vendors',
    user: USER.officer,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Victoria Market');
      await new Promise(r => setTimeout(r, 500));
    `,
    note: '★ Victoria Market floor by section and row, colour-coded by stall status (ix.3).',
  },
  {
    file: 'S09_vendor_profile.png',
    route: '/vendors/VND-2026-009',
    user: USER.officer,
    viewport: DESKTOP,
    note: "Marie-Ange's vendor profile, showing she is the same record as client CLT-2026-0001 (ix.2, ii.5).",
  },

  /* ------------------------------- Wave C — S10 field operations ------- */
  {
    file: 'S10_field_operations.png',
    route: '/field-ops',
    user: USER.field,
    viewport: DESKTOP,
    note: 'Scheduling calendar, officer workload and the device connectivity bar (x.1, x.2).',
  },
  {
    file: 'S10_schedule_dialog.png',
    route: '/field-ops',
    user: USER.supervisor,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('button', 'Schedule an inspection');
      await new Promise(r => setTimeout(r, 400));
      const sel = document.querySelector('[role="dialog"] select');
      const opt = [...sel.options].find(o => o.textContent.includes('FRM-2026-00001'));
      if (opt) window.__ais.set(sel, opt.value);
      await new Promise(r => setTimeout(r, 500));
    `,
    note: 'Assignment showing each officer\\u2019s existing load on the chosen date (x.2).',
  },
  {
    file: 'S10_inspection_capture_mobile.png',
    route: '/field-ops/INS-2026-012',
    user: USER.field,
    viewport: MOBILE,
    note: 'The inspection record at 390 px — the screen a field officer actually uses (x.3, x.5).',
  },
  {
    file: 'S10_offline_queue_mobile.png',
    route: '/field-ops',
    user: USER.field,
    viewport: MOBILE,
    interact: `
      // Put the device offline and stage a queued capture so the annex shows the
      // pending-sync state CLAUDE.md section 9 calls out specifically.
      localStorage.setItem('ais-demo:device-online', '0');
      window.__ais.click('button', 'Go offline');
      await new Promise(r => setTimeout(r, 600));
    `,
    note: '★ Device offline: captures are held on the device and the pending-sync count is surfaced (x.3).',
  },
  {
    file: 'S10_offline_queue_desktop.png',
    route: '/field-ops',
    user: USER.field,
    viewport: DESKTOP,
    interact: `
      localStorage.setItem('ais-demo:device-online', '0');
      window.__ais.click('button', 'Go offline');
      await new Promise(r => setTimeout(r, 600));
    `,
    note: '★ The same offline state at desk width, with the connectivity bar and queue badge (x.3).',
  },

  /* ------------------------------- Wave D — S11 configurator ----------- */
  {
    file: 'S11_workflow_configurator.png',
    route: '/admin',
    user: USER.admin,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Approval workflows');
      await new Promise(r => setTimeout(r, 500));
    `,
    note: '\u2605 Admin-editable approval hierarchy with a live preview of how the next application routes (xi.6).',
  },

  /* ------------------------------- Wave D — S12 dashboard -------------- */
  {
    file: 'S12_dashboard.png',
    route: '/dashboard',
    user: USER.admin,
    viewport: DESKTOP,
    note: 'National KPIs across every module, gated on the same permissions as the registries (xii.1-xii.4).',
  },
  {
    file: 'S12_dashboard_lab_role.png',
    route: '/dashboard',
    user: USER.lab,
    viewport: DESKTOP,
    note: 'The same screen as Laboratory Staff — loan and vendor panels are absent, because the dashboard is role-based (xii.1).',
  },
  {
    file: 'S12_dashboard_drilldown.png',
    route: '/dashboard',
    user: USER.admin,
    viewport: DESKTOP,
    interact: `
      await new Promise(r => setTimeout(r, 1200));
      const bar = document.querySelector('.recharts-bar-rectangle');
      if (bar) bar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 600));
      const panel = window.__ais.byText('h2', 'Farmers in');
      if (panel) panel.scrollIntoView({ block: 'center' });
      await new Promise(r => setTimeout(r, 500));
    `,
    note: '\u2605 Chart drill-down: the records behind a segment, with links into the registries (xii.7).',
  },
  {
    file: 'S12_report_builder.png',
    route: '/dashboard',
    user: USER.admin,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Report builder');
      await new Promise(r => setTimeout(r, 500));
      const sels = [...document.querySelectorAll('main select')];
      const district = sels.find(s => [...s.options].some(o => o.value === 'Anse Boileau'));
      if (district) window.__ais.set(district, 'Anse Boileau');
      await new Promise(r => setTimeout(r, 500));
    `,
    note: 'Ad-hoc report builder: ten datasets, faceted filters, live preview, PDF/Excel/CSV export (xii.5, xii.6).',
  },

  /* ------------------------------- Wave D — S13 ------------------------ */
  {
    file: 'S13_notification_centre.png',
    route: '/notifications',
    user: USER.officer,
    viewport: DESKTOP,
    note: 'Every message issued across SMS, email and in-app, each labelled simulated or genuinely delivered (xiii.1-xiii.4).',
  },
  {
    file: 'S13_notification_templates.png',
    route: '/notifications',
    user: USER.officer,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Templates');
      await new Promise(r => setTimeout(r, 500));
    `,
    note: 'Message wording as configuration — templates per event and channel, previewed with sample values (xiii.1).',
  },
  {
    file: 'S13_feedback.png',
    route: '/notifications',
    user: USER.officer,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Feedback');
      await new Promise(r => setTimeout(r, 500));
    `,
    note: 'Two-way messaging between farmers and the department (xiii.5).',
  },
  {
    file: 'S13_document_search.png',
    route: '/documents',
    user: USER.admin,
    viewport: DESKTOP,
    interact: `
      const box = document.getElementById('doc-search');
      if (box) window.__ais.set(box, 'fifteen metres');
      await new Promise(r => setTimeout(r, 700));
    `,
    note: "\u2605 Full-text search over the scanned content finds Marie-Ange's 2019 paper lease from a phrase in its body (xiv.4).",
  },
  {
    file: 'S13_document_repository.png',
    route: '/documents',
    user: USER.admin,
    viewport: DESKTOP,
    note: 'Categorised, metadata-tagged repository of digitized records (xiv.2, xiv.6).',
  },
  {
    file: 'S13_migration_validation.png',
    route: '/documents',
    user: USER.admin,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Migration validation');
      await new Promise(r => setTimeout(r, 500));
    `,
    note: '\u2605 Automated migration checks with expected against actual, and failures named rather than absorbed (xiv.1, xiv.3).',
  },
  {
    file: 'S13_secure_storage.png',
    route: '/documents',
    user: USER.admin,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Storage & access');
      await new Promise(r => setTimeout(r, 400));
    `,
    note: 'What the delivered system does for secure storage, beside what this prototype does instead (xiv.5).',
  },

  {
    file: 'S11_admin_users.png',
    route: '/admin',
    user: USER.admin,
    viewport: DESKTOP,
    note: 'Account lifecycle: create, modify, deactivate, unlock, reset (i.3, i.6).',
  },
  {
    file: 'S11_admin_rbac_matrix.png',
    route: '/admin',
    user: USER.admin,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Roles & permissions');
      await new Promise(r => setTimeout(r, 400));
    `,
    note: 'The six-role permission matrix the router enforces (i.2, xi.3, xi.5).',
  },
  {
    file: 'S11_admin_security_policy.png',
    route: '/admin',
    user: USER.admin,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Security policy');
      await new Promise(r => setTimeout(r, 400));
    `,
    note: '★ Configurable password policy, lockout and session timeout (i.1).',
  },
  {
    file: 'S11_admin_intake_fields.png',
    route: '/admin',
    user: USER.admin,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Farm intake fields');
      await new Promise(r => setTimeout(r, 400));
    `,
    note: '★ Configurable farm intake fields — no redeployment (iii.3).',
  },
  {
    file: 'S11_admin_audit_log.png',
    route: '/admin',
    user: USER.admin,
    viewport: DESKTOP,
    interact: `
      window.__ais.click('[role="tab"]', 'Audit log');
      await new Promise(r => setTimeout(r, 500));
    `,
    note: 'Append-only audit log with its SHA-256 chain verified on view (i.7, xi.4).',
  },
  {
    file: 'S11_rbac_access_denied.png',
    route: '/clients',
    user: USER.farmer,
    viewport: DESKTOP,
    note: '★ RBAC genuinely enforced: a farmer session cannot open an officer route (xi.5).',
  },
  {
    file: 'TRACEABILITY_coverage.png',
    route: '/coverage',
    user: USER.admin,
    viewport: DESKTOP,
    note: 'Live coverage of the 91 Appendix A6 rows annotated by ?refs=1.',
  },
]

/**
 * Documents the app generates, captured as files so the annex can show the
 * actual output rather than a screenshot of a button.
 */
const EXPORT_ARTEFACTS = [
  {
    file: 'lab-report_LAB-2026-0031.pdf',
    route: '/lab/LAB-2026-0031',
    user: USER.lab,
    trigger: `window.__ais.click('button', 'Laboratory report'); await new Promise(r => setTimeout(r, 2500));`,
    note: 'Templated laboratory certificate for the story soil test (vi.7).',
  },
  {
    file: 'loan-monitoring-report.pdf',
    route: '/loans',
    user: USER.officer,
    trigger: `window.__ais.click('button', 'Export PDF'); await new Promise(r => setTimeout(r, 2500));`,
    note: 'Loan monitoring report across the full pipeline (v.6).',
  },
  {
    file: 'loan-monitoring-report.xlsx',
    route: '/loans',
    user: USER.officer,
    trigger: `window.__ais.click('button', 'Export Excel'); await new Promise(r => setTimeout(r, 2500));`,
    note: 'The same loan data as a workbook (v.6, xii.6).',
  },
  {
    file: 'livestock-service-report.pdf',
    route: '/livestock',
    user: USER.officer,
    trigger: `window.__ais.click('button', 'Export PDF'); await new Promise(r => setTimeout(r, 2500));`,
    note: 'Complaint and routine visits with findings (vii.6).',
  },
  {
    file: 'surveillance-report.pdf',
    route: '/surveillance',
    user: USER.officer,
    trigger: `window.__ais.click('button', 'Export PDF'); await new Promise(r => setTimeout(r, 2500));`,
    note: 'Suspected disease cases, assignment and laboratory linkage (viii.5).',
  },
  {
    file: 'vendor-market-report.pdf',
    route: '/vendors',
    user: USER.officer,
    trigger: `window.__ais.click('button', 'Export PDF'); await new Promise(r => setTimeout(r, 2500));`,
    note: 'Vendor licences, stall allocation and fee position (ix.5).',
  },
  {
    file: 'field-inspection-report.pdf',
    route: '/field-ops',
    user: USER.field,
    trigger: `window.__ais.click('button', 'Export PDF'); await new Promise(r => setTimeout(r, 2500));`,
    note: 'Inspections with outcomes, flagging which were captured offline (x.6).',
  },
  {
    file: 'clients-report-anse-boileau.pdf',
    route: '/dashboard',
    user: USER.admin,
    trigger: `
      window.__ais.click('[role="tab"]', 'Report builder');
      await new Promise(r => setTimeout(r, 600));
      const sels = [...document.querySelectorAll('main select')];
      const district = sels.find(s => [...s.options].some(o => o.value === 'Anse Boileau'));
      if (district) window.__ais.set(district, 'Anse Boileau');
      await new Promise(r => setTimeout(r, 500));
      window.__ais.click('button', 'Export PDF');
      await new Promise(r => setTimeout(r, 2500));
    `,
    note: 'Ad-hoc report from the builder: clients filtered to one district (xii.5, xii.6).',
  },
  {
    file: 'clients-report-anse-boileau.csv',
    route: '/dashboard',
    user: USER.admin,
    trigger: `
      window.__ais.click('[role="tab"]', 'Report builder');
      await new Promise(r => setTimeout(r, 600));
      const sels = [...document.querySelectorAll('main select')];
      const district = sels.find(s => [...s.options].some(o => o.value === 'Anse Boileau'));
      if (district) window.__ais.set(district, 'Anse Boileau');
      await new Promise(r => setTimeout(r, 500));
      window.__ais.click('button', 'Export CSV');
      await new Promise(r => setTimeout(r, 1500));
    `,
    note: 'The same filtered set as CSV (xii.6).',
  },
  {
    file: 'lease-register-report.pdf',
    route: '/land',
    user: USER.officer,
    trigger: `window.__ais.click('button', 'Export PDF'); await new Promise(r => setTimeout(r, 2500));`,
    note: 'Lease register with expiry and payment position (iv.6).',
  },
]

/* ------------------------------------------------------------------ *
 * Minimal CDP client
 * ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return await res.json()
    } catch {
      /* browser not up yet */
    }
    await sleep(250)
  }
  throw new Error(`Could not reach ${url}`)
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let nextId = 0
    const pending = new Map()
    const listeners = new Map()

    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id)
        pending.delete(msg.id)
        msg.error ? rej(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? '')})`)) : res(msg.result)
      } else if (msg.method && listeners.has(msg.method)) {
        for (const fn of listeners.get(msg.method)) fn(msg.params)
        listeners.delete(msg.method)
      }
    })
    ws.addEventListener('error', reject)
    ws.addEventListener('open', () =>
      resolve({
        send(method, params = {}) {
          const id = ++nextId
          return new Promise((res, rej) => {
            pending.set(id, { resolve: res, reject: rej })
            ws.send(JSON.stringify({ id, method, params }))
          })
        },
        once(method, timeoutMs = 15000) {
          return new Promise((res) => {
            const arr = listeners.get(method) ?? []
            arr.push(res)
            listeners.set(method, arr)
            setTimeout(res, timeoutMs)
          })
        },
        close: () => ws.close(),
      }),
    )
  })
}

/* ------------------------------------------------------------------ *
 * Capture
 * ------------------------------------------------------------------ */

async function main() {
  const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
  if (!chrome) {
    console.error('No Chrome/Chromium found. Install Google Chrome, or set one of:')
    for (const p of CHROME_CANDIDATES) console.error(`  ${p}`)
    process.exit(1)
  }

  // Confirm the dev server is up before launching anything.
  try {
    const res = await fetch(ORIGIN, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) throw new Error(String(res.status))
  } catch {
    console.error(`The app is not being served at ${ORIGIN}.`)
    console.error('Start it first:  npm run dev')
    process.exit(1)
  }

  mkdirSync(OUT, { recursive: true })

  const profile = join(HERE, '..', 'node_modules', '.cache', 'ais-screenshot-profile')
  mkdirSync(profile, { recursive: true })

  const proc = spawn(
    chrome,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--force-color-profile=srgb',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  let client
  try {
    const targets = await fetchJson(`http://127.0.0.1:${PORT}/json/list`)
    const page = targets.find((t) => t.type === 'page')
    if (!page) throw new Error('No page target exposed by Chrome')
    client = await connect(page.webSocketDebuggerUrl)

    await client.send('Page.enable')
    await client.send('Runtime.enable')

    // Boot the app once on the origin so localStorage is writable, then clear
    // any database the profile is holding. Captures must start from the seeded
    // state, or the annex would silently reflect whatever the last run left
    // behind rather than the scripted demonstration data.
    await client.send('Page.navigate', { url: `${ORIGIN}/?refs=1` })
    await client.once('Page.loadEventFired')
    await sleep(600)
    await client.send('Runtime.evaluate', {
      expression: `localStorage.removeItem('ais-demo:db:v1'); localStorage.setItem('ais-demo:device-online','1');`,
    })
    await client.send('Page.navigate', { url: 'about:blank' })
    await client.once('Page.loadEventFired', 5000)
    await client.send('Page.navigate', { url: `${ORIGIN}/?refs=1` })
    await client.once('Page.loadEventFired')
    await sleep(1200)

    const manifest = []

    for (const shot of SHOTS) {
      const { width, height } = shot.viewport

      await client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 700,
      })

      // Seed (or clear) the session before the app boots for this route.
      await client.send('Runtime.evaluate', {
        expression: `localStorage.setItem('ais-demo:device-online','1'); ` + (shot.user
          ? `localStorage.setItem('ais-demo:session:v1', JSON.stringify({userId:'${shot.user}',startedAt:Date.now(),lastActivityAt:Date.now()})); localStorage.setItem('ais-demo:refs-mode','1');`
          : `localStorage.removeItem('ais-demo:session:v1'); localStorage.setItem('ais-demo:refs-mode','1');`),
      })

      // about:blank in between guarantees a full document load, not a
      // same-document hash change.
      await client.send('Page.navigate', { url: 'about:blank' })
      await client.once('Page.loadEventFired', 5000)
      await client.send('Page.navigate', { url: `${ORIGIN}/?refs=1#${shot.route}` })
      await client.once('Page.loadEventFired')
      await sleep(shot.route === '/farms' || shot.route.startsWith('/farms/new') ? 2600 : 1300)

      await client.send('Runtime.evaluate', { expression: PAGE_HELPERS })

      if (shot.interact) {
        const { exceptionDetails } = await client.send('Runtime.evaluate', {
          expression: `(async () => { ${shot.interact} })()`,
          awaitPromise: true,
        })
        if (exceptionDetails) {
          console.warn(`  ! interaction failed for ${shot.file}: ${exceptionDetails.text}`)
        }
      }

      if (shot.scrollToText) {
        await client.send('Runtime.evaluate', {
          expression: `(async () => {
            const el = [...document.querySelectorAll('h1,h2,h3')].find(e => e.textContent.includes(${JSON.stringify(shot.scrollToText)}));
            if (el) el.scrollIntoView({ block: 'start' });
            await new Promise(r => setTimeout(r, 600));
          })()`,
          awaitPromise: true,
        })
      }

      const { data } = await client.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      })
      writeFileSync(join(OUT, shot.file), Buffer.from(data, 'base64'))
      manifest.push({ file: shot.file, size: `${width}×${height}`, note: shot.note })
      console.log(`  ✓ ${shot.file.padEnd(38)} ${width}×${height}`)
    }

    /* ---------------------------------------------------------------- *
     * Export artefacts — the generated PDF/Excel are evidence in their own
     * right for v.6, vi.7 and xii.6, so capture the produced files too.
     * ---------------------------------------------------------------- */
    const exportsDir = join(OUT, 'exports')
    mkdirSync(exportsDir, { recursive: true })

    for (const artefact of EXPORT_ARTEFACTS) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: DESKTOP.width, height: DESKTOP.height, deviceScaleFactor: 1, mobile: false,
      })
      await client.send('Runtime.evaluate', {
        expression: `localStorage.setItem('ais-demo:session:v1', JSON.stringify({userId:'${artefact.user}',startedAt:Date.now(),lastActivityAt:Date.now()}));`,
      })
      await client.send('Page.navigate', { url: 'about:blank' })
      await client.once('Page.loadEventFired', 5000)
      await client.send('Page.navigate', { url: `${ORIGIN}/#${artefact.route}` })
      await client.once('Page.loadEventFired')
      await sleep(1500)

      // jsPDF and SheetJS both hand the finished file to URL.createObjectURL;
      // intercepting it is how we get the bytes without a real download.
      await client.send('Runtime.evaluate', {
        expression: `
          window.__dl = null;
          (() => {
            const orig = URL.createObjectURL.bind(URL);
            URL.createObjectURL = (blob) => {
              const fr = new FileReader();
              fr.onload = () => { window.__dl = fr.result };
              fr.readAsDataURL(blob);
              return orig(blob);
            };
          })();
          ${PAGE_HELPERS}
        `,
      })
      await client.send('Runtime.evaluate', {
        expression: `(async () => { ${artefact.trigger} })()`,
        awaitPromise: true,
      })

      let dataUrl = null
      for (let i = 0; i < 60; i++) {
        const { result } = await client.send('Runtime.evaluate', {
          expression: 'window.__dl',
          returnByValue: true,
        })
        if (typeof result.value === 'string' && result.value.length > 0) {
          dataUrl = result.value
          break
        }
        await sleep(250)
      }

      if (!dataUrl) {
        console.warn(`  ! ${artefact.file} was not produced`)
        continue
      }
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
      const bytes = Buffer.from(base64, 'base64')
      writeFileSync(join(exportsDir, artefact.file), bytes)
      console.log(`  ✓ exports/${artefact.file.padEnd(28)} ${(bytes.length / 1024).toFixed(0)} kB`)
    }

    const md = [
      '# Annex TECH-8(6) — screenshot index',
      '',
      'Generated by `npm run screenshots`. Every capture is taken with `?refs=1`',
      "requirement badges switched on and with Marie-Ange Hoareau's seeded records",
      'on screen. ★ marks the captures CLAUDE.md §9 calls out specifically.',
      '',
      '| File | Size | What it shows |',
      '|---|---|---|',
      ...manifest.map((m) => `| \`${m.file}\` | ${m.size} | ${m.note} |`),
      '',
      '## Generated documents',
      '',
      'Produced by the application itself and captured here so the annex can show',
      'the real output. Every page carries the FICTIONAL DEMONSTRATION DATA notice.',
      '',
      '| File | What it is |',
      '|---|---|',
      ...EXPORT_ARTEFACTS.map((a) => `| \`exports/${a.file}\` | ${a.note} |`),
      '',
    ].join('\n')
    writeFileSync(join(OUT, 'INDEX.md'), md, 'utf8')

    console.log(`\n${manifest.length} captures written to screenshots/ (plus INDEX.md).`)
  } finally {
    client?.close()
    proc.kill()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
