# STORY-G4: Per-Group Bespoke Programme Excel Upload

**Epic:** Workstream G — Programme Import
**Status:** Ready
**Sprint:** 4
**Dependencies:** STORY-G1 (groups must exist)

---

## User Story

As a head office user, I want to upload a bespoke sample programme Excel directly against a specific group, so that groups with their own custom programmes (Turn, RDV, Telligo, Kew Learning, Barca Academy, etc.) get their programme filled correctly without manual cell-by-cell entry.

---

## Background

Approximately 25% of groups have their own separate sample programme Excel in the same format as the centre-level templates (week blocks, day name columns, AM/PM rows). These groups cannot use the standard centre template because their programme differs substantially — different excursion destinations, specialist activities, different weekly structure.

The existing `parseProgrammeExcel` lib already parses this exact Excel format. The gap is a UI to apply the parsed content directly to a specific group's progGrid cells (mapped to actual dates), rather than saving it as a reusable template.

---

## Acceptance Criteria

**AC1 — "Import Programme" button per group**
Given I am a head office user on the Programmes tab,
When I view a group row (or select a group),
Then an "Import Programme" button (or icon) is visible on that group row.
Given I am any other role,
Then the button is not visible.

**AC2 — Upload and parse**
Given I click "Import Programme" for a specific group,
When I upload a valid sample programme Excel,
Then the system parses it and shows a preview of the mapped programme grid:
- The group's name and dates are shown at the top
- The preview shows a simple table: date (actual, formatted as "Mon 7 Jul"), AM content, PM content
- Dates are calculated from the group's arrival date using the same day-name mapping as STORY-G3
- Arrival day row shows "ARRIVAL", departure day row shows "DEPARTURE"

**AC3 — Weeks applied based on group duration**
Given the uploaded Excel has 2 weeks and the group stays 7 nights,
When the preview is shown,
Then only Week 1 of the Excel is applied (same week selection logic as STORY-G3 AC5).
Given the group stays 14 nights,
Then both weeks are applied.

**AC4 — Confirm applies to progGrid**
Given I review the preview,
When I click "Apply to [Group Name]",
Then the programme grid cells are written for that group only, using `groupId-YYYY-MM-DD-AM` and `groupId-YYYY-MM-DD-PM` format.
Existing cells for this group are overwritten.

**AC5 — Arrival and departure day handling**
Given the group's arrival and departure dates,
When the Excel is applied:
- Arrival date AM and PM = "ARRIVAL"
- Departure date AM = "DEPARTURE"
- All other dates use the Excel content

**AC6 — Groups flagged as "custom notes" are highlighted**
Given a group has `programmeNotes` set (from STORY-G1 import),
When I view the Programmes tab group list,
Then that group row shows an amber "Custom notes" badge.
The "Import Programme" button remains available — the badge is a reminder, not a blocker.

**AC7 — Partial Excel is handled gracefully**
Given the uploaded Excel only covers some days (e.g. a 10-night programme in a 14N Excel layout),
When the preview is shown,
Then only the days present in the Excel are applied. Days not covered by the Excel remain blank in the progGrid.
A notice reads "X of Y programme days populated from this file."

**AC8 — Wrong file shows a clear error**
Given I upload a file that is not a recognisable sample programme Excel (wrong structure),
When the parse runs,
Then an error message reads "This file doesn't look like a UKLC sample programme. Please check the file and try again." No cells are written.

---

## Technical Notes

**Reuse:** `parseProgrammeExcel` (already exists) handles the Excel parsing. `applyTemplateToGroup` (from STORY-G3) handles the date mapping. This story is primarily a UI wrapper connecting those two pieces.

**New component:** `GroupProgrammeImportModal.js`
- Props: `group`, `onApply(cells)`, `onClose`
- Internally calls `parseProgrammeExcel` → formats as a template → calls `applyTemplateToGroup` → passes resulting cells to `onApply`

**Button placement in ProgrammesTab:**
- Add an import icon button (e.g. upload icon) to each group row in the group list panel
- Visible only when `userRole === 'head_office'`
- On click: sets `importTargetGroup` state, which opens `GroupProgrammeImportModal`

**Write path:** call `setProgGrid(prev => ({ ...prev, ...newCells }))` — same pattern as all other programme grid writes. This triggers the existing debounced save to Supabase.

**Error detection:** consider the Excel invalid if `parseProgrammeExcel` returns zero day-name columns or zero AM/PM content rows.

---

## Tests

- Vitest: `GroupProgrammeImportModal` apply output — given a parsed 2-week template and a group arriving on Wednesday, the Wednesday column maps to the group's arrival date
- Vitest: arrival date cell is set to "ARRIVAL" regardless of Excel content
- Vitest: departure date cell is set to "DEPARTURE" regardless of Excel content
- Vitest: 7-night group with a 2-week Excel only applies Week 1 (7 days)
- Vitest: invalid Excel (no day-name columns found) returns an error, no cells written
- Vitest: partial Excel (10 days in a 14N Excel) — only 10 days of cells are written, remaining 4 are not touched
