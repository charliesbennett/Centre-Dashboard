"use client";
import { useState, useMemo, useEffect } from "react";
import { SESSION_TYPES, genDates, dayKey, dayName, isWeekend, inRange, fmtDate } from "@/lib/constants";
import { useB } from "@/lib/theme";
import { EVE_ENT_NAMES } from "@/lib/rotaRules";
import { ROLE_RULES, NO_COUNT } from "@/lib/rotaRules";
import { getFortnights, getTodayFortnight } from "@/lib/fortnights";
import { StatCard, IcWand, thStyle, tdStyle, btnPrimary } from "@/components/ui";

const SLOTS = ["AM", "PM", "Eve"];
const CELL_W = 88;
const CELL_H = 52;

function calcRequiredStaff(n) { return n > 0 ? Math.ceil(n / 20) : 0; }

// Which lesson slot does this group have on a given date?
function getGroupLessonSlot(group, dateStr) {
  if (!group.arr || !group.lessonSlot) return group.lessonSlot || "AM";
  const arrDate = new Date(group.arr);
  const curDate = new Date(dateStr);
  const daysSince = Math.floor((curDate - arrDate) / 86400000);
  const weekNum = Math.floor(daysSince / 7);
  return weekNum % 2 === 0 ? group.lessonSlot : (group.lessonSlot === "AM" ? "PM" : "AM");
}

// Get session limit for a role from ROLE_RULES
function getSessionLimit(role) {
  const rule = ROLE_RULES[role];
  if (!rule) return 24;
  if (rule.salaried) return Infinity; // management uncapped
  return rule.target || 24;
}

// Does this cell value count as a session?
function isSession(value) {
  if (!value) return false;
  return !NO_COUNT.has(value);
}

export default function RotaTab({ staff, progStart, progEnd, excDays, groups, rotaGrid, setRotaGrid, progGrid = {}, centreName = "", readOnly = false }) {
  const B = useB();
  const [showRatios, setShowRatios] = useState(true);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiError, setAiError] = useState(null);
  const [staffingSuggestions, setStaffingSuggestions] = useState([]);
  const [reviewerCorrections, setReviewerCorrections] = useState(null);
  const [reviewerDismissed, setReviewerDismissed] = useState(false);
  const grid = rotaGrid;
  const setGrid = setRotaGrid;

  const fortnights = useMemo(() => getFortnights(progStart, progEnd), [progStart, progEnd]);
  const [fortIdx, setFortIdx] = useState(0);
  useEffect(() => {
    setFortIdx(getTodayFortnight(fortnights, dayKey(new Date())));
  }, [fortnights]);
  const selectedFortnight = fortnights[fortIdx] || { start: progStart, end: progEnd };
  const dates = useMemo(
    () => (selectedFortnight.start && selectedFortnight.end) ? genDates(selectedFortnight.start, selectedFortnight.end) : [],
    [selectedFortnight.start, selectedFortnight.end]
  );
  const fortnightStaff = useMemo(() => {
    if (!selectedFortnight.start || !selectedFortnight.end) return staff;
    return staff.filter((s) => s.arr <= selectedFortnight.end && s.dep >= selectedFortnight.start);
  }, [staff, selectedFortnight]);
  const hasRotaData = useMemo(() => Object.values(rotaGrid || {}).some(Boolean), [rotaGrid]);

  const groupArrivalDate = useMemo(() => {
    if (!groups || !groups.length) return null;
    return groups.map((g) => g.arr).filter(Boolean).sort()[0] || null;
  }, [groups]);

  const allArrivalDates = useMemo(() => new Set(groups ? groups.map((g) => g.arr).filter(Boolean) : []), [groups]);

  const parseTimeOff = (toStr) => {
    if (!toStr) return [];
    const yr = new Date(progStart).getFullYear();
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

  // ── Lesson demand per slot per day ────────────────────
  const lessonDemand = useMemo(() => {
    const demand = {};
    if (!groups || !groups.length) return demand;
    dates.forEach((d) => {
      const ds = dayKey(d);
      if (isWeekend(d)) return;
      let amStudents = 0, pmStudents = 0;
      groups.forEach((g) => {
        if (!inRange(ds, g.arr, g.dep)) return;
        if (g.arr && ds === dayKey(new Date(g.arr))) return;
        if (g.dep && ds === dayKey(new Date(g.dep))) return;
        const slot = getGroupLessonSlot(g, ds);
        if (slot === "AM") amStudents += g.stu || 0;
        else pmStudents += g.stu || 0;
      });
      demand[ds] = {
        amStudents, pmStudents,
        amTeachers: Math.ceil(amStudents / 16),
        pmTeachers: Math.ceil(pmStudents / 16),
      };
    });
    return demand;
  }, [groups, dates]);

  // ── Peak teacher adequacy check ───────────────────────
  const teacherAdequacy = useMemo(() => {
    if (!staff || !groups || !dates.length) return null;
    const TEACHING = ["FTT", "TAL", "CD"];
    let peakAM = 0, peakPM = 0;
    Object.values(lessonDemand).forEach((d) => {
      peakAM = Math.max(peakAM, d.amTeachers);
      peakPM = Math.max(peakPM, d.pmTeachers);
    });
    const peakNeeded = Math.max(peakAM, peakPM);
    const teachersOnSite = staff.filter((s) => TEACHING.includes(s.role)).length;
    const typicalAvail = Math.floor(teachersOnSite * 6 / 7);
    if (peakNeeded === 0) return null;
    const shortfall = peakNeeded - typicalAvail;
    return { peakNeeded, teachersOnSite, typicalAvail, shortfall, peakAM, peakPM };
  }, [staff, groups, dates, lessonDemand]);

  // ── Auto-generate ─────────────────────────────────────
  const autoGenerate = () => {
    const ng = {};

    const TEACHING = ["TAL", "FTT", "5FTT"];
    const ACTIVITY = ["SAI", "EAL", "SC", "EAC", "FOOTBALL", "DRAMA", "DANCE", "LAL", "LAC", "HP"];
    const MGMT    = ["CM", "CD", "EAM", "SWC"];
    const NO_SESSION = new Set(["Day Off", "Induction", "Setup", "Office", "Airport", "Welcome", "Pickup", "Departure Duty"]);
    const target = (role) => getSessionLimit(role);

    const teachers = staff.filter((s) => TEACHING.includes(s.role));
    const actStaff = staff.filter((s) => ACTIVITY.includes(s.role));
    const mgmt     = staff.filter((s) => MGMT.includes(s.role));
    const allStaff = [...mgmt, ...teachers, ...actStaff];

    const sess = {};
    allStaff.forEach((s) => { sess[s.id] = 0; });

    const put = (sid, ds, slot, val) => {
      const k = sid + "-" + ds + "-" + slot;
      if (ng[k]) return false;
      ng[k] = val;
      if (!NO_SESSION.has(val)) sess[sid] = (sess[sid] || 0) + 1;
      return true;
    };

    const hasRoom  = (s) => { const t = target(s.role); return t === Infinity || t === 0 || (sess[s.id] || 0) < t; };
    const isOn     = (s, ds) => inRange(ds, s.arr, s.dep) && ds < s.dep;
    const slotFree = (sid, ds) => !ng[sid + "-" + ds + "-AM"];
    const avail    = (s, ds) => isOn(s, ds) && slotFree(s.id, ds) && hasRoom(s);

    const gIdx = {};
    allStaff.forEach((s, i) => { gIdx[s.id] = i; });

    const profiles = {};
    dates.forEach((d) => {
      const ds = dayKey(d);
      const p = { students: 0, isArrival: allArrivalDates.has(ds), isFirstArrival: ds === groupArrivalDate };

      (groups || []).forEach((g) => {
        if (inRange(ds, g.arr, g.dep)) p.students += (g.stu || 0) + (g.gl || 0);
      });

      ["AM", "PM"].forEach((slot) => {
        let lessonStu = 0, testStu = 0;
        const excDests = {};
        (groups || []).forEach((g) => {
          if (!inRange(ds, g.arr, g.dep)) return;
          if (ds === g.arr || ds === g.dep) return;
          const val = String(progGrid[g.id + "-" + ds + "-" + slot] || "").trim();
          const pax = (g.stu || 0) + (g.gl || 0);
          if (val && /english\s*test|placement\s*test/i.test(val)) { testStu += pax; return; }
          if (getGroupLessonSlot(g, ds) === slot) { lessonStu += pax; return; }
          if (val && !/arriv|depart/i.test(val)) excDests[val] = (excDests[val] || 0) + pax;
        });
        const topDest = Object.keys(excDests).sort((a, b) => excDests[b] - excDests[a])[0] || null;
        p[slot] = {
          lessonStu, testStu,
          totalTeachStu: lessonStu + testStu,
          isTesting: testStu > 0,
          hasExc: Object.keys(excDests).length > 0,
          topDest,
          teachersNeeded: Math.ceil((lessonStu + testStu) / 16),
        };
      });

      p.isTestingDay = p.AM.isTesting || p.PM.isTesting;
      p.isFDE  = p.AM.hasExc && p.PM.hasExc && p.AM.lessonStu === 0 && p.PM.lessonStu === 0 && p.AM.testStu === 0 && p.PM.testStu === 0;
      p.isHDE  = !p.isFDE && (p.AM.hasExc || p.PM.hasExc);
      p.fdeLabel = p.isFDE ? (p.AM.topDest || p.PM.topDest || "Excursion") : null;
      profiles[ds] = p;
    });

    const arrStu = {};
    const arrGroups = {};
    (groups || []).forEach((g) => {
      if (g.arr) {
        arrStu[g.arr] = (arrStu[g.arr] || 0) + (g.stu || 0) + (g.gl || 0);
        arrGroups[g.arr] = (arrGroups[g.arr] || 0) + 1;
      }
    });

    // ── Pass 1: Fixed per-staff assignments ───────────────
    allStaff.forEach((s) => {
      const tos = parseTimeOff(s.to);
      const onSite = dates.map((d) => ({ date: d, ds: dayKey(d) })).filter(({ ds }) => inRange(ds, s.arr, s.dep));
      if (!onSite.length) return;

      // First day = Induction (PM only — AM is empty)
      const indDs = onSite[0].ds;
      ng[s.id + "-" + indDs + "-PM"] = "Induction";

      // Days 2..N before first group arrival = Setup
      for (let i = 1; i < onSite.length; i++) {
        const ds = onSite[i].ds;
        if (groupArrivalDate && ds >= groupArrivalDate) break;
        ng[s.id + "-" + ds + "-AM"] = "Setup";
        ng[s.id + "-" + ds + "-PM"] = "Setup";
      }

      // Staff departure day = Airport AM
      if (s.dep) {
        const depDs = dayKey(new Date(s.dep));
        if (!ng[s.id + "-" + depDs + "-AM"]) ng[s.id + "-" + depDs + "-AM"] = "Airport";
      }

      // Explicit time-off full days
      onSite.forEach(({ ds }) => {
        if (isFullDayOff(tos, ds) && !ng[s.id + "-" + ds + "-AM"])
          SLOTS.forEach((sl) => { ng[s.id + "-" + ds + "-" + sl] = "Day Off"; });
      });
    });

    // ── Pass 2: Day offs (1 per week, staggered) ──────────
    allStaff.forEach((s) => {
      if (["5FTT"].includes(s.role)) return;
      const tos = parseTimeOff(s.to);
      const i = gIdx[s.id] || 0;
      const firstOnSite = dates.map((d) => dayKey(d)).find((ds) => inRange(ds, s.arr, s.dep)) || null;

      const progDays = dates.map((d) => ({ date: d, ds: dayKey(d) })).filter(({ ds }) => {
        if (!inRange(ds, s.arr, s.dep)) return false;
        if (ds === firstOnSite) return false; // never Day Off on induction day
        const am = ng[s.id + "-" + ds + "-AM"];
        return !am || (am !== "Induction" && am !== "Setup" && am !== "Airport" && am !== "Day Off");
      });

      const weeks = Math.ceil(progDays.length / 7);
      for (let w = 0; w < weeks; w++) {
        const wk = progDays.slice(w * 7, w * 7 + 7);
        if (!wk.length) continue;

        let pick = null;
        if (["FTT"].includes(s.role)) {
          const pool = [
            ...wk.filter(({ ds }) => profiles[ds]?.isFDE),
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
              if (profiles[ds]?.isFDE || ds === groupArrivalDate) return false;
              return true;
            });
            if (cand) { pick = cand; break; }
          }
          if (!pick) pick = wk.find(({ ds }) => !isFullDayOff(tos, ds) && ds !== groupArrivalDate) || null;
        }

        if (pick) SLOTS.forEach((sl) => { ng[s.id + "-" + pick.ds + "-" + sl] = "Day Off"; });
      }
    });

    // ── Pre-assign Eve duties (before Pass 3 fills daytime slots) ───
    // Staff on Eve duty that day will only get AM in Pass 3 (AM+Eve = 2 sessions, not 3)
    const eveDutyMap = {}; // ds → Set<staffId>
    const eveEligible = staff.filter((s) => !["FTT","5FTT","CM","CD","EAM"].includes(s.role));
    let eeRR = 0;
    dates.forEach((d) => {
      const ds = dayKey(d);
      if (!groupArrivalDate || ds < groupArrivalDate) return;
      const stu = (groups || []).reduce((sum, g) =>
        inRange(ds, g.arr, g.dep) && ds !== g.dep ? sum + (g.stu || 0) + (g.gl || 0) : sum, 0);
      if (!stu) return;
      const eveTarget = Math.max(2, Math.ceil(stu / 20));
      eveDutyMap[ds] = new Set();
      let assigned = 0;
      for (let attempt = 0; attempt < eveEligible.length * 2 && assigned < eveTarget; attempt++) {
        const s = eveEligible[(eeRR + attempt) % eveEligible.length];
        if (!isOn(s, ds)) continue;
        const amNow = ng[s.id + "-" + ds + "-AM"];
        if (amNow === "Day Off" || amNow === "Induction" || amNow === "Setup") continue;
        eveDutyMap[ds].add(s.id);
        assigned++;
      }
      eeRR = (eeRR + eveTarget) % Math.max(1, eveEligible.length);
    });

    // ── Pass 3: Programme sessions per day ────────────────
    const weekNum = (ds) => groupArrivalDate
      ? Math.max(0, Math.floor((new Date(ds) - new Date(groupArrivalDate)) / (7 * 86400000)))
      : 0;

    dates.forEach((d) => {
      const ds = dayKey(d);
      if (!groupArrivalDate || ds < groupArrivalDate) return;
      const p = profiles[ds] || {};

      mgmt.forEach((s) => {
        if (isOn(s, ds) && !ng[s.id + "-" + ds + "-AM"]) {
          ng[s.id + "-" + ds + "-AM"] = "Office";
          // Leave PM free if this person is on Eve duty today (so they can do AM+Eve, not AM+Office+Eve)
          if (!eveDutyMap[ds]?.has(s.id)) ng[s.id + "-" + ds + "-PM"] = "Office";
        }
      });

      // ── First arrival day ────────────────────────────────
      if (p.isFirstArrival) {
        // FTT/5FTT help with Setup and Welcome on arrival day — never Day Off (students are arriving)
        teachers.filter((s) => ["FTT","5FTT"].includes(s.role) && isOn(s, ds) && !ng[s.id+"-"+ds+"-AM"])
          .forEach((s) => { put(s.id, ds, "AM", "Setup"); put(s.id, ds, "PM", "Welcome"); });

        // 1 TAL/activity staff per arriving group
        const numGroups = arrGroups[ds] || 1;
        const pickPool = [...teachers.filter((s) => s.role === "TAL"), ...actStaff].filter((s) => avail(s, ds));
        let pickDone = 0;
        pickPool.forEach((s) => { if (pickDone < numGroups) { put(s.id, ds, "AM", "Pickup"); pickDone++; } });

        [...teachers.filter((s) => s.role === "TAL"), ...actStaff]
          .filter((s) => isOn(s, ds) && slotFree(s.id, ds) && ng[s.id+"-"+ds+"-AM"] !== "Day Off")
          .forEach((s) => { put(s.id, ds, "AM", "Setup"); put(s.id, ds, "PM", "Welcome"); });
        return;
      }

      // ── Subsequent arrival day ────────────────────────────
      if (p.isArrival) {
        const numGroups = arrGroups[ds] || 1;
        const pickPool = [...teachers.filter((s) => s.role === "TAL"), ...actStaff].filter((s) => avail(s, ds));
        let pickDone = 0;
        pickPool.forEach((s) => {
          if (pickDone < numGroups) { put(s.id, ds, "AM", "Pickup"); put(s.id, ds, "PM", "Welcome"); pickDone++; }
        });
      }

      // ── Testing day ──────────────────────────────────────
      if (p.isTestingDay) {
        teachers.filter((s) => s.role === "FTT" && avail(s, ds))
          .forEach((s) => { put(s.id, ds, "AM", "English Test"); put(s.id, ds, "PM", "English Test"); });
        teachers.filter((s) => s.role === "TAL" && avail(s, ds))
          .forEach((s) => { put(s.id, ds, "AM", "English Test"); put(s.id, ds, "PM", "Activities"); });
        actStaff.filter((s) => avail(s, ds))
          .forEach((s) => { put(s.id, ds, "AM", "Activities"); put(s.id, ds, "PM", "Activities"); });
        return;
      }

      // ── Full-day excursion ────────────────────────────────
      if (p.isFDE) {
        const lbl = p.fdeLabel;
        teachers.filter((s) => ["FTT","5FTT"].includes(s.role) && isOn(s, ds) && !ng[s.id+"-"+ds+"-AM"])
          .forEach((s) => SLOTS.forEach((sl) => { ng[s.id+"-"+ds+"-"+sl] = "Day Off"; }));

        actStaff.filter((s) => avail(s, ds)).forEach((s) => { put(s.id, ds, "AM", lbl); put(s.id, ds, "PM", lbl); });

        const talNeed = Math.max(1, Math.ceil((p.students || 0) / 20));
        let talDone = 0;
        teachers.filter((s) => s.role === "TAL" && avail(s, ds)).forEach((s) => {
          if (talDone < talNeed) { put(s.id, ds, "AM", lbl); put(s.id, ds, "PM", lbl); talDone++; }
        });
        return;
      }

      // ── Normal weekday (lessons + optional half-day excursion) ──
      const amLbl = p.AM?.topDest || (p.AM?.hasExc ? "Excursion" : "Activities");
      const pmLbl = p.PM?.topDest || (p.PM?.hasExc ? "Excursion" : "Activities");
      const amTN  = p.AM?.teachersNeeded || 0;
      const pmTN  = p.PM?.teachersNeeded || 0;
      let amTD = 0, pmTD = 0;

      teachers.filter((s) => s.role === "FTT" && avail(s, ds)).forEach((s) => {
        const amVal = amTN > 0 ? "Lessons" : "Activities";
        const pmVal = pmTN > 0 ? "Lessons" : "Activities";
        put(s.id, ds, "AM", amVal); put(s.id, ds, "PM", pmVal);
        if (amTN > 0) amTD++;
        if (pmTN > 0) pmTD++;
      });

      if (d.getDay() >= 1 && d.getDay() <= 5) {
        teachers.filter((s) => s.role === "5FTT" && avail(s, ds)).forEach((s) => {
          put(s.id, ds, "AM", "Lessons"); put(s.id, ds, "PM", "Lessons");
          amTD++; pmTD++;
        });
      }

      teachers.filter((s) => s.role === "TAL" && avail(s, ds)).forEach((s) => {
        const onEveDuty = eveDutyMap[ds]?.has(s.id);
        const ri = gIdx[s.id] || 0;
        const prefAM = ((ri + weekNum(ds)) % 2 === 0);
        const remAM = amTN - amTD, remPM = pmTN - pmTD;
        let teachAM = remAM > 0 && remPM > 0 ? prefAM : remAM > 0 ? true : remPM > 0 ? false : prefAM;
        if (teachAM) { put(s.id, ds, "AM", "Lessons"); if (!onEveDuty) { put(s.id, ds, "PM", pmLbl); } amTD++; }
        else          { put(s.id, ds, "AM", amLbl);     if (!onEveDuty) { put(s.id, ds, "PM", "Lessons"); pmTD++; } }
      });

      actStaff.filter((s) => avail(s, ds)).forEach((s) => {
        const onEveDuty = eveDutyMap[ds]?.has(s.id);
        if      (s.role === "FOOTBALL") { put(s.id, ds, "AM", p.AM.hasExc ? amLbl : "Activities"); if (!onEveDuty) put(s.id, ds, "PM", "Football"); }
        else if (s.role === "PA")       { put(s.id, ds, "AM", "Performing Arts");                    if (!onEveDuty) put(s.id, ds, "PM", p.PM.hasExc ? pmLbl : "Activities"); }
        else                            { put(s.id, ds, "AM", p.AM.hasExc ? amLbl : "Activities"); if (!onEveDuty) put(s.id, ds, "PM", p.PM.hasExc ? pmLbl : "Activities"); }
      });
    });

    // ── Pass 4: Evening assignments ───────────────────────────────────
    // Rule: PM slot must be empty before assigning Eve — never 3 sessions
    dates.forEach((d) => {
      const ds = dayKey(d);
      if (!groupArrivalDate || ds < groupArrivalDate) return;
      const stu = (groups || []).reduce((sum, g) =>
        inRange(ds, g.arr, g.dep) && ds !== g.dep ? sum + (g.stu || 0) + (g.gl || 0) : sum, 0);
      if (!stu) return;
      const eveTarget = Math.max(2, Math.ceil(stu / 20));
      let eveCount = 0;

      // Stage 1: pre-assigned Eve staff (normal weekdays — PM was left free in Pass 3)
      (eveDutyMap[ds] || new Set()).forEach((sid) => {
        const _am = ng[sid + "-" + ds + "-AM"];
        const _pm = ng[sid + "-" + ds + "-PM"];
        // Only skip if BOTH AM and PM are occupied — AM+Eve and PM+Eve are both valid (max 2 slots)
        if (!(_am && _pm) && !ng[sid + "-" + ds + "-Eve"]) {
          ng[sid + "-" + ds + "-Eve"] = "Eve Activity";
          sess[sid] = (sess[sid] || 0) + 1;
          eveCount++;
        }
      });

      // Stage 2: fallback sweep for special days (testing/FDE/arrival) where
      // pre-assigned staff both slots were filled — find anyone with at least one free daytime slot
      if (eveCount < eveTarget) {
        const eligible = staff.filter((s) => !["FTT","5FTT","CM","CD","EAM"].includes(s.role));
        const di = dates.findIndex((x) => dayKey(x) === ds);
        const ordered = [...eligible.slice(di % eligible.length), ...eligible.slice(0, di % eligible.length)];
        for (const s of ordered) {
          if (eveCount >= eveTarget) break;
          if (!isOn(s, ds)) continue;
          const am = ng[s.id + "-" + ds + "-AM"];
          const pm = ng[s.id + "-" + ds + "-PM"];
          if (!am || am === "Day Off" || am === "Induction" || am === "Setup") continue;
          if (am && pm) continue; // both slots occupied — adding Eve would make 3 (never allowed)
          if (!ng[s.id + "-" + ds + "-Eve"] && hasRoom(s)) {
            ng[s.id + "-" + ds + "-Eve"] = "Eve Activity";
            sess[s.id] = (sess[s.id] || 0) + 1;
            eveCount++;
          }
        }
      }
    });

    setGrid(ng);
  };

  // ── AI rota generation ────────────────────────────────
  const aiGenerate = async () => {
    const hasData = Object.values(rotaGrid).some((v) => v);
    if (hasData && !window.confirm("AI generate will overwrite all existing rota entries. Continue?")) return;
    setAiGenerating(true);
    setAiProgress(1);
    setAiError(null);
    setReviewerCorrections(null);
    setReviewerDismissed(false);
    try {
      const res = await fetch("/api/generate-rota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff, groups, progGrid, progStart, progEnd, centreName }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream")) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalData = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const payload = line.slice(6).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const msg = JSON.parse(payload);
                if (msg.step) setAiProgress(msg.step);
                if (msg.error) throw new Error(msg.error);
                if (msg.grid) finalData = msg;
              } catch (parseErr) {
                if (parseErr.message && parseErr.message !== "Unexpected token") throw parseErr;
              }
            }
          }
        }
        if (!finalData) throw new Error("No grid data received from generation pipeline");
        setGrid(finalData.grid);
        setStaffingSuggestions(finalData.suggestions || []);
        if (typeof finalData.corrections === "number") setReviewerCorrections(finalData.corrections);
      } else {
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Generation failed");
        setGrid(data.grid);
        setStaffingSuggestions(data.suggestions || []);
        if (typeof data.corrections === "number") setReviewerCorrections(data.corrections);
      }
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiGenerating(false);
      setAiProgress(0);
    }
  };

  // ── Double-click to edit ──────────────────────────────
  const startEdit = (key, val) => { setEditingCell(key); setEditValue(val || ""); };
  const commitEdit = () => {
    if (editingCell) {
      setGrid((prev) => {
        const nv = editValue.trim();
        if (!nv) { const n = {...prev}; delete n[editingCell]; return n; }
        return { ...prev, [editingCell]: nv };
      });
      setEditingCell(null);
    }
  };

  // Single click cycle
  const allTypes = [...Object.keys(SESSION_TYPES), "Day Off"];
  const cycleCell = (sid, ds, sl) => {
    const key = sid+"-"+ds+"-"+sl;
    setGrid((prev) => {
      const cur = prev[key];
      if (!cur) return { ...prev, [key]: allTypes[0] };
      const idx = allTypes.indexOf(cur);
      if (idx >= allTypes.length - 1) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: allTypes[idx + 1] };
    });
  };

  // ── Session + day-off stats ───────────────────────────
  // Uses NO_COUNT from rotaRules for accurate session counting
  const getStats = (sid) => {
    let sess = 0, offs = 0;
    dates.forEach((d) => {
      const ds = dayKey(d);
      let allOff = true;
      SLOTS.forEach((sl) => {
        const v = grid[sid+"-"+ds+"-"+sl];
        if (v && isSession(v)) sess++;
        if (v && v !== "Day Off") allOff = false;
      });
      // Count as a day off only if AM and PM are both Day Off
      const am = grid[sid+"-"+ds+"-AM"];
      const pm = grid[sid+"-"+ds+"-PM"];
      if (am === "Day Off" && pm === "Day Off") offs++;
    });
    return { sess, offs };
  };

  // Ratios
  const ratioData = useMemo(() => {
    if (!groups || !groups.length) return {};
    const data = {};
    dates.forEach((d) => {
      const ds = dayKey(d);
      let stu = 0, gls = 0;
      groups.forEach((g) => {
        if (!inRange(ds, g.arr, g.dep)) return;
        if (g.arr && ds === dayKey(new Date(g.arr))) return;
        if (g.dep && ds === dayKey(new Date(g.dep))) return;
        stu += g.stu || 0; gls += g.gl || 0;
      });
      if (stu > 0) data[ds] = { students: stu, gls, required: calcRequiredStaff(stu) };
    });
    return data;
  }, [groups, dates]);

  const getStaffWorking = (ds, sl) => {
    let c = 0;
    staff.forEach((s) => {
      const v = grid[s.id+"-"+ds+"-"+sl];
      if (v && v !== "Day Off" && v !== "Induction" && v !== "Setup") c++;
    });
    return c;
  };

  const ratioAlerts = useMemo(() => {
    if (!groups || !groups.length) return [];
    const a = [];
    dates.forEach((d) => {
      const ds = dayKey(d); const rd = ratioData[ds];
      if (!rd) return;
      SLOTS.forEach((sl) => {
        const sw = getStaffWorking(ds, sl);
        const tot = sw + rd.gls;
        const short = rd.required - tot;
        if (short > 0) a.push({ date: ds, slot: sl, students: rd.students, staffWorking: sw, gls: rd.gls, total: tot, required: rd.required, shortfall: short });
      });
    });
    return a;
  }, [grid, ratioData, dates, groups]);

  const cellColor = (v, slot = "AM") => {
    if (!v) return null;
    if (v === "Day Off") return "#f59e0b";
    if (SESSION_TYPES[v]) return SESSION_TYPES[v];
    const vl = v.toLowerCase();
    if (vl.includes("lesson") || vl.includes("english test") || vl.includes("testing") || vl.includes("int english") || vl.includes("int eng")) return SESSION_TYPES["Lessons"];
    if (vl.includes("eve activity") || vl.includes("evening activity") || vl.includes("eve ent") || vl.includes("disco") || vl.includes("bbq") || vl.includes("quiz") || vl.includes("karaoke") || vl.includes("film") || vl.includes("talent") || vl.includes("scav")) return SESSION_TYPES["Eve Ents"];
    if (vl.includes("excursion")) return SESSION_TYPES["Excursion"];
    if (vl.includes("act") || vl.includes("multi")) return SESSION_TYPES["Activities"];
    if (vl.includes("half exc")) return SESSION_TYPES["Half Exc"];
    if (vl === "office") return "#94a3b8";
    if (vl === "pickup" || vl === "welcome" || vl === "setup" || vl === "departure duty") return SESSION_TYPES["Setup"];
    if (vl === "football") return "#16a34a";
    if (vl === "performing arts" || vl === "pa" || vl === "drama" || vl === "dance") return "#9333ea";
    return slot === "Eve" ? SESSION_TYPES["Eve Ents"] : SESSION_TYPES["Excursion"];
  };

  const tableMinWidth = 272 + dates.length * (CELL_W * 3 + 6);
  const CHROME = 120;

  return (
    <div style={{ height: `calc(100vh - ${CHROME}px)`, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Top controls bar ─────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: "8px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: `1px solid ${B.border}`, background: B.card }}>
        <StatCard label="Staff" value={staff.length} accent={B.navy} />
        <StatCard label="Days" value={dates.length} accent={B.textMuted} />
        <StatCard label="TALs" value={staff.filter((s) => s.role === "TAL").length} accent="#3b82f6" />
        <StatCard label="FTTs" value={staff.filter((s) => s.role === "FTT").length} accent="#0891b2" />
        <StatCard label="ALs" value={staff.filter((s) => s.role === "AL").length} accent="#8b5cf6" />
        <StatCard label="SAIs" value={staff.filter((s) => s.role === "SAI").length} accent="#ec4899" />
        {groupArrivalDate && <span style={{ fontSize: 9, color: B.textMuted }}>Students arrive: <strong style={{ color: B.text }}>{fmtDate(groupArrivalDate)}</strong></span>}
        {teacherAdequacy && teacherAdequacy.shortfall > 0 && (
          <span style={{ fontSize: 9, background: B.warningBg, color: B.warning, border: `1px solid #fcd34d`, borderRadius: 5, padding: "3px 8px", fontWeight: 700 }}>
            ⚠️ Need {teacherAdequacy.peakNeeded} teachers/slot (peak) — {teacherAdequacy.typicalAvail} typically available — add {teacherAdequacy.shortfall} more TAL/FTT
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => setShowRatios(!showRatios)} style={{ padding: "5px 12px", borderRadius: 5, fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", border: "1px solid "+(showRatios ? B.navy : B.border), background: showRatios ? B.navy : B.card, color: showRatios ? B.white : B.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
            Ratios {ratioAlerts.length > 0 && <span style={{ background: B.danger, color: B.white, borderRadius: 8, padding: "1px 5px", fontSize: 8 }}>{ratioAlerts.length}</span>}
          </button>
          {!readOnly && <button onClick={() => {
            const hasData = Object.values(rotaGrid).some((v) => v);
            if (hasData && !window.confirm("Auto-generate will overwrite all existing rota entries. Continue?")) return;
            autoGenerate();
          }} style={{ ...btnPrimary, background: B.navy }}><IcWand /> {hasRotaData ? "Re-generate" : "Auto-Generate"}</button>}
          {!readOnly && <button onClick={aiGenerate} disabled={aiGenerating} style={{ ...btnPrimary, background: aiGenerating ? B.textMuted : B.red, opacity: aiGenerating ? 0.7 : 1, cursor: aiGenerating ? "not-allowed" : "pointer" }}>
            <IcWand /> AI Generate
          </button>}
        </div>
      </div>

      {/* ── AI status strip ──────────────────────────────── */}
      {(aiGenerating || aiError) && (
        <div style={{ flexShrink: 0, padding: "6px 16px", background: aiError ? B.dangerBg : B.cyanBg, borderBottom: `1px solid ${aiError ? B.danger+"44" : B.border}`, fontSize: 10, color: aiError ? B.danger : B.cyan, fontWeight: 600 }}>
          {aiGenerating && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span>Claude is generating your rota…</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {[
                  { step: 1, label: "1/3 Planning TAL slots" },
                  { step: 2, label: "2/3 Evening entertainment" },
                  { step: 3, label: "3/3 Reviewing" },
                ].map(({ step, label }) => {
                  const done = aiProgress > step;
                  const active = aiProgress === step;
                  return (
                    <span key={step} style={{
                      padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 700,
                      background: done ? B.success + "25" : active ? B.cyanBg : B.bg,
                      color: done ? B.success : active ? B.cyan : B.textMuted,
                      border: `1px solid ${done ? B.success : active ? B.cyan : B.border}`,
                    }}>
                      {done ? "✓ " : active ? "⏳ " : ""}{label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {aiError && `AI generation failed: ${aiError}`}
        </div>
      )}

      {/* ── Reviewer corrections panel ───────────────────── */}
      {reviewerCorrections !== null && !reviewerDismissed && (
        <div style={{ flexShrink: 0, padding: "6px 16px", background: B.successBg, borderBottom: `1px solid ${B.border}`, fontSize: 10, color: B.success, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{reviewerCorrections === 0 ? "Reviewer found no issues — rota looks clean." : `Reviewer auto-corrected ${reviewerCorrections} issue${reviewerCorrections === 1 ? "" : "s"} in the generated rota.`}</span>
          <button onClick={() => setReviewerDismissed(true)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#15803d", fontSize: 12, fontWeight: 800, padding: "0 4px" }}>x</button>
        </div>
      )}

      {/* ── Staffing adequacy suggestions ────────────────── */}
      {staffingSuggestions.length > 0 && (
        <div style={{ flexShrink: 0, padding: "6px 16px", background: B.warningBg, borderBottom: `1px solid ${B.border}`, fontSize: 9, color: B.warning }}>
          <strong style={{ fontSize: 10 }}>⚠️ Staffing gaps detected — consider adding staff:</strong>
          {(() => {
            const amShort = staffingSuggestions.filter((s) => s.slot === "AM").reduce((m, s) => Math.max(m, s.shortfall), 0);
            const pmShort = staffingSuggestions.filter((s) => s.slot === "PM").reduce((m, s) => Math.max(m, s.shortfall), 0);
            const maxShort = Math.max(amShort, pmShort);
            return (
              <span style={{ marginLeft: 8 }}>
                You may need <strong>{maxShort} more TAL or FTT</strong> to cover all lesson slots.
                Affected days: {[...new Set(staffingSuggestions.map((s) => s.dow + " " + fmtDate(s.ds)))].slice(0, 5).join(", ")}
                {staffingSuggestions.length > 5 ? " + more" : ""}
              </span>
            );
          })()}
        </div>
      )}

      {/* ── Inline alerts / info strip ───────────────────── */}
      {(hasRotaData || showRatios) && (
        <div style={{ flexShrink: 0, borderBottom: `1px solid ${B.border}` }}>
          {hasRotaData && groups && groups.length > 0 && (
            <div style={{ padding: "4px 16px", background: B.cyanBg, fontSize: 9, color: B.cyan, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>Lesson slots (Wk1):</span>
              {groups.map((g) => (
                <span key={g.id}><strong>{g.group}</strong>: {g.lessonSlot || "AM"} ({g.stu} stu)</span>
              ))}
              <span style={{ color: "#64748b" }}>· Set in Students tab · Auto-flips weekly</span>
            </div>
          )}
          {showRatios && (
            <div style={{ padding: "4px 16px" }}>
              {groups && groups.length > 0 ? (
                ratioAlerts.length > 0 ? (
                  <div style={{ background: B.dangerBg, border: "1px solid #fca5a5", borderRadius: 6, padding: "6px 12px", display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 10, color: B.danger, whiteSpace: "nowrap" }}>Shortfalls ({ratioAlerts.length})</span>
                    {ratioAlerts.slice(0, 5).map((a, i) => (
                      <span key={i} style={{ fontSize: 9, color: "#991b1b" }}>
                        <strong>{fmtDate(a.date)}</strong> {a.slot}: {a.total}/{a.required} (need {a.shortfall} more)
                      </span>
                    ))}
                    {ratioAlerts.length > 5 && <span style={{ fontSize: 9, color: "#991b1b" }}>+{ratioAlerts.length - 5} more</span>}
                  </div>
                ) : (
                  <div style={{ fontSize: 10, fontWeight: 700, color: B.success }}>All sessions meet safeguarding ratios</div>
                )
              ) : (
                <div style={{ fontSize: 10, color: "#0369a1" }}>Import groups in Students tab to see ratio checks</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Legend ───────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: "3px 16px 4px", display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center", background: B.bg, borderBottom: `1px solid ${B.border}` }}>
        {Object.entries(SESSION_TYPES).map(([n, c]) => (
          <span key={n} style={{ background: c+"20", color: c, padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>{n}</span>
        ))}
        <span style={{ background: "#f59e0b20", color: "#f59e0b", padding: "2px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700 }}>Day Off</span>
        <span style={{ fontSize: 8, color: B.textMuted, marginLeft: 6 }}>Click = cycle · Double-click = edit</span>
      </div>

      {/* ── Fortnight selector ───────────────────────────── */}
      {fortnights.length > 1 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "6px 16px", borderBottom: `1px solid ${B.border}`, background: B.card, flexShrink: 0 }}>
          {fortnights.map((fn, i) => (
            <button
              key={fn.label}
              onClick={() => setFortIdx(i)}
              style={{
                padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                fontFamily: "inherit", cursor: "pointer",
                border: `1px solid ${i === fortIdx ? B.navy : B.border}`,
                background: i === fortIdx ? B.navy : B.card,
                color: i === fortIdx ? B.white : B.textMuted,
              }}
            >
              {fn.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Scrollable table ─────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 10, minWidth: tableMinWidth, background: B.card }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 52, position: "sticky", left: 0, zIndex: 3 }}>Role</th>
              <th style={{ ...thStyle, width: 140, position: "sticky", left: 52, zIndex: 3 }}>Name</th>
              <th style={{ ...thStyle, width: 44, textAlign: "center", position: "sticky", left: 192, zIndex: 3, fontSize: 9 }}>Sess</th>
              <th style={{ ...thStyle, width: 36, textAlign: "center", position: "sticky", left: 236, zIndex: 3, fontSize: 9 }}>Off</th>
              {dates.map((d) => {
                const we = isWeekend(d); const ds = dayKey(d); const exc = excDays && excDays[ds];
                const isArr = allArrivalDates.has(ds);
                const dem = lessonDemand[ds];
                return (
                  <th key={ds} colSpan={3} style={{ ...thStyle, textAlign: "center", borderLeft: "2px solid rgba(255,255,255,0.2)", padding: "4px 2px", minWidth: CELL_W*3+4, background: isArr ? "#166534" : exc ? "#92400e" : we ? "#7f1d1d" : B.navy }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{fmtDate(d)}</div>
                    <div style={{ fontWeight: 900, fontSize: 13, color: B.white, letterSpacing: 0.5 }}>{dayName(d)}</div>
                    {exc && <div style={{ fontSize: 8, color: B.yellow, fontWeight: 800 }}>{exc === "Full" ? "Full Day Exc" : "Half Day Exc"}</div>}
                    {isArr && <div style={{ fontSize: 8, color: "#86efac", fontWeight: 800 }}>ARRIVAL</div>}
                    {dem && !we && <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)" }}>{dem.amStudents>0?"AM:"+dem.amStudents:""}{dem.amStudents>0&&dem.pmStudents>0?" · ":""}{dem.pmStudents>0?"PM:"+dem.pmStudents:""}</div>}
                  </th>
                );
              })}
            </tr>
            <tr>
              <th style={{ ...thStyle, position: "sticky", left: 0, zIndex: 3 }}></th>
              <th style={{ ...thStyle, position: "sticky", left: 52, zIndex: 3 }}></th>
              <th style={{ ...thStyle, position: "sticky", left: 192, zIndex: 3 }}></th>
              <th style={{ ...thStyle, position: "sticky", left: 236, zIndex: 3 }}></th>
              {dates.map((d) => SLOTS.map((sl) => (
                <th key={dayKey(d)+"-"+sl} style={{ ...thStyle, textAlign: "center", fontSize: 9, padding: "4px 0", borderLeft: sl === "AM" ? "2px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.1)", minWidth: CELL_W }}>{sl}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {hasRotaData && groups && groups.length > 0 && (
              <tr style={{ borderBottom: "2px solid "+B.border, background: B.successBg }}>
                <td style={{ ...tdStyle, position: "sticky", left: 0, zIndex: 1, background: B.successBg, fontSize: 9, fontWeight: 800, color: B.success }}>Ratio</td>
                <td style={{ ...tdStyle, position: "sticky", left: 52, zIndex: 1, background: B.successBg, fontSize: 10, fontWeight: 700, color: B.text }}>Staff+GL / Need</td>
                <td style={{ ...tdStyle, position: "sticky", left: 192, zIndex: 1, background: B.successBg }}></td>
                <td style={{ ...tdStyle, position: "sticky", left: 236, zIndex: 1, background: B.successBg }}></td>
                {dates.map((d) => {
                  const ds = dayKey(d); const rd = ratioData[ds];
                  return SLOTS.map((sl) => {
                    if (!rd) return <td key={ds+"-"+sl} style={{ padding: "1px", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight, background: B.successBg }}><div style={{ height: 20 }} /></td>;
                    const sw = getStaffWorking(ds, sl);
                    const tot = sw + rd.gls;
                    const ok = tot >= rd.required;
                    return (
                      <td key={ds+"-"+sl} style={{ padding: "2px", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight, textAlign: "center", background: ok ? B.successBg : B.dangerBg }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: ok ? B.success : B.danger, lineHeight: 1 }}>{tot}/{rd.required}</div>
                        <div style={{ fontSize: 9, color: B.textMuted }}>{rd.students}s</div>
                      </td>
                    );
                  });
                })}
              </tr>
            )}
            {fortnightStaff.length === 0 ? (
              <tr><td colSpan={4 + dates.length * 3} style={{ textAlign: "center", padding: 36, color: B.textLight }}>{staff.length === 0 ? "Add staff in Team tab, then Auto-Generate" : "No staff on site during this fortnight"}</td></tr>
            ) : fortnightStaff.map((s) => {
              const st = getStats(s.id);
              const limit = getSessionLimit(s.role);
              const over = limit !== Infinity && limit > 0 && st.sess > limit;

              return (
                <tr key={s.id} style={{ borderBottom: "1px solid "+B.borderLight }}>
                  <td style={{ ...tdStyle, position: "sticky", left: 0, background: B.card, zIndex: 1 }}>
                    <span style={{ background: B.cyanBg, color: B.link, padding: "3px 7px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>{s.role}</span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: B.text, fontSize: 12, position: "sticky", left: 52, background: B.card, zIndex: 1, whiteSpace: "nowrap" }}>{s.name}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, fontSize: 12, position: "sticky", left: 192, background: B.card, zIndex: 1, color: over ? B.danger : B.text }}>
                    {st.sess}{limit !== Infinity && limit > 0 ? `/${limit}` : ""}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, fontSize: 12, position: "sticky", left: 236, background: B.card, zIndex: 1, color: st.offs > 0 ? "#f59e0b" : B.textLight }}>{st.offs}</td>
                  {dates.map((d) => {
                    const ds = dayKey(d); const on = inRange(ds, s.arr, s.dep);
                    return SLOTS.map((sl) => {
                      const key = s.id+"-"+ds+"-"+sl;
                      const v = grid[key];
                      const off = v === "Day Off";
                      const col = cellColor(v, sl);
                      const isEd = editingCell === key;
                      return (
                        <td key={key}
                          onClick={() => !readOnly && on && !isEd && cycleCell(s.id, ds, sl)}
                          onDoubleClick={(e) => { e.preventDefault(); if (!readOnly && on) startEdit(key, v); }}
                          style={{
                            padding: "1px", borderLeft: sl === "AM" ? "2px solid "+B.border : "1px solid "+B.borderLight,
                            textAlign: "center", cursor: on ? "pointer" : "default",
                            minWidth: CELL_W, background: !on ? "#f5f5f5" : off ? "#f59e0b10" : "transparent",
                          }}>
                          {isEd ? (
                            <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit} onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                              style={{ width: "100%", fontSize: 10, padding: "4px", border: "1px solid "+B.navy, borderRadius: 3, fontFamily: "inherit", height: CELL_H }} />
                          ) : col ? (
                            <div style={{ background: col+"25", color: col, borderRadius: 4, fontSize: 10, fontWeight: 800, height: CELL_H, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", textAlign: "center", lineHeight: 1.2 }} title={v}>
                              {off ? "Day Off" : v}
                            </div>
                          ) : on ? <div style={{ height: CELL_H }} /> : <div style={{ height: CELL_H, background: "#f0f0f0", borderRadius: 3 }} />}
                        </td>
                      );
                    });
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
