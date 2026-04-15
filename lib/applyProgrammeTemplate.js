// Pure functions for applying a parsed programme template to a group's actual dates.
// Used by BulkTemplateApplyModal (G3) and GroupProgrammeImportModal (G4).

const ALL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAY_OF_WEEK = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// Select which 0-indexed week indices to apply based on group duration and template size.
// e.g. 7N group → [0]; 14N group → [0, 1]; 13N group → [0, 1]
export function selectWeeks(durationNights, numTemplateWeeks) {
  const weeksNeeded = Math.ceil(durationNights / 7);
  const weeks = [];
  for (let i = 0; i < weeksNeeded && i < numTemplateWeeks; i++) {
    weeks.push(i);
  }
  return weeks.length > 0 ? weeks : [0];
}

// Auto-match a group to the closest template by duration in nights.
// templates: array of { id, name, durationNights, weeks }
// Returns best match template or null.
export function autoMatchTemplate(group, templates) {
  if (!templates?.length || !group.arr || !group.dep) return null;
  const nights = Math.round(
    (new Date(group.dep) - new Date(group.arr)) / 86400000
  );
  let best = null;
  let bestDiff = Infinity;
  for (const t of templates) {
    const diff = Math.abs((t.durationNights || 14) - nights);
    if (diff < bestDiff) { bestDiff = diff; best = t; }
  }
  return best;
}

// Apply a template's weeks to a group, returning a flat cells object:
// { "groupId-YYYY-MM-DD-AM": value, "groupId-YYYY-MM-DD-PM": value, ... }
//
// group: { id, arr, dep }  (arr/dep are "YYYY-MM-DD" strings)
// weekTemplates: array of day-map objects from parseProgrammeExcel.weekTemplates
//   Each day-map: { Monday: { am, pm }, Tuesday: { am, pm }, ... }
// weeksToApply: array of 0-indexed week indices, e.g. [0] or [0, 1]
export function applyTemplateToGroup(group, weekTemplates, weeksToApply) {
  if (!group?.id || !group?.arr || !group?.dep) return {};
  if (!weekTemplates?.length) return {};

  const cells = {};
  const arrDate = new Date(group.arr + "T12:00:00");
  const depDate = new Date(group.dep + "T12:00:00");
  const arrDayName = DAY_OF_WEEK[arrDate.getDay()]; // e.g. "Thursday"

  for (const weekIdx of (weeksToApply || [0])) {
    const rawDayMap = weekTemplates[weekIdx];
    if (!rawDayMap) continue;

    // Get template days that have content, in Mon–Sun order
    const templateDays = ALL_DAYS.filter((d) => rawDayMap[d]);
    if (!templateDays.length) continue;

    // Rotate templateDays so we start from the arrival day (if present)
    const startIdx = templateDays.indexOf(arrDayName);
    const rotated = startIdx >= 0
      ? [...templateDays.slice(startIdx), ...templateDays.slice(0, startIdx)]
      : templateDays;

    rotated.forEach((dayName, i) => {
      const offsetDays = weekIdx * 7 + i;
      const date = new Date(arrDate.getTime() + offsetDays * 86400000);
      const ds = date.toISOString().split("T")[0];

      // Skip dates outside the group's stay
      if (ds < group.arr || ds > group.dep) return;

      const dayData = rawDayMap[dayName] || {};

      if (ds === group.arr) {
        // Arrival day — override template with ARRIVAL marker
        cells[`${group.id}-${ds}-AM`] = "ARRIVAL";
        cells[`${group.id}-${ds}-PM`] = "ARRIVAL";
      } else if (ds === group.dep) {
        // Departure day — AM only
        cells[`${group.id}-${ds}-AM`] = "DEPARTURE";
      } else {
        if (dayData.am) cells[`${group.id}-${ds}-AM`] = dayData.am;
        if (dayData.pm) cells[`${group.id}-${ds}-PM`] = dayData.pm;
      }
    });
  }

  // Always mark the departure day (it may lie beyond the template's last entry)
  if (group.dep) {
    cells[`${group.id}-${group.dep}-AM`] = "DEPARTURE";
    delete cells[`${group.id}-${group.dep}-PM`];
  }

  return cells;
}

// Count how many nights a group stays (dep - arr in days)
export function groupDurationNights(group) {
  if (!group?.arr || !group?.dep) return 0;
  return Math.round((new Date(group.dep) - new Date(group.arr)) / 86400000);
}
