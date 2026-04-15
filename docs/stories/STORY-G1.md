# STORY-G1: Bulk Group Import from Groups.xlsx

**Epic:** Workstream G — Programme Import
**Status:** Ready
**Sprint:** 4
**Dependencies:** None

---

## User Story

As a head office user, I want to upload the Groups.xlsx file and import all groups across all centres at once, so that every centre's group list is populated in the dashboard without manual data entry.

---

## Background

Groups are managed in a central Groups.xlsx file with columns: Code, Status, Coordinator, Group, Agent, Centre, Group Type, Total, Total:S, Total:GL, Arr Date, Dep Date, Arr Airport, Dep Airport, Notes, Programme Notes, Internal Notes.

The dashboard already has a `MasterImportModal` component and `parseMasterExcel` lib — but these parse a different Excel format (date-column programme grid). This story adds a new `GroupsBulkImportModal` and `parseGroupsExcel` parser that handles the Groups.xlsx structure.

Groups are imported into the existing groups data structure used by `useSupabase.js` — the same shape as groups already stored in Supabase per centre.

---

## Acceptance Criteria

**AC1 — Import button is visible to head office only**
Given I am logged in as a head office user and I am on the Programmes tab,
When I view the tab toolbar,
Then an "Import Groups" button is visible.
Given I am logged in as any other role,
Then the "Import Groups" button is not visible.

**AC2 — File upload and parse**
Given I click "Import Groups" and upload a valid Groups.xlsx file,
When the file is parsed,
Then a preview is shown listing all non-cancelled groups grouped by centre, with each row showing: group name, arrival date, departure date, student count, group leader count, and a "Has notes" badge if Programme Notes is non-empty.

**AC3 — Cancelled groups are excluded**
Given the uploaded file contains groups with Status "Cancelled",
When the preview is shown,
Then cancelled groups do not appear and a summary line reads "X cancelled groups excluded".

**AC4 — Status is shown per group**
Given the preview is showing,
When I look at each group row,
Then a "Confirmed" (green) or "Provisional" (amber) badge is shown next to each group name.

**AC5 — Centre name matching**
Given the Excel contains centre names (e.g. "Queen Mary's University London"),
When groups are previewed,
Then each group is shown under the correct centre heading as it appears in the dashboard.
If a centre name from the Excel cannot be matched to a known dashboard centre, that group is shown under an "Unmatched centres" warning section and is not imported until resolved.

**AC6 — Confirm import writes groups to Supabase**
Given I review the preview and click "Import X Groups",
When the import runs,
Then all non-cancelled groups are upserted to the Supabase groups table for their respective centre, keyed by the group Code field to prevent duplicates on re-import.

**AC7 — Programme Notes are preserved**
Given a group has non-empty Programme Notes in the Excel,
When that group is imported,
Then the Programme Notes text is saved against the group record and visible in the Programmes tab as a "Custom programme — review needed" indicator on that group row.

**AC8 — Re-import is safe**
Given groups have already been imported,
When I upload the same (or updated) Groups.xlsx again,
Then existing groups are updated (not duplicated), using the Code field as the unique key.

**AC9 — Import result summary**
Given the import completes,
When I see the result screen,
Then it shows: "X groups imported across Y centres. Z groups flagged for programme review."

---

## Technical Notes

**New files:**
- `lib/parseGroupsExcel.js` — parses Groups.xlsx format
- `components/GroupsBulkImportModal.js` — upload → preview → confirm UI

**Parsing:**
- Header row is row index 1 (row 0 is a merged label row)
- Dates are Excel serials — convert using the same `toDateStr()` approach as `parseMasterExcel.js`
- `Total:S` = student count (`stu`), `Total:GL` = group leader count (`gl`)
- Status values: "Confirmed", "Provisional", "Cancelled" — exclude Cancelled
- Centre name fuzzy match: normalise both sides (lowercase, strip punctuation, trim) before comparing. Flag any group where normalised match score < 0.6

**Group record shape (matches existing Supabase groups table):**
```javascript
{
  id: uid(),           // generated — or use existing if Code matches
  code: row.Code,      // unique key for upsert
  group: row.Group,
  arr: toDateStr(row['Arr Date']),
  dep: toDateStr(row['Dep Date']),
  stu: row['Total:S'],
  gl: row['Total:GL'],
  status: row.Status,  // "Confirmed" | "Provisional"
  programmeNotes: row['Programme Notes'] || '',
  agent: row.Agent,
}
```

**Supabase write:** upsert to groups table with `onConflict: 'code'` (requires unique index on groups.code — add migration if not present).

**Import Groups button:** visible only when `userRole === 'head_office'`. Place in ProgrammesTab toolbar alongside existing template and import buttons.

**Centre matching:** build a lookup map from the dashboard's known centre names. Normalise both sides before comparing. If no match ≥ 0.6, put the group in an "unmatched" bucket shown as a warning in the preview — do not import until the user resolves it (offer a dropdown to manually assign centre).

---

## Tests

- Vitest: `parseGroupsExcel` returns correct group count from a mock workbook (excludes cancelled)
- Vitest: `parseGroupsExcel` correctly converts Excel date serials to ISO date strings
- Vitest: centre name normaliser matches "Queen Mary's University London" to "Queen Mary's University London" and "Chetham's School, Manchester" to "Chetham's School, Manchester"
- Vitest: re-import of same Code does not create duplicate (upsert logic test)
- Vitest: group with non-empty Programme Notes sets `programmeNotes` field correctly
