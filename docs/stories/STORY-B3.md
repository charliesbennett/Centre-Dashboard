# STORY-B3: Fix Rooming Excel Import

**Epic:** Workstream B — Dashboard Audit & Fixes
**Status:** Ready
**Sprint:** 2
**Dependencies:** None (standalone fix)

---

## User Story

As a centre manager, I want to import my existing rooming list Excel file so that I don't have to manually recreate every house, room, and bed from scratch.

---

## Background

The current parser (`lib/parseRoomingExcel.js`) expects a rigid column layout:
- B: Floor label
- C: Building/House name
- D: Room number (integer)
- E: Occupant type (M/F/GL/UKLC)
- F: First name
- G: Last name

Charlie's actual Excel does not match this layout and is being rejected (either a silent "No room data found" error or a parse error). This story investigates the actual file format, updates the parser to handle it, and improves the error messages so future mismatches are diagnosable.

---

## Acceptance Criteria

**AC1 — Charlie's file is accepted**
Given Charlie uploads their actual rooming list Excel,
When the file is parsed,
Then it reaches the Preview stage showing houses, rooms, and bed counts correctly.

**AC2 — Clear error on unrecognised format**
Given a file is uploaded that cannot be parsed,
When the error is shown,
Then the message identifies specifically what was not found (e.g. "No building names found in column C — check your column layout") rather than a generic failure.

**AC3 — Column auto-detection (if layout differs)**
Given the actual file uses different columns than B/C/D/E/F/G,
When the parser runs,
Then it attempts to detect the correct columns by scanning for known header keywords (e.g. "house", "room", "floor", "type", "first name", "last name") before falling back to the hardcoded layout.

**AC4 — Room names preserved as-is**
Given the Excel uses room names like "101", "B12", or "Garden Room",
When imported,
Then the room name shown in the dashboard matches the Excel value exactly (not prefixed with "Room " unless the file uses that label).

**AC5 — Partial imports still succeed**
Given a file has some rows with missing type or name data,
When imported,
Then rows with a valid house and room are imported; rows missing both house and room are skipped; a count of skipped rows is shown in the preview.

---

## Technical Notes

- Parser: `lib/parseRoomingExcel.js`
- Modal: `components/RoomingImportModal.js` (error display)
- Charlie should share or describe the actual Excel column layout before implementation begins — the fix depends on what format the file actually uses.
- If the file uses a header row with labelled columns, switch from positional parsing to header-based parsing (`XLSX.utils.sheet_to_json` without `header: 1`).

---

## Definition of Done

- [ ] Charlie's actual file imports successfully to the Preview stage
- [ ] AC1–AC5 verified
- [ ] `npm test` passes
