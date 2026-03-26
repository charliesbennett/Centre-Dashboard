# STORY-A3: Full QA — Real Centre Verification

**Epic:** Workstream A — AI Rota Fix & Stabilise
**Status:** Done
**Sprint:** 1
**Dependencies:** STORY-A1, STORY-A2 (both must be complete before QA)

---

## User Story

As a centre manager, I want the AI rota generator verified against a real centre's data, so I can trust it before the summer season.

---

## Background

All previous testing used QMU as a simple test case. Before the tool is operational it must be verified with a real, complex programme grid: multiple arrival groups, excursion days, testing days, correct session counts for all staff roles, and at least one Ministay centre.

This story is primarily a verification and bug-fixing story. It may produce small code fixes as a result of what is found — those fixes are in scope here.

---

## Acceptance Criteria

**AC1 — Generate completes without error on a full-programme centre**
Given a centre with a complete programme grid (multiple groups, excursion days, testing days),
When I run Generate,
Then generation completes successfully and a draft rota is returned with no error.

**AC2 — Session counts are within limits for all staff**
Given a published rota for a 14-day programme,
When I check each staff member's session count in the Rota tab,
Then:
- TAL and FTT staff have ≤22 sessions
- 5FTT staff have ≤20 sessions (Mon–Fri only, no weekends)
- LAL/SAI/EAL/EAC/LAC/AL/SAL/SC staff have ≤24 sessions
- Management staff (CM/CD/EAM/SWC) are not counted

**AC3 — Day off rules are correct**
Given a published rota for a 14-day programme,
When I check each staff member's day offs,
Then every day off is a complete day off (AM + PM + Eve all = "Day Off") — no partial day offs exist.

**AC4 — FTT day off placement is valid**
Given a published rota,
When I check FTT staff day offs,
Then all FTT day offs fall on full excursion days or arrival/departure days only.

**AC5 — 5FTT has no weekend entries**
Given a published rota with 5FTT staff,
When I check their rota,
Then Saturday and Sunday cells are empty (no entries).

**AC6 — Testing day is correct**
Given a programme with an English Test day,
When I check the rota for that day,
Then all FTT and TAL staff show "English Test" for AM and PM slots.

**AC7 — Ministay centre generates correctly**
Given a Ministay centre (7-day programme),
When I run Generate,
Then generation completes and the rota covers 7 days with 1 day off per staff member.

**AC8 — No subtitle says "OR-Tools"**
Given I open the AI Rota tab,
When I view the header and any subtitle text,
Then no text references "OR-Tools" anywhere on screen.

---

## Technical Notes

- Test against at least one full-programme summer centre (recommended: Dean Close or Queenswood — mixed ages, excursions, multiple groups)
- Test against at least one Ministay centre (recommended: Dean Close Ministay)
- Session count verification can be done by reading `rota_cells` for the programme and calculating per-staff totals
- If session cap bugs are found, fix `enforce_hard_limits()` in `solver.py` on Railway and re-deploy
- If day off bugs are found, fix the day off placement logic in `solver.py`
- Document any fixes made as part of this story's commit

---

## Tests

- Vitest: `countSessions(rotaCells, staffId, NO_COUNT)` — correct session count from rota_cells array
- Vitest: `countSessions` excludes NO_COUNT values (Day Off, Induction, Setup, Office, Airport)
- Vitest: `validateDayOffs(rotaCells, staffId, dates)` — detects partial day offs correctly
- Manual: Full generate + publish cycle on two real centres as per ACs above
