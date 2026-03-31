# STORY-D1: Medical & Dietary Flag View

**Status:** Draft
**Priority:** High
**Estimate:** 1.5 days

## User Story
As a centre manager
I want to see a filtered view of students who have medical conditions or dietary requirements
So that I can quickly identify and act on welfare and catering needs without scanning every student record

## Acceptance Criteria
- [ ] The Students tab has a "Flags" view toggle alongside the existing view controls
- [ ] The Flags view displays only students who have a non-empty `medical` field OR a dietary value in their `accommodation` field
- [ ] Dietary values detected: "Vegetarian", "Vegan", "Halal", "Kosher", "Gluten Free" (case-insensitive substring match against `accommodation`)
- [ ] The table columns are: First Name, Surname, Group, Flag Type (Medical / Dietary / Both), and the relevant field content
- [ ] A filter control above the table lets the user narrow by flag type: All / Medical / Dietary / Both
- [ ] The view is visible to all roles but is read-only (no editing of student data from within it)
- [ ] Read-only roles (teacher, activity_leader, sports_activity_instructor, house_parent) see the same read-only table as all other roles — no edit controls appear for any role in this view
- [ ] If no students match the active filter, a calm empty state message is shown ("No flagged students")
- [ ] Vitest test: the `getFlaggedStudents` pure function correctly classifies students as Medical, Dietary, or Both

## Tasks
- [ ] Task 1: Write pure function `getFlaggedStudents(groups)` in `components/tabs/StudentsTab.js` — iterates all `group.students[]` arrays, detects medical and dietary flags, returns array of `{ firstName, surname, groupName, flagType, content }`
- [ ] Task 2: Add a "Flags" button to the existing view toggle row in `StudentsTab.js` (alongside any existing view controls) — sets a local state `view` to `"flags"`
- [ ] Task 3: Render the Flags table when `view === "flags"` — use existing `thStyle`/`tdStyle` from `components/ui.js`, wrap in `TableWrap`
- [ ] Task 4: Add flag-type filter pill row above the table (All / Medical / Dietary / Both) — filter from local `useState` in `StudentsTab.js`
- [ ] Task 5: Write Vitest tests in `tests/StudentsTab.test.js` covering: student with only medical, student with only dietary, student with both, student with neither, empty groups array

## Dev Notes

### File Paths
- Modify: `components/tabs/StudentsTab.js`
- Create: `tests/StudentsTab.test.js`

### Technical Requirements
- `group.students[]` is the array on each group object; groups come from the `groups` prop
- Each student: `{ id, firstName, surname, dob, age, sex, nationality, accommodation, arrDate, depDate, specialism1, medical, swimming, mobile }`
- Dietary detection: check if `student.accommodation` contains any of `["Vegetarian","Vegan","Halal","Kosher","Gluten Free"]` — use case-insensitive `includes()` or a regex
- Medical detection: `student.medical` is truthy (non-empty string after trim)
- Flag type logic:
  - medical truthy AND dietary match → `"Both"`
  - medical truthy only → `"Medical"`
  - dietary match only → `"Dietary"`
- `content` field in result: for Medical or Both → show `student.medical`; for Dietary → show `student.accommodation`; for Both → show both values joined with " | "
- Follow the existing view toggle pattern in `StudentsTab.js` — the file already uses a `useState` for controlling which sub-view is shown
- Use `TableWrap`, `thStyle`, `tdStyle` from `components/ui.js` (already imported at line 4 of `StudentsTab.js`)
- Button/pill styling: follow `btnPrimary` for the active state, use inline styles matching `B.border` / `B.white` for inactive — see existing toggle usage in `RotaTab.js` lines 612–615 for the pill pattern
- The Flags view must NOT render any edit inputs; the `readOnly` prop does not gate visibility here — all roles see the same read-only table

### Dietary Values (exact strings to detect, case-insensitive)
```
"Vegetarian", "Vegan", "Halal", "Kosher", "Gluten Free"
```

### Pure Function Signature (for test isolation)
```js
// Export for testing
export function getFlaggedStudents(groups) {
  // Returns: Array<{ firstName, surname, groupName, flagType, content }>
}
```

### Test File Pattern
Follow `tests/AiRotaTab.test.js` — import only the pure function (not the React component), use `describe`/`it`/`expect` from Vitest. Do NOT import from `@/components/tabs/StudentsTab.js` directly (it has `"use client"`); instead duplicate the pure function logic in the test file or export it separately.

## Testing Requirements
- Unit tests (Vitest) in `tests/StudentsTab.test.js`:
  - `getFlaggedStudents` with one group containing a student with `medical: "Peanut allergy"` → returns 1 result, flagType "Medical"
  - `getFlaggedStudents` with student having `accommodation: "Halal"` → returns 1 result, flagType "Dietary"
  - `getFlaggedStudents` with student having both → returns 1 result, flagType "Both"
  - `getFlaggedStudents` with student having neither → returns 0 results
  - `getFlaggedStudents([])` → returns `[]`
- Manual: verify the Flags view toggle appears, table renders, filter pills work, empty state shows when appropriate
