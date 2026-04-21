// Role-preference allocator. Consumes the demand matrix + bindings + fixed grid
// and returns a populated rota grid plus structured shortfalls.
// Pure — no framework imports, safe to unit test.

import { NO_COUNT, ROLE_RULES } from "./rotaRules";
import { inRange } from "./constants";

const SLOTS = ["AM", "PM", "Eve"];
const MGMT = new Set(["CM", "CD", "EAM", "SWC"]);
const EVE_INELIGIBLE = new Set(["FTT", "5FTT", "CM", "CD", "EAM"]);

const keyOf = (sid, ds, slot) => `${sid}-${ds}-${slot}`;
const cellVal = (grid, sid, ds, slot) => grid[keyOf(sid, ds, slot)];
const isOnSite = (s, ds) => inRange(ds, s.arr, s.dep) && ds !== s.dep;

function targetOf(role) {
  const r = ROLE_RULES[role];
  if (!r) return 24;
  if (r.salaried) return Infinity;
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
  shortfalls.push({ role, count: missing, reason: cell.kind + (cell.dest ? ` (${cell.dest})` : ""), date: ds, slot });
}

function allocateCell(cell, ds, slot, env) {
  const { staff, bindings, grid, sessions, shortfalls, eveRoster } = env;
  let filled = 0;
  for (const c of orderedCandidates(cell, staff, bindings, sessions)) {
    if (filled >= cell.need) break;
    if (!canAccept(c, grid, sessions, ds, slot)) continue;
    if (eveRoster.has(c.id) && daySessionCount(grid, c.id, ds) >= 1) continue;
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
    .filter((s) => !cellVal(grid, s.id, ds, "Eve"));
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

function sortedSlotCells(dayDemand) {
  const combined = [
    ...dayDemand.AM.map((cell) => ({ cell, slot: "AM" })),
    ...dayDemand.PM.map((cell) => ({ cell, slot: "PM" })),
  ];
  return combined.sort((a, b) => (KIND_PRIORITY[a.cell.kind] || 9) - (KIND_PRIORITY[b.cell.kind] || 9));
}

function allocateDay(ds, env) {
  const dayDemand = env.demand[ds];
  if (!dayDemand) return;
  const allCells = sortedSlotCells(dayDemand);
  const spanning = allCells.filter(({ cell }) => cell.spanSlots);
  const nonSpanning = allCells.filter(({ cell }) => !cell.spanSlots);
  spanning.forEach(({ cell, slot }) => allocateCell(cell, ds, slot, env));
  env.eveRoster = planEveRoster(ds, env);
  placeMgmtOffice(ds, env);
  nonSpanning.forEach(({ cell, slot }) => allocateCell(cell, ds, slot, env));
  assignEve(ds, env);
}

function countSessionsInGrid(grid, sid) {
  let n = 0;
  for (const [k, v] of Object.entries(grid)) {
    if (!k.startsWith(sid + "-")) continue;
    if (v && !NO_COUNT.has(v)) n++;
  }
  return n;
}

export function allocateRota({ staff, demand, bindings, fixedGrid = {}, dates }) {
  const grid = { ...fixedGrid };
  const sessions = {};
  staff.forEach((s) => { sessions[s.id] = countSessionsInGrid(grid, s.id); });
  const shortfalls = [];
  const env = { staff, demand, bindings, grid, sessions, shortfalls, eveRoster: new Set() };
  dates.forEach((ds) => allocateDay(ds, env));
  return { grid, sessions, shortfalls };
}
