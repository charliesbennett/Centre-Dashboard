// Machine-readable rota rules — used by validation code and injected into agent prompts.
export const ROLE_RULES = {
  FTT:    { target: 22, canTeach: true,  canExcursion: false, canEvEnt: true,  dayOffPref: "FDE_or_weekend" },
  "5FTT": { target: 20, canTeach: true,  canExcursion: false, canEvEnt: false, daysWork: "Mon-Fri" },
  TAL:    { target: 22, canTeach: true,  canExcursion: true,  canEvEnt: true,  dayOffPref: "low_demand_day" },
  SAI:    { target: 24, canTeach: false, canExcursion: true,  canEvEnt: true },
  AL:     { target: 24, canTeach: false, canExcursion: true,  canEvEnt: true },
  EAL:    { target: 24, canTeach: false, canExcursion: true,  canEvEnt: true },
  SC:     { target: 24, canTeach: false, canExcursion: true,  canEvEnt: true },
  AC:     { target: 24, canTeach: false, canExcursion: true,  canEvEnt: true },
  EAC:    { target: 24, canTeach: false, canExcursion: true,  canEvEnt: true },
  LAL:    { target: 24, canTeach: false, canExcursion: true,  canEvEnt: true },
  LAC:    { target: 24, canTeach: false, canExcursion: true,  canEvEnt: true },
  FOOTBALL: { target: 24, canTeach: false, canExcursion: false, canEvEnt: false, specialism: "Football" },
  PA:       { target: 24, canTeach: false, canExcursion: false, canEvEnt: false, specialism: "Performing Arts" },
  Drama:    { target: 24, canTeach: false, canExcursion: false, canEvEnt: false, specialism: "Performing Arts" },
  DRAMA:    { target: 24, canTeach: false, canExcursion: false, canEvEnt: false, specialism: "Performing Arts" },
  HP:       { target: 0,  salaried: true,  canExcursion: true, canEvEnt: true },
  CM:     { target: 0,  salaried: true, showAs: "Office" },
  CD:     { target: 0,  salaried: true, showAs: "Office", canTeach: true },
  EAM:    { target: 0,  salaried: true, showAs: "Office" },
  SWC:    { target: 0,  salaried: true, showAs: "Office", canExcursion: true },
};

// Values that do NOT count as sessions toward the fortnight total.
export const NO_COUNT = new Set(["Day Off", "Induction"]);

// Formatted constraint list for the Reviewer agent — no prose
export const REVIEWER_CONSTRAINTS = `
CONSTRAINT LIST (Reviewer — flag violations only):
1. FTTs teach Lessons/Testing only. FTTs NEVER appear in excursion destination cells. FTTs may have Eve Activity.
2. 5FTT only appears Mon-Fri. No Sat/Sun cells (except Day Off/Induction). Session target is 20 per fortnight.
3. TAL session count must NOT exceed 22 per fortnight. TALs teach one slot and do activities/excursion in the other.
4. SAI/AL/EAL/SC/AC/EAC/LAL/LAC session count must NOT exceed 24 per fortnight. FOOTBALL/PA must NOT exceed 12 per fortnight. HP is salaried (hours-based) — no session cap.
5. Management (CM/CD/EAM/SWC) are salaried — not session-counted. Flag only if they appear in teaching cells.
6. Eve slot must have at least 1 Eve Activity entry every night students are on site.
7. Activity-only roles (SAI, AL, EAL, SC, AC, EAC, LAL, LAC, FOOTBALL, PA, HP) must NEVER have Lessons or Testing. FOOTBALL/PA max 12 sessions per fortnight.
8. Day Off must appear as "Day Off" in ALL 3 slots (AM, PM, Eve) on the same day for the same staff member.
9. No staff member may have more than 2 counted sessions in a single day across AM + PM + Eve combined.
10. On FDE days, FTTs must have "Day Off" (all slots). FTTs never go on excursions.
11. "Eve Activity" is the only permitted value for the Eve slot (besides Day Off). Never use specific ent names.
12. Airport counts as a session. Airport may appear in AM, PM, or Eve depending on flight times.
13. The following values never count as sessions: Day Off, Office, Induction. Everything else counts (Setup, Pickup, Welcome, Departure Duty, Airport, Lessons, Activities, Eve Activity, etc.).
14. ZZ centres have FTTs + TALs. NZZ centres have TALs only (no FTTs).
`.trim();

// ── Session counting ───────────────────────────────────────────────────────
export function countSessions(rotaGrid, staffId, noCountSet = NO_COUNT) {
  let count = 0;
  for (const [key, val] of Object.entries(rotaGrid || {})) {
    if (!key.startsWith(staffId + "-")) continue;
    if (!val || noCountSet.has(val)) continue;
    count++;
  }
  return count;
}

// ── Day off validation ─────────────────────────────────────────────────────
// Returns array of dateKeys where a partial day off exists (some but not all slots are "Day Off")
export function validateDayOffs(rotaGrid, staffId, dates) {
  const SLOTS = ["AM", "PM", "Eve"];
  const partial = [];
  for (const date of dates) {
    const dk = typeof date === "string" ? date : date.toISOString().slice(0, 10);
    const slotValues = SLOTS.map((s) => rotaGrid[`${staffId}-${dk}-${s}`] || "");
    const dayOffCount = slotValues.filter((v) => v === "Day Off").length;
    if (dayOffCount > 0 && dayOffCount < 3) partial.push(dk);
  }
  return partial;
}
