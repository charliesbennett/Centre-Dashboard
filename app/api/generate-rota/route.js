import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

export const maxDuration = 300;

const INTEL_DOC = readFileSync(join(process.cwd(), "lib/rotaIntel.md"), "utf-8");

// ── Utility functions (mirrored from lib/constants.js for server-side use) ──
function genDates(start, end) {
  const dates = [];
  const s = new Date(start), e = new Date(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) dates.push(new Date(d));
  return dates;
}
function dayKey(d) { return d.toISOString().split("T")[0]; }
function dayName(d) { return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]; }
function inRange(ds, arr, dep) { return !!(arr && dep && ds >= arr && ds <= dep); }
function getGroupLessonSlot(g, ds) {
  if (!g.arr || !g.lessonSlot) return g.lessonSlot || "AM";
  const daysSince = Math.floor((new Date(ds) - new Date(g.arr)) / 86400000);
  return Math.floor(daysSince / 7) % 2 === 0 ? g.lessonSlot : (g.lessonSlot === "AM" ? "PM" : "AM");
}

const SESSION_TARGET = (role) => {
  if (["CM","CD","EAM","SWC"].includes(role)) return 0;
  if (["TAL","FTT","5FTT","HP"].includes(role)) return 22;
  return 24;
};

const NO_COUNT = new Set(["Day Off","Induction","Setup","Office","Airport"]);
const TEACHING_ROLES = ["FTT","5FTT","TAL","CD"];
const ACTIVITY_ROLES = ["SAI","AL","EAL","SC","AC","EAC","LAL","LAC","FOOTBALL","DRAMA","DANCE","HP"];
const MGMT_ROLES = ["CM","CD","EAM","SWC"];

const EVE_ENT_NAMES = [
  "Disco","Karaoke","Quiz Night","Film Night","Talent Show","Scavenger Hunt",
  "Flag Ceremony","Awards Night","Paparazzi","Dragons Den","Trashion Show",
  "Murder Mystery","Oscars Night","Sports Night","Welcome Ents",
];

// ── Day profile builder ───────────────────────────────────────────────────────
function buildDayProfiles(dates, groups, progGrid) {
  const allArrivalDates = new Set((groups || []).map((g) => g.arr).filter(Boolean));
  const firstArrival = [...allArrivalDates].sort()[0] || null;
  const arrStu = {};
  (groups || []).forEach((g) => {
    if (g.arr) arrStu[g.arr] = (arrStu[g.arr] || 0) + (g.stu || 0) + (g.gl || 0);
  });

  return dates.map((d) => {
    const ds = dayKey(d);
    const dow = dayName(d);
    let totalStu = 0;
    (groups || []).forEach((g) => { if (inRange(ds, g.arr, g.dep)) totalStu += (g.stu || 0) + (g.gl || 0); });

    const slotInfo = {};
    ["AM", "PM"].forEach((slot) => {
      let lessonStu = 0, testStu = 0;
      const excDests = {};
      (groups || []).forEach((g) => {
        if (!inRange(ds, g.arr, g.dep)) return;
        if (ds === g.arr || ds === g.dep) return;
        const val = String(progGrid?.[g.id + "-" + ds + "-" + slot] || "").trim();
        const pax = (g.stu || 0) + (g.gl || 0);
        if (val && /english\s*test|placement\s*test/i.test(val)) { testStu += pax; return; }
        if (getGroupLessonSlot(g, ds) === slot) { lessonStu += pax; return; }
        if (val && !/arriv|depart/i.test(val)) excDests[val] = (excDests[val] || 0) + pax;
      });
      const sortedDests = Object.keys(excDests).sort((a, b) => excDests[b] - excDests[a]);
      slotInfo[slot] = {
        lessonStu, testStu,
        isTesting: testStu > 0,
        hasExc: sortedDests.length > 0,
        topDest: sortedDests[0] || null,
        teachersNeeded: Math.ceil((lessonStu + testStu) / 16),
        excSummary: sortedDests.length > 0
          ? sortedDests.map((dest) => `${dest}(${excDests[dest]}stu)`).join(", ")
          : null,
      };
    });

    const isFDE = slotInfo.AM.hasExc && slotInfo.PM.hasExc
      && slotInfo.AM.lessonStu === 0 && slotInfo.PM.lessonStu === 0
      && slotInfo.AM.testStu === 0 && slotInfo.PM.testStu === 0;
    const isTestingDay = slotInfo.AM.isTesting || slotInfo.PM.isTesting;

    return {
      ds, dow,
      isFirstArrival: ds === firstArrival,
      isArrival: allArrivalDates.has(ds),
      isTestingDay, isFDE,
      fdeLabel: isFDE ? (slotInfo.AM.topDest || slotInfo.PM.topDest || "Excursion") : null,
      isHDE: !isFDE && (slotInfo.AM.hasExc || slotInfo.PM.hasExc),
      totalStu, arrivingStu: arrStu[ds] || 0,
      AM: slotInfo.AM, PM: slotInfo.PM,
    };
  });
}

// ── Staffing gap calculator ───────────────────────────────────────────────────
function calcStaffingGaps(staffIndex, dayProfiles) {
  const gaps = [];
  dayProfiles.forEach((p) => {
    if (p.isFirstArrival || p.isFDE || p.isArrival) return;
    ["AM", "PM"].forEach((slot) => {
      const needed = p[slot].teachersNeeded;
      if (!needed) return;
      const avail = staffIndex.filter((s) => {
        if (!TEACHING_ROLES.includes(s.role)) return false;
        if (!inRange(p.ds, s.arr, s.dep)) return false;
        if (s.role === "5FTT" && (new Date(p.ds).getDay() === 0 || new Date(p.ds).getDay() === 6)) return false;
        return true;
      }).length;
      const conservativeAvail = Math.floor(avail * 0.8);
      if (conservativeAvail < needed) {
        gaps.push({ ds: p.ds, dow: p.dow, slot, needed, available: avail, shortfall: needed - conservativeAvail });
      }
    });
  });
  return gaps;
}

// ── Skeleton generator (deterministic pre-fill) ──────────────────────────────
function buildSkeleton(staffIndex, dates, groups, dayProfiles) {
  const ng = {};

  const TEACHING = ["TAL", "FTT", "5FTT"];
  const ACTIVITY = ["SAI","AL","EAL","SC","AC","EAC","FOOTBALL","DRAMA","DANCE","LAL","LAC","HP"];
  const MGMT = ["CM", "CD", "EAM", "SWC"];
  const SLOTS = ["AM","PM","Eve"];
  const NO_SESSION = new Set(["Day Off","Induction","Setup","Office","Airport"]);

  const target = (role) => MGMT.includes(role) ? 0 : ["TAL","FTT","5FTT","HP"].includes(role) ? 22 : 24;
  const teachers = staffIndex.filter((s) => TEACHING.includes(s.role));
  const actStaff = staffIndex.filter((s) => ACTIVITY.includes(s.role));
  const mgmt     = staffIndex.filter((s) => MGMT.includes(s.role));
  const allStaff = [...mgmt, ...teachers, ...actStaff];

  const sess = {};
  allStaff.forEach((s) => { sess[s.id] = 0; });

  const put = (sid, ds, slot, val) => {
    const k = `${sid}-${ds}-${slot}`;
    if (ng[k]) return false;
    ng[k] = val;
    if (!NO_SESSION.has(val)) sess[sid] = (sess[sid] || 0) + 1;
    return true;
  };

  const hasRoom  = (s) => { const t = target(s.role); return t === 0 || (sess[s.id] || 0) < t; };
  // Exclude departure day from session assignment (staff are travelling, not working)
  const isOn     = (s, ds) => inRange(ds, s.arr, s.dep) && ds < s.dep;
  const slotFree = (sid, ds) => !ng[`${sid}-${ds}-AM`];
  const avail    = (s, ds) => isOn(s, ds) && slotFree(s.id, ds) && hasRoom(s);

  const gIdx = {};
  allStaff.forEach((s, i) => { gIdx[s.id] = i; });

  // Build profile lookups
  const profileMap = {};
  dayProfiles.forEach((p) => { profileMap[p.ds] = p; });

  const allArrivalDates = new Set((groups || []).map((g) => g.arr).filter(Boolean));
  const groupArrivalDate = [...allArrivalDates].sort()[0] || null;

  const arrStu = {};
  (groups || []).forEach((g) => {
    if (g.arr) arrStu[g.arr] = (arrStu[g.arr] || 0) + (g.stu || 0) + (g.gl || 0);
  });

  // Helpers for parsing time-off
  const parseTimeOff = (toStr) => {
    if (!toStr) return [];
    const yr = new Date(groupArrivalDate || dates[0] || new Date()).getFullYear();
    return toStr.split(",").map((p) => p.trim()).filter(Boolean).map((p) => {
      const rm = p.match(/(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})/);
      if (rm) return { start: yr+"-"+rm[2].padStart(2,"0")+"-"+rm[1].padStart(2,"0"), end: yr+"-"+rm[4].padStart(2,"0")+"-"+rm[3].padStart(2,"0") };
      const sm = p.match(/(\d{1,2})\/(\d{1,2})\s*(am|pm|eve)?/i);
      if (sm) return { date: yr+"-"+sm[2].padStart(2,"0")+"-"+sm[1].padStart(2,"0"), slot: sm[3] || null };
      return null;
    }).filter(Boolean);
  };

  const isFullDayOff = (tos, ds) => {
    for (const to of tos) {
      if (to.start && to.end && ds >= to.start && ds <= to.end) return true;
      if (to.date === ds && !to.slot) return true;
    }
    return false;
  };

  // Pass 1: Fixed per-staff assignments (induction, setup, airport, explicit time-off)
  allStaff.forEach((s) => {
    const tos = parseTimeOff(s.to);
    const onSite = dates.map((d) => ({ date: d, ds: dayKey(d) })).filter(({ ds }) => inRange(ds, s.arr, s.dep));
    if (!onSite.length) return;

    const indDs = onSite[0].ds;
    const indIsWeekend = [0, 6].includes(new Date(indDs).getDay());
    if (s.role === "5FTT" && indIsWeekend) {
      SLOTS.forEach((sl) => { ng[`${s.id}-${indDs}-${sl}`] = "Day Off"; });
    } else {
      ng[`${s.id}-${indDs}-AM`] = "Induction";
      ng[`${s.id}-${indDs}-PM`] = "Induction";
    }

    for (let i = 1; i < onSite.length; i++) {
      const ds = onSite[i].ds;
      if (groupArrivalDate && ds >= groupArrivalDate) break;
      ng[`${s.id}-${ds}-AM`] = "Setup";
      ng[`${s.id}-${ds}-PM`] = "Setup";
    }

    if (s.dep) {
      const depDs = dayKey(new Date(s.dep));
      const depIsWeekend = [0, 6].includes(new Date(depDs).getDay());
      if (!ng[`${s.id}-${depDs}-AM`]) {
        if (s.role === "5FTT" && depIsWeekend) {
          SLOTS.forEach((sl) => { ng[`${s.id}-${depDs}-${sl}`] = "Day Off"; });
        } else {
          ng[`${s.id}-${depDs}-AM`] = "Airport";
        }
      }
    }

    onSite.forEach(({ ds }) => {
      if (isFullDayOff(tos, ds) && !ng[`${s.id}-${ds}-AM`])
        SLOTS.forEach((sl) => { ng[`${s.id}-${ds}-${sl}`] = "Day Off"; });
    });
  });

  // Pass 2: Day offs — 1 per week per staff member
  // Helper: does this staff member already have a Day Off assigned anywhere in the week containing ds?
  const hasWeeklyDayOff = (sid, ds) => {
    const d = new Date(ds);
    const dow = d.getDay();
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const wsKey = dayKey(weekStart), weKey = dayKey(weekEnd);
    return dates.some((x) => {
      const xk = dayKey(x);
      return xk >= wsKey && xk <= weKey && ng[`${sid}-${xk}-AM`] === "Day Off";
    });
  };

  allStaff.forEach((s) => {
    const tos = parseTimeOff(s.to);
    const i = gIdx[s.id] || 0;

    const progDays = dates.map((d) => ({ date: d, ds: dayKey(d) })).filter(({ ds }) => {
      if (!inRange(ds, s.arr, s.dep)) return false;
      const am = ng[`${s.id}-${ds}-AM`];
      return !am || (am !== "Induction" && am !== "Setup" && am !== "Airport" && am !== "Day Off");
    });

    const weeks = Math.ceil(progDays.length / 7);
    for (let w = 0; w < weeks; w++) {
      const wk = progDays.slice(w * 7, w * 7 + 7);
      if (!wk.length) continue;

      let pick = null;
      if (s.role === "5FTT") {
        // 5FTT: day off must fall on a weekday (Mon-Fri) — they don't work weekends anyway
        const pool = wk.filter(({ date, ds }) => {
          const d = date.getDay();
          return d >= 1 && d <= 5 && !isFullDayOff(tos, ds) && !profileMap[ds]?.isFDE;
        });
        if (pool.length) pick = pool[i % pool.length];
      } else if (["FTT"].includes(s.role)) {
        const pool = [
          ...wk.filter(({ ds }) => profileMap[ds]?.isFDE),
          ...wk.filter(({ date }) => date.getDay() === 0 || date.getDay() === 6),
          ...wk,
        ].filter(({ ds }) => !isFullDayOff(tos, ds));
        if (pool.length) pick = pool[i % pool.length];
      } else {
        const basePref = [3, 4, 2, 5, 1, 6, 0];
        const pref = basePref.map((_, j) => basePref[(j + i + w) % basePref.length]);
        for (const pd of pref) {
          const cand = wk.find(({ date, ds }) => {
            if (date.getDay() !== pd) return false;
            if (isFullDayOff(tos, ds)) return false;
            // Bug fix #5: Only avoid day off on FIRST arrival day (not all arrival dates)
            if (ACTIVITY.includes(s.role) && (profileMap[ds]?.isFDE || ds === groupArrivalDate)) return false;
            return true;
          });
          if (cand) { pick = cand; break; }
        }
        if (!pick) pick = wk.find(({ ds }) => !isFullDayOff(tos, ds)) || null;
      }

      if (pick) SLOTS.forEach((sl) => { ng[`${s.id}-${pick.ds}-${sl}`] = "Day Off"; });
    }
  });

  // Pass 3: Programme sessions per day
  const weekNum = (ds) => groupArrivalDate
    ? Math.max(0, Math.floor((new Date(ds) - new Date(groupArrivalDate)) / (7 * 86400000)))
    : 0;

  dates.forEach((d) => {
    const ds = dayKey(d);
    if (!groupArrivalDate || ds < groupArrivalDate) return;
    const p = profileMap[ds] || {};

    mgmt.forEach((s) => {
      if (isOn(s, ds) && !ng[`${s.id}-${ds}-AM`]) {
        ng[`${s.id}-${ds}-AM`] = "Office";
        ng[`${s.id}-${ds}-PM`] = "Office";
      }
    });

    if (p.isFirstArrival) {
      teachers.filter((s) => ["FTT","5FTT"].includes(s.role) && isOn(s, ds) && !ng[`${s.id}-${ds}-AM`])
        .forEach((s) => { if (!hasWeeklyDayOff(s.id, ds)) SLOTS.forEach((sl) => { ng[`${s.id}-${ds}-${sl}`] = "Day Off"; }); });

      const need = Math.max(2, Math.ceil((arrStu[ds] || 0) / 40));
      const pickPool = [...teachers.filter((s) => s.role === "TAL"), ...actStaff].filter((s) => avail(s, ds));
      let pickDone = 0;
      pickPool.forEach((s) => { if (pickDone < need) { put(s.id, ds, "AM", "pickup"); pickDone++; } });

      [...teachers.filter((s) => s.role === "TAL"), ...actStaff]
        .filter((s) => isOn(s, ds) && slotFree(s.id, ds) && ng[`${s.id}-${ds}-AM`] !== "Day Off")
        .forEach((s) => { put(s.id, ds, "AM", "setup"); put(s.id, ds, "PM", "welcome"); });
      return;
    }

    if (p.isArrival) {
      const need = Math.max(1, Math.ceil((arrStu[ds] || 0) / 40));
      const pickPool = [...teachers.filter((s) => s.role === "TAL"), ...actStaff].filter((s) => avail(s, ds));
      let pickDone = 0;
      pickPool.forEach((s) => {
        if (pickDone < need) { put(s.id, ds, "AM", "pickup"); put(s.id, ds, "PM", "welcome"); pickDone++; }
      });
    }

    if (p.isTestingDay) {
      teachers.filter((s) => s.role === "FTT" && avail(s, ds))
        .forEach((s) => { put(s.id, ds, "AM", "Testing"); put(s.id, ds, "PM", "Testing"); });
      // TALs also show "Testing" on testing days (oral/interview component)
      teachers.filter((s) => s.role === "TAL" && avail(s, ds))
        .forEach((s) => { put(s.id, ds, "AM", "Testing"); put(s.id, ds, "PM", "Activities"); });
      actStaff.filter((s) => avail(s, ds))
        .forEach((s) => { put(s.id, ds, "AM", "Activities"); put(s.id, ds, "PM", "Activities"); });
      return;
    }

    if (p.isFDE) {
      const lbl = p.fdeLabel;
      // FTT/5FTT get Day Off on FDE days — but only if they don't already have one this week (from Pass 2)
      teachers.filter((s) => ["FTT","5FTT"].includes(s.role) && isOn(s, ds) && !ng[`${s.id}-${ds}-AM`])
        .forEach((s) => { if (!hasWeeklyDayOff(s.id, ds)) SLOTS.forEach((sl) => { ng[`${s.id}-${ds}-${sl}`] = "Day Off"; }); });

      actStaff.filter((s) => avail(s, ds)).forEach((s) => { put(s.id, ds, "AM", lbl); put(s.id, ds, "PM", lbl); });

      // All available TALs go on the excursion on FDE days (no teaching needed)
      teachers.filter((s) => s.role === "TAL" && avail(s, ds)).forEach((s) => {
        put(s.id, ds, "AM", lbl); put(s.id, ds, "PM", lbl);
      });

      return;
    }

    // Normal weekday
    const amLbl = p.AM?.topDest || (p.AM?.hasExc ? "Excursion" : "Activities");
    const pmLbl = p.PM?.topDest || (p.PM?.hasExc ? "Excursion" : "Activities");
    const amTN  = p.AM?.teachersNeeded || 0;
    const pmTN  = p.PM?.teachersNeeded || 0;
    let amTD = 0, pmTD = 0;

    // Bug fix #1: FTTs only teach when lesson demand exists
    teachers.filter((s) => s.role === "FTT" && avail(s, ds)).forEach((s) => {
      const amVal = amTN > 0 ? "Lessons" : "Activities";
      const pmVal = pmTN > 0 ? "Lessons" : "Activities";
      put(s.id, ds, "AM", amVal); put(s.id, ds, "PM", pmVal);
      if (amTN > 0) amTD++;
      if (pmTN > 0) pmTD++;
    });

    if (d.getDay() >= 1 && d.getDay() <= 5) {
      teachers.filter((s) => s.role === "5FTT" && avail(s, ds)).forEach((s) => {
        const amVal = amTN > 0 ? "Lessons" : "Activities";
        const pmVal = pmTN > 0 ? "Lessons" : "Activities";
        put(s.id, ds, "AM", amVal); put(s.id, ds, "PM", pmVal);
        if (amTN > 0) amTD++;
        if (pmTN > 0) pmTD++;
      });
    }

    teachers.filter((s) => s.role === "TAL" && avail(s, ds)).forEach((s) => {
      const ri = gIdx[s.id] || 0;
      const prefAM = ((ri + weekNum(ds)) % 2 === 0);
      const remAM = amTN - amTD, remPM = pmTN - pmTD;
      const teachAM = remAM > 0 && remPM > 0 ? prefAM : remAM > 0 ? true : remPM > 0 ? false : prefAM;
      if (teachAM) { put(s.id, ds, "AM", "Lessons"); put(s.id, ds, "PM", pmLbl); amTD++; }
      else          { put(s.id, ds, "AM", amLbl);     put(s.id, ds, "PM", "Lessons"); pmTD++; }
    });

    actStaff.filter((s) => avail(s, ds)).forEach((s) => {
      if      (s.role === "FOOTBALL") { put(s.id, ds, "AM", p.AM?.hasExc ? amLbl : "Activities"); put(s.id, ds, "PM", "Football"); }
      else if (s.role === "DRAMA")    { put(s.id, ds, "AM", "Drama"); put(s.id, ds, "PM", p.PM?.hasExc ? pmLbl : "Activities"); }
      else                            { put(s.id, ds, "AM", p.AM?.hasExc ? amLbl : "Activities"); put(s.id, ds, "PM", p.PM?.hasExc ? pmLbl : "Activities"); }
    });
  });

  // Pass 4: Evening sweep — assign real event names, include TAL + activity staff
  const regularEveNames = EVE_ENT_NAMES.filter((n) => n !== "Welcome Ents");
  let eveNameIdx = 0;

  dates.forEach((d) => {
    const ds = dayKey(d);
    if (!groupArrivalDate || ds < groupArrivalDate) return;
    const stu = (groups || []).reduce((sum, g) =>
      inRange(ds, g.arr, g.dep) && ds !== g.dep ? sum + (g.stu || 0) + (g.gl || 0) : sum, 0);
    if (!stu) return;
    const eveTarget = Math.max(2, Math.ceil(stu / 20));

    // Pick event name for this night
    const eventName = ds === groupArrivalDate ? "Welcome Ents" : regularEveNames[eveNameIdx % regularEveNames.length];

    let eveCount = allStaff.filter((s) => { const v = ng[`${s.id}-${ds}-Eve`]; return v && v !== "Day Off"; }).length;

    if (eveCount < eveTarget) {
      const di = dates.findIndex((x) => dayKey(x) === ds);
      // Order: activity staff first (most available), then TALs, exclude mgmt/FTT/5FTT
      const ordered = [...actStaff, ...teachers.filter((s) => s.role === "TAL"), ...mgmt]
        .map((s, idx) => allStaff[(di + idx) % allStaff.length] || s) // rotate start point
        .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i); // dedupe
      // Actually just rotate the combined eligible pool
      const eligible = [...actStaff, ...teachers.filter((s) => s.role === "TAL")];
      const rotated = [...eligible.slice(di % eligible.length), ...eligible.slice(0, di % eligible.length)];

      for (const s of rotated) {
        if (eveCount >= eveTarget) break;
        if (!isOn(s, ds)) continue;
        // Exclude management-only roles and 5FTTs
        if (["CM","CD","EAM","FTT","5FTT"].includes(s.role)) continue;
        const am = ng[`${s.id}-${ds}-AM`];
        const pm = ng[`${s.id}-${ds}-PM`];
        const eve = ng[`${s.id}-${ds}-Eve`];
        if (!am || am === "Day Off" || am === "Induction" || am === "Setup" || am === "pickup") continue;
        const isFullDayExc = am && pm && am === pm && !NO_SESSION.has(am) &&
          !["Lessons","Testing","Int English","Activities","Half Exc"].includes(am);
        // Max 2 counted sessions per day — don't add Eve if AM+PM already fill the quota
        const daySessionCount = [am, pm].filter((v) => v && !NO_SESSION.has(v)).length;
        if (!eve && !isFullDayExc && hasRoom(s) && daySessionCount < 2) {
          ng[`${s.id}-${ds}-Eve`] = eventName;
          sess[s.id] = (sess[s.id] || 0) + 1;
          eveCount++;
        }
      }
    }

    // Advance event name index each night (so names rotate across the programme)
    if (ds !== groupArrivalDate) eveNameIdx++;
  });

  return ng;
}

// ── Session limit enforcer ────────────────────────────────────────────────────
function enforceSessionLimits(grid, staffIndex) {
  const sessCount = {};
  staffIndex.forEach((s) => { sessCount[s.id] = 0; });

  for (const [key, val] of Object.entries(grid)) {
    if (!val || NO_COUNT.has(val)) continue;
    // Bug fix #6: Use startsWith to find staff entry (avoids fragile split logic)
    const staffEntry = staffIndex.find((s) => key.startsWith(s.id + "-"));
    if (staffEntry) sessCount[staffEntry.id]++;
  }

  const sortedKeys = Object.keys(grid).sort().reverse();
  for (const key of sortedKeys) {
    const val = grid[key];
    if (!val || NO_COUNT.has(val)) continue;
    const staffEntry = staffIndex.find((s) => key.startsWith(s.id + "-"));
    if (!staffEntry) continue;
    const target = SESSION_TARGET(staffEntry.role);
    if (target === 0) continue;
    if (sessCount[staffEntry.id] > target) {
      const slot = key.split("-").pop();
      if (slot === "Eve" || slot === "PM") {
        delete grid[key];
        sessCount[staffEntry.id]--;
      }
    }
  }
  return grid;
}

// ── Valid session values (used for output validation) ────────────────────────
function buildKnownDests(progGrid, groups, dates) {
  const dests = new Set();
  (groups || []).forEach((g) => {
    dates.forEach((d) => {
      const ds = dayKey(d);
      ["AM","PM"].forEach((slot) => {
        const val = String(progGrid?.[g.id + "-" + ds + "-" + slot] || "").trim();
        if (val && !/arriv|depart|english\s*test|placement\s*test|lesson|induct/i.test(val)) {
          dests.add(val);
        }
      });
    });
  });
  return dests;
}

const BASE_VALID_SESSIONS = new Set([
  "Lessons","Testing","Int English","Lesson Prep",
  "Activities","Football","Drama","Dance","Half Exc",
  "Excursion","dinner","pickup","welcome","setup",
  "Day Off","Induction","Setup","Office","Airport",
  ...EVE_ENT_NAMES,
]);

function isValidSessionValue(val, knownDests = new Set()) {
  if (!val) return false;
  if (BASE_VALID_SESSIONS.has(val)) return true;
  if (knownDests.has(val)) return true;
  // Reject everything else — strict whitelist prevents AI placeholder text
  return false;
}

function validateAgentOutput(raw, knownDests) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === "string" && isValidSessionValue(val, knownDests)) {
      out[key] = val;
    }
  }
  return out;
}

// ── Extract relevant sections of rotaIntel.md ────────────────────────────────
function extractTALSection(intelDoc) {
  // Extract sections 4.2 (Teaching Roles) and programme type sections
  const sections = [];
  const lines = intelDoc.split("\n");
  let inSection = false;
  let depth = 0;
  for (const line of lines) {
    if (line.match(/^## 2\.|^## 3\.|^### 4\.2|^### 4\.1/)) { inSection = true; depth = 0; }
    if (inSection && line.match(/^## [^23]|^## [0-9]{2}/)) { inSection = false; }
    if (inSection) sections.push(line);
  }
  // Also always include section 11 (generation rules)
  let in11 = false;
  for (const line of lines) {
    if (line.match(/^## 11\./)) in11 = true;
    if (in11 && line.match(/^## 12\./)) break;
    if (in11) sections.push(line);
  }
  return sections.join("\n");
}

function extractEveningSection(intelDoc) {
  const sections = [];
  const lines = intelDoc.split("\n");
  let inSec = false;
  for (const line of lines) {
    if (line.match(/^## 3\.|^## 7\.|^## 9\.|^## 11\./)) inSec = true;
    if (inSec && line.match(/^## [0-9]+\./) && !line.match(/^## 3\.|^## 7\.|^## 9\.|^## 11\./)) inSec = false;
    if (inSec) sections.push(line);
  }
  return sections.join("\n");
}

// ── Agent 1: TAL Slot Planner ─────────────────────────────────────────────────
async function runAgent1TALPlanner(client, staffIndex, dayProfiles, skeleton, groups, knownDests) {
  const talStaff = staffIndex.filter((s) => s.role === "TAL");
  if (!talStaff.length) return {};

  const isZZ = (groups || []).some((g) => g.lessonSlot === "PM");
  const talSystemPrompt = extractTALSection(INTEL_DOC);

  const roleRulesSummary = `
TAL RULES:
- Target: 22 sessions/fortnight
- Can teach: YES (Lessons, Testing, Int English)
- Can do excursions: YES
- Can do Eve Ents: YES (max 4/fortnight)
- Pattern: teach in ONE slot per day, activities/excursion in the OTHER slot. NEVER teach both slots on the same day.
- Prefer consistency: if a TAL teaches AM on Monday, keep them on AM lessons all week unless FDE/day-off breaks it.
${isZZ ? "- This is a ZZ centre: lessons and activities run simultaneously in AM and PM. Each TAL covers ONE slot." : "- This is an NZZ centre: lessons AM, activities PM."}
`.trim();

  // Build unfilled TAL slots from skeleton
  const unfilledByTAL = {};
  talStaff.forEach((s) => {
    const entries = [];
    dayProfiles.forEach((p) => {
      ["AM","PM"].forEach((slot) => {
        const key = `${s.id}-${p.ds}-${slot}`;
        if (!skeleton[key] && !skeleton[`${s.id}-${p.ds}-AM`]) {
          // Day not assigned yet — might need TAL assignment
          entries.push({ date: p.ds, dow: p.dow, slot, dayType: p.isFDE ? "FDE" : p.isArrival ? "ARRIVAL" : p.isTestingDay ? "TESTING" : "NORMAL", amTeachersNeeded: p.AM.teachersNeeded, pmTeachersNeeded: p.PM.teachersNeeded, fdeLabel: p.fdeLabel });
        }
      });
    });
    if (entries.length) unfilledByTAL[s.id] = { name: s.name, entries };
  });

  if (!Object.keys(unfilledByTAL).length) return {};

  const prompt = `
You are Agent 1 — TAL Slot Planner.

${roleRulesSummary}

## SKELETON (already filled — do NOT change these)
${JSON.stringify(Object.fromEntries(Object.entries(skeleton).filter(([k]) => talStaff.some((t) => k.startsWith(t.id + "-")))), null, 0)}

## UNFILLED TAL SLOTS TO DECIDE
For each TAL, decide: teach "Lessons" (or "Int English" on testing days) OR do activities/excursion in each slot.
${JSON.stringify(unfilledByTAL, null, 0)}

## DAY PROFILES (for context)
${dayProfiles.map((p) => `${p.ds} ${p.dow}: ${p.isFDE ? "FDE:"+p.fdeLabel : p.isTestingDay ? "TESTING" : p.isArrival ? "ARRIVAL" : "NORMAL"} | AM need ${p.AM.teachersNeeded} teachers | PM need ${p.PM.teachersNeeded} teachers${p.AM.topDest ? " | AM exc:"+p.AM.topDest : ""}${p.PM.topDest ? " | PM exc:"+p.PM.topDest : ""}`).join("\n")}

## OUTPUT
Return ONLY a JSON object with keys "staffId-date-slot" and values being the assignment.
Allowed values: "Lessons" | "Int English" | "Activities" | "Excursion" | "[destination name]" | "Day Off"
Rules:
- If teaching AM → must do activities/excursion PM (not "Lessons" again)
- If teaching PM → must do activities/excursion AM
- Stay consistent: same slot for lessons across the week
- On FDE days that are NOT already filled: TALs join the excursion (use fdeLabel as value)
- On Day Off days: skip (already in skeleton)
Output JSON starting with "{":`;

  const resp = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 8000,
    system: [{ type: "text", text: talSystemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  });

  const text = resp.content.find((b) => b.type === "text")?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try { return validateAgentOutput(JSON.parse(match[0]), knownDests); } catch { return {}; }
}

// ── Agent 2: Evening, Activities & Excursions Planner ─────────────────────────
async function runAgent2EvePlanner(client, staffIndex, dayProfiles, mergedGrid, groups, knownDests) {
  const eveSystemPrompt = extractEveningSection(INTEL_DOC);

  const eveEntNames = EVE_ENT_NAMES.join(", ");
  const activityRoles = ACTIVITY_ROLES.concat(["TAL"]);

  // Summarise what's unfilled in the Eve column + activity staff gaps
  const eveSummary = [];
  const actSummary = [];

  dayProfiles.forEach((p) => {
    if (!p.totalStu && !p.arrivingStu) return;
    const eveStaffed = staffIndex.filter((s) => {
      const v = mergedGrid[`${s.id}-${p.ds}-Eve`];
      return v && v !== "Day Off";
    }).length;
    const eveNeeded = Math.max(2, Math.ceil((p.totalStu || 0) / 20));
    eveSummary.push({ date: p.ds, dow: p.dow, studentsOnSite: p.totalStu, eveNeeded, eveStaffed, deficit: Math.max(0, eveNeeded - eveStaffed), dayType: p.isFDE ? "FDE" : p.isTestingDay ? "TESTING" : p.isArrival ? "ARRIVAL" : "NORMAL", fdeLabel: p.fdeLabel || null });

    // Activity/dinner gaps
    const needsDinner = !p.isFirstArrival && p.totalStu > 0;
    if (needsDinner) {
      const dinnerAssigned = staffIndex.filter((s) => {
        const pm = mergedGrid[`${s.id}-${p.ds}-PM`];
        const eve = mergedGrid[`${s.id}-${p.ds}-Eve`];
        return pm === "dinner" || eve === "dinner";
      }).length;
      if (dinnerAssigned < 2) actSummary.push({ date: p.ds, dow: p.dow, type: "dinner", need: 2, have: dinnerAssigned });
    }
  });

  // Staff availability summary for Eve
  const staffSummary = staffIndex
    .filter((s) => activityRoles.includes(s.role))
    .map((s) => ({
      id: s.id, name: s.name, role: s.role,
      daysOff: dayProfiles.filter((p) => mergedGrid[`${s.id}-${p.ds}-AM`] === "Day Off").map((p) => p.ds),
      currentEveCount: dayProfiles.filter((p) => { const v = mergedGrid[`${s.id}-${p.ds}-Eve`]; return v && v !== "Day Off"; }).length,
    }));

  const prompt = `
You are Agent 2 — Evening, Activities & Excursions Planner.

ROLE RULES:
- Eligible for Eve Ents: TAL (max 4/fortnight), SAI, AL, EAL, LAL, LAC, SC, AC, HP, FOOTBALL, DRAMA, DANCE
- FTTs do NOT do evenings (except 1-2 per fortnight max — skip for now, skeleton handles it)
- Dinner supervision: SAI, AL, EAL, LAL, LAC, SC, AC, HP only. 2 staff per evening. Rotate fairly.
- Eve Ent names to use (rotate variety): ${eveEntNames}
- Minimum Eve staff = ceil(studentsOnSite / 20), minimum 2

MANDATORY RULES:
1. EVERY night with students on site MUST have at least the required Eve staff count. Empty Eve = FAILURE.
2. EVERY day with students on site needs 2 dinner supervision assignments (in PM or Eve slot).
3. On FDE days, ALL eligible activity staff should be on the excursion already — just ensure Eve is covered.
4. Do NOT assign Eve Ents to staff who already have Eve filled in the skeleton.
5. For dinner: add "dinner" to PM or Eve slot for eligible staff who don't already have those slots filled.

## STAFF AVAILABILITY
${JSON.stringify(staffSummary, null, 0)}

## EVENINGS NEEDING STAFF
${JSON.stringify(eveSummary, null, 0)}

## DINNER GAPS
${JSON.stringify(actSummary, null, 0)}

## CURRENT MERGED GRID (partial — what's already assigned for these staff)
${JSON.stringify(Object.fromEntries(Object.entries(mergedGrid).filter(([k]) => staffSummary.some((s) => k.startsWith(s.id + "-")))), null, 0)}

## OUTPUT
Return ONLY a JSON object with keys "staffId-date-slot" and values being the assignment.
For Eve slots: use Eve Ent names (Disco, Karaoke, Quiz Night, Film Night, etc.) — vary them across nights.
For dinner: use "dinner" as the value.
Only output NEW assignments — do not repeat what's already in the skeleton.
Output JSON starting with "{":`;

  const resp = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 12000,
    system: [{ type: "text", text: eveSystemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  });

  const text = resp.content.find((b) => b.type === "text")?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try { return validateAgentOutput(JSON.parse(match[0]), knownDests); } catch { return {}; }
}

// ── Agent 3: Reviewer ─────────────────────────────────────────────────────────
async function runAgent3Reviewer(client, staffIndex, dayProfiles, mergedGrid, knownDests) {
  const REVIEWER_CONSTRAINTS = `
CONSTRAINT LIST — output a JSON array of violations only. Each fix value MUST be one of the exact strings listed in VALID VALUES below.

VALID VALUES: "Lessons", "Testing", "Activities", "Day Off", "Induction", "Setup", "Office", "Airport", "dinner", "pickup", "welcome", "Excursion", "Half Exc", "Disco", "Karaoke", "Quiz Night", "Film Night", "Talent Show", "Scavenger Hunt", "Flag Ceremony", "Awards Night", "Paparazzi", "Dragons Den", "Trashion Show", "Murder Mystery", "Oscars Night", "Sports Night", "Welcome Ents"

RULES TO CHECK:
1. FTTs must NEVER be assigned excursion destination names on teaching days. Fix: "Day Off" or "Lessons".
2. Activity-only roles (SAI, AL, EAL, SC, AC, EAC, LAL, LAC, FOOTBALL, DRAMA, DANCE, HP) must NEVER have "Lessons" or "Testing". Fix: "Activities".
3. TAL must NEVER have "Lessons" in both AM and PM on the same day. Fix the PM to "Activities".
4. 5FTT must not have non-Day-Off sessions on Saturday or Sunday. Fix: "Day Off".
5. If a staff member has "Day Off" in AM but not PM/Eve on the same day (or vice versa), add "Day Off" to the missing slots.
`.trim();

  // Build a compact summary of the merged grid for review
  const gridSummary = {};
  staffIndex.forEach((s) => {
    const sessions = [];
    let count = 0;
    dayProfiles.forEach((p) => {
      const am = mergedGrid[`${s.id}-${p.ds}-AM`];
      const pm = mergedGrid[`${s.id}-${p.ds}-PM`];
      const eve = mergedGrid[`${s.id}-${p.ds}-Eve`];
      if (am || pm || eve) sessions.push({ date: p.ds, dow: p.dow, AM: am||"", PM: pm||"", Eve: eve||"" });
      if (am && !NO_COUNT.has(am)) count++;
      if (pm && !NO_COUNT.has(pm)) count++;
      if (eve && !NO_COUNT.has(eve)) count++;
    });
    gridSummary[s.id] = { name: s.name, role: s.role, target: SESSION_TARGET(s.role), sessionsCount: count, sessions };
  });

  const prompt = `
You are Agent 3 — Rota Reviewer.

${REVIEWER_CONSTRAINTS}

## GRID TO REVIEW
${JSON.stringify(gridSummary, null, 0)}

## DAY PROFILES (for FDE/testing day context)
${dayProfiles.map((p) => `${p.ds} ${p.dow}: ${p.isFDE ? "FDE" : p.isTestingDay ? "TESTING" : p.isArrival ? "ARRIVAL" : "NORMAL"} | students:${p.totalStu}`).join("\n")}

## OUTPUT
Return ONLY a JSON array of violations (max 20). Each violation:
{"key": "staffId-date-slot", "current": "currentValue", "fix": "correctedValue", "reason": "brief reason"}
If no violations found, return [].
Output JSON array starting with "[":`;

  const resp = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4000,
    system: [{ type: "text", text: REVIEWER_CONSTRAINTS, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  });

  const text = resp.content.find((b) => b.type === "text")?.text || "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const raw = JSON.parse(match[0]);
    // Only keep fixes where the suggested value is a valid session string
    return Array.isArray(raw) ? raw.filter((fix) =>
      fix && fix.key && typeof fix.key === "string" &&
      (fix.fix === "" || fix.fix === null || isValidSessionValue(fix.fix, knownDests))
    ) : [];
  } catch { return []; }
}

// ── Main POST handler with SSE streaming ─────────────────────────────────────
export async function POST(req) {
  const encoder = new TextEncoder();

  const sendEvent = (controller, data) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { staff, groups, progGrid, progStart, progEnd, centreName } = await req.json();

        if (!staff?.length) {
          sendEvent(controller, { error: "No staff provided" });
          controller.close();
          return;
        }
        if (!progStart || !progEnd) {
          sendEvent(controller, { error: "Date range required" });
          controller.close();
          return;
        }

        const dates = genDates(progStart, progEnd);
        const staffIndex = staff.map((s, i) => ({
          i, id: s.id, name: s.name || `Staff ${i}`,
          role: s.role || "SAI", arr: s.arr || progStart, dep: s.dep || progEnd, to: s.to || "",
        }));
        const dayProfiles = buildDayProfiles(dates, groups, progGrid);
        const staffingGaps = calcStaffingGaps(staffIndex, dayProfiles);

        // Build known excursion destinations for output validation
        const knownDests = buildKnownDests(progGrid, groups, dates);

        // Build deterministic skeleton
        const skeleton = buildSkeleton(staffIndex, dates, groups, dayProfiles);

        const client = new Anthropic();

        // Step 1: TAL Slot Planner (fills any TAL gaps the skeleton left)
        sendEvent(controller, { step: 1, message: "Planning TAL slots…" });
        const agent1Result = await runAgent1TALPlanner(client, staffIndex, dayProfiles, skeleton, groups, knownDests);

        // Merge agent 1 into skeleton (only fills empty slots)
        const mergedAfterAgent1 = { ...skeleton };
        for (const [key, val] of Object.entries(agent1Result)) {
          if (val && !mergedAfterAgent1[key]) mergedAfterAgent1[key] = val;
        }

        // Step 2: Evening, Activities & Excursions Planner (top-up eve + dinner gaps)
        sendEvent(controller, { step: 2, message: "Planning evenings and activities…" });
        const agent2Result = await runAgent2EvePlanner(client, staffIndex, dayProfiles, mergedAfterAgent1, groups, knownDests);

        // Merge agent 2 — allow overwriting "Eve Ents" placeholder with real event names
        const mergedAfterAgent2 = { ...mergedAfterAgent1 };
        for (const [key, val] of Object.entries(agent2Result)) {
          const existing = mergedAfterAgent2[key];
          if (val && (!existing || existing === "Eve Ents")) mergedAfterAgent2[key] = val;
        }

        // Step 3: Reviewer
        sendEvent(controller, { step: 3, message: "Reviewing for violations…" });
        const violations = await runAgent3Reviewer(client, staffIndex, dayProfiles, mergedAfterAgent2, knownDests);

        // Apply reviewer fixes (values already pre-validated in runAgent3Reviewer)
        let corrections = 0;
        for (const fix of (violations || [])) {
          if (fix.key && fix.fix !== undefined) {
            if (fix.fix === "" || fix.fix === null) {
              delete mergedAfterAgent2[fix.key];
            } else {
              mergedAfterAgent2[fix.key] = fix.fix;
            }
            corrections++;
          }
        }

        // Filter grid to programme dates only — agents can hallucinate keys outside progStart/progEnd
        const validDateKeys = new Set(dates.map(dayKey));
        for (const key of Object.keys(mergedAfterAgent2)) {
          // Key format: staffId-YYYY-MM-DD-slot
          // Extract date by matching known staff IDs
          const staffEntry = staffIndex.find((s) => key.startsWith(s.id + "-"));
          if (!staffEntry) { delete mergedAfterAgent2[key]; continue; }
          const withoutStaff = key.slice(staffEntry.id.length + 1);
          const dateKey = withoutStaff.slice(0, 10); // YYYY-MM-DD
          if (!validDateKeys.has(dateKey)) delete mergedAfterAgent2[key];
        }

        // Enforce session limits (removes excess Eve/PM sessions from over-target staff)
        enforceSessionLimits(mergedAfterAgent2, staffIndex);

        const suggestions = staffingGaps.map((g) => ({
          ds: g.ds, dow: g.dow, slot: g.slot, needed: g.needed, available: g.available, shortfall: g.shortfall,
        }));

        sendEvent(controller, {
          grid: mergedAfterAgent2,
          suggestions,
          corrections,
        });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (e) {
        console.error("generate-rota error:", e);
        sendEvent(controller, { error: e.message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
