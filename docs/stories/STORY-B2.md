# STORY-B2: Dashboard Audit — Apply Approved Fixes

**Epic:** Workstream B — Dashboard Audit
**Status:** Ready
**Sprint:** 2
**Dependencies:** STORY-B1 (audit report complete and reviewed by Charlie)

---

## User Story

As a centre manager, I want all approved bugs, UX issues, and visual inconsistencies fixed across the dashboard, so it feels polished and reliable before the summer season.

---

## Background

Charlie has reviewed the Audit Report from STORY-B1 and marked which issues are approved for fixing. This story applies only those approved fixes — nothing else. No opportunistic refactoring, no unrequested improvements.

The scope of this story is therefore defined by the approved issues list in `docs/audit/audit-report.md`. Build agents must not fix unapproved issues or make changes beyond what is listed.

---

## Acceptance Criteria

**AC1 — All approved issues are fixed**
Given Charlie has approved a set of issues in the audit report,
When this story is complete,
Then every approved issue has been addressed and the fix is verifiable by re-checking the original issue description.

**AC2 — No unapproved changes are made**
Given the audit report contains issues marked as not approved,
When this story is complete,
Then those issues are untouched — no code changes outside the approved list.

**AC3 — Brand colour fixes are applied**
Given SESSION_TYPES and MEAL_COLORS are approved for fixing,
When this story is complete,
Then both constants use brand-compliant colour mappings per `docs/ui/frontend-spec.md` section 7, and all tabs that use these constants display correctly.

**AC4 — All 10 tabs render correctly after fixes**
Given fixes have been applied across multiple tabs,
When I navigate through all 10 tabs,
Then no tab shows a broken layout, missing data, or console error introduced by the fixes.

**AC5 — Mobile layout holds at 375px**
Given fixes have been applied,
When I view each fixed tab at 375px viewport width,
Then no overflow or layout breakage is introduced by the fixes.

**AC6 — npm test passes**
Given all fixes are applied,
When I run `npm test`,
Then all tests pass with no failures.

---

## Technical Notes

- Before starting: read `docs/audit/audit-report.md` and identify all issues marked as approved
- Work through approved issues one tab at a time
- After each tab: verify all ACs for that tab before moving to the next
- If a fix reveals a deeper issue not in the report, stop and flag to Charlie before proceeding — do not fix unilaterally
- Commit message: `fix: Workstream B approved audit fixes`

---

## Tests

- Vitest: run full test suite before and after — no regressions permitted
- Any new utility functions introduced by fixes must have Vitest unit tests
