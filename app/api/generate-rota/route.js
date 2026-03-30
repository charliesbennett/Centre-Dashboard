export const maxDuration = 60;

// ── Utilities ─────────────────────────────────────────────────────────────────
function genDates(start, end) {
  const dates = [];
  for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1))
    dates.push(new Date(d));
  return dates;
}
function dayKey(d) { return d.toISOString().split("T")[0]; }
function dayName(d) { return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]; }
function isWeekend(d) { return d.getDay() === 0 || d.getDay() === 6; }
function inRange(ds, arr, dep) { return !!(arr && dep && ds >= arr && ds <= dep); }
function getGroupLessonSlot(g, ds) {
  if (!g.arr || !g.lessonSlot) return g.lessonSlot || "AM";
  const daysSince = Math.floor((new Date(ds) - new Date(g.arr)) / 86400000);
  return Math.floor(daysSince / 7) % 2 === 0
    ? g.lessonSlot
    : (g.lessonSlot === "AM" ? "PM" : "AM");
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SESSION_TARGET = (role) => {
  if (["CM","CD","EAM","SWC"].includes(role)) return 0;
  if (role === "5FTT") return 20;
  if (["TAL","FTT","HP"].includes(role)) return 22;
  return 24; // SAI, AL, EAL, SC, AC, EAC, LAL, LAC, FOOTBALL, DRAMA, DANCE
};

// Values that do NOT count as sessions (within this scheduler)
// Note: "Evening Activity" is treated as non-restrictive here so it can always be
// assigned regardless of session cap. The frontend (rotaRules.js) still counts it
// in the session total shown to managers.
const NO_COUNT = new Set([
  "Day Off","Induction","Setup","Office","Airport",
  "pickup","welcome","setup","dinner",
  "Evening Activity",
]);

const TEACHING_ROLES  = ["FTT","5FTT","TAL"];
const ACTIVITY_ROLES  = ["SAI","AL","EAL","SC","AC","EAC","LAL","LAC","FOOTBALL","DRAMA","DANCE","HP"];
const MGMT_ROLES      = ["CM","CD","EAM","SWC"];
const EVE_ELIGIBLE    = new Set(["TAL","SAI","AL","EAL","SC","AC","EAC","LAL","LAC","FOOTBALL","DRAMA","DANCE","HP"]);

// ── Day profile builder ───────────────────────────────────────────────────────
// KEY FIX: if the programme grid has an explicit value for a slot, trust it as
// an excursion destination — do NOT override it with the lesson-slot calculation.
function buildDayProfiles(dates, groups, progGrid) {
  const allArrivalDates = new Set((groups || []).map(g => g.arr).filter(Boolean));
  const firstArrival    = [...allArrivalDates].sort()[0] || null;
  const arrStu = {};
  (groups || []).forEach(g => {
    if (g.arr) arrStu[g.arr] = (arrStu[g.arr] || 0) + (g.stu || 0) + (g.gl || 0);
  });

  return dates.map(d => {
    const ds  = dayKey(d);
    let totalStu = 0;
    (groups || []).forEach(g => {
      if (inRange(ds, g.arr, g.dep)) totalStu += (g.stu || 0) + (g.gl || 0);
    });

    const slotInfo = {};
    ["AM","PM"].forEach(slot => {
      let lessonStu = 0, testStu = 0;
      const excDests = {};

      (groups || []).forEach(g => {
        if (!inRange(ds, g.arr, g.dep)) return;
        if (ds === g.arr || ds === g.dep) return; // skip arrival/departure day for that group

        const val = String(progGrid?.[g.id + "-" + ds + "-" + slot] || "").trim();
        const pax = (g.stu || 0) + (g.gl || 0);

        // 1. Testing takes priority
        if (val && /english\s*test|placement\s*test/i.test(val)) {
          testStu += pax; return;
        }
        // 2. Lesson-type values in programme grid → count as lessons
        if (val && /^(english\s+lessons?|lessons?|classes?)$/i.test(val)) {
          lessonStu += pax; return;
        }
        // 3. Explicit programme grid entry → excursion (trust the programme)
        if (val && !/arriv|depart/i.test(val)) {
          excDests[val] = (excDests[val] || 0) + pax; return;
        }
        // 4. No explicit entry → fall back to lesson-slot calculation (no lessons on Sundays)
        if (!val && d.getDay() !== 0 && getGroupLessonSlot(g, ds) === slot) {
          lessonStu += pax;
        }
      });

      const sortedDests = Object.keys(excDests).sort((a, b) => excDests[b] - excDests[a]);
      slotInfo[slot] = {
        lessonStu, testStu,
        isTesting: testStu > 0,
        hasExc: sortedDests.length > 0,
        topDest: sortedDests[0] || null,
        teachersNeeded: Math.ceil((lessonStu + testStu) / 16),
        excSummary: sortedDests.length > 0
          ? sortedDests.map(dest => `${dest}(${excDests[dest]}stu)`).join(", ")
          : null,
      };
    });

    const isFDE = slotInfo.AM.hasExc && slotInfo.PM.hasExc
      && slotInfo.AM.lessonStu === 0 && slotInfo.PM.lessonStu === 0
      && slotInfo.AM.testStu === 0 && slotInfo.PM.testStu === 0;

    return {
      ds, dow: dayName(d),
      isFirstArrival: ds === firstArrival,
      isArrival: allArrivalDates.has(ds),
      isTestingDay: slotInfo.AM.isTesting || slotInfo.PM.isTesting,
      isFDE,
      fdeLabel: isFDE ? (slotInfo.AM.topDest || slotInfo.PM.topDest || "Excursion") : null,
      isHDE: !isFDE && (slotInfo.AM.hasExc || slotInfo.PM.hasExc),
      totalStu, arrivingStu: arrStu[ds] || 0,
      AM: slotInfo.AM, PM: slotInfo.PM,
    };
  });
}

// ── Time-off helpers ──────────────────────────────────────────────────────────
function parseTimeOff(toStr, refYear) {
  if (!toStr) return [];
  return toStr.split(",").map(p => p.trim()).filter(Boolean).map(p => {
    const rm = p.match(/(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})/);
    if (rm) return {
      start: `${refYear}-${rm[2].padStart(2,"0")}-${rm[1].padStart(2,"0")}`,
      end:   `${refYear}-${rm[4].padStart(2,"0")}-${rm[3].padStart(2,"0")}`,
    };
    const sm = p.match(/(\d{1,2})\/(\d{1,2})\s*(am|pm|eve)?/i);
    if (sm) return {
      date: `${refYear}-${sm[2].padStart(2,"0")}-${sm[1].padStart(2,"0")}`,
      slot: sm[3] || null,
    };
    return null;
  }).filter(Boolean);
}

function isFullDayOffEntry(tos, ds) {
  for (const to of tos) {
    if (to.start && to.end && ds >= to.start && ds <= to.end) return true;
    if (to.date === ds && !to.slot) return true;
  }
  return false;
}

// ── Deterministic rota builder ────────────────────────────────────────────────
function buildRota(staffIndex, dates, groups, progGrid, dayProfiles) {
  const ng   = {}; // the rota grid
  const sess = {}; // running session counts per staff
  staffIndex.forEach(s => { sess[s.id] = 0; });

  const SLOTS = ["AM","PM","Eve"];

  // Put a value in the grid. Does not overwrite. Returns true if placed.
  const put = (sid, ds, slot, val) => {
    const k = `${sid}-${ds}-${slot}`;
    if (ng[k]) return false;
    ng[k] = val;
    if (val && !NO_COUNT.has(val)) sess[sid] = (sess[sid] || 0) + 1;
    return true;
  };

  // Set all 3 slots to Day Off
  const setDayOff = (sid, ds) => SLOTS.forEach(sl => { ng[`${sid}-${ds}-${sl}`] = "Day Off"; });

  // Is staff member on site (arrival ≤ date < departure)?
  const onSite = (s, ds) => inRange(ds, s.arr, s.dep) && ds < s.dep;

  // Does staff have sessions remaining below cap?
  const hasCapacity = s => {
    const t = SESSION_TARGET(s.role);
    return t === 0 || (sess[s.id] || 0) < t;
  };

  // Daytime capacity: reserves 3 sessions for Eve-eligible staff (TAL, activity roles)
  // so Pass 3 doesn't fill their entire cap before Eve assignments happen in Pass 4.
  const EVE_RESERVE = 3;
  const hasCapacityForDaytime = s => {
    const t = SESSION_TARGET(s.role);
    if (t === 0) return true;
    const reserve = EVE_ELIGIBLE.has(s.role) ? EVE_RESERVE : 0;
    return (sess[s.id] || 0) < (t - reserve);
  };

  // Build fast lookups
  const profileMap = {};
  dayProfiles.forEach(p => { profileMap[p.ds] = p; });

  const allArrivalDates = new Set((groups || []).map(g => g.arr).filter(Boolean));
  const groupArrivalDate = [...allArrivalDates].sort()[0] || null;

  const teachers  = staffIndex.filter(s => TEACHING_ROLES.includes(s.role));
  const actStaff  = staffIndex.filter(s => ACTIVITY_ROLES.includes(s.role));
  const mgmt      = staffIndex.filter(s => MGMT_ROLES.includes(s.role));

  const refYear = groupArrivalDate
    ? new Date(groupArrivalDate).getFullYear()
    : new Date(dates[0]).getFullYear();

  // ── Pass 1: Fixed per-staff assignments ────────────────────────────────────
  // Induction, Setup (pre-arrival days), Airport, explicit time-off.
  staffIndex.forEach(s => {
    const tos = parseTimeOff(s.to, refYear);
    const onSiteDays = dates.map(dayKey).filter(ds => inRange(ds, s.arr, s.dep));
    if (!onSiteDays.length) return;

    // Induction — first day on site
    const indDs = onSiteDays[0];
    if (s.role === "5FTT" && isWeekend(new Date(indDs))) {
      setDayOff(s.id, indDs); // 5FTT can't work weekends, treat as Day Off
    } else {
      ng[`${s.id}-${indDs}-AM`] = "Induction";
      ng[`${s.id}-${indDs}-PM`] = "Induction";
    }

    // Setup — days between induction and first student arrival
    for (let i = 1; i < onSiteDays.length; i++) {
      const ds = onSiteDays[i];
      if (groupArrivalDate && ds >= groupArrivalDate) break;
      ng[`${s.id}-${ds}-AM`] = "Setup";
      ng[`${s.id}-${ds}-PM`] = "Setup";
    }

    // Airport — departure day
    if (s.dep) {
      const depDs = dayKey(new Date(s.dep));
      if (!ng[`${s.id}-${depDs}-AM`]) {
        if (s.role === "5FTT" && isWeekend(new Date(depDs))) {
          setDayOff(s.id, depDs);
        } else {
          ng[`${s.id}-${depDs}-AM`] = "Airport";
        }
      }
    }

    // Explicit time-off
    onSiteDays.forEach(ds => {
      if (!ng[`${s.id}-${ds}-AM`] && isFullDayOffEntry(tos, ds)) setDayOff(s.id, ds);
    });
  });

  // ── Pass 2: Day offs ───────────────────────────────────────────────────────
  // 1 full Day Off (all 3 slots) per 7 programme days on site.
  // FTTs: prefer FDE days, then weekends.
  // 5FTTs: prefer Mon-Fri (they don't work weekends anyway).
  // TAL / activity: prefer weekends, distribute Sat/Sun by staff index.

  const countDayOffs = sid =>
    dates.filter(d => ng[`${sid}-${dayKey(d)}-AM`] === "Day Off").length;

  const maxDayOffs = s => {
    const programmeDays = dates.filter(d => {
      const ds = dayKey(d);
      if (!onSite(s, ds) || !groupArrivalDate || ds < groupArrivalDate) return false;
      const am = ng[`${s.id}-${ds}-AM`];
      return !am || !["Induction","Setup","Airport"].includes(am);
    }).length;
    return Math.max(1, Math.floor(programmeDays / 7));
  };

  staffIndex.forEach((s, si) => {
    // Available programme days (on site, after first arrival, no fixed assignment yet)
    const available = dates.map(d => ({ date: d, ds: dayKey(d) })).filter(({ ds }) =>
      onSite(s, ds) && groupArrivalDate && ds >= groupArrivalDate && !ng[`${s.id}-${ds}-AM`]
    );

    const maxOff  = maxDayOffs(s);
    let assigned  = countDayOffs(s.id);
    const weeks   = Math.ceil(available.length / 7);

    for (let w = 0; w < weeks && assigned < maxOff; w++) {
      const wk = available.slice(w * 7, w * 7 + 7);
      if (!wk.length) continue;

      let pick = null;

      if (s.role === "FTT") {
        // FTTs: FDE day first, then alternate Sat/Sun by staff index
        const satFirst = si % 2 === 0;
        const wkend1 = satFirst ? 6 : 0; // Sat or Sun
        const wkend2 = satFirst ? 0 : 6;
        const candidates = [
          ...wk.filter(({ ds }) => profileMap[ds]?.isFDE),
          ...wk.filter(({ date }) => date.getDay() === wkend1),
          ...wk.filter(({ date }) => date.getDay() === wkend2),
          ...wk,
        ];
        pick = candidates.find(({ ds }) => !ng[`${s.id}-${ds}-AM`]) || null;

      } else if (s.role === "5FTT") {
        // 5FTTs: weekday only (not FDE, weekdays Mon-Fri)
        pick = wk.find(({ date, ds }) =>
          date.getDay() >= 1 && date.getDay() <= 5 &&
          !profileMap[ds]?.isFDE && !ng[`${s.id}-${ds}-AM`]
        ) || null;

      } else {
        // TAL / activity: prefer weekends, alternate Sat/Sun by staff index, avoid FDE
        const satFirst = si % 2 === 0;
        const wkend1 = satFirst ? 6 : 0;
        const wkend2 = satFirst ? 0 : 6;
        const candidates = [
          ...wk.filter(({ date, ds }) => date.getDay() === wkend1 && !profileMap[ds]?.isFDE),
          ...wk.filter(({ date, ds }) => date.getDay() === wkend2 && !profileMap[ds]?.isFDE),
          ...wk.filter(({ ds }) => !isWeekend(new Date(ds)) && !profileMap[ds]?.isFDE && ds !== groupArrivalDate),
          ...wk,
        ];
        pick = candidates.find(({ ds }) => !ng[`${s.id}-${ds}-AM`]) || null;
      }

      if (pick) { setDayOff(s.id, pick.ds); assigned++; }
    }
  });

  // ── Pass 3: Programme sessions day by day ──────────────────────────────────
  dates.forEach((d, di) => {
    const ds = dayKey(d);
    if (!groupArrivalDate || ds < groupArrivalDate) return;
    const p = profileMap[ds];
    if (!p) return;

    // Management always get Office on programme days
    mgmt.forEach(s => {
      if (onSite(s, ds) && !ng[`${s.id}-${ds}-AM`]) {
        ng[`${s.id}-${ds}-AM`] = "Office";
        ng[`${s.id}-${ds}-PM`] = "Office";
      }
    });

    // ── First arrival day ──────────────────────────────────────────────────
    if (p.isFirstArrival) {
      // FTTs/5FTTs: Day Off on first arrival (no teaching needed yet)
      teachers.filter(s => ["FTT","5FTT"].includes(s.role) && onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
        .forEach(s => {
          if (countDayOffs(s.id) < maxDayOffs(s)) setDayOff(s.id, ds);
          // If day off quota used up, leave empty — they're floating
        });

      // TALs + activity staff: pickup and welcome duties
      const eligible = [...teachers.filter(s => s.role === "TAL"), ...actStaff]
        .filter(s => onSite(s, ds) && !ng[`${s.id}-${ds}-AM`]);

      const pickNeed = Math.max(1, Math.ceil((p.arrivingStu || 0) / 40));
      eligible.slice(0, pickNeed).forEach(s => {
        ng[`${s.id}-${ds}-AM`] = "pickup";
        ng[`${s.id}-${ds}-PM`] = "welcome";
      });
      eligible.slice(pickNeed).forEach(s => {
        ng[`${s.id}-${ds}-AM`] = "setup";
        ng[`${s.id}-${ds}-PM`] = "welcome";
      });
      return;
    }

    // ── Subsequent arrival days ────────────────────────────────────────────
    if (p.isArrival) {
      const eligible = [...teachers.filter(s => s.role === "TAL"), ...actStaff]
        .filter(s => onSite(s, ds) && !ng[`${s.id}-${ds}-AM`]);
      const pickNeed = Math.max(1, Math.ceil((p.arrivingStu || 0) / 40));
      eligible.slice(0, pickNeed).forEach(s => {
        ng[`${s.id}-${ds}-AM`] = "pickup";
        ng[`${s.id}-${ds}-PM`] = "welcome";
      });
      // Others fall through to the day-type logic below
    }

    // No students on site → nothing to schedule
    if (!p.totalStu) return;

    // ── Full day excursion ─────────────────────────────────────────────────
    if (p.isFDE) {
      const lbl = p.fdeLabel;

      // FTTs: Day Off if quota allows, otherwise they stay at centre (Activities)
      teachers.filter(s => ["FTT","5FTT"].includes(s.role) && onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
        .forEach(s => {
          if (countDayOffs(s.id) < maxDayOffs(s)) setDayOff(s.id, ds);
          // If quota used: leave empty (FTTs float on FDE when day off exhausted)
        });

      // TALs + activity staff → excursion
      [...teachers.filter(s => s.role === "TAL"), ...actStaff]
        .filter(s => onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
        .forEach(s => {
          if (!hasCapacityForDaytime(s)) return;
          put(s.id, ds, "AM", lbl);
          put(s.id, ds, "PM", lbl);
        });
      return;
    }

    // ── Testing / English Test day ─────────────────────────────────────────
    if (p.isTestingDay) {
      // All FTTs and TALs: English Test AM + PM
      teachers.filter(s => onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
        .forEach(s => {
          if (s.role === "5FTT" && isWeekend(d)) return;
          if (!hasCapacity(s)) return;
          put(s.id, ds, "AM", "English Test");
          put(s.id, ds, "PM", "English Test");
        });

      // Activity staff: Activities
      actStaff.filter(s => onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
        .forEach(s => {
          if (!hasCapacityForDaytime(s)) return;
          put(s.id, ds, "AM", "Activities");
          put(s.id, ds, "PM", "Activities");
        });
      return;
    }

    // ── Normal programme day ───────────────────────────────────────────────
    const amNeed  = p.AM?.teachersNeeded || 0;
    const pmNeed  = p.PM?.teachersNeeded || 0;
    // Excursion labels for activity slots
    const amLbl   = p.AM?.topDest || "Activities";
    const pmLbl   = p.PM?.topDest || "Activities";

    let amCovered = 0, pmCovered = 0;

    // FTTs: teach in every slot that has lesson demand
    teachers.filter(s => s.role === "FTT" && onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
      .forEach(s => {
        if (!hasCapacity(s)) return;
        if (amNeed > 0) { put(s.id, ds, "AM", "Lessons"); amCovered++; }
        if (pmNeed > 0) { put(s.id, ds, "PM", "Lessons"); pmCovered++; }
        // If only one slot has demand the other remains empty (FTT floats)
      });

    // 5FTTs: same, weekdays only
    if (d.getDay() >= 1 && d.getDay() <= 5) {
      teachers.filter(s => s.role === "5FTT" && onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
        .forEach(s => {
          if (!hasCapacity(s)) return;
          if (amNeed > 0) { put(s.id, ds, "AM", "Lessons"); amCovered++; }
          if (pmNeed > 0) { put(s.id, ds, "PM", "Lessons"); pmCovered++; }
        });
    }

    // TALs: teach in ONE slot (the one with remaining demand), activities in the other.
    // Rotate which slot each TAL covers across the week for fairness.
    const weekNum = groupArrivalDate
      ? Math.floor((new Date(ds) - new Date(groupArrivalDate)) / (7 * 86400000))
      : 0;

    teachers.filter(s => s.role === "TAL" && onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
      .forEach((s, i) => {
        if (!hasCapacityForDaytime(s)) return;
        const remAM = amNeed - amCovered;
        const remPM = pmNeed - pmCovered;

        // Decide which slot this TAL teaches today
        const prefAM = (i + weekNum) % 2 === 0;
        let teachAM;
        if (remAM > 0 && remPM > 0)  teachAM = prefAM;
        else if (remAM > 0)           teachAM = true;
        else if (remPM > 0)           teachAM = false;
        else                          teachAM = prefAM; // no demand — just pick consistently

        if (teachAM) {
          put(s.id, ds, "AM", remAM > 0 ? "Lessons" : amLbl);
          put(s.id, ds, "PM", pmLbl);
          if (remAM > 0) amCovered++;
        } else {
          put(s.id, ds, "AM", amLbl);
          put(s.id, ds, "PM", remPM > 0 ? "Lessons" : pmLbl);
          if (remPM > 0) pmCovered++;
        }
      });

    // Activity staff: excursion or activities each slot
    actStaff.filter(s => onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
      .forEach(s => {
        if (!hasCapacityForDaytime(s)) return;
        put(s.id, ds, "AM", amLbl);
        put(s.id, ds, "PM", pmLbl);
      });
  });

  // ── Pass 4: Evening Activity ───────────────────────────────────────────────
  // One "Evening Activity" value for all nights. Rotate eligible staff fairly.
  dates.forEach((d, di) => {
    const ds = dayKey(d);
    if (!groupArrivalDate || ds < groupArrivalDate) return;
    const p = profileMap[ds];

    // Check if Evening Activity is needed tonight:
    // Primary: any group has an Eve entry in progGrid for this date
    // Fallback: calculate from student presence (group arr/dep dates)
    const hasProgEve = (groups || []).some(g => {
      const val = progGrid?.[`${g.id}-${ds}-Eve`];
      return val && val !== "Day Off" && val !== "";
    });
    const eveningStu = (groups || []).reduce((sum, g) =>
      inRange(ds, g.arr, g.dep) && ds !== g.dep ? sum + (g.stu || 0) + (g.gl || 0) : sum, 0);
    if (!hasProgEve && !eveningStu) return;

    const eveNeed = Math.max(2, Math.ceil(Math.max(eveningStu, 1) / 20));

    // Eligible: EVE_ELIGIBLE roles, on site, not Day Off, Eve slot empty.
    // Eve sessions are not restricted by daytime session cap — no hasCapacity check.
    const eligible = staffIndex
      .filter(s => EVE_ELIGIBLE.has(s.role) && onSite(s, ds))
      .filter(s => ng[`${s.id}-${ds}-AM`] !== "Day Off")
      .filter(s => !ng[`${s.id}-${ds}-Eve`]);

    // Sort by fewest evening sessions so far (fairness), then rotate by day index
    const sorted = eligible.slice().sort((a, b) => {
      const aEve = dates.filter(x => ng[`${a.id}-${dayKey(x)}-Eve`] === "Evening Activity").length;
      const bEve = dates.filter(x => ng[`${b.id}-${dayKey(x)}-Eve`] === "Evening Activity").length;
      return aEve - bEve;
    });
    const offset  = di % Math.max(1, sorted.length);
    const rotated = [...sorted.slice(offset), ...sorted.slice(0, offset)];

    let eveAssigned = 0;
    for (const s of rotated) {
      if (eveAssigned >= eveNeed) break;
      ng[`${s.id}-${ds}-Eve`] = "Evening Activity";
      eveAssigned++;
    }
  });

  return ng;
}

// ── Session limit enforcer (safety net) ───────────────────────────────────────
// Removes excess sessions from over-target staff (PM before AM, Eve before PM).
function enforceSessionLimits(grid, staffIndex) {
  const counts = {};
  staffIndex.forEach(s => { counts[s.id] = 0; });

  for (const [key, val] of Object.entries(grid)) {
    if (!val || NO_COUNT.has(val)) continue;
    const se = staffIndex.find(s => key.startsWith(s.id + "-"));
    if (se) counts[se.id]++;
  }

  // Process Eve first, then PM (least critical slots removed first)
  const bySlot = key => {
    const s = key.split("-").pop();
    return s === "Eve" ? 0 : s === "PM" ? 1 : 2;
  };
  const sortedKeys = Object.keys(grid).sort((a, b) => bySlot(a) - bySlot(b));

  for (const key of sortedKeys) {
    const val = grid[key];
    if (!val || NO_COUNT.has(val)) continue;
    const se = staffIndex.find(s => key.startsWith(s.id + "-"));
    if (!se) continue;
    const target = SESSION_TARGET(se.role);
    if (target === 0) continue;
    if (counts[se.id] > target) {
      delete grid[key];
      counts[se.id]--;
    }
  }
  return grid;
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req) {
  const encoder  = new TextEncoder();
  const sendEvent = (ctrl, data) =>
    ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { staff, groups, progGrid, progStart, progEnd } = await req.json();

        if (!staff?.length) {
          sendEvent(controller, { error: "No staff provided" });
          controller.close(); return;
        }
        if (!progStart || !progEnd) {
          sendEvent(controller, { error: "Date range required" });
          controller.close(); return;
        }

        sendEvent(controller, { step: 1, message: "Reading programme…" });

        const dates = genDates(progStart, progEnd);
        const staffIndex = staff.map((s, i) => ({
          i, id: s.id,
          name: s.name || `Staff ${i}`,
          role: s.role || "SAI",
          arr: s.arr || progStart,
          dep: s.dep || progEnd,
          to: s.to || "",
        }));

        const dayProfiles = buildDayProfiles(dates, groups, progGrid);

        sendEvent(controller, { step: 2, message: "Building rota…" });

        const grid = buildRota(staffIndex, dates, groups, progGrid, dayProfiles);

        sendEvent(controller, { step: 3, message: "Checking session limits…" });

        // Safety net: remove any cells beyond the programme date range
        const validDateKeys = new Set(dates.map(dayKey));
        for (const key of Object.keys(grid)) {
          const se = staffIndex.find(s => key.startsWith(s.id + "-"));
          if (!se) { delete grid[key]; continue; }
          const dk = key.slice(se.id.length + 1, se.id.length + 11);
          if (!validDateKeys.has(dk)) delete grid[key];
        }

        enforceSessionLimits(grid, staffIndex);

        sendEvent(controller, { grid, corrections: 0, suggestions: [] });
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
