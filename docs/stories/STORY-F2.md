# STORY-F2: Fortnight Rota View

**Status:** Draft
**Priority:** High
**Estimate:** 2 days

## User Story
As a centre manager
I want to view and generate the rota one fortnight at a time
So that I can focus on the relevant two-week period without being overwhelmed by the full programme grid, and generate AI rotas for individual fortnights without overwriting work already done for other fortnights

## Acceptance Criteria
- [ ] In `RotaTab.js`, a pill selector appears above the grid showing fortnight labels: "Week 1–2", "Week 3–4", "Week 5–6" etc., generating as many pills as needed to cover `progStart` to `progEnd`
- [ ] The Rota tab defaults to the fortnight that contains today; if today is outside the programme, it defaults to "Week 1–2"
- [ ] The Rota tab grid displays only the 14 days of the selected fortnight
- [ ] The Rota tab grid displays only staff who are on site during at least one day of the selected fortnight (`staff.arr <= fortnight end date AND staff.dep >= fortnight start date`)
- [ ] In `AiRotaTab.js`, the same pill selector appears on Step 1 (Programme step)
- [ ] The AI Rota tab defaults to the same fortnight-selection logic (today or Week 1–2)
- [ ] The selected fortnight determines the `progStart`/`progEnd` range passed to the AI generator (the API call body)
- [ ] Staff passed to the AI generator are filtered to those on site during the selected fortnight
- [ ] The fortnight label ("Week 1–2" etc.) is displayed on Step 3 (Review step) so the manager knows which fortnight they generated
- [ ] `getFortnights(progStart, progEnd)` returns `[{ label, start, end }]` for a 28-day programme → 2 objects; for a 42-day programme → 3 objects
- [ ] Vitest tests pass for `getFortnights`

## Tasks
- [ ] Task 1: Write pure function `getFortnights(progStart, progEnd)` in `lib/fortnights.js` — returns `Array<{ label: string, start: string, end: string }>` where `start` and `end` are `YYYY-MM-DD` strings, label is "Week N–M"
- [ ] Task 2: Write helper `getTodayFortnight(fortnights, today)` in `lib/fortnights.js` — returns index of the fortnight containing `today`, or `0` if none
- [ ] Task 3: Add fortnight state and pill selector to `RotaTab.js` — `useState` for selected fortnight index, `useMemo` to compute fortnights from `progStart`/`progEnd`, pill buttons above the grid
- [ ] Task 4: Filter `dates` in `RotaTab.js` to only the selected fortnight's 14 days — update the `dates` useMemo (currently `genDates(progStart, progEnd)`) to `genDates(selectedFortnight.start, selectedFortnight.end)`
- [ ] Task 5: Filter `staff` shown in `RotaTab.js` to those on site during the selected fortnight — add a `fortnightStaff` useMemo that filters by `staff.arr <= fortnight.end && staff.dep >= fortnight.start`
- [ ] Task 6: Add the same fortnight pill selector to `AiRotaTab.js` Step 1 (ProgrammeStep component, lines 109–138)
- [ ] Task 7: Update `handleGenerate` in `AiRotaTab.js` (line 263) — use `selectedFortnight.start`/`selectedFortnight.end` instead of `progStart`/`progEnd` in the fetch body, and filter `staff` to on-site staff for that fortnight
- [ ] Task 8: Pass the fortnight label to `ReviewStep` in `AiRotaTab.js` and display it in the review header alongside the "Draft Rota" badge
- [ ] Task 9: Write Vitest tests in `tests/fortnights.test.js`

## Dev Notes

### File Paths
- Create: `lib/fortnights.js`
- Modify: `components/tabs/RotaTab.js`
- Modify: `components/tabs/AiRotaTab.js`
- Create: `tests/fortnights.test.js`

### Technical Requirements

#### `getFortnights(progStart, progEnd)` — Algorithm
```js
// lib/fortnights.js
export function getFortnights(progStart, progEnd) {
  if (!progStart || !progEnd) return [];
  const start = new Date(progStart);
  const end = new Date(progEnd);
  const fortnights = [];
  let current = new Date(start);
  let weekNum = 1;
  while (current <= end) {
    const fnStart = new Date(current);
    const fnEnd = new Date(current);
    fnEnd.setDate(fnEnd.getDate() + 13); // 14 days inclusive
    if (fnEnd > end) fnEnd.setTime(end.getTime()); // clamp to progEnd
    fortnights.push({
      label: `Week ${weekNum}–${weekNum + 1}`,
      start: fnStart.toISOString().split("T")[0],
      end: fnEnd.toISOString().split("T")[0],
    });
    current.setDate(current.getDate() + 14);
    weekNum += 2;
  }
  return fortnights;
}

export function getTodayFortnight(fortnights, today) {
  const idx = fortnights.findIndex(fn => today >= fn.start && today <= fn.end);
  return idx >= 0 ? idx : 0;
}
```

#### RotaTab.js — Fortnight State and Date Filtering
Current `dates` useMemo (line ~?? — search for `genDates(progStart, progEnd)` in `RotaTab.js`):
```js
const dates = useMemo(() => genDates(progStart, progEnd), [progStart, progEnd]);
```
Replace with:
```js
const fortnights = useMemo(() => getFortnights(progStart, progEnd), [progStart, progEnd]);
const [fortIdx, setFortIdx] = useState(0);
// Initialise to today's fortnight after fortnights are computed
useEffect(() => {
  setFortIdx(getTodayFortnight(fortnights, dayKey(new Date())));
}, [fortnights]);
const selectedFortnight = fortnights[fortIdx] || { start: progStart, end: progEnd };
const dates = useMemo(
  () => genDates(selectedFortnight.start, selectedFortnight.end),
  [selectedFortnight]
);
```

#### RotaTab.js — Staff Filtering for Fortnight
Add a `fortnightStaff` useMemo:
```js
const fortnightStaff = useMemo(() => {
  if (!selectedFortnight) return staff;
  return staff.filter(s =>
    s.arr <= selectedFortnight.end && s.dep >= selectedFortnight.start
  );
}, [staff, selectedFortnight]);
```
Use `fortnightStaff` wherever `staff` is currently used in the grid render (table rows, ratio calculations). Keep using the full `staff` array for the StatCards (total staff count should reflect programme totals, not per-fortnight).

#### RotaTab.js — Pill Selector UI
Insert above the grid (after the top controls bar). Follow the same pill pattern used in `RotaTab.js` for the Ratios button (lines 613–615):
```jsx
{fortnights.length > 1 && (
  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "6px 16px", borderBottom: `1px solid ${B.border}`, background: B.white }}>
    {fortnights.map((fn, i) => (
      <button
        key={fn.label}
        onClick={() => setFortIdx(i)}
        style={{
          padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700,
          fontFamily: "inherit", cursor: "pointer",
          border: `1px solid ${i === fortIdx ? B.navy : B.border}`,
          background: i === fortIdx ? B.navy : B.white,
          color: i === fortIdx ? B.white : B.textMuted,
        }}
      >
        {fn.label}
      </button>
    ))}
  </div>
)}
```

#### AiRotaTab.js — ProgrammeStep Changes
`ProgrammeStep` (lines 109–138) currently receives `{ progStart, progEnd, groups, staff, onNext }`. Update to also receive `fortnights`, `fortIdx`, `setFortIdx`. Add the pill selector between the info box and the Continue button. Update the summary box to show the selected fortnight's start and end instead of the full `progStart`/`progEnd`.

#### AiRotaTab.js — handleGenerate Changes
The fetch body at line 271:
```js
body: JSON.stringify({ staff, progStart, progEnd, groups, progGrid, centreName }),
```
Update to:
```js
const fortnight = fortnights[fortIdx] || { start: progStart, end: progEnd };
const fortnightStaff = staff.filter(s =>
  s.arr <= fortnight.end && s.dep >= fortnight.start
);
body: JSON.stringify({
  staff: fortnightStaff,
  progStart: fortnight.start,
  progEnd: fortnight.end,
  groups,
  progGrid,
  centreName,
}),
```

#### AiRotaTab.js — ReviewStep Fortnight Label
Pass `fortnightLabel={fortnights[fortIdx]?.label}` to `ReviewStep`. In `ReviewStep`, display it next to the "Draft Rota" badge:
```jsx
{fortnightLabel && (
  <span style={{ background: B.ice, color: B.navy, fontFamily: RW, fontWeight: 700, fontSize: 11, padding: "5px 14px", borderRadius: 20 }}>
    {fortnightLabel}
  </span>
)}
```

#### AiRotaTab.js — State for Fortnights
Add at the top of the `AiRotaTab` component (line 255):
```js
const fortnights = useMemo(() => getFortnights(progStart, progEnd), [progStart, progEnd]);
const [fortIdx, setFortIdx] = useState(0);
useEffect(() => {
  setFortIdx(getTodayFortnight(fortnights, new Date().toISOString().split("T")[0]));
}, [fortnights]);
```
`useMemo` is not currently imported in `AiRotaTab.js` — add it to the React import. `useEffect` may also need to be added.

#### Imports Needed
- `RotaTab.js`: add `import { getFortnights, getTodayFortnight } from "@/lib/fortnights";`; add `useEffect` to React import if not present
- `AiRotaTab.js`: add `import { getFortnights, getTodayFortnight } from "@/lib/fortnights";`; add `useMemo, useEffect` to React import

#### String Date Comparison
Staff date filtering uses string comparison (`s.arr <= fortnight.end`). This works correctly because dates are stored as `YYYY-MM-DD` ISO strings throughout the codebase — lexicographic string ordering equals chronological ordering for this format.

### Test Inputs and Expected Outputs
```
getFortnights("2026-07-04", "2026-08-01") // 28 days
→ [
    { label: "Week 1–2", start: "2026-07-04", end: "2026-07-17" },
    { label: "Week 3–4", start: "2026-07-18", end: "2026-08-01" },
  ]

getFortnights("2026-07-04", "2026-08-15") // 42 days (with clamping on final fortnight)
→ [
    { label: "Week 1–2", start: "2026-07-04", end: "2026-07-17" },
    { label: "Week 3–4", start: "2026-07-18", end: "2026-07-31" },
    { label: "Week 5–6", start: "2026-08-01", end: "2026-08-14" },
  ]
  // Note: 2026-08-01 to 2026-08-14 is 14 days; progEnd is 2026-08-15 so final fortnight
  // starts 2026-08-01 + 0 offset and ends min(2026-08-14, 2026-08-15) = 2026-08-14
  // Adjust expected values to match your exact implementation.

getTodayFortnight(fortnights, "2026-07-20") // during week 3–4
→ 1 (index 1)

getTodayFortnight(fortnights, "2026-09-01") // after programme
→ 0 (default to first)
```

## Testing Requirements
- Vitest tests in `tests/fortnights.test.js`:
  - `getFortnights("2026-07-04", "2026-08-01")` → array of length 2, correct `label`/`start`/`end` values
  - `getFortnights("2026-07-04", "2026-08-15")` → array of length 3
  - `getFortnights(null, null)` → `[]`
  - `getFortnights("2026-07-04", "2026-07-17")` → array of length 1 ("Week 1–2" only)
  - `getTodayFortnight(fortnights, "2026-07-20")` → correct index
  - `getTodayFortnight(fortnights, "2025-01-01")` → `0` (outside programme)
- Manual verification:
  - With a programme spanning 4 weeks: 2 pills appear, "Week 1–2" and "Week 3–4"
  - Selecting "Week 3–4" → grid shows only those 14 dates and only staff on site then
  - AI Rota Step 1 shows the pill selector; generating produces a rota for just that fortnight
  - Review step shows the fortnight label badge
