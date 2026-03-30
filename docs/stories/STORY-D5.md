# STORY-D5: Staff Notice Board

**Status:** Draft
**Priority:** Medium
**Estimate:** 1.5 days

## User Story
As a head office user or centre manager
I want to post notices to all staff on the dashboard home screen
So that important operational messages reach every team member the next time they log in, without requiring a separate communication channel

## Acceptance Criteria
- [ ] A "Notice Board" section appears at the bottom of the Home tab, visible to all roles
- [ ] `head_office` and `centre_manager` roles can post new notices with: title (required), body text (required), and urgency level (Normal or Urgent)
- [ ] All roles can read posted notices
- [ ] `head_office` and `centre_manager` roles can delete any notice
- [ ] Urgent notices display with a red left border (4px solid `B.red`)
- [ ] Normal notices display with a grey left border (4px solid `B.border`)
- [ ] Notices are stored as a JSON array in `programme_settings` with key `notice_board` — each notice: `{ id, title, body, urgency, createdAt, createdBy }`
- [ ] Notices persist until manually deleted — they survive page refresh
- [ ] Notices are displayed in reverse-chronological order (newest first)
- [ ] The add-notice form is only visible to `head_office` and `centre_manager` roles
- [ ] Delete buttons on each notice are only visible to `head_office` and `centre_manager` roles
- [ ] Vitest test: `addNotice` and `deleteNotice` pure functions behave correctly

## Tasks
- [ ] Task 1: Write pure functions `addNotice(notices, { title, body, urgency, createdBy })` and `deleteNotice(notices, id)` in `components/tabs/HomeTab.js` — export both for testing
- [ ] Task 2: Add `notices` state to `HomeTab.js` — initialise from `settings.notice_board` prop (parse JSON, default to `[]`)
- [ ] Task 3: Add the Notice Board section UI to `HomeTab.js` at the bottom of the return — notice list + add form for authorised roles
- [ ] Task 4: Wire `saveSetting` and `settings` props into `HomeTab.js` — save updated notices array on every add/delete using `saveSetting("notice_board", JSON.stringify(updatedNotices))`
- [ ] Task 5: Update `page.js` line 336 to pass `settings={db.settings}` and `saveSetting={db.saveSetting}` and `userRole={auth.userRole}` to `<HomeTab>` (if not already added by STORY-D4)
- [ ] Task 6: Write Vitest tests in `tests/HomeTab.test.js` for `addNotice` and `deleteNotice`

## Dev Notes

### File Paths
- Modify: `components/tabs/HomeTab.js`
- Modify: `app/page.js` (line 336 — add `settings`, `saveSetting`, `userRole` if not already added by STORY-D4)
- Modify or Create: `tests/HomeTab.test.js`

### Technical Requirements
- Notice object shape: `{ id: uid(), title: string, body: string, urgency: "Normal" | "Urgent", createdAt: ISO string, createdBy: string }`
- `uid()` is exported from `lib/constants.js` and already imported in `HomeTab.js` — if not currently imported, add to the import at line 3
- `saveSetting(key, value)` signature: already used throughout `page.js` (e.g., line 189, 205) — it upserts into `programme_settings` table with `centre_id`, `setting_key`, `setting_value`
- Load notices: `useEffect(() => { try { setNotices(JSON.parse(settings?.notice_board || "[]")); } catch { setNotices([]); } }, [settings?.notice_board])`
- Urgency selector: two buttons (Normal / Urgent) using the pill toggle pattern from `RotaTab.js` lines 612–615 — active state uses `B.navy` background; for Urgent use `B.red` background when active
- Notice card UI: `background: B.white`, `border: "1px solid " + B.border`, `borderLeft: "4px solid " + (n.urgency === "Urgent" ? B.red : B.border)`, `borderRadius: 8`, `padding: "10px 14px"`, `marginBottom: 6`
- Delete button: use `IconBtn` from `components/ui.js` with `IcTrash` icon — already used elsewhere in the codebase
- Form: title `<input>` using `inputStyle` from `components/ui.js`, body `<textarea>` with similar styling (`inputStyle` extended with `minHeight: 60, resize: "vertical"`), Submit button using `btnPrimary` from `components/ui.js`
- Section header: navy background, white text, matching the "Today's Programme" card header at line 302
- `createdBy` field: use `userRole` prop (e.g., `"centre_manager"`) — the display name can use the `ROLE_LABELS` mapping from `page.js` (replicate the object locally in `HomeTab.js` or accept a `createdByLabel` prop)
- Authorised roles for posting/deleting: `["head_office", "centre_manager"]`

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
  excursions = [],    // Added by STORY-D4
  userRole = "",      // Added by STORY-D4
  settings = {},      // NEW — full settings object from db.settings
  saveSetting,        // NEW — (key, value) => Promise<void>
})
```

### Updated page.js line 336 (cumulative with STORY-D4)
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
  settings={db.settings}
  saveSetting={db.saveSetting}
/>;
```

### Pure Function Signatures (for test isolation)
```js
export function addNotice(notices, { title, body, urgency, createdBy }) {
  // Returns new array with notice prepended (newest first)
  // Notice id generated with uid(), createdAt = new Date().toISOString()
}

export function deleteNotice(notices, id) {
  // Returns new array with the notice removed
}
```

## Testing Requirements
- Vitest tests in `tests/HomeTab.test.js`:
  - `addNotice([], { title: "Test", body: "Body", urgency: "Normal", createdBy: "centre_manager" })` → returns array of length 1 with correct shape
  - `addNotice` called twice → returns array of length 2, newest first (sorted by `createdAt` descending)
  - `deleteNotice(notices, id)` where id exists → returns array without that notice
  - `deleteNotice(notices, "nonexistent-id")` → returns unchanged array
  - `deleteNotice([], anyId)` → returns `[]`
- Manual: post a notice, refresh page → notice persists; delete notice → it disappears; urgent notice has red border; non-CM roles cannot see the form or delete buttons
