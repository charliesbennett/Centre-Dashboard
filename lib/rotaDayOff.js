// Demand-aware Day Off placement. FTTs forced off on FDE days;
// TALs cohort-split across FDE weekend pairs; everyone else gets
// one Day Off per rolling 7-day window on the lowest-demand day.
// Pure — no framework imports, safe to unit test.

import { dayKey, genDates, inRange } from "./constants";

const SLOTS = ["AM", "PM", "Eve"];
const SKIP_ROLES = new Set(["5FTT", "CM", "CD", "EAM", "SWC"]);

const keyOf = (sid, ds, slot) => `${sid}-${ds}-${slot}`;

function onSiteDates(staff, allDates) {
  return allDates.filter((ds) => inRange(ds, staff.arr, staff.dep) && ds !== staff.dep);
}

function splitIntoWeeks(dates) {
  const weeks = [];
  for (let i = 0; i < dates.length; i += 7) weeks.push(dates.slice(i, i + 7));
  return weeks;
}

function setDayOff(grid, sid, ds) {
  SLOTS.forEach((sl) => { grid[keyOf(sid, ds, sl)] = "Day Off"; });
}

function hasFixedAssignment(fixedGrid, sid, ds) {
  return SLOTS.some((sl) => {
    const v = fixedGrid[keyOf(sid, ds, sl)];
    return v && v !== "Day Off";
  });
}

function findFdeWeekendPairs(profiles, dates) {
  const pairs = [];
  for (let i = 0; i < dates.length - 1; i++) {
    const a = dates[i], b = dates[i + 1];
    const aSat = new Date(a).getDay() === 6;
    const bSun = new Date(b).getDay() === 0;
    if (aSat && bSun && profiles[a]?.isFDE && profiles[b]?.isFDE) pairs.push([a, b]);
  }
  return pairs;
}

function isValidDayOff(env, sid, ds) {
  const p = env.profiles[ds];
  if (!p || p.isArrival || p.isFirstArrival) return false;
  if (hasFixedAssignment(env.fixedGrid, sid, ds)) return false;
  return true;
}

function demandScore(profiles, ds) {
  const p = profiles[ds];
  if (!p) return Infinity;
  if (p.isFDE) return 1000;
  if (p.isTestingDay) return 300;
  if (p.isHDE) return 200;
  return p.students || 0;
}

function weeklyHasDayOff(grid, sid, week) {
  return week.some((ds) => grid[keyOf(sid, ds, "AM")] === "Day Off");
}

function preAssignFttFdeDayOffs(env) {
  env.staff.filter((s) => s.role === "FTT").forEach((s) => {
    onSiteDates(s, env.allDates).forEach((ds) => {
      if (env.profiles[ds]?.isFDE && isValidDayOff(env, s.id, ds)) {
        setDayOff(env.grid, s.id, ds);
      }
    });
  });
}

function assignTalCohortDayOffs(env) {
  const tals = env.staff.filter((s) => s.role === "TAL");
  const pairs = findFdeWeekendPairs(env.profiles, env.allDates);
  if (!tals.length || !pairs.length) return;
  tals.forEach((t, idx) => {
    pairs.forEach(([sat, sun]) => {
      const target = idx % 2 === 0 ? sat : sun;
      if (isValidDayOff(env, t.id, target)) setDayOff(env.grid, t.id, target);
    });
  });
}

function staffAlreadyOffOn(grid, ds) {
  let n = 0;
  const suffix = `-${ds}-AM`;
  for (const k in grid) {
    if (k.endsWith(suffix) && grid[k] === "Day Off") n++;
  }
  return n;
}

function pickWeeklyDayOff(env, sid, week) {
  const candidates = week.filter((ds) => isValidDayOff(env, sid, ds));
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => {
    const ca = staffAlreadyOffOn(env.grid, a);
    const cb = staffAlreadyOffOn(env.grid, b);
    if (ca !== cb) return ca - cb;
    return demandScore(env.profiles, a) - demandScore(env.profiles, b);
  })[0];
}

function assignWeeklyDayOffs(env) {
  env.staff.forEach((s) => {
    const weeks = splitIntoWeeks(onSiteDates(s, env.allDates));
    weeks.forEach((week) => {
      if (weeklyHasDayOff(env.grid, s.id, week)) return;
      const pick = pickWeeklyDayOff(env, s.id, week);
      if (pick) setDayOff(env.grid, s.id, pick);
    });
  });
}

function seedFromFixed(grid, fixedGrid) {
  for (const [k, v] of Object.entries(fixedGrid || {})) {
    if (v === "Day Off") grid[k] = "Day Off";
  }
}

export function placeDayOffs({ staff, profiles, fixedGrid = {}, progStart, progEnd }) {
  const grid = {};
  if (!progStart || !progEnd) return { dayOffGrid: grid };
  seedFromFixed(grid, fixedGrid);
  const allDates = genDates(progStart, progEnd).map((d) => dayKey(d));
  const eligible = (staff || []).filter((s) => !SKIP_ROLES.has(s.role));
  const env = { staff: eligible, profiles: profiles || {}, fixedGrid, grid, allDates };
  preAssignFttFdeDayOffs(env);
  assignTalCohortDayOffs(env);
  assignWeeklyDayOffs(env);
  return { dayOffGrid: grid };
}
