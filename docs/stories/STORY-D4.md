# STORY-D4: Daily Briefing Sheet PDF Export

**Status:** Draft
**Priority:** Medium
**Estimate:** 1.5 days

## User Story
As a head office user or centre manager
I want to generate a printable daily briefing sheet for the current day
So that I can distribute a concise operational summary to the team at morning briefings without relying on dashboard access

## Acceptance Criteria
- [ ] A "Print Briefing" button appears on the Home tab, visible only to users with role `head_office` or `centre_manager`
- [ ] Clicking the button opens a new browser tab containing a clean, print-ready HTML page
- [ ] The page is automatically print-triggered via `window.print()` on load
- [ ] The briefing sheet contains: centre name and today's date (formatted as "Monday 30 March 2026"), on-site student count, arriving groups today (group name + student count), departing groups today (group name + student count), today's excursions (from `excursions` array — destination and coaches), today's rota by slot (AM, PM, Eve — list each staff member name and their assignment)
- [ ] If a section has no data (no arrivals, no excursions, etc.), a "None" placeholder is shown for that section
- [ ] The page is styled in black and white only (no colour) and is formatted to fit on a single A4 page
- [ ] The button is hidden for all roles except `head_office` and `centre_manager`
- [ ] Vitest test: the `assembleBriefingData` pure function returns the correct shape given sample inputs

## Tasks
- [ ] Task 1: Write pure function `assembleBriefingData({ centreName, today, groups, staff, excursions, rotaGrid, progStart, progEnd })` — returns `{ centreName, dateStr, onSiteCount, arriving, departing, excursionsToday, rotaBySlot }` — place in `components/tabs/HomeTab.js` and export for testing
- [ ] Task 2: Write `generateBriefingHtml(data)` function in `HomeTab.js` — takes the assembled data object and returns an HTML string (full document with `<!DOCTYPE html>`, `<head>` with print CSS, `<body>` with sections)
- [ ] Task 3: Write `openBriefingSheet(data)` in `HomeTab.js` — calls `generateBriefingHtml(data)`, opens a new tab with `window.open()`, writes the HTML to the new tab's document with `newWin.document.write(html)`, then calls `newWin.print()`
- [ ] Task 4: Add "Print Briefing" button to `HomeTab.js` — guard visibility with `userRole` prop — place in the hero banner area (after the quote block, before the stat row)
- [ ] Task 5: Pass `userRole`, `excursions`, and `staff` as props to `HomeTab` in `app/page.js` line 336 — `excursions` is `db.excursions`, `staff` is `db.staff` (already passed), `userRole` is `auth.userRole`
- [ ] Task 6: Write Vitest tests in `tests/HomeTab.test.js` for `assembleBriefingData`

## Dev Notes

### File Paths
- Modify: `components/tabs/HomeTab.js`
- Modify: `app/page.js` (line 336 — add `userRole` and `excursions` props to `<HomeTab>`)
- Create: `tests/HomeTab.test.js`

### Technical Requirements
- `excursions` array shape (from Supabase `excursions` table): `{ id, centre_id, exc_date, destination, coaches, notes }` — `coaches` is an array of strings; `exc_date` is `YYYY-MM-DD`
- Today's excursions: filter `excursions.filter(e => e.exc_date === today)`
- On-site count: sum of `group.stu` for groups where `inBed(today, g.arr, g.dep)` — `inBed` is already defined in `HomeTab.js` at line 7
- Arriving/departing: `groups.filter(g => !g.archived && g.arr === today)` / `g.dep === today`
- `rotaBySlot`: for each slot AM/PM/Eve, find all entries in `rotaGrid` where the key matches `*-{today}-{slot}` — extract staffId, look up staff name, build array of `{ staffName, assignment }` pairs
- Rota key parsing: key format is `{staffId}-{YYYY-MM-DD}-{slot}` — same split logic as `AiRotaTab.js` lines 36–47 (find `-AM`, `-PM`, or `-Eve` suffix, then match to a staff member by id prefix)
- `dateStr` formatting: `new Date(today).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })`
- Print CSS in HTML head: `@media print { body { margin: 0; } } @page { size: A4; margin: 15mm; }` — set `font-family: Arial, sans-serif; font-size: 11pt; color: #000`
- HTML structure: `<h1>` with centre name, `<h2>` date, then `<section>` blocks for each data group — use `<hr>` between sections, `<ul>` for lists
- Auto-print: `<script>window.onload = function(){ window.print(); }</script>` in the HTML body

### Updated HomeTab Props Signature
```js
export default function HomeTab({
  groups = [],
  staff = [],
  excDays = {},
  progGrid = {},
  rotaGrid = {},
  progStart,
  progEnd,
  excursions = [],  // NEW — array of { id, exc_date, destination, coaches, notes }
  userRole = "",    // NEW
})
```

### Updated page.js line 336
```jsx
case "home": return <HomeTab
  groups={db.groups}
  staff={db.staff}
  excDays={db.excDays}
  progGrid={db.progGrid}
  rotaGrid={db.rotaGrid}
  progStart={progStart}
  progEnd={progEnd}
  excursions={db.excursions}
  userRole={auth.userRole}
/>;
```

### Exported Pure Function Signature
```js
export function assembleBriefingData({ centreName, today, groups, staff, excursions, rotaGrid }) {
  // Returns: {
  //   centreName: string,
  //   dateStr: string,
  //   onSiteCount: number,
  //   arriving: Array<{ groupName, stu }>,
  //   departing: Array<{ groupName, stu }>,
  //   excursionsToday: Array<{ destination, coaches }>,
  //   rotaBySlot: { AM: Array<{ staffName, assignment }>, PM: [...], Eve: [...] }
  // }
}
```

## Testing Requirements
- Vitest tests in `tests/HomeTab.test.js`:
  - `assembleBriefingData` with 2 groups (1 arriving, 1 on-site) → correct `onSiteCount`, correct `arriving` array
  - `assembleBriefingData` with excursion on today → `excursionsToday` contains that excursion
  - `assembleBriefingData` with rota entries for today → `rotaBySlot.AM` contains correct staff+assignment pairs
  - `assembleBriefingData` with no data → all arrays empty, `onSiteCount: 0`
- Manual: open print dialog renders correctly, all sections populate, "None" appears for empty sections
