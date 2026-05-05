// Role-preference allocator. Consumes the demand matrix + bindings + fixed grid
// and returns a populated rota grid plus structured shortfalls.
// Pure — no framework imports, safe to unit test.

import { NO_COUNT, ROLE_RULES } from "./rotaRules";
import { inRange } from "./constants";

const SLOTS = ["AM", "PM", "Eve"];
const MGMT = new Set(["CM", "CD", "EAM", "SWC"]);
const EVE_INELIGIBLE = new Set(["FTT", "5FTT", "CM", "CD", "EAM", "FOOTBALL", "PA"]);
// Specialists always fill their sessions regardless of fortnight target.
// The target is shown in the display but not enforced during allocation.
const UNCAPPED_ROLES = new Set(["FOOTBALL", "PA"]);

const keyOf = (sid, ds, slot) => `${sid}-${ds}-${slot}`;
const cellVal = (grid, sid, ds, slot) => grid[keyOf(sid, ds, slot)];
const isOnSite = (s, ds) => {
  const depDs = s.dep ? String(s.dep).slice(0, 10) : null;
  return inRange(ds, s.arr, s.dep) && ds !== depDs;
};

function targetOf(role) {
  const r = ROLE_RULES[role];
  if (!r) return 24;
  if (r.salaried || UNCAPPED_ROLES.has(role)) return Infinity;
  return r.target || 24;
}

function daySessionCount(grid, sid, ds) {
  let n = 0;
  for (const sl of SLOTS) {
    const v = cellVal(grid, sid, ds, sl);
    if (v && !NO_COUNT.has(v)) n++;
  }
  return n;
}

function place(grid, sessions, sid, ds, slot, label) {
  const k = keyOf(sid, ds, slot);
  if (grid[k]) return false;
  grid[k] = label;
  if (!NO_COUNT.has(label)) sessions[sid] = (sessions[sid] || 0) + 1;
  return true;
}

function canAccept(s, grid, sessions, ds, slot) {
  if (!isOnSite(s, ds)) return false;
  if (cellVal(grid, s.id, ds, slot)) return false;
  if (daySessionCount(grid, s.id, ds) >= 2) return false;
  const t = targetOf(s.role);
  if (t !== Infinity && t > 0 && (sessions[s.id] || 0) >= t) return false;
  return true;
}

function isDayOff(grid, sid, ds) {
  return cellVal(grid, sid, ds, "AM") === "Day Off";
}

function matchesTier(staff, tier, bindings) {
  if (tier === "boundTAL") return false;
  return staff.role === tier;
}

function boundStaffFor(cell, staff, bindings) {
  const bound = bindings.groupTals[cell.groupId] || [];
  return staff.filter((s) => bound.includes(s.id));
}

function orderedCandidates(cell, staff, bindings, sessions) {
  const out = [];
  const seen = new Set();
  const takeSorted = (list) => {
    list.filter((s) => !seen.has(s.id))
      .sort((a, b) => (sessions[a.id] || 0) - (sessions[b.id] || 0))
      .forEach((s) => { seen.add(s.id); out.push(s); });
  };
  for (const tier of cell.prefer) {
    if (tier === "boundTAL") takeSorted(boundStaffFor(cell, staff, bindings));
    else takeSorted(staff.filter((s) => matchesTier(s, tier, bindings)));
  }
  return out;
}

function recordShortfall(shortfalls, cell, ds, slot, missing) {
  if (missing <= 0) return;
  const role = cell.prefer[0] === "boundTAL" ? "TAL" : cell.prefer[0];
  const label = cell.label || cell.kind;
  shortfalls.push({ role, count: missing, reason: label + (cell.dest ? ` (${cell.dest})` : ""), date: ds, slot });
}

function alreadyTeachingToday(grid, sid, ds, slot) {
  return SLOTS.some((sl) => sl !== slot && cellVal(grid, sid, ds, sl) === "Lessons");
}

function allocateCell(cell, ds, slot, env) {
  const { staff, bindings, grid, sessions } = env;
  const isTeaching = cell.kind === "Lessons" || cell.kind === "Testing";
  let filled = 0;
  for (const c of orderedCandidates(cell, staff, bindings, sessions)) {
    if (filled >= cell.need) break;
    if (!canAccept(c, grid, sessions, ds, slot)) continue;
    if (isTeaching && c.role === "TAL" && alreadyTeachingToday(grid, c.id, ds, slot)) continue;
    place(grid, sessions, c.id, ds, slot, cell.label);
    if (cell.spanSlots) cell.spanSlots.forEach((sl) => { if (sl !== slot) place(grid, sessions, c.id, ds, sl, cell.label); });
    filled++;
  }
  recordShortfall(env.shortfalls, cell, ds, slot, cell.need - filled);
}

function planEveRoster(ds, env) {
  const { demand, staff, grid, sessions } = env;
  const cell = (demand[ds]?.Eve || [])[0];
  if (!cell) return new Set();
  const eligible = staff
    .filter((s) => !EVE_INELIGIBLE.has(s.role))
    .filter((s) => isOnSite(s, ds) && !isDayOff(grid, s.id, ds))
    .filter((s) => !cellVal(grid, s.id, ds, "Eve"))
    .filter((s) => daySessionCount(grid, s.id, ds) < 2);
  const ordered = orderedCandidates(cell, eligible, env.bindings, sessions);
  const roster = new Set();
  for (const s of ordered) {
    if (roster.size >= cell.need) break;
    roster.add(s.id);
  }
  return roster;
}

function assignEve(ds, env) {
  const { demand, grid, sessions, eveRoster, shortfalls } = env;
  const cell = (demand[ds]?.Eve || [])[0];
  if (!cell) return;
  let filled = 0;
  for (const sid of eveRoster) {
    if (daySessionCount(grid, sid, ds) >= 2) continue;
    if (place(grid, sessions, sid, ds, "Eve", cell.label)) filled++;
  }
  recordShortfall(shortfalls, cell, ds, "Eve", cell.need - filled);
}

function placeMgmtOffice(ds, env) {
  const { staff, grid, sessions, eveRoster } = env;
  staff.filter((s) => MGMT.has(s.role) && isOnSite(s, ds) && !isDayOff(grid, s.id, ds)).forEach((s) => {
    if (!cellVal(grid, s.id, ds, "AM")) place(grid, sessions, s.id, ds, "AM", "Office");
    if (!cellVal(grid, s.id, ds, "PM") && !eveRoster.has(s.id)) place(grid, sessions, s.id, ds, "PM", "Office");
  });
}

const KIND_PRIORITY = { Lessons: 1, Testing: 2, Excursion: 3, Pickup: 4, Activities: 5 };

// Roles that get Activities fill in empty slots (not management or teaching-only roles)
const FILL_ELIGIBLE = new Set(["TAL", "SAI", "AL", "EAL", "SC", "AC", "EAC", "LAL", "LAC", "HP"]);

const SPECIALIST_LABEL = { PA: "Performing Arts", FOOTBALL: "Football" };

function sortedSlotCells(dayDemand) {
  const combined = [
    ...dayDemand.AM.map((cell) => ({ cell, slot: "AM" })),
    ...dayDemand.PM.map((cell) => ({ cell, slot: "PM" })),
  ];
  return combined.sort((a, b) => {
    const pa = KIND_PRIORITY[a.cell.kind] || 9;
    const pb = KIND_PRIORITY[b.cell.kind] || 9;
    if (pa !== pb) return pa - pb;
    // Within Lessons: PM slot first so PM demand claims TALs before AM overflow can grab them
    if (a.cell.kind === "Lessons" && a.slot !== b.slot) return a.slot === "PM" ? -1 : 1;
    return 0;
  });
}

function fillIdleSlots(ds, env) {
  // Fill remaining empty AM/PM slots: activity-eligible roles get "Activities",
  // FTTs get "Office" (lesson prep on non-teaching days).
  const { staff, grid, sessions, profiles, demand, eveRoster } = env;
  const profile = profiles?.[ds];
  const hasActiveStudents = profile?.activeStudents > 0 && !profile?.isFDE;
  if (hasActiveStudents) {
    staff.filter((s) => FILL_ELIGIBLE.has(s.role)).forEach((s) => {
      if (!isOnSite(s, ds) || isDayOff(grid, s.id, ds)) return;
      if (eveRoster.has(s.id)) return;
      ["AM", "PM"].forEach((sl) => {
        if (!canAccept(s, grid, sessions, ds, sl)) return;
        const slotHasActivityDemand = (demand[ds]?.[sl] || []).some((c) => c.kind === "Activities");
        if (slotHasActivityDemand) {
          place(grid, sessions, s.id, ds, sl, "Multi-Activity");
        }
      });
    });
  }
  staff.filter((s) => s.role === "FTT").forEach((s) => {
    if (!isOnSite(s, ds) || isDayOff(grid, s.id, ds)) return;
    ["AM", "PM"].forEach((sl) => {
      if (cellVal(grid, s.id, ds, sl)) return;
      const hasLessonDemand = (demand[ds]?.[sl] || []).some((c) => c.kind === "Lessons" || c.kind === "Testing");
      if (hasLessonDemand && daySessionCount(grid, s.id, ds) < 2) {
        place(grid, sessions, s.id, ds, sl, "Lessons");
      } else {
        grid[keyOf(s.id, ds, sl)] = "Office";
      }
    });
  });
}

// Force PA/Football specialists into both AM and PM on any day with activity demand.
// Works regardless of the lesson-slot split — if students have Multi-Activity in
// either slot, the specialist covers both slots.
function fillSpecialistSlots(ds, env) {
  const { staff, grid, sessions, demand } = env;
  const dayDemand = demand[ds];
  if (!dayDemand) return;
  const hasActivity = [...(dayDemand.AM || []), ...(dayDemand.PM || [])].some((c) => c.kind === "Activities");
  if (!hasActivity) return;
  staff.filter((s) => SPECIALIST_LABEL[s.role]).forEach((s) => {
    if (!isOnSite(s, ds) || isDayOff(grid, s.id, ds)) return;
    ["AM", "PM"].forEach((sl) => {
      if (!cellVal(grid, s.id, ds, sl)) place(grid, sessions, s.id, ds, sl, SPECIALIST_LABEL[s.role]);
    });
  });
}

function allocateDay(ds, env) {
  const dayDemand = env.demand[ds];
  if (!dayDemand) return;
  const allCells = sortedSlotCells(dayDemand);
  const spanning = allCells.filter(({ cell }) => cell.spanSlots);
  const nonSpanning = allCells.filter(({ cell }) => !cell.spanSlots);
  const pickup = nonSpanning.filter(({ cell }) => cell.kind === "Pickup");
  const rest = nonSpanning.filter(({ cell }) => cell.kind !== "Pickup");
  pickup.forEach(({ cell, slot }) => allocateCell(cell, ds, slot, env));
  spanning.forEach(({ cell, slot }) => allocateCell(cell, ds, slot, env));
  placeMgmtOffice(ds, env);
  rest.forEach(({ cell, slot }) => allocateCell(cell, ds, slot, env));
  env.eveRoster = planEveRoster(ds, env);
  assignEve(ds, env);
  fillSpecialistSlots(ds, env);
  fillIdleSlots(ds, env);
}

function countSessionsInGrid(grid, sid) {
  let n = 0;
  for (const [k, v] of Object.entries(grid)) {
    if (!k.startsWith(sid + "-")) continue;
    if (v && !NO_COUNT.has(v)) n++;
  }
  return n;
}

export function allocateRota({ staff, demand, bindings, fixedGrid = {}, dates, profiles = {} }) {
  const normalizedStaff = staff.map((s) => (s.role === "Drama" || s.role === "DRAMA") ? { ...s, role: "PA" } : s);
  staff = normalizedStaff;
  const grid = { ...fixedGrid };
  const sessions = {};
  staff.forEach((s) => { sessions[s.id] = countSessionsInGrid(grid, s.id); });
  const shortfalls = [];
  const env = { staff, demand, bindings, grid, sessions, shortfalls, eveRoster: new Set(), profiles };
  dates.forEach((ds) => allocateDay(ds, env));

  const SPECIALIST_LABEL = { PA: "Performing Arts", FOOTBALL: "Football" };
  for (const [key, val] of Object.entries(grid)) {
    if (val !== "Multi-Activity") continue;
    const s = staff.find((st) => key.startsWith(st.id + "-"));
    if (s && SPECIALIST_LABEL[s.role]) grid[key] = SPECIALIST_LABEL[s.role];
  }

  return { grid, sessions, shortfalls };
}
