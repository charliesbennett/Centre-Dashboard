# STORY-D2: Student List Export to Excel

**Status:** Draft
**Priority:** Medium
**Estimate:** 1 day

## User Story
As a centre manager, head office user, or course director
I want to export all students across all groups to a single Excel file
So that I can share a complete student roster with off-site teams and use it for welfare records

## Acceptance Criteria
- [ ] An "Export to Excel" button appears in the Students tab, visible only to users with role `centre_manager`, `head_office`, or `course_director`
- [ ] Clicking the button generates and downloads an `.xlsx` file named `students-[centreName]-[YYYY-MM-DD].xlsx`
- [ ] The file contains a single sheet with one row per student across all non-archived groups
- [ ] Columns in order: First Name, Surname, Group, Nationality, Age, Arrival Date, Departure Date, Medical, Room
- [ ] "Room" is looked up from `roomingAssignments` by finding an assignment whose `occupantName` matches the student's full name (`firstName + " " + surname`, trimmed, case-insensitive)
- [ ] If no room assignment is found for a student, the Room cell is blank
- [ ] Students are sorted by group name then surname
- [ ] The button is hidden (not just disabled) for read-only roles: teacher, activity_leader, sports_activity_instructor, house_parent
- [ ] Vitest test: the `buildStudentRows` pure function returns correctly shaped rows given sample groups and roomingAssignments data

## Tasks
- [ ] Task 1: Write pure function `buildStudentRows(groups, roomingAssignments)` in `components/tabs/StudentsTab.js` — returns array of row objects `{ firstName, surname, group, nationality, age, arrDate, depDate, medical, room }`
- [ ] Task 2: Write `exportStudentsXlsx(groups, roomingAssignments, centreName)` function in `StudentsTab.js` using the `xlsx` library (already imported at line 5 as `* as XLSX`) — calls `buildStudentRows`, builds the workbook, triggers download
- [ ] Task 3: Add the "Export to Excel" button to the Students tab controls bar — guard visibility with `!readOnly && ["centre_manager","head_office","course_director"].includes(userRole)` — requires passing `userRole` as a prop from `page.js`
- [ ] Task 4: Wire the new `userRole` prop through `app/page.js` — pass `auth.userRole` to `<StudentsTab>` (StudentsTab is rendered at line 337 of `page.js`)
- [ ] Task 5: Wire `roomingAssignments` prop through `app/page.js` — pass `db.roomingAssignments` to `<StudentsTab>` (already loaded in `useSupabase`, available as `db.roomingAssignments`)
- [ ] Task 6: Write Vitest tests in `tests/StudentsTab.test.js` — test `buildStudentRows` pure function

## Dev Notes

### File Paths
- Modify: `components/tabs/StudentsTab.js`
- Modify: `app/page.js` (line 337 — add `userRole` and `roomingAssignments` props to `<StudentsTab>`)
- Modify or Create: `tests/StudentsTab.test.js`

### Technical Requirements
- `xlsx` is already installed and imported in `StudentsTab.js` (`import * as XLSX from "xlsx"` at line 5)
- `roomingAssignments` shape (from Supabase `rooming_assignments` table): `{ id, centre_id, room_id, slot_index, occupantName, occupantType }` — match on `occupantName` field
- Room lookup: find the `roomingRooms` entry by `room_id`, return the room name. However, `StudentsTab.js` does not currently have access to `roomingRooms`. Simplest approach: pass `roomingAssignments` only and return the `occupantName` match to confirm existence; for the room name, you will also need to pass `roomingRooms` as a prop so you can look up `roomingRooms.find(r => r.id === assignment.room_id)?.name`. Add both props.
- Date formatting: use `fmtDate()` from `lib/constants.js` (already imported) for Arrival Date and Departure Date columns
- Excel download trigger: create a workbook with `XLSX.utils.book_new()`, add sheet with `XLSX.utils.json_to_sheet(rows)`, use `XLSX.writeFile(wb, filename)` — this pattern matches existing import usage in `StudentsTab.js`
- Filename format: `students-${centreName.replace(/[^a-z0-9]/gi, "-")}-${new Date().toISOString().split("T")[0]}.xlsx`
- Role check: `auth.userRole` is available in `page.js` as `auth.userRole` (the `useAuth` hook returns `userRole`, see line 61 of `page.js`: `const isReadOnly = READ_ONLY_ROLES.includes(auth.userRole)`)
- Non-archived groups: filter `groups.filter(g => !g.archived)` before iterating students
- Sort order: sort rows by `group` then `surname` (case-insensitive string comparison)

### Updated StudentsTab Props Signature
```js
export default function StudentsTab({
  groups = [],
  setGroups,
  progStart,
  progEnd,
  readOnly = false,
  userRole = "",           // NEW
  roomingAssignments = [], // NEW
  roomingRooms = [],       // NEW
})
```

### Updated page.js line 337
```jsx
case "students": return <StudentsTab
  groups={db.groups}
  setGroups={setGroups}
  progStart={progStart}
  progEnd={progEnd}
  readOnly={isReadOnly}
  userRole={auth.userRole}
  roomingAssignments={db.roomingAssignments}
  roomingRooms={db.roomingRooms}
/>;
```

### Pure Function Signature (for test isolation)
```js
// Export for testing
export function buildStudentRows(groups, roomingAssignments, roomingRooms) {
  // Returns: Array<{ firstName, surname, group, nationality, age, arrDate, depDate, medical, room }>
}
```

## Testing Requirements
- Vitest tests in `tests/StudentsTab.test.js`:
  - `buildStudentRows` with 2 groups, 3 students total → returns 3 rows in correct sort order
  - Student with matching `occupantName` in `roomingAssignments` → room column populated with room name
  - Student with no room assignment → room column is empty string
  - Archived groups → students from archived groups are excluded
  - Student with no medical → medical column is empty string
