# STORY-G3: Bulk Template Application to Groups

**Epic:** Workstream G — Programme Import
**Status:** Ready
**Sprint:** 4
**Dependencies:** STORY-G1 (groups must exist), STORY-G2 (templates must exist)

---

## User Story

As a head office user, I want to apply programme templates to all groups at once, with the system automatically matching each group to the right template based on their stay duration, so that the programme grid is populated for all standard groups in one click.

---

## Background

After STORY-G1 (groups imported) and STORY-G2 (templates saved), this story connects them. For each group, the system:
1. Auto-selects the best matching template based on duration in nights
2. Calculates which week(s) of the template apply (Week 1, Week 2, or both)
3. Maps template day-names (Monday, Tuesday…) to the group's actual dates using their arrival date
4. Writes the mapped content into the `progGrid` as `groupId-YYYY-MM-DD-AM/PM` cells

Groups with `programmeNotes` are flagged and excluded from auto-apply — they need manual review.

---

## Acceptance Criteria

**AC1 — "Apply Templates" button in Programmes tab**
Given I am a head office user with groups and templates both present,
When I view the Programmes tab toolbar,
Then an "Apply Templates" button is visible.

**AC2 — Auto-match preview**
Given I click "Apply Templates",
When the modal opens,
Then every group at this centre is listed with:
- Auto-suggested template (matched by closest duration in nights)
- Duration of the group's stay in nights
- Which weeks of the template will be applied (e.g. "Week 1 only", "Week 1 + Week 2")
- A dropdown to override the auto-suggested template
- A "Skip" option to exclude a specific group from the bulk apply

**AC3 — Groups with programme notes are flagged and excluded by default**
Given a group has non-empty `programmeNotes`,
When the modal opens,
Then that group row is shown with an amber "Custom notes — review needed" badge and is pre-set to "Skip".
I can manually override to apply a template anyway, but the default is Skip.

**AC4 — Template auto-match logic**
Given a group with a stay of N nights,
When the system selects a template,
Then it picks the template whose `durationNights` is the closest match to N.
If multiple templates tie (e.g. two 14N templates), the first one alphabetically is suggested and I can override.
If no template exists at all, the group shows "No template — skip" and cannot be applied.

**AC5 — Week selection logic**
Given a group is matched to a multi-week template,
When weeks are assigned:
- Group duration ≤ 7 nights → Week 1 only
- Group duration 8–14 nights → Week 1 + Week 2 (if template has Week 2)
- Group duration 15–21 nights → Week 1 + Week 2 + Week 3 (if template has 3 weeks)
- If the template has fewer weeks than needed, apply all available weeks and flag the shortfall

**AC6 — Date mapping**
Given a group arrives on a Wednesday,
When the template is applied:
- Wednesday column = arrival date
- Thursday column = arrival date + 1
- Friday column = arrival date + 2
- Saturday, Sunday, Monday, Tuesday = arrival + 3, 4, 5, 6
- If Week 2 is applied, the same day-name pattern repeats from arrival + 7

**AC7 — "Apply" writes to the programme grid**
Given I review the preview and click "Apply to X Groups",
When the apply runs,
Then `progGrid` cells are written for all non-skipped groups using the format `groupId-YYYY-MM-DD-AM` and `groupId-YYYY-MM-DD-PM`.
Only dates within the group's arrival–departure range are written.
Existing cells for a group are overwritten (the template is the source of truth for the initial import).

**AC8 — Result summary**
Given the apply completes,
When I see the result,
Then a summary reads: "Templates applied to X groups. Y groups skipped (custom notes). Z groups skipped (no template match)."

**AC9 — Arrival and departure day handling**
Given a group's arrival date,
When the template is applied:
- Arrival day cell AM = "ARRIVAL" (not the template content)
- Departure day cell AM = "DEPARTURE" (not the template content)
- All other in-range dates use template content

---

## Technical Notes

**New file:** `lib/applyProgrammeTemplate.js`

Core function:
```javascript
export function applyTemplateToGroup(group, template, weeksToApply) {
  // group: { id, arr, dep }
  // template: { weeks: [{ week, days: { Monday: { am, pm }, ... } }] }
  // weeksToApply: [1] or [1, 2] etc.
  // Returns: object of { "groupId-YYYY-MM-DD-AM": value, ... }
}
```

**Day-name → date mapping algorithm:**
```
arrDate = new Date(group.arr)
arrDayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][arrDate.getDay()]

For week 1:
  Start from arrDate
  Find arrDayName in template.weeks[0].days
  Walk forward from that position through the week (wrap Sun → Mon)
  Each day: dateOffset = days since arrDate

For week 2:
  Start from arrDate + 7
  Same day-name alignment (week 2 starts on the same day of week as arrival)
```

**New component:** `BulkTemplateApplyModal.js`

**Button placement:** ProgrammesTab toolbar, visible only to `head_office` role. Disabled (with tooltip "Add groups and templates first") if either groups or templates are empty.

**Write path:** call the existing `setProgGrid` callback (which debounces and saves to Supabase) with the merged grid object — same pattern as all other programme grid writes.

---

## Tests

- Vitest: `applyTemplateToGroup` — group arriving Monday maps Monday column to arr date, Tuesday to arr+1, etc.
- Vitest: `applyTemplateToGroup` — group arriving Thursday maps Thursday column to arr date, Friday to arr+1, wraps correctly through Sunday → Monday
- Vitest: `applyTemplateToGroup` — arrival date cell is set to "ARRIVAL" regardless of template content
- Vitest: `applyTemplateToGroup` — departure date cell is set to "DEPARTURE" regardless of template content
- Vitest: `applyTemplateToGroup` — dates outside arr/dep range produce no cells
- Vitest: week selection — 7-night group gets Week 1 only
- Vitest: week selection — 14-night group gets Week 1 + Week 2
- Vitest: template auto-match — 13-night group matches a 14N template (closest) over a 7N template
