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
  return 24; // SAI, AL, EAL, SC, AC, EAC, LAL, LAC, FOOTBALL, PA
};

// Values that do NOT count as sessions
const NO_COUNT = new Set(["Day Off", "Office", "Induction"]);

const TEACHING_ROLES = ["FTT","5FTT","TAL"];
const ACTIVITY_ROLES = ["SAI","AL","EAL","SC","AC","EAC","LAL","LAC","FOOTBALL","PA","HP"];
const MGMT_ROLES     = ["CM","CD","EAM","SWC"];

// FTTs can do Eve Activity on days when they have 0 or 1 daytime sessions
const EVE_ELIGIBLE   = new Set(["FTT","TAL","SAI","AL","EAL","SC","AC","EAC","LAL","LAC","FOOTBALL","PA","HP"]);

const EVE_LABEL = "Eve Activity";

// ── Day profile builder ───────────────────────────────────────────────────────
function buildDayProfiles(dates, groups, progGrid) {
  const allArrivalDates = new Set((groups || []).map(g => g.arr).filter(Boolean));
  const firstArrival    = [...allArrivalDates].sort()[0] || null;
  const arrStu = {};
  (groups || []).forEach(g => {
    if (g.arr) arrStu[g.arr] = (arrStu[g.arr] || 0) + (g.stu || 0) + (g.gl || 0);
  });

  return dates.map(d => {
    const ds = dayKey(d);
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
        if (ds === g.arr || ds === g.dep) return;

        const val = String(progGrid?.[g.id + "-" + ds + "-" + slot] || "").trim();
        const pax = (g.stu || 0) + (g.gl || 0);

        if (val && /english\s*test|placement\s*test/i.test(val)) {
          testStu += pax; return;
        }
        if (val && /^(english\s+lessons?|lessons?|classes?)$/i.test(val)) {
          lessonStu += pax; return;
        }
        if (val && !/arriv|depart/i.test(val)) {
          excDests[val] = (excDests[val] || 0) + pax; return;
        }
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
function buildRota(staffIndex, dates, groups, progGrid, dayProfiles, isZZ) {
  const ng   = {};
  const sess = {};
  staffIndex.forEach(s => { sess[s.id] = 0; });

  const SLOTS = ["AM","PM","Eve"];

  const put = (sid, ds, slot, val) => {
    const k = `${sid}-${ds}-${slot}`;
    if (ng[k]) return false;
    ng[k] = val;
    if (val && !NO_COUNT.has(val)) sess[sid] = (sess[sid] || 0) + 1;
    return true;
  };

  const setDayOff = (sid, ds) => SLOTS.forEach(sl => { ng[`${sid}-${ds}-${sl}`] = "Day Off"; });

  const onSite = (s, ds) => inRange(ds, s.arr, s.dep) && ds < s.dep;

  const hasCapacity = s => {
    const t = SESSION_TARGET(s.role);
    return t === 0 || (sess[s.id] || 0) < t;
  };

  // Count how many sessions a staff member has in a given day (AM + PM + Eve combined)
  const dailyCount = (sid, ds) => {
    return SLOTS.reduce((n, sl) => {
      const v = ng[`${sid}-${ds}-${sl}`];
      return n + (v && !NO_COUNT.has(v) ? 1 : 0);
    }, 0);
  };

  // Can this staff member take on another session today? (hard cap = 2 per day)
  const hasDailyCapacity = (sid, ds) => dailyCount(sid, ds) < 2;

  // Reserve 2 sessions for Eve-eligible staff so daytime pass doesn't saturate their cap
  const EVE_RESERVE = 2;
  const hasCapacityForDaytime = s => {
    const t = SESSION_TARGET(s.role);
    if (t === 0) return true;
    const reserve = EVE_ELIGIBLE.has(s.role) ? EVE_RESERVE : 0;
    return (sess[s.id] || 0) < (t - reserve);
  };

  // Would giving this teacher a day off on ds leave enough coverage?
  // Prefer days where coverage is maintained; fall back to any day if unavoidable.
  const teacherCoverageOk = (s, ds) => {
    if (!TEACHING_ROLES.includes(s.role)) return true;
    const p = profileMap[ds];
    if (!p || p.isFDE) return true; // FDE: no lessons, so no coverage needed
    const needed = Math.max(p.AM?.teachersNeeded || 0, p.PM?.teachersNeeded || 0);
    if (needed === 0) return true;
    const stillAvail = teachers.filter(t =>
      t.id !== s.id &&
      onSite(t, ds) &&
      ng[`${t.id}-${ds}-AM`] !== "Day Off" &&
      !["Induction","Setup"].includes(ng[`${t.id}-${ds}-AM`] || "")
    ).length;
    return stillAvail >= needed;
  };

  const profileMap = {};
  dayProfiles.forEach(p => { profileMap[p.ds] = p; });

  const allArrivalDates = new Set((groups || []).map(g => g.arr).filter(Boolean));
  const groupArrivalDate = [...allArrivalDates].sort()[0] || null;

  const teachers = staffIndex.filter(s => TEACHING_ROLES.includes(s.role));
  const actStaff = staffIndex.filter(s => ACTIVITY_ROLES.includes(s.role));
  const mgmt     = staffIndex.filter(s => MGMT_ROLES.includes(s.role));

  const refYear = groupArrivalDate
    ? new Date(groupArrivalDate).getFullYear()
    : new Date(dates[0]).getFullYear();

  // ── Pass 1: Fixed per-staff assignments ───────────────────────────────────
  staffIndex.forEach(s => {
    const tos = parseTimeOff(s.to, refYear);
    const onSiteDays = dates.map(dayKey).filter(ds => inRange(ds, s.arr, s.dep));
    if (!onSiteDays.length) return;

    // Induction — first day on site (AM + PM placeholder)
    const indDs = onSiteDays[0];
    if (s.role === "5FTT" && isWeekend(new Date(indDs))) {
      setDayOff(s.id, indDs);
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

    // Explicit time-off
    onSiteDays.forEach(ds => {
      if (!ng[`${s.id}-${ds}-AM`] && isFullDayOffEntry(tos, ds)) setDayOff(s.id, ds);
    });
  });

  // ── Pass 2: Day offs ──────────────────────────────────────────────────────
  const countDayOffs = sid =>
    dates.filter(d => ng[`${sid}-${dayKey(d)}-AM`] === "Day Off").length;

  const maxDayOffs = s => {
    const programmeDays = dates.filter(d => {
      const ds = dayKey(d);
      if (!onSite(s, ds) || !groupArrivalDate || ds < groupArrivalDate) return false;
      const am = ng[`${s.id}-${ds}-AM`];
      return !am || !["Induction","Setup"].includes(am);
    }).length;
    return Math.max(1, Math.floor(programmeDays / 7));
  };

  staffIndex.forEach((s, si) => {
    const available = dates.map(d => ({ date: d, ds: dayKey(d) })).filter(({ ds }) =>
      onSite(s, ds) && groupArrivalDate && ds >= groupArrivalDate && !ng[`${s.id}-${ds}-AM`]
    );

    const maxOff = maxDayOffs(s);
    let assigned = countDayOffs(s.id);
    const weeks  = Math.ceil(available.length / 7);

    for (let w = 0; w < weeks && assigned < maxOff; w++) {
      const wk = available.slice(w * 7, w * 7 + 7);
      if (!wk.length) continue;

      let pick = null;

      const pickBest = (candidates) => {
        // Prefer days where teaching coverage is still adequate after the day off
        const free = ({ ds }) => !ng[`${s.id}-${ds}-AM`];
        return candidates.find(c => free(c) && teacherCoverageOk(s, c.ds))
            || candidates.find(c => free(c))
            || null;
      };

      if (s.role === "FTT") {
        const satFirst = si % 2 === 0;
        const wkend1 = satFirst ? 6 : 0;
        const wkend2 = satFirst ? 0 : 6;
        pick = pickBest([
          ...wk.filter(({ ds }) => profileMap[ds]?.isFDE),
          ...wk.filter(({ date }) => date.getDay() === wkend1),
          ...wk.filter(({ date }) => date.getDay() === wkend2),
          ...wk,
        ]);

      } else if (s.role === "5FTT") {
        pick = pickBest(wk.filter(({ date, ds }) =>
          date.getDay() >= 1 && date.getDay() <= 5 && !profileMap[ds]?.isFDE
        ));

      } else {
        const satFirst = si % 2 === 0;
        const wkend1 = satFirst ? 6 : 0;
        const wkend2 = satFirst ? 0 : 6;
        // TALs and activity staff must never get Day Off on FDE days — they go on the excursion
        pick = pickBest([
          ...wk.filter(({ date, ds }) => date.getDay() === wkend1 && !profileMap[ds]?.isFDE),
          ...wk.filter(({ date, ds }) => date.getDay() === wkend2 && !profileMap[ds]?.isFDE),
          ...wk.filter(({ ds }) => !isWeekend(new Date(ds)) && !profileMap[ds]?.isFDE && ds !== groupArrivalDate),
          ...wk.filter(({ ds }) => !profileMap[ds]?.isFDE),
        ]);
      }

      if (pick) { setDayOff(s.id, pick.ds); assigned++; }
    }
  });

  // ── Pass 3: Programme sessions day by day ─────────────────────────────────
  dates.forEach((d, di) => {
    const ds = dayKey(d);
    if (!groupArrivalDate || ds < groupArrivalDate) return;
    const p = profileMap[ds];
    if (!p) return;

    // Management: Office on programme days
    mgmt.forEach(s => {
      if (onSite(s, ds) && !ng[`${s.id}-${ds}-AM`]) {
        ng[`${s.id}-${ds}-AM`] = "Office";
        ng[`${s.id}-${ds}-PM`] = "Office";
      }
    });

    // ── First arrival day ────────────────────────────────────────────────────
    if (p.isFirstArrival) {
      // FTTs: blank on arrival day (floating — do NOT consume a day-off quota)
      // TALs + activity staff: limited subset do pickup/welcome, rest are blank
      const eligible = [...teachers.filter(s => s.role === "TAL"), ...actStaff]
        .filter(s => onSite(s, ds) && !ng[`${s.id}-${ds}-AM`]);

      const pickNeed = Math.max(1, Math.ceil((p.arrivingStu || 0) / 40));
      // Only assign the minimum needed — the rest stay blank
      eligible.slice(0, pickNeed).forEach(s => {
        ng[`${s.id}-${ds}-AM`] = "pickup";
        ng[`${s.id}-${ds}-PM`] = "welcome";
      });
      eligible.slice(pickNeed, pickNeed * 2).forEach(s => {
        ng[`${s.id}-${ds}-AM`] = "setup";
        ng[`${s.id}-${ds}-PM`] = "welcome";
      });
      return;
    }

    // ── Subsequent arrival days ──────────────────────────────────────────────
    if (p.isArrival) {
      const eligible = [...teachers.filter(s => s.role === "TAL"), ...actStaff]
        .filter(s => onSite(s, ds) && !ng[`${s.id}-${ds}-AM`]);
      const pickNeed = Math.max(1, Math.ceil((p.arrivingStu || 0) / 40));
      eligible.slice(0, pickNeed).forEach(s => {
        ng[`${s.id}-${ds}-AM`] = "pickup";
        ng[`${s.id}-${ds}-PM`] = "welcome";
      });
    }

    if (!p.totalStu) return;

    // ── Full day excursion ───────────────────────────────────────────────────
    if (p.isFDE) {
      const lbl = p.fdeLabel;

      // FTTs: Day Off on FDE (they never go on excursions)
      teachers.filter(s => ["FTT","5FTT"].includes(s.role) && onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
        .forEach(s => {
          if (countDayOffs(s.id) < maxDayOffs(s)) setDayOff(s.id, ds);
          // If quota exhausted, leave blank — they float
        });

      // TALs + activity staff → excursion AM + PM (2 sessions — within daily cap)
      [...teachers.filter(s => s.role === "TAL"), ...actStaff]
        .filter(s => onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
        .forEach(s => {
          if (!hasCapacityForDaytime(s)) return;
          put(s.id, ds, "AM", lbl);
          put(s.id, ds, "PM", lbl);
        });
      return;
    }

    // ── Testing / English Test day ───────────────────────────────────────────
    if (p.isTestingDay) {
      teachers.filter(s => onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
        .forEach(s => {
          if (s.role === "5FTT" && isWeekend(d)) return;
          if (!hasCapacity(s)) return;
          if (!hasDailyCapacity(s.id, ds)) return;
          put(s.id, ds, "AM", "English Test");
          // Only assign PM if daily cap allows (2 sessions max)
          if (hasDailyCapacity(s.id, ds)) put(s.id, ds, "PM", "English Test");
        });

      actStaff.filter(s => onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
        .forEach(s => {
          if (!hasCapacityForDaytime(s)) return;
          if (!hasDailyCapacity(s.id, ds)) return;
          put(s.id, ds, "AM", "Activities");
          if (hasDailyCapacity(s.id, ds)) put(s.id, ds, "PM", "Activities");
        });
      return;
    }

    // ── Normal programme day ─────────────────────────────────────────────────
    const amNeed = p.AM?.teachersNeeded || 0;
    const pmNeed = p.PM?.teachersNeeded || 0;
    const amLbl  = p.AM?.topDest || "Activities";
    const pmLbl  = p.PM?.topDest || "Activities";

    let amCovered = 0, pmCovered = 0;

    // FTTs (ZZ only): teach in slots with lesson demand — never excursions
    if (isZZ) {
      teachers.filter(s => s.role === "FTT" && onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
        .forEach(s => {
          if (!hasCapacity(s)) return;
          if (amNeed > 0 && hasDailyCapacity(s.id, ds)) {
            put(s.id, ds, "AM", "Lessons");
            amCovered++;
          }
          if (pmNeed > 0 && hasDailyCapacity(s.id, ds)) {
            put(s.id, ds, "PM", "Lessons");
            pmCovered++;
          }
        });
    }

    // 5FTTs: weekdays only
    if (d.getDay() >= 1 && d.getDay() <= 5) {
      teachers.filter(s => s.role === "5FTT" && onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
        .forEach(s => {
          if (!hasCapacity(s)) return;
          if (amNeed > 0 && hasDailyCapacity(s.id, ds)) { put(s.id, ds, "AM", "Lessons"); amCovered++; }
          if (pmNeed > 0 && hasDailyCapacity(s.id, ds)) { put(s.id, ds, "PM", "Lessons"); pmCovered++; }
        });
    }

    // TALs: teach ONE slot + activities/excursion in the other (never both slots teaching)
    const weekNum = groupArrivalDate
      ? Math.floor((new Date(ds) - new Date(groupArrivalDate)) / (7 * 86400000))
      : 0;

    teachers.filter(s => s.role === "TAL" && onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
      .forEach((s, i) => {
        if (!hasCapacityForDaytime(s)) return;
        if (!hasDailyCapacity(s.id, ds)) return;

        const remAM = amNeed - amCovered;
        const remPM = pmNeed - pmCovered;
        const prefAM = (i + weekNum) % 2 === 0;

        // For NZZ: lessons only in AM — TAL teaches AM if needed, activities PM
        // For ZZ: lessons can be in either slot — alternate fairly
        let teachAM;
        if (!isZZ) {
          // NZZ: always teach AM if there's demand, activities PM
          teachAM = remAM > 0;
        } else if (remAM > 0 && remPM > 0) {
          teachAM = prefAM;
        } else if (remAM > 0) {
          teachAM = true;
        } else if (remPM > 0) {
          teachAM = false;
        } else {
          teachAM = prefAM;
        }

        if (teachAM) {
          put(s.id, ds, "AM", remAM > 0 ? "Lessons" : amLbl);
          // Second slot: activities or excursion (never lessons for TAL)
          if (hasDailyCapacity(s.id, ds)) put(s.id, ds, "PM", pmLbl);
          if (remAM > 0) amCovered++;
        } else {
          put(s.id, ds, "AM", amLbl);
          if (hasDailyCapacity(s.id, ds)) put(s.id, ds, "PM", remPM > 0 ? "Lessons" : pmLbl);
          if (remPM > 0) pmCovered++;
        }
      });

    // Activity staff: excursion or activities each slot
    actStaff.filter(s => onSite(s, ds) && !ng[`${s.id}-${ds}-AM`])
      .forEach(s => {
        if (!hasCapacityForDaytime(s)) return;
        if (!hasDailyCapacity(s.id, ds)) return;
        put(s.id, ds, "AM", amLbl);
        if (hasDailyCapacity(s.id, ds)) put(s.id, ds, "PM", pmLbl);
      });
  });

  // ── Pass 4: Eve Activity ──────────────────────────────────────────────────
  dates.forEach((d, di) => {
    const ds = dayKey(d);
    if (!groupArrivalDate || ds < groupArrivalDate) return;

    const groupsOnSite = (groups || []).filter(g =>
      inRange(ds, g.arr, g.dep) && ds !== g.dep
    );
    const hasProgEve = groupsOnSite.some(g => {
      const val = progGrid?.[`${g.id}-${ds}-Eve`];
      return val && val !== "Day Off" && val !== "";
    });
    const eveningStu = groupsOnSite.reduce((sum, g) =>
      sum + (g.stu || 0) + (g.gl || 0), 0);
    // Assign Eve Activity if any groups are on site — student count may not be set
    if (!hasProgEve && !groupsOnSite.length) return;

    const eveNeed = Math.max(2, Math.ceil(Math.max(eveningStu, 1) / 20));

    const eligible = staffIndex
      .filter(s => EVE_ELIGIBLE.has(s.role) && onSite(s, ds))
      .filter(s => ng[`${s.id}-${ds}-AM`] !== "Day Off")
      .filter(s => !ng[`${s.id}-${ds}-Eve`])
      .filter(s => hasCapacity(s))
      // Hard cap: only assign Eve if staff have fewer than 2 sessions today
      .filter(s => hasDailyCapacity(s.id, ds));

    // Sort by fewest Eve Activity sessions so far (fairness), then rotate
    const sorted = eligible.slice().sort((a, b) => {
      const aEve = dates.filter(x => ng[`${a.id}-${dayKey(x)}-Eve`] === EVE_LABEL).length;
      const bEve = dates.filter(x => ng[`${b.id}-${dayKey(x)}-Eve`] === EVE_LABEL).length;
      return aEve - bEve;
    });
    const offset  = di % Math.max(1, sorted.length);
    const rotated = [...sorted.slice(offset), ...sorted.slice(0, offset)];

    let eveAssigned = 0;
    for (const s of rotated) {
      if (eveAssigned >= eveNeed) break;
      ng[`${s.id}-${ds}-Eve`] = EVE_LABEL;
      eveAssigned++;
    }
  });

  // ── Pass 5: Session top-up for teaching staff below target ──────────────────
  // FTTs and TALs who have fewer than their target sessions get Eve Activity
  // assigned on remaining evenings where students are on site and daily cap allows.
  const teachingTargeted = staffIndex.filter(s =>
    TEACHING_ROLES.includes(s.role) && SESSION_TARGET(s.role) > 0
  );

  teachingTargeted.sort((a, b) => (sess[a.id] || 0) - (sess[b.id] || 0));

  teachingTargeted.forEach(s => {
    const target = SESSION_TARGET(s.role);
    if ((sess[s.id] || 0) >= target) return;

    dates.forEach(d => {
      if ((sess[s.id] || 0) >= target) return;
      const ds = dayKey(d);
      if (!onSite(s, ds) || !groupArrivalDate || ds < groupArrivalDate) return;
      if (ng[`${s.id}-${ds}-AM`] === "Day Off") return;
      if (ng[`${s.id}-${ds}-Eve`]) return;
      if (!EVE_ELIGIBLE.has(s.role)) return;
      if (!hasDailyCapacity(s.id, ds)) return;

      const anyGroupOnSite = (groups || []).some(g =>
        inRange(ds, g.arr, g.dep) && ds !== g.dep
      );
      if (!anyGroupOnSite) return;

      put(s.id, ds, "Eve", EVE_LABEL);
    });
  });

  return ng;
}

// ── Session limit enforcer (safety net) ──────────────────────────────────────
function enforceSessionLimits(grid, staffIndex) {
  const counts = {};
  staffIndex.forEach(s => { counts[s.id] = 0; });

  for (const [key, val] of Object.entries(grid)) {
    if (!val || NO_COUNT.has(val)) continue;
    const se = staffIndex.find(s => key.startsWith(s.id + "-"));
    if (se) counts[se.id]++;
  }

  // Also enforce the per-day cap: remove any day where a staff member has 3 sessions
  const dateSet = new Set();
  Object.keys(grid).forEach(key => {
    const se = staffIndex.find(s => key.startsWith(s.id + "-"));
    if (!se) return;
    const dk = key.slice(se.id.length + 1, se.id.length + 11);
    dateSet.add(`${se.id}::${dk}`);
  });

  for (const combo of dateSet) {
    const [sid, dk] = combo.split("::");
    const slots = ["AM","PM","Eve"];
    const counted = slots.filter(sl => {
      const v = grid[`${sid}-${dk}-${sl}`];
      return v && !NO_COUNT.has(v);
    });
    if (counted.length <= 2) continue;
    // Remove Eve first (least critical), then PM
    const toRemove = counted.length > 2 ? ["Eve","PM"] : ["Eve"];
    for (const sl of toRemove) {
      if (counted.length <= 2) break;
      const k = `${sid}-${dk}-${sl}`;
      if (grid[k] && !NO_COUNT.has(grid[k])) {
        const se = staffIndex.find(s => s.id === sid);
        if (se) counts[se.id]--;
        delete grid[k];
        counted.splice(counted.indexOf(sl), 1);
      }
    }
  }

  // Remove sessions beyond fortnight target (Eve first, then PM)
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
  const encoder   = new TextEncoder();
  const sendEvent = (ctrl, data) =>
    ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { staff, groups, progGrid, progStart, progEnd, isZZ } = await req.json();

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

        const grid = buildRota(staffIndex, dates, groups, progGrid, dayProfiles, !!isZZ);

        sendEvent(controller, { step: 3, message: "Checking session limits…" });

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
