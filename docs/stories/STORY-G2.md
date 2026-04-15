# STORY-G2: Named Programme Template Library per Centre

**Epic:** Workstream G — Programme Import
**Status:** Ready
**Sprint:** 4
**Dependencies:** None (parallel with STORY-G1)

---

## User Story

As a head office user, I want to upload each centre's sample programme Excels and save them as named templates (e.g. "Standard 14N", "7N WK1", "City Explorer 14N"), so that I can later apply the right template to each group without re-uploading the Excel each time.

---

## Background

The dashboard already has `ProgrammeTemplateModal` and `parseProgrammeExcel` which can parse the sample programme Excel format (week blocks with day name columns and AM/PM rows). Currently, only one template can be stored per centre (as `programme_template` in `programme_settings`).

This story extends storage to a named library: multiple templates per centre, each with a name and duration hint. The existing Excel parser is reused — no changes needed to `parseProgrammeExcel`.

---

## Acceptance Criteria

**AC1 — "Manage Templates" button in Programmes tab**
Given I am a head office user on the Programmes tab,
When I view the tab toolbar,
Then a "Manage Templates" button is visible.
Given I am any other role,
Then the button is not visible.

**AC2 — Template library modal shows existing templates**
Given I click "Manage Templates",
When the modal opens,
Then I see a list of all saved templates for the current centre, each showing: template name, duration (e.g. "14 nights"), number of weeks, and created date.
If no templates exist, an empty state reads "No templates yet — upload one to get started."

**AC3 — Add a new template from Excel**
Given I am in the template library modal,
When I click "Add Template" and upload a valid sample programme Excel,
Then the system parses it and shows a preview: programme name (from Excel header), dates from/to, number of weeks detected, and the day-by-day AM/PM content for each week.

**AC4 — Name and save a template**
Given the Excel preview is shown,
When I enter a template name (e.g. "Standard 14N") and click "Save Template",
Then the template is saved to this centre's template library and appears in the list.
The name field is required — saving is blocked if empty.

**AC5 — Duration is auto-detected and editable**
Given a programme Excel is parsed,
When the preview is shown,
Then the duration in nights is auto-detected from the Excel (e.g. "Length of Programme: 14 Nights" row) and pre-filled in an editable field.
I can correct it before saving if the auto-detected value is wrong.

**AC6 — Delete a template**
Given a template exists in the library,
When I click the delete icon and confirm,
Then the template is removed from the library.
A confirmation prompt reads "Delete [template name]? This cannot be undone."

**AC7 — Templates persist across sessions**
Given I save a template,
When I reload the page or switch centres and return,
Then the template is still in the library.

**AC8 — Up to 10 templates per centre**
Given a centre already has 10 saved templates,
When I try to add another,
Then the "Add Template" button is disabled and a message reads "Maximum 10 templates per centre."

---

## Technical Notes

**Storage:**
- Save templates as a JSON array in `programme_settings` with key `programme_templates` (plural, new key — does not replace existing `programme_template`)
- Each entry:
```javascript
{
  id: uid(),
  name: string,            // e.g. "Standard 14N"
  durationNights: number,  // e.g. 14
  createdAt: ISO string,
  weeks: [                 // one entry per week
    {
      week: 1,
      days: {
        Monday:    { am: string, pm: string },
        Tuesday:   { am: string, pm: string },
        Wednesday: { am: string, pm: string },
        Thursday:  { am: string, pm: string },
        Friday:    { am: string, pm: string },
        Saturday:  { am: string, pm: string },
        Sunday:    { am: string, pm: string },
      }
    }
  ]
}
```

**New component:** `ProgrammeTemplateLibraryModal.js`
- Replaces the existing `ProgrammeTemplateModal` trigger for this use case
- Reuses `parseProgrammeExcel` for parsing uploaded files
- The existing `ProgrammeTemplateModal` (per-group editor) remains unchanged

**Duration auto-detection:** scan parsed Excel rows for "Length of Programme: X Nights" pattern. Extract X as integer. Pre-fill the duration field with this value.

**"Manage Templates" button placement:** alongside the existing toolbar buttons in `ProgrammesTab.js`. Only visible when `userRole === 'head_office'`.

---

## Tests

- Vitest: template library correctly stores and retrieves multiple named templates from the `programme_templates` settings key
- Vitest: duration auto-detection extracts "14" from "Length of Programme: 14 Nights"
- Vitest: duration auto-detection extracts "7" from "Length of Programme: 7 Nights"
- Vitest: adding an 11th template is blocked (max 10 enforcement)
- Vitest: deleting a template by id removes only that template from the array
