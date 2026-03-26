# STORY-A2: Fix Generate/Publish Flow — Dry Run Architecture

**Epic:** Workstream A — AI Rota Fix & Stabilise
**Status:** Ready
**Sprint:** 1
**Dependencies:** STORY-A1 (stepper must be 3 steps before flow logic is wired)

---

## User Story

As a centre manager, I want Generate to show me a preview of the rota without publishing it, so I can review it before it goes live.

---

## Background

Currently, clicking Generate writes the rota directly to `rota_cells` in Supabase. The Review step is reviewing data that is already live — this is confusing and dangerous. The fix introduces a `dry_run` flag: Generate calls the solver with `dry_run=true` (returns JSON, no DB write), the dashboard stores the draft in React state, and Publish calls the solver with `dry_run=false` (writes to DB).

This requires changes to the Railway solver (`solver.py`, `main.py`) and the dashboard API route (`app/api/generate-rota/route.js`) and tab (`AiRotaTab.js`).

---

## Acceptance Criteria

**AC1 — Generate does not write to the database**
Given I am on the Generate step and click "Generate Rota",
When generation completes successfully,
Then no rows are written to `rota_cells` in Supabase (verifiable by checking the table before and after).

**AC2 — Draft rota is displayed on Review step**
Given generation has completed successfully,
When I am on the Review step,
Then I can see the draft rota displayed as a staff × date grid.

**AC3 — "Draft — not yet published" badge is visible**
Given I am on the Review step,
When I view the rota,
Then a clearly visible badge reads "Draft Rota — not yet published" in yellow-on-navy style per the front-end spec.

**AC4 — Publish writes to the database**
Given I am on the Review step with a draft rota displayed,
When I click "Publish Rota",
Then rows are written to `rota_cells` in Supabase and the programme status is set to `active`.

**AC5 — Rota tab shows the published rota**
Given I have published a rota via the AI Rota tab,
When I navigate to the Rota tab,
Then the published rota is visible there.

**AC6 — Start Over clears the draft**
Given I am on the Review step with a draft rota displayed,
When I click "Start Over",
Then the draft is cleared, the stepper returns to the Programme step, and no data has been written to Supabase.

**AC7 — Generation error is shown clearly**
Given the solver returns an error during generation,
When generation fails,
Then an error message is displayed on the Generate step in plain English (not a raw API error), and the user can try again.

---

## Technical Notes

**Railway solver changes (`solver.py`, `main.py`):**
- Add `dry_run: bool = False` parameter to the `/generate` endpoint (query param or request body)
- If `dry_run=True`: run the full Claude generation and `enforce_hard_limits()`, but skip all `rota_cells` INSERT/UPSERT operations, and skip setting programme status to `active`
- If `dry_run=False`: write to `rota_cells` and update programme status as currently
- Return the rota JSON in both cases so the dashboard can display it

**Dashboard API route (`app/api/generate-rota/route.js`):**
- Accept `dry_run` boolean in the request body from the tab
- Pass it through to the Railway solver call
- Return the rota JSON from the solver response to the tab

**AiRotaTab.js:**
- Generate button: calls API with `dry_run: true`, stores result in `draftRota` state
- Review step: renders from `draftRota` state (not from a Supabase query)
- Publish button: calls API with `dry_run: false` and the stored `draftRota`
- Start Over button: sets `draftRota` to null, sets stepper back to step 0

**State shape:**
```javascript
const [draftRota, setDraftRota] = useState(null);
// draftRota shape: { rota: { "StaffName": { "YYYY-MM-DD": ["AM", "PM"] } } }
```

---

## Tests

- Vitest: `buildDraftRotaGrid(draftRota, staff, dates)` — returns correct grid structure from draft rota JSON
- Vitest: `buildDraftRotaGrid` returns empty grid when `draftRota` is null
- Manual: Run generate on QMU test centre, verify `rota_cells` table unchanged after generate, populated after publish
