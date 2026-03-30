# STORY-B2: Dashboard Audit — Apply Approved Fixes

**Epic:** Workstream B — Dashboard Audit
**Status:** Review
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

---

## Dev Agent Record
- Implementation Date: 2026-03-30
- All tasks completed: yes
- All tests passing: yes

### Files Created:
- /Users/charlie/Centre-Dashboard/components/RoomingOverviewView.js
- /Users/charlie/Centre-Dashboard/components/RoomingHousesView.js

### Files Modified:
- /Users/charlie/Centre-Dashboard/lib/constants.js (CN-1: added link, purple, purpleBg, cyan, cyanBg to B object)
- /Users/charlie/Centre-Dashboard/components/tabs/TransfersTab.js (TR-1, TR-2: replaced hardcoded hex colours with B.* constants)
- /Users/charlie/Centre-Dashboard/components/tabs/TeamTab.js (TM-1, TM-2, TM-3: replaced hardcoded link/badge/accent colours)
- /Users/charlie/Centre-Dashboard/components/tabs/ExcursionsTab.js (EX-1, EX-2: replaced hardcoded colours, btnNavy for action buttons)
- /Users/charlie/Centre-Dashboard/components/tabs/RoomingTab.js (RM-1, RM-2: refactored to container using sub-components, removed inline CSS string)
- /Users/charlie/Centre-Dashboard/components/tabs/PettyCashTab.js (PC-1, PC-2, PC-3, PC-4: responsive grid, TableWrap, btnNavy buttons, empty states)
- /Users/charlie/Centre-Dashboard/components/tabs/ContactsTab.js (CT-1, CT-2, CT-3, CT-4: mobile grid, accessible delete, link colour, focus ring)

### Test Results:
- Total tests: 26
- Passing: 26
- Failing: 0

### Notes:
- The B object already contained success, successBg, warning, warningBg, danger, dangerBg — only link, purple, purpleBg, cyan, cyanBg were added.
- RM-2 addressed in two ways: (1) the print CSS string `.bed.away .name{color:#bbb;text-decoration:line-through}` was replaced with a `.name.away` class selector approach that avoids embedding conditional styles in a JS string; (2) the interactive nightly view in RoomingHousesView.js uses inline conditional styles for the away state.
- PC-4 empty states are implemented as table rows within the TableWrap tables added for PC-2.
- CT-4 focus ring uses onFocus/onBlur handlers since inline styles cannot express :focus-visible pseudo-selectors.
