// Machine-readable rota rules — used by validation code and injected into agent prompts.
export const ROLE_RULES = {
  FTT:  { target: 22, canTeach: true,  canExcursion: false, canEvEnt: false, dayOffPref: "FDE_or_weekend" },
  "5FTT":{ target: 20, canTeach: true,  canExcursion: false, canEvEnt: false, daysWork: "Mon-Fri" },
  TAL:  { target: 22, canTeach: true,  canExcursion: true,  canEvEnt: true,  evEntMax: 4, dayOffPref: "low_demand_day" },
  SAI:  { target: 24, canTeach: false, canExcursion: true,  canEvEnt: true,  hasDinner: true },
  AL:   { target: 24, canTeach: false, canExcursion: true,  canEvEnt: true,  hasDinner: true },
  EAL:  { target: 24, canTeach: false, canExcursion: true,  canEvEnt: true,  hasDinner: true },
  SC:   { target: 24, canTeach: false, canExcursion: true,  canEvEnt: true },
  AC:   { target: 24, canTeach: false, canExcursion: true,  canEvEnt: true },
  EAC:  { target: 24, canTeach: false, canExcursion: true,  canEvEnt: true },
  LAL:  { target: 24, canTeach: false, canExcursion: true,  canEvEnt: true },
  LAC:  { target: 24, canTeach: false, canExcursion: true,  canEvEnt: true },
  FOOTBALL: { target: 24, canTeach: false, canExcursion: true, canEvEnt: true, specialism: "Football" },
  DRAMA:    { target: 24, canTeach: false, canExcursion: true, canEvEnt: true, specialism: "Drama" },
  DANCE:    { target: 24, canTeach: false, canExcursion: true, canEvEnt: true, specialism: "Dance" },
  HP:   { target: 22, canTeach: false, canExcursion: true,  canEvEnt: true,  hasOffice: true },
  CM:   { target: 0,  salaried: true, showAs: "Office" },
  CD:   { target: 0,  salaried: true, showAs: "Office", canTeach: true },
  EAM:  { target: 0,  salaried: true, showAs: "Office" },
  SWC:  { target: 0,  salaried: true, showAs: "Office", canExcursion: true },
};

// Values that do NOT count as sessions toward the fortnight total.
// Sessions = Lessons, English Test, Activities, Evening Activity, excursion names.
// Non-sessions = admin, logistics, rest.
export const NO_COUNT = new Set([
  "Day Off", "Induction", "Setup", "Office", "Airport",
  "Welcome", "Pickup", "Departure Duty",
]);

export const EVE_ENT_NAMES = [
  "Disco","Karaoke","Quiz Night","Film Night","Talent Show","Scavenger Hunt",
  "Flag Ceremony","Awards Night","Paparazzi","Dragons Den","Trashion Show",
  "Murder Mystery","Oscars Night","Sports Night","Welcome Ents",
];

// Mandatory daily assignments (Agent 2 must fill these every day students are on site)
export const MANDATORY_DAILY = {
  dinner: {
    staffNeeded: 2,
    eligibleRoles: ["SAI","AL","EAL","LAL","LAC","SC","AC","HP"],
    slot: "PM or Eve",
    note: "Rotate fairly — no one does dinner more than twice per week",
  },
  eveEnt: {
    staffNeeded: (students) => Math.ceil(students / 20),
    eligibleRoles: ["TAL","SAI","AL","EAL","LAL","LAC","SC","AC","HP","FOOTBALL","DRAMA","DANCE"],
    slot: "Eve",
  },
};

// Formatted constraint list for the Reviewer agent — no prose
export const REVIEWER_CONSTRAINTS = `
CONSTRAINT LIST (Reviewer — flag violations only):
1. FTT cells must be "Lessons", "Testing", "Day Off", "Induction", "Setup", "Airport", "Office", or "Evening Activity". FTTs NEVER appear in excursion destination cells on teaching days.
2. 5FTT only appears Mon-Fri. No Sat/Sun cells (except Day Off/Induction). Session target is 20 per fortnight.
3. TAL session count must NOT exceed 22 per fortnight.
4. SAI/AL/EAL/SC/AC/EAC/LAL/LAC/FOOTBALL/DRAMA/DANCE/HP session count must NOT exceed 24 per fortnight.
5. Management (CM/CD/EAM/SWC) session count is uncapped (salaried). OK to flag only if they appear in teaching cells.
6. Eve column must have at least 1 non-Day-Off entry every day students are on site.
7. No staff member should appear as both "Lessons" and an excursion destination in AM and PM on the same day unless it is a TAL (TALs may teach one slot and do excursion in the other).
8. Activity-only roles (SAI, AL, EAL, SC, AC, EAC, LAL, LAC, FOOTBALL, DRAMA, DANCE, HP) must NEVER have "Lessons" or "Testing" in any cell.
9. Day Off must appear in ALL 3 slots (AM, PM, Eve) on the same day for the same staff member.
10. On FDE days, FTTs must have "Day Off" (all slots) unless they are an exception picked as extra excursion session (max 1 FTT per FDE).
11. No staff member may have more than 2 sessions in a single day (AM + PM = max). Eve entertainment is in addition but the total across AM+PM+Eve must not exceed 2 counted sessions per day.
12. "Evening Activity" is the only permitted value for the Eve slot (besides Day Off or empty). Never use specific entertainment names like Disco, Quiz Night etc.
13. "Induction" only appears in the PM slot on a staff member's first day on site. Never in AM.
14. The following values never count as sessions: Day Off, Induction, Setup, Office, Airport, Welcome, Pickup, Departure Duty.
`.trim();
