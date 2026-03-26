# STORY-B1: Dashboard Audit — Discovery & Report

**Epic:** Workstream B — Dashboard Audit
**Status:** Ready
**Sprint:** 2
**Dependencies:** STORY-A1, STORY-A2, STORY-A3 (Workstream A complete)

---

## User Story

As a centre manager, I want a thorough audit of all 10 dashboard tabs, so I know exactly what bugs, UX issues, and visual inconsistencies exist before the summer season.

---

## Background

Before fixes can be applied, every tab needs to be reviewed systematically. This story produces the Audit Report — a documented list of every issue found, categorised by type and severity. No fixes are made in this story. Charlie reviews the report and approves which issues to fix, and those approved fixes are carried out in STORY-B2.

---

## Acceptance Criteria

**AC1 — All 10 tabs are audited**
Given the audit is complete,
When I read the Audit Report,
Then it contains a section for each of the 10 tabs: Students, Rota, Programmes, Catering, Transfers, Team, Excursions, Rooming, Petty Cash, Contacts.

**AC2 — Every issue is categorised**
Given an issue is listed in the report,
Then it includes:
- Tab name
- Issue description (in plain English — what the user experiences, not what the code does)
- Category: Bug | UX | UI
- Severity: High | Medium | Low
- Recommended fix (brief description)

**AC3 — Brand compliance issues are identified**
Given the audit is complete,
Then the report includes any instances of off-brand colours, non-standard buttons, missing TableWrap, missing Fld labels, or inconsistent table header/cell styles across all tabs.

**AC4 — Mobile issues are identified**
Given the audit checks each tab at 375px viewport width,
Then any layout breakage, overflow, or unusable element at 375px is listed in the report.

**AC5 — Empty and loading states are checked**
Given the audit reviews each tab's async behaviour,
Then any missing empty states or missing loading indicators are listed.

**AC6 — SESSION_TYPES and MEAL_COLORS are flagged**
Given the audit reviews constants used in tab rendering,
Then the report confirms that SESSION_TYPES and MEAL_COLORS use off-brand colours and recommends replacement per the front-end spec section 7.

**AC7 — Report is saved and ready for review**
Given the audit is complete,
Then the report is saved to `docs/audit/audit-report.md` and Charlie is asked to review and mark which issues are approved for fixing.

---

## Technical Notes

- Read each tab file in `components/tabs/` carefully
- Check against all 19 audit standards in `docs/ui/frontend-spec.md` section 10
- Also check `app/page.js` for any global layout or tab-switching issues
- Check `components/ui.js` for any components that could be improved
- Format the audit report with a clear table per tab: | # | Tab | Category | Severity | Description | Recommended Fix |
- Do not make any code changes in this story — discovery only

---

## Tests

No Vitest tests for this story — it is a discovery and documentation task.
The output is `docs/audit/audit-report.md`.
