// Demand-aware Day Off placement. FTTs forced off on FDE days;
// TALs cohort-split across FDE weekend pairs; everyone else gets
// one Day Off per rolling 7-day window on the lowest-demand day.
// Pure — no framework imports, safe to unit test.

import { dayKey, genDates, inRange } from "./constants";

const SLOTS = ["AM", "PM", "Eve"];
const SKIP_ROLES = new Set(["5FTT", "CM", "CD", "EAM", "SWC"]);

const keyOf = (sid, ds, slot) => `${sid}-${ds}-${slot}`;

function onSiteDates(staff, allDates) {
  const depDs = staff.dep ? String(staff.dep).slice(0, 10) : null;
  return allDates.filter((ds) => inRange(ds, staff.arr, staff.dep) && ds !== depDs);
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

function findFdeWeekendSingles(profiles, dates, paired) {
  return dates.filter((ds) => {
    if (paired.has(ds)) return false;
    const dow = new Date(ds).getDay();
    return (dow === 0 || dow === 6) && profiles[ds]?.isFDE;
  });
}

function isValidDayOff(env, sid, ds) {
  const p = env.profiles[ds];
  if (!p || p.isArrival || p.isFirstArrival) return false;
  if (hasFixedAssignment(env.fixedGrid, sid, ds)) return false;
  return true;
}

function teachingLoad(p) {
  return (p.am?.lessonStu || 0) + (p.pm?.lessonStu || 0);
}

function demandScore(profiles, ds) {
  const p = profiles[ds];
  if (!p) return Infinity;
  if (p.isFDE) return 1000;
  if (p.isTestingDay) return 300;
  if (p.isHDE) return 200;
  const teach = teachingLoad(p);
  if (teach > 0) return 100 + teach;
  return p.students || 0;
}

function weeklyHasDayOff(grid, sid, week) {
  return week.some((ds) => grid[keyOf(sid, ds, "AM")] === "Day Off");
}

function preAssignFttFdeDayOffs(env) {
  // FTTs: day off on FDE weekdays only (weekends handled by cohort split + weekly).
  // 5FTTs: day off on all weekends.
  const allStaff = [...env.staff, ...(env.allStaff || [])];
  allStaff.forEach((s) => {
    if (s.role !== "FTT" && s.role !== "5FTT") return;
    onSiteDates(s, env.allDates).forEach((ds) => {
      const dow = new Date(ds).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isFde = env.profiles[ds]?.isFDE;
      if (s.role === "5FTT" && isWeekend) setDayOff(env.grid, s.id, ds);
      if (s.role === "FTT" && isFde && !isWeekend) setDayOff(env.grid, s.id, ds);
    });
  });
}

function assignTalCohortDayOffs(env) {
  const tals = env.staff.filter((s) => s.role === "TAL" || s.role === "FTT");
  if (!tals.length) return;
  const pairs = findFdeWeekendPairs(env.profiles, env.allDates);
  pairs.forEach(([sat, sun]) => {
    tals.forEach((t, idx) => {
      const target = idx % 2 === 0 ? sat : sun;
      if (isValidDayOff(env, t.id, target)) setDayOff(env.grid, t.id, target);
    });
  });
  const paired = new Set(pairs.flat());
  findFdeWeekendSingles(env.profiles, env.allDates, paired).forEach((ds) => {
    tals.forEach((t, idx) => {
      if (idx % 2 === 0 && isValidDayOff(env, t.id, ds)) setDayOff(env.grid, t.id, ds);
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

function isWeekendDs(ds) {
  const dow = new Date(ds).getDay();
  return dow === 0 || dow === 6;
}

function pickWeeklyDayOff(env, sid, week, weekendOnly) {
  const candidates = week.filter((ds) => isValidDayOff(env, sid, ds) && (!weekendOnly || isWeekendDs(ds)));
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => {
    const sa = demandScore(env.profiles, a);
    const sb = demandScore(env.profiles, b);
    if (sa !== sb) return sa - sb;
    return staffAlreadyOffOn(env.grid, a) - staffAlreadyOffOn(env.grid, b);
  })[0];
}

function assignWeeklyDayOffs(env) {
  env.staff.forEach((s) => {
    const weekendOnly = s.role === "TAL" || s.role === "FTT";
    const weeks = splitIntoWeeks(onSiteDates(s, env.allDates));
    weeks.forEach((week) => {
      if (weeklyHasDayOff(env.grid, s.id, week)) return;
      const pick = pickWeeklyDayOff(env, s.id, week, weekendOnly);
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
  const env = { staff: eligible, allStaff: staff || [], profiles: profiles || {}, fixedGrid, grid, allDates };
  preAssignFttFdeDayOffs(env);
  assignTalCohortDayOffs(env);
  assignWeeklyDayOffs(env);
  return { dayOffGrid: grid };
}
