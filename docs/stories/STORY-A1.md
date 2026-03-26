# STORY-A1: Fix AiRotaTab UI — Stepper, Publish Button & Constraint Checklist

**Epic:** Workstream A — AI Rota Fix & Stabilise
**Status:** Done
**Sprint:** 1
**Dependencies:** None

---

## User Story

As a centre manager, I want the AI Rota tab to have a clean 3-step flow with a working Publish button, so I can generate and publish a rota without confusion.

---

## Background

The AiRotaTab currently has four steps (Programme → Shifts → Generate → Review). The Shifts step is a leftover from v1 (OR-Tools) and does nothing in v2. The Publish button's disabled condition checks for `assignments` (a v1 field never populated in v2), so it is always disabled. The constraint checklist still references HC-007 and HC-008 (overnight constraints, removed from v2).

All three issues are in `components/tabs/AiRotaTab.js`.

---

## Acceptance Criteria

**AC1 — Stepper is 3 steps**
Given I open the AI Rota tab,
When I view the stepper,
Then I see exactly 3 steps: Programme, Generate, Review — with no Shifts step.

**AC2 — No Shifts UI exists**
Given I open the AI Rota tab,
When I look at any step,
Then there is no shift template builder, shift input, or any reference to shifts visible on screen.

**AC3 — Publish button enabled correctly**
Given I am on the Review step with a draft rota loaded in state,
When I view the Publish button,
Then it is enabled (not greyed out / not disabled).

**AC4 — Publish button disabled when no draft**
Given I am on the Review step with no draft rota in state,
When I view the Publish button,
Then it is disabled.

**AC5 — Constraint checklist is accurate**
Given I am on the Generate step,
When I view the constraint checklist,
Then HC-007 and HC-008 do not appear, and the checklist reflects only constraints Claude actually enforces (session limits, day off rules, role rules).

**AC6 — AI Rota header uses brand style**
Given I open the AI Rota tab,
When I view the section header above the stepper,
Then it uses the navy card with dots-grid texture and yellow bottom border as specified in the front-end spec (section 9.2).

**AC7 — Stepper uses brand colours**
Given I view the stepper,
Then active step shows navy background with yellow number, completed step shows red background with white checkmark, inactive step shows grey/blue background.

---

## Technical Notes

- File to edit: `components/tabs/AiRotaTab.js`
- Remove all code related to the Shifts step (step index, step content, shift template state, any shift-related DB calls)
- Fix Publish button `disabled` condition: check `draftRota !== null` (where `draftRota` is the React state holding the generated rota) instead of checking `assignments`
- Update stepper step array from 4 items to 3
- Update constraint checklist array to remove HC-007, HC-008 entries
- Apply header and stepper styles per `docs/ui/frontend-spec.md` sections 9.1 and 9.2

---

## Tests

- Vitest: `AiRotaTab` stepper renders 3 steps (not 4)
- Vitest: Publish button is disabled when `draftRota` is null
- Vitest: Publish button is enabled when `draftRota` is a non-null object
- Vitest: Constraint checklist does not include "HC-007" or "HC-008"
