# STORY-D3: Arriving & Departing Today — Home Tab

**Status:** Draft
**Priority:** Medium
**Estimate:** 0.5 days

## User Story
As a centre manager
I want to see which groups are arriving and departing today directly on the home screen
So that I can prepare for transfers and handovers without navigating to another tab

## Acceptance Criteria
- [ ] Below the existing StatCards row on the Home tab, two collapsible panels appear: "Arriving Today" and "Departing Today"
- [ ] Each panel lists the group name and student count (`group.stu`) for groups matching today's date
- [ ] A group is arriving if `group.arr === today` (using `dayKey(new Date())` format `YYYY-MM-DD`)
- [ ] A group is departing if `group.dep === today`
- [ ] Each panel can be independently collapsed and expanded by clicking its header
- [ ] Both panels are expanded by default
- [ ] If no groups are arriving, the Arriving Today panel shows a calm empty state: "No arrivals today"
- [ ] If no groups are departing, the Departing Today panel shows a calm empty state: "No departures today"
- [ ] If both panels would show empty states (no arrivals and no departures), the panels are still rendered but show the empty state messages
- [ ] Archived groups (`group.archived === true`) are excluded from both panels
- [ ] No individual student names are shown — group-level data only

## Tasks
- [ ] Task 1: In `HomeTab.js`, confirm the existing `arrivingToday` and `departingToday` useMemo values (lines 89–93) are already computed — they are; no new data logic needed
- [ ] Task 2: Add a `CollapsiblePanel` local component or inline collapsible pattern in `HomeTab.js` — use `useState` for open/closed state, chevron icon to indicate state
- [ ] Task 3: Render "Arriving Today" collapsible panel below the stat row (after line 295's closing `</div>`) with group rows, empty state, and the arrival date badge
- [ ] Task 4: Render "Departing Today" collapsible panel immediately after the Arriving Today panel, same structure
- [ ] Task 5: Style panels to match the existing card aesthetic: `B.white` background, `B.border` border, `borderRadius: 10`, navy header bar using `B.navy` with white text (matching today's programme card at line 302)

## Dev Notes

### File Paths
- Modify: `components/tabs/HomeTab.js`

### Technical Requirements
- `arrivingToday` and `departingToday` are already computed in `HomeTab.js` at lines 89–93 — do not recompute
- `today` = `dayKey(new Date())` is already defined at line 69
- Both arrays contain group objects: `{ id, group, nat, stu, gl, arr, dep, ... }`
- Display per row: group name (`g.group`), student count (`g.stu`), group leader count (`g.gl`)
- Collapsible pattern: single `useState(true)` per panel for `isOpen`; toggle on header click; show a down/right chevron using a simple `▼` / `▶` character or SVG — keep it inline, no new icon component needed
- Panel insertion point: after the closing `</div>` of the stat row at line 295, before the opening `<div>` of the main 3-column grid at line 298
- Wrap both panels in a `<div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>` container
- Panel header: navy background (`B.navy`), white text, `borderRadius: "10px 10px 0 0"` when open, `borderRadius: 10` when closed, `cursor: "pointer"`, `padding: "8px 14px"`, `display: "flex"`, `justifyContent: "space-between"`, `alignItems: "center"`
- Panel body: white background, 1px solid `B.border` border (no top border), `borderRadius: "0 0 10px 10px"`, `padding: "6px 0"`
- Each group row: `padding: "6px 14px"`, `display: "flex"`, `gap: 8`, `alignItems: "center"` — show a colour dot (use `GROUP_COLORS` already defined at line 12), group name in bold, then a muted badge showing `{g.stu} students, {g.gl} GLs`
- `GROUP_COLORS` is defined in `HomeTab.js` at line 12 and already used in the programme cards
- Empty state: `<div style={{ padding: "20px 14px", textAlign: "center", color: B.textLight, fontSize: 10 }}>No arrivals today</div>` — matching the pattern at line 318

### No New Dependencies
No new imports needed. `useState` is already imported from React at line 2 (check: `import { useMemo } from "react"` — need to add `useState`).

### Import Update Required
Line 2 of `HomeTab.js` currently imports only `useMemo`:
```js
import { useMemo } from "react";
```
Update to:
```js
import { useState, useMemo } from "react";
```

## Testing Requirements
- No Vitest tests required (display-only, no logic beyond existing computed values)
- Manual verification:
  - Set a group's `arr` to today's date → it appears in Arriving Today panel
  - Set a group's `dep` to today's date → it appears in Departing Today panel
  - Collapse both panels → content hides, chevron rotates
  - Remove all arriving/departing groups → empty state messages appear
  - Archived groups do not appear (they are already filtered by `activeGroups` at line 71)
