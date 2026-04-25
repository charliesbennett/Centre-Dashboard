// Pure demand matrix builder for rota generation.
// Emits per-date, per-slot demand cells that the allocator consumes.
// No side effects, no framework imports — safe to unit test.

import { dayKey, genDates, inRange, getGroupLessonSlot } from "./constants";

export const STUDENTS_PER_TEACHER = 16;
export const STUDENTS_PER_STAFF = 20;
export const MIN_EVE_STAFF = 2;

const ACTIVITY_ROLES = ["LAL", "LAC", "SAI", "EAL", "SC", "EAC", "FOOTBALL", "DRAMA", "DANCE", "HP"];
export const PREFER_LESSONS = ["boundTAL", "FTT", "TAL", "5FTT"];
export const PREFER_EXCURSION = [...ACTIVITY_ROLES, "TAL"];
export const PREFER_EVE = ["TAL", ...ACTIVITY_ROLES];
export const PREFER_PICKUP = [...ACTIVITY_ROLES, "TAL"];
export const PREFER_TEST = ["FTT", "TAL", "5FTT"];

function activeOnDate(g, ds) {
  return inRange(ds, g.arr, g.dep) && ds !== g.dep;
}

function isWeekendDs(ds) {
  const day = new Date(ds).getDay();
  return day === 0 || day === 6;
}

function progVal(progGrid, g, ds, slot) {
  return String(progGrid[`${g.id}-${ds}-${slot}`] || "").trim();
}

function isExcursionVal(val) {
  if (!val) return false;
  if (/english\s*(?:test|lessons?)|placement\s*test|^lessons?$/i.test(val)) return false;
  if (/arriv|depart/i.test(val)) return false;
  return true;
}

function studentsOnSite(groups, ds) {
  return groups.reduce((sum, g) => activeOnDate(g, ds) ? sum + (g.stu || 0) + (g.gl || 0) : sum, 0);
}

function activeStudentsOnSite(groups, ds) {
  return groups.reduce((sum, g) => {
    if (!activeOnDate(g, ds) || ds === g.arr) return sum;
    return sum + (g.stu || 0) + (g.gl || 0);
  }, 0);
}

function groupLeadersOnSite(groups, ds) {
  return groups.reduce((sum, g) => activeOnDate(g, ds) ? sum + (g.gl || 0) : sum, 0);
}

function slotProfile(env, ds, slot) {
  const { groups, progGrid } = env;
  let lessonStu = 0, testStu = 0;
  const excDests = {};
  const weekend = isWeekendDs(ds);
  groups.forEach((g) => {
    if (!activeOnDate(g, ds) || ds === g.arr) return;
    const pax = (g.stu || 0) + (g.gl || 0);
    const val = progVal(progGrid, g, ds, slot);
    if (val && /english\s*test|placement\s*test/i.test(val)) { testStu += pax; return; }
    if (isExcursionVal(val)) { excDests[val] = (excDests[val] || 0) + pax; return; }
    const isExplicitLesson = val && /english\s*lessons?|^lessons?$/i.test(val);
    if (isExplicitLesson || (!weekend && getGroupLessonSlot(g, ds) === slot)) lessonStu += pax;
  });
  const topDest = Object.keys(excDests).sort((a, b) => excDests[b] - excDests[a])[0] || null;
  return { lessonStu, testStu, excDests, topDest };
}

function dayProfile(env, ds) {
  const { groups, arrivalDates, groupArrivalDate } = env;
  const am = slotProfile(env, ds, "AM");
  const pm = slotProfile(env, ds, "PM");
  const hasAMExc = Object.keys(am.excDests).length > 0;
  const hasPMExc = Object.keys(pm.excDests).length > 0;
  const teachStu = am.lessonStu + am.testStu + pm.lessonStu + pm.testStu;
  const isFDE = hasAMExc && hasPMExc && teachStu === 0;
  return {
    ds, am, pm,
    students: studentsOnSite(groups, ds),
    activeStudents: activeStudentsOnSite(groups, ds),
    gls: groupLeadersOnSite(groups, ds),
    isArrival: arrivalDates.has(ds),
    isFirstArrival: ds === groupArrivalDate,
    isTestingDay: am.testStu > 0 || pm.testStu > 0,
    isFDE,
    isHDE: !isFDE && (hasAMExc || hasPMExc),
    fdeLabel: isFDE ? (am.topDest || pm.topDest || "Excursion") : null,
  };
}

function isTestVal(val) {
  return !!val && /english\s*test|placement\s*test/i.test(val);
}

function lessonsCells(env, ds, slot) {
  const weekend = isWeekendDs(ds);
  const { groups, progGrid } = env;
  return groups
    .filter((g) => {
      if (!activeOnDate(g, ds) || ds === g.arr) return false;
      if (!(g.stu || g.gl)) return false;
      const val = progVal(progGrid, g, ds, slot);
      const isExplicitLesson = /english\s*lessons?|^lessons?$/i.test(val || "");
      // On weekends, only generate lesson demand when progGrid explicitly shows lessons
      if (weekend && !isExplicitLesson) return false;
      if (!isExplicitLesson && getGroupLessonSlot(g, ds) !== slot) return false;
      if (isTestVal(val) || isExcursionVal(val)) return false;
      return true;
    })
    .map((g) => {
      const pax = (g.stu || 0) + (g.gl || 0);
      return {
        kind: "Lessons", groupId: g.id, label: "Lessons",
        need: Math.ceil(pax / STUDENTS_PER_TEACHER),
        prefer: PREFER_LESSONS, studentCount: pax,
      };
    });
}

function activitiesCells(profile, slot) {
  if (profile.isFDE) return [];
  const slotP = slot === "AM" ? profile.am : profile.pm;
  const excTotal = Object.values(slotP.excDests).reduce((s, v) => s + v, 0);
  const actStu = profile.activeStudents - slotP.lessonStu - slotP.testStu - excTotal;
  if (actStu <= 0) return [];
  return [{
    kind: "Activities", label: "Activities",
    need: Math.ceil(actStu / STUDENTS_PER_STAFF),
    prefer: PREFER_EXCURSION, studentCount: actStu,
  }];
}

function excursionCells(profile, slot) {
  const slotP = slot === "AM" ? profile.am : profile.pm;
  return Object.entries(slotP.excDests).map(([dest, pax]) => ({
    kind: "Excursion", dest, label: dest,
    need: Math.ceil(pax / STUDENTS_PER_STAFF),
    prefer: PREFER_EXCURSION, studentCount: pax,
  }));
}

function testingCells(profile, slot) {
  const slotP = slot === "AM" ? profile.am : profile.pm;
  if (slotP.testStu === 0) return [];
  return [{
    kind: "Testing", label: "Lessons",
    need: Math.ceil(slotP.testStu / STUDENTS_PER_TEACHER),
    prefer: PREFER_LESSONS, studentCount: slotP.testStu,
  }];
}

function pickupCells(groups, ds) {
  const arriving = groups.filter((g) => g.arr === ds);
  if (!arriving.length) return [];
  return [{
    kind: "Pickup", label: "Pickup",
    need: arriving.length, prefer: PREFER_PICKUP,
    studentCount: arriving.reduce((s, g) => s + (g.stu || 0) + (g.gl || 0), 0),
  }];
}

function eveCells(profile) {
  if (profile.students === 0) return [];
  return [{
    kind: "EveActivity", label: "Eve Activity",
    need: Math.max(MIN_EVE_STAFF, Math.ceil(profile.students / STUDENTS_PER_STAFF)),
    prefer: PREFER_EVE, studentCount: profile.students,
  }];
}

function fdeCells(profile) {
  const pax = profile.students;
  return [{
    kind: "Excursion", dest: profile.fdeLabel, label: profile.fdeLabel,
    need: Math.ceil(pax / STUDENTS_PER_STAFF),
    prefer: PREFER_EXCURSION, spanSlots: ["AM", "PM"],
    studentCount: pax,
  }];
}

function slotCells(env, profile, slot) {
  if (profile.isFDE) return slot === "AM" ? fdeCells(profile) : [];
  return [
    ...lessonsCells(env, profile.ds, slot),
    ...testingCells(profile, slot),
    ...excursionCells(profile, slot),
    ...activitiesCells(profile, slot),
  ];
}

function minRatioFor(profile) {
  return Math.max(0, Math.ceil(profile.students / STUDENTS_PER_STAFF) - profile.gls);
}

function emptyResult() {
  return { demand: {}, profiles: {}, minRatio: {}, groupArrivalDate: null, arrivalDates: new Set(), arrGroups: {} };
}

export function buildDemand({ groups, progGrid = {}, progStart, progEnd }) {
  if (!progStart || !progEnd) return emptyResult();
  // Normalize arr/dep to YYYY-MM-DD so all comparisons work with ISO timestamps from Supabase
  const gs = (groups || []).map((g) => ({
    ...g,
    arr: g.arr ? String(g.arr).slice(0, 10) : null,
    dep: g.dep ? String(g.dep).slice(0, 10) : null,
  }));
  const arrivalDates = new Set(gs.map((g) => g.arr).filter(Boolean));
  const groupArrivalDate = [...arrivalDates].sort()[0] || null;
  const arrGroups = {};
  gs.forEach((g) => { if (g.arr) arrGroups[g.arr] = (arrGroups[g.arr] || 0) + 1; });
  const env = { groups: gs, progGrid, arrivalDates, groupArrivalDate };

  const profiles = {};
  const demand = {};
  const minRatio = {};
  genDates(progStart, progEnd).forEach((d) => {
    const ds = dayKey(d);
    const profile = dayProfile(env, ds);
    profiles[ds] = profile;
    const ratio = minRatioFor(profile);
    minRatio[ds] = { AM: ratio, PM: ratio, Eve: ratio };
    if (!groupArrivalDate || ds < groupArrivalDate) {
      demand[ds] = { AM: [], PM: [], Eve: [] };
      return;
    }
    demand[ds] = {
      AM: [...pickupCells(gs, ds), ...slotCells(env, profile, "AM")],
      PM: slotCells(env, profile, "PM"),
      Eve: eveCells(profile),
    };
  });
  return { demand, profiles, minRatio, groupArrivalDate, arrivalDates, arrGroups };
}
